# ─────────────────────────────────────────────────────────
# SQS Queues
# University of Ilorin Carpooling Platform
#
# Queues:
#   notification     → email/SMS/push delivery
#   notification-dlq → failed notification retries
#   stream-dlq       → failed DynamoDB stream events
# ─────────────────────────────────────────────────────────

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Notification Queue ───────────────────────────────────

resource "aws_sqs_queue" "notification" {
  name                       = "${var.name_prefix}-notifications"
  visibility_timeout_seconds = 60        # Must be > Lambda timeout
  message_retention_seconds  = 345600    # 4 days
  delay_seconds              = 0
  max_message_size           = 262144    # 256 KB
  receive_wait_time_seconds  = 5         # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notification_dlq.arn
    maxReceiveCount     = 3
  })

  sqs_managed_sse_enabled = true

  tags = merge(var.tags, { Queue = "notifications" })
}

# ── Notification DLQ ─────────────────────────────────────

resource "aws_sqs_queue" "notification_dlq" {
  name                      = "${var.name_prefix}-notifications-dlq"
  message_retention_seconds = 1209600    # 14 days
  sqs_managed_sse_enabled   = true

  tags = merge(var.tags, { Queue = "notifications-dlq" })
}

# ── Stream Failures DLQ ──────────────────────────────────

resource "aws_sqs_queue" "stream_dlq" {
  name                      = "${var.name_prefix}-stream-dlq"
  message_retention_seconds = 1209600    # 14 days
  sqs_managed_sse_enabled   = true

  tags = merge(var.tags, { Queue = "stream-dlq" })
}

# ── CloudWatch Alarms ────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  count               = var.enable_alarms ? 1 : 0
  alarm_name          = "${var.name_prefix}-notification-dlq-not-empty"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Notifications failing to deliver – check DLQ"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    QueueName = aws_sqs_queue.notification_dlq.name
  }

  tags = var.tags
}
