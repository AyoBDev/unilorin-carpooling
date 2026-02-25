# ─────────────────────────────────────────────────────────
# Lambda Module Variables
# ─────────────────────────────────────────────────────────

# ── Naming ───────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix for all resource names (e.g. carpool-dev)"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

# ── Runtime ──────────────────────────────────────────────

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# ── Deployment Artifacts ─────────────────────────────────

variable "api_zip_path" {
  description = "Path to the Lambda deployment ZIP (built by scripts/build-lambda.sh)"
  type        = string
}

variable "create_layer" {
  description = "Whether to create a Lambda layer for dependencies"
  type        = bool
  default     = false
}

variable "layer_zip_path" {
  description = "Path to the Lambda layer ZIP"
  type        = string
  default     = null
}

# ── API Function Config ──────────────────────────────────

variable "api_memory_size" {
  description = "Memory (MB) for the API handler"
  type        = number
  default     = 1024
}

variable "api_timeout" {
  description = "Timeout (seconds) for the API handler"
  type        = number
  default     = 30
}

variable "api_reserved_concurrency" {
  description = "Reserved concurrent executions for the API handler (-1 = unreserved)"
  type        = number
  default     = -1
}

# ── VPC Configuration ────────────────────────────────────

variable "enable_vpc" {
  description = "Whether to deploy Lambda inside VPC (required for ElastiCache)"
  type        = bool
  default     = false
}

variable "vpc_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC config"
  type        = list(string)
  default     = []
}

variable "vpc_security_group_ids" {
  description = "Security group IDs for Lambda VPC config"
  type        = list(string)
  default     = []
}

# ── Environment Variables ────────────────────────────────

variable "environment_variables" {
  description = "Environment variables passed to all Lambda functions"
  type        = map(string)
  default     = {}
}

# ── External Resource ARNs ───────────────────────────────

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB main table"
  type        = string
}

variable "dynamodb_stream_arn" {
  description = "ARN of the DynamoDB table stream"
  type        = string
}

variable "notification_queue_arn" {
  description = "ARN of the SQS notification queue"
  type        = string
}

variable "notification_queue_url" {
  description = "URL of the SQS notification queue"
  type        = string
}

variable "notification_dlq_arn" {
  description = "ARN of the SQS notification dead letter queue"
  type        = string
}

variable "stream_dlq_arn" {
  description = "ARN of the SQS stream failures dead letter queue"
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 uploads bucket"
  type        = string
  default     = "arn:aws:s3:::placeholder"
}

variable "ses_sender_email" {
  description = "Verified SES sender email address"
  type        = string
  default     = "noreply@carpool.unilorin.edu.ng"
}

# ── API Gateway ──────────────────────────────────────────

variable "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway (for Lambda permissions)"
  type        = string
}

# ── Feature Flags ────────────────────────────────────────

variable "enable_schedules" {
  description = "Enable scheduled EventBridge rules"
  type        = bool
  default     = true
}

variable "enable_warmup" {
  description = "Enable warm-up pings (staging/production)"
  type        = bool
  default     = false
}
