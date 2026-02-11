/**
 * Request Logging Middleware
 * University of Ilorin Carpooling Platform
 *
 * Provides structured HTTP request/response logging with:
 *  - Correlation ID generation & propagation
 *  - Request duration tracking
 *  - PII masking for sensitive fields
 *  - Body size limiting (avoids logging huge payloads)
 *  - Configurable log levels per status-code range
 *
 * Designed to work with CloudWatch and the project's Winston logger.
 *
 * @module middlewares/logging
 */

const { randomUUID } = require('crypto');
const { logger } = require('../../shared/utils/logger');

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const LOGGING_CONFIG = {
  /** HTTP header used for correlation ID propagation. */
  correlationIdHeader: 'x-correlation-id',

  /** Maximum characters of a request/response body to log. */
  maxBodyLength: 2048,

  /** Fields whose values must never appear in logs. */
  sensitiveFields: new Set([
    'password',
    'newPassword',
    'currentPassword',
    'confirmPassword',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'secret',
    'apiKey',
    'creditCard',
    'cardNumber',
    'cvv',
    'pin',
    'otp',
    'verificationCode',
  ]),

  /** Headers to redact. */
  sensitiveHeaders: new Set(['authorization', 'cookie', 'x-api-key']),

  /** Paths to skip logging entirely (e.g., health checks). */
  skipPaths: new Set(['/api/v1/health', '/api/v1/status', '/favicon.ico']),

  /** Paths with reduced (warn-only) logging to cut noise. */
  quietPaths: new Set(['/api/v1/health']),
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Deep-clone an object while replacing sensitive field values with '[REDACTED]'.
 * Handles nested objects and arrays up to a configurable depth.
 *
 * @param {*} data
 * @param {number} [depth=5] – Max recursion depth
 * @returns {*}
 */
const maskSensitiveFields = (data, depth = 5) => {
  if (depth <= 0 || data == null) return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveFields(item, depth - 1));
  }

  if (typeof data === 'object') {
    return Object.entries(data).reduce((masked, [key, value]) => {
      if (LOGGING_CONFIG.sensitiveFields.has(key.toLowerCase())) {
        masked[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskSensitiveFields(value, depth - 1);
      } else {
        masked[key] = value;
      }
      return masked;
    }, {});
  }

  return data;
};

/**
 * Redact sensitive headers.
 * @param {Object} headers
 * @returns {Object}
 */
const sanitizeHeaders = (headers) => {
  if (!headers) return {};

  return Object.entries(headers).reduce((safe, [key, value]) => {
    safe[key] = LOGGING_CONFIG.sensitiveHeaders.has(key.toLowerCase()) ? '[REDACTED]' : value;
    return safe;
  }, {});
};

/**
 * Truncate a body for logging.
 * @param {*} body
 * @returns {*}
 */
const truncateBody = (body) => {
  if (!body) return undefined;

  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  if (serialized.length <= LOGGING_CONFIG.maxBodyLength) {
    return typeof body === 'string' ? body : maskSensitiveFields(body);
  }

  return `[TRUNCATED – ${serialized.length} chars]`;
};

/**
 * Choose a log level based on the HTTP status code.
 * @param {number} statusCode
 * @returns {'error'|'warn'|'info'}
 */
const levelForStatus = (statusCode) => {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
};

/**
 * Get the client's real IP (respecting proxies).
 * @param {import('express').Request} req
 * @returns {string}
 */
const getClientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  'unknown';

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

/**
 * Main logging middleware.
 *
 * Usage (should be one of the first middlewares):
 *   app.use(requestLogger());
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.logBody=true]      – Log request & response bodies.
 * @param {boolean} [opts.logHeaders=false]   – Log request headers.
 * @param {Set<string>} [opts.skipPaths]     – Extra paths to skip.
 * @returns {Function} Express middleware
 */
const requestLogger = (opts = {}) => {
  const { logBody = true, logHeaders = false, skipPaths = new Set() } = opts;

  const allSkip = new Set([...LOGGING_CONFIG.skipPaths, ...skipPaths]);

  return (req, res, next) => {
    // Skip paths that don't need logging
    if (allSkip.has(req.path)) {
      return next();
    }

    // ── 1. Correlation ID ──────────────────
    const correlationId = req.headers[LOGGING_CONFIG.correlationIdHeader] || randomUUID();

    // Attach to request for downstream use
    req.correlationId = correlationId;

    // Echo it back in the response
    res.setHeader(LOGGING_CONFIG.correlationIdHeader, correlationId);

    // ── 2. Start timer ─────────────────────
    const startTime = process.hrtime.bigint();

    // ── 3. Log incoming request ────────────
    const requestMeta = {
      correlationId,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
      userId: req.user?.userId || null,
    };

    if (logHeaders) {
      requestMeta.headers = sanitizeHeaders(req.headers);
    }

    if (logBody && req.body && Object.keys(req.body).length > 0) {
      requestMeta.body = truncateBody(req.body);
    }

    logger.info('Incoming request', requestMeta);

    // ── 4. Capture the response ────────────
    //  We monkey-patch res.json to capture the body before it's sent.
    const originalJson = res.json.bind(res);
    let responseBody;

    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    // ── 5. Log on response finish ──────────
    res.on('finish', () => {
      const durationNs = Number(process.hrtime.bigint() - startTime);
      const durationMs = Math.round(durationNs / 1e6);

      const { statusCode } = res;
      const level = levelForStatus(statusCode);

      const responseMeta = {
        correlationId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode,
        durationMs,
        contentLength: res.get('content-length') || 0,
        userId: req.user?.userId || null,
        ip: getClientIp(req),
      };

      // Only include response body for non-success or when debugging
      if (logBody && responseBody && statusCode >= 400) {
        responseMeta.responseBody = truncateBody(responseBody);
      }

      // Add performance warning for slow requests
      if (durationMs > 500) {
        responseMeta.slow = true;
        responseMeta.performanceWarning = `Request took ${durationMs}ms (threshold: 500ms)`;
      }

      logger[level]('Request completed', responseMeta);
    });

    return next();
  };
};

// ─────────────────────────────────────────────
// Correlation-ID-only middleware (lightweight alternative)
// ─────────────────────────────────────────────

/**
 * Minimal middleware that only ensures a correlation ID is present
 * without performing full request/response logging.
 *
 * Useful in Lambda handlers where CloudWatch already captures most info.
 */
const correlationId = (req, res, next) => {
  const id = req.headers[LOGGING_CONFIG.correlationIdHeader] || randomUUID();

  req.correlationId = id;
  res.setHeader(LOGGING_CONFIG.correlationIdHeader, id);

  next();
};

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {
  requestLogger,
  correlationId,

  // Helpers (exported for testing / reuse)
  maskSensitiveFields,
  sanitizeHeaders,
  truncateBody,
  levelForStatus,
  getClientIp,

  // Config (for test overrides)
  LOGGING_CONFIG,
};
