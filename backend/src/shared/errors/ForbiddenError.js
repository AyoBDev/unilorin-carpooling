/**
 * Forbidden Error
 * University of Ilorin Carpooling Platform
 *
 * Error class for authorization failures (authenticated but not permitted).
 * HTTP Status: 403
 */

const AppError = require('./AppError');

/**
 * ForbiddenError - When user is authenticated but lacks permission
 * @extends AppError
 */
class ForbiddenError extends AppError {
  /**
   * Create a ForbiddenError
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  constructor(message = 'You do not have permission to perform this action', details = null) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      details,
    });
  }

  /**
   * Create for insufficient permissions
   * @param {string} action - Action attempted
   * @param {string} resource - Resource type
   * @returns {ForbiddenError}
   */
  static insufficientPermissions(action, resource) {
    return new ForbiddenError(`You do not have permission to ${action} this ${resource}`, {
      action,
      resource,
    });
  }

  /**
   * Create for role-based access denial
   * @param {string} requiredRole - Required role
   * @returns {ForbiddenError}
   */
  static roleRequired(requiredRole) {
    return new ForbiddenError(`This action requires ${requiredRole} role`, { requiredRole });
  }

  /**
   * Create for driver-only access
   * @returns {ForbiddenError}
   */
  static driverOnly() {
    return new ForbiddenError('This action is only available to verified drivers', {
      requiredRole: 'driver',
    });
  }

  /**
   * Create for admin-only access
   * @returns {ForbiddenError}
   */
  static adminOnly() {
    return new ForbiddenError('This action requires administrator privileges', {
      requiredRole: 'admin',
    });
  }

  /**
   * Create for resource ownership violation
   * @param {string} resource - Resource type
   * @returns {ForbiddenError}
   */
  static notOwner(resource = 'resource') {
    return new ForbiddenError(`You can only modify your own ${resource}`, { reason: 'NOT_OWNER' });
  }

  /**
   * Create for unverified driver
   * @returns {ForbiddenError}
   */
  static driverNotVerified() {
    return new ForbiddenError('Your driver account is pending verification', {
      reason: 'DRIVER_NOT_VERIFIED',
    });
  }

  /**
   * Create for driver verification rejected
   * @param {string} reason - Rejection reason
   * @returns {ForbiddenError}
   */
  static driverRejected(reason) {
    return new ForbiddenError('Your driver verification was rejected', {
      reason: 'DRIVER_REJECTED',
      rejectionReason: reason,
    });
  }

  /**
   * Create for account status restriction
   * @param {string} status - Current account status
   * @returns {ForbiddenError}
   */
  static accountStatus(status) {
    const messages = {
      suspended: 'Your account is suspended',
      banned: 'Your account has been banned',
      pending: 'Your account is pending approval',
      inactive: 'Your account is inactive',
    };

    return new ForbiddenError(
      messages[status] || `Your account status (${status}) does not allow this action`,
      { accountStatus: status },
    );
  }

  /**
   * Create for booking own ride
   * @returns {ForbiddenError}
   */
  static cannotBookOwnRide() {
    return new ForbiddenError('You cannot book your own ride', { reason: 'SELF_BOOKING' });
  }

  /**
   * Create for action not allowed in current state
   * @param {string} action - Action attempted
   * @param {string} currentState - Current state
   * @returns {ForbiddenError}
   */
  static invalidState(action, currentState) {
    return new ForbiddenError(`Cannot ${action} when status is ${currentState}`, {
      action,
      currentState,
    });
  }

  /**
   * Create for time-based restriction
   * @param {string} message - Custom message
   * @returns {ForbiddenError}
   */
  static timeRestriction(message) {
    return new ForbiddenError(message, { reason: 'TIME_RESTRICTION' });
  }

  /**
   * Create for IP restriction
   * @returns {ForbiddenError}
   */
  static ipRestricted() {
    return new ForbiddenError('Access from your location is restricted', {
      reason: 'IP_RESTRICTED',
    });
  }

  /**
   * Create for terms not accepted
   * @returns {ForbiddenError}
   */
  static termsNotAccepted() {
    return new ForbiddenError('You must accept the terms of service to continue', {
      reason: 'TERMS_NOT_ACCEPTED',
    });
  }
}

module.exports = ForbiddenError;
