# ─────────────────────────────────────────────────────────
# Monitoring Module
# PSRide — University of Ilorin Carpooling Platform
#
# Path: modules/monitoring/main.tf
#
# Creates:
#   - SNS topic for alarm notifications
#   - CloudWatch alarms: Lambda, API Gateway, DynamoDB, SQS
#   - CloudWatch dashboard with key operational metrics
# ─────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════
#  SNS ALERT TOPIC
# ══════════════════════════════════════════════════════════

resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ══════════════════════════════════════════════════════════
#  LAMBDA ALARMS
# ══════════════════════════════════════════════════════════

# ── Error rate: if errors / invocations > threshold % ────
# Use a metric math alarm: Errors / (Invocations + 0.01) * 100 >= threshold

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-lambda-error-rate"
  alarm_description   = "API Lambda error rate exceeded ${var.lambda_error_rate_threshold}%"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = var.lambda_error_rate_threshold
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "errors / (invocations + 0.01) * 100"
    label       = "Lambda Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      dimensions  = { FunctionName = var.api_function_name }
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "invocations"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      dimensions  = { FunctionName = var.api_function_name }
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ── Throttles ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-lambda-throttles"
  alarm_description   = "API Lambda is being throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  treat_missing_data  = "notBreaching"

  metric_name = "Throttles"
  namespace   = "AWS/Lambda"
  period      = 300
  statistic   = "Sum"
  dimensions  = { FunctionName = var.api_function_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ── P99 Duration ──────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_duration_p99" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-lambda-p99-duration"
  alarm_description   = "API Lambda P99 duration exceeded ${var.lambda_p99_duration_threshold}ms"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  threshold           = var.lambda_p99_duration_threshold
  treat_missing_data  = "notBreaching"

  metric_name = "Duration"
  namespace   = "AWS/Lambda"
  period      = 300
  extended_statistic = "p99"
  dimensions  = { FunctionName = var.api_function_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ── Concurrent Executions ─────────────────────────────────
# Alert if approaching account limit (default 1000)

resource "aws_cloudwatch_metric_alarm" "lambda_concurrent" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-lambda-concurrent-executions"
  alarm_description   = "Lambda concurrent executions approaching account limit"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = 800
  treat_missing_data  = "notBreaching"

  metric_name = "ConcurrentExecutions"
  namespace   = "AWS/Lambda"
  period      = 60
  statistic   = "Maximum"
  # No FunctionName dimension → account-wide

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ══════════════════════════════════════════════════════════
#  API GATEWAY ALARMS
# ══════════════════════════════════════════════════════════

# ── 5xx Error Rate ────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-5xx-rate"
  alarm_description   = "API Gateway 5xx error rate exceeded ${var.api_error_rate_threshold}%"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = var.api_error_rate_threshold
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_pct"
    expression  = "5xx / (count + 0.01) * 100"
    label       = "5xx Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "5xx"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "5XXError"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
      period = 300
      stat   = "Sum"
    }
  }

  metric_query {
    id = "count"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
      period = 300
      stat   = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ── Integration Latency ───────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_latency" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-latency"
  alarm_description   = "API Gateway P99 latency exceeded ${var.api_latency_threshold_ms}ms"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  threshold           = var.api_latency_threshold_ms
  treat_missing_data  = "notBreaching"

  metric_name        = "IntegrationLatency"
  namespace          = "AWS/ApiGateway"
  period             = 300
  extended_statistic = "p99"
  dimensions = {
    ApiName = var.api_gateway_name
    Stage   = var.api_gateway_stage
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ── 4xx Rate (client errors — spike may indicate auth/bot issues) ──

resource "aws_cloudwatch_metric_alarm" "api_4xx_rate" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-4xx-rate"
  alarm_description   = "API Gateway 4xx error rate above 20% — possible abuse or client bug"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  threshold           = 20
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_pct"
    expression  = "4xx / (count + 0.01) * 100"
    label       = "4xx Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "4xx"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "4XXError"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
      period = 300
      stat   = "Sum"
    }
  }

  metric_query {
    id = "count"
    metric {
      namespace   = "AWS/ApiGateway"
      metric_name = "Count"
      dimensions = {
        ApiName = var.api_gateway_name
        Stage   = var.api_gateway_stage
      }
      period = 300
      stat   = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ══════════════════════════════════════════════════════════
#  DYNAMODB ALARMS
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttles" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-dynamodb-read-throttles"
  alarm_description   = "DynamoDB read throttles on ${var.dynamodb_table_name}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = var.dynamodb_throttle_threshold
  treat_missing_data  = "notBreaching"

  metric_name = "ReadThrottleEvents"
  namespace   = "AWS/DynamoDB"
  period      = 300
  statistic   = "Sum"
  dimensions  = { TableName = var.dynamodb_table_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttles" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-dynamodb-write-throttles"
  alarm_description   = "DynamoDB write throttles on ${var.dynamodb_table_name}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = var.dynamodb_throttle_threshold
  treat_missing_data  = "notBreaching"

  metric_name = "WriteThrottleEvents"
  namespace   = "AWS/DynamoDB"
  period      = 300
  statistic   = "Sum"
  dimensions  = { TableName = var.dynamodb_table_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_system_errors" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-dynamodb-system-errors"
  alarm_description   = "DynamoDB system errors (5xx) on ${var.dynamodb_table_name}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  treat_missing_data  = "notBreaching"

  metric_name = "SystemErrors"
  namespace   = "AWS/DynamoDB"
  period      = 300
  statistic   = "Sum"
  dimensions  = { TableName = var.dynamodb_table_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ══════════════════════════════════════════════════════════
#  SQS ALARMS
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-notification-dlq-depth"
  alarm_description   = "Messages in the notification DLQ — manual intervention required"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = var.dlq_depth_threshold
  treat_missing_data  = "notBreaching"

  metric_name = "ApproximateNumberOfMessagesVisible"
  namespace   = "AWS/SQS"
  period      = 300
  statistic   = "Maximum"
  dimensions  = { QueueName = var.notification_dlq_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "queue_age" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-notification-queue-age"
  alarm_description   = "Notification queue messages are taking too long to process (>5 min)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = 300  # seconds
  treat_missing_data  = "notBreaching"

  metric_name = "ApproximateAgeOfOldestMessage"
  namespace   = "AWS/SQS"
  period      = 300
  statistic   = "Maximum"
  dimensions  = { QueueName = var.notification_queue_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = var.tags
}

# ══════════════════════════════════════════════════════════
#  CLOUDWATCH DASHBOARD
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-operations"

  dashboard_body = jsonencode({
    widgets = [
      # ── Row 1: Lambda ──────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Lambda — Invocations & Errors"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.api_function_name, { stat = "Sum", label = "Invocations", color = "#2ca02c" }],
            ["AWS/Lambda", "Errors", "FunctionName", var.api_function_name, { stat = "Sum", label = "Errors", color = "#d62728" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Lambda — Duration (P50 / P99)"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.api_function_name, { stat = "p50", label = "P50 Duration" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.api_function_name, { stat = "p99", label = "P99 Duration", color = "#ff7f0e" }],
          ]
          yAxis = { left = { label = "ms", showUnits = false } }
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6
        properties = {
          title  = "Lambda — Throttles & Concurrency"
          view   = "timeSeries"
          period = 60
          metrics = [
            ["AWS/Lambda", "Throttles", "FunctionName", var.api_function_name, { stat = "Sum", color = "#d62728" }],
            ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", var.api_function_name, { stat = "Maximum", color = "#1f77b4" }],
          ]
        }
      },
      # ── Row 2: API Gateway ─────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway — Request Count"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", var.api_gateway_name, "Stage", var.api_gateway_stage, { stat = "Sum", label = "Requests" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway — Error Rates"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/ApiGateway", "4XXError", "ApiName", var.api_gateway_name, "Stage", var.api_gateway_stage, { stat = "Sum", label = "4xx Errors", color = "#ff7f0e" }],
            ["AWS/ApiGateway", "5XXError", "ApiName", var.api_gateway_name, "Stage", var.api_gateway_stage, { stat = "Sum", label = "5xx Errors", color = "#d62728" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway — Latency (P50 / P99)"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/ApiGateway", "IntegrationLatency", "ApiName", var.api_gateway_name, "Stage", var.api_gateway_stage, { stat = "p50", label = "Integration P50" }],
            ["AWS/ApiGateway", "IntegrationLatency", "ApiName", var.api_gateway_name, "Stage", var.api_gateway_stage, { stat = "p99", label = "Integration P99", color = "#ff7f0e" }],
            ["AWS/ApiGateway", "Latency", "ApiName", var.api_gateway_name, "Stage", var.api_gateway_stage, { stat = "p99", label = "Total P99", color = "#d62728" }],
          ]
          yAxis = { left = { label = "ms", showUnits = false } }
        }
      },
      # ── Row 3: DynamoDB ───────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "DynamoDB — Read/Write Capacity"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", var.dynamodb_table_name, { stat = "Sum", label = "Read CU" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", var.dynamodb_table_name, { stat = "Sum", label = "Write CU", color = "#ff7f0e" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 12
        width  = 12
        height = 6
        properties = {
          title  = "DynamoDB — Throttles"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/DynamoDB", "ReadThrottleEvents", "TableName", var.dynamodb_table_name, { stat = "Sum", label = "Read Throttles", color = "#d62728" }],
            ["AWS/DynamoDB", "WriteThrottleEvents", "TableName", var.dynamodb_table_name, { stat = "Sum", label = "Write Throttles", color = "#ff7f0e" }],
          ]
        }
      },
      # ── Row 4: SQS ────────────────────────────────────
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "SQS — Notification Queue Depth & Age"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.notification_queue_name, { stat = "Maximum", label = "Queue Depth" }],
            ["AWS/SQS", "ApproximateAgeOfOldestMessage", "QueueName", var.notification_queue_name, { stat = "Maximum", label = "Oldest Message Age (s)", color = "#ff7f0e" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "SQS — DLQ Depth (ALERT if > 0)"
          view   = "timeSeries"
          period = 300
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.notification_dlq_name, { stat = "Maximum", label = "DLQ Depth", color = "#d62728" }],
          ]
        }
      },
    ]
  })
}
