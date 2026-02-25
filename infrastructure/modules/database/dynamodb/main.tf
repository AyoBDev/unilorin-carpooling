variable "name_prefix" { type = string }
variable "billing_mode" { type = string }
variable "tags" { type = map(string) }

resource "aws_dynamodb_table" "main" {
  name         = "${var.name_prefix}-main"
  billing_mode = var.billing_mode
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = var.tags
}

output "table_name" { value = aws_dynamodb_table.main.name }
output "table_arn" { value = aws_dynamodb_table.main.arn }
output "stream_arn" { value = aws_dynamodb_table.main.stream_arn }
