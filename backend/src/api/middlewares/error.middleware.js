/**
 * Centralized Error Handling Middleware
 * University of Ilorin Carpooling Platform
 *
 * Catches every error that propagates through Express, maps it to a
 * consistent API error response, and logs it with full context.
 *
 * Handles:
 *  - Custom AppError subclasses (ValidationError, NotFoundError, etc.)
 *  - Joi validation errors
 *  - JWT errors (JsonWebTokenError, TokenExpiredError)
 *  - SyntaxError from malformed JSON bodies
 *  - Multer (file upload) errors
 *  - Generic / unexpected errors
 *
 * MUST be registered **after** all routes:
 *   app.use(errorHandler);
 *
 * @module middlewares/error
 */

const { AppError } = require('../../shared/errors/AppError');
const { logger } = require('../../shared/utils/logger');

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const isDev = () => process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────
// Response builder
// ─────────────────────────────────────────────

/**
 * Build the JSON body for an error response.
 *
 * @param {Object} opts
 * @param {string}  opts.code       – Machine-readable error code.
 * @param {string}  opts.message    – Human-readable message.
 * @param {number}  opts.statusCode – HTTP status code.
 * @param {*}       [opts.details]  – Extra details (field errors, etc.).
 * @param {string}  [opts.stack]    – Stack trace (dev only).
 * @returns {Object}
 */
const buildErrorResponse = ({ code, message, statusCode, details, stack }) => {
  const body = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: new Date().toISOString(),
  };

  if (details) {
    body.error.details = details;
  }

  // Expose stack trace only in development
  if (stack && isDev()) {
    body.error.stack = stack;
  }

  return { statusCode, body };
};

// ─────────────────────────────────────────────
// Error-type handlers
// ─────────────────────────────────────────────

/**
 * Handle our custom AppError hierarchy.
 */
const handleAppError = (err) =>
  buildErrorResponse({
    code: err.errorCode || err.code || 'APP_ERROR',
    message: err.message,
    statusCode: err.statusCode || 500,
    details: err.errors || err.details || err.data || null,
    stack: err.stack,
  });

/**
 * Handle Joi validation errors (thrown outside our validation middleware).
 */
const handleJoiError = (err) => {
  const fields = (err.details || []).map((d) => ({
    field: d.path.join('.'),
    message: d.message,
    type: d.type,
  }));

  return buildErrorResponse({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    statusCode: 400,
    details: fields,
    stack: err.stack,
  });
};

/**
 * Handle JWT verification failures.
 */
const handleJwtError = (err) => {
  const mapping = {
    JsonWebTokenError: {
      code: 'AUTH_TOKEN_INVALID',
      message: 'Invalid authentication token.',
      statusCode: 401,
    },
    TokenExpiredError: {
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Authentication token has expired. Please log in again.',
      statusCode: 401,
    },
    NotBeforeError: {
      code: 'AUTH_TOKEN_NOT_ACTIVE',
      message: 'Token is not yet active.',
      statusCode: 401,
    },
  };

  const info = mapping[err.name] || mapping.JsonWebTokenError;

  return buildErrorResponse({
    ...info,
    stack: err.stack,
  });
};

/**
 * Handle malformed JSON in request body.
 */
const handleSyntaxError = (err) =>
  buildErrorResponse({
    code: 'INVALID_JSON',
    message: 'The request body contains invalid JSON.',
    statusCode: 400,
    details: isDev() ? err.message : undefined,
    stack: err.stack,
  });

/**
 * Handle Multer file-upload errors.
 */
const handleMulterError = (err) => {
  const messages = {
    LIMIT_FILE_SIZE: 'File size exceeds the maximum allowed limit.',
    LIMIT_FILE_COUNT: 'Too many files uploaded.',
    LIMIT_FIELD_KEY: 'Field name is too long.',
    LIMIT_FIELD_VALUE: 'Field value is too long.',
    LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
  };

  return buildErrorResponse({
    code: `UPLOAD_${err.code || 'ERROR'}`,
    message: messages[err.code] || 'File upload failed.',
    statusCode: 400,
    stack: err.stack,
  });
};

/**
 * Handle DynamoDB / AWS SDK errors.
 */
