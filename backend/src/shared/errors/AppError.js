/**
 * Base Application Error
 * University of Ilorin Carpooling Platform
 *
 * Base class for all custom application errors.
 * Provides consistent error structure and serialization.
 */

/**
 * AppError - Base error class for the application
 * @extends Error
 */
class AppError extends Error {
  /**
   * Create an AppError
   * @param {string} message - Human-readable error message
   * @param {Object} options - Error options
   * @param {string} options.code - Error code (e.g., 'USER_NOT_FOUND')
   * @param {number} options.statusCode - HTTP status code
   * @param {Object} options.details - Additional error details
   * @param {boolean} options.isOperational - Whether this is an operational error
   */
  constructor(message, options = {}) {
    super(message);

    const {
      code = 'INTERNAL_ERROR',
      statusCode = 500,
      details = null,
      isOperational = true,
    } = options;

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Capture stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Check if error is operational (expected) vs programming error
   * @returns {boolean}
   */
  get isOperationalError() {
    return this.isOperational;
  }

  /**
   * Convert error to JSON for API responses
   * @param {boolean} includeStack - Whether to include stack trace
   * @returns {Object} JSON representation
   */
  toJSON(includeStack = false) {
    const json = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
      },
      timestamp: this.timestamp,
    };

    if (this.details) {
      json.error.details = this.details;
    }

    if (includeStack && this.stack) {
      json.error.stack = this.stack;
    }

    return json;
  }

  /**
   * Convert error to string
   * @returns {string}
   */
  toString() {
    return `${this.name} [${this.code}]: ${this.message}`;
  }

  /**
   * Create error from another error
   * @param {Error} error - Original error
   * @param {Object} options - Additional options
   * @returns {AppError}
   */
  static fromError(error, options = {}) {
    if (error instanceof AppError) {
      return error;
    }

    return new AppError(error.message, {
      code: options.code || 'INTERNAL_ERROR',
      statusCode: options.statusCode || 500,
      details: {
        originalError: error.name,
        ...(options.details || {}),
      },
      isOperational: false,
    });
  }

  /**
   * Create error for common scenarios
   */
  static badRequest(message, details = null) {
    return new AppError(message, {
      code: 'BAD_REQUEST',
      statusCode: 400,
      details,
    });
  }

  static unauthorized(message = 'Unauthorized access', details = null) {
    return new AppError(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      details,
    });
  }

  static forbidden(message = 'Access forbidden', details = null) {
    return new AppError(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      details,
    });
  }

  static notFound(resource = 'Resource', details = null) {
    return new AppError(`${resource} not found`, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details,
    });
  }

  static conflict(message, details = null) {
    return new AppError(message, {
      code: 'CONFLICT',
      statusCode: 409,
      details,
    });
  }

  static validationError(message = 'Validation failed', details = null) {
    return new AppError(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      details,
    });
  }

  static tooManyRequests(message = 'Too many requests', retryAfter = 60) {
    return new AppError(message, {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: { retryAfter },
    });
  }

  static internal(message = 'Internal server error', details = null) {
    return new AppError(message, {
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      details,
      isOperational: false,
    });
  }

  static serviceUnavailable(message = 'Service unavailable', details = null) {
    return new AppError(message, {
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
      details,
    });
  }
}

module.exports = AppError;
