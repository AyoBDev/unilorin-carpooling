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
 *
 * Supports two calling conventions:
 *   new NotFoundError('User not found', 'USER_NOT_FOUND')  – message + error code
 *   NotFoundError.user(userId)                              – static factory
 */
class NotFoundError extends AppError {
  /**
   * Create a NotFoundError
   * @param {string} message - Human-readable error message
   * @param {string} code - Error code (e.g., 'USER_NOT_FOUND')
   */
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, {
      code,
      statusCode: 404,
    });
  }

  /**
   * Create for user not found
   * @param {string} identifier - User ID or email
   * @returns {NotFoundError}
   */
  static user(identifier = null) {
    const msg = identifier
      ? `User with ID '${identifier}' not found`
      : 'User not found';
    return new NotFoundError(msg, 'USER_NOT_FOUND');
  }

  /**
   * Create for ride not found
   * @param {string} identifier - Ride ID
   * @returns {NotFoundError}
   */
  static ride(identifier = null) {
    const msg = identifier
      ? `Ride with ID '${identifier}' not found`
      : 'Ride not found';
    return new NotFoundError(msg, 'RIDE_NOT_FOUND');
  }

  /**
   * Create for booking not found
   * @param {string} identifier - Booking ID
   * @returns {NotFoundError}
   */
  static booking(identifier = null) {
    const msg = identifier
      ? `Booking with ID '${identifier}' not found`
      : 'Booking not found';
    return new NotFoundError(msg, 'BOOKING_NOT_FOUND');
  }

  /**
   * Create for vehicle not found
   * @param {string} identifier - Vehicle ID
   * @returns {NotFoundError}
   */
  static vehicle(identifier = null) {
    const msg = identifier
      ? `Vehicle with ID '${identifier}' not found`
      : 'Vehicle not found';
    return new NotFoundError(msg, 'VEHICLE_NOT_FOUND');
  }

  /**
   * Create for driver not found
   * @param {string} identifier - Driver/User ID
   * @returns {NotFoundError}
   */
  static driver(identifier = null) {
    const msg = identifier
      ? `Driver with ID '${identifier}' not found`
      : 'Driver not found';
    return new NotFoundError(msg, 'DRIVER_NOT_FOUND');
  }

  /**
   * Create for notification not found
   * @param {string} identifier - Notification ID
   * @returns {NotFoundError}
   */
  static notification(identifier = null) {
    const msg = identifier
      ? `Notification with ID '${identifier}' not found`
      : 'Notification not found';
    return new NotFoundError(msg, 'NOTIFICATION_NOT_FOUND');
  }

  /**
   * Create for rating not found
   * @param {string} identifier - Rating ID
   * @returns {NotFoundError}
   */
  static rating(identifier = null) {
    const msg = identifier
      ? `Rating with ID '${identifier}' not found`
      : 'Rating not found';
    return new NotFoundError(msg, 'RATING_NOT_FOUND');
  }

  /**
   * Create for pickup point not found
   * @param {string} identifier - Pickup point ID
   * @returns {NotFoundError}
   */
  static pickupPoint(identifier = null) {
    const msg = identifier
      ? `Pickup point with ID '${identifier}' not found`
      : 'Pickup point not found';
    return new NotFoundError(msg, 'PICKUP_POINT_NOT_FOUND');
  }

  /**
   * Create for route not found
   * @param {string} identifier - Route ID
   * @returns {NotFoundError}
   */
  static route(identifier = null) {
    const msg = identifier
      ? `Route with ID '${identifier}' not found`
      : 'Route not found';
    return new NotFoundError(msg, 'ROUTE_NOT_FOUND');
  }

  /**
   * Create for API endpoint not found
   * @param {string} path - Request path
   * @returns {NotFoundError}
   */
  static endpoint(path) {
    return new NotFoundError(
      `The requested endpoint '${path}' does not exist`,
      'ENDPOINT_NOT_FOUND',
    );
  }

  /**
   * Create for emergency contact not found
   * @param {string} identifier - Contact ID
   * @returns {NotFoundError}
   */
  static emergencyContact(identifier = null) {
    const msg = identifier
      ? `Emergency contact with ID '${identifier}' not found`
      : 'Emergency contact not found';
    return new NotFoundError(msg, 'EMERGENCY_CONTACT_NOT_FOUND');
  }
}

module.exports = NotFoundError;
