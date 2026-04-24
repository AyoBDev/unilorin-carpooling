const { randomUUID } = require('crypto');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const InviteRepository = require('../../infrastructure/database/repositories/InviteRepository');
const { logger } = require('../../shared/utils/logger');
const {
  hashPassword,
  comparePassword,
  generateJWT,
  generateSecureToken,
  generateRefreshToken,
  hashing,
} = require('../../shared/utils/encryption');
const { formatDate, addHours, now, isExpired } = require('../../shared/utils/dateTime');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require('../../shared/errors');
const { ERROR_CODES, ERROR_MESSAGES } = require('../../shared/constants/errors');

const ADMIN_SECRET = process.env.ADMIN_REGISTRATION_SECRET;

const TOKEN_CONFIG = {
  accessTokenExpiry: '24h',
  refreshTokenExpiry: '30d',
  defaultInviteExpiryHours: 72,
  maxLoginAttempts: 5,
  lockoutDuration: 30, // minutes
};

class AdminAuthService {
  constructor() {
    this.userRepository = new UserRepository();
    this.inviteRepository = new InviteRepository();
  }

  async registerAdmin(data) {
    const { email, password, firstName, lastName, phone, adminSecret, inviteCode } = data;

    let invite = null;
    if (adminSecret) {
      if (!ADMIN_SECRET) {
        throw new ForbiddenError(
          'Admin registration via secret is not configured',
          ERROR_CODES.ADMIN_INVALID_SECRET,
        );
      }
      if (adminSecret !== ADMIN_SECRET) {
        throw new ForbiddenError(
          ERROR_MESSAGES[ERROR_CODES.ADMIN_INVALID_SECRET],
          ERROR_CODES.ADMIN_INVALID_SECRET,
        );
      }
    } else if (inviteCode) {
      invite = await this._validateInviteCode(inviteCode, email);
    } else {
      throw new ValidationError('Either adminSecret or inviteCode is required');
    }

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError(
        ERROR_MESSAGES[ERROR_CODES.USER_EMAIL_EXISTS],
        ERROR_CODES.USER_EMAIL_EXISTS,
        { email },
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    const newUserData = {
      userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      role: 'admin',
      isVerified: true,
      isDriver: false,
      isActive: true,
      loginAttempts: 0,
    };

    const user = await this.userRepository.create(newUserData);

    if (invite) {
      await this.inviteRepository.markUsed(invite.inviteId, userId);
    }

    const tokens = this._generateAuthTokens(user);

    logger.info('Admin registered', {
      action: 'ADMIN_REGISTRATION_COMPLETED',
      userId,
      email: user.email,
      method: adminSecret ? 'secret' : 'invite',
      inviteId: invite?.inviteId || null,
    });

    return {
      user: this._sanitizeUser(user),
      tokens,
    };
  }

  async loginAdmin(email, password, metadata = {}) {
    const user = await this.userRepository.findByEmail(email);

    const genericError = () =>
      new UnauthorizedError(
        ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID_CREDENTIALS],
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      );

    if (!user) {
      throw genericError();
    }

    if (user.role !== 'admin') {
      logger.warn('Non-admin login attempt on admin endpoint', {
        action: 'ADMIN_LOGIN_REJECTED',
        email,
        role: user.role,
      });
      throw genericError();
    }

    if (user.lockedUntil && !isExpired(user.lockedUntil)) {
      throw new ForbiddenError(
        'Account temporarily locked. Try again later.',
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      );
    }

    if (user.status === 'suspended' || user.status === 'banned') {
      throw new ForbiddenError(
        `Your account has been ${user.status}. Please contact support.`,
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      );
    }

    if (user.isActive === false) {
      throw genericError();
    }

    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await this._handleFailedLogin(user);
      throw genericError();
    }

    if (user.loginAttempts > 0) {
      await this.userRepository.updateLoginAttempts(user.userId, 0);
    }

    await this.userRepository.updateLastLogin(user.userId, {
      lastLoginAt: formatDate(now()),
      lastLoginIp: metadata.ip,
      lastLoginDevice: metadata.device,
    });

    const tokens = this._generateAuthTokens(user);

    logger.info('Admin login successful', {
      action: 'ADMIN_LOGIN_COMPLETED',
      userId: user.userId,
      email: user.email,
    });

