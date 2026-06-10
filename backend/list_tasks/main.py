import os
import functions_framework
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from safe_errors import log_error

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
        log_error("Token verification failed", e)
        return None, ({"error": "Invalid or expired token"}, 401)


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
def list_tasks(request):
    # CORS preflight (needed when called from a browser)
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

    get_or_create_user(
        token_info
    )  # making sure the user document exists in Firestore before you do anything else
    user_id = token_info["sub"]

    # Optional query parameters: ?status=todo  ?priority=high
    status = request.args.get("status")
    priority = request.args.get("priority")

    # query = db.collection("tasks").where("user_id", "==", user_id)
    query = db.collection("tasks").where(filter=FieldFilter("user_id", "==", user_id))

    # These filters require the composite index in Firestore.
    # Locally (emulator) it works without the index.
    if status:
        # query.where("user_id", "==", user_id)
        query = query.where(filter=FieldFilter("status", "==", status))
    if priority:
        # query.where("status", "==", status)
        query = query.where(filter=FieldFilter("priority", "==", priority))

    tasks = []
    for doc in query.stream():
        tasks.append({"id": doc.id, **doc.to_dict()})

    return (tasks, 200, cors)
