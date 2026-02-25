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
# esbuild output structure (matches Terraform handler paths):
#   handlers/api.handler.js        → handler = "handlers/api.handler.handler"
#   handlers/scheduled.handler.js  → handler = "handlers/scheduled.handler.handler"
#   triggers/dynamodb.trigger.js   → handler = "triggers/dynamodb.trigger.handler"
#   triggers/sqs.trigger.js        → handler = "triggers/sqs.trigger.handler"
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

# esbuild preserves directory structure relative to the common
# ancestor of all entry points. With entries under src/lambda/,
# the common ancestor is src/lambda/, so output becomes:
#   handlers/api.handler.js
#   handlers/scheduled.handler.js
#   triggers/dynamodb.trigger.js
#   triggers/sqs.trigger.js

npx esbuild \
  src/lambda/handlers/api.handler.js \
  src/lambda/handlers/scheduled.handler.js \
  src/lambda/triggers/dynamodb.trigger.js \
  src/lambda/triggers/sqs.trigger.js \
  --bundle \
  --platform=node \
  --target=node20 \
  --outdir="$BUILD_DIR" \
  --minify \
  --sourcemap \
  --external:aws-sdk \
  --external:@aws-sdk/* \
  --format=cjs \
  --tree-shaking=true \
  --metafile="$DIST_DIR/meta.json"

# ── Verify output ────────────────────────────────────────
log "Verifying build output..."

EXPECTED_FILES=(
  "handlers/api.handler.js"
  "handlers/scheduled.handler.js"
  "triggers/dynamodb.trigger.js"
  "triggers/sqs.trigger.js"
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

# ── Create ZIP (exclude source maps to save space) ───────
log "Creating lambda.zip..."
cd "$BUILD_DIR"
zip -r -9 "$DIST_DIR/lambda.zip" . \
  -x "*.DS_Store" \
  -x "__MACOSX/*" \
  -x "*.md" \
  -x "*.map"

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
log "Terraform handler paths:"
log "  API:       handlers/api.handler.handler"
log "  Scheduled: handlers/scheduled.handler.handler"
log "  Stream:    triggers/dynamodb.trigger.handler"
log "  SQS:       triggers/sqs.trigger.handler"

# ── Deploy (optional) ────────────────────────────────────
if [ -n "$DEPLOY_STAGE" ]; then
  log ""
  log "Deploying to '$DEPLOY_STAGE'..."
  cd "$PROJECT_ROOT/infrastructure/environments/$DEPLOY_STAGE"

  terraform init -backend-config="key=${DEPLOY_STAGE}/terraform.tfstate"
  terraform plan \
    -var-file="${DEPLOY_STAGE}.tfvars" \
    -var="lambda_zip_path=$DIST_DIR/lambda.zip" \
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
