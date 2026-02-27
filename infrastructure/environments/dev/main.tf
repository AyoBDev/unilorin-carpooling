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

# ══════════════════════════════════════════════════════════
#  WAF (REGIONAL — protects API Gateway directly)
# ══════════════════════════════════════════════════════════

module "waf" {
  source = "../../modules/security/waf"
  count  = var.enable_waf ? 1 : 0

  name_prefix     = local.name_prefix
  environment     = var.environment
  scope           = "REGIONAL"
  api_gateway_arn = module.api_gateway.api_arn

  rate_limit      = var.waf_rate_limit
  auth_rate_limit = var.waf_auth_rate_limit

  blocked_ip_ranges = var.waf_blocked_ips

  enable_common_ruleset       = true
  enable_known_bad_inputs     = true
  enable_amazon_ip_reputation = true
  enable_anonymous_ip_list    = false

  enable_logging     = true
  log_retention_days = var.log_retention_days

  enable_alarms       = var.environment != "dev"
  alarm_sns_topic_arn = var.enable_monitoring ? module.monitoring[0].alert_topic_arn : null

  tags = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  MONITORING (CloudWatch)
# ══════════════════════════════════════════════════════════

module "monitoring" {
  source = "../../modules/monitoring"
  count  = var.enable_monitoring ? 1 : 0

  name_prefix  = local.name_prefix
  environment  = var.environment

  api_function_name = module.lambda.api_function_name
  lambda_log_groups = module.lambda.log_group_names

  api_gateway_name  = "${local.name_prefix}-api"
  api_gateway_stage = var.environment

  dynamodb_table_name     = module.database.table_name
  notification_queue_name = module.messaging.notification_queue_name
  notification_dlq_name   = module.messaging.notification_dlq_name

  alarm_email   = var.alarm_email
  enable_alarms = var.environment != "dev"

  # Thresholds (use defaults for dev; override in staging/production tfvars)
  lambda_error_rate_threshold   = var.lambda_error_threshold
  api_latency_threshold_ms      = var.api_latency_threshold
  dlq_depth_threshold           = 1

  tags = local.common_tags
}

# ══════════════════════════════════════════════════════════
#  CDN (CloudFront) - Optional
# ══════════════════════════════════════════════════════════

module "cdn" {
  source = "../../modules/cdn/cloudfront"
  count  = var.enable_cdn ? 1 : 0

  name_prefix = local.name_prefix
  environment = var.environment

  api_gateway_url   = module.api_gateway.api_url
  api_gateway_stage = var.environment

  aliases         = var.cdn_aliases
  certificate_arn = var.cdn_certificate_arn

  price_class = "PriceClass_100"

  # Attach CLOUDFRONT-scope WAF if a separate CDN WAF ARN is provided;
  # otherwise leave unprotected (regional WAF already covers API GW)
  waf_acl_arn = var.cdn_waf_acl_arn

  tags = local.common_tags
}
