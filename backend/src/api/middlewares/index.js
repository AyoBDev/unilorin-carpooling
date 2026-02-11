/**
 * Middleware Index
 * University of Ilorin Carpooling Platform
 *
 * Central export for all Express middlewares.
 *
 * Usage:
 *   const {
 *     authenticate, authorize, requireDriver,
 *     validate, validateBody,
 *     rateLimiter, loginLimiter,
 *     requestLogger,
 *     errorHandler, notFoundHandler,
 *   } = require('./middlewares');
 *
 * @module middlewares
 */

// ── Authentication & Authorization ─────────
const {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireDriver,
  requireVerified,
  requireOwnerOrAdmin,
  requireAdmin,
  AUTH_CONFIG,
} = require('./auth.middleware');

// ── Validation ─────────────────────────────
const {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  sanitizeBody,
  stripHtmlFromBody,
  Joi,
} = require('./validation.middleware');

// ── Rate Limiting ──────────────────────────
const {
  rateLimiter,
  apiLimiter,
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
  otpLimiter,
  bookingLimiter,
  sosLimiter,
  searchLimiter,
} = require('./rateLimiter.middleware');

// ── Logging ────────────────────────────────
const { requestLogger, correlationId } = require('./logging.middleware');

// ── Error Handling ─────────────────────────
const {
  errorHandler,
  notFoundHandler,
  registerProcessErrorHandlers,
} = require('./error.middleware');

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {
  // Auth
  authenticate,
  optionalAuthenticate,
  authorize,
  requireDriver,
  requireVerified,
  requireOwnerOrAdmin,
  requireAdmin,
  AUTH_CONFIG,

  // Validation
  validate,
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
  sanitizeBody,
  stripHtmlFromBody,
  Joi,

  // Rate limiting
  rateLimiter,
  apiLimiter,
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
  otpLimiter,
  bookingLimiter,
  sosLimiter,
  searchLimiter,

  // Logging
  requestLogger,
  correlationId,

  // Error handling
  errorHandler,
  notFoundHandler,
  registerProcessErrorHandlers,
};
