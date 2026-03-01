#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# Build Lambda Deployment Package
# University of Ilorin Carpooling Platform
#
# Usage:
#   ./scripts/build-lambda.sh           # Build only
#   ./scripts/build-lambda.sh --layer   # Also build layer
#   ./scripts/build-lambda.sh --deploy dev  # Build + terraform apply
#
# Output:
#   backend/dist/lambda.zip       → Function code
#   backend/dist/lambda-layer.zip → Dependencies layer (optional)
#
# IMPORTANT — Lambda handler naming:
#   Lambda parses handler strings by splitting on dots.
#   Files like "api.handler.js" break this because Lambda sees
#   "api" as the module name. We rename esbuild output to
#   camelCase filenames to avoid the issue:
#
#   esbuild output                →  ZIP filename                  →  Terraform handler
#   handlers/api.handler.js       →  handlers/apiHandler.js        →  handlers/apiHandler.handler
#   handlers/scheduled.handler.js →  handlers/scheduledHandler.js  →  handlers/scheduledHandler.handler
#   triggers/dynamodb.trigger.js  →  triggers/dynamodbTrigger.js   →  triggers/dynamodbTrigger.handler
#   triggers/sqs.trigger.js       →  triggers/sqsTrigger.js        →  triggers/sqsTrigger.handler
# ─────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
DIST_DIR="$BACKEND_DIR/dist"
BUILD_DIR="$DIST_DIR/build"

# ── Colors ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[BUILD]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# ── Parse Arguments ──────────────────────────────────────
BUILD_LAYER=false
DEPLOY_STAGE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --layer) BUILD_LAYER=true; shift ;;
    --deploy) DEPLOY_STAGE="$2"; shift 2 ;;
    *) error "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Clean ────────────────────────────────────────────────
log "Cleaning previous build..."
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"

# ── Install production dependencies ──────────────────────
log "Installing production dependencies..."
cd "$BACKEND_DIR"
npm ci --production --ignore-scripts 2>/dev/null || npm install --production --ignore-scripts

# ── Bundle with esbuild ──────────────────────────────────
log "Bundling with esbuild..."

# NOTE: No --minify flag. Minification mangles Winston logger
# internals (and other libraries that rely on function.name or
# dynamic property access), causing runtime crashes on Lambda.
# The ZIP is ~1MB unminified vs ~800KB minified — negligible.

npx esbuild \
  src/lambda/handlers/api.handler.js \
  src/lambda/handlers/scheduled.handler.js \
  src/lambda/triggers/dynamodb.trigger.js \
  src/lambda/triggers/sqs.trigger.js \
  --bundle \
  --platform=node \
  --target=node20 \
  --outdir="$BUILD_DIR" \
  '--external:@aws-sdk/*' \
  --external:aws-sdk \
  --format=cjs \
  --tree-shaking=true \
  --metafile="$DIST_DIR/meta.json"

# ── Rename files (Lambda dot-in-filename fix) ────────────
# Lambda splits handler strings on dots to find the module.
# "handlers/api.handler.handler" → Lambda looks for module "api"  ✗
# "handlers/apiHandler.handler"  → Lambda looks for module "apiHandler" ✓
log "Renaming files for Lambda handler compatibility..."

# Copy static assets required at runtime (YAML files, etc.)
mkdir -p "$BUILD_DIR/docs"
cp "$BACKEND_DIR/docs/openapi.yaml" "$BUILD_DIR/docs/"

mv "$BUILD_DIR/handlers/api.handler.js"       "$BUILD_DIR/handlers/apiHandler.js"
mv "$BUILD_DIR/handlers/scheduled.handler.js" "$BUILD_DIR/handlers/scheduledHandler.js"
mv "$BUILD_DIR/triggers/dynamodb.trigger.js"  "$BUILD_DIR/triggers/dynamodbTrigger.js"
mv "$BUILD_DIR/triggers/sqs.trigger.js"       "$BUILD_DIR/triggers/sqsTrigger.js"

# Also rename source maps if they exist
for f in \
  "$BUILD_DIR/handlers/api.handler.js.map:$BUILD_DIR/handlers/apiHandler.js.map" \
  "$BUILD_DIR/handlers/scheduled.handler.js.map:$BUILD_DIR/handlers/scheduledHandler.js.map" \
  "$BUILD_DIR/triggers/dynamodb.trigger.js.map:$BUILD_DIR/triggers/dynamodbTrigger.js.map" \
  "$BUILD_DIR/triggers/sqs.trigger.js.map:$BUILD_DIR/triggers/sqsTrigger.js.map"
do
  src="${f%%:*}"
  dst="${f##*:}"
  [ -f "$src" ] && mv "$src" "$dst"
done

# ── Verify output ────────────────────────────────────────
log "Verifying build output..."

EXPECTED_FILES=(
  "handlers/apiHandler.js"
  "handlers/scheduledHandler.js"
  "triggers/dynamodbTrigger.js"
  "triggers/sqsTrigger.js"
)

