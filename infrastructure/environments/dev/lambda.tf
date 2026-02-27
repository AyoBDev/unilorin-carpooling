# ─────────────────────────────────────────────────────────
# Lambda + API Gateway + SQS Wiring
# University of Ilorin Carpooling Platform
#
# Path: infrastructure/environments/dev/lambda.tf
#
# This file wires the compute, API, and messaging modules
# together. Copy to staging/ and production/ with appropriate
# variable overrides.
#
# This REPLACES serverless.yml — all Lambda deployment and
# event source configuration is managed by Terraform.
# ─────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════
#  SQS QUEUES (must be created before Lambda)
# ══════════════════════════════════════════════════════════

module "messaging" {
  source = "../../modules/messaging/sqs"

  name_prefix          = local.name_prefix
  enable_alarms        = var.environment != "dev"
  alarm_sns_topic_arns = []

  tags = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  API GATEWAY
# ══════════════════════════════════════════════════════════

module "api_gateway" {
  source = "../../modules/api/api-gateway"

  name_prefix        = local.name_prefix
  environment        = var.environment
  lambda_invoke_arn  = module.lambda.api_invoke_arn
  cors_origin        = var.cors_origin
  throttle_burst_limit = var.api_burst_limit
  throttle_rate_limit  = var.api_rate_limit
  log_retention_days   = var.log_retention_days

  # Custom domain (production only)
  custom_domain_name = var.custom_domain_name
  certificate_arn    = var.certificate_arn

  tags = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  LAMBDA FUNCTIONS
# ══════════════════════════════════════════════════════════

module "lambda" {
  source = "../../modules/compute/lambda"

  name_prefix = local.name_prefix
  environment = var.environment
  runtime     = "nodejs20.x"
  log_level   = var.log_level

  # ── Deployment artifact ────────────────────────────────
  # Built by: scripts/build-lambda.sh
  api_zip_path = var.lambda_zip_path

  # ── Optional Lambda Layer ──────────────────────────────
  create_layer   = var.create_lambda_layer
  layer_zip_path = var.lambda_layer_zip_path

  # ── API function sizing ────────────────────────────────
  api_memory_size          = var.lambda_memory_size
  api_timeout              = var.lambda_timeout
  api_reserved_concurrency = var.api_reserved_concurrency

  # ── VPC (enable when ElastiCache is deployed) ──────────
  enable_vpc             = var.enable_vpc
  vpc_subnet_ids         = var.enable_vpc ? module.networking[0].private_subnet_ids : []
  vpc_security_group_ids = var.enable_vpc ? [module.security[0].lambda_security_group_id] : []

  # ── Environment variables passed to ALL functions ──────
  environment_variables = {
    DYNAMODB_TABLE         = module.database.table_name
    REDIS_ENDPOINT         = var.enable_vpc ? module.cache[0].redis_endpoint : ""
    CACHE_ENABLED          = var.enable_vpc ? "true" : "false"
    JWT_SECRET             = var.jwt_secret
    JWT_EXPIRY             = "24h"
    REFRESH_TOKEN_EXPIRY   = "30d"
    SES_SENDER_EMAIL       = var.ses_sender_email
    CORS_ORIGINS           = var.cors_origin
    APP_URL                = var.app_url
    NOTIFICATION_QUEUE_URL = module.messaging.notification_queue_url
    MAPBOX_ACCESS_TOKEN    = var.mapbox_access_token
    BCRYPT_ROUNDS          = "8"
  }

  # ── External resource ARNs ─────────────────────────────
  dynamodb_table_arn     = module.database.table_arn
  dynamodb_stream_arn    = module.database.stream_arn
  notification_queue_arn = module.messaging.notification_queue_arn
  notification_queue_url = module.messaging.notification_queue_url
  notification_dlq_arn   = module.messaging.notification_dlq_arn
  stream_dlq_arn         = module.messaging.stream_dlq_arn
  s3_bucket_arn          = module.storage.bucket_arn
  ses_sender_email       = var.ses_sender_email

  # ── API Gateway ────────────────────────────────────────
  api_gateway_execution_arn = module.api_gateway.execution_arn

  # ── Feature flags ──────────────────────────────────────
  enable_schedules = var.enable_schedules
  enable_warmup    = var.environment != "dev"

  # ── Logging ────────────────────────────────────────────
  log_retention_days = var.log_retention_days

  tags = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  VARIABLES (add to your variables.tf)
# ══════════════════════════════════════════════════════════

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment ZIP"
  type        = string
  default     = "../../../backend/dist/lambda.zip"
}

variable "create_lambda_layer" {
  description = "Create a Lambda layer for node_modules"
  type        = bool
  default     = false
}

variable "lambda_layer_zip_path" {
  description = "Path to the Lambda layer ZIP"
  type        = string
  default     = null
}

variable "lambda_memory_size" {
  description = "Memory (MB) for API Lambda"
  type        = number
  default     = 1024
}

variable "lambda_timeout" {
  description = "Timeout (seconds) for API Lambda"
  type        = number
  default     = 30
}

variable "api_reserved_concurrency" {
  description = "Reserved concurrent executions (-1 = unreserved)"
  type        = number
  default     = -1
}

variable "enable_vpc" {
  description = "Deploy Lambda inside VPC (needed for ElastiCache)"
  type        = bool
  default     = false
}

variable "enable_schedules" {
  description = "Enable scheduled EventBridge rules"
  type        = bool
  default     = true
}

variable "cors_origin" {
  description = "Allowed CORS origin"
  type        = string
  default     = "http://localhost:3000"
}

variable "app_url" {
  description = "Frontend application URL"
  type        = string
  default     = "http://localhost:3000"
}

variable "api_burst_limit" {
  description = "API Gateway burst throttle limit"
  type        = number
  default     = 2000
}

variable "api_rate_limit" {
  description = "API Gateway steady-state rate limit (req/sec)"
  type        = number
  default     = 1000
}

variable "log_retention_days" {
  description = "CloudWatch log retention"
  type        = number
  default     = 30
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "debug"
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "ses_sender_email" {
  description = "Verified SES sender email"
  type        = string
  default     = "noreply@carpool.unilorin.edu.ng"
}

variable "mapbox_access_token" {
  description = "Mapbox API access token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "custom_domain_name" {
  description = "Custom API domain (production only)"
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "ACM certificate ARN for custom domain"
  type        = string
  default     = null
}

# ══════════════════════════════════════════════════════════
#  OUTPUTS
# ══════════════════════════════════════════════════════════

output "api_url" {
  description = "API Gateway invoke URL"
  value       = module.api_gateway.api_url
}

output "api_function_name" {
  description = "API Lambda function name"
  value       = module.lambda.api_function_name
}

output "notification_queue_url" {
  description = "SQS notification queue URL"
  value       = module.messaging.notification_queue_url
}

output "lambda_log_groups" {
  description = "CloudWatch log group names for all Lambda functions"
  value       = module.lambda.log_group_names
}

output "dashboard_name" {
  description = "CloudWatch operations dashboard name"
  value       = var.enable_monitoring ? module.monitoring[0].dashboard_name : null
}

output "alert_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  value       = var.enable_monitoring ? module.monitoring[0].alert_topic_arn : null
}

output "cdn_domain" {
  description = "CloudFront distribution domain name (null if CDN not enabled)"
  value       = var.enable_cdn ? module.cdn[0].domain_name : null
}

output "waf_web_acl_arn" {
  description = "WAF WebACL ARN (null if WAF not enabled)"
  value       = var.enable_waf ? module.waf[0].web_acl_arn : null
}
