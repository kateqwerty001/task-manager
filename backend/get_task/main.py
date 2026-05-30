import os
import functions_framework
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google.cloud import firestore

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
db = firestore.Client(project=os.environ.get("GCP_PROJECT", "local-project"))


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
def get_task(request):
    if request.method == "OPTIONS":
        return (
            "",
            204,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "Authorization",
            },
        )
    cors = {"Access-Control-Allow-Origin": "*"}

    if request.method != "GET":
        return ({"error": "Method not allowed"}, 405, cors)

    token_info, err = verify_token(request)
    if err:
        return (err[0], err[1], cors)

    # The task ID comes from the URL path: /tasks/abc123
    # Locally the full path is just whatever you send; in GCP the Gateway strips the prefix.
    task_id = request.path.strip("/").split("/")[-1]
    if not task_id:
        return ({"error": "task id is required in the URL path"}, 400, cors)

    doc = db.collection("tasks").document(task_id).get()
    if not doc.exists:
        return ({"error": "Task not found"}, 404, cors)

    data = doc.to_dict()
    # Users can only see their own tasks
    if data.get("user_id") != token_info["sub"]:
        return ({"error": "Forbidden"}, 403, cors)

    return ({"id": doc.id, **data}, 200, cors)
