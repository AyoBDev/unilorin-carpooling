# PSRide

**Serverless ride-sharing backend for University of Ilorin** — built with Node.js, Express, AWS Lambda, and DynamoDB.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?style=for-the-badge&logo=express&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=for-the-badge&logo=aws-lambda&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=for-the-badge&logo=amazondynamodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-674_tests-C21325?style=for-the-badge&logo=jest&logoColor=white)

---

## What is PSRide?

PSRide is a ride-sharing platform designed for the University of Ilorin community, connecting drivers and passengers for affordable, convenient campus commutes. The Phase 1 MVP uses a cash-only payment system with a 6-digit verification code flow for secure ride completion.

Built as a fully serverless backend deployed on AWS, PSRide exposes a RESTful API ready for integration with any mobile or web frontend.

---

## Tech Stack

| Category | Technologies |
|---|---|
| **Runtime & Framework** | Node.js 20+, Express 5.2 |
| **Database** | DynamoDB (single-table design, 4 GSIs) |
| **Cache** | Redis via ioredis (graceful degradation when unavailable) |
| **Authentication** | JWT + bcrypt |
| **Cloud Services** | AWS Lambda, API Gateway, S3, SQS, CloudWatch |
| **Infrastructure** | Terraform (multi-environment: dev, staging, production) |
| **External APIs** | Mapbox Directions API, Web Push (VAPID) |
| **Testing** | Jest (674 tests), Supertest |
| **Code Quality** | ESLint, Prettier, Husky + lint-staged |

---

## Architecture

```mermaid
flowchart LR
    Client([Client]) --> APIGW[API Gateway]
    APIGW --> Lambda[AWS Lambda]
    Lambda --> SH[serverless-http]
    SH --> Express[Express App]

    Express --> MW[Middleware\nAuth | Validation | Rate Limiting]
    MW --> Routes[Routes]
    Routes --> Controllers[Controllers]
    Controllers --> Services[Services]
    Services --> Repos[Repositories]
    Repos --> DynamoDB[(DynamoDB)]

    Services <--> Cache[(Redis Cache)]
    Services --> SQS[SQS Queue]
    SQS --> Workers[Notification Workers\nEmail / SMS / Push]

    DynamoDB --> Streams[DynamoDB Streams]
    Streams --> Triggers[Auto-notification\nTriggers]

    Controllers --> S3[S3 File Uploads]
```

---

## Features

- **Authentication** — Register, login, email verification, password reset, JWT refresh
- **Driver Verification** — Driver approval flow with vehicle management
- **Ride Management** — Create, search, and match rides with Mapbox routing (real-road distance & duration)
- **Booking System** — Book rides with a 6-digit cash payment verification code
- **Push Notifications** — Real-time VAPID-based web push notifications
- **Ratings** — Rate drivers and passengers after completed rides
- **Safety & Reporting** — Report safety concerns and incidents
- **File Uploads** — Profile pictures and documents via S3
- **Admin Endpoints** — Driver verification, user management
- **Scheduled Tasks** — 6 automated cron jobs for maintenance and cleanup

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **AWS CLI** configured with valid credentials
- **Local DynamoDB** — via [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) or Docker:
  ```bash
  docker run -p 8000:8000 amazon/dynamodb-local
  ```

### Installation

```bash
# Clone the repository
git clone https://github.com/AyoBDev/unilorin-carpooling.git
cd unilorin-carpooling/backend

# Install dependencies
npm install
```

### Configuration

Create a `.env` file in `backend/` with the following variables:

```env
NODE_ENV=development
PORT=3000

# DynamoDB (local)
DYNAMODB_TABLE=carpooling-dev
DYNAMODB_ENDPOINT=http://localhost:8000
AWS_REGION=eu-west-1

# Redis (optional)
CACHE_ENABLED=false

# Auth — generate a secure secret
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRY=15m

# Encryption — generate via: openssl rand -hex 16
ENCRYPTION_KEY=<your-encryption-key>

# VAPID — generate via: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>

# Mapbox (for ride routing)
MAPBOX_ACCESS_TOKEN=<your-mapbox-token>

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Run

```bash
# Start development server with hot-reload
npm run dev

# Run tests
npm test

# Lint & format
npm run lint
npm run format
```

---

## API Documentation

Full API documentation (104 endpoints, 34 schemas) is available via Swagger UI:

[View API Docs](https://ayobdev.github.io/unilorin-carpooling/)

---

## License

This project is licensed under the [MIT License](LICENSE).
