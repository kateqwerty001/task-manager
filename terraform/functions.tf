# Define the map of functions to be deployed with their source paths and entry points
locals {
  crud_functions = {
    list_tasks = {
      entry_point = "list_tasks"
      source_dir  = "${path.module}/../backend/list_tasks"
    }
    get_task = {
      entry_point = "get_task"
      source_dir  = "${path.module}/../backend/get_task"
    }
    create_task = {
      entry_point = "create_task"
      source_dir  = "${path.module}/../backend/create_task"
    }
    update_task = {
      entry_point = "update_task"
      source_dir  = "${path.module}/../backend/update_task"
    }
    delete_task = {
      entry_point = "delete_task"
      source_dir  = "${path.module}/../backend/delete_task"
    }
    voice_parse = {
      entry_point = "voice_parse"
      source_dir  = "${path.module}/../backend/voice_parse"
    }
    admin_analytics = {
      entry_point = "admin_analytics"
      source_dir  = "${path.module}/../backend/admin_analytics"
    }
  }
}

# Zip each function directory into a build artifact
resource "archive_file" "function_zip" {
  for_each = local.crud_functions

  type        = "zip"
  source_dir  = each.value.source_dir
  output_path = "${path.module}/.build/${each.key}.zip"
}

# Upload zips to GCS with MD5 hashing to ensure deployment only on code changes
resource "google_storage_bucket_object" "function_zip" {
  for_each = local.crud_functions

  name   = "functions/${each.key}-${archive_file.function_zip[each.key].output_md5}.zip"
  bucket = google_storage_bucket.functions_bucket.name
  source = archive_file.function_zip[each.key].output_path

  depends_on = [google_storage_bucket.functions_bucket]
}

# Deploy the Cloud Functions using the uploaded source artifacts
resource "google_cloudfunctions2_function" "crud" {
  for_each = local.crud_functions

  name        = each.key
  location    = var.region
  description = "Task Manager API: ${each.key}"

  build_config {
    runtime     = "python312"
    entry_point = each.value.entry_point
    source {
      storage_source {
        bucket = google_storage_bucket.functions_bucket.name
        object = google_storage_bucket_object.function_zip[each.key].name
      }
    }
  }

  service_config {
    max_instance_count    = 10
    min_instance_count    = 0
    available_memory      = "256Mi"
    timeout_seconds       = 60
    ingress_settings      = "ALLOW_ALL"
    service_account_email = google_service_account.functions_sa.email

    environment_variables = {
      GCP_PROJECT = var.project_id
    }

    secret_environment_variables {
      key        = "GOOGLE_CLIENT_ID"
      project_id = var.project_id
      secret     = google_secret_manager_secret.oauth_id.secret_id
      version    = "latest"
    }

    dynamic "secret_environment_variables" {
      for_each = each.key == "voice_parse" ? [1] : []
      content {
        key        = "LLM_API_KEY"
        project_id = var.project_id
        secret     = google_secret_manager_secret.llm_key.secret_id
        version    = "latest"
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_firestore_database.database,
    google_secret_manager_secret.oauth_id,
    google_project_iam_member.firestore_access,
    google_project_iam_member.secret_access,
    google_project_iam_member.cloudbuild_storage,
    google_project_iam_member.cloudbuild_artifact_registry,
    google_project_iam_member.cloudbuild_logging,
    google_project_iam_member.cloudbuild_run_developer,
    google_project_iam_member.compute_cloudbuild_builder,
    google_project_iam_member.compute_logging,
    google_project_iam_member.compute_artifact_registry,
    google_project_iam_member.compute_run_developer,
    google_storage_bucket_iam_member.functions_bucket_compute,
    google_service_account_iam_member.cloudbuild_uses_functions_sa,
    google_service_account_iam_member.compute_uses_functions_sa,
  ]
}

# Grant API Gateway permission to trigger these Cloud Functions
resource "google_cloudfunctions2_function_iam_member" "gateway_invoker" {
  for_each = local.crud_functions

  project        = var.project_id
  location       = var.region
  cloud_function = google_cloudfunctions2_function.crud[each.key].name
  role           = "roles/cloudfunctions.invoker"
  member         = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-apigateway.iam.gserviceaccount.com"
}
