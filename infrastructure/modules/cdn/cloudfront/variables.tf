# ─────────────────────────────────────────────────────────
# CloudFront CDN Module Variables
# ─────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

# ── Origin ───────────────────────────────────────────────

variable "api_gateway_url" {
  description = "API Gateway invoke URL (origin). Strip the stage prefix; only the hostname is used."
  type        = string
  # e.g. https://abc123.execute-api.eu-west-1.amazonaws.com/dev
}

variable "api_gateway_stage" {
  description = "API Gateway stage name (used as origin path prefix)"
  type        = string
  default     = "dev"
}

# ── HTTPS / Custom domain ─────────────────────────────────

variable "aliases" {
  description = "Custom domain aliases for the CloudFront distribution (e.g. api.carpool.unilorin.edu.ng)"
  type        = list(string)
  default     = []
}

variable "certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for HTTPS with custom aliases. Required when aliases is non-empty."
  type        = string
  default     = null
}

# ── Caching ───────────────────────────────────────────────

variable "default_ttl" {
  description = "Default cache TTL in seconds for cacheable responses"
  type        = number
  default     = 0  # API responses: pass-through by default; per-behaviour overrides apply
}

variable "max_ttl" {
  description = "Maximum cache TTL in seconds"
  type        = number
  default     = 31536000  # 1 year (for immutable assets if ever served)
}

variable "min_ttl" {
  description = "Minimum cache TTL in seconds"
  type        = number
  default     = 0
}

# ── Geo-restriction ───────────────────────────────────────

variable "geo_restriction_type" {
  description = "Geo-restriction type: 'none', 'whitelist', or 'blacklist'"
  type        = string
  default     = "none"

  validation {
    condition     = contains(["none", "whitelist", "blacklist"], var.geo_restriction_type)
    error_message = "geo_restriction_type must be 'none', 'whitelist', or 'blacklist'."
  }
}

variable "geo_restriction_locations" {
  description = "ISO 3166-1-alpha-2 country codes for geo-restriction"
  type        = list(string)
  default     = []
}

# ── WAF ───────────────────────────────────────────────────

variable "waf_acl_arn" {
  description = "ARN of the WAF v2 WebACL to associate (must be CLOUDFRONT scope, in us-east-1)"
  type        = string
  default     = null
}

# ── Logging ───────────────────────────────────────────────

variable "enable_access_logs" {
  description = "Enable CloudFront access logs to an S3 bucket"
  type        = bool
  default     = false
}

variable "log_bucket_domain" {
  description = "S3 bucket domain name for CloudFront access logs (e.g. my-bucket.s3.amazonaws.com)"
  type        = string
  default     = null
}

variable "log_prefix" {
  description = "S3 key prefix for CloudFront access logs"
  type        = string
  default     = "cloudfront/"
}

# ── Price Class ───────────────────────────────────────────

variable "price_class" {
  description = "CloudFront price class (PriceClass_All | PriceClass_200 | PriceClass_100)"
  type        = string
  default     = "PriceClass_100"  # Only US/EU/Canada — cheapest, fine for Nigeria via EU edge
}

# ── Tags ─────────────────────────────────────────────────

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
