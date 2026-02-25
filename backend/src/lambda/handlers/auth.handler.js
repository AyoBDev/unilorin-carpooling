/**
 * Auth Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/auth.handler.js
 *
 * Dedicated handler for authentication endpoints.
 * Used when auth routes are split into their own Lambda
 * function for independent scaling and tighter IAM policies.
 *
 * Routes handled:
 *   POST /api/v1/auth/register
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/verify-email
 *   POST /api/v1/auth/resend-verification
 *   POST /api/v1/auth/forgot-password
 *   POST /api/v1/auth/reset-password
 *   POST /api/v1/auth/refresh-token
 *   POST /api/v1/auth/verify-otp
 *   POST /api/v1/auth/resend-otp
 *   GET  /api/v1/auth/me
 *   POST /api/v1/auth/logout
 *   POST /api/v1/auth/change-password
 *   DELETE /api/v1/auth/sessions
 *
 * @module lambda/handlers/auth
 */

'use strict';

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const authRoutes = require('../../api/routes/auth.routes');
const {
  correlationId,
  requestLogger,
  errorHandler,
  notFoundHandler,
  sanitizeBody,
  stripHtmlFromBody,
} = require('../../api/middlewares');
const { withMiddleware } = require('../middleware/lambdaMiddleware');
const { logger } = require('../../shared/utils/logger');

// ─── Build Minimal Express App ──────────────────────────

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CORS_ORIGINS || '*').split(',').map((o) => o.trim());
    if (!origin || allowed.includes('*') || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(compression());
app.use(correlationId);
app.use(requestLogger());
app.use(sanitizeBody);
app.use(stripHtmlFromBody);

// Mount only auth routes
app.use('/api/v1/auth', authRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'auth', timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Serverless Handler ─────────────────────────────────

const serverlessHandler = serverless(app, {
  request: (request, event, context) => {
    request.lambdaEvent = event;
    request.lambdaContext = context;
  },
});

module.exports.handler = withMiddleware(
  'auth-handler',
  async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    return serverlessHandler(event, context);
  }
);
