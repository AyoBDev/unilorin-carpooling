# PSRide — Dev → Production Checklist

**Last Updated:** March 1, 2026

---

## 🔴 Blocking — must do before first staging deploy

### Secrets — generate and inject

- [ ] Generate VAPID keys and export them:
  ```bash
  npx web-push generate-vapid-keys
  export VAPID_PUBLIC_KEY=<public key>
  export VAPID_PRIVATE_KEY=<private key>
  ```
- [ ] Generate encryption key and export it:
  ```bash
  export ENCRYPTION_KEY=$(openssl rand -hex 16)
  ```
- [ ] Update the live dev Lambda with the new env vars:
  ```bash
  aws lambda update-function-configuration \
    --function-name carpool-dev-api \
    --region eu-west-1 \
    --environment "Variables={...,ENCRYPTION_KEY=$ENCRYPTION_KEY,VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY,VAPID_MAILTO=mailto:admin@psride.ng}"
  ```
- [ ] Set `alarm_email` in `infrastructure/environments/staging/staging.tfvars` to a real email address

### CORS

- [ ] Set `cors_origin` in `staging.tfvars` to the real staging frontend domain
- [ ] Set `cors_origin` in `production.tfvars` to the real production frontend domain
  - Currently set to placeholder values `https://staging.psride.ng` / `https://psride.ng`

---

## 🟠 High Priority — before production traffic

### Testing gate

- [ ] Add `npm test` to `scripts/build-lambda.sh` before the esbuild step so a failing test blocks the deploy

### Staging deploy + smoke test

- [ ] Deploy staging:
  ```bash
  export JWT_SECRET=<strong-secret>
  export MAPBOX_ACCESS_TOKEN=<token>
  export ENCRYPTION_KEY=<generated above>
  export VAPID_PUBLIC_KEY=<generated above>
  export VAPID_PRIVATE_KEY=<generated above>
  ./scripts/build-lambda.sh --deploy staging
  ```
- [ ] Run the full ride flow end-to-end on staging:
  - [ ] Register → verify email → login
  - [ ] Register as driver → admin verify driver
  - [ ] Create ride → confirm `route.distance` is non-null (Mapbox working)
  - [ ] Book ride → get `verificationCode`
  - [ ] Driver verifies code → completes booking → cash confirmed
  - [ ] Passenger rates driver
- [ ] Confirm `GET /notifications/push/vapid-key` returns a real public key (not `null`)

---

## 🟡 Before Go-Live

### Custom domain (CloudFront + ACM)

- [ ] Issue ACM certificate for `api.psride.ng` in `us-east-1` (required for CloudFront)
- [ ] Set `cdn_certificate_arn` in `production.tfvars` to the ACM ARN
- [ ] Set `cdn_aliases = ["api.psride.ng"]` in `production.tfvars` (already set, just needs the cert)
- [ ] Set `enable_cdn = true` in `production.tfvars`

### Monitoring

- [ ] Set `alarm_email` in `production.tfvars` to ops / on-call email
- [ ] Confirm CloudWatch dashboard is visible after first production deploy
- [ ] Optionally wire SNS alarm topic to a Slack webhook for real-time alerts

### Test coverage

- [ ] Achieve 80% code coverage:
  ```bash
  cd backend && npm run test:coverage
  ```
  Currently ~30% — focus on controller and service edge cases

---

## ✅ Already Done

| What | Where |
|------|-------|
| `JWT_SECRET` / `ENCRYPTION_KEY` throw at Lambda startup if missing in production | `backend/src/shared/utils/encryption.js` |
| VAPID keys + `ENCRYPTION_KEY` wired into Lambda Terraform env vars | `infrastructure/environments/dev/lambda.tf` |
| Build script validates all 5 secrets before `terraform plan` | `scripts/build-lambda.sh` |
| DynamoDB point-in-time recovery (PITR) enabled in staging + prod | `infrastructure/modules/database/dynamodb/main.tf` |
| DynamoDB encryption-at-rest enabled in all environments | `infrastructure/modules/database/dynamodb/main.tf` |
| Staging Terraform environment created | `infrastructure/environments/staging/` |
| Production Terraform environment created | `infrastructure/environments/production/` |
| WAF enabled in staging + prod tfvars | `staging.tfvars` / `production.tfvars` |
| Reserved Lambda concurrency set (staging: 5, production: 10) | `staging.tfvars` / `production.tfvars` |
| Multi-AZ NAT gateway in production | `production.tfvars` |
| Lambda memory bumped to 1536 MB in production | `production.tfvars` |
| Tighter alarm thresholds in production (1% error rate, 1000ms P99) | `production.tfvars` |
| Error handling — stack traces never exposed in production | `backend/src/api/middlewares/error.middleware.js` |
| Logging — structured JSON, env-aware log levels, no secrets logged | `backend/src/shared/utils/logger.js` |
| Security middleware — Helmet, CORS, layered rate limiting | `backend/src/app.js` |
| Monitoring — CloudWatch alarms, dashboard, DLQs | `infrastructure/modules/monitoring/` |
| DynamoDB Streams + SQS DLQ — event pipeline resilient | `infrastructure/modules/messaging/sqs/` |
| X-Ray tracing active on Lambda | `infrastructure/modules/compute/lambda/main.tf` |
| Graceful Redis degradation — app works without cache | `backend/src/infrastructure/cache/` |
| Mapbox Directions API integration with Haversine fallback | `backend/src/core/services/RideService.js` |
| GitHub Pages API docs live (shadcn/ui light theme) | `docs/index.html` |

---

## Deploy Order

```
1. Generate secrets (VAPID + ENCRYPTION_KEY)
2. Set alarm_email and cors_origin in staging.tfvars
3. ./scripts/build-lambda.sh --deploy staging
4. Run staging smoke test (full ride flow)
5. Set alarm_email and cors_origin in production.tfvars
6. Issue ACM cert → enable CDN in production.tfvars
7. ./scripts/build-lambda.sh --deploy production
```
