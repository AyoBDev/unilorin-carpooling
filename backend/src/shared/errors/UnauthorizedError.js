/**
 * Unauthorized Error
 * University of Ilorin Carpooling Platform
 *
 * Error class for authentication failures.
 * HTTP Status: 401
 */

const AppError = require('./AppError');

/**
 * UnauthorizedError - When authentication is required but missing or invalid
 * @extends AppError
 */
class UnauthorizedError extends AppError {
  /**
   * Create an UnauthorizedError
   * @param {string} message - Error message
   * @param {string} reason - Specific reason for unauthorized
   */
  constructor(message = 'Authentication required', reason = null) {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      details: reason ? { reason } : null,
    });

    this.reason = reason;
  }

  /**
   * Create for missing token
   * @returns {UnauthorizedError}
   */
  static missingToken() {
    return new UnauthorizedError('Authentication token is required', 'MISSING_TOKEN');
  }

  /**
   * Create for invalid token
   * @returns {UnauthorizedError}
   */
  static invalidToken() {
    return new UnauthorizedError('Invalid authentication token', 'INVALID_TOKEN');
  }

  /**
   * Create for expired token
   * @returns {UnauthorizedError}
   */
  static expiredToken() {
    return new UnauthorizedError('Authentication token has expired', 'EXPIRED_TOKEN');
  }

  /**
   * Create for invalid credentials
   * @returns {UnauthorizedError}
   */
  static invalidCredentials() {
    return new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  /**
   * Create for account not verified
   * @returns {UnauthorizedError}
   */
  static accountNotVerified() {
    return new UnauthorizedError(
      'Please verify your email address to continue',
      'ACCOUNT_NOT_VERIFIED',
    );
  }

  /**
   * Create for account suspended
   * @returns {UnauthorizedError}
   */
  static accountSuspended() {
    return new UnauthorizedError('Your account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  /**
   * Create for account banned
   * @returns {UnauthorizedError}
   */
  static accountBanned() {
    return new UnauthorizedError('Your account has been banned', 'ACCOUNT_BANNED');
  }

  /**
   * Create for session expired
   * @returns {UnauthorizedError}
   */
  static sessionExpired() {
    return new UnauthorizedError(
      'Your session has expired. Please log in again',
      'SESSION_EXPIRED',
    );
  }

  /**
   * Create for invalid refresh token
   * @returns {UnauthorizedError}
   */
  static invalidRefreshToken() {
    return new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  /**
   * Create for token revoked
   * @returns {UnauthorizedError}
   */
  static tokenRevoked() {
    return new UnauthorizedError('Authentication token has been revoked', 'TOKEN_REVOKED');
  }

  /**
   * Create for required re-authentication
   * @param {string} reason - Reason for requiring re-auth
   * @returns {UnauthorizedError}
   */
  static requiresReauth(reason = 'This action requires recent authentication') {
    return new UnauthorizedError(reason, 'REQUIRES_REAUTH');
  }

  /**
   * Create for invalid API key
   * @returns {UnauthorizedError}
   */
  static invalidApiKey() {
    return new UnauthorizedError('Invalid API key', 'INVALID_API_KEY');
  }

  /**
   * Create for missing API key
   * @returns {UnauthorizedError}
   */
  static missingApiKey() {
    return new UnauthorizedError('API key is required', 'MISSING_API_KEY');
  }

  /**
   * Create for wrong password (during password change)
   * @returns {UnauthorizedError}
   */
  static wrongPassword() {
    return new UnauthorizedError('Current password is incorrect', 'WRONG_PASSWORD');
  }

  /**
   * Check if error is due to expired token
   * @returns {boolean}
   */
  isTokenExpired() {
    return this.reason === 'EXPIRED_TOKEN' || this.reason === 'SESSION_EXPIRED';
  }

  /**
   * Check if error requires user to re-login
   * @returns {boolean}
   */
  requiresLogin() {
    return [
      'INVALID_TOKEN',
      'EXPIRED_TOKEN',
      'SESSION_EXPIRED',
      'TOKEN_REVOKED',
      'INVALID_REFRESH_TOKEN',
      'ACCOUNT_SUSPENDED',
      'ACCOUNT_BANNED',
    ].includes(this.reason);
  }
}

module.exports = UnauthorizedError;
