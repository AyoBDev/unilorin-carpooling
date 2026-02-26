/**
 * Authentication Service
 * University of Ilorin Carpooling Platform
 *
 * Handles user registration, login, email verification,
 * password reset, token management, and role management.
 *
 * @module services/AuthService
 */

const { randomUUID } = require('crypto');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { logger } = require('../../shared/utils/logger');
const {
  hashPassword,
  comparePassword,
  generateJWT,
  verifyJWT,
  generateRefreshToken,
  generateSecureToken,
  generateOTP,
} = require('../../shared/utils/encryption');
const { validateRegistration, validateLogin } = require('../../shared/utils/validation');
const { formatDate, addHours, addDays, isExpired, now } = require('../../shared/utils/dateTime');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} = require('../../shared/errors');
const { ERROR_CODES, ERROR_MESSAGES } = require('../../shared/constants/errors');
const { AUTH_EVENTS } = require('../../shared/constants/events');

/**
 * Token configuration
 */
const TOKEN_CONFIG = {
  accessTokenExpiry: '24h',
  refreshTokenExpiry: '30d',
  verificationTokenExpiry: 24, // hours
  passwordResetExpiry: 1, // hours
  otpExpiry: 10, // minutes
  maxLoginAttempts: 5,
  lockoutDuration: 30, // minutes
};

/**
 * AuthService class
 * Manages all authentication-related operations
 */
