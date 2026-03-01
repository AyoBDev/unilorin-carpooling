# ─────────────────────────────────────────────────────────
# Production Environment Variables
# Path: infrastructure/environments/production/production.tfvars
#
# Deploy:
#   export JWT_SECRET=...
#   export MAPBOX_ACCESS_TOKEN=...
#   export ENCRYPTION_KEY=...    # openssl rand -hex 16
#   export VAPID_PUBLIC_KEY=...  # npx web-push generate-vapid-keys
#   export VAPID_PRIVATE_KEY=...
#   ./scripts/build-lambda.sh --deploy production
# ─────────────────────────────────────────────────────────

environment  = "production"
project_name = "carpool"
aws_region   = "eu-west-1"

# ── Lambda ───────────────────────────────────────────────
lambda_zip_path          = "../../../backend/dist/lambda.zip"
lambda_memory_size       = 1536   # More memory = faster cold starts
lambda_timeout           = 30
api_reserved_concurrency = 10     # Keep warm pool under load
create_lambda_layer      = false
enable_vpc               = true   # ElastiCache in production
enable_schedules         = true

# ── API Gateway ──────────────────────────────────────────
cors_origin     = "https://psride.ng,https://www.psride.ng"
app_url         = "https://psride.ng"
api_burst_limit = 1000
api_rate_limit  = 500

# ── Logging ──────────────────────────────────────────────
log_level          = "info"      # No debug noise in production
log_retention_days = 90

# ── Notifications ────────────────────────────────────────
ses_sender_email = "noreply@psride.ng"

# ── Secrets (pass via env vars, never hardcode here) ─────
vapid_mailto = "mailto:admin@psride.ng"

# ── DynamoDB ─────────────────────────────────────────────
dynamodb_billing_mode = "PAY_PER_REQUEST"
dynamodb_enable_pitr  = true    # Critical — enables 35-day restore window

# ── Networking ───────────────────────────────────────────
enable_nat_gateway = true
single_nat_gateway = false      # Multi-AZ NAT for HA
vpc_cidr           = "10.2.0.0/16"

# ── WAF ──────────────────────────────────────────────────
enable_waf          = true
waf_rate_limit      = 500
waf_auth_rate_limit = 25
waf_blocked_ips     = []

# ── Monitoring ────────────────────────────────────────────
enable_monitoring      = true
alarm_email            = ""     # Set to your ops/on-call email before deploying
lambda_error_threshold = 1      # Tighter threshold in production
api_latency_threshold  = 1000

# ── CDN ──────────────────────────────────────────────────
enable_cdn          = false     # Enable when ACM cert is issued
cdn_aliases         = ["api.psride.ng"]
cdn_certificate_arn = null      # Set to us-east-1 ACM cert ARN
cdn_waf_acl_arn     = null
