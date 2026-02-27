# ─────────────────────────────────────────────────────────
# WAF v2 Module
# PSRide — University of Ilorin Carpooling Platform
#
# Path: modules/security/waf/main.tf
#
# Creates a WAFv2 WebACL with:
#   1. IP block list          — manual block list of known bad actors
#   2. AWS IP Reputation List — optional; bots, scanners, threat intel
#   3. AWS Anonymous IP List  — optional; Tor exit nodes, VPN endpoints
#   4. Auth rate limit        — 100 req/5min/IP on /auth/* endpoints
#   5. Global rate limit      — 2000 req/5min/IP (all traffic)
#   6. Common Rule Set (CRS)  — OWASP top 10 managed rules
#   7. Known Bad Inputs       — SQLi, XSS, Log4Shell payloads
#   + WAF logging → CloudWatch Logs
#   + CloudWatch alarm on block rate spike
# ─────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════
#  IP SET — MANUAL BLOCK LIST
# ══════════════════════════════════════════════════════════

resource "aws_wafv2_ip_set" "blocked" {
  name               = "${var.name_prefix}-blocked-ips"
  description        = "Manually blocked IP ranges"
  scope              = var.scope
  ip_address_version = "IPV4"
  addresses          = var.blocked_ip_ranges
  tags               = var.tags
}

# ══════════════════════════════════════════════════════════
#  WEB ACL
# ══════════════════════════════════════════════════════════

resource "aws_wafv2_web_acl" "main" {
  name        = "${var.name_prefix}-waf"
  description = "PSRide WAF — ${var.environment}"
  scope       = var.scope

  # Default action: allow traffic that passes all rules
  default_action {
    allow {}
  }

  # ── Rule 1: Block listed IPs ─────────────────────────
  rule {
    name     = "BlockListedIPs"
    priority = 1

    action {
      block {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blocked.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-blocked-ips"
      sampled_requests_enabled   = true
    }
  }

  # ── Rule 2: AWS IP Reputation List ───────────────────
  dynamic "rule" {
    for_each = var.enable_amazon_ip_reputation ? [1] : []
    content {
      name     = "AWSManagedRulesAmazonIpReputationList"
      priority = 2

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesAmazonIpReputationList"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name_prefix}-aws-ip-reputation"
        sampled_requests_enabled   = true
      }
    }
  }

  # ── Rule 3: Anonymous IP List ────────────────────────
  dynamic "rule" {
    for_each = var.enable_anonymous_ip_list ? [1] : []
    content {
      name     = "AWSManagedRulesAnonymousIpList"
      priority = 3

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesAnonymousIpList"
          vendor_name = "AWS"

          # Don't block — many students may route through VPN; only count
          rule_action_override {
            name = "AnonymousIPList"
            action_to_use {
              count {}
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name_prefix}-anonymous-ip"
        sampled_requests_enabled   = true
      }
    }
  }

  # ── Rule 4: Rate limit — auth endpoints ──────────────
  rule {
    name     = "AuthRateLimit"
    priority = 10

    action {
      block {
        custom_response {
          response_code = 429
          custom_response_body_key = "rate_limit_response"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.auth_rate_limit
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            field_to_match {
              uri_path {}
            }
            positional_constraint = "CONTAINS"
            search_string         = "/api/v1/auth/"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-auth-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # ── Rule 5: Global rate limit ─────────────────────────
  rule {
    name     = "GlobalRateLimit"
    priority = 11

    action {
      block {
        custom_response {
          response_code            = 429
          custom_response_body_key = "rate_limit_response"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-global-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  # ── Rule 6: Common Rule Set (OWASP) ──────────────────
  dynamic "rule" {
    for_each = var.enable_common_ruleset ? [1] : []
    content {
      name     = "AWSManagedRulesCommonRuleSet"
      priority = 20

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesCommonRuleSet"
          vendor_name = "AWS"

          # SizeRestrictions_BODY fires on large API payloads (multipart, etc.)
          # Override to COUNT so we don't accidentally block ride creation with
          # large passenger lists
          rule_action_override {
            name = "SizeRestrictions_BODY"
            action_to_use {
              count {}
            }
          }

          # GenericLFI can fire on legitimate route paths like /api/v1/rides/../
          rule_action_override {
            name = "GenericLFI_BODY"
            action_to_use {
              count {}
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name_prefix}-crs"
        sampled_requests_enabled   = true
      }
    }
  }

  # ── Rule 7: Known Bad Inputs ─────────────────────────
  dynamic "rule" {
    for_each = var.enable_known_bad_inputs ? [1] : []
    content {
      name     = "AWSManagedRulesKnownBadInputsRuleSet"
      priority = 21

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesKnownBadInputsRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.name_prefix}-known-bad-inputs"
        sampled_requests_enabled   = true
      }
    }
  }

  # ── Custom 429 response body ──────────────────────────
  custom_response_body {
    key          = "rate_limit_response"
    content_type = "APPLICATION_JSON"
    content = jsonencode({
      success = false
      message = "Too many requests. Please slow down and try again later."
      code    = "RATE_LIMIT_EXCEEDED"
    })
  }

  # ── Top-level visibility ──────────────────────────────
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

# ══════════════════════════════════════════════════════════
#  WAF ASSOCIATION (REGIONAL scope only)
# ══════════════════════════════════════════════════════════

resource "aws_wafv2_web_acl_association" "api_gateway" {
  count        = var.scope == "REGIONAL" && var.api_gateway_arn != null ? 1 : 0
  resource_arn = var.api_gateway_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# ══════════════════════════════════════════════════════════
#  WAF LOGGING → CLOUDWATCH LOGS
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_log_group" "waf" {
  count = var.enable_logging ? 1 : 0

  # WAF log group names MUST start with "aws-waf-logs-"
  name              = "aws-waf-logs-${var.name_prefix}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count = var.enable_logging ? 1 : 0

  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]
  resource_arn            = aws_wafv2_web_acl.main.arn

  # Redact sensitive headers from logs
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }

  # Only log blocked requests to reduce volume
  logging_filter {
    default_behavior = "DROP"

    filter {
      behavior = "KEEP"
      condition {
        action_condition {
          action = "BLOCK"
        }
      }
      requirement = "MEETS_ANY"
    }

    filter {
      behavior = "KEEP"
      condition {
        action_condition {
          action = "COUNT"
        }
      }
      requirement = "MEETS_ANY"
    }
  }
}

# ══════════════════════════════════════════════════════════
#  CLOUDWATCH ALARM — HIGH BLOCK RATE
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_metric_alarm" "waf_block_rate" {
  count = var.enable_alarms && var.alarm_sns_topic_arn != null ? 1 : 0

  alarm_name          = "${var.name_prefix}-waf-high-block-rate"
  alarm_description   = "WAF is blocking an unusually high number of requests — possible attack"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = var.block_rate_threshold
  treat_missing_data  = "notBreaching"

  metric_name = "BlockedRequests"
  namespace   = "AWS/WAFV2"
  period      = 300
  statistic   = "Sum"
  dimensions = {
    Rule   = "ALL"
    WebACL = aws_wafv2_web_acl.main.name
    Region = "eu-west-1"
  }

  alarm_actions = [var.alarm_sns_topic_arn]
  tags          = var.tags
}
