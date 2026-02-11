/**
 * Authentication & Authorization Middleware
 * University of Ilorin Carpooling Platform
 *
 * Handles JWT token verification, role-based access control (RBAC),
 * driver verification checks, and resource ownership validation.
 *
 * @module middlewares/auth
 */

const { verifyJWT } = require('../../shared/utils/encryption');
const { logger } = require('../../shared/utils/logger');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');
const { ERROR_CODES } = require('../../shared/constants/errors');

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const AUTH_CONFIG = {
  tokenPrefix: 'Bearer',
  headerName: 'authorization',
  /** Paths that skip authentication entirely */
  publicPaths: [
    { method: 'POST', path: '/api/v1/auth/register' },
    { method: 'POST', path: '/api/v1/auth/login' },
    { method: 'POST', path: '/api/v1/auth/forgot-password' },
    { method: 'POST', path: '/api/v1/auth/verify-email' },
    { method: 'GET', path: '/api/v1/health' },
    { method: 'GET', path: '/api/v1/status' },
  ],
};

// Singleton repository
let userRepository = null;
const getUserRepository = () => {
  if (!userRepository) {
    userRepository = new UserRepository();
  }
  return userRepository;
};

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

/**
 * Extract Bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null} The raw JWT string, or null.
 */
const extractToken = (req) => {
  const header = req.headers[AUTH_CONFIG.headerName];
  if (!header) return null;

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== AUTH_CONFIG.tokenPrefix) return null;

  return parts[1];
};

/**
 * Check whether the current request matches a public (unauthenticated) path.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
const isPublicPath = (req) => {
  const method = req.method.toUpperCase();
  const path = req.path.replace(/\/$/, ''); // strip trailing slash

  return AUTH_CONFIG.publicPaths.some((p) => p.method === method && path === p.path);
};

// ─────────────────────────────────────────────
// Core Middleware – authenticate
// ─────────────────────────────────────────────

/**
 * Verify JWT and attach `req.user` to the request.
 *
 * Usage:
 *   router.use(authenticate);
 *
 * After this middleware, `req.user` contains:
 *   { userId, email, role, isDriver, isVerified, isActive }
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const authenticate = async (req, res, next) => {
  try {
    // Skip auth for public endpoints
    if (isPublicPath(req)) {
      return next();
    }

    // 1. Extract token
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError(
        'Authentication required. Please provide a valid access token.',
        ERROR_CODES.AUTH?.TOKEN_MISSING || 'AUTH_TOKEN_MISSING',
      );
    }

    // 2. Verify & decode
    let decoded;
    try {
      decoded = verifyJWT(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError(
          'Access token has expired. Please refresh your token.',
          ERROR_CODES.AUTH?.TOKEN_EXPIRED || 'AUTH_TOKEN_EXPIRED',
        );
      }
      if (err.name === 'JsonWebTokenError') {
        throw new UnauthorizedError(
          'Invalid access token.',
          ERROR_CODES.AUTH?.TOKEN_INVALID || 'AUTH_TOKEN_INVALID',
        );
      }
      throw new UnauthorizedError(
        'Token verification failed.',
        ERROR_CODES.AUTH?.TOKEN_INVALID || 'AUTH_TOKEN_INVALID',
      );
    }

    // 3. Ensure required claims are present
    if (!decoded.userId) {
      throw new UnauthorizedError(
        'Malformed token payload.',
        ERROR_CODES.AUTH?.TOKEN_INVALID || 'AUTH_TOKEN_INVALID',
      );
    }

    // 4. Fetch the user to confirm the account is still valid
    const repo = getUserRepository();
    const user = await repo.findById(decoded.userId);

    if (!user) {
      throw new UnauthorizedError(
        'Account associated with this token no longer exists.',
        ERROR_CODES.AUTH?.ACCOUNT_NOT_FOUND || 'AUTH_ACCOUNT_NOT_FOUND',
      );
    }

    if (user.status === 'suspended' || user.status === 'banned') {
      throw new ForbiddenError(
        `Your account has been ${user.status}. Please contact support.`,
        ERROR_CODES.AUTH?.[`ACCOUNT_${user.status.toUpperCase()}`] || 'AUTH_ACCOUNT_DISABLED',
      );
    }

    if (user.isActive === false) {
      throw new UnauthorizedError(
        'Your account has been deactivated. Please contact support.',
        ERROR_CODES.AUTH?.ACCOUNT_DISABLED || 'AUTH_ACCOUNT_DISABLED',
      );
    }

    // 5. Attach sanitised user to request
    req.user = {
      userId: user.userId || decoded.userId,
      email: user.email || decoded.email,
      role: user.role || decoded.role,
      isDriver: Boolean(user.isDriver ?? decoded.isDriver),
      isVerified: Boolean(user.isVerified ?? decoded.isVerified),
      isActive: user.isActive !== false,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      driverStatus: user.driverStatus || null,
    };

    // 6. Attach token info for downstream use
    req.token = {
      raw: token,
      decoded,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
    };

    logger.debug('User authenticated', {
      userId: req.user.userId,
      role: req.user.role,
      isDriver: req.user.isDriver,
      path: req.path,
    });

    return next();
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// Optional authenticate – won't reject if no token
// ─────────────────────────────────────────────

/**
 * Like `authenticate`, but does not throw when no token is provided.
 * If a valid token is present, `req.user` is populated.
 * If not, `req.user` remains `null`.
 *
 * Useful for endpoints that behave differently for guests vs logged-in users
 * (e.g., ride search showing different details).
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    // Attempt to verify
    try {
      const decoded = verifyJWT(token);
      const repo = getUserRepository();
      const user = await repo.findById(decoded.userId);

      if (user && user.isActive !== false) {
        req.user = {
          userId: user.userId || decoded.userId,
          email: user.email || decoded.email,
          role: user.role || decoded.role,
          isDriver: Boolean(user.isDriver ?? decoded.isDriver),
          isVerified: Boolean(user.isVerified ?? decoded.isVerified),
          isActive: true,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      } else {
        req.user = null;
      }
    } catch (_) {
      // Invalid/expired token – treat as guest
      req.user = null;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────
// Role-Based Access Control
// ─────────────────────────────────────────────

/**
 * Restrict access to one or more roles.
 *
 * Usage:
 *   router.get('/admin/users', authenticate, authorize('admin'), handler);
 *   router.post('/rides', authenticate, authorize('student', 'staff'), handler);
 *
 * @param  {...string} allowedRoles – e.g. 'admin', 'student', 'staff'
 * @returns {Function} Express middleware
 */
