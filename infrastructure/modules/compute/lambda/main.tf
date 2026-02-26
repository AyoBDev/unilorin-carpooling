# ─────────────────────────────────────────────────────────
# Lambda Functions
# University of Ilorin Carpooling Platform
#
# Deployment strategy:
#   MVP:  Single "api" function handles ALL /api/v1/* traffic
#   Scale: Uncomment granular functions, update API Gateway
#
# Functions:
#   api                  → Monolith API (Express via serverless-http)
#   scheduled-*          → Cron jobs (expire rides, reminders, etc.)
#   dynamodb-stream      → DynamoDB change notifications
#   sqs-notification     → Async notification delivery
#
# Handler paths match build script output (camelCase after dot-rename):
#   handlers/apiHandler.js         (NOT src/lambda/handlers/)
#   handlers/scheduledHandler.js
#   triggers/dynamodbTrigger.js
#   triggers/sqsTrigger.js
# ─────────────────────────────────────────────────────────

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ── Lambda Layer (shared dependencies) ───────────────────

resource "aws_lambda_layer_version" "dependencies" {
  count               = var.create_layer ? 1 : 0
  filename            = var.layer_zip_path
  layer_name          = "${var.name_prefix}-dependencies"
  compatible_runtimes = [var.runtime]
  description         = "Shared node_modules for carpool Lambda functions"
  source_code_hash    = var.layer_zip_path != null ? filebase64sha256(var.layer_zip_path) : null
}

locals {
  layer_arns = var.create_layer ? [aws_lambda_layer_version.dependencies[0].arn] : []

  # Common environment variables for all functions
  common_env = merge(var.environment_variables, {
    NODE_ENV    = var.environment
    API_VERSION = "v1"
    LOG_LEVEL   = var.log_level
    ENABLE_XRAY = "true"
  })

  # VPC config (conditional)
  vpc_config = var.enable_vpc ? {
    subnet_ids         = var.vpc_subnet_ids
    security_group_ids = var.vpc_security_group_ids
  } : null
}

# ══════════════════════════════════════════════════════════
#  1. MONOLITH API HANDLER (MVP)
# ══════════════════════════════════════════════════════════

