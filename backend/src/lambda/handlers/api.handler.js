/**
 * API Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/api.handler.js
 *
 * Wraps the full Express application as a single Lambda function
 * behind API Gateway (REST or HTTP API).
 *
 * This is the primary entry point for ALL /api/v1/* traffic.
 * Using the "monolith Lambda" approach for MVP simplicity:
 *   - Single deployment artifact
 *   - Shared middleware stack
 *   - Easy local ↔ Lambda parity (same app.js)
 *   - Lower cold-start surface (one function to keep warm)
 *
 * Later, high-traffic routes (e.g. ride search) can be split
 * into dedicated handlers for independent scaling.
 *
 * Supports:
 *   - API Gateway REST API (v1 proxy integration)
 *   - API Gateway HTTP API (v2 payload format)
 *   - ALB target group integration
 *
 * @module lambda/handlers/api
 */


const serverless = require('serverless-http');
const app = require('../../app');
const { withMiddleware } = require('../middleware/lambdaMiddleware');
const { logger } = require('../../shared/utils/logger');

// ─── Connection Re-use ──────────────────────────────────
// Keep DynamoDB / Redis TCP connections alive across invocations

const { RedisClient } = require('../../infrastructure/cache');

// ─── Serverless-HTTP Options ────────────────────────────

const serverlessOptions = {
  /**
   * Transform the API Gateway request before Express sees it.
   * Useful for normalising headers or injecting context.
   */
  request: (request, event, context) => {
    // Expose Lambda context so downstream middleware can access it
    request.lambdaEvent = event;
    request.lambdaContext = context;

    // Propagate API Gateway request ID as correlation ID
    if (event.requestContext) {
      const requestId =
        event.requestContext.requestId ||          // REST API
        event.requestContext.requestId ||           // HTTP API v2
        context.awsRequestId;
      request.headers['x-correlation-id'] =
        request.headers['x-correlation-id'] || requestId;
    }
  },

  /**
   * Transform the Express response before it goes back to
   * API Gateway. Strip headers that APIGW doesn't forward.
   */
  response: (response) => {
    // API Gateway handles transfer-encoding itself
    delete response.headers['transfer-encoding'];
    // Ensure JSON content type
    if (!response.headers['content-type']) {
      response.headers['content-type'] = 'application/json';
    }
  },
};

// ─── Create Serverless Handler ──────────────────────────

const serverlessHandler = serverless(app, serverlessOptions);

// ─── Redis Initialisation (run once per cold start) ─────

let redisInitialized = false;

const ensureRedisConnected = async () => {
  if (redisInitialized) return;

  try {
    if (process.env.CACHE_ENABLED !== 'false' && process.env.REDIS_ENDPOINT) {
      await RedisClient.connect();
      logger.info('Redis connected (Lambda cold start)');
    }
  } catch (err) {
    // Non-fatal: app degrades gracefully without cache
    logger.warn('Redis connection failed – continuing without cache', {
      error: err.message,
    });
  }
  redisInitialized = true;
};

// ─── Exported Handler ───────────────────────────────────

/**
 * Main API handler.
 *
 * API Gateway routes ALL requests to this single function via
 * a catch-all proxy resource:
 *   ANY /api/v1/{proxy+} → this handler
 *
 * Express's own router then dispatches to the correct
 * controller/service.
 */
module.exports.handler = withMiddleware(
  'api-handler',
  async (event, context) => {
    // Prevent Lambda from waiting for event loop to drain
    // (keeps Redis / DynamoDB connections alive for re-use)
    context.callbackWaitsForEmptyEventLoop = false;

    // Ensure Redis is connected on cold start
    await ensureRedisConnected();

    // Delegate to Express via serverless-http
    return serverlessHandler(event, context);
  },
  { enableTimeoutGuard: true }
);
