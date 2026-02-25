# ─────────────────────────────────────────────────────────
# Lambda IAM Roles & Policies
# University of Ilorin Carpooling Platform
#
# Follows least-privilege principle:
#   - Base execution role (CloudWatch logs, X-Ray)
#   - DynamoDB access policy
#   - SQS access policy
#   - SES/SNS access policy
#   - ElastiCache (VPC) policy
#   - Secrets Manager policy
#   - S3 access policy
# ─────────────────────────────────────────────────────────

# ── Base Execution Role ──────────────────────────────────

resource "aws_iam_role" "lambda_execution" {
  name = "${var.name_prefix}-lambda-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# ── CloudWatch Logs ──────────────────────────────────────

resource "aws_iam_role_policy" "lambda_logging" {
  name = "${var.name_prefix}-lambda-logging"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# ── X-Ray Tracing ────────────────────────────────────────

resource "aws_iam_role_policy" "lambda_xray" {
  name = "${var.name_prefix}-lambda-xray"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      }
    ]
  })
}

# ── DynamoDB Access ──────────────────────────────────────

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${var.name_prefix}-lambda-dynamodb"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:ConditionCheckItem"
        ]
        Resource = [
          var.dynamodb_table_arn,
          "${var.dynamodb_table_arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = "${var.dynamodb_table_arn}/stream/*"
      }
    ]
  })
}

# ── SQS Access ───────────────────────────────────────────

resource "aws_iam_role_policy" "lambda_sqs" {
  name = "${var.name_prefix}-lambda-sqs"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          var.notification_queue_arn,
          var.notification_dlq_arn,
          var.stream_dlq_arn
        ]
      }
    ]
  })
}

# ── SES (Email) ──────────────────────────────────────────

resource "aws_iam_role_policy" "lambda_ses" {
  name = "${var.name_prefix}-lambda-ses"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail",
          "ses:SendTemplatedEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = var.ses_sender_email
          }
        }
      }
    ]
  })
}

# ── SNS (SMS) ────────────────────────────────────────────

resource "aws_iam_role_policy" "lambda_sns" {
  name = "${var.name_prefix}-lambda-sns"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# ── Secrets Manager ──────────────────────────────────────

resource "aws_iam_role_policy" "lambda_secrets" {
  name = "${var.name_prefix}-lambda-secrets"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.name_prefix}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/carpool/${var.environment}/*"
      }
    ]
  })
}

# ── S3 Access (uploads bucket) ───────────────────────────

resource "aws_iam_role_policy" "lambda_s3" {
  name = "${var.name_prefix}-lambda-s3"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*"
        ]
      }
    ]
  })
}

# ── VPC Access (for ElastiCache) ─────────────────────────

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = var.enable_vpc ? 1 : 0
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# ── Data Sources ─────────────────────────────────────────

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