const authorize =
  (...allowedRoles) =>
  (req, _res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError(
          'Authentication required.',
          ERROR_CODES.AUTH?.TOKEN_MISSING || 'AUTH_TOKEN_MISSING',
        );
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Authorization failed – role not permitted', {
          userId: req.user.userId,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          path: req.path,
        });

        throw new ForbiddenError(
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          ERROR_CODES.AUTHZ?.ROLE_REQUIRED || 'AUTHZ_ROLE_REQUIRED',
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };

// ─────────────────────────────────────────────
// Driver-Specific Guards
// ─────────────────────────────────────────────

/**
 * Ensure the authenticated user is a verified driver.
 *
 * Usage:
 *   router.post('/rides', authenticate, requireDriver, handler);
 */
const requireDriver = (req, _res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError(
        'Authentication required.',
        ERROR_CODES.AUTH?.TOKEN_MISSING || 'AUTH_TOKEN_MISSING',
      );
    }

    if (!req.user.isDriver) {
      throw new ForbiddenError(
        'You must register as a driver to perform this action.',
        ERROR_CODES.AUTHZ?.DRIVER_ONLY || 'AUTHZ_DRIVER_ONLY',
      );
    }

    if (req.user.driverStatus === 'pending') {
      throw new ForbiddenError(
        'Your driver account is pending verification. Please wait for approval.',
        ERROR_CODES.AUTHZ?.DRIVER_NOT_VERIFIED || 'AUTHZ_DRIVER_NOT_VERIFIED',
      );
    }

    if (req.user.driverStatus === 'rejected') {
      throw new ForbiddenError(
        'Your driver verification was rejected. Please re-submit your documents.',
        ERROR_CODES.AUTHZ?.DRIVER_REJECTED || 'AUTHZ_DRIVER_REJECTED',
      );
    }

    if (req.user.driverStatus === 'suspended') {
      throw new ForbiddenError(
        'Your driver privileges have been suspended. Please contact support.',
        ERROR_CODES.AUTHZ?.DRIVER_SUSPENDED || 'AUTHZ_DRIVER_SUSPENDED',
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Ensure the authenticated user's email is verified.
 *
 * Usage:
 *   router.post('/bookings', authenticate, requireVerified, handler);
 */
const requireVerified = (req, _res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError(
        'Authentication required.',
        ERROR_CODES.AUTH?.TOKEN_MISSING || 'AUTH_TOKEN_MISSING',
      );
    }

    if (!req.user.isVerified) {
      throw new ForbiddenError(
        'Please verify your email address before performing this action.',
        ERROR_CODES.AUTH?.ACCOUNT_NOT_VERIFIED || 'AUTH_ACCOUNT_NOT_VERIFIED',
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Resource Ownership Guard
// ─────────────────────────────────────────────

/**
 * Ensure the authenticated user owns the resource identified by a request
 * parameter, **or** holds an admin role.
 *
 * Usage:
 *   router.patch('/users/:userId', authenticate, requireOwnerOrAdmin('userId'), handler);
 *
 * @param {string} paramName – The `req.params` key that holds the resource-owner user ID.
 * @returns {Function} Express middleware
 */
const requireOwnerOrAdmin =
  (paramName = 'userId') =>
  (req, _res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError(
          'Authentication required.',
          ERROR_CODES.AUTH?.TOKEN_MISSING || 'AUTH_TOKEN_MISSING',
        );
      }

      const resourceOwnerId = req.params[paramName];

      if (!resourceOwnerId) {
        // If param isn't present, let downstream handle the 404
        return next();
      }

      const isOwner = req.user.userId === resourceOwnerId;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        logger.warn('Ownership check failed', {
          userId: req.user.userId,
          resourceOwnerId,
          paramName,
          path: req.path,
        });

        throw new ForbiddenError(
          'You can only access or modify your own resources.',
          ERROR_CODES.AUTHZ?.NOT_OWNER || 'AUTHZ_NOT_OWNER',
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };

// ─────────────────────────────────────────────
// Admin Guard
// ─────────────────────────────────────────────

/**
 * Restrict access to admin users only.
 *
 * Usage:
 *   router.delete('/users/:id', authenticate, requireAdmin, handler);
 */
const requireAdmin = (req, _res, next) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError(
        'Authentication required.',
        ERROR_CODES.AUTH?.TOKEN_MISSING || 'AUTH_TOKEN_MISSING',
      );
    }

    if (req.user.role !== 'admin') {
      throw new ForbiddenError(
        'This action requires administrator privileges.',
        ERROR_CODES.AUTHZ?.ADMIN_ONLY || 'AUTHZ_ADMIN_ONLY',
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireDriver,
  requireVerified,
  requireOwnerOrAdmin,
  requireAdmin,
  // Re-export helpers for testing
  extractToken,
  isPublicPath,
  AUTH_CONFIG,
};
