/**
 * Bookings Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/bookings.handler.js
 *
 * Dedicated handler for booking management endpoints.
 * Uses distributed locks (Redis) for seat reservation,
 * so Redis connectivity is important here.
 *
 * Routes handled:
 *   POST   /api/v1/bookings
 *   GET    /api/v1/bookings/my-bookings
 *   GET    /api/v1/bookings/statistics
 *   GET    /api/v1/bookings/:id
 *   PATCH  /api/v1/bookings/:id/cancel
 *   GET    /api/v1/bookings/:id/verification
 *   GET    /api/v1/bookings/driver-bookings
 *   PATCH  /api/v1/bookings/:id/confirm
 *   POST   /api/v1/bookings/:id/start
 *   POST   /api/v1/bookings/:id/complete
 *   PATCH  /api/v1/bookings/:id/no-show
 *
 * @module lambda/handlers/bookings
 */

'use strict';

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const bookingRoutes = require('../../api/routes/booking.routes');
const {
  correlationId,
  requestLogger,
  errorHandler,
  notFoundHandler,
  sanitizeBody,
  stripHtmlFromBody,
} = require('../../api/middlewares');
const { withMiddleware } = require('../middleware/lambdaMiddleware');
const { RedisClient } = require('../../infrastructure/cache');
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

// Mount only booking routes
app.use('/api/v1/bookings', bookingRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'bookings', timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Redis Init (critical for distributed locks) ────────

let redisReady = false;
const initRedis = async () => {
  if (redisReady) return;
  try {
    if (process.env.CACHE_ENABLED !== 'false' && process.env.REDIS_ENDPOINT) {
      await RedisClient.connect();
      logger.info('Redis connected for booking locks');
    }
  } catch (err) {
    logger.warn('Redis unavailable – seat locking will use DynamoDB conditional writes', {
      error: err.message,
    });
  }
  redisReady = true;
};

// ─── Serverless Handler ─────────────────────────────────

const serverlessHandler = serverless(app, {
  request: (request, event, context) => {
    request.lambdaEvent = event;
    request.lambdaContext = context;
  },
});

module.exports.handler = withMiddleware(
  'bookings-handler',
  async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await initRedis();
    return serverlessHandler(event, context);
  }
);
