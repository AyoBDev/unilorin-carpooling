const AuthService = require('../../../../src/core/services/AuthService');
const { createMockUser } = require('../../../helpers');

// Mock all dependencies
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../../src/shared/utils/encryption', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  comparePassword: jest.fn(),
  generateJWT: jest.fn().mockReturnValue('mock-jwt-token'),
  verifyJWT: jest.fn(),
  generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  generateSecureToken: jest.fn().mockReturnValue('mock-secure-token-1234567890123456789012'),
  generateOTP: jest.fn().mockReturnValue('123456'),
}));

jest.mock('../../../../src/shared/utils/validation', () => ({
  validateRegistration: jest.fn(),
  validateLogin: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/dateTime', () => ({
  formatDate: jest.fn((d) => (d ? d.toISOString?.() || d : new Date().toISOString())),
  addHours: jest.fn(() => new Date(Date.now() + 3600000)),
  addDays: jest.fn(() => new Date(Date.now() + 86400000 * 30)),
  isExpired: jest.fn(),
  now: jest.fn(() => new Date()),
}));

const mockRepo = {
  findByEmail: jest.fn(),
  findByMatricNumber: jest.fn(),
  findByStaffId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByVerificationToken: jest.fn(),
  verifyEmail: jest.fn(),
  updateVerificationToken: jest.fn(),
  storePasswordResetToken: jest.fn(),
  findByPasswordResetToken: jest.fn(),
  updatePassword: jest.fn(),
  invalidateAllRefreshTokens: jest.fn(),
  updateLoginAttempts: jest.fn(),
  updateLastLogin: jest.fn(),
  storeRefreshToken: jest.fn(),
  findByRefreshToken: jest.fn(),
  removeRefreshToken: jest.fn(),
  updateProfile: jest.fn(),
  storeOTP: jest.fn(),
  getOTP: jest.fn(),
  removeOTP: jest.fn(),
};

jest.mock('../../../../src/infrastructure/database/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => mockRepo);
});

