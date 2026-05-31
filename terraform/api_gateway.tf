# API Gateway resources are only available in the google-beta provider (HashiCorp).
# Cloud Functions, Firestore, IAM, etc. use the standard google provider.
resource "google_api_gateway_api" "task_manager" {
  provider = google-beta
  api_id   = "task-manager-api"
  project  = var.project_id

  depends_on = [google_project_service.apis] 
}

resource "random_id" "api_config_suffix" {
  byte_length = 4
}

resource "google_api_gateway_api_config" "task_manager" {
  provider      = google-beta
  api           = google_api_gateway_api.task_manager.api_id
  api_config_id = "task-manager-config-${random_id.api_config_suffix.hex}"
  project       = var.project_id

  openapi_documents {
    document {
      path = "openapi.yaml"
      contents = base64encode(templatefile("${path.module}/openapi.yaml.tpl", {
          list_tasks_uri       = google_cloudfunctions2_function.crud["list_tasks"].url
          get_task_uri         = google_cloudfunctions2_function.crud["get_task"].url
          create_task_uri      = google_cloudfunctions2_function.crud["create_task"].url
          update_task_uri      = google_cloudfunctions2_function.crud["update_task"].url
          delete_task_uri      = google_cloudfunctions2_function.crud["delete_task"].url
          voice_parse_uri      = google_cloudfunctions2_function.crud["voice_parse"].url
          admin_analytics_uri  = google_cloudfunctions2_function.crud["admin_analytics"].url
      }))
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_cloudfunctions2_function.crud,
    google_cloudfunctions2_function_iam_member.gateway_invoker,
  ]
}

resource "google_api_gateway_gateway" "task_manager" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.task_manager.id
  gateway_id = "task-manager-gateway"
  project    = var.project_id
  region     = var.api_gateway_region

  depends_on = [google_api_gateway_api_config.task_manager]
}