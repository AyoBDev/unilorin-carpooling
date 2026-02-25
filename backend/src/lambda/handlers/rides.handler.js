/**
 * Rides Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/rides.handler.js
 *
 * Dedicated handler for ride management endpoints.
 * Highest traffic function – ride search is called frequently,
 * so this is the first candidate for independent scaling.
 *
 * Routes handled:
 *   GET    /api/v1/rides/search
 *   GET    /api/v1/rides/:id
 *   GET    /api/v1/rides/upcoming
 *   POST   /api/v1/rides
 *   POST   /api/v1/rides/recurring
 *   GET    /api/v1/rides/driver/my-rides
 *   PATCH  /api/v1/rides/:id
 *   DELETE /api/v1/rides/:id
 *   POST   /api/v1/rides/:id/pickup-points
 *   DELETE /api/v1/rides/:id/pickup-points/:pointId
 *   PATCH  /api/v1/rides/:id/pickup-points/reorder
 *   POST   /api/v1/rides/:id/start
 *   POST   /api/v1/rides/:id/complete
 *   GET    /api/v1/rides/:id/passengers
 *
 * @module lambda/handlers/rides
 */

'use strict';

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const rideRoutes = require('../../api/routes/ride.routes');
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
app.use(express.json({ limit: '5mb' }));
app.use(compression());
app.use(correlationId);
app.use(requestLogger());
app.use(sanitizeBody);
app.use(stripHtmlFromBody);

// Mount only ride routes
app.use('/api/v1/rides', rideRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'rides', timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ─── Redis Init ─────────────────────────────────────────

let redisReady = false;
const initRedis = async () => {
  if (redisReady) return;
  try {
    if (process.env.CACHE_ENABLED !== 'false' && process.env.REDIS_ENDPOINT) {
      await RedisClient.connect();
    }
  } catch (err) {
    logger.warn('Redis unavailable – ride search will hit DynamoDB directly', {
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
  'rides-handler',
  async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await initRedis();
    return serverlessHandler(event, context);
  }
);
