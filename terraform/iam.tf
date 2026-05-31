# Creates the dedicated service account that will execute the function logic
resource "google_service_account" "functions_sa" {
  account_id   = "task-manager-sa"
  display_name = "Task Manager Backend Service Account"
}

# Grants the functions service account permission to read/write data in Firestore
resource "google_project_iam_member" "firestore_access" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

# Grants the functions service account permission to retrieve API keys from Secret Manager
resource "google_project_iam_member" "secret_access" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.functions_sa.email}"
}

# Grants Cloud Build broad storage admin access to manage deployment artifacts
resource "google_project_iam_member" "cloudbuild_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# Grants Cloud Build permission to push container images to the Artifact Registry
resource "google_project_iam_member" "cloudbuild_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# Grants Cloud Build explicit access to the specific bucket containing function source code
resource "google_storage_bucket_iam_member" "functions_bucket_cloudbuild" {
  bucket = google_storage_bucket.functions_bucket.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
}

# Defines emails for the automated build and compute service accounts
locals {
  cloudbuild_sa_email = "${data.google_project.project.number}@cloudbuild.gserviceaccount.com"
  compute_sa_email    = "${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}

# Allows Cloud Build to write build logs to Google Cloud Logging
resource "google_project_iam_member" "cloudbuild_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${local.cloudbuild_sa_email}"
}

# Grants Cloud Build permission to deploy and manage Cloud Run services
resource "google_project_iam_member" "cloudbuild_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${local.cloudbuild_sa_email}"
}

# Authorizes the default Compute service account to act as a Cloud Build builder
resource "google_project_iam_member" "compute_cloudbuild_builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${local.compute_sa_email}"
}

# Allows the default Compute service account to write execution logs
resource "google_project_iam_member" "compute_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${local.compute_sa_email}"
}

# Grants the default Compute service account permission to push to Artifact Registry
resource "google_project_iam_member" "compute_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${local.compute_sa_email}"
}

# Grants the default Compute service account permission to run Cloud Run services
resource "google_project_iam_member" "compute_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${local.compute_sa_email}"
}

# Gives the default Compute service account read access to function source code buckets
resource "google_storage_bucket_iam_member" "functions_bucket_compute" {
  bucket = google_storage_bucket.functions_bucket.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${local.compute_sa_email}"
}

# Allows Cloud Build to impersonate the functions service account during deployment
resource "google_service_account_iam_member" "cloudbuild_uses_functions_sa" {
  service_account_id = google_service_account.functions_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.cloudbuild_sa_email}"
}

# Allows the default Compute service account to impersonate the functions service account
resource "google_service_account_iam_member" "compute_uses_functions_sa" {
  service_account_id = google_service_account.functions_sa.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${local.compute_sa_email}"
}