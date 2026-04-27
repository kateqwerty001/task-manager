resource "google_project_service" "apis" {
  for_each = toset([
    "apigateway.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com"
  ])
  service = each.key

  disable_on_destroy = false
}