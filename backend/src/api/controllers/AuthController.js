/**
 * Authentication Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles all authentication-related HTTP requests including
 * registration, login, email verification, password reset,
 * token refresh, OTP, and session management.
 *
 * Path: src/api/controllers/AuthController.js
 *
 * @module controllers/AuthController
 */

const { AuthService } = require('../../core/services');
const { success, created } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class AuthController {
  constructor() {
    this.authService = new AuthService();

    // Bind all methods to preserve `this` context in Express routes
    this.register = this.register.bind(this);
    this.login = this.login.bind(this);
    this.verifyEmail = this.verifyEmail.bind(this);
    this.resendVerification = this.resendVerification.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.changePassword = this.changePassword.bind(this);
    this.refreshToken = this.refreshToken.bind(this);
    this.logout = this.logout.bind(this);
    this.logoutAll = this.logoutAll.bind(this);
    this.getMe = this.getMe.bind(this);
    this.sendOTP = this.sendOTP.bind(this);
    this.verifyOTP = this.verifyOTP.bind(this);
    this.getSessions = this.getSessions.bind(this);
    this.revokeSession = this.revokeSession.bind(this);
  }

  /**
   * Register a new user
   * POST /api/v1/auth/register
   *
   * @param {Object} req - Express request
   * @param {Object} req.body - Registration data
   * @param {string} req.body.email - User email (university email preferred)
   * @param {string} req.body.password - Password (min 8 chars)
   * @param {string} req.body.firstName - First name
   * @param {string} req.body.lastName - Last name
   * @param {string} req.body.phone - Phone number (+234 format)
   * @param {string} req.body.role - 'student' or 'staff'
   * @param {string} [req.body.matricNumber] - Required for students
   * @param {string} [req.body.staffId] - Required for staff
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async register(req, res, next) {
    try {
      const result = await this.authService.register(req.body);

      logger.info('User registered successfully', {
        userId: result.user.userId,
        role: result.user.role,
      });

      return created(
        res,
        'Registration successful. Please check your email to verify your account.',
        {
          user: result.user,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: result.tokens.expiresIn,
          tokenType: result.tokens.tokenType,
        },
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   *
   * @param {Object} req - Express request
   * @param {string} req.body.email - User email
   * @param {string} req.body.password - User password
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Extract device info for session tracking
      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
      };

      const result = await this.authService.login(email, password, deviceInfo);

      logger.info('User logged in', { userId: result.user.userId });

      return success(res, 'Login successful', {
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        tokenType: result.tokens.tokenType,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify email address
   * POST /api/v1/auth/verify-email
   *
   * @param {Object} req - Express request
   * @param {string} req.body.token - Email verification token
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;

      const result = await this.authService.verifyEmail(token);

      logger.info('Email verified', { userId: result.userId });

      return success(res, 'Email verified successfully', {
        verified: true,
        userId: result.userId,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Resend email verification
   * POST /api/v1/auth/resend-verification
   *
   * @param {Object} req - Express request
   * @param {string} req.body.email - User email
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;

      await this.authService.resendVerificationEmail(email);

      return success(res, 'Verification email sent. Please check your inbox.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   *
   * @param {Object} req - Express request
   * @param {string} req.body.email - User email
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      await this.authService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      return success(
        res,
        'If an account exists with that email, a password reset link has been sent.',
      );
    } catch (error) {
      // Don't leak whether email exists
      return success(
        res,
        'If an account exists with that email, a password reset link has been sent.',
      );
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   *
   * @param {Object} req - Express request
   * @param {string} req.body.token - Password reset token
   * @param {string} req.body.newPassword - New password
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      await this.authService.resetPassword(token, newPassword);

      return success(res, 'Password reset successfully. Please login with your new password.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Change password (authenticated)
   * POST /api/v1/auth/change-password
   *
   * @param {Object} req - Express request (authenticated)
   * @param {string} req.body.currentPassword - Current password
   * @param {string} req.body.newPassword - New password
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const { userId } = req.user;

      await this.authService.changePassword(userId, currentPassword, newPassword);

      logger.info('Password changed', { userId });

      return success(res, 'Password changed successfully.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh-token
   *
   * @param {Object} req - Express request
   * @param {string} req.body.refreshToken - Refresh token
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      const result = await this.authService.refreshAccessToken(refreshToken);

      return success(res, 'Token refreshed', {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Logout current session
   * POST /api/v1/auth/logout
   *
   * @param {Object} req - Express request (authenticated)
   * @param {string} [req.body.refreshToken] - Refresh token to invalidate
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async logout(req, res, next) {
    try {
      const { userId } = req.user;
      const { refreshToken } = req.body || {};

      await this.authService.logout(userId, refreshToken);

      logger.info('User logged out', { userId });

      return success(res, 'Logged out successfully.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Logout from all devices
   * POST /api/v1/auth/logout-all
   *
   * @param {Object} req - Express request (authenticated)
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async logoutAll(req, res, next) {
    try {
      const { userId } = req.user;

      await this.authService.logout(userId, null, true);

      logger.info('User logged out from all devices', { userId });

      return success(res, 'Logged out from all devices.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current authenticated user
   * GET /api/v1/auth/me
   *
   * @param {Object} req - Express request (authenticated)
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async getMe(req, res, next) {
    try {
      const { userId } = req.user;

      const user = await this.authService.getCurrentUser(userId);

      return success(res, 'User retrieved', { user });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Send OTP for phone verification
   * POST /api/v1/auth/send-otp
   *
   * @param {Object} req - Express request (authenticated)
   * @param {string} req.body.phone - Phone number
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async sendOTP(req, res, next) {
    try {
      const { userId } = req.user;
      const { phone } = req.body;

      await this.authService.generateOTP(userId, 'phone_verification');

      return success(res, 'OTP sent to your phone number.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify OTP
   * POST /api/v1/auth/verify-otp
   *
   * @param {Object} req - Express request (authenticated)
   * @param {string} req.body.otp - OTP code
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async verifyOTP(req, res, next) {
    try {
      const { userId } = req.user;
      const { otp } = req.body;

      const result = await this.authService.verifyOTP(userId, otp);

      return success(res, 'Phone number verified', { phoneVerified: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get active sessions
   * GET /api/v1/auth/sessions
   *
   * @param {Object} req - Express request (authenticated)
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async getSessions(req, res, next) {
    try {
      const { userId } = req.user;

      const sessions = await this.authService.getActiveSessions(userId);

      return success(res, 'Active sessions retrieved', { sessions });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Revoke a specific session
   * DELETE /api/v1/auth/sessions/:sessionId
   *
   * @param {Object} req - Express request (authenticated)
   * @param {string} req.params.sessionId - Session ID to revoke
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async revokeSession(req, res, next) {
    try {
      const { userId } = req.user;
      const { sessionId } = req.params;

      await this.authService.revokeSession(userId, sessionId);

      return success(res, 'Session revoked successfully.');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AuthController();
