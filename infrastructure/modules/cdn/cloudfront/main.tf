# ─────────────────────────────────────────────────────────
# CloudFront CDN Module
# PSRide — University of Ilorin Carpooling Platform
#
# Path: modules/cdn/cloudfront/main.tf
#
# Puts CloudFront in front of API Gateway:
#   - HTTPS-only (HTTP → HTTPS redirect)
#   - API paths (/api/*): no caching, full pass-through
#   - Auth paths (/api/v1/auth/*): no caching, no cookies forwarded
#   - Default: forward all headers/cookies to origin
#   - Optional geo-restriction
#   - Optional WAF WebACL association
#   - Optional access logging
# ─────────────────────────────────────────────────────────

locals {
  # Extract just the hostname from the full API Gateway URL
  # "https://abc123.execute-api.eu-west-1.amazonaws.com/dev" → "abc123.execute-api.eu-west-1.amazonaws.com"
  api_origin_domain = replace(
    replace(var.api_gateway_url, "https://", ""),
    "/${var.api_gateway_stage}",
    ""
  )

  origin_id = "${var.name_prefix}-api-gateway"
}

# ══════════════════════════════════════════════════════════
#  CACHE POLICIES
# ══════════════════════════════════════════════════════════

# API policy: forward all headers & query strings; do NOT cache (TTL=0)
resource "aws_cloudfront_cache_policy" "api_no_cache" {
  name    = "${var.name_prefix}-api-no-cache"
  comment = "Pass-through policy for dynamic API endpoints — no caching"

  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = false
    enable_accept_encoding_gzip   = false
  }
}

# ══════════════════════════════════════════════════════════
#  ORIGIN REQUEST POLICIES
# ══════════════════════════════════════════════════════════

# Forward all headers, cookies and query strings to origin
resource "aws_cloudfront_origin_request_policy" "forward_all" {
  name    = "${var.name_prefix}-forward-all"
  comment = "Forward all request headers, cookies, and query strings to API Gateway"

  cookies_config {
    cookie_behavior = "all"
  }

  headers_config {
    header_behavior = "allViewer"
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# Auth endpoints: forward headers only (no cookies needed for JWT-based auth)
resource "aws_cloudfront_origin_request_policy" "forward_headers_only" {
  name    = "${var.name_prefix}-forward-headers"
  comment = "Forward all headers only (for auth endpoints)"

  cookies_config {
    cookie_behavior = "none"
  }

  headers_config {
    header_behavior = "allViewer"
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}

# ══════════════════════════════════════════════════════════
#  RESPONSE HEADERS POLICY
# ══════════════════════════════════════════════════════════

resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${var.name_prefix}-security-headers"
  comment = "Adds security headers to all API responses"

  security_headers_config {
    strict_transport_security {
      override                   = true
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = false
    }

    content_type_options {
      override = true
    }

    frame_options {
      override     = true
      frame_option = "DENY"
    }

    xss_protection {
      override   = true
      protection = true
      mode_block = true
    }

    referrer_policy {
      override        = true
      referrer_policy = "strict-origin-when-cross-origin"
    }
  }

  custom_headers_config {
    items {
      header   = "X-Powered-By"
      value    = "PSRide"
      override = true
    }
  }
}

# ══════════════════════════════════════════════════════════
#  CLOUDFRONT DISTRIBUTION
# ══════════════════════════════════════════════════════════

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.name_prefix} API CDN — ${var.environment}"
  price_class     = var.price_class
  http_version    = "http2and3"

  aliases      = var.aliases
  web_acl_id   = var.waf_acl_arn

  # ── Origin: API Gateway ──────────────────────────────
  origin {
    origin_id   = local.origin_id
    domain_name = local.api_origin_domain

    # Prepend the stage to all origin requests
    origin_path = "/${var.api_gateway_stage}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]

      # Tune keep-alive so Lambda cold starts don't time out CloudFront
      origin_keepalive_timeout = 60
      origin_read_timeout      = 60
    }

    custom_header {
      name  = "X-Forwarded-Stage"
      value = var.api_gateway_stage
    }
  }

  # ── Default behaviour: all /api/* traffic → no cache ─
  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    cache_policy_id            = aws_cloudfront_cache_policy.api_no_cache.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.forward_all.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # ── Auth paths: no cookies forwarded ─────────────────
  ordered_cache_behavior {
    path_pattern           = "/api/v1/auth/*"
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = aws_cloudfront_cache_policy.api_no_cache.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.forward_headers_only.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # ── Health-check path: allow caching for 10s ─────────
  ordered_cache_behavior {
    path_pattern           = "/health"
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Use CloudFront managed CachingOptimized policy
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"  # Managed-CachingOptimized
  }

  # ── Custom error responses ────────────────────────────
  # Pass API errors through without caching

  custom_error_response {
    error_code            = 400
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 401
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 429
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 500
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 502
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 503
    error_caching_min_ttl = 0
  }

  # ── Geo-restriction ───────────────────────────────────
  restrictions {
    geo_restriction {
      restriction_type = var.geo_restriction_type
      locations        = var.geo_restriction_locations
    }
  }

  # ── TLS / viewer certificate ──────────────────────────
  viewer_certificate {
    cloudfront_default_certificate = length(var.aliases) == 0
    acm_certificate_arn            = length(var.aliases) > 0 ? var.certificate_arn : null
    ssl_support_method             = length(var.aliases) > 0 ? "sni-only" : null
    minimum_protocol_version       = length(var.aliases) > 0 ? "TLSv1.2_2021" : null
  }

  # ── Access logging ────────────────────────────────────
  dynamic "logging_config" {
    for_each = var.enable_access_logs && var.log_bucket_domain != null ? [1] : []
    content {
      bucket          = var.log_bucket_domain
      prefix          = var.log_prefix
      include_cookies = false
    }
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-cdn" })
}
