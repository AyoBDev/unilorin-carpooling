# ─────────────────────────────────────────────────────────
# API Gateway Module Variables
# ─────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "lambda_invoke_arn" {
  description = "Invoke ARN of the API Lambda function"
  type        = string
}

variable "cors_origin" {
  description = "Allowed CORS origin"
  type        = string
  default     = "*"
}

variable "throttle_burst_limit" {
  description = "API Gateway burst throttle limit"
  type        = number
  default     = 2000
}

variable "throttle_rate_limit" {
  description = "API Gateway steady-state throttle limit (req/sec)"
  type        = number
  default     = 1000
}

variable "log_retention_days" {
  description = "CloudWatch log retention"
  type        = number
  default     = 30
}

variable "custom_domain_name" {
  description = "Custom domain name (e.g. api.carpool.unilorin.edu.ng)"
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = null
}
