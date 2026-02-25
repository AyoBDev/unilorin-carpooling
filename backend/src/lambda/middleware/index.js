/**
 * Lambda Middleware Barrel Export
 * Path: src/lambda/middleware/index.js
 */

'use strict';

const {
  withMiddleware,
  trackColdStart,
  isWarmupEvent,
  extractCorrelationId,
  buildErrorResponse,
  createTimeoutGuard,
} = require('./lambdaMiddleware');

module.exports = {
  withMiddleware,
  trackColdStart,
  isWarmupEvent,
  extractCorrelationId,
  buildErrorResponse,
  createTimeoutGuard,
};