    return {
      user: this._sanitizeUser(user),
      tokens,
    };
  }

  async createInvite(createdBy, { email, expiresInHours } = {}) {
    const hours = expiresInHours || TOKEN_CONFIG.defaultInviteExpiryHours;
    const inviteId = randomUUID();
    const rawCode = generateSecureToken(32);
    const codeHash = hashing.sha256(rawCode);
    const expiresAt = formatDate(addHours(now(), hours));

    await this.inviteRepository.create({
      inviteId,
      codeHash,
      createdBy,
      email: email || null,
      expiresAt,
    });

    logger.info('Admin invite created', {
      action: 'ADMIN_INVITE_CREATED',
      inviteId,
      createdBy,
      email: email || null,
      expiresAt,
    });

    return {
      inviteId,
      code: rawCode,
      email: email || null,
      expiresAt,
    };
  }

  async listInvites() {
    const invites = await this.inviteRepository.listAll();

    return invites.map((invite) => ({
      inviteId: invite.inviteId,
      email: invite.email,
      status: this._computeInviteStatus(invite),
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      usedBy: invite.usedBy,
      usedAt: invite.usedAt,
    }));
  }

  async revokeInvite(inviteId) {
    const invite = await this.inviteRepository.findById(inviteId);
    if (!invite) {
      throw new NotFoundError(
        ERROR_MESSAGES[ERROR_CODES.ADMIN_INVITE_NOT_FOUND],
        ERROR_CODES.ADMIN_INVITE_NOT_FOUND,
      );
    }

    if (invite.status !== 'active') {
      throw new BadRequestError(
        `Cannot revoke invite with status: ${invite.status}`,
        ERROR_CODES.ADMIN_INVITE_REVOKED,
      );
    }

    await this.inviteRepository.revoke(inviteId);

    logger.info('Admin invite revoked', {
      action: 'ADMIN_INVITE_REVOKED',
      inviteId,
    });
  }

  // ─── Private Methods ──────────────────────────────────

  async _validateInviteCode(rawCode, email) {
    const codeHash = hashing.sha256(rawCode);
    const invite = await this.inviteRepository.findByCodeHash(codeHash);

    if (!invite) {
      throw new ForbiddenError(
        ERROR_MESSAGES[ERROR_CODES.ADMIN_INVALID_INVITE],
        ERROR_CODES.ADMIN_INVALID_INVITE,
      );
    }

    if (invite.status === 'used') {
      throw new ForbiddenError(
        ERROR_MESSAGES[ERROR_CODES.ADMIN_INVITE_USED],
        ERROR_CODES.ADMIN_INVITE_USED,
      );
    }

    if (invite.status === 'revoked') {
      throw new ForbiddenError(
        ERROR_MESSAGES[ERROR_CODES.ADMIN_INVITE_REVOKED],
        ERROR_CODES.ADMIN_INVITE_REVOKED,
      );
    }

    if (isExpired(invite.expiresAt)) {
      throw new ForbiddenError(
        ERROR_MESSAGES[ERROR_CODES.ADMIN_INVITE_EXPIRED],
        ERROR_CODES.ADMIN_INVITE_EXPIRED,
      );
    }

    if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenError(
        ERROR_MESSAGES[ERROR_CODES.ADMIN_INVITE_EMAIL_MISMATCH],
        ERROR_CODES.ADMIN_INVITE_EMAIL_MISMATCH,
      );
    }

    return invite;
  }

  _computeInviteStatus(invite) {
    if (invite.status === 'used' || invite.status === 'revoked') {
      return invite.status;
    }
    if (isExpired(invite.expiresAt)) {
      return 'expired';
    }
    return 'active';
  }

  async _handleFailedLogin(user) {
    const attempts = (user.loginAttempts || 0) + 1;
    let lockedUntil = null;

    if (attempts >= TOKEN_CONFIG.maxLoginAttempts) {
      lockedUntil = formatDate(
        new Date(Date.now() + TOKEN_CONFIG.lockoutDuration * 60 * 1000),
      );
      logger.warn('Admin account locked', {
        action: 'ADMIN_ACCOUNT_LOCKED',
        userId: user.userId,
        attempts,
        lockedUntil,
      });
    }

    await this.userRepository.updateLoginAttempts(user.userId, attempts, lockedUntil);
  }

  _generateAuthTokens(user) {
    const payload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      isDriver: user.isDriver || false,
      isVerified: user.isVerified || true,
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

  _sanitizeUser(user) {
    const sanitized = { ...user };

    // Remove sensitive fields
    delete sanitized.passwordHash;
    delete sanitized.verificationToken;
    delete sanitized.verificationExpiry;
    delete sanitized.verificationTokenExpiry;
    delete sanitized.emailVerificationToken;
    delete sanitized.passwordResetToken;
    delete sanitized.passwordResetExpiry;
    delete sanitized.loginAttempts;
    delete sanitized.lockedUntil;
    delete sanitized.refreshTokens;
    delete sanitized.otpData;
    delete sanitized.otp;

    // Remove non-essential fields from API responses
    delete sanitized.preferences;
    delete sanitized.ratingsAsDriver;
    delete sanitized.ratingsAsPassenger;

    // Default profile image
    if (!sanitized.profileImage && !sanitized.profilePhoto) {
      sanitized.profileImage = 'defaults/default-avatar.svg';
    }

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

module.exports = AdminAuthService;
