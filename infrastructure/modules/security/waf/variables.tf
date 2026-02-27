# ─────────────────────────────────────────────────────────
# WAF Module Variables
# ─────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

# ── Scope ─────────────────────────────────────────────────

variable "scope" {
  description = "WAF scope: REGIONAL (API Gateway/ALB) or CLOUDFRONT"
  type        = string
  default     = "REGIONAL"

  validation {
    condition     = contains(["REGIONAL", "CLOUDFRONT"], var.scope)
    error_message = "scope must be 'REGIONAL' or 'CLOUDFRONT'."
  }
}

# ── Association ───────────────────────────────────────────

variable "api_gateway_arn" {
  description = "ARN of the API Gateway stage to protect (REGIONAL scope). Format: arn:aws:apigateway:REGION::/restapis/ID/stages/STAGE"
  type        = string
  default     = null
}

# ── Rate limiting ─────────────────────────────────────────

variable "rate_limit" {
  description = "Maximum requests per 5-minute window per IP before the rule blocks the IP"
  type        = number
  default     = 2000
}

variable "auth_rate_limit" {
  description = "Stricter rate limit for auth endpoints (login/register) per 5 minutes per IP"
  type        = number
  default     = 100
}

# ── IP block list ─────────────────────────────────────────

variable "blocked_ip_ranges" {
  description = "List of CIDR ranges to permanently block (IPv4 or IPv6)"
  type        = list(string)
  default     = []
}

# ── Managed rule groups ───────────────────────────────────

variable "enable_common_ruleset" {
  description = "Enable AWS-Managed Rules Common Rule Set (OWASP top 10)"
  type        = bool
  default     = true
}

variable "enable_known_bad_inputs" {
  description = "Enable AWS-Managed Known Bad Inputs rule set (SQLi, XSS payloads, Log4Shell)"
  type        = bool
  default     = true
}

variable "enable_amazon_ip_reputation" {
  description = "Enable AWS IP Reputation List (bots, scanners, threat intel)"
  type        = bool
  default     = true
}

variable "enable_anonymous_ip_list" {
  description = "Enable AWS Anonymous IP List (Tor exit nodes, VPN exit nodes)"
  type        = bool
  default     = false
}

# ── Logging ───────────────────────────────────────────────

variable "enable_logging" {
  description = "Send WAF full-request logs to CloudWatch Logs"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "WAF log retention period in days"
  type        = number
  default     = 30
}

# ── Metrics / alarms ─────────────────────────────────────

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for WAF block rate alarms"
  type        = string
  default     = null
}

variable "enable_alarms" {
  description = "Enable CloudWatch alarms for high WAF block rates"
  type        = bool
  default     = true
}

variable "block_rate_threshold" {
  description = "WAF blocked requests per 5 minutes that triggers an alarm"
  type        = number
  default     = 100
}

# ── Tags ─────────────────────────────────────────────────

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