const { comparePassword } = require('../../../../src/shared/utils/encryption');
const { validateRegistration, validateLogin } = require('../../../../src/shared/utils/validation');
const { isExpired } = require('../../../../src/shared/utils/dateTime');

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
  });

  describe('register()', () => {
    const validUserData = {
      email: 'student@unilorin.edu.ng',
      password: 'SecurePass123',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+2348012345678',
      role: 'student',
      matricNumber: '19/52HP029',
      department: 'Computer Science',
      faculty: 'Communication and Information Sciences',
      level: '400',
    };

    it('should register a new user successfully', async () => {
      validateRegistration.mockReturnValue({ error: null, value: validUserData });
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.findByMatricNumber.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        userId: 'new-user-id',
        ...validUserData,
        passwordHash: 'hashed',
      });

      const result = await authService.register(validUserData);

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock-jwt-token');
      expect(result.verificationToken).toBeDefined();
      expect(result.user.passwordHash).toBeUndefined();
    });

    it('should throw ValidationError on invalid data', async () => {
      validateRegistration.mockReturnValue({
        error: { details: [{ field: 'email', message: 'invalid' }] },
        value: null,
      });

      await expect(authService.register(validUserData)).rejects.toThrow('Registration validation failed');
    });

    it('should throw ConflictError for duplicate email', async () => {
      validateRegistration.mockReturnValue({ error: null, value: validUserData });
      mockRepo.findByEmail.mockResolvedValue(createMockUser());

      await expect(authService.register(validUserData)).rejects.toThrow();
    });

    it('should throw ConflictError for duplicate matric number', async () => {
      validateRegistration.mockReturnValue({ error: null, value: validUserData });
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.findByMatricNumber.mockResolvedValue(createMockUser());

      await expect(authService.register(validUserData)).rejects.toThrow();
    });
  });

  describe('login()', () => {
    const mockUser = createMockUser({
      userId: 'user-123',
      email: 'test@unilorin.edu.ng',
      passwordHash: 'hashed-password',
      isActive: true,
      loginAttempts: 0,
    });

    it('should login successfully with valid credentials', async () => {
      validateLogin.mockReturnValue({ error: null });
      mockRepo.findByEmail.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      mockRepo.updateLastLogin.mockResolvedValue(undefined);
      mockRepo.storeRefreshToken.mockResolvedValue(undefined);

      const result = await authService.login('test@unilorin.edu.ng', 'password123');

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.user.passwordHash).toBeUndefined();
    });

    it('should throw on validation failure', async () => {
      validateLogin.mockReturnValue({
        error: { details: [{ field: 'email', message: 'invalid' }] },
      });

      await expect(authService.login('bad', 'bad')).rejects.toThrow();
    });

    it('should throw UnauthorizedError for non-existent user', async () => {
      validateLogin.mockReturnValue({ error: null });
      mockRepo.findByEmail.mockResolvedValue(null);

      await expect(authService.login('test@test.com', 'pass')).rejects.toThrow();
    });

    it('should throw UnauthorizedError for wrong password', async () => {
      validateLogin.mockReturnValue({ error: null });
      mockRepo.findByEmail.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);
      mockRepo.updateLoginAttempts.mockResolvedValue(undefined);

      await expect(authService.login('test@test.com', 'wrong')).rejects.toThrow();
    });

    it('should throw ForbiddenError for locked account', async () => {
      validateLogin.mockReturnValue({ error: null });
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 3600000).toISOString(),
      };
      mockRepo.findByEmail.mockResolvedValue(lockedUser);
      isExpired.mockReturnValue(false);

      await expect(authService.login('test@test.com', 'pass')).rejects.toThrow();
    });

    it('should throw ForbiddenError for inactive account', async () => {
      validateLogin.mockReturnValue({ error: null });
      const inactiveUser = { ...mockUser, isActive: false };
      mockRepo.findByEmail.mockResolvedValue(inactiveUser);

      await expect(authService.login('test@test.com', 'pass')).rejects.toThrow();
    });
  });

  describe('refreshAccessToken()', () => {
    it('should throw when no refresh token provided', async () => {
      await expect(authService.refreshAccessToken(null)).rejects.toThrow('Refresh token is required');
    });

    it('should throw for invalid refresh token', async () => {
      mockRepo.findByRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshAccessToken('invalid-token')).rejects.toThrow();
    });

    it('should return new access token for valid refresh token', async () => {
      const tokenData = {
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const user = createMockUser({ userId: 'user-123', isActive: true });
      mockRepo.findByRefreshToken.mockResolvedValue(tokenData);
      isExpired.mockReturnValue(false);
      mockRepo.findById.mockResolvedValue(user);

      const result = await authService.refreshAccessToken('valid-refresh');

      expect(result.accessToken).toBeDefined();
    });
  });

  describe('logout()', () => {
    it('should logout from current device', async () => {
      mockRepo.removeRefreshToken.mockResolvedValue(undefined);

      const result = await authService.logout('user-123', 'refresh-token', false);

      expect(result.success).toBe(true);
      expect(mockRepo.removeRefreshToken).toHaveBeenCalled();
    });

    it('should logout from all devices', async () => {
      mockRepo.invalidateAllRefreshTokens.mockResolvedValue(undefined);

      const result = await authService.logout('user-123', null, true);

      expect(result.success).toBe(true);
      expect(mockRepo.invalidateAllRefreshTokens).toHaveBeenCalled();
    });
  });

  describe('_sanitizeUser()', () => {
    it('should remove sensitive fields', () => {
      const user = {
        userId: '123',
        email: 'test@test.com',
        passwordHash: 'secret',
        verificationToken: 'token',
        loginAttempts: 3,
        refreshTokens: ['t1'],
      };

      const result = authService._sanitizeUser(user);

      expect(result.userId).toBe('123');
      expect(result.email).toBe('test@test.com');
      expect(result.passwordHash).toBeUndefined();
      expect(result.verificationToken).toBeUndefined();
      expect(result.loginAttempts).toBeUndefined();
      expect(result.refreshTokens).toBeUndefined();
    });
  });
});
