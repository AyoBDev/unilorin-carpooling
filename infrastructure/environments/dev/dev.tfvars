# ─────────────────────────────────────────────────────────
# Dev Environment Variables
# Path: infrastructure/environments/dev/dev.tfvars
# ─────────────────────────────────────────────────────────

environment  = "dev"
project_name = "carpool"
aws_region   = "eu-west-1"

# ── Lambda ───────────────────────────────────────────────
lambda_zip_path          = "../../../backend/dist/lambda.zip"
lambda_memory_size       = 512       # Lower for dev (cost saving)
lambda_timeout           = 30
api_reserved_concurrency = -1        # Unreserved in dev
create_lambda_layer      = false
enable_vpc               = false     # No ElastiCache in dev
enable_schedules         = false     # Disable cron in dev

# ── API Gateway ──────────────────────────────────────────
cors_origin     = "http://localhost:3000,http://localhost:3001"
app_url         = "http://localhost:3000"
api_burst_limit = 500
api_rate_limit  = 100

# ── Logging ──────────────────────────────────────────────
log_level          = "debug"
log_retention_days = 7   # Short retention in dev

# ── Notifications ────────────────────────────────────────
ses_sender_email = "noreply@carpool.unilorin.edu.ng"

# ── DynamoDB ─────────────────────────────────────────────
dynamodb_billing_mode = "PAY_PER_REQUEST"

# ── Networking (disabled in dev) ─────────────────────────
enable_nat_gateway = false
single_nat_gateway = true
vpc_cidr           = "10.0.0.0/16"
