/**
 * Lambda Middleware
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/middleware/lambdaMiddleware.js
 *
 * Provides middleware utilities for AWS Lambda handlers:
 *   - Cold start detection and logging
 *   - Correlation ID propagation from API Gateway
 *   - Graceful error wrapping with structured responses
 *   - Timeout protection
 *   - Warm-up event detection (CloudWatch scheduled pings)
 *   - Context enrichment for downstream services
 *
 * @module lambda/middleware/lambdaMiddleware
 */

'use strict';

const { logger } = require('../../shared/utils/logger');

// ─── Cold Start Tracking ────────────────────────────────

let isColdStart = true;

/**
 * Detect and log cold starts.
 * After the first invocation the flag flips to false.
 */
const trackColdStart = (functionName) => {
  if (isColdStart) {
    logger.info('Lambda cold start detected', {
      functionName,
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      runtime: process.version,
    });
    isColdStart = false;
    return true;
  }
  return false;
};

// ─── Warm-Up Detection ──────────────────────────────────

/**
 * Check whether the incoming event is a CloudWatch keep-warm ping.
 * Convention: the scheduled rule sends { "source": "warmup" }
 *
 * @param {Object} event - Lambda event
 * @returns {boolean}
 */
const isWarmupEvent = (event) => {
  if (!event) return false;
  if (event.source === 'warmup') return true;
  if (event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event') {
    // Check if it's specifically a warmup rule
    const resources = event.resources || [];
    return resources.some((r) => r.includes('warmup') || r.includes('keep-warm'));
  }
  return false;
};

// ─── Correlation ID Extraction ──────────────────────────

/**
 * Pull a correlation ID from the API Gateway event.
 * Falls back to the AWS request ID from the Lambda context.
 *
 * @param {Object} event   - Lambda event
 * @param {Object} context - Lambda context
 * @returns {string}
 */
const extractCorrelationId = (event, context) => {
  // From custom header forwarded by API Gateway
  const headers = event.headers || {};
  const correlationId =
    headers['X-Correlation-Id'] ||
    headers['x-correlation-id'] ||
    headers['X-Request-Id'] ||
    headers['x-request-id'] ||
    // From API Gateway request context
    (event.requestContext && event.requestContext.requestId) ||
    // Fallback to Lambda context
    (context && context.awsRequestId);

  return correlationId || `lambda-${Date.now()}`;
};

// ─── Structured Error Response ──────────────────────────

/**
 * Build a standard API Gateway-compatible error response.
 *
 * @param {Error}  error      - The caught error
 * @param {string} correlationId
 * @returns {Object} API Gateway proxy response
 */
const buildErrorResponse = (error, correlationId) => {
  const statusCode = error.statusCode || error.status || 500;
  const isOperational = error.isOperational || false;

  // Never leak internal details in production
  const isProd = process.env.NODE_ENV === 'production';
  const message =
    isOperational || !isProd
      ? error.message
      : 'An unexpected error occurred';

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
      'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message,
        ...(error.details && !isProd && { details: error.details }),
      },
      meta: {
        correlationId,
        timestamp: new Date().toISOString(),
      },
    }),
  };
};

// ─── Timeout Protection ─────────────────────────────────

/**
 * Returns a promise that rejects shortly before the Lambda
 * function's hard timeout, giving us time to return a
 * clean 504 rather than an opaque "Task timed out" error.
 *
 * @param {Object} context       - Lambda context
 * @param {number} [bufferMs=3000] - Safety buffer
 * @returns {Promise}
 */
const createTimeoutGuard = (context, bufferMs = 3000) => {
  if (!context || !context.getRemainingTimeInMillis) {
    // Not running in real Lambda – return a never-resolving promise
    return new Promise(() => {});
  }

  const remaining = context.getRemainingTimeInMillis();
  const timeout = Math.max(remaining - bufferMs, 1000);

  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        Object.assign(new Error('Lambda execution approaching timeout'), {
          statusCode: 504,
          code: 'LAMBDA_TIMEOUT',
          isOperational: true,
        })
      );
    }, timeout);
  });
};

// ─── Handler Wrapper ────────────────────────────────────

/**
 * Wraps a Lambda handler with cross-cutting concerns:
 *   1. Cold start logging
 *   2. Warm-up short-circuit
 *   3. Correlation ID propagation
 *   4. Timeout protection
 *   5. Structured error responses
 *   6. Duration logging
 *
 * Usage:
 * ```js
 * module.exports.handler = withMiddleware('myFunction', async (event, context) => {
 *   // handler logic
 *   return { statusCode: 200, body: '...' };
 * });
 * ```
 *
 * @param {string}   functionName - Name for logging
 * @param {Function} handler      - Actual handler function
 * @param {Object}   [options]
 * @param {boolean}  [options.enableTimeoutGuard=true]
 * @returns {Function} Wrapped Lambda handler
 */
const withMiddleware = (functionName, handler, options = {}) => {
  const { enableTimeoutGuard = true } = options;

  return async (event, context) => {
    const start = Date.now();
    const wasColdStart = trackColdStart(functionName);
    const correlationId = extractCorrelationId(event, context);

    // Attach to process-level for downstream logger access
    process.env._CORRELATION_ID = correlationId;

    // ── Warm-up short-circuit ───────────────────────────
    if (isWarmupEvent(event)) {
      logger.debug('Warm-up event received', { functionName });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Warm', functionName }),
      };
    }

    logger.info('Lambda invocation started', {
      functionName,
      correlationId,
      coldStart: wasColdStart,
      httpMethod: event.httpMethod || event.requestContext?.http?.method,
      path: event.path || event.rawPath,
      remainingTime: context?.getRemainingTimeInMillis?.(),
    });

    try {
      let result;

      if (enableTimeoutGuard && context?.getRemainingTimeInMillis) {
        result = await Promise.race([
          handler(event, context),
          createTimeoutGuard(context),
        ]);
      } else {
        result = await handler(event, context);
      }

      const duration = Date.now() - start;
      logger.info('Lambda invocation completed', {
        functionName,
        correlationId,
        duration,
        statusCode: result?.statusCode,
      });

      // Ensure correlation ID header is on every response
      if (result && typeof result === 'object' && result.statusCode) {
        result.headers = {
          ...(result.headers || {}),
          'X-Correlation-Id': correlationId,
        };
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Lambda invocation failed', {
        functionName,
        correlationId,
        duration,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });

      return buildErrorResponse(error, correlationId);
    }
  };
};

// ─── Exports ────────────────────────────────────────────

module.exports = {
  withMiddleware,
  trackColdStart,
  isWarmupEvent,
  extractCorrelationId,
  buildErrorResponse,
  createTimeoutGuard,
};
