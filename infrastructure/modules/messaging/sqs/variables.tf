# ─────────────────────────────────────────────────────────
# SQS Module Variables
# ─────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}

variable "enable_alarms" {
  description = "Enable CloudWatch alarms for DLQs"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arns" {
  description = "SNS topic ARNs for alarm notifications"
  type        = list(string)
  default     = []
}
