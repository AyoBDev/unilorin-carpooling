# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

University of Ilorin carpooling platform — a serverless Node.js backend for ride-sharing among university members. Phase 1 MVP uses cash-only payments with a 6-digit verification code flow.

## Commands

All backend commands run from `backend/`:

```bash
# Local development
npm run dev              # Start with nodemon (requires local DynamoDB + Redis)
npm start                # Start without hot-reload

# Testing
npm test                 # Run all tests (Jest)
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report

# Linting
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format

# Build & Deploy (from project root)
./scripts/build-lambda.sh              # Build lambda.zip
./scripts/build-lambda.sh --layer      # Build + dependency layer
./scripts/build-lambda.sh --deploy dev # Build + terraform apply

# Terraform (from infrastructure/environments/dev/)
terraform init
terraform plan -var-file=dev.tfvars -var="jwt_secret=xxx"
terraform apply -var-file=dev.tfvars -var="jwt_secret=xxx"
```

## Architecture

### Request Flow

```
API Gateway → Lambda (api.handler.js) → serverless-http → Express app
  → middleware chain → /api/v1/{route} → Controller → Service → Repository → DynamoDB
```

The Express app (`src/app.js`) is shared between Lambda and local dev (`src/server.js`). Lambda wraps it via `serverless-http` in `src/lambda/handlers/api.handler.js`.

### Layer Structure

- **`api/controllers/`** — Class-based controllers. Each instantiates its service in the constructor and binds all methods. Methods extract from `req`, call service, return via `success()`/`created()` response helpers.
- **`api/routes/`** — Express routers. Apply auth middleware (`authenticate`, `authorize`, `requireDriver`), validation middleware, and route-specific rate limiters before controller methods.
- **`api/middlewares/`** — Auth (JWT verification + Redis session/blacklist check), validation (Joi + sanitization), rate limiting, error handling, request logging with correlation IDs.
- **`core/services/`** — Business logic. Services instantiate repositories directly. Throw typed errors from `shared/errors/` (ValidationError, NotFoundError, etc.) with codes from `shared/constants/errors.js`.
- **`core/domain/entities/`** — Domain model classes with validation and factory methods.
- **`infrastructure/database/repositories/`** — Extend `BaseRepository` which provides CRUD against DynamoDB. All repos operate on a single DynamoDB table.
- **`infrastructure/cache/`** — Redis cache layer. `CacheService` provides cache-aside (`getOrSet`), distributed locks, rate limiting, session management, token blacklisting. All methods degrade gracefully when Redis is down.
- **`lambda/handlers/`** — Lambda entry points. `api.handler.js` is the primary monolith handler. Additional dedicated handlers exist for future per-route scaling. `scheduled.handler.js` has 6 cron tasks.
- **`lambda/triggers/`** — DynamoDB Stream trigger (auto-notifications on entity changes) and SQS trigger (email/SMS/push delivery).

### Database Design

Single-table DynamoDB design with PK/SK keys and 4 GSIs (GSI1-GSI4) for different access patterns. Table name derived from `DYNAMODB_TABLE` env var. Entity type stored in `EntityType` attribute. All repos go through `BaseRepository` which handles marshalling, batch operations, and error mapping.

### Import Conventions

The project uses Node.js subpath imports defined in `package.json`:
- `#api/*` → `./src/api/*.js`
- `#core/*` → `./src/core/*.js`
- `#infrastructure/*` → `./src/infrastructure/*.js`
- `#shared/*` → `./src/shared/*.js`

In practice, most files use relative `require()` paths.

### Error Handling Pattern

All custom errors extend `AppError` (`shared/errors/AppError.js`) which carries `code`, `statusCode`, `details`, and `isOperational`. Specific error classes: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `BadRequestError`. The centralized `errorHandler` middleware serializes these to consistent JSON responses.

### Lambda Build Process

The build script (`scripts/build-lambda.sh`) uses esbuild to bundle, then renames dotted filenames (e.g., `api.handler.js` → `apiHandler.js`) because Lambda's handler resolution splits on dots. Terraform handler references use the camelCase names.

### Infrastructure

Terraform modules in `infrastructure/modules/`: Lambda compute (9 functions), API Gateway (REST API with proxy), SQS (notification queue + DLQs), plus networking, database, storage, and cache modules. Environment configs in `infrastructure/environments/{dev,staging,production}/`.

### Key Environment Variables

`NODE_ENV`, `PORT`, `DYNAMODB_TABLE`, `DYNAMODB_ENDPOINT` (local dev), `AWS_REGION` (default: eu-west-1), `REDIS_HOST`, `REDIS_PORT`, `CACHE_ENABLED`, `JWT_SECRET`, `JWT_EXPIRY`, `CORS_ORIGINS`, `MAPBOX_ACCESS_TOKEN`.
