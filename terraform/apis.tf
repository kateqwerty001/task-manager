resource "google_project_service" "apis" {
  for_each = toset([
    "apigateway.googleapis.com",        # API Gateway management (routing, quotas)
    "cloudfunctions.googleapis.com",    # Deployment and execution of serverless functions
    "cloudbuild.googleapis.com",        # Build images for Cloud Functions gen2
    "firestore.googleapis.com",         # NoSQL database for storing tasks and users
    "secretmanager.googleapis.com",     # Secure storage for API keys and OAuth clients
    "storage.googleapis.com",           # Storage bucket for function source code archives
    "run.googleapis.com",               # Base API for Cloud Functions gen2 (based on Cloud Run)
    "artifactregistry.googleapis.com",  # Container image registry for functions
    "servicecontrol.googleapis.com",    # Integration of API Gateway with quota and monitoring systems
    "servicemanagement.googleapis.com", # API configuration management (required for Gateway)
  ])
  service = each.key

  disable_on_destroy = false
}