const handleAwsError = (err) => {
  // Throttling
  if (err.code === 'ProvisionedThroughputExceededException' || err.code === 'ThrottlingException') {
    return buildErrorResponse({
      code: 'SERVICE_THROTTLED',
      message: 'The service is experiencing high load. Please retry shortly.',
      statusCode: 503,
      stack: err.stack,
    });
  }

  // Condition check failed (optimistic concurrency)
  if (err.code === 'ConditionalCheckFailedException') {
    return buildErrorResponse({
      code: 'CONFLICT',
      message: 'The resource has been modified by another request. Please retry.',
      statusCode: 409,
      stack: err.stack,
    });
  }

  return null; // Not an AWS error we recognise – fall through
};

/**
 * Catch-all for unexpected errors.
 */
const handleGenericError = (err) =>
  buildErrorResponse({
    code: 'INTERNAL_ERROR',
    message: isDev() ? err.message : 'An unexpected error occurred. Please try again later.',
    statusCode: 500,
    stack: err.stack,
  });

// ─────────────────────────────────────────────
// Main error handler (Express 4 signature)
// ─────────────────────────────────────────────

/**
 * Express error-handling middleware.
 * Must have exactly four parameters so Express recognises it as an error handler.
 *
 * @param {Error} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // ── 1. Determine the right handler ───────
  let response;

  if (err.isOperational !== undefined || err.isAppError) {
    response = handleAppError(err);
  } else if (err.isJoi || err.name === 'ValidationError') {
    response = handleJoiError(err);
  } else if (
    err.name === 'JsonWebTokenError' ||
    err.name === 'TokenExpiredError' ||
    err.name === 'NotBeforeError'
  ) {
    response = handleJwtError(err);
   } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    response = handleSyntaxError(err);
  } else if (err.name === 'MulterError') {
    response = handleMulterError(err);
  } else {
    // Try AWS-specific handling first
    response = handleAwsError(err) || handleGenericError(err);
  }

  // ── 2. Log the error ────────────────────
  const logPayload = {
    correlationId: req.correlationId,
    errorCode: response.body.error.code,
    statusCode: response.statusCode,
    method: req.method,
    path: req.originalUrl || req.url,
    userId: req.user?.userId || null,
    ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  };

  if (response.statusCode >= 500) {
    logger.error('Unhandled server error', {
      ...logPayload,
      errorMessage: err.message,
      stack: err.stack,
    });
  } else if (response.statusCode >= 400) {
    logger.warn('Client error', {
      ...logPayload,
      errorMessage: err.message,
    });
  }

  // ── 3. Send the response ────────────────
  // Guard against double-send (headers already sent)
  if (res.headersSent) {
    logger.warn('Headers already sent – error not delivered to client', logPayload);
    return;
  }

  res.status(response.statusCode).json(response.body);
};

// ─────────────────────────────────────────────
// 404 Handler (for routes that don't match)
// ─────────────────────────────────────────────

/**
 * Catch-all for requests that don't match any route.
 * Should be registered **after** all routes but **before** errorHandler.
 *
 * Usage:
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 */
const notFoundHandler = (req, res, _next) => {
  const response = buildErrorResponse({
    code: 'ROUTE_NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl || req.url}`,
    statusCode: 404,
  });

  logger.debug('Route not found', {
    method: req.method,
    path: req.originalUrl || req.url,
    correlationId: req.correlationId,
  });

  res.status(response.statusCode).json(response.body);
};

// ─────────────────────────────────────────────
// Unhandled rejection / exception catchers
// ─────────────────────────────────────────────

/**
 * Register global process-level error handlers.
 * Call once during app bootstrap.
 */
const registerProcessErrorHandlers = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: String(promise),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception – process will exit', {
      errorMessage: error.message,
      stack: error.stack,
    });

    // Give logger time to flush, then exit
    setTimeout(() => process.exit(1), 1000);
  });
};

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {
  errorHandler,
  notFoundHandler,
  registerProcessErrorHandlers,

  // Exposed for testing
  buildErrorResponse,
  handleAppError,
  handleJoiError,
  handleJwtError,
  handleSyntaxError,
  handleMulterError,
  handleAwsError,
  handleGenericError,
};
