resource "google_storage_bucket" "functions_bucket" {
  name                        = "${var.project_id}-functions-source"
  location                    = var.region
  storage_class               = "REGIONAL"
  uniform_bucket_level_access = true
}