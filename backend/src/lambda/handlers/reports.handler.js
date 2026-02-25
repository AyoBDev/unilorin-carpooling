/**
 * Reports Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/reports.handler.js
 *
 * Dedicated handler for reporting/analytics endpoints.
 * These are typically heavier queries, so a separate function
 * allows higher memory allocation and longer timeout.
 *
 * Routes handled:
 *   GET /api/v1/reports/cash-collection
 *   GET /api/v1/reports/driver-summary
 *   GET /api/v1/reports/driver-earnings
 *   GET /api/v1/reports/booking-summary
 *   GET /api/v1/reports/cash-reconciliation
 *   GET /api/v1/reports/platform-stats
 *   GET /api/v1/reports/export/:type
 *
 * @module lambda/handlers/reports
 */

'use strict';

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const reportRoutes = require('../../api/routes/report.routes');
const {
  correlationId,
  requestLogger,
  errorHandler,
  notFoundHandler,
  sanitizeBody,
  stripHtmlFromBody,
} = require('../../api/middlewares');
const { withMiddleware } = require('../middleware/lambdaMiddleware');

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

app.use('/api/v1/reports', reportRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'reports', timestamp: new Date().toISOString() });
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
  'reports-handler',
  async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    return serverlessHandler(event, context);
  }
);
