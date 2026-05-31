variable "project_id" {
  description = "The ID of the GCP project"
  default     = "project-f030ec6e-8d7b-4d6a-9e3"
}

variable "region" {
  description = "The main region to deploy resources into (Warsaw, Poland)"
  default     = "europe-central2"
}

variable "api_gateway_region" {
  description = "Region for API Gateway (must be a supported gateway region - europe-central2 is not supported)"
  default     = "europe-west1"
}

variable "enable_llm_api_key" {
  description = "Mount LLM_API_KEY into voice_parse from Secret Manager. Requires a secret version in llm-api-key."
  type        = bool
  default     = false
}