const AdminAuthService = require('../../core/services/AdminAuthService');
const { success, created } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class AdminAuthController {
  constructor() {
    this.adminAuthService = new AdminAuthService();

    this.login = this.login.bind(this);
    this.register = this.register.bind(this);
    this.createInvite = this.createInvite.bind(this);
    this.listInvites = this.listInvites.bind(this);
    this.revokeInvite = this.revokeInvite.bind(this);
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const metadata = {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection?.remoteAddress,
        device: req.headers['user-agent'],
      };

      const result = await this.adminAuthService.loginAdmin(email, password, metadata);

      logger.info('Admin logged in', { userId: result.user.userId });

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

  async register(req, res, next) {
    try {
      const result = await this.adminAuthService.registerAdmin(req.body);

      logger.info('Admin registered', {
        userId: result.user.userId,
      });

      return created(res, 'Admin registration successful', {
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

  async createInvite(req, res, next) {
    try {
      const { userId } = req.user;
      const { email, expiresInHours } = req.body;

      const invite = await this.adminAuthService.createInvite(userId, {
        email,
        expiresInHours,
      });

      return created(res, 'Invite created. Share the code with the new admin — it is shown only once.', {
        invite,
      });
    } catch (error) {
      return next(error);
    }
  }

  async listInvites(req, res, next) {
    try {
      const invites = await this.adminAuthService.listInvites();

      return success(res, 'Invites retrieved', { invites });
    } catch (error) {
      return next(error);
    }
  }

  async revokeInvite(req, res, next) {
    try {
      const { inviteId } = req.params;

      await this.adminAuthService.revokeInvite(inviteId);

      return success(res, 'Invite revoked successfully');
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AdminAuthController();
