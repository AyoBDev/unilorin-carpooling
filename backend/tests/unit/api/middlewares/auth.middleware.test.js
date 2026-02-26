const {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireDriver,
  requireVerified,
  requireAdmin,
  extractToken,
  isPublicPath,
} = require('../../../../src/api/middlewares/auth.middleware');
const { createMockReq, createMockRes, createMockNext, createMockUser } = require('../../../helpers');

// Mock dependencies
jest.mock('../../../../src/shared/utils/encryption', () => ({
  verifyJWT: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFindById = jest.fn();

jest.mock('../../../../src/infrastructure/database/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => ({
    findById: mockFindById,
  }));
});

const { verifyJWT } = require('../../../../src/shared/utils/encryption');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
    jest.clearAllMocks();
  });

  describe('extractToken()', () => {
    it('should extract Bearer token from Authorization header', () => {
      req.headers = { authorization: 'Bearer abc123' };
      expect(extractToken(req)).toBe('abc123');
    });

    it('should return null for missing header', () => {
      req.headers = {};
      expect(extractToken(req)).toBeNull();
    });

    it('should return null for non-Bearer token', () => {
      req.headers = { authorization: 'Basic abc123' };
      expect(extractToken(req)).toBeNull();
    });

    it('should return null for malformed header', () => {
      req.headers = { authorization: 'Bearer' };
      expect(extractToken(req)).toBeNull();
    });
  });

  describe('isPublicPath()', () => {
    it('should return true for public paths', () => {
      req.method = 'POST';
      req.path = '/api/v1/auth/register';
      expect(isPublicPath(req)).toBe(true);
    });

    it('should return true for health check', () => {
      req.method = 'GET';
      req.path = '/api/v1/health';
      expect(isPublicPath(req)).toBe(true);
    });

    it('should return false for protected paths', () => {
      req.method = 'GET';
      req.path = '/api/v1/rides';
      expect(isPublicPath(req)).toBe(false);
    });

    it('should strip trailing slash', () => {
      req.method = 'GET';
      req.path = '/api/v1/health/';
      expect(isPublicPath(req)).toBe(true);
    });
  });

  describe('authenticate()', () => {
    it('should skip auth for public paths', async () => {
      req.method = 'POST';
      req.path = '/api/v1/auth/login';

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(verifyJWT).not.toHaveBeenCalled();
    });

    it('should call next with error for missing token', async () => {
      req.method = 'GET';
      req.path = '/api/v1/rides';
      req.headers = {};

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for expired token', async () => {
      req.method = 'GET';
      req.path = '/api/v1/rides';
      req.headers = { authorization: 'Bearer expired-token' };
      verifyJWT.mockImplementation(() => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';
        throw err;
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next with error for invalid token', async () => {
      req.method = 'GET';
      req.path = '/api/v1/rides';
      req.headers = { authorization: 'Bearer bad-token' };
      verifyJWT.mockImplementation(() => {
        const err = new Error('invalid token');
        err.name = 'JsonWebTokenError';
        throw err;
      });

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should authenticate successfully with valid token', async () => {
      const mockUser = createMockUser({ userId: 'user-123' });
      req.method = 'GET';
      req.path = '/api/v1/rides';
      req.headers = { authorization: 'Bearer valid-token' };
      verifyJWT.mockReturnValue({ userId: 'user-123', email: mockUser.email, role: 'student' });
      mockFindById.mockResolvedValue(mockUser);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(mockUser.userId);
      expect(req.token).toBeDefined();
    });

    it('should reject suspended users', async () => {
      const mockUser = createMockUser({ userId: 'user-123', status: 'suspended' });
      req.method = 'GET';
      req.path = '/api/v1/rides';
      req.headers = { authorization: 'Bearer valid-token' };
      verifyJWT.mockReturnValue({ userId: 'user-123' });
      mockFindById.mockResolvedValue(mockUser);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject non-existent user', async () => {
      req.method = 'GET';
      req.path = '/api/v1/rides';
      req.headers = { authorization: 'Bearer valid-token' };
      verifyJWT.mockReturnValue({ userId: 'user-123' });
      mockFindById.mockResolvedValue(null);

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('optionalAuthenticate()', () => {
    it('should pass with no token and set user to null', async () => {
      req.headers = {};

      await optionalAuthenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeNull();
    });

    it('should set user when valid token is present', async () => {
      const mockUser = createMockUser({ userId: 'user-123' });
      req.headers = { authorization: 'Bearer valid-token' };
      verifyJWT.mockReturnValue({ userId: 'user-123' });
      mockFindById.mockResolvedValue(mockUser);

      await optionalAuthenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(mockUser.userId);
    });

    it('should set user to null for invalid token', async () => {
      req.headers = { authorization: 'Bearer bad-token' };
      verifyJWT.mockImplementation(() => {
        throw new Error('invalid');
      });

      await optionalAuthenticate(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeNull();
    });
  });

  describe('authorize()', () => {
    it('should pass for matching role', () => {
      req.user = { userId: '123', role: 'admin' };

      authorize('admin')(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should pass for any matching role', () => {
      req.user = { userId: '123', role: 'student' };

      authorize('student', 'staff')(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject non-matching role', () => {
      req.user = { userId: '123', role: 'student' };

      authorize('admin')(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject when no user', () => {
      req.user = null;

      authorize('admin')(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireDriver()', () => {
    it('should pass for verified driver', () => {
      req.user = { userId: '123', isDriver: true, driverStatus: 'verified' };

      requireDriver(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject non-driver', () => {
      req.user = { userId: '123', isDriver: false };

      requireDriver(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject pending driver', () => {
      req.user = { userId: '123', isDriver: true, driverStatus: 'pending' };

      requireDriver(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject rejected driver', () => {
      req.user = { userId: '123', isDriver: true, driverStatus: 'rejected' };

      requireDriver(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject when no user', () => {
      req.user = null;

      requireDriver(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireVerified()', () => {
    it('should pass for verified user', () => {
      req.user = { userId: '123', isVerified: true };

      requireVerified(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject unverified user', () => {
      req.user = { userId: '123', isVerified: false };

      requireVerified(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireAdmin()', () => {
    it('should pass for admin', () => {
      req.user = { userId: '123', role: 'admin' };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject non-admin', () => {
      req.user = { userId: '123', role: 'student' };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
