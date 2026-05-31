resource "google_secret_manager_secret" "llm_key" {
  secret_id = "llm-api-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "oauth_id" {
  secret_id = "google-oauth-client-id"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_iam_member" "oauth_id_access" {
  secret_id = google_secret_manager_secret.oauth_id.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:task-manager-sa@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_secret_manager_secret_iam_member" "llm_key_access" {
  secret_id = google_secret_manager_secret.llm_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:task-manager-sa@${var.project_id}.iam.gserviceaccount.com"
}