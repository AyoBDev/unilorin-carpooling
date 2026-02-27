# ─────────────────────────────────────────────────────────
# WAF Module Outputs
# ─────────────────────────────────────────────────────────

output "web_acl_id" {
  description = "WAF v2 WebACL ID"
  value       = aws_wafv2_web_acl.main.id
}

output "web_acl_arn" {
  description = "WAF v2 WebACL ARN — use to associate with CloudFront (CLOUDFRONT scope) or API Gateway (REGIONAL scope)"
  value       = aws_wafv2_web_acl.main.arn
}

output "web_acl_name" {
  description = "WAF v2 WebACL name"
  value       = aws_wafv2_web_acl.main.name
}

output "blocked_ip_set_arn" {
  description = "ARN of the manual IP block list IP set"
  value       = aws_wafv2_ip_set.blocked.arn
}

output "waf_log_group_name" {
  description = "CloudWatch log group name for WAF logs (null if logging disabled)"
  value       = var.enable_logging ? aws_cloudwatch_log_group.waf[0].name : null
}