MISSING=0
for f in "${EXPECTED_FILES[@]}"; do
  if [ ! -f "$BUILD_DIR/$f" ]; then
    error "Missing expected file: $f"
    MISSING=1
  fi
done

if [ "$MISSING" -eq 1 ]; then
  error "Build verification failed. Actual output:"
  find "$BUILD_DIR" -type f -name "*.js" | sort
  exit 1
fi

log "All expected files present ✓"

# ── Create ZIP (exclude source maps and empty dirs) ──────
log "Creating lambda.zip..."
cd "$BUILD_DIR"
zip -r -9 "$DIST_DIR/lambda.zip" . \
  -x "*.DS_Store" \
  -x "__MACOSX/*" \
  -x "*.md" \
  -x "*.map" \
  -x "src/*"

LAMBDA_SIZE=$(du -sh "$DIST_DIR/lambda.zip" | cut -f1)
log "lambda.zip: $LAMBDA_SIZE"

# ── Show ZIP contents ────────────────────────────────────
log "ZIP contents:"
unzip -l "$DIST_DIR/lambda.zip" | grep -E "\.js$|Name|----"

# ── Build Lambda Layer (optional) ────────────────────────
if [ "$BUILD_LAYER" = true ]; then
  log "Building Lambda layer..."
  LAYER_DIR="$DIST_DIR/layer"
  mkdir -p "$LAYER_DIR/nodejs"

  cp -r "$BACKEND_DIR/node_modules" "$LAYER_DIR/nodejs/"

  cd "$LAYER_DIR/nodejs"
  find . -name "*.d.ts" -delete
  find . -name "*.map" -delete
  find . -name "*.md" -delete
  find . -name "LICENSE*" -delete
  find . -name "CHANGELOG*" -delete
  find . -name ".eslint*" -delete
  find . -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
  find . -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
  find . -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true

  cd "$LAYER_DIR"
  zip -r -9 "$DIST_DIR/lambda-layer.zip" .

  LAYER_SIZE=$(du -sh "$DIST_DIR/lambda-layer.zip" | cut -f1)
  log "lambda-layer.zip: $LAYER_SIZE"
fi

# ── Summary ──────────────────────────────────────────────
log ""
log "Build complete!"
log "  Function:  $DIST_DIR/lambda.zip ($LAMBDA_SIZE)"
if [ "$BUILD_LAYER" = true ]; then
  log "  Layer:     $DIST_DIR/lambda-layer.zip ($LAYER_SIZE)"
fi
log ""
log "Terraform handler paths (must match main.tf):"
log "  API:       handlers/apiHandler.handler"
log "  Scheduled: handlers/scheduledHandler.handler"
log "  Stream:    triggers/dynamodbTrigger.handler"
log "  SQS:       triggers/sqsTrigger.handler"
log ""
log "Quick deploy:"
log "  aws lambda update-function-code \\"
log "    --function-name carpool-dev-api \\"
log "    --zip-file fileb://$DIST_DIR/lambda.zip \\"
log "    --region eu-west-1"

# ── Deploy (optional) ────────────────────────────────────
if [ -n "$DEPLOY_STAGE" ]; then
  log ""
  log "Deploying to '$DEPLOY_STAGE'..."
  cd "$PROJECT_ROOT/infrastructure/environments/$DEPLOY_STAGE"

  # Require secrets to be set in the environment — never hardcode them here.
  if [ -z "${JWT_SECRET:-}" ]; then
    error "JWT_SECRET env var is not set. Export it before deploying."
    exit 1
  fi
  if [ -z "${MAPBOX_ACCESS_TOKEN:-}" ]; then
    error "MAPBOX_ACCESS_TOKEN env var is not set. Export it before deploying."
    exit 1
  fi
  if [ -z "${ENCRYPTION_KEY:-}" ]; then
    error "ENCRYPTION_KEY env var is not set. Generate one with: openssl rand -hex 16"
    exit 1
  fi
  if [ -z "${VAPID_PUBLIC_KEY:-}" ]; then
    error "VAPID_PUBLIC_KEY env var is not set. Generate keys with: npx web-push generate-vapid-keys"
    exit 1
  fi
  if [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
    error "VAPID_PRIVATE_KEY env var is not set. Generate keys with: npx web-push generate-vapid-keys"
    exit 1
  fi

  terraform init -backend-config="key=${DEPLOY_STAGE}/terraform.tfstate"
  terraform plan \
    -var-file="${DEPLOY_STAGE}.tfvars" \
    -var="lambda_zip_path=$DIST_DIR/lambda.zip" \
    -var="jwt_secret=$JWT_SECRET" \
    -var="mapbox_access_token=$MAPBOX_ACCESS_TOKEN" \
    -var="encryption_key=$ENCRYPTION_KEY" \
    -var="vapid_public_key=$VAPID_PUBLIC_KEY" \
    -var="vapid_private_key=$VAPID_PRIVATE_KEY" \
    -out=tfplan

  read -p "Apply? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    terraform apply tfplan
    log "Deployment to '$DEPLOY_STAGE' complete!"
  else
    warn "Deployment cancelled."
  fi
fi
