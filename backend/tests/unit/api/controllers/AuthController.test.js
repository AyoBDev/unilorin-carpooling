/**
 * AuthController Unit Tests
 */

const mockService = {
  register: jest.fn(),
  login: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  refreshAccessToken: jest.fn(),
  logout: jest.fn(),
  getCurrentUser: jest.fn(),
  generateOTP: jest.fn(),
  verifyOTP: jest.fn(),
  getActiveSessions: jest.fn(),
  revokeSession: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  AuthService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  created: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/AuthController');
const { success, created } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext, createMockUser } = require('../../../helpers/mockFactory');

describe('AuthController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── register ──────────────────────────────────────────
  describe('register', () => {
    it('should register user and call created', async () => {
      const user = createMockUser();
      const tokens = { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600, tokenType: 'Bearer' };
      mockService.register.mockResolvedValue({ user, tokens, verificationToken: 'vt' });
      req = createMockReq({ body: { email: 'a@unilorin.edu.ng', password: 'pass1234' } });

      await controller.register(req, res, next);

      expect(mockService.register).toHaveBeenCalledWith(req.body);
      expect(created).toHaveBeenCalledWith(
        res,
        expect.any(String),
        expect.objectContaining({ user, accessToken: 'at', refreshToken: 'rt' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('dup');
      mockService.register.mockRejectedValue(err);
      req = createMockReq({ body: {} });

      await controller.register(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── login ─────────────────────────────────────────────
  describe('login', () => {
    it('should login and call success', async () => {
      const user = createMockUser();
      const tokens = { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600, tokenType: 'Bearer' };
      mockService.login.mockResolvedValue({ user, tokens });
      req = createMockReq({
        body: { email: 'a@unilorin.edu.ng', password: 'pass' },
        headers: { 'user-agent': 'test' },
        ip: '1.2.3.4',
      });

      await controller.login(req, res, next);

      expect(mockService.login).toHaveBeenCalledWith('a@unilorin.edu.ng', 'pass', expect.any(Object));
      expect(success).toHaveBeenCalledWith(res, 'Login successful', expect.objectContaining({ user }));
    });

    it('should call next on error', async () => {
      const err = new Error('bad creds');
      mockService.login.mockRejectedValue(err);
      req = createMockReq({ body: { email: 'x', password: 'y' }, headers: {}, ip: '0' });

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── verifyEmail ───────────────────────────────────────
  describe('verifyEmail', () => {
    it('should verify email and call success', async () => {
      mockService.verifyEmail.mockResolvedValue({ userId: 'u1' });
      req = createMockReq({ body: { token: 'tok' } });

      await controller.verifyEmail(req, res, next);

      expect(mockService.verifyEmail).toHaveBeenCalledWith('tok');
      expect(success).toHaveBeenCalledWith(res, expect.any(String), expect.objectContaining({ verified: true }));
    });

    it('should call next on error', async () => {
      const err = new Error('invalid');
      mockService.verifyEmail.mockRejectedValue(err);
      req = createMockReq({ body: { token: 'bad' } });

      await controller.verifyEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── resendVerification ────────────────────────────────
  describe('resendVerification', () => {
    it('should resend and call success', async () => {
      mockService.resendVerificationEmail.mockResolvedValue();
      req = createMockReq({ body: { email: 'a@b.com' } });

      await controller.resendVerification(req, res, next);

      expect(mockService.resendVerificationEmail).toHaveBeenCalledWith('a@b.com');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.resendVerificationEmail.mockRejectedValue(err);
      req = createMockReq({ body: { email: 'a@b.com' } });

      await controller.resendVerification(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── forgotPassword ────────────────────────────────────
  describe('forgotPassword', () => {
    it('should always call success (no email enumeration)', async () => {
      mockService.requestPasswordReset.mockResolvedValue();
      req = createMockReq({ body: { email: 'a@b.com' } });

      await controller.forgotPassword(req, res);

      expect(success).toHaveBeenCalledWith(res, expect.stringContaining('If an account exists'));
    });

    it('should still call success even on error', async () => {
      mockService.requestPasswordReset.mockRejectedValue(new Error('nope'));
      req = createMockReq({ body: { email: 'x@y.com' } });

      await controller.forgotPassword(req, res);

      expect(success).toHaveBeenCalledWith(res, expect.stringContaining('If an account exists'));
    });
  });

  // ─── resetPassword ─────────────────────────────────────
  describe('resetPassword', () => {
    it('should reset password and call success', async () => {
      mockService.resetPassword.mockResolvedValue();
      req = createMockReq({ body: { token: 'tok', newPassword: 'new123' } });

      await controller.resetPassword(req, res, next);

      expect(mockService.resetPassword).toHaveBeenCalledWith('tok', 'new123');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('expired');
      mockService.resetPassword.mockRejectedValue(err);
      req = createMockReq({ body: { token: 'x', newPassword: 'y' } });

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── changePassword ────────────────────────────────────
  describe('changePassword', () => {
    it('should change password and call success', async () => {
      mockService.changePassword.mockResolvedValue();
      req = createMockReq({ body: { currentPassword: 'old', newPassword: 'new' }, user: { userId: 'u1' } });

      await controller.changePassword(req, res, next);

      expect(mockService.changePassword).toHaveBeenCalledWith('u1', 'old', 'new');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('wrong');
      mockService.changePassword.mockRejectedValue(err);
      req = createMockReq({ body: { currentPassword: 'x', newPassword: 'y' }, user: { userId: 'u1' } });

      await controller.changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── refreshToken ──────────────────────────────────────
  describe('refreshToken', () => {
    it('should refresh and call success', async () => {
      mockService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
      req = createMockReq({ body: { refreshToken: 'old-rt' } });

      await controller.refreshToken(req, res, next);

      expect(mockService.refreshAccessToken).toHaveBeenCalledWith('old-rt');
      expect(success).toHaveBeenCalledWith(res, 'Token refreshed', expect.objectContaining({ accessToken: 'new-at' }));
    });

    it('should call next on error', async () => {
      const err = new Error('invalid');
      mockService.refreshAccessToken.mockRejectedValue(err);
      req = createMockReq({ body: { refreshToken: 'bad' } });

      await controller.refreshToken(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── logout ────────────────────────────────────────────
  describe('logout', () => {
    it('should logout and call success', async () => {
      mockService.logout.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, body: { refreshToken: 'rt' } });

      await controller.logout(req, res, next);

      expect(mockService.logout).toHaveBeenCalledWith('u1', 'rt');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.logout.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.logout(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── logoutAll ─────────────────────────────────────────
  describe('logoutAll', () => {
    it('should logout all and call success', async () => {
      mockService.logout.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.logoutAll(req, res, next);

      expect(mockService.logout).toHaveBeenCalledWith('u1', null, true);
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.logout.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.logoutAll(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMe ─────────────────────────────────────────────
  describe('getMe', () => {
    it('should get current user and call success', async () => {
      const user = createMockUser();
      mockService.getCurrentUser.mockResolvedValue(user);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getMe(req, res, next);

      expect(mockService.getCurrentUser).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'User retrieved', { user });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockService.getCurrentUser.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── sendOTP ───────────────────────────────────────────
  describe('sendOTP', () => {
    it('should send OTP and call success', async () => {
      mockService.generateOTP.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, body: { phone: '+2348000000000' } });

      await controller.sendOTP(req, res, next);

      expect(mockService.generateOTP).toHaveBeenCalledWith('u1', 'phone_verification');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.generateOTP.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: { phone: '+234' } });

      await controller.sendOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── verifyOTP ─────────────────────────────────────────
  describe('verifyOTP', () => {
    it('should verify OTP and call success', async () => {
      mockService.verifyOTP.mockResolvedValue(true);
      req = createMockReq({ user: { userId: 'u1' }, body: { otp: '123456' } });

      await controller.verifyOTP(req, res, next);

      expect(mockService.verifyOTP).toHaveBeenCalledWith('u1', '123456');
      expect(success).toHaveBeenCalledWith(res, 'Phone number verified', { phoneVerified: true });
    });

    it('should call next on error', async () => {
      const err = new Error('bad otp');
      mockService.verifyOTP.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: { otp: '000' } });

      await controller.verifyOTP(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getSessions ───────────────────────────────────────
  describe('getSessions', () => {
    it('should get sessions and call success', async () => {
      const sessions = [{ id: 's1' }];
      mockService.getActiveSessions.mockResolvedValue(sessions);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getSessions(req, res, next);

      expect(mockService.getActiveSessions).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'Active sessions retrieved', { sessions });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getActiveSessions.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getSessions(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── revokeSession ─────────────────────────────────────
  describe('revokeSession', () => {
    it('should revoke session and call success', async () => {
      mockService.revokeSession.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, params: { sessionId: 's1' } });

      await controller.revokeSession(req, res, next);

      expect(mockService.revokeSession).toHaveBeenCalledWith('u1', 's1');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.revokeSession.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, params: { sessionId: 's1' } });

      await controller.revokeSession(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
