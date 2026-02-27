# ─────────────────────────────────────────────────────────
# Monitoring Module Outputs
# ─────────────────────────────────────────────────────────

output "alert_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  value       = aws_sns_topic.alerts.arn
}

output "alert_topic_name" {
  description = "SNS topic name"
  value       = aws_sns_topic.alerts.name
}

output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_arn" {
  description = "CloudWatch dashboard ARN"
  value       = aws_cloudwatch_dashboard.main.dashboard_arn
}
