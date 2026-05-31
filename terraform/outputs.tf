# The primary public URL for your API. Used in frontend config.
output "api_gateway_url" {
  value       = "https://${google_api_gateway_gateway.task_manager.default_hostname}"
}

# Useful for debugging or setting up custom domains later
output "api_gateway_hostname" {
  value       = google_api_gateway_gateway.task_manager.default_hostname
}

# A map of all function names to their direct trigger URLs
output "function_uris" {
  description = "Direct Cloud Functions URIs for debugging purposes."
  value = { for k, v in google_cloudfunctions2_function.crud : k => v.url }
}

# The service account email used by all functions for IAM auditing
output "functions_service_account" {
  description = "Service account used by Cloud Functions."
  value       = google_service_account.functions_sa.email
}

