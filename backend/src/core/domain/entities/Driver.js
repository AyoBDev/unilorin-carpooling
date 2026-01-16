/**
 * Driver Entity - Represents a driver (can be student or staff)
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate } = require('./utils/entityHelpers');

class Driver {
  constructor({
    driverId,
    userId, // Reference to User (Student or Staff)
    userType, // 'student' | 'staff'

    // License Information
    licenseNumber,
    licenseType = 'private', // 'private' | 'commercial'
    licenseIssueDate,
    licenseExpiryDate,
    licenseDocumentUrl,
    licenseVerified = false,

    // Vehicle Information (reference to Vehicle entity)
    vehicleId = null,

    // Driver Status
    isActive = true,
    isAvailable = false,
    verificationStatus = 'pending', // 'pending' | 'verified' | 'rejected' | 'suspended'
    verifiedBy = null, // Staff ID who verified
    verifiedAt = null,
    verificationComments = null,

    // Driver Statistics
    totalRides = 0,
    completedRides = 0,
    cancelledRides = 0,
    totalEarnings = 0,
    totalDistance = 0, // in kilometers
    totalPassengers = 0,
    rating = 0,
    totalRatings = 0,

    // Preferences
    maxWaitTime = 5, // minutes
    preferredRoutes = [],
    blockedUsers = [],
    acceptsCash = true,
    acceptsTransfer = true,
    minimumRating = 3.0, // Minimum passenger rating to accept

    // Schedule
    availabilitySchedule = {
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    },

    // Compliance
    insuranceDocumentUrl = null,
    insuranceExpiryDate = null,
    insuranceVerified = false,
    roadworthinessDocumentUrl = null,
    roadworthinessExpiryDate = null,
    roadworthinessVerified = false,

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    lastActiveAt = null,
    suspendedAt = null,
    suspensionReason = null,
  }) {
    this.driverId = driverId;
    this.userId = userId;
    this.userType = userType;

    // License Information
    this.licenseNumber = licenseNumber;
    this.licenseType = licenseType;
    this.licenseIssueDate =
      licenseIssueDate instanceof Date ? licenseIssueDate : new Date(licenseIssueDate);
    this.licenseExpiryDate =
      licenseExpiryDate instanceof Date ? licenseExpiryDate : new Date(licenseExpiryDate);
    this.licenseDocumentUrl = licenseDocumentUrl;
    this.licenseVerified = licenseVerified;

    // Vehicle
    this.vehicleId = vehicleId;

    // Status
    this.isActive = isActive;
    this.isAvailable = isAvailable;
    this.verificationStatus = verificationStatus;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = parseDate(verifiedAt);
    this.verificationComments = verificationComments;

    // Statistics
    this.totalRides = totalRides;
    this.completedRides = completedRides;
    this.cancelledRides = cancelledRides;
    this.totalEarnings = totalEarnings;
    this.totalDistance = totalDistance;
    this.totalPassengers = totalPassengers;
    this.rating = rating;
    this.totalRatings = totalRatings;

    // Preferences
    this.maxWaitTime = maxWaitTime;
    this.preferredRoutes = preferredRoutes;
    this.blockedUsers = blockedUsers;
    this.acceptsCash = acceptsCash;
    this.acceptsTransfer = acceptsTransfer;
    this.minimumRating = minimumRating;

    // Schedule
    this.availabilitySchedule = availabilitySchedule;

    // Compliance
    this.insuranceDocumentUrl = insuranceDocumentUrl;
    this.insuranceExpiryDate = parseDate(insuranceExpiryDate);
    this.insuranceVerified = insuranceVerified;
    this.roadworthinessDocumentUrl = roadworthinessDocumentUrl;
    this.roadworthinessExpiryDate = parseDate(roadworthinessExpiryDate);
    this.roadworthinessVerified = roadworthinessVerified;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.lastActiveAt = parseDate(lastActiveAt);
    this.suspendedAt = parseDate(suspendedAt);
    this.suspensionReason = suspensionReason;

    // Validate on creation
    this.validate();
  }

  // Getters
  get isVerified() {
    return this.verificationStatus === 'verified';
  }

  get isSuspended() {
    return this.verificationStatus === 'suspended';
  }

  get canCreateRides() {
    return (
      this.isActive &&
      this.isVerified &&
      !this.isSuspended &&
      this.vehicleId &&
      this.hasValidDocuments()
    );
  }

  get averageRating() {
    return this.totalRatings > 0 ? parseFloat((this.rating / this.totalRatings).toFixed(2)) : 0;
  }

  get completionRate() {
    const totalAttempted = this.completedRides + this.cancelledRides;
    return totalAttempted > 0
      ? parseFloat(((this.completedRides / totalAttempted) * 100).toFixed(2))
      : 0;
  }

  get averageEarningsPerRide() {
    return this.completedRides > 0 ? Math.round(this.totalEarnings / this.completedRides) : 0;
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.driverId) errors.push('Driver ID is required');
    if (!this.userId) errors.push('User ID is required');
    if (!['student', 'staff'].includes(this.userType)) {
      errors.push('Invalid user type');
    }

    // License validation
    if (!this.licenseNumber) errors.push('License number is required');
    if (!['private', 'commercial'].includes(this.licenseType)) {
      errors.push('Invalid license type');
    }
    if (!this.licenseIssueDate) errors.push('License issue date is required');
    if (!this.licenseExpiryDate) errors.push('License expiry date is required');

    // Check if license is expired
    if (this.licenseExpiryDate < new Date()) {
      errors.push('License has expired');
    }

    // Check if license issue date is valid
    if (this.licenseIssueDate > new Date()) {
      errors.push('License issue date cannot be in the future');
    }

    if (!this.licenseDocumentUrl) errors.push('License document is required');

    // Validate wait time
    if (this.maxWaitTime < 1 || this.maxWaitTime > 30) {
      errors.push('Wait time must be between 1 and 30 minutes');
    }

    // Validate minimum rating
    if (this.minimumRating < 1 || this.minimumRating > 5) {
      errors.push('Minimum rating must be between 1 and 5');
    }

    if (errors.length > 0) {
      throw new Error(`Driver validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  // Document Management
  hasValidDocuments() {
    const now = new Date();

    // Check license validity
    if (!this.licenseVerified || this.licenseExpiryDate < now) {
      return false;
    }

    // Check insurance validity
    if (!this.insuranceVerified || !this.insuranceExpiryDate || this.insuranceExpiryDate < now) {
      return false;
    }

    // Check roadworthiness validity
    if (
      !this.roadworthinessVerified ||
      !this.roadworthinessExpiryDate ||
      this.roadworthinessExpiryDate < now
    ) {
      return false;
    }

    return true;
  }

  getDocumentStatus() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      license: {
        verified: this.licenseVerified,
        expired: this.licenseExpiryDate < now,
        expiringSoon: this.licenseExpiryDate < thirtyDaysFromNow,
        expiryDate: this.licenseExpiryDate.toISOString(),
      },
      insurance: {
        verified: this.insuranceVerified,
        expired: this.insuranceExpiryDate ? this.insuranceExpiryDate < now : true,
        expiringSoon: this.insuranceExpiryDate
          ? this.insuranceExpiryDate < thirtyDaysFromNow
          : false,
        expiryDate: this.insuranceExpiryDate ? this.insuranceExpiryDate.toISOString() : null,
      },
      roadworthiness: {
        verified: this.roadworthinessVerified,
        expired: this.roadworthinessExpiryDate ? this.roadworthinessExpiryDate < now : true,
        expiringSoon: this.roadworthinessExpiryDate
          ? this.roadworthinessExpiryDate < thirtyDaysFromNow
          : false,
        expiryDate: this.roadworthinessExpiryDate
          ? this.roadworthinessExpiryDate.toISOString()
          : null,
      },
    };
  }

  uploadDocument(documentType, url, expiryDate = null) {
    const validDocumentTypes = ['license', 'insurance', 'roadworthiness'];

    if (!validDocumentTypes.includes(documentType)) {
      throw new Error('Invalid document type');
    }

    if (!url) {
      throw new Error('Document URL is required');
    }

    switch (documentType) {
      case 'license':
        this.licenseDocumentUrl = url;
        if (expiryDate) {
          this.licenseExpiryDate = new Date(expiryDate);
        }
        this.licenseVerified = false; // Reset verification
        break;

      case 'insurance':
        this.insuranceDocumentUrl = url;
        if (!expiryDate) {
          throw new Error('Insurance expiry date is required');
        }
        this.insuranceExpiryDate = new Date(expiryDate);
        this.insuranceVerified = false;
        break;

      case 'roadworthiness':
        this.roadworthinessDocumentUrl = url;
        if (!expiryDate) {
          throw new Error('Roadworthiness expiry date is required');
        }
        this.roadworthinessExpiryDate = new Date(expiryDate);
        this.roadworthinessVerified = false;
        break;

      default:
        throw new Error('None');
    }

    this.updatedAt = new Date();
    return true;
  }

  // Verification Management
  verify(verifiedBy, comments = null) {
    if (this.isVerified) {
      throw new Error('Driver is already verified');
    }

    if (!this.hasValidDocuments()) {
      throw new Error('Cannot verify driver without valid documents');
    }

    this.verificationStatus = 'verified';
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
    this.verificationComments = comments;
    this.updatedAt = new Date();

    return true;
  }

  reject(rejectedBy, reason) {
    if (!reason) {
      throw new Error('Rejection reason is required');
    }

    this.verificationStatus = 'rejected';
    this.verifiedBy = rejectedBy;
    this.verifiedAt = new Date();
    this.verificationComments = reason;
    this.updatedAt = new Date();

    return true;
  }

  suspend(reason, suspendedBy) {
    if (!reason) {
      throw new Error('Suspension reason is required');
    }

    if (this.isSuspended) {
      throw new Error('Driver is already suspended');
    }

    this.verificationStatus = 'suspended';
    this.suspendedAt = new Date();
    this.suspensionReason = reason;
    this.isActive = false;
    this.isAvailable = false;
    this.verifiedBy = suspendedBy;
    this.updatedAt = new Date();

    return true;
  }

  reinstate(reinstatedBy, comments = null) {
    if (!this.isSuspended) {
      throw new Error('Driver is not suspended');
    }

    this.verificationStatus = 'verified';
    this.suspendedAt = null;
    this.suspensionReason = null;
    this.isActive = true;
    this.verifiedBy = reinstatedBy;
    this.verificationComments = comments || 'Reinstated after suspension';
    this.updatedAt = new Date();

    return true;
  }

  // Availability Management
  setAvailability(isAvailable) {
    if (!this.canCreateRides) {
      throw new Error('Cannot set availability - driver not eligible to create rides');
    }

    this.isAvailable = isAvailable;
    this.lastActiveAt = new Date();
    this.updatedAt = new Date();

    return this.isAvailable;
  }

  updateAvailabilitySchedule(day, schedule) {
    const validDays = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];

    if (!validDays.includes(day.toLowerCase())) {
      throw new Error('Invalid day of the week');
    }

    if (schedule && (!schedule.start || !schedule.end)) {
      throw new Error('Schedule must include start and end times');
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (schedule) {
      if (!timeRegex.test(schedule.start) || !timeRegex.test(schedule.end)) {
        throw new Error('Invalid time format. Use HH:MM format');
      }

      if (schedule.start >= schedule.end) {
        throw new Error('Start time must be before end time');
      }
    }

    this.availabilitySchedule[day.toLowerCase()] = schedule;
    this.updatedAt = new Date();

    return this.availabilitySchedule;
  }

  isAvailableNow() {
    if (!this.isAvailable || !this.canCreateRides) {
      return false;
    }

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const today = days[now.getDay()];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const todaySchedule = this.availabilitySchedule[today];

    if (!todaySchedule) {
      return false;
    }

    return currentTime >= todaySchedule.start && currentTime <= todaySchedule.end;
  }

  // Statistics Management
  recordRideCompletion(passengers, distance, earnings) {
    this.totalRide += 1;
    this.completedRides += 1;
    this.totalPassengers += passengers;
    this.totalDistance += distance;
    this.totalEarnings += earnings;
    this.lastActiveAt = new Date();
    this.updatedAt = new Date();

    return {
      totalRides: this.totalRides,
      completedRides: this.completedRides,
      completionRate: this.completionRate,
    };
  }

  recordRideCancellation() {
    this.totalRides += 1;
    this.cancelledRides += 1;
    this.updatedAt = new Date();

    return {
      totalRides: this.totalRides,
      cancelledRides: this.cancelledRides,
      completionRate: this.completionRate,
    };
  }

  updateRating(newRating) {
    if (newRating < 1 || newRating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    this.rating = (this.rating * this.totalRatings + newRating) / (this.totalRatings + 1);
    this.totalRatings += 1;
    this.updatedAt = new Date();

    return this.averageRating;
  }

  // User Management
  blockUser(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (this.blockedUsers.includes(userId)) {
      throw new Error('User is already blocked');
    }

    this.blockedUsers.push(userId);
    this.updatedAt = new Date();

    return this.blockedUsers;
  }

  unblockUser(userId) {
    const index = this.blockedUsers.indexOf(userId);

    if (index === -1) {
      throw new Error('User is not blocked');
    }

    this.blockedUsers.splice(index, 1);
    this.updatedAt = new Date();

    return this.blockedUsers;
  }

  isUserBlocked(userId) {
    return this.blockedUsers.includes(userId);
  }

  // Route Management
  addPreferredRoute(route) {
    if (!route.start || !route.end) {
      throw new Error('Route must have start and end points');
    }

    // Check if route already exists
    const exists = this.preferredRoutes.some((r) => r.start === route.start && r.end === route.end);

    if (exists) {
      throw new Error('Route already exists in preferences');
    }

    this.preferredRoutes.push({
      ...route,
      addedAt: new Date(),
    });

    this.updatedAt = new Date();
    return this.preferredRoutes;
  }

  removePreferredRoute(index) {
    if (index < 0 || index >= this.preferredRoutes.length) {
      throw new Error('Invalid route index');
    }

    this.preferredRoutes.splice(index, 1);
    this.updatedAt = new Date();

    return this.preferredRoutes;
  }

  // Payment Preferences
  updatePaymentPreferences(acceptsCash, acceptsTransfer) {
    // At least one payment method must be accepted
    if (!acceptsCash && !acceptsTransfer) {
      throw new Error('At least one payment method must be accepted');
    }

    this.acceptsCash = acceptsCash;
    this.acceptsTransfer = acceptsTransfer;
    this.updatedAt = new Date();

    return {
      acceptsCash: this.acceptsCash,
      acceptsTransfer: this.acceptsTransfer,
    };
  }

  // Serialization
  toJSON() {
    return {
      driverId: this.driverId,
      userId: this.userId,
      userType: this.userType,

      // License
      licenseNumber: this.licenseNumber,
      licenseType: this.licenseType,
      licenseExpiryDate: this.licenseExpiryDate.toISOString(),
      licenseVerified: this.licenseVerified,

      // Vehicle
      vehicleId: this.vehicleId,

      // Status
      isActive: this.isActive,
      isAvailable: this.isAvailable,
      isVerified: this.isVerified,
      isSuspended: this.isSuspended,
      verificationStatus: this.verificationStatus,
      canCreateRides: this.canCreateRides,

      // Statistics
      totalRides: this.totalRides,
      completedRides: this.completedRides,
      cancelledRides: this.cancelledRides,
      completionRate: this.completionRate,
      totalEarnings: this.totalEarnings,
      averageEarningsPerRide: this.averageEarningsPerRide,
      totalDistance: this.totalDistance,
      totalPassengers: this.totalPassengers,
      averageRating: this.averageRating,
      totalRatings: this.totalRatings,

      // Preferences
      maxWaitTime: this.maxWaitTime,
      acceptsCash: this.acceptsCash,
      acceptsTransfer: this.acceptsTransfer,
      minimumRating: this.minimumRating,
      preferredRoutes: this.preferredRoutes,
      availabilitySchedule: this.availabilitySchedule,
      isAvailableNow: this.isAvailableNow(),

      // Documents
      documentStatus: this.getDocumentStatus(),

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastActiveAt: this.lastActiveAt ? this.lastActiveAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Driver({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastActiveAt: data.lastActiveAt ? new Date(data.lastActiveAt) : null,
      licenseIssueDate: new Date(data.licenseIssueDate),
      licenseExpiryDate: new Date(data.licenseExpiryDate),
      insuranceExpiryDate: data.insuranceExpiryDate ? new Date(data.insuranceExpiryDate) : null,
      roadworthinessExpiryDate: data.roadworthinessExpiryDate
        ? new Date(data.roadworthinessExpiryDate)
        : null,
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
      suspendedAt: data.suspendedAt ? new Date(data.suspendedAt) : null,
    });
  }
}

module.exports = Driver;
