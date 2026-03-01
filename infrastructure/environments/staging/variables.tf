# ─────────────────────────────────────────────────────────
# Variables
# Path: infrastructure/environments/staging/variables.tf
# ─────────────────────────────────────────────────────────

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "dynamodb_enable_pitr" {
  description = "Enable DynamoDB point-in-time recovery"
  type        = bool
  default     = false
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway"
  type        = bool
  default     = false
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway"
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# ── WAF ───────────────────────────────────────────────────

variable "enable_waf" {
  description = "Deploy WAF v2 WebACL in front of API Gateway"
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  description = "Global WAF rate limit per IP per 5 minutes"
  type        = number
  default     = 2000
}

variable "waf_auth_rate_limit" {
  description = "Auth endpoint WAF rate limit per IP per 5 minutes"
  type        = number
  default     = 100
}

variable "waf_blocked_ips" {
  description = "CIDR ranges to permanently block at WAF"
  type        = list(string)
  default     = []
}

# ── Monitoring ────────────────────────────────────────────

variable "enable_monitoring" {
  description = "Deploy CloudWatch dashboard and alarms"
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = ""
}

variable "lambda_error_threshold" {
  description = "Lambda error rate (%) that triggers an alarm"
  type        = number
  default     = 5
}

variable "api_latency_threshold" {
  description = "API Gateway P99 latency (ms) that triggers an alarm"
  type        = number
  default     = 3000
}

# ── CDN ───────────────────────────────────────────────────

variable "enable_cdn" {
  description = "Deploy CloudFront in front of API Gateway"
  type        = bool
  default     = false
}

variable "cdn_aliases" {
  description = "Custom domain aliases for CloudFront (e.g. api.carpool.unilorin.edu.ng)"
  type        = list(string)
  default     = []
}

variable "cdn_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for CloudFront custom domains"
  type        = string
  default     = null
}

variable "cdn_waf_acl_arn" {
  description = "ARN of a CLOUDFRONT-scope WAF WebACL to attach to the CDN distribution"
  type        = string
  default     = null
}
