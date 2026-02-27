# ─────────────────────────────────────────────────────────
# Monitoring Module Variables
# ─────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "environment" {
  description = "Environment name (dev / staging / production)"
  type        = string
}

# ── Lambda ───────────────────────────────────────────────

variable "api_function_name" {
  description = "Name of the main API Lambda function"
  type        = string
}

variable "lambda_log_groups" {
  description = "Map of Lambda CloudWatch log group names (from lambda module output)"
  type        = map(string)
  default     = {}
}

# ── API Gateway ──────────────────────────────────────────

variable "api_gateway_name" {
  description = "Name of the REST API (for API Gateway metrics dimension)"
  type        = string
}

variable "api_gateway_stage" {
  description = "API Gateway stage name"
  type        = string
  default     = "dev"
}

# ── DynamoDB ─────────────────────────────────────────────

variable "dynamodb_table_name" {
  description = "DynamoDB table name"
  type        = string
}

# ── SQS ─────────────────────────────────────────────────

variable "notification_queue_name" {
  description = "SQS notification queue name"
  type        = string
}

variable "notification_dlq_name" {
  description = "SQS notification DLQ name"
  type        = string
}

# ── Alarm thresholds ─────────────────────────────────────

variable "lambda_error_rate_threshold" {
  description = "Lambda error rate (%) that triggers an alarm"
  type        = number
  default     = 5
}

variable "lambda_p99_duration_threshold" {
  description = "Lambda P99 duration (ms) that triggers an alarm"
  type        = number
  default     = 10000
}

variable "api_latency_threshold_ms" {
  description = "API Gateway integration latency (ms) threshold"
  type        = number
  default     = 3000
}

variable "api_error_rate_threshold" {
  description = "API Gateway 5xx error rate (%) threshold"
  type        = number
  default     = 5
}

variable "dlq_depth_threshold" {
  description = "SQS DLQ message count that triggers an alarm"
  type        = number
  default     = 1
}

variable "dynamodb_throttle_threshold" {
  description = "DynamoDB throttled requests count threshold"
  type        = number
  default     = 10
}

# ── Notifications ─────────────────────────────────────────

variable "alarm_email" {
  description = "Email address to receive CloudWatch alarm notifications"
  type        = string
  default     = ""
}

variable "enable_alarms" {
  description = "Enable CloudWatch alarms (disable for dev to avoid noise)"
  type        = bool
  default     = true
}

# ── Tags ─────────────────────────────────────────────────

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
