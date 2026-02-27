# ─────────────────────────────────────────────────────────
# CloudFront CDN Module Outputs
# ─────────────────────────────────────────────────────────

output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.api.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN (use for WAF CLOUDFRONT-scope WebACL association)"
  value       = aws_cloudfront_distribution.api.arn
}

output "domain_name" {
  description = "CloudFront distribution domain name (e.g. d111111abcdef8.cloudfront.net)"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "hosted_zone_id" {
  description = "Hosted zone ID for Route 53 ALIAS records pointing to this distribution"
  value       = aws_cloudfront_distribution.api.hosted_zone_id
}

output "api_no_cache_policy_id" {
  description = "ID of the no-cache policy created for API endpoints"
  value       = aws_cloudfront_cache_policy.api_no_cache.id
}
