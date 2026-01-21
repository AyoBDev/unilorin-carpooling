/**
 * Bad Request Error
 * University of Ilorin Carpooling Platform
 *
 * Error class for malformed or invalid requests.
 * HTTP Status: 400
 */

const AppError = require('./AppError');

/**
 * BadRequestError - When request is malformed or invalid
 * @extends AppError
 */
class BadRequestError extends AppError {
  /**
   * Create a BadRequestError
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  constructor(message = 'Bad request', details = null) {
    super(message, {
      code: 'BAD_REQUEST',
      statusCode: 400,
      details,
    });
  }

  /**
   * Create for missing required field
   * @param {string} field - Field name
   * @returns {BadRequestError}
   */
  static missingField(field) {
    return new BadRequestError(`${field} is required`, { field, type: 'MISSING_FIELD' });
  }

  /**
   * Create for invalid field value
   * @param {string} field - Field name
   * @param {string} reason - Why it's invalid
   * @returns {BadRequestError}
   */
  static invalidField(field, reason = 'Invalid value') {
    return new BadRequestError(`${field}: ${reason}`, { field, type: 'INVALID_FIELD' });
  }

  /**
   * Create for invalid JSON body
   * @returns {BadRequestError}
   */
  static invalidJson() {
    return new BadRequestError('Invalid JSON in request body', { type: 'INVALID_JSON' });
  }

  /**
   * Create for invalid query parameter
   * @param {string} param - Parameter name
   * @param {string} reason - Why it's invalid
   * @returns {BadRequestError}
   */
  static invalidQueryParam(param, reason = 'Invalid value') {
    return new BadRequestError(`Invalid query parameter '${param}': ${reason}`, {
      param,
      type: 'INVALID_QUERY_PARAM',
    });
  }

  /**
   * Create for invalid path parameter
   * @param {string} param - Parameter name
   * @param {string} reason - Why it's invalid
   * @returns {BadRequestError}
   */
  static invalidPathParam(param, reason = 'Invalid format') {
    return new BadRequestError(`Invalid path parameter '${param}': ${reason}`, {
      param,
      type: 'INVALID_PATH_PARAM',
    });
  }

  /**
   * Create for invalid UUID
   * @param {string} field - Field name
   * @returns {BadRequestError}
   */
  static invalidUuid(field = 'id') {
    return new BadRequestError(`Invalid ${field} format. Expected UUID`, {
      field,
      type: 'INVALID_UUID',
    });
  }

  /**
   * Create for invalid date format
   * @param {string} field - Field name
   * @param {string} expectedFormat - Expected format
   * @returns {BadRequestError}
   */
  static invalidDate(field, expectedFormat = 'YYYY-MM-DD') {
    return new BadRequestError(`Invalid date format for ${field}. Expected ${expectedFormat}`, {
      field,
      expectedFormat,
      type: 'INVALID_DATE',
    });
  }

  /**
   * Create for invalid time format
   * @param {string} field - Field name
   * @returns {BadRequestError}
   */
  static invalidTime(field) {
    return new BadRequestError(`Invalid time format for ${field}. Expected HH:mm`, {
      field,
      type: 'INVALID_TIME',
    });
  }

  /**
   * Create for invalid coordinates
   * @returns {BadRequestError}
   */
  static invalidCoordinates() {
    return new BadRequestError(
      'Invalid coordinates. Latitude must be -90 to 90, longitude -180 to 180',
      { type: 'INVALID_COORDINATES' },
    );
  }

  /**
   * Create for value out of range
   * @param {string} field - Field name
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {BadRequestError}
   */
  static outOfRange(field, min, max) {
    return new BadRequestError(`${field} must be between ${min} and ${max}`, {
      field,
      min,
      max,
      type: 'OUT_OF_RANGE',
    });
  }

  /**
   * Create for departure time in past
   * @returns {BadRequestError}
   */
  static departureInPast() {
    return new BadRequestError('Departure time must be at least 30 minutes in the future', {
      type: 'DEPARTURE_IN_PAST',
    });
  }

  /**
   * Create for departure too far in future
   * @param {number} maxDays - Maximum days allowed
   * @returns {BadRequestError}
   */
  static departureTooFar(maxDays = 7) {
    return new BadRequestError(`Departure time must be within ${maxDays} days`, {
      type: 'DEPARTURE_TOO_FAR',
      maxDays,
    });
  }

  /**
   * Create for invalid file type
   * @param {string} fileType - Received file type
   * @param {Array<string>} allowedTypes - Allowed types
   * @returns {BadRequestError}
   */
  static invalidFileType(fileType, allowedTypes) {
    return new BadRequestError(
      `Invalid file type '${fileType}'. Allowed types: ${allowedTypes.join(', ')}`,
      { fileType, allowedTypes, type: 'INVALID_FILE_TYPE' },
    );
  }

  /**
   * Create for file too large
   * @param {number} size - File size in bytes
   * @param {number} maxSize - Maximum allowed size in bytes
   * @returns {BadRequestError}
   */
  static fileTooLarge(size, maxSize) {
    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    return new BadRequestError(
      `File size (${formatSize(size)}) exceeds maximum allowed size (${formatSize(maxSize)})`,
      { size, maxSize, type: 'FILE_TOO_LARGE' },
    );
  }

  /**
   * Create for missing file
   * @param {string} fieldName - File field name
   * @returns {BadRequestError}
   */
  static missingFile(fieldName = 'file') {
    return new BadRequestError(`No ${fieldName} uploaded`, {
      field: fieldName,
      type: 'MISSING_FILE',
    });
  }

  /**
   * Create for invalid content type
   * @param {string} contentType - Received content type
   * @param {string} expected - Expected content type
   * @returns {BadRequestError}
   */
  static invalidContentType(contentType, expected = 'application/json') {
    return new BadRequestError(`Invalid Content-Type '${contentType}'. Expected '${expected}'`, {
      contentType,
      expected,
      type: 'INVALID_CONTENT_TYPE',
    });
  }

  /**
   * Create for cancellation deadline passed
   * @returns {BadRequestError}
   */
  static cancellationDeadlinePassed() {
    return new BadRequestError('Cancellation deadline has passed (1 hour before departure)', {
      type: 'CANCELLATION_DEADLINE_PASSED',
    });
  }

  /**
   * Create for invalid verification code
   * @returns {BadRequestError}
   */
  static invalidVerificationCode() {
    return new BadRequestError('Invalid or expired verification code', {
      type: 'INVALID_VERIFICATION_CODE',
    });
  }

  /**
   * Create for invalid passenger code
   * @returns {BadRequestError}
   */
  static invalidPassengerCode() {
    return new BadRequestError('Invalid passenger verification code', {
      type: 'INVALID_PASSENGER_CODE',
    });
  }

  /**
   * Create for seats requested exceeds limit
   * @param {number} max - Maximum seats per booking
   * @returns {BadRequestError}
   */
  static tooManySeats(max = 4) {
    return new BadRequestError(`Cannot book more than ${max} seats at once`, {
      maxSeats: max,
      type: 'TOO_MANY_SEATS',
    });
  }

  /**
   * Create for operation not allowed
   * @param {string} operation - Operation attempted
   * @param {string} reason - Reason not allowed
   * @returns {BadRequestError}
   */
  static operationNotAllowed(operation, reason) {
    return new BadRequestError(`Operation '${operation}' is not allowed: ${reason}`, {
      operation,
      type: 'OPERATION_NOT_ALLOWED',
    });
  }
}

module.exports = BadRequestError;
