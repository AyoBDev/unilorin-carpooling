# ─────────────────────────────────────────────────────────
# Local Values
# Path: infrastructure/environments/dev/locals.tf
# ─────────────────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
