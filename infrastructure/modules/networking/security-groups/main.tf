variable "name_prefix" { type = string }
variable "vpc_id" { type = string }
variable "tags" { type = map(string) }

resource "aws_security_group" "lambda" {
  name        = "${var.name_prefix}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-lambda-sg" })
}

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Security group for Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis-sg" })
}

output "lambda_security_group_id" { value = aws_security_group.lambda.id }
output "redis_security_group_id" { value = aws_security_group.redis.id }
