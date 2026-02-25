variable "name_prefix" { type = string }
variable "tags" { type = map(string) }

resource "aws_s3_bucket" "main" {
  bucket = "${var.name_prefix}-uploads"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "main" {
  bucket                  = aws_s3_bucket.main.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "bucket_name" { value = aws_s3_bucket.main.id }
output "bucket_arn" { value = aws_s3_bucket.main.arn }