class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
    this.serviceName = 'AuthService';
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user with tokens
   */
  async register(userData) {
    const startTime = Date.now();
    logger.info('Starting user registration', {
      action: AUTH_EVENTS.REGISTRATION_STARTED,
      email: userData.email,
      role: userData.role,
    });

    try {
      // Validate registration data
      const { error, value } = validateRegistration(userData);
      if (error) {
        throw new ValidationError('Registration validation failed', error.details);
      }

      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        role,
        matricNumber,
        staffId,
        department,
        faculty,
        level,
        designation,
      } = value;

      // Check if email already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new ConflictError(
          ERROR_MESSAGES[ERROR_CODES.USER_EMAIL_EXISTS],
          ERROR_CODES.USER_EMAIL_EXISTS,
          { email },
        );
      }

      // Check if matric number or staff ID already exists
      if (matricNumber) {
        const existingMatric = await this.userRepository.findByMatricNumber(matricNumber);
        if (existingMatric) {
          throw new ConflictError(
            'Matric number already registered',
            ERROR_CODES.USER_MATRIC_EXISTS,
            { matricNumber },
          );
        }
      }

      if (staffId) {
        const existingStaff = await this.userRepository.findByStaffId(staffId);
        if (existingStaff) {
          throw new ConflictError('Staff ID already registered', ERROR_CODES.USER_STAFF_ID_EXISTS, {
            staffId,
          });
        }
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Generate verification token
      const verificationToken = generateSecureToken();
      const verificationExpiry = addHours(now(), TOKEN_CONFIG.verificationTokenExpiry);

      // Create user ID
      const userId = randomUUID();

      // Prepare user data
      const newUserData = {
        userId,
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone,
        role,
        isVerified: false,
        isDriver: false,
        isActive: true,
        verificationToken,
        verificationExpiry: formatDate(verificationExpiry),
        loginAttempts: 0,
        ...(role === 'student' && {
          matricNumber,
          department,
          faculty,
          ...(level != null && { level: parseInt(level, 10) }),
        }),
        ...(role === 'staff' && {
          staffId,
          department,
          designation,
        }),
      };

      // Create user in database
      const user = await this.userRepository.create(newUserData);

      // Generate tokens
      const tokens = this._generateAuthTokens(user);

      // Log successful registration
      logger.info('User registration successful', {
        action: AUTH_EVENTS.REGISTRATION_COMPLETED,
        userId: user.userId,
        email: user.email,
        role: user.role,
        duration: Date.now() - startTime,
      });

      // Return user data (without sensitive fields) and tokens
      return {
        user: this._sanitizeUser(user),
        tokens,
        verificationToken, // For sending verification email
      };
    } catch (error) {
      logger.error('User registration failed', {
        action: AUTH_EVENTS.REGISTRATION_FAILED,
        email: userData.email,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} metadata - Login metadata (IP, device, etc.)
   * @returns {Promise<Object>} User data with tokens
   */
  async login(email, password, metadata = {}) {
    const startTime = Date.now();
    logger.info('Login attempt', {
      action: AUTH_EVENTS.LOGIN_STARTED,
      email,
      ip: metadata.ip,
    });

    try {
      // Validate login data
      const { error } = validateLogin({ email, password });
      if (error) {
        throw new ValidationError('Login validation failed', error.details);
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
      if (!user) {
        // Don't reveal that user doesn't exist
        throw new UnauthorizedError(
          ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID_CREDENTIALS],
          ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        );
      }

      // Check if account is locked
      if (user.lockedUntil && !isExpired(user.lockedUntil)) {
        const remainingTime = Math.ceil((new Date(user.lockedUntil) - new Date()) / (1000 * 60));
        throw new ForbiddenError(
          `Account is locked. Try again in ${remainingTime} minutes.`,
          ERROR_CODES.AUTH_ACCOUNT_LOCKED,
          { lockedUntil: user.lockedUntil, remainingMinutes: remainingTime },
        );
      }

      // Check if account is active
      if (!user.isActive) {
        throw new ForbiddenError(
          ERROR_MESSAGES[ERROR_CODES.AUTH_ACCOUNT_DISABLED],
          ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        );
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        // Increment failed login attempts
        await this._handleFailedLogin(user);
        throw new UnauthorizedError(
          ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID_CREDENTIALS],
          ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        );
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await this.userRepository.updateLoginAttempts(user.userId, 0);
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.userId, {
        lastLoginAt: formatDate(now()),
        lastLoginIp: metadata.ip,
        lastLoginDevice: metadata.device,
      });

      // Generate tokens
      const tokens = this._generateAuthTokens(user);

      // Store refresh token
      await this.userRepository.storeRefreshToken(user.userId, {
        token: tokens.refreshToken,
        expiresAt: formatDate(addDays(now(), 30)),
        createdAt: formatDate(now()),
        ip: metadata.ip,
        device: metadata.device,
      });

      logger.info('Login successful', {
        action: AUTH_EVENTS.LOGIN_COMPLETED,
        userId: user.userId,
        email: user.email,
        isVerified: user.isVerified,
        duration: Date.now() - startTime,
      });

      return {
        user: this._sanitizeUser(user),
        tokens,
        requiresVerification: !user.isVerified,
      };
    } catch (error) {
      logger.warn('Login failed', {
        action: AUTH_EVENTS.LOGIN_FAILED,
        email,
        error: error.message,
        errorCode: error.code,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Verify user email with token
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Updated user data
   */
  async verifyEmail(token) {
    logger.info('Email verification attempt', {
      action: AUTH_EVENTS.EMAIL_VERIFICATION_STARTED,
      tokenPrefix: token.substring(0, 8),
    });

    try {
      if (!token || token.length < 32) {
        throw new BadRequestError('Invalid verification token', ERROR_CODES.AUTH_INVALID_TOKEN);
      }

      // Find user by verification token
      const user = await this.userRepository.findByVerificationToken(token);
      if (!user) {
        throw new NotFoundError(
          'Invalid or expired verification token',
          ERROR_CODES.AUTH_INVALID_TOKEN,
        );
      }

      // Check if token is expired
      if (user.verificationExpiry && isExpired(user.verificationExpiry)) {
        throw new BadRequestError(
          'Verification token has expired. Please request a new one.',
          ERROR_CODES.AUTH_TOKEN_EXPIRED,
        );
      }

      // Check if already verified
      if (user.isVerified) {
        return {
          user: this._sanitizeUser(user),
          message: 'Email already verified',
          alreadyVerified: true,
        };
      }

      // Update user as verified
      const updatedUser = await this.userRepository.verifyEmail(user.userId);

      logger.info('Email verification successful', {
        action: AUTH_EVENTS.EMAIL_VERIFICATION_COMPLETED,
        userId: user.userId,
        email: user.email,
      });

      return {
        user: this._sanitizeUser(updatedUser),
        message: 'Email verified successfully',
        alreadyVerified: false,
      };
    } catch (error) {
      logger.error('Email verification failed', {
        action: AUTH_EVENTS.EMAIL_VERIFICATION_FAILED,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Resend verification email
   * @param {string} email - User email
   * @returns {Promise<Object>} New verification token
   */
  async resendVerificationEmail(email) {
    logger.info('Resend verification email request', {
      action: 'RESEND_VERIFICATION_STARTED',
      email,
    });

    try {
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
      if (!user) {
        // Don't reveal that user doesn't exist
        return {
          message: 'If an account exists with this email, a verification link will be sent.',
          sent: false,
        };
      }

      if (user.isVerified) {
        throw new BadRequestError(
          'Email is already verified',
          ERROR_CODES.AUTH_EMAIL_ALREADY_VERIFIED,
        );
      }

      // Generate new verification token
      const verificationToken = generateSecureToken();
      const verificationExpiry = addHours(now(), TOKEN_CONFIG.verificationTokenExpiry);

      // Update user with new token
      await this.userRepository.updateVerificationToken(user.userId, {
        verificationToken,
        verificationExpiry: formatDate(verificationExpiry),
      });

      logger.info('Verification email resent', {
        action: 'RESEND_VERIFICATION_COMPLETED',
        userId: user.userId,
        email: user.email,
      });

      return {
        message: 'Verification email sent',
        verificationToken, // For sending email
        sent: true,
      };
    } catch (error) {
      logger.error('Resend verification failed', {
        action: 'RESEND_VERIFICATION_FAILED',
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Reset token info
   */
  async requestPasswordReset(email) {
    logger.info('Password reset request', {
      action: AUTH_EVENTS.PASSWORD_RESET_REQUESTED,
      email,
    });

    try {
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());

      // Always return success message to prevent email enumeration
      const successMessage =
        'If an account exists with this email, a password reset link will be sent.';

      if (!user) {
        return { message: successMessage, sent: false };
      }

      if (!user.isActive) {
        return { message: successMessage, sent: false };
      }

      // Generate reset token
      const resetToken = generateSecureToken();
      const resetExpiry = addHours(now(), TOKEN_CONFIG.passwordResetExpiry);

      // Store reset token
      await this.userRepository.storePasswordResetToken(user.userId, {
        resetToken,
        resetExpiry: formatDate(resetExpiry),
        requestedAt: formatDate(now()),
      });

      logger.info('Password reset token generated', {
        action: 'PASSWORD_RESET_TOKEN_GENERATED',
        userId: user.userId,
      });

      return {
        message: successMessage,
        resetToken, // For sending email
        email: user.email,
        sent: true,
      };
    } catch (error) {
      logger.error('Password reset request failed', {
        action: 'PASSWORD_RESET_REQUEST_FAILED',
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success message
   */
  async resetPassword(token, newPassword) {
    logger.info('Password reset attempt', {
      action: AUTH_EVENTS.PASSWORD_RESET_STARTED,
      tokenPrefix: token.substring(0, 8),
    });

    try {
      if (!token || token.length < 32) {
        throw new BadRequestError('Invalid reset token', ERROR_CODES.AUTH_INVALID_TOKEN);
      }

      // Find user by reset token
      const user = await this.userRepository.findByPasswordResetToken(token);
      if (!user) {
        throw new NotFoundError('Invalid or expired reset token', ERROR_CODES.AUTH_INVALID_TOKEN);
      }

      // Check if token is expired
      if (user.passwordResetExpiry && isExpired(user.passwordResetExpiry)) {
        throw new BadRequestError(
          'Reset token has expired. Please request a new one.',
          ERROR_CODES.AUTH_TOKEN_EXPIRED,
        );
      }

      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters', [
          { field: 'newPassword', message: 'Password must be at least 8 characters' },
        ]);
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update password and clear reset token
      await this.userRepository.updatePassword(user.userId, {
        passwordHash,
        passwordChangedAt: formatDate(now()),
      });

      // Invalidate all refresh tokens (force re-login)
      await this.userRepository.invalidateAllRefreshTokens(user.userId);

      logger.info('Password reset successful', {
        action: AUTH_EVENTS.PASSWORD_RESET_COMPLETED,
        userId: user.userId,
      });

      return {
        message: 'Password reset successful. Please login with your new password.',
        success: true,
      };
    } catch (error) {
      logger.error('Password reset failed', {
        action: AUTH_EVENTS.PASSWORD_RESET_FAILED,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Change password (for authenticated users)
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success message
   */
  async changePassword(userId, currentPassword, newPassword) {
    logger.info('Password change attempt', {
      action: 'PASSWORD_CHANGE_STARTED',
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedError(
          'Current password is incorrect',
          ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        );
      }

      // Check if new password is different
      const isSamePassword = await comparePassword(newPassword, user.passwordHash);
      if (isSamePassword) {
        throw new BadRequestError(
          'New password must be different from current password',
          ERROR_CODES.AUTH_PASSWORD_SAME,
        );
      }

      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters', [
          { field: 'newPassword', message: 'Password must be at least 8 characters' },
        ]);
      }

      // Hash and update password
      const passwordHash = await hashPassword(newPassword);
      await this.userRepository.updatePassword(user.userId, {
        passwordHash,
        passwordChangedAt: formatDate(now()),
      });

      logger.info('Password changed successfully', {
        action: 'PASSWORD_CHANGE_COMPLETED',
        userId,
      });

      return {
        message: 'Password changed successfully',
        success: true,
      };
    } catch (error) {
      logger.error('Password change failed', {
        action: 'PASSWORD_CHANGE_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshAccessToken(refreshToken) {
    logger.debug('Token refresh attempt', {
      action: AUTH_EVENTS.TOKEN_REFRESH_STARTED,
    });

    try {
      if (!refreshToken) {
        throw new UnauthorizedError(
          'Refresh token is required',
          ERROR_CODES.AUTH_REFRESH_TOKEN_REQUIRED,
        );
      }

      // Find user by refresh token
      const tokenData = await this.userRepository.findByRefreshToken(refreshToken);
      if (!tokenData) {
        throw new UnauthorizedError(
          'Invalid refresh token',
          ERROR_CODES.AUTH_INVALID_REFRESH_TOKEN,
        );
      }

      // Check if token is expired
      if (tokenData.expiresAt && isExpired(tokenData.expiresAt)) {
        await this.userRepository.removeRefreshToken(tokenData.userId, refreshToken);
        throw new UnauthorizedError(
          'Refresh token has expired',
          ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED,
        );
      }

      // Get user
      const user = await this.userRepository.findById(tokenData.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError(
          'User account not found or disabled',
          ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        );
      }

      // Generate new access token
      const accessToken = generateJWT(
        {
          userId: user.userId,
          email: user.email,
          role: user.role,
          isDriver: user.isDriver,
          isVerified: user.isVerified,
        },
        TOKEN_CONFIG.accessTokenExpiry,
      );

      logger.debug('Token refreshed successfully', {
        action: AUTH_EVENTS.TOKEN_REFRESH_COMPLETED,
        userId: user.userId,
      });

      return {
        accessToken,
        expiresIn: TOKEN_CONFIG.accessTokenExpiry,
      };
    } catch (error) {
      logger.warn('Token refresh failed', {
        action: AUTH_EVENTS.TOKEN_REFRESH_FAILED,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to invalidate
   * @param {boolean} allDevices - Logout from all devices
   * @returns {Promise<Object>} Success message
   */
  async logout(userId, refreshToken, allDevices = false) {
    logger.info('Logout attempt', {
      action: AUTH_EVENTS.LOGOUT_STARTED,
      userId,
      allDevices,
    });

    try {
      if (allDevices) {
        // Invalidate all refresh tokens
        await this.userRepository.invalidateAllRefreshTokens(userId);
        logger.info('Logged out from all devices', {
          action: AUTH_EVENTS.LOGOUT_COMPLETED,
          userId,
          allDevices: true,
        });
      } else if (refreshToken) {
        // Invalidate specific refresh token
        await this.userRepository.removeRefreshToken(userId, refreshToken);
        logger.info('Logged out from current device', {
          action: AUTH_EVENTS.LOGOUT_COMPLETED,
          userId,
          allDevices: false,
        });
      }

      return {
        message: allDevices ? 'Logged out from all devices' : 'Logged out successfully',
        success: true,
      };
    } catch (error) {
      logger.error('Logout failed', {
        action: AUTH_EVENTS.LOGOUT_FAILED,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyToken(token) {
    try {
      const decoded = verifyJWT(token);

      // Optionally verify user still exists and is active
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new UnauthorizedError(
          'User account not found or disabled',
          ERROR_CODES.AUTH_ACCOUNT_DISABLED,
        );
      }

      return {
        valid: true,
        payload: decoded,
        user: this._sanitizeUser(user),
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired', ERROR_CODES.AUTH_TOKEN_EXPIRED);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token', ERROR_CODES.AUTH_INVALID_TOKEN);
      }
      throw error;
    }
  }

  /**
   * Generate OTP for phone verification or 2FA
   * @param {string} userId - User ID
   * @param {string} purpose - OTP purpose (phone_verification, two_factor)
   * @returns {Promise<Object>} OTP data
   */
  async generateOTP(userId, purpose = 'phone_verification') {
    logger.info('OTP generation requested', {
      action: 'OTP_GENERATION_STARTED',
      userId,
      purpose,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      // Generate 6-digit OTP
      const otp = generateOTP(6);
      const otpExpiry = new Date(Date.now() + TOKEN_CONFIG.otpExpiry * 60 * 1000);

      // Store OTP
      await this.userRepository.storeOTP(userId, {
        otp,
        purpose,
        expiresAt: formatDate(otpExpiry),
        createdAt: formatDate(now()),
      });

      logger.info('OTP generated', {
        action: 'OTP_GENERATION_COMPLETED',
        userId,
        purpose,
      });

      return {
        otp, // For sending via SMS/Email
        expiresAt: otpExpiry,
        expiresInMinutes: TOKEN_CONFIG.otpExpiry,
      };
    } catch (error) {
      logger.error('OTP generation failed', {
        action: 'OTP_GENERATION_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify OTP
   * @param {string} userId - User ID
   * @param {string} otp - OTP to verify
   * @param {string} purpose - OTP purpose
   * @returns {Promise<Object>} Verification result
   */
  async verifyOTP(userId, otp, purpose = 'phone_verification') {
    logger.info('OTP verification attempt', {
      action: 'OTP_VERIFICATION_STARTED',
      userId,
      purpose,
    });

    try {
      const storedOTP = await this.userRepository.getOTP(userId, purpose);

      if (!storedOTP) {
        throw new BadRequestError(
          'No OTP found. Please request a new one.',
          ERROR_CODES.AUTH_OTP_NOT_FOUND,
        );
      }

      if (isExpired(storedOTP.expiresAt)) {
        await this.userRepository.removeOTP(userId, purpose);
        throw new BadRequestError(
          'OTP has expired. Please request a new one.',
          ERROR_CODES.AUTH_OTP_EXPIRED,
        );
      }

      if (storedOTP.otp !== otp) {
        throw new BadRequestError('Invalid OTP', ERROR_CODES.AUTH_OTP_INVALID);
      }

      // Remove OTP after successful verification
      await this.userRepository.removeOTP(userId, purpose);

      // If phone verification, mark phone as verified
      if (purpose === 'phone_verification') {
        await this.userRepository.updateProfile(userId, {
          phoneVerified: true,
          phoneVerifiedAt: formatDate(now()),
        });
      }

      logger.info('OTP verified successfully', {
        action: 'OTP_VERIFICATION_COMPLETED',
        userId,
        purpose,
      });

      return {
        verified: true,
        message: 'OTP verified successfully',
      };
    } catch (error) {
      logger.error('OTP verification failed', {
        action: 'OTP_VERIFICATION_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active sessions for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of active sessions
   */
  async getActiveSessions(userId) {
    try {
      const sessions = await this.userRepository.getRefreshTokens(userId);

      return sessions.map((session) => ({
        id: session.id,
        device: session.device || 'Unknown device',
        ip: session.ip,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
        isCurrent: false, // Would need current token to determine
      }));
    } catch (error) {
      logger.error('Failed to get active sessions', {
        action: 'GET_SESSIONS_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Revoke specific session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session/token ID to revoke
   * @returns {Promise<Object>} Success message
   */
  async revokeSession(userId, sessionId) {
    try {
      await this.userRepository.removeRefreshTokenById(userId, sessionId);

      logger.info('Session revoked', {
        action: 'SESSION_REVOKED',
        userId,
        sessionId,
      });

      return {
        message: 'Session revoked successfully',
        success: true,
      };
    } catch (error) {
      logger.error('Failed to revoke session', {
        action: 'REVOKE_SESSION_FAILED',
        userId,
        sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get current authenticated user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Sanitized user data
   */
  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
    }
    if (!user.isActive) {
      throw new ForbiddenError(
        ERROR_MESSAGES[ERROR_CODES.AUTH_ACCOUNT_DISABLED],
        ERROR_CODES.AUTH_ACCOUNT_DISABLED,
      );
    }
    return this._sanitizeUser(user);
  }

  // ==================== Private Methods ====================

  /**
   * Handle failed login attempt
   * @private
   */
  async _handleFailedLogin(user) {
    const attempts = (user.loginAttempts || 0) + 1;

    const updateData = { loginAttempts: attempts };

    // Lock account after max attempts
    if (attempts >= TOKEN_CONFIG.maxLoginAttempts) {
      const lockUntil = new Date(Date.now() + TOKEN_CONFIG.lockoutDuration * 60 * 1000);
      updateData.lockedUntil = formatDate(lockUntil);

      logger.warn('Account locked due to too many failed attempts', {
        action: 'ACCOUNT_LOCKED',
        userId: user.userId,
        attempts,
        lockedUntil: lockUntil,
      });
    }

    await this.userRepository.updateLoginAttempts(user.userId, attempts, updateData.lockedUntil);
  }

  /**
   * Generate authentication tokens
   * @private
   */
  _generateAuthTokens(user) {
    const payload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      isDriver: user.isDriver,
      isVerified: user.isVerified,
    };

    const accessToken = generateJWT(payload, TOKEN_CONFIG.accessTokenExpiry);
    const refreshToken = generateRefreshToken();

    return {
      accessToken,
      refreshToken,
      expiresIn: TOKEN_CONFIG.accessTokenExpiry,
      tokenType: 'Bearer',
    };
  }

  /**
   * Remove sensitive fields from user object
   * @private
   */
  _sanitizeUser(user) {
    const sanitized = { ...user };

    // Remove sensitive fields
    delete sanitized.passwordHash;
    delete sanitized.verificationToken;
    delete sanitized.verificationExpiry;
    delete sanitized.passwordResetToken;
    delete sanitized.passwordResetExpiry;
    delete sanitized.loginAttempts;
    delete sanitized.lockedUntil;
    delete sanitized.refreshTokens;
    delete sanitized.otp;

    // Remove DynamoDB internal attributes
    delete sanitized.PK;
    delete sanitized.SK;
    delete sanitized.GSI1PK;
    delete sanitized.GSI1SK;
    delete sanitized.GSI2PK;
    delete sanitized.GSI2SK;
    delete sanitized.GSI3PK;
    delete sanitized.GSI3SK;
    delete sanitized.GSI4PK;
    delete sanitized.GSI4SK;
    delete sanitized.entityType;
    delete sanitized.EntityType;

    return sanitized;
  }
}

module.exports = AuthService;
