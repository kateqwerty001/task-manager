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