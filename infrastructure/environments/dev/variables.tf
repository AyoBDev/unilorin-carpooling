# ─────────────────────────────────────────────────────────
# Variables
# Path: infrastructure/environments/dev/variables.tf
# ─────────────────────────────────────────────────────────

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway"
  type        = bool
  default     = false
}

variable "single_nat_gateway" {
  description = "Use single NAT gateway"
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}
