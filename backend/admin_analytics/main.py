import os
import functions_framework
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.cloud import firestore

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
db = firestore.Client(project=os.environ.get("GCP_PROJECT", "local-project"))


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


def get_or_create_user(token_info):
    user_id = token_info["sub"]
    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()
    if not doc.exists:
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
def admin_analytics(request):
    if request.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "Authorization",
        }
        return ("", 204, headers)

    cors = {"Access-Control-Allow-Origin": "*"}

    if request.method != "GET":
        return ({"error": "Method not allowed"}, 405, cors)

    token_info, err = verify_token(request)
    if err:
        return (err[0], err[1], cors)

    user = get_or_create_user(token_info)

    # Only admins can access this endpoint
    if user.get("role") != "admin":
        return ({"error": "Forbidden - admin only"}, 403, cors)

    # Count users
    total_users = len(list(db.collection("users").stream()))

    # Count tasks
    all_tasks = list(db.collection("tasks").stream())
    total_tasks = len(all_tasks)

    # Tasks by status
    tasks_by_status = {"todo": 0, "in_progress": 0, "done": 0}
    for doc in all_tasks:
        status = doc.to_dict().get("status", "todo")
        if status in tasks_by_status:
            tasks_by_status[status] += 1

    # Tasks by priority
    tasks_by_priority = {"low": 0, "medium": 0, "high": 0}
    for doc in all_tasks:
        priority = doc.to_dict().get("priority", "medium")
        if priority in tasks_by_priority:
            tasks_by_priority[priority] += 1

    return (
        {
            "total_users": total_users,
            "total_tasks": total_tasks,
            "tasks_by_status": tasks_by_status,
            "tasks_by_priority": tasks_by_priority,
        },
        200,
        cors
    )
