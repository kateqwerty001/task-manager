import os
import functions_framework
from google.oauth2 import id_token
from datetime import date, datetime
from google.auth.transport import requests as google_requests
from google.cloud import firestore

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
db = firestore.Client(project=os.environ.get("GCP_PROJECT", "local-project"))

VALID_PRIORITIES = ("low", "medium", "high")
VALID_STATUSES = ("todo", "in_progress", "done")
MAX_TITLE_LENGTH = 100
MAX_DESC_LENGTH = 1000
MAX_DUE_DATE_YEARS = 10


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
def update_task(request):
    if request.method == "OPTIONS":
        return (
            "",
            204,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "PATCH",
                "Access-Control-Allow-Headers": "Authorization, Content-Type",
            },
        )
    cors = {"Access-Control-Allow-Origin": "*"}

    if request.method != "PATCH":
        return ({"error": "Method not allowed"}, 405, cors)

    token_info, err = verify_token(request)
    if err:
        return (err[0], err[1], cors)

    task_id = request.path.strip("/").split("/")[-1]
    if not task_id:
        return ({"error": "task id is required in the URL path"}, 400, cors)

    doc = db.collection("tasks").document(task_id).get()
    if not doc.exists:
        return ({"error": "Task not found"}, 404, cors)

    if doc.to_dict().get("user_id") != token_info["sub"]:
        return ({"error": "Forbidden"}, 403, cors)

    body = request.get_json(silent=True) or {}
    if not body:
        return ({"error": "Request body is empty"}, 400, cors)

    # Build the update — only touch fields the caller actually sent
    updates = {}

    if "title" in body:
        title = body["title"].strip()
        if not title:
            return ({"error": "title cannot be empty"}, 422, cors)
        if len(title) > MAX_TITLE_LENGTH:
            return (
                {"error": f"title must be {MAX_TITLE_LENGTH} characters or fewer"},
                422,
                cors,
            )
        updates["title"] = title

    if "description" in body:
        description = body["description"]
        if description is not None:
            description = description.strip()
            if len(description) > MAX_DESC_LENGTH:
                return (
                    {
                        "error": f"description must be {MAX_DESC_LENGTH} characters or fewer"
                    },
                    422,
                    cors,
                )
            description = description or None
        updates["description"] = description

    if "due_date" in body:
        due_date = body["due_date"]
        if due_date is not None:
            try:
                parsed_date = datetime.strptime(due_date, "%Y-%m-%d").date()
            except ValueError:
                return ({"error": "due_date must be in YYYY-MM-DD format"}, 422, cors)
            if parsed_date < date.today():
                return ({"error": "due_date cannot be in the past"}, 422, cors)
            if parsed_date.year > date.today().year + MAX_DUE_DATE_YEARS:
                return (
                    {
                        "error": f"due_date cannot be more than {MAX_DUE_DATE_YEARS} years in the future"
                    },
                    422,
                    cors,
                )
        updates["due_date"] = due_date

    if "priority" in body:
        if body["priority"] not in VALID_PRIORITIES:
            return (
                {"error": f"priority must be one of: {', '.join(VALID_PRIORITIES)}"},
                422,
                cors,
            )
        updates["priority"] = body["priority"]

    if "status" in body:
        if body["status"] not in VALID_STATUSES:
            return (
                {"error": f"status must be one of: {', '.join(VALID_STATUSES)}"},
                422,
                cors,
            )
        updates["status"] = body["status"]

    if not updates:
        return ({"error": "No valid fields to update"}, 400, cors)

    updates["updated_at"] = firestore.SERVER_TIMESTAMP
    db.collection("tasks").document(task_id).update(updates)

    updated = db.collection("tasks").document(task_id).get()
    return ({"id": updated.id, **updated.to_dict()}, 200, cors)
