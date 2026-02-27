# ─────────────────────────────────────────────────────────
# SQS Module Outputs
# ─────────────────────────────────────────────────────────

output "notification_queue_arn" {
  description = "ARN of the notification queue"
  value       = aws_sqs_queue.notification.arn
}

output "notification_queue_url" {
  description = "URL of the notification queue"
  value       = aws_sqs_queue.notification.url
}

output "notification_queue_name" {
  description = "Name of the notification queue"
  value       = aws_sqs_queue.notification.name
}

output "notification_dlq_arn" {
  description = "ARN of the notification DLQ"
  value       = aws_sqs_queue.notification_dlq.arn
}

output "notification_dlq_url" {
  description = "URL of the notification DLQ"
  value       = aws_sqs_queue.notification_dlq.url
}

output "stream_dlq_arn" {
  description = "ARN of the stream failures DLQ"
  value       = aws_sqs_queue.stream_dlq.arn
}

output "stream_dlq_url" {
  description = "URL of the stream failures DLQ"
  value       = aws_sqs_queue.stream_dlq.url
}

output "notification_dlq_name" {
  description = "Name of the notification DLQ"
  value       = aws_sqs_queue.notification_dlq.name
}
