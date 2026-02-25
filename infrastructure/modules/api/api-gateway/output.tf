# ─────────────────────────────────────────────────────────
# API Gateway Module Outputs
# ─────────────────────────────────────────────────────────

output "api_id" {
  description = "REST API ID"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_arn" {
  description = "REST API ARN (for WAF association)"
  value       = aws_api_gateway_stage.main.arn
}

output "api_url" {
  description = "Invoke URL for the API"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "execution_arn" {
  description = "Execution ARN (for Lambda permissions)"
  value       = aws_api_gateway_rest_api.main.execution_arn
}

output "stage_name" {
  description = "API Gateway stage name"
  value       = aws_api_gateway_stage.main.stage_name
}

output "custom_domain_target" {
  description = "Regional domain name for DNS CNAME/ALIAS"
  value       = var.custom_domain_name != null ? aws_api_gateway_domain_name.main[0].regional_domain_name : null
}

output "custom_domain_zone_id" {
  description = "Route53 zone ID for the custom domain"
  value       = var.custom_domain_name != null ? aws_api_gateway_domain_name.main[0].regional_zone_id : null
}