resource "aws_lambda_function" "api" {
  function_name = "${var.name_prefix}-api"
  description   = "Main API handler – all /api/v1/* routes via Express"
  role          = aws_iam_role.lambda_execution.arn

  filename         = var.api_zip_path
  source_code_hash = filebase64sha256(var.api_zip_path)
  handler          = "handlers/apiHandler.handler"
  runtime          = var.runtime
  memory_size      = var.api_memory_size
  timeout          = var.api_timeout
  architectures    = ["arm64"]

  layers = local.layer_arns

  environment {
    variables = merge(local.common_env, {
      FUNCTION_NAME = "api"
    })
  }

  tracing_config {
    mode = "Active"
  }

  dynamic "vpc_config" {
    for_each = local.vpc_config != null ? [local.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  reserved_concurrent_executions = var.api_reserved_concurrency

  tags = merge(var.tags, {
    Function = "api"
    Type     = "http"
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# ── API Gateway Permission ───────────────────────────────

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${var.api_gateway_execution_arn}/*/*"
}

# ══════════════════════════════════════════════════════════
#  2. SCHEDULED TASK FUNCTIONS
# ══════════════════════════════════════════════════════════

locals {
  scheduled_tasks = {
    expire-rides = {
      description = "Expire past rides (every 30 min)"
      schedule    = "rate(30 minutes)"
      input       = jsonencode({ detail = { task = "expireRides" } })
      memory      = 512
      timeout     = 120
    }
    ride-reminders = {
      description = "Send ride reminders 1hr before departure (every 15 min)"
      schedule    = "rate(15 minutes)"
      input       = jsonencode({ detail = { task = "sendRideReminders" } })
      memory      = 512
      timeout     = 120
    }
    mark-no-shows = {
      description = "Mark no-show passengers (every 1 hr)"
      schedule    = "rate(1 hour)"
      input       = jsonencode({ detail = { task = "markNoShows" } })
      memory      = 512
      timeout     = 120
    }
    daily-report = {
      description = "Generate daily summary report (1 AM WAT)"
      schedule    = "cron(0 0 * * ? *)"
      input       = jsonencode({ detail = { task = "generateDailyReport" } })
      memory      = 1024
      timeout     = 300
    }
    cleanup-data = {
      description = "Archive old records (weekly, Sunday 3 AM WAT)"
      schedule    = "cron(0 2 ? * SUN *)"
      input       = jsonencode({ detail = { task = "cleanupOldData" } })
      memory      = 512
      timeout     = 300
    }
    cleanup-sessions = {
      description = "Purge expired sessions (every 6 hrs)"
      schedule    = "rate(6 hours)"
      input       = jsonencode({ detail = { task = "cleanupSessions" } })
      memory      = 256
      timeout     = 60
    }
  }
}

resource "aws_lambda_function" "scheduled" {
  for_each = local.scheduled_tasks

  function_name = "${var.name_prefix}-${each.key}"
  description   = each.value.description
  role          = aws_iam_role.lambda_execution.arn

  filename         = var.api_zip_path
  source_code_hash = filebase64sha256(var.api_zip_path)
  handler          = "handlers/scheduledHandler.handler"
  runtime          = var.runtime
  memory_size      = each.value.memory
  timeout          = each.value.timeout
  architectures    = ["arm64"]

  layers = local.layer_arns

  environment {
    variables = merge(local.common_env, {
      FUNCTION_NAME = each.key
    })
  }

  tracing_config {
    mode = "Active"
  }

  dynamic "vpc_config" {
    for_each = local.vpc_config != null ? [local.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  tags = merge(var.tags, {
    Function = each.key
    Type     = "scheduled"
  })
}

resource "aws_cloudwatch_log_group" "scheduled" {
  for_each          = local.scheduled_tasks
  name              = "/aws/lambda/${var.name_prefix}-${each.key}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# ── EventBridge Rules for Scheduled Tasks ────────────────

resource "aws_cloudwatch_event_rule" "scheduled" {
  for_each = local.scheduled_tasks

  name                = "${var.name_prefix}-${each.key}"
  description         = each.value.description
  schedule_expression = each.value.schedule
  state               = var.enable_schedules ? "ENABLED" : "DISABLED"

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "scheduled" {
  for_each = local.scheduled_tasks

  rule  = aws_cloudwatch_event_rule.scheduled[each.key].name
  arn   = aws_lambda_function.scheduled[each.key].arn
  input = each.value.input
}

resource "aws_lambda_permission" "scheduled" {
  for_each = local.scheduled_tasks

  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scheduled[each.key].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled[each.key].arn
}

# ══════════════════════════════════════════════════════════
#  3. DYNAMODB STREAM PROCESSOR
# ══════════════════════════════════════════════════════════

resource "aws_lambda_function" "dynamodb_stream" {
  function_name = "${var.name_prefix}-dynamodb-stream"
  description   = "Process DynamoDB Stream events for notifications"
  role          = aws_iam_role.lambda_execution.arn

  filename         = var.api_zip_path
  source_code_hash = filebase64sha256(var.api_zip_path)
  handler          = "triggers/dynamodbTrigger.handler"
  runtime          = var.runtime
  memory_size      = 512
  timeout          = 60
  architectures    = ["arm64"]

  layers = local.layer_arns

  environment {
    variables = merge(local.common_env, {
      FUNCTION_NAME           = "dynamodb-stream"
      NOTIFICATION_QUEUE_URL  = var.notification_queue_url
    })
  }

  tracing_config {
    mode = "Active"
  }

  dynamic "vpc_config" {
    for_each = local.vpc_config != null ? [local.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  tags = merge(var.tags, {
    Function = "dynamodb-stream"
    Type     = "trigger"
  })
}

resource "aws_cloudwatch_log_group" "dynamodb_stream" {
  name              = "/aws/lambda/${aws_lambda_function.dynamodb_stream.function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# ── DynamoDB Stream → Lambda Event Source Mapping ────────

resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = var.dynamodb_stream_arn
  function_name     = aws_lambda_function.dynamodb_stream.arn
  starting_position = "TRIM_HORIZON"
  batch_size        = 25
  maximum_batching_window_in_seconds = 5
  maximum_retry_attempts             = 3
  bisect_batch_on_function_error     = true
  parallelization_factor             = 2

  function_response_types = ["ReportBatchItemFailures"]

  destination_config {
    on_failure {
      destination_arn = var.stream_dlq_arn
    }
  }

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
      })
    }
  }

  depends_on = [aws_iam_role_policy.lambda_dynamodb]
}

# ══════════════════════════════════════════════════════════
#  4. SQS NOTIFICATION PROCESSOR
# ══════════════════════════════════════════════════════════

resource "aws_lambda_function" "sqs_notification" {
  function_name = "${var.name_prefix}-sqs-notification"
  description   = "Deliver notifications via email/SMS/push"
  role          = aws_iam_role.lambda_execution.arn

  filename         = var.api_zip_path
  source_code_hash = filebase64sha256(var.api_zip_path)
  handler          = "triggers/sqsTrigger.handler"
  runtime          = var.runtime
  memory_size      = 256
  timeout          = 30
  architectures    = ["arm64"]

  layers = local.layer_arns

  environment {
    variables = merge(local.common_env, {
      FUNCTION_NAME    = "sqs-notification"
      SES_SENDER_EMAIL = var.ses_sender_email
    })
  }

  tracing_config {
    mode = "Active"
  }

  reserved_concurrent_executions = 10

  tags = merge(var.tags, {
    Function = "sqs-notification"
    Type     = "trigger"
  })
}

resource "aws_cloudwatch_log_group" "sqs_notification" {
  name              = "/aws/lambda/${aws_lambda_function.sqs_notification.function_name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# ── SQS → Lambda Event Source Mapping ────────────────────

resource "aws_lambda_event_source_mapping" "sqs_notification" {
  event_source_arn                   = var.notification_queue_arn
  function_name                      = aws_lambda_function.sqs_notification.arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5
  function_response_types            = ["ReportBatchItemFailures"]
  enabled                            = true

  depends_on = [aws_iam_role_policy.lambda_sqs]
}

# ══════════════════════════════════════════════════════════
#  5. WARM-UP RULE (staging/production only)
# ══════════════════════════════════════════════════════════

resource "aws_cloudwatch_event_rule" "warmup" {
  count               = var.enable_warmup ? 1 : 0
  name                = "${var.name_prefix}-warmup"
  description         = "Keep API Lambda warm to minimise cold starts"
  schedule_expression = "rate(5 minutes)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "warmup" {
  count = var.enable_warmup ? 1 : 0
  rule  = aws_cloudwatch_event_rule.warmup[0].name
  arn   = aws_lambda_function.api.arn
  input = jsonencode({ source = "warmup" })
}

resource "aws_lambda_permission" "warmup" {
  count         = var.enable_warmup ? 1 : 0
  statement_id  = "AllowWarmupInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.warmup[0].arn
}
