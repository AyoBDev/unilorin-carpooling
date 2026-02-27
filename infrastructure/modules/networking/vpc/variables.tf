# ─────────────────────────────────────────────────────────
# VPC Module Variables
# ─────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC (e.g. 10.0.0.0/16)"
  type        = string
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  description = "Create NAT gateways so private subnets can reach the internet"
  type        = bool
  default     = false
}

variable "single_nat_gateway" {
  description = "Use a single NAT gateway (cheaper; less HA). Only relevant when enable_nat_gateway=true"
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Enable VPC flow logs to CloudWatch (recommended for production)"
  type        = bool
  default     = false
}

variable "flow_log_retention_days" {
  description = "Retention period for VPC flow log group (days)"
  type        = number
  default     = 30
}

variable "tags" {
  description = "Common resource tags"
  type        = map(string)
  default     = {}
}
