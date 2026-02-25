/**
 * Application Entry Point
 * University of Ilorin Carpooling Platform
 *
 * Express application configured with all middleware and routes.
 * This file is imported by Lambda handlers and local dev server.
 *
 * Path: src/app.js
 *
 * @module app
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const routes = require('./api/routes');
const { requestLogger, correlationId } = require('./api/middlewares/logging.middleware');
const {
  errorHandler,
  notFoundHandler,
  registerProcessErrorHandlers,
} = require('./api/middlewares/error.middleware');
const { apiLimiter } = require('./api/middlewares/rateLimiter.middleware');
const { sanitizeBody, stripHtmlFromBody } = require('./api/middlewares/validation.middleware');
const { logger } = require('./shared/utils/logger');

// Register global process error handlers
registerProcessErrorHandlers();

const app = express();

// ─── TRUST PROXY (for rate limiting behind ALB/CloudFront) ─────
app.set('trust proxy', 1);

// ─── SECURITY MIDDLEWARE ───────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: [
      'x-correlation-id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  }),
);

// ─── BODY PARSING ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── COMPRESSION ───────────────────────────────────────────────
app.use(compression());

// ─── CORRELATION ID & LOGGING ──────────────────────────────────
app.use(correlationId);
app.use(requestLogger());

// ─── GLOBAL RATE LIMITER ───────────────────────────────────────
app.use('/api', apiLimiter);

// ─── INPUT SANITISATION ────────────────────────────────────────
app.use(sanitizeBody);
app.use(stripHtmlFromBody);

// ─── API ROUTES ────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 HANDLER ───────────────────────────────────────────────
app.use(notFoundHandler);

// ─── CENTRALISED ERROR HANDLER ─────────────────────────────────
app.use(errorHandler);

// ─── STARTUP LOGGING ───────────────────────────────────────────
logger.info('Express application configured', {
  environment: process.env.NODE_ENV || 'development',
  apiVersion: 'v1',
  corsOrigins: process.env.CORS_ORIGINS || 'localhost',
});

// In app.js — add after DynamoDB connection setup

const redisClient = require('./infrastructure/cache/RedisClient');

// Connect Redis (non-blocking — app works without cache)
(async () => {
  try {
    await redisClient.connect();
    logger.info('Redis cache connected');
  } catch (error) {
    logger.warn('Redis cache unavailable — running without cache', {
      error: error.message,
    });
  }
})();

// Add health check endpoint
app.get('/api/v1/health', async (req, res) => {
  let cacheHealth = 'disabled';
  try {
    cacheHealth = (await redisClient.healthCheck()) || 'unavailable';
  } catch (e) {
    cacheHealth = 'error';
  }
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      cache: cacheHealth,
      timestamp: new Date().toISOString(),
    },
  });
});

// Graceful shutdown — add to existing shutdown handler
process.on('SIGTERM', async () => {
  await redisClient.disconnect();
  process.exit(0);
});

module.exports = app;
