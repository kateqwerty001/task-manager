import os
import functions_framework
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.cloud import firestore
from datetime import date, datetime

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
db = firestore.Client(project=os.environ.get("GCP_PROJECT", "local-project"))

VALID_PRIORITIES = ("low", "medium", "high")
VALID_STATUSES = ("todo", "in_progress", "done")
MAX_TITLE_LENGTH = 100
MAX_DESC_LENGTH = 1000
MAX_DUE_DATE_YEARS = 10


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


def get_or_create_user(token_info):
    user_id = token_info["sub"]
    user_ref = db.collection("users").document(user_id)
    if not user_ref.get().exists:
        user_ref.set(
            {
                "google_id": user_id,
                "email": token_info.get("email", ""),
                "role": "user",
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )
    return user_ref.get().to_dict()


@functions_framework.http
def create_task(request):
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

    get_or_create_user(token_info)
    user_id = token_info["sub"]

    body = request.get_json(silent=True) or {}

    # Validate required field
    title = body.get("title", "").strip()
    if not title:
        return ({"error": "title is required"}, 400, cors)
    if len(title) > MAX_TITLE_LENGTH:
        return (
            {"error": f"title must be {MAX_TITLE_LENGTH} characters or fewer"},
            422,
            cors,
        )

    description = body.get("description")
    if description is not None:
        description = description.strip()
        if len(description) > MAX_DESC_LENGTH:
            return (
                {"error": f"description must be {MAX_DESC_LENGTH} characters or fewer"},
                422,
                cors,
            )
        if not description:  # was non-None but became empty after strip()
            description = None  # treat "   " the same as not providing it

    # Validate optional fields
    priority = body.get("priority", "medium")
    if priority not in VALID_PRIORITIES:
        return (
            {"error": f"priority must be one of: {', '.join(VALID_PRIORITIES)}"},
            422,
            cors,
        )

    due_date = body.get("due_date")
    if due_date is not None:
        # Check format — must be YYYY-MM-DD
        try:
            parsed_date = datetime.strptime(due_date, "%Y-%m-%d").date()
        except ValueError:
            return ({"error": "due_date must be in YYYY-MM-DD format"}, 422, cors)

        today = date.today()

        # Must not be in the past
        if parsed_date < today:
            return ({"error": "due_date cannot be in the past"}, 422, cors)

        # Must not be unreasonably far in the future
        if parsed_date.year > today.year + MAX_DUE_DATE_YEARS:
            return (
                {
                    "error": f"due_date cannot be more than {MAX_DUE_DATE_YEARS} years in the future"
                },
                422,
                cors,
            )

    new_task = {
        "user_id": user_id,
        "title": title,
        "description": body.get("description"),
        "priority": priority,
        "status": "todo",  # always starts as todo
        "due_date": body.get("due_date"),
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    # Firestore .add() returns (timestamp, DocumentReference)
    _, doc_ref = db.collection("tasks").add(new_task)

    # Re-fetch to get the server-assigned timestamps
    created = db.collection("tasks").document(doc_ref.id).get()
    return ({"id": created.id, **created.to_dict()}, 201, cors)
