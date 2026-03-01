# ─────────────────────────────────────────────────────────
# Staging Environment Variables
# Path: infrastructure/environments/staging/staging.tfvars
#
# Deploy:
#   export JWT_SECRET=...
#   export MAPBOX_ACCESS_TOKEN=...
#   export ENCRYPTION_KEY=...    # openssl rand -hex 16
#   export VAPID_PUBLIC_KEY=...  # npx web-push generate-vapid-keys
#   export VAPID_PRIVATE_KEY=...
#   ./scripts/build-lambda.sh --deploy staging
# ─────────────────────────────────────────────────────────

environment  = "staging"
project_name = "carpool"
aws_region   = "eu-west-1"

# ── Lambda ───────────────────────────────────────────────
lambda_zip_path          = "../../../backend/dist/lambda.zip"
lambda_memory_size       = 1024
lambda_timeout           = 30
api_reserved_concurrency = 5      # Reserve minimum warm instances
create_lambda_layer      = false
enable_vpc               = true   # ElastiCache enabled in staging
enable_schedules         = true

# ── API Gateway ──────────────────────────────────────────
cors_origin     = "https://staging.psride.ng"
app_url         = "https://staging.psride.ng"
api_burst_limit = 500
api_rate_limit  = 200

# ── Logging ──────────────────────────────────────────────
log_level          = "debug"
log_retention_days = 14

# ── Notifications ────────────────────────────────────────
ses_sender_email = "noreply@psride.ng"

# ── Secrets (pass via env vars, never hardcode here) ─────
vapid_mailto = "mailto:admin@psride.ng"

# ── DynamoDB ─────────────────────────────────────────────
dynamodb_billing_mode = "PAY_PER_REQUEST"
dynamodb_enable_pitr  = true    # On in staging — mirrors production

# ── Networking ───────────────────────────────────────────
enable_nat_gateway = true
single_nat_gateway = true       # Single NAT saves cost in staging
vpc_cidr           = "10.1.0.0/16"

# ── WAF ──────────────────────────────────────────────────
enable_waf          = true
waf_rate_limit      = 1000
waf_auth_rate_limit = 50
waf_blocked_ips     = []

# ── Monitoring ────────────────────────────────────────────
enable_monitoring      = true
alarm_email            = ""     # Set to your ops email before deploying
lambda_error_threshold = 5
api_latency_threshold  = 2000

# ── CDN ──────────────────────────────────────────────────
enable_cdn          = false     # Enable when custom domain is ready
cdn_aliases         = []
cdn_certificate_arn = null
cdn_waf_acl_arn     = null
