/**
 * User Service
 * University of Ilorin Carpooling Platform
 *
 * Handles user profile management, document verification,
 * emergency contacts, driver registration, and user preferences.
 *
 * @module services/UserService
 */

const { randomUUID } = require('crypto');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const VehicleRepository = require('../../infrastructure/database/repositories/VehicleRepository');
const { logger } = require('../../shared/utils/logger');
const { formatDate, now, isExpired } = require('../../shared/utils/dateTime');
const {
  validateUserProfile,
  validateVehicle,
  validateEmergencyContact,
} = require('../../shared/utils/validation');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} = require('../../shared/errors');
const { ERROR_CODES, ERROR_MESSAGES } = require('../../shared/constants/errors');
const { USER_EVENTS } = require('../../shared/constants/events');

/**
 * Document verification status
 */
const DOCUMENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

/**
 * Driver verification status
 */
const DRIVER_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
};

/**
 * UserService class
 * Manages user-related operations
 */
class UserService {
  constructor() {
    this.userRepository = new UserRepository();
    this.vehicleRepository = new VehicleRepository();
    this.serviceName = 'UserService';
  }

  // ==================== Profile Management ====================

  /**
   * Get user profile by ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User profile
   */
  async getProfile(userId, options = {}) {
    logger.info('Fetching user profile', {
      action: USER_EVENTS.PROFILE_VIEWED,
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      // Build profile response
      const profile = this._buildProfileResponse(user);

      // Include additional data based on options
      if (options.includeVehicles && user.isDriver) {
        profile.vehicles = await this.vehicleRepository.getUserVehicles(userId);
      }

      if (options.includeStatistics) {
        profile.statistics = await this.userRepository.getUserStatistics(userId);
      }

      if (options.includeEmergencyContacts) {
        profile.emergencyContacts = user.emergencyContacts || [];
      }

      return profile;
    } catch (error) {
      logger.error('Failed to fetch user profile', {
        action: 'PROFILE_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get public profile (for other users to view)
   * @param {string} userId - User ID to view
   * @param {string} viewerId - ID of user viewing the profile
   * @returns {Promise<Object>} Public profile data
   */
  async getPublicProfile(userId, viewerId) {
    logger.info('Fetching public profile', {
      action: 'PUBLIC_PROFILE_VIEWED',
      userId,
      viewerId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      // Return limited public information
      return {
        userId: user.userId,
        firstName: user.firstName,
        lastName: `${user.lastName.charAt(0)}.`, // Privacy: only show initial
        role: user.role,
        isDriver: user.isDriver,
        isVerified: user.isVerified,
        driverVerificationStatus: user.driverVerificationStatus,
        averageRating: user.averageRating || 0,
        totalRatings: user.totalRatings || 0,
        totalRides: user.totalRidesCompleted || 0,
        memberSince: user.createdAt,
        profilePhoto: user.profilePhoto,
        // Driver-specific public info
        ...(user.isDriver && {
          vehicleInfo: await this._getPublicVehicleInfo(userId),
        }),
      };
    } catch (error) {
      logger.error('Failed to fetch public profile', {
        action: 'PUBLIC_PROFILE_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfile(userId, updates) {
    logger.info('Updating user profile', {
      action: USER_EVENTS.PROFILE_UPDATED,
      userId,
      fields: Object.keys(updates),
    });

    try {
      // Validate updates
      const { error, value } = validateUserProfile(updates);
      if (error) {
        throw new ValidationError('Profile validation failed', error.details);
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      // Handle email change
      if (value.email && value.email !== user.email) {
        const existingUser = await this.userRepository.findByEmail(value.email);
        if (existingUser) {
          throw new ConflictError(
            ERROR_MESSAGES[ERROR_CODES.USER_EMAIL_EXISTS],
            ERROR_CODES.USER_EMAIL_EXISTS,
          );
        }
        // Email change requires re-verification
        value.isVerified = false;
        value.emailChangedAt = formatDate(now());
      }

      // Handle phone change
      if (value.phone && value.phone !== user.phone) {
        value.phoneVerified = false;
        value.phoneChangedAt = formatDate(now());
      }

      // Prevent updating protected fields
      const protectedFields = [
        'userId',
        'passwordHash',
        'role',
        'isDriver',
        'verificationToken',
        'passwordResetToken',
        'averageRating',
        'totalRatings',
        'createdAt',
      ];
      protectedFields.forEach((field) => delete value[field]);

      // Update profile
      value.updatedAt = formatDate(now());
      const updatedUser = await this.userRepository.updateProfile(userId, value);

      logger.info('Profile updated successfully', {
        action: USER_EVENTS.PROFILE_UPDATED,
        userId,
        updatedFields: Object.keys(value),
      });

      return this._buildProfileResponse(updatedUser);
    } catch (error) {
      logger.error('Failed to update profile', {
        action: 'PROFILE_UPDATE_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update profile photo
   * @param {string} userId - User ID
   * @param {string} photoUrl - URL to profile photo
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfilePhoto(userId, photoUrl) {
    logger.info('Updating profile photo', {
      action: 'PROFILE_PHOTO_UPDATED',
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      const updatedUser = await this.userRepository.updateProfile(userId, {
        profilePhoto: photoUrl,
        profilePhotoUpdatedAt: formatDate(now()),
      });

      return {
        profilePhoto: updatedUser.profilePhoto,
        message: 'Profile photo updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update profile photo', {
        action: 'PROFILE_PHOTO_UPDATE_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete user account (soft delete)
   * @param {string} userId - User ID
   * @param {string} reason - Deletion reason
   * @returns {Promise<Object>} Confirmation
   */
  async deleteAccount(userId, reason = '') {
    logger.info('Account deletion requested', {
      action: USER_EVENTS.ACCOUNT_DELETED,
      userId,
      reason,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      // Soft delete - mark as deleted but retain data for compliance
      await this.userRepository.updateProfile(userId, {
        isActive: false,
        isDeleted: true,
        deletedAt: formatDate(now()),
        deletionReason: reason,
        // Anonymize personal data
        email: `deleted_${userId}@deleted.local`,
        phone: null,
        firstName: 'Deleted',
        lastName: 'User',
      });

      // Invalidate all sessions
      await this.userRepository.invalidateAllRefreshTokens(userId);

      logger.info('Account deleted successfully', {
        action: USER_EVENTS.ACCOUNT_DELETED,
        userId,
      });

      return {
        message: 'Account deleted successfully',
        deletedAt: formatDate(now()),
      };
    } catch (error) {
      logger.error('Failed to delete account', {
        action: 'ACCOUNT_DELETE_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Driver Registration ====================

  /**
   * Register as a driver
   * @param {string} userId - User ID
   * @param {Object} driverData - Driver registration data
   * @returns {Promise<Object>} Driver registration result
   */
  async registerAsDriver(userId, driverData) {
    logger.info('Driver registration started', {
      action: USER_EVENTS.DRIVER_REGISTERED,
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (!user.isVerified) {
        throw new ForbiddenError(
          'Email must be verified before registering as a driver',
          ERROR_CODES.USER_NOT_VERIFIED,
        );
      }

      if (user.isDriver) {
        throw new ConflictError(
          'User is already registered as a driver',
          ERROR_CODES.USER_ALREADY_DRIVER,
        );
      }

      const { licenseNumber, licenseExpiry, vehicleData } = driverData;

      // Validate license data
      if (!licenseNumber || !licenseExpiry) {
        throw new ValidationError('License information is required', [
          { field: 'licenseNumber', message: 'License number is required' },
          { field: 'licenseExpiry', message: 'License expiry date is required' },
        ]);
      }

      // Check license expiry
      if (isExpired(licenseExpiry)) {
        throw new ValidationError('License has expired', [
          { field: 'licenseExpiry', message: 'License has expired' },
        ]);
      }

      // Validate and create vehicle
      const { error: vehicleError, value: validatedVehicle } = validateVehicle(vehicleData);
      if (vehicleError) {
        throw new ValidationError('Vehicle validation failed', vehicleError.details);
      }

      // Create vehicle
      const vehicleId = randomUUID();
      const vehicle = await this.vehicleRepository.create(userId, {
        vehicleId,
        ...validatedVehicle,
        isActive: true,
        isPrimary: true,
        verificationStatus: DOCUMENT_STATUS.PENDING,
        createdAt: formatDate(now()),
      });

      // Update user as driver
      await this.userRepository.updateProfile(userId, {
        isDriver: true,
        driverVerificationStatus: DRIVER_STATUS.PENDING,
        licenseNumber,
        licenseExpiry: formatDate(licenseExpiry),
        driverRegisteredAt: formatDate(now()),
        primaryVehicleId: vehicleId,
      });

      logger.info('Driver registration completed', {
        action: USER_EVENTS.DRIVER_REGISTERED,
        userId,
        vehicleId,
      });

      return {
        message: 'Driver registration submitted. Pending document verification.',
        driver: {
          isDriver: true,
          verificationStatus: DRIVER_STATUS.PENDING,
          licenseNumber,
          licenseExpiry,
        },
        vehicle,
        nextSteps: [
          'Upload driver license document',
          'Upload vehicle registration document',
          'Upload vehicle insurance document',
          'Wait for admin verification (1-2 business days)',
        ],
      };
    } catch (error) {
      logger.error('Driver registration failed', {
        action: 'DRIVER_REGISTRATION_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get driver verification status
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Verification status
   */
  async getDriverVerificationStatus(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (!user.isDriver) {
        return {
          isDriver: false,
          message: 'User is not registered as a driver',
        };
      }

      // Get documents status
      const documents = await this.userRepository.getDriverDocuments(userId);
      const vehicles = await this.vehicleRepository.getUserVehicles(userId);

      return {
        isDriver: true,
        verificationStatus: user.driverVerificationStatus,
        licenseNumber: user.licenseNumber,
        licenseExpiry: user.licenseExpiry,
        licenseExpired: isExpired(user.licenseExpiry),
        documents: documents.map((doc) => ({
          type: doc.documentType,
          status: doc.status,
          uploadedAt: doc.uploadedAt,
          reviewedAt: doc.reviewedAt,
          rejectionReason: doc.rejectionReason,
        })),
        vehicles: vehicles.map((v) => ({
          vehicleId: v.vehicleId,
          make: v.make,
          model: v.model,
          plateNumber: v.plateNumber,
          verificationStatus: v.verificationStatus,
          isPrimary: v.isPrimary,
        })),
        canCreateRides: user.driverVerificationStatus === DRIVER_STATUS.VERIFIED,
      };
    } catch (error) {
      logger.error('Failed to get driver verification status', {
        action: 'DRIVER_STATUS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Document Verification ====================

  /**
   * Upload driver document
   * @param {string} userId - User ID
   * @param {Object} documentData - Document data
   * @returns {Promise<Object>} Upload result
   */
  async uploadDriverDocument(userId, documentData) {
    logger.info('Driver document upload', {
      action: 'DRIVER_DOCUMENT_UPLOADED',
      userId,
      documentType: documentData.documentType,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (!user.isDriver) {
        throw new ForbiddenError(
          'User must be registered as a driver first',
          ERROR_CODES.USER_NOT_DRIVER,
        );
      }

      const { documentType, documentUrl, expiryDate } = documentData;

      // Valid document types
      const validTypes = ['license', 'vehicle_registration', 'insurance', 'inspection'];
      if (!validTypes.includes(documentType)) {
        throw new ValidationError('Invalid document type', [
          { field: 'documentType', message: `Must be one of: ${validTypes.join(', ')}` },
        ]);
      }

      const documentId = randomUUID();
      await this.userRepository.addDriverDocument(userId, {
        documentId,
        documentType,
        documentUrl,
        expiryDate: expiryDate ? formatDate(expiryDate) : null,
        status: DOCUMENT_STATUS.PENDING,
        uploadedAt: formatDate(now()),
      });

      logger.info('Document uploaded successfully', {
        action: 'DRIVER_DOCUMENT_UPLOADED',
        userId,
        documentId,
        documentType,
      });

      return {
        documentId,
        documentType,
        status: DOCUMENT_STATUS.PENDING,
        message: 'Document uploaded successfully. Pending review.',
      };
    } catch (error) {
      logger.error('Document upload failed', {
        action: 'DRIVER_DOCUMENT_UPLOAD_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verify driver document (Admin only)
   * @param {string} documentId - Document ID
   * @param {string} adminId - Admin user ID
   * @param {Object} decision - Verification decision
   * @returns {Promise<Object>} Verification result
   */
  async verifyDriverDocument(documentId, adminId, decision) {
    logger.info('Document verification', {
      action: 'DOCUMENT_VERIFICATION',
      documentId,
      adminId,
      approved: decision.approved,
    });

    try {
      const { approved, rejectionReason } = decision;

      const status = approved ? DOCUMENT_STATUS.APPROVED : DOCUMENT_STATUS.REJECTED;

      const document = await this.userRepository.updateDriverDocument(documentId, {
        status,
        reviewedBy: adminId,
        reviewedAt: formatDate(now()),
        rejectionReason: !approved ? rejectionReason : null,
      });

      // Check if all required documents are approved
      const { userId } = document;
      await this._checkDriverVerificationComplete(userId);

      logger.info('Document verification completed', {
        action: 'DOCUMENT_VERIFIED',
        documentId,
        status,
      });

      return {
        documentId,
        status,
        message: approved ? 'Document approved' : `Document rejected: ${rejectionReason}`,
      };
    } catch (error) {
      logger.error('Document verification failed', {
        action: 'DOCUMENT_VERIFICATION_FAILED',
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Emergency Contacts ====================

  /**
   * Add emergency contact
   * @param {string} userId - User ID
   * @param {Object} contactData - Emergency contact data
   * @returns {Promise<Object>} Added contact
   */
  async addEmergencyContact(userId, contactData) {
    logger.info('Adding emergency contact', {
      action: 'EMERGENCY_CONTACT_ADDED',
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      // Validate contact data
      const { error, value } = validateEmergencyContact(contactData);
      if (error) {
        throw new ValidationError('Contact validation failed', error.details);
      }

      // Check max contacts limit (3)
      const existingContacts = user.emergencyContacts || [];
      if (existingContacts.length >= 3) {
        throw new BadRequestError(
          'Maximum of 3 emergency contacts allowed',
          ERROR_CODES.MAX_EMERGENCY_CONTACTS,
        );
      }

      // Check for duplicate phone
      const phoneExists = existingContacts.some((c) => c.phone === value.phone);
      if (phoneExists) {
        throw new ConflictError(
          'Emergency contact with this phone number already exists',
          ERROR_CODES.DUPLICATE_EMERGENCY_CONTACT,
        );
      }

      const contactId = randomUUID();
      const contact = {
        contactId,
        ...value,
        isPrimary: existingContacts.length === 0, // First contact is primary
        createdAt: formatDate(now()),
      };

      await this.userRepository.addEmergencyContact(userId, contact);

      logger.info('Emergency contact added', {
        action: 'EMERGENCY_CONTACT_ADDED',
        userId,
        contactId,
      });

      return {
        contact,
        message: 'Emergency contact added successfully',
      };
    } catch (error) {
      logger.error('Failed to add emergency contact', {
        action: 'EMERGENCY_CONTACT_ADD_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update emergency contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @param {Object} updates - Contact updates
   * @returns {Promise<Object>} Updated contact
   */
  async updateEmergencyContact(userId, contactId, updates) {
    logger.info('Updating emergency contact', {
      action: 'EMERGENCY_CONTACT_UPDATED',
      userId,
      contactId,
    });

    try {
      const { error, value } = validateEmergencyContact(updates);
      if (error) {
        throw new ValidationError('Contact validation failed', error.details);
      }

      const contact = await this.userRepository.updateEmergencyContact(userId, contactId, {
        ...value,
        updatedAt: formatDate(now()),
      });

      if (!contact) {
        throw new NotFoundError(
          'Emergency contact not found',
          ERROR_CODES.EMERGENCY_CONTACT_NOT_FOUND,
        );
      }

      return {
        contact,
        message: 'Emergency contact updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update emergency contact', {
        action: 'EMERGENCY_CONTACT_UPDATE_FAILED',
        userId,
        contactId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove emergency contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID
   * @returns {Promise<Object>} Removal confirmation
   */
  async removeEmergencyContact(userId, contactId) {
    logger.info('Removing emergency contact', {
      action: 'EMERGENCY_CONTACT_REMOVED',
      userId,
      contactId,
    });

    try {
      await this.userRepository.removeEmergencyContact(userId, contactId);

      return {
        message: 'Emergency contact removed successfully',
      };
    } catch (error) {
      logger.error('Failed to remove emergency contact', {
        action: 'EMERGENCY_CONTACT_REMOVE_FAILED',
        userId,
        contactId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Set primary emergency contact
   * @param {string} userId - User ID
   * @param {string} contactId - Contact ID to set as primary
   * @returns {Promise<Object>} Update confirmation
   */
  async setPrimaryEmergencyContact(userId, contactId) {
    logger.info('Setting primary emergency contact', {
      action: 'PRIMARY_CONTACT_SET',
      userId,
      contactId,
    });

    try {
      await this.userRepository.setPrimaryEmergencyContact(userId, contactId);

      return {
        message: 'Primary emergency contact updated',
        primaryContactId: contactId,
      };
    } catch (error) {
      logger.error('Failed to set primary contact', {
        action: 'PRIMARY_CONTACT_SET_FAILED',
        userId,
        contactId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get emergency contacts
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of emergency contacts
   */
  async getEmergencyContacts(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      const contacts = user.emergencyContacts || [];

      // Sort to put primary first
      return contacts.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    } catch (error) {
      logger.error('Failed to get emergency contacts', {
        action: 'EMERGENCY_CONTACTS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== User Statistics ====================

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserStatistics(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      const stats = await this.userRepository.getUserStatistics(userId);

      return {
        // As passenger
        passenger: {
          totalBookings: stats.totalBookings || 0,
          completedRides: stats.completedRidesAsPassenger || 0,
          cancelledBookings: stats.cancelledBookings || 0,
          noShowCount: stats.noShowCount || 0,
          totalSpent: stats.totalSpent || 0,
        },
        // As driver
        ...(user.isDriver && {
          driver: {
            totalRidesOffered: stats.totalRidesOffered || 0,
            completedRides: stats.completedRidesAsDriver || 0,
            cancelledRides: stats.cancelledRidesAsDriver || 0,
            totalEarnings: stats.totalEarnings || 0,
            totalPassengersCarried: stats.totalPassengersCarried || 0,
          },
        }),
        // Ratings
        ratings: {
          averageRating: user.averageRating || 0,
          totalRatings: user.totalRatings || 0,
          ratingBreakdown: stats.ratingBreakdown || {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0,
          },
        },
        // Account
        account: {
          memberSince: user.createdAt,
          isVerified: user.isVerified,
          isDriver: user.isDriver,
          driverVerificationStatus: user.driverVerificationStatus,
        },
      };
    } catch (error) {
      logger.error('Failed to get user statistics', {
        action: 'USER_STATS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Vehicle Management ====================

  /**
   * Add vehicle to driver profile
   * @param {string} userId - User ID
   * @param {Object} vehicleData - Vehicle data
   * @returns {Promise<Object>} Added vehicle
   */
  async addVehicle(userId, vehicleData) {
    logger.info('Adding vehicle', {
      action: 'VEHICLE_ADDED',
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (!user.isDriver) {
        throw new ForbiddenError(
          'User must be a registered driver to add vehicles',
          ERROR_CODES.USER_NOT_DRIVER,
        );
      }

      // Check max vehicles (3)
      const existingVehicles = await this.vehicleRepository.getUserVehicles(userId);
      if (existingVehicles.length >= 3) {
        throw new BadRequestError(
          'Maximum of 3 vehicles allowed',
          ERROR_CODES.MAX_VEHICLES_REACHED,
        );
      }

      // Validate vehicle
      const { error, value } = validateVehicle(vehicleData);
      if (error) {
        throw new ValidationError('Vehicle validation failed', error.details);
      }

      // Check for duplicate plate number
      const existingPlate = await this.vehicleRepository.findByPlateNumber(value.plateNumber);
      if (existingPlate) {
        throw new ConflictError(
          'Vehicle with this plate number already exists',
          ERROR_CODES.VEHICLE_PLATE_EXISTS,
        );
      }

      const vehicleId = randomUUID();
      const vehicle = await this.vehicleRepository.create(userId, {
        vehicleId,
        ...value,
        isActive: true,
        isPrimary: existingVehicles.length === 0,
        verificationStatus: DOCUMENT_STATUS.PENDING,
        createdAt: formatDate(now()),
      });

      logger.info('Vehicle added successfully', {
        action: 'VEHICLE_ADDED',
        userId,
        vehicleId,
      });

      return {
        vehicle,
        message: 'Vehicle added successfully. Pending verification.',
      };
    } catch (error) {
      logger.error('Failed to add vehicle', {
        action: 'VEHICLE_ADD_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update vehicle
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} updates - Vehicle updates
   * @returns {Promise<Object>} Updated vehicle
   */
  async updateVehicle(userId, vehicleId, updates) {
    logger.info('Updating vehicle', {
      action: 'VEHICLE_UPDATED',
      userId,
      vehicleId,
    });

    try {
      const vehicle = await this.vehicleRepository.findById(vehicleId);
      if (!vehicle) {
        throw new NotFoundError('Vehicle not found', ERROR_CODES.VEHICLE_NOT_FOUND);
      }

      if (vehicle.userId !== userId) {
        throw new ForbiddenError('Not authorized to update this vehicle', ERROR_CODES.FORBIDDEN);
      }

      // Validate updates
      const allowedUpdates = ['color', 'insuranceNumber', 'insuranceExpiry', 'isActive'];
      const filteredUpdates = {};

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = formatDate(now());

      const updatedVehicle = await this.vehicleRepository.update(vehicleId, filteredUpdates);

      return {
        vehicle: updatedVehicle,
        message: 'Vehicle updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update vehicle', {
        action: 'VEHICLE_UPDATE_FAILED',
        userId,
        vehicleId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove vehicle
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Removal confirmation
   */
  async removeVehicle(userId, vehicleId) {
    logger.info('Removing vehicle', {
      action: 'VEHICLE_REMOVED',
      userId,
      vehicleId,
    });

    try {
      const vehicle = await this.vehicleRepository.findById(vehicleId);
      if (!vehicle) {
        throw new NotFoundError('Vehicle not found', ERROR_CODES.VEHICLE_NOT_FOUND);
      }

      if (vehicle.userId !== userId) {
        throw new ForbiddenError('Not authorized to remove this vehicle', ERROR_CODES.FORBIDDEN);
      }

      // Check if vehicle has active rides
      // This would require RideRepository - simplified for now
      if (vehicle.hasActiveRides) {
        throw new BadRequestError(
          'Cannot remove vehicle with active rides',
          ERROR_CODES.VEHICLE_HAS_ACTIVE_RIDES,
        );
      }

      await this.vehicleRepository.delete(vehicleId);

      // If it was the primary vehicle, set another as primary
      if (vehicle.isPrimary) {
        const remainingVehicles = await this.vehicleRepository.getUserVehicles(userId);
        if (remainingVehicles.length > 0) {
          await this.vehicleRepository.setPrimary(userId, remainingVehicles[0].vehicleId);
        }
      }

      return {
        message: 'Vehicle removed successfully',
      };
    } catch (error) {
      logger.error('Failed to remove vehicle', {
        action: 'VEHICLE_REMOVE_FAILED',
        userId,
        vehicleId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user vehicles
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of vehicles
   */
  async getVehicles(userId) {
    try {
      const vehicles = await this.vehicleRepository.getUserVehicles(userId);
      return vehicles.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    } catch (error) {
      logger.error('Failed to get vehicles', {
        action: 'VEHICLES_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Set primary vehicle
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Update confirmation
   */
  async setPrimaryVehicle(userId, vehicleId) {
    logger.info('Setting primary vehicle', {
      action: 'PRIMARY_VEHICLE_SET',
      userId,
      vehicleId,
    });

    try {
      const vehicle = await this.vehicleRepository.findById(vehicleId);
      if (!vehicle || vehicle.userId !== userId) {
        throw new NotFoundError('Vehicle not found', ERROR_CODES.VEHICLE_NOT_FOUND);
      }

      await this.vehicleRepository.setPrimary(userId, vehicleId);
      await this.userRepository.updateProfile(userId, { primaryVehicleId: vehicleId });

      return {
        message: 'Primary vehicle updated',
        primaryVehicleId: vehicleId,
      };
    } catch (error) {
      logger.error('Failed to set primary vehicle', {
        action: 'PRIMARY_VEHICLE_SET_FAILED',
        userId,
        vehicleId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Driver Documents ====================

  /**
   * Get driver documents
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of driver documents
   */
  async getDriverDocuments(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (!user.isDriver) {
        throw new ForbiddenError(
          'User must be registered as a driver',
          ERROR_CODES.USER_NOT_DRIVER,
        );
      }

      const documents = await this.userRepository.getDriverDocuments(userId);
      return documents;
    } catch (error) {
      logger.error('Failed to get driver documents', {
        action: 'DRIVER_DOCUMENTS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride History ====================

  /**
   * Get ride history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options (role, page, limit)
   * @returns {Promise<Object>} Ride history with pagination
   */
  async getRideHistory(userId, options = {}) {
    const { role = 'passenger', page = 1, limit = 20 } = options;

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      const result = await this.userRepository.getRideHistory(userId, { role, page, limit });

      return {
        rides: result.items || [],
        pagination: {
          page,
          limit,
          total: result.total || 0,
          totalPages: Math.ceil((result.total || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get ride history', {
        action: 'RIDE_HISTORY_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Preferences ====================

  /**
   * Get user preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User preferences
   */
  async getPreferences(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      return user.preferences || {
        notifications: { email: true, push: true, sms: false },
        ride: { musicAllowed: true, smokingAllowed: false, petsAllowed: false, maxDetour: 10 },
        privacy: { showPhone: false, showEmail: false },
      };
    } catch (error) {
      logger.error('Failed to get preferences', {
        action: 'PREFERENCES_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updatePreferences(userId, preferences) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      const currentPreferences = user.preferences || {};
      const mergedPreferences = {
        ...currentPreferences,
        ...preferences,
        updatedAt: formatDate(now()),
      };

      await this.userRepository.updateProfile(userId, { preferences: mergedPreferences });

      return mergedPreferences;
    } catch (error) {
      logger.error('Failed to update preferences', {
        action: 'PREFERENCES_UPDATE_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Admin Operations ====================

  /**
   * Admin: List users with filters and pagination
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Users list with pagination
   */
  async getUsers(filters = {}) {
    const { role, isDriver, isVerified, status, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

    try {
      const result = await this.userRepository.findAll({
        role,
        isDriver,
        isVerified,
        status,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      return {
        users: (result.items || []).map((user) => this._buildProfileResponse(user)),
        pagination: {
          page,
          limit,
          total: result.total || 0,
          totalPages: Math.ceil((result.total || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to list users', {
        action: 'ADMIN_LIST_USERS_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Admin: Update a user's profile
   * @param {string} userId - Target user ID
   * @param {Object} updates - Fields to update
   * @param {string} adminId - Admin performing the action
   * @returns {Promise<Object>} Updated user profile
   */
  async adminUpdateUser(userId, updates, adminId) {
    logger.info('Admin updating user', {
      action: 'ADMIN_USER_UPDATED',
      adminId,
      targetUserId: userId,
      fields: Object.keys(updates),
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      // Admin-allowed fields
      const allowedFields = ['role', 'isActive', 'isVerified', 'isDriver', 'driverVerificationStatus'];
      const filteredUpdates = {};
      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      filteredUpdates.updatedAt = formatDate(now());
      filteredUpdates.updatedBy = adminId;

      const updatedUser = await this.userRepository.updateProfile(userId, filteredUpdates);

      return this._buildProfileResponse(updatedUser);
    } catch (error) {
      logger.error('Admin user update failed', {
        action: 'ADMIN_USER_UPDATE_FAILED',
        adminId,
        targetUserId: userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Admin: Verify or reject a driver
   * @param {string} userId - Driver user ID
   * @param {string} status - 'verified' or 'rejected'
   * @param {string} reason - Reason (required for rejection)
   * @param {string} adminId - Admin performing the action
   * @returns {Promise<Object>} Updated driver info
   */
  async verifyDriver(userId, status, reason, adminId) {
    logger.info('Admin verifying driver', {
      action: 'ADMIN_DRIVER_VERIFIED',
      adminId,
      targetUserId: userId,
      status,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (!user.isDriver) {
        throw new BadRequestError(
          'User is not registered as a driver',
          ERROR_CODES.USER_NOT_DRIVER,
        );
      }

      const validStatuses = [DRIVER_STATUS.VERIFIED, DRIVER_STATUS.REJECTED];
      if (!validStatuses.includes(status)) {
        throw new ValidationError('Invalid verification status', [
          { field: 'status', message: `Must be one of: ${validStatuses.join(', ')}` },
        ]);
      }

      if (status === DRIVER_STATUS.REJECTED && !reason) {
        throw new ValidationError('Reason is required when rejecting a driver', [
          { field: 'reason', message: 'Rejection reason is required' },
        ]);
      }

      const updateData = {
        driverVerificationStatus: status,
        driverVerifiedAt: formatDate(now()),
        driverVerifiedBy: adminId,
        updatedAt: formatDate(now()),
      };

      if (status === DRIVER_STATUS.REJECTED) {
        updateData.driverRejectionReason = reason;
      }

      const updatedUser = await this.userRepository.updateProfile(userId, updateData);

      return {
        userId: updatedUser.userId,
        isDriver: updatedUser.isDriver,
        driverVerificationStatus: status,
        reason: status === DRIVER_STATUS.REJECTED ? reason : undefined,
      };
    } catch (error) {
      logger.error('Driver verification failed', {
        action: 'ADMIN_DRIVER_VERIFY_FAILED',
        adminId,
        targetUserId: userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Admin: Suspend or reactivate a user
   * @param {string} userId - Target user ID
   * @param {boolean} suspended - Whether to suspend (true) or reactivate (false)
   * @param {string} reason - Reason for suspension
   * @param {string} adminId - Admin performing the action
   * @returns {Promise<Object>} Updated user info
   */
  async suspendUser(userId, suspended, reason, adminId) {
    logger.info(`Admin ${suspended ? 'suspending' : 'reactivating'} user`, {
      action: suspended ? 'ADMIN_USER_SUSPENDED' : 'ADMIN_USER_REACTIVATED',
      adminId,
      targetUserId: userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.USER_NOT_FOUND],
          ERROR_CODES.USER_NOT_FOUND,
        );
      }

      if (suspended && !reason) {
        throw new ValidationError('Reason is required when suspending a user', [
          { field: 'reason', message: 'Suspension reason is required' },
        ]);
      }

      const updateData = {
        isActive: !suspended,
        isSuspended: suspended,
        updatedAt: formatDate(now()),
        suspendedBy: suspended ? adminId : null,
        suspendedAt: suspended ? formatDate(now()) : null,
        suspensionReason: suspended ? reason : null,
      };

      if (!suspended) {
        updateData.reactivatedBy = adminId;
        updateData.reactivatedAt = formatDate(now());
      }

      const updatedUser = await this.userRepository.updateProfile(userId, updateData);

      // If suspending, invalidate all sessions
      if (suspended) {
        await this.userRepository.invalidateAllRefreshTokens(userId);
      }

      return this._buildProfileResponse(updatedUser);
    } catch (error) {
      logger.error('User suspension/reactivation failed', {
        action: 'ADMIN_USER_SUSPEND_FAILED',
        adminId,
        targetUserId: userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Build profile response
   * @private
   */
  _buildProfileResponse(user) {
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      phoneVerified: user.phoneVerified || false,
      role: user.role,
      isVerified: user.isVerified,
      isDriver: user.isDriver,
      isActive: user.isActive,
      profilePhoto: user.profilePhoto,
      averageRating: user.averageRating || 0,
      totalRatings: user.totalRatings || 0,
      // Role-specific fields
      ...(user.role === 'student' && {
        matricNumber: user.matricNumber,
        department: user.department,
        faculty: user.faculty,
        level: user.level,
      }),
      ...(user.role === 'staff' && {
        staffId: user.staffId,
        department: user.department,
        designation: user.designation,
      }),
      // Driver-specific fields
      ...(user.isDriver && {
        driverVerificationStatus: user.driverVerificationStatus,
        licenseNumber: user.licenseNumber,
        licenseExpiry: user.licenseExpiry,
      }),
      // Timestamps
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Get public vehicle info
   * @private
   */
  async _getPublicVehicleInfo(userId) {
    try {
      const vehicles = await this.vehicleRepository.getUserVehicles(userId);
      const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0];

      if (!primaryVehicle) return null;

      return {
        make: primaryVehicle.make,
        model: primaryVehicle.model,
        color: primaryVehicle.color,
        capacity: primaryVehicle.capacity,
        plateNumber: `${primaryVehicle.plateNumber.substring(0, 3)}***`, // Partial for privacy
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if driver verification is complete
   * @private
   */
  async _checkDriverVerificationComplete(userId) {
    const documents = await this.userRepository.getDriverDocuments(userId);
    const vehicles = await this.vehicleRepository.getUserVehicles(userId);

    // Required document types
    const requiredDocs = ['license', 'vehicle_registration', 'insurance'];
    const approvedDocs = documents.filter((d) => d.status === DOCUMENT_STATUS.APPROVED);
    const approvedTypes = approvedDocs.map((d) => d.documentType);

    const allDocsApproved = requiredDocs.every((type) => approvedTypes.includes(type));
    const hasVerifiedVehicle = vehicles.some(
      (v) => v.verificationStatus === DOCUMENT_STATUS.APPROVED,
    );

    if (allDocsApproved && hasVerifiedVehicle) {
      await this.userRepository.updateProfile(userId, {
        driverVerificationStatus: DRIVER_STATUS.VERIFIED,
        driverVerifiedAt: formatDate(now()),
      });

      logger.info('Driver verification complete', {
        action: 'DRIVER_VERIFIED',
        userId,
      });
    }
  }
}

module.exports = UserService;
