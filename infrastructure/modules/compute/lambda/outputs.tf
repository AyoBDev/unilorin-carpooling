# ─────────────────────────────────────────────────────────
# Lambda Module Outputs
# ─────────────────────────────────────────────────────────

# ── API Function ─────────────────────────────────────────

output "api_function_name" {
  description = "Name of the API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "api_function_arn" {
  description = "ARN of the API Lambda function"
  value       = aws_lambda_function.api.arn
}

output "api_invoke_arn" {
  description = "Invoke ARN of the API Lambda (for API Gateway integration)"
  value       = aws_lambda_function.api.invoke_arn
}

output "api_function_qualified_arn" {
  description = "Qualified ARN including version"
  value       = aws_lambda_function.api.qualified_arn
}

# ── Execution Role ───────────────────────────────────────

output "execution_role_arn" {
  description = "ARN of the Lambda execution IAM role"
  value       = aws_iam_role.lambda_execution.arn
}

output "execution_role_name" {
  description = "Name of the Lambda execution IAM role"
  value       = aws_iam_role.lambda_execution.name
}

# ── Scheduled Functions ──────────────────────────────────

output "scheduled_function_arns" {
  description = "Map of scheduled function ARNs"
  value       = { for k, v in aws_lambda_function.scheduled : k => v.arn }
}

output "scheduled_function_names" {
  description = "Map of scheduled function names"
  value       = { for k, v in aws_lambda_function.scheduled : k => v.function_name }
}

# ── Trigger Functions ────────────────────────────────────

output "dynamodb_stream_function_arn" {
  description = "ARN of the DynamoDB stream processor function"
  value       = aws_lambda_function.dynamodb_stream.arn
}

output "sqs_notification_function_arn" {
  description = "ARN of the SQS notification processor function"
  value       = aws_lambda_function.sqs_notification.arn
}

# ── Log Groups ───────────────────────────────────────────

output "log_group_names" {
  description = "All CloudWatch log group names"
  value = merge(
    { api = aws_cloudwatch_log_group.api.name },
    { for k, v in aws_cloudwatch_log_group.scheduled : k => v.name },
    {
      dynamodb_stream  = aws_cloudwatch_log_group.dynamodb_stream.name
      sqs_notification = aws_cloudwatch_log_group.sqs_notification.name
    }
  )
}
