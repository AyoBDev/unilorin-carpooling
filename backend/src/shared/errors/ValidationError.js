/**
 * Validation Error
 * University of Ilorin Carpooling Platform
 *
 * Error class for request validation failures.
 * Includes field-level error details.
 */

const AppError = require('./AppError');

/**
 * ValidationError - For input validation failures
 * @extends AppError
 */
class ValidationError extends AppError {
  /**
   * Create a ValidationError
   * @param {string} message - Error message
   * @param {Array} errors - Array of validation errors
   */
  constructor(message = 'Validation failed', errors = []) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      details: {
        errors: ValidationError.formatErrors(errors),
      },
    });

    this.errors = errors;
  }

  /**
   * Format validation errors for consistent output
   * @param {Array} errors - Raw errors
   * @returns {Array} Formatted errors
   */
  static formatErrors(errors) {
    if (!Array.isArray(errors)) {
      return [];
    }

    return errors.map((err) => {
      // Handle Joi error format
      if (err.path && err.message) {
        return {
          field: Array.isArray(err.path) ? err.path.join('.') : err.path,
          message: err.message.replace(/"/g, ''),
          type: err.type || 'validation',
          value: err.context?.value,
        };
      }

      // Handle simple object format
      if (err.field && err.message) {
        return {
          field: err.field,
          message: err.message,
          type: err.type || 'validation',
        };
      }

      // Handle string format
      if (typeof err === 'string') {
        return {
          field: 'unknown',
          message: err,
          type: 'validation',
        };
      }

      return err;
    });
  }

  /**
   * Create from Joi validation result
   * @param {Object} joiError - Joi validation error
   * @returns {ValidationError}
   */
  static fromJoi(joiError) {
    const errors = joiError.details || [];
    return new ValidationError('Validation failed', errors);
  }

  /**
   * Create for a single field error
   * @param {string} field - Field name
   * @param {string} message - Error message
   * @param {string} type - Error type
   * @returns {ValidationError}
   */
  static forField(field, message, type = 'invalid') {
    return new ValidationError('Validation failed', [{ field, message, type }]);
  }

  /**
   * Create for required field
   * @param {string} field - Field name
   * @returns {ValidationError}
   */
  static required(field) {
    return ValidationError.forField(field, `${field} is required`, 'required');
  }

  /**
   * Create for invalid format
   * @param {string} field - Field name
   * @param {string} format - Expected format
   * @returns {ValidationError}
   */
  static invalidFormat(field, format) {
    return ValidationError.forField(field, `${field} must be in ${format} format`, 'format');
  }

  /**
   * Create for invalid email
   * @returns {ValidationError}
   */
  static invalidEmail() {
    return ValidationError.forField('email', 'Please provide a valid email address', 'email');
  }

  /**
   * Create for invalid phone number
   * @returns {ValidationError}
   */
  static invalidPhone() {
    return ValidationError.forField(
      'phone',
      'Please provide a valid Nigerian phone number',
      'phone',
    );
  }

  /**
   * Create for invalid matric number
   * @returns {ValidationError}
   */
  static invalidMatricNumber() {
    return ValidationError.forField(
      'matricNumber',
      'Invalid matric number format (e.g., 19/52HP029)',
      'matricNumber',
    );
  }

  /**
   * Create for weak password
   * @returns {ValidationError}
   */
  static weakPassword() {
    return ValidationError.forField(
      'password',
      'Password must be at least 8 characters with uppercase, lowercase, and number',
      'password',
    );
  }

  /**
   * Create for password mismatch
   * @returns {ValidationError}
   */
  static passwordMismatch() {
    return ValidationError.forField('confirmPassword', 'Passwords do not match', 'mismatch');
  }

  /**
   * Create for value out of range
   * @param {string} field - Field name
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {ValidationError}
   */
  static outOfRange(field, min, max) {
    return ValidationError.forField(field, `${field} must be between ${min} and ${max}`, 'range');
  }

  /**
   * Create for multiple field errors
   * @param {Object} fieldErrors - Object of field -> message
   * @returns {ValidationError}
   */
  static multiple(fieldErrors) {
    const errors = Object.entries(fieldErrors).map(([field, message]) => ({
      field,
      message,
      type: 'validation',
    }));

    return new ValidationError('Validation failed', errors);
  }

  /**
   * Check if this error contains a specific field error
   * @param {string} field - Field name to check
   * @returns {boolean}
   */
  hasFieldError(field) {
    return this.errors.some(
      (err) =>
        (err.path && (err.path.includes(field) || err.path.join('.') === field)) ||
        err.field === field,
    );
  }

  /**
   * Get error message for specific field
   * @param {string} field - Field name
   * @returns {string|null}
   */
  getFieldError(field) {
    const error = this.errors.find(
      (err) =>
        (err.path && (err.path.includes(field) || err.path.join('.') === field)) ||
        err.field === field,
    );

    return error?.message || null;
  }

  /**
   * Get all field names with errors
   * @returns {Array<string>}
   */
  getErrorFields() {
    return this.details.errors.map((err) => err.field);
  }
}

module.exports = ValidationError;
