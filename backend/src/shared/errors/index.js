/**
 * Error Classes Index
 * University of Ilorin Carpooling Platform
 *
 * Central export for all custom error classes.
 */

const AppError = require('./AppError');
const ValidationError = require('./ValidationError');
const NotFoundError = require('./NotFoundError');
const UnauthorizedError = require('./UnauthorizedError');
const ForbiddenError = require('./ForbiddenError');
const ConflictError = require('./ConflictError');
const BadRequestError = require('./BadRequestError');

/**
 * Check if error is an operational error (expected, handled)
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Check if error is a specific type
 * @param {Error} error - Error to check
 * @param {string} code - Error code to check for
 * @returns {boolean}
 */
const hasErrorCode = (error, code) => error instanceof AppError && error.code === code;

/**
 * Get HTTP status code from error
 * @param {Error} error - Error to get status from
 * @param {number} defaultStatus - Default status if not AppError
 * @returns {number}
 */
const getStatusCode = (error, defaultStatus = 500) => {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return defaultStatus;
};

/**
 * Wrap unknown errors in AppError
 * @param {Error} error - Error to wrap
 * @returns {AppError}
 */
const wrapError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  return AppError.fromError(error);
};

/**
 * Create error from status code
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {AppError}
 */
const fromStatusCode = (statusCode, message, details = null) => {
  switch (statusCode) {
    case 400:
      return new BadRequestError(message, details);
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message, details);
    case 404:
      return new NotFoundError(message);
    case 409:
      return new ConflictError(message, details);
    case 422:
      return new ValidationError(message, details ? [details] : []);
    default:
      return new AppError(message, { statusCode, details });
  }
};

/**
 * Error codes enum for consistent error handling
 */
const ErrorCodes = {
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Service
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,

  // Helper functions
  isOperationalError,
  hasErrorCode,
  getStatusCode,
  wrapError,
  fromStatusCode,

  // Error codes
  ErrorCodes,
};
