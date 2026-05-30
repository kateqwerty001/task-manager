import os
import json
import functions_framework
from datetime import date
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from openai import OpenAI  # openai package works with Grok's API

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.x.ai/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "grok-3-mini")
MAX_CHARS_PROMPT = 1000
SYSTEM_PROMPT = """
You are a task extraction assistant. The user will describe a task verbally.
Extract fields and respond with ONLY a valid JSON object — no explanation, no markdown:
{{
  "title":       "<short title, max 80 chars>",
  "description": "<more detail or null, max 800 chars>",
  "priority":    "<low | medium | high>",
  "due_date":    "<YYYY-MM-DD or null>"
}}
Default priority to "medium" if not mentioned. Default due_date to null if not mentioned.
Today is {today}.
"""


def verify_token(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, ({"error": "Missing Authorization header"}, 401)
    token = auth_header[len("Bearer ") :]
    if os.environ.get("SKIP_AUTH") == "true":
        return {"sub": "local-test-user", "email": "dev@local.test"}, None
    try:
        info = id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        return info, None
    except Exception as e:
        return None, ({"error": f"Invalid token: {str(e)}"}, 401)


@functions_framework.http
def voice_parse(request):
    if request.method == "OPTIONS":
        return (
            "",
            204,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
            },
        )
    cors = {"Access-Control-Allow-Origin": "*"}

    if request.method != "POST":
        return ({"error": "Method not allowed"}, 405, cors)

    token_info, err = verify_token(request)
    if err:
        return (err[0], err[1], cors)

    body = request.get_json(silent=True) or {}
    transcript = body.get("transcript", "").strip()
    if not transcript:
        return ({"error": "transcript field is required"}, 400, cors)

    # Limit to MAX_CHARS_PROMPT chars to control LLM costs
    was_truncated = len(transcript) > MAX_CHARS_PROMPT
    transcript = transcript[:MAX_CHARS_PROMPT]

    if was_truncated:
        transcript += f" [...file truncated at {MAX_CHARS_PROMPT} characters...]"

    client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT.format(today=date.today().isoformat()),
            },
            {"role": "user", "content": transcript},
        ],
        max_tokens=300,
        temperature=0,  # deterministic output — we want consistent JSON
    )

    raw = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # LLM returned something unexpected — return it so the frontend can show an error
        return ({"error": "LLM returned invalid JSON", "raw": raw}, 500, cors)

    # Sanitise priority in case the LLM hallucinated
    if parsed.get("priority") not in ("low", "medium", "high"):
        parsed["priority"] = "medium"

    return (parsed, 200, cors)
