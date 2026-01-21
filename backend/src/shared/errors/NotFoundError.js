/**
 * Not Found Error
 * University of Ilorin Carpooling Platform
 *
 * Error class for resource not found scenarios.
 * HTTP Status: 404
 */

const AppError = require('./AppError');

/**
 * NotFoundError - When a requested resource doesn't exist
 * @extends AppError
 */
class NotFoundError extends AppError {
  /**
   * Create a NotFoundError
   * @param {string} resource - Name of the resource (e.g., 'User', 'Ride')
   * @param {string} identifier - Resource identifier (e.g., userId, rideId)
   */
  constructor(resource = 'Resource', identifier = null) {
    const message = identifier
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;

    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details: {
        resource,
        ...(identifier && { identifier }),
      },
    });

    this.resource = resource;
    this.identifier = identifier;
  }

  /**
   * Create for user not found
   * @param {string} identifier - User ID or email
   * @returns {NotFoundError}
   */
  static user(identifier = null) {
    return new NotFoundError('User', identifier);
  }

  /**
   * Create for ride not found
   * @param {string} identifier - Ride ID
   * @returns {NotFoundError}
   */
  static ride(identifier = null) {
    return new NotFoundError('Ride', identifier);
  }

  /**
   * Create for booking not found
   * @param {string} identifier - Booking ID
   * @returns {NotFoundError}
   */
  static booking(identifier = null) {
    return new NotFoundError('Booking', identifier);
  }

  /**
   * Create for vehicle not found
   * @param {string} identifier - Vehicle ID
   * @returns {NotFoundError}
   */
  static vehicle(identifier = null) {
    return new NotFoundError('Vehicle', identifier);
  }

  /**
   * Create for driver not found
   * @param {string} identifier - Driver/User ID
   * @returns {NotFoundError}
   */
  static driver(identifier = null) {
    return new NotFoundError('Driver', identifier);
  }

  /**
   * Create for notification not found
   * @param {string} identifier - Notification ID
   * @returns {NotFoundError}
   */
  static notification(identifier = null) {
    return new NotFoundError('Notification', identifier);
  }

  /**
   * Create for rating not found
   * @param {string} identifier - Rating ID
   * @returns {NotFoundError}
   */
  static rating(identifier = null) {
    return new NotFoundError('Rating', identifier);
  }

  /**
   * Create for pickup point not found
   * @param {string} identifier - Pickup point ID
   * @returns {NotFoundError}
   */
  static pickupPoint(identifier = null) {
    return new NotFoundError('Pickup point', identifier);
  }

  /**
   * Create for route not found
   * @param {string} identifier - Route ID
   * @returns {NotFoundError}
   */
  static route(identifier = null) {
    return new NotFoundError('Route', identifier);
  }

  /**
   * Create for API endpoint not found
   * @param {string} path - Request path
   * @returns {NotFoundError}
   */
  static endpoint(path) {
    const error = new NotFoundError('Endpoint', path);
    error.message = `The requested endpoint '${path}' does not exist`;
    error.code = 'ENDPOINT_NOT_FOUND';
    return error;
  }

  /**
   * Create for generic resource with custom message
   * @param {string} message - Custom message
   * @param {string} resource - Resource name
   * @returns {NotFoundError}
   */
  static custom(message, resource = 'Resource') {
    const error = new NotFoundError(resource);
    error.message = message;
    return error;
  }
}

module.exports = NotFoundError;
