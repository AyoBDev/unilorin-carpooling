/**
 * User Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles user profile management, driver registration & verification,
 * vehicle management, emergency contacts, and user statistics.
 *
 * Path: src/api/controllers/UserController.js
 *
 * @module controllers/UserController
 */

const { UserService } = require('../../core/services');
const { success, created, paginated } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class UserController {
  constructor() {
    this.userService = UserService;

    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.deleteAccount = this.deleteAccount.bind(this);
    this.getUserById = this.getUserById.bind(this);
    this.registerAsDriver = this.registerAsDriver.bind(this);
    this.getVerificationStatus = this.getVerificationStatus.bind(this);
    this.uploadDocument = this.uploadDocument.bind(this);
    this.getDocuments = this.getDocuments.bind(this);
    this.getVehicles = this.getVehicles.bind(this);
    this.addVehicle = this.addVehicle.bind(this);
    this.updateVehicle = this.updateVehicle.bind(this);
    this.deleteVehicle = this.deleteVehicle.bind(this);
    this.getEmergencyContacts = this.getEmergencyContacts.bind(this);
    this.addEmergencyContact = this.addEmergencyContact.bind(this);
    this.updateEmergencyContact = this.updateEmergencyContact.bind(this);
    this.deleteEmergencyContact = this.deleteEmergencyContact.bind(this);
    this.getStatistics = this.getStatistics.bind(this);
    this.getRideHistory = this.getRideHistory.bind(this);
    this.getPreferences = this.getPreferences.bind(this);
    this.updatePreferences = this.updatePreferences.bind(this);

    // Admin routes
    this.adminGetUsers = this.adminGetUsers.bind(this);
    this.adminGetUserById = this.adminGetUserById.bind(this);
    this.adminUpdateUser = this.adminUpdateUser.bind(this);
    this.adminVerifyDriver = this.adminVerifyDriver.bind(this);
    this.adminSuspendUser = this.adminSuspendUser.bind(this);
  }

  // ─── PROFILE MANAGEMENT ──────────────────────────────────────

  /**
   * Get current user's profile
   * GET /api/v1/users/profile
   */
  async getProfile(req, res, next) {
    try {
      const { userId } = req.user.userId;

      const profile = await this.userService.getUserProfile(userId);

      return success(res, 'Profile retrieved', { user: profile });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update current user's profile
   * PUT /api/v1/users/profile
   */
  async updateProfile(req, res, next) {
    try {
      const { userId } = req.user.userId;

      const updatedProfile = await this.userService.updateProfile(userId, req.body);

      logger.info('Profile updated', { userId });

      return success(res, 'Profile updated successfully', { user: updatedProfile });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete (soft) current user's account
   * DELETE /api/v1/users/profile
   */
  async deleteAccount(req, res, next) {
    try {
      const { userId } = req.user;
      const { reason } = req.body || {};

      await this.userService.deleteAccount(userId, reason);

      logger.info('Account deleted', { userId });

      return success(res, 'Account deleted successfully. Sorry to see you go.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a user's public profile by ID
   * GET /api/v1/users/:userId
   */
  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const profile = await this.userService.getPublicProfile(userId);

      return success(res, 'User profile retrieved', { user: profile });
    } catch (error) {
      return next(error);
    }
  }

  // ─── DRIVER REGISTRATION & VERIFICATION ──────────────────────

  /**
   * Register as a driver
   * POST /api/v1/users/driver/register
   */
  async registerAsDriver(req, res, next) {
    try {
      const { userId } = req.user.userId;

      const result = await this.userService.registerAsDriver(userId, req.body);

      logger.info('Driver registration submitted', { userId });

      return created(
        res,
        'Driver registration submitted. Your documents will be reviewed within 24-48 hours.',
        {
          driver: result,
        },
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get driver verification status
   * GET /api/v1/users/driver/status
   */
  async getVerificationStatus(req, res, next) {
    try {
      const { userId } = req.user;

      const status = await this.userService.getDriverVerificationStatus(userId);

      return success(res, 'Verification status retrieved', { verification: status });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Upload a verification document
   * POST /api/v1/users/driver/documents
   */
  async uploadDocument(req, res, next) {
    try {
      const { userId } = req.user;
      const { documentType, documentUrl, expiryDate } = req.body;

      const document = await this.userService.uploadDocument(userId, {
        documentType,
        documentUrl,
        expiryDate,
      });

      logger.info('Document uploaded', { userId, documentType });

      return created(res, 'Document uploaded successfully', { document });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get uploaded documents
   * GET /api/v1/users/driver/documents
   */
  async getDocuments(req, res, next) {
    try {
      const { userId } = req.user;

      const documents = await this.userService.getDocuments(userId);

      return success(res, 'Documents retrieved', { documents });
    } catch (error) {
      return next(error);
    }
  }

  // ─── VEHICLE MANAGEMENT ──────────────────────────────────────

  /**
   * Get user's vehicles
   * GET /api/v1/users/vehicles
   */
  async getVehicles(req, res, next) {
    try {
      const { userId } = req.user;

      const vehicles = await this.userService.getVehicles(userId);

      return success(res, 'Vehicles retrieved', { vehicles });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Add a new vehicle
   * POST /api/v1/users/vehicles
   */
  async addVehicle(req, res, next) {
    try {
      const { userId } = req.user;

      const vehicle = await this.userService.addVehicle(userId, req.body);

      logger.info('Vehicle added', { userId, vehicleId: vehicle.vehicleId });

      return created(res, 'Vehicle added successfully', { vehicle });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update a vehicle
   * PUT /api/v1/users/vehicles/:vehicleId
   */
  async updateVehicle(req, res, next) {
    try {
      const userId = req.user;
      const { vehicleId } = req.params;

      const vehicle = await this.userService.updateVehicle(userId, vehicleId, req.body);

      return success(res, 'Vehicle updated successfully', { vehicle });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete a vehicle
   * DELETE /api/v1/users/vehicles/:vehicleId
   */
  async deleteVehicle(req, res, next) {
    try {
      const { userId } = req.user;
      const { vehicleId } = req.params;

      await this.userService.deleteVehicle(userId, vehicleId);

      return success(res, 'Vehicle removed successfully');
    } catch (error) {
      return next(error);
    }
  }

  // ─── EMERGENCY CONTACTS ──────────────────────────────────────

  /**
   * Get emergency contacts
   * GET /api/v1/users/emergency-contacts
   */
  async getEmergencyContacts(req, res, next) {
    try {
      const { userId } = req.user;

      const contacts = await this.userService.getEmergencyContacts(userId);

      return success(res, 'Emergency contacts retrieved', { contacts });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Add an emergency contact
   * POST /api/v1/users/emergency-contacts
   */
  async addEmergencyContact(req, res, next) {
    try {
      const userId = req.user;

      const contact = await this.userService.addEmergencyContact(userId, req.body);

      logger.info('Emergency contact added', { userId });

      return created(res, 'Emergency contact added', { contact });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update an emergency contact
   * PUT /api/v1/users/emergency-contacts/:contactId
   */
  async updateEmergencyContact(req, res, next) {
    try {
      const { userId } = req.user;
      const { contactId } = req.params;

      const contact = await this.userService.updateEmergencyContact(userId, contactId, req.body);

      return success(res, 'Emergency contact updated', { contact });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete an emergency contact
   * DELETE /api/v1/users/emergency-contacts/:contactId
   */
  async deleteEmergencyContact(req, res, next) {
    try {
      const { userId } = req.user;
      const { contactId } = req.params;

      await this.userService.deleteEmergencyContact(userId, contactId);

      return success(res, 'Emergency contact removed');
    } catch (error) {
      return next(error);
    }
  }

  // ─── STATISTICS & HISTORY ────────────────────────────────────

  /**
   * Get user statistics
   * GET /api/v1/users/statistics
   */
  async getStatistics(req, res, next) {
    try {
      const { userId } = req.user;

      const stats = await this.userService.getUserStatistics(userId);

      return success(res, 'Statistics retrieved', { statistics: stats });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get ride history
   * GET /api/v1/users/ride-history
   */
  async getRideHistory(req, res, next) {
    try {
      const { userId } = req.user;
      const { role = 'passenger', page = 1, limit = 20 } = req.query;

      const history = await this.userService.getRideHistory(userId, {
        role,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Ride history retrieved', history.rides, history.pagination);
    } catch (error) {
      return next(error);
    }
  }

  // ─── PREFERENCES ─────────────────────────────────────────────

  /**
   * Get user preferences
   * GET /api/v1/users/preferences
   */
  async getPreferences(req, res, next) {
    try {
      const { userId } = req.user.userId;

      const preferences = await this.userService.getPreferences(userId);

      return success(res, 'Preferences retrieved', { preferences });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update user preferences
   * PUT /api/v1/users/preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const { userId } = req.user.userId;

      const preferences = await this.userService.updatePreferences(userId, req.body);

      return success(res, 'Preferences updated', { preferences });
    } catch (error) {
      return next(error);
    }
  }

  // ─── ADMIN OPERATIONS ────────────────────────────────────────

  /**
   * Admin: List all users with filters
   * GET /api/v1/admin/users
   */
  async adminGetUsers(req, res, next) {
    try {
      const {
        role,
        isDriver,
        isVerified,
        status,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      let isDriverValue;
      if (isDriver === 'true') {
        isDriverValue = true;
      } else if (isDriver === 'false') {
        isDriverValue = false;
      }

      let isVerifiedValue;
      if (isVerified === 'true') {
        isVerifiedValue = true;
      } else if (isVerified === 'false') {
        isVerifiedValue = false;
      }

      const result = await this.userService.getUsers({
        role,
        isDriver: isDriverValue,
        isVerified: isVerifiedValue,
        status,
        search,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sortBy,
        sortOrder,
      });

      return paginated(res, 'Users retrieved', result.users, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Get a user by ID (full details)
   * GET /api/v1/admin/users/:userId
   */
  async adminGetUserById(req, res, next) {
    try {
      const { userId } = req.params;

      const user = await this.userService.getUserProfile(userId);

      return success(res, 'User details retrieved', { user });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Update user (role, status, etc.)
   * PUT /api/v1/admin/users/:userId
   */
  async adminUpdateUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;

      const updatedUser = await this.userService.adminUpdateUser(userId, req.body, adminId);

      logger.info('Admin updated user', { adminId, targetUserId: userId });

      return success(res, 'User updated', { user: updatedUser });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Verify or reject a driver
   * POST /api/v1/admin/users/:userId/verify-driver
   */
  async adminVerifyDriver(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;
      const { status, reason } = req.body; // status: 'verified' | 'rejected'

      const result = await this.userService.verifyDriver(userId, status, reason, adminId);

      logger.info('Driver verification updated', {
        adminId,
        targetUserId: userId,
        status,
      });

      return success(res, `Driver ${status} successfully`, { driver: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Suspend or reactivate a user
   * POST /api/v1/admin/users/:userId/suspend
   */
  async adminSuspendUser(req, res, next) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;
      const { suspended, reason } = req.body;

      const result = await this.userService.suspendUser(userId, suspended, reason, adminId);

      const action = suspended ? 'suspended' : 'reactivated';
      logger.info(`User ${action}`, { adminId, targetUserId: userId });

      return success(res, `User ${action} successfully`, { user: result });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UserController();
