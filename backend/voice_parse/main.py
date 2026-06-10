import os
import json
import base64
import requests as http_requests
import functions_framework
from datetime import date
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from openai import OpenAI

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get(
    "LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"
)
LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-2.5-flash")
GEMINI_REST_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
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
    auth_header = (
        request.headers.get("X-Forwarded-Authorization")
        or request.headers.get("Authorization", "")
    )
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
    audio_data = body.get("audio_data")
    audio_mime_type = body.get("audio_mime_type", "audio/webm")
    transcript = body.get("transcript", "").strip()

    if not audio_data and not transcript:
        return ({"error": "audio_data or transcript field is required"}, 400, cors)

    system_prompt = SYSTEM_PROMPT.format(today=date.today().isoformat())

    if audio_data:
        try:
            parsed = _parse_audio(audio_data, audio_mime_type, system_prompt)
        except Exception as e:
            return ({"error": f"Audio parsing failed: {str(e)}"}, 500, cors)
    else:
        was_truncated = len(transcript) > MAX_CHARS_PROMPT
        transcript = transcript[:MAX_CHARS_PROMPT]
        if was_truncated:
            transcript += f" [...truncated at {MAX_CHARS_PROMPT} characters...]"

        client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript},
            ],
            max_tokens=300,
            temperature=0,
        )
        raw = response.choices[0].message.content.strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return ({"error": "LLM returned invalid JSON", "raw": raw}, 500, cors)

    if parsed.get("priority") not in ("low", "medium", "high"):
        parsed["priority"] = "medium"

    return (parsed, 200, cors)


def _parse_audio(audio_data, mime_type, system_prompt):
    url = GEMINI_REST_URL.format(model=LLM_MODEL)
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{
            "parts": [
                {"text": "Transcribe this voice recording and extract the task fields."},
                {"inline_data": {"mime_type": mime_type, "data": audio_data}},
            ]
        }],
        "generationConfig": {"temperature": 0, "maxOutputTokens": 300},
    }
    resp = http_requests.post(
        url, json=payload, params={"key": LLM_API_KEY}, timeout=30
    )
    resp.raise_for_status()
    raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    # Strip markdown code fences if the model wraps with them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
