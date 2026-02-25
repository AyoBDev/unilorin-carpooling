# ─────────────────────────────────────────────────────────
# Main Configuration
# Path: infrastructure/environments/dev/main.tf
# ─────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ══════════════════════════════════════════════════════════
#  DATABASE (DynamoDB)
# ══════════════════════════════════════════════════════════

module "database" {
  source = "../../modules/database/dynamodb"

  name_prefix   = local.name_prefix
  billing_mode  = var.dynamodb_billing_mode
  tags          = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  STORAGE (S3)
# ══════════════════════════════════════════════════════════

module "storage" {
  source = "../../modules/storage/s3"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  NETWORKING (VPC) - Optional
# ══════════════════════════════════════════════════════════

module "networking" {
  source = "../../modules/networking/vpc"
  count  = var.enable_vpc ? 1 : 0

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  enable_nat_gateway = var.enable_nat_gateway
  single_nat_gateway = var.single_nat_gateway
  tags               = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  SECURITY GROUPS - Optional
# ══════════════════════════════════════════════════════════

module "security" {
  source = "../../modules/networking/security-groups"
  count  = var.enable_vpc ? 1 : 0

  name_prefix = local.name_prefix
  vpc_id      = module.networking[0].vpc_id
  tags        = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  CACHE (ElastiCache) - Optional
# ══════════════════════════════════════════════════════════

module "cache" {
  source = "../../modules/cache/elasticache"
  count  = var.enable_vpc ? 1 : 0

  name_prefix        = local.name_prefix
  subnet_ids         = module.networking[0].private_subnet_ids
  security_group_ids = [module.security[0].redis_security_group_id]
  tags               = local.common_tags
}
