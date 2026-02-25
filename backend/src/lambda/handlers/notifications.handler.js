/**
 * Notifications Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/notifications.handler.js
 *
 * Dedicated handler for notification endpoints.
 *
 * Routes handled:
 *   GET    /api/v1/notifications
 *   GET    /api/v1/notifications/unread-count
 *   GET    /api/v1/notifications/preferences
 *   PATCH  /api/v1/notifications/read-all
 *   PATCH  /api/v1/notifications/:id/read
 *   PATCH  /api/v1/notifications/preferences
 *   DELETE /api/v1/notifications/clear-all
 *   DELETE /api/v1/notifications/:id
 *
 * @module lambda/handlers/notifications
 */

'use strict';

const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const notificationRoutes = require('../../api/routes/notification.routes');
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

app.use('/api/v1/notifications', notificationRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'notifications', timestamp: new Date().toISOString() });
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
  'notifications-handler',
  async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    return serverlessHandler(event, context);
  }
);
