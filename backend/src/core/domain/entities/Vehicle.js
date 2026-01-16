/**
 * Vehicle Entity - Represents a vehicle used for carpooling
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate } = require('./utils/entityHelpers');

class Vehicle {
  constructor({
    vehicleId,
    ownerId, // Driver ID

    // Basic Information
    make, // Toyota, Honda, etc.
    model, // Camry, Accord, etc.
    year, // Manufacturing year
    color,
    plateNumber,
    vehicleType = 'sedan', // 'sedan' | 'suv' | 'minivan' | 'hatchback' | 'pickup'

    // Capacity
    seatingCapacity, // Total seats including driver
    availableSeats, // Seats available for passengers (seatingCapacity - 1)
    hasAirConditioning = false,
    hasTrunkSpace = false,

    // Registration & Documents
    registrationNumber,
    chassisNumber,
    engineNumber,
    registrationDocumentUrl,
    registrationVerified = false,
    registrationExpiryDate,

    // Insurance
    insuranceProvider,
    insurancePolicyNumber,
    insuranceType = 'third-party', // 'third-party' | 'comprehensive'
    insuranceDocumentUrl,
    insuranceVerified = false,
    insuranceExpiryDate,

    // Roadworthiness
    roadworthinessNumber,
    roadworthinessDocumentUrl,
    roadworthinessVerified = false,
    roadworthinessExpiryDate,
    lastInspectionDate,

    // Vehicle Condition
    mileage = 0, // in kilometers
    fuelType = 'petrol', // 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'cng'
    transmissionType = 'automatic', // 'automatic' | 'manual'
    vehicleCondition = 'excellent', // 'excellent' | 'good' | 'fair' | 'needs-maintenance'

    // Features & Amenities
    features = [], // ['ac', 'music', 'usb-charging', 'comfortable-seats', 'trunk-space']

    // Photos
    vehiclePhotos = [], // Array of photo URLs
    primaryPhotoUrl = null,

    // Verification Status
    verificationStatus = 'pending', // 'pending' | 'verified' | 'rejected' | 'suspended'
    verifiedBy = null,
    verifiedAt = null,
    verificationComments = null,

    // Statistics
    totalTrips = 0,
    totalDistance = 0, // in kilometers
    totalPassengers = 0,
    averageRating = 0,
    totalRatings = 0,

    // Status
    isActive = true,
    isAvailable = true,
    maintenanceStatus = 'up-to-date', // 'up-to-date' | 'due' | 'overdue' | 'in-maintenance'
    nextMaintenanceDate = null,
    nextMaintenanceMileage = null,

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    lastUsedAt = null,
    suspendedAt = null,
    suspensionReason = null,
  }) {
    // Basic Information
    this.vehicleId = vehicleId;
    this.ownerId = ownerId;
    this.make = make;
    this.model = model;
    this.year = year;
    this.color = color;
    this.plateNumber = plateNumber;
    this.vehicleType = vehicleType;

    // Capacity
    this.seatingCapacity = seatingCapacity;
    this.availableSeats = availableSeats || seatingCapacity - 1; // Minus driver seat
    this.hasAirConditioning = hasAirConditioning;
    this.hasTrunkSpace = hasTrunkSpace;

    // Registration
    this.registrationNumber = registrationNumber;
    this.chassisNumber = chassisNumber;
    this.engineNumber = engineNumber;
    this.registrationDocumentUrl = registrationDocumentUrl;
    this.registrationVerified = registrationVerified;
    this.registrationExpiryDate = parseDate(registrationExpiryDate);

    // Insurance
    this.insuranceProvider = insuranceProvider;
    this.insurancePolicyNumber = insurancePolicyNumber;
    this.insuranceType = insuranceType;
    this.insuranceDocumentUrl = insuranceDocumentUrl;
    this.insuranceVerified = insuranceVerified;
    this.insuranceExpiryDate = parseDate(insuranceExpiryDate);

    // Roadworthiness
    this.roadworthinessNumber = roadworthinessNumber;
    this.roadworthinessDocumentUrl = roadworthinessDocumentUrl;
    this.roadworthinessVerified = roadworthinessVerified;
    this.roadworthinessExpiryDate = parseDate(roadworthinessExpiryDate);
    this.lastInspectionDate = parseDate(lastInspectionDate);

    // Vehicle Condition
    this.mileage = mileage;
    this.fuelType = fuelType;
    this.transmissionType = transmissionType;
    this.vehicleCondition = vehicleCondition;

    // Features
    this.features = features;

    // Photos
    this.vehiclePhotos = vehiclePhotos;
    this.primaryPhotoUrl = primaryPhotoUrl || vehiclePhotos[0] || null;

    // Verification
    this.verificationStatus = verificationStatus;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = parseDate(verifiedAt);
    this.verificationComments = verificationComments;

    // Statistics
    this.totalTrips = totalTrips;
    this.totalDistance = totalDistance;
    this.totalPassengers = totalPassengers;
    this.averageRating = averageRating;
    this.totalRatings = totalRatings;

    // Status
    this.isActive = isActive;
    this.isAvailable = isAvailable;
    this.maintenanceStatus = maintenanceStatus;
    this.nextMaintenanceDate = parseDate(nextMaintenanceDate);
    this.nextMaintenanceMileage = nextMaintenanceMileage;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.lastUsedAt = parseDate(lastUsedAt);
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

  get canBeUsedForRides() {
    return (
      this.isActive &&
      this.isVerified &&
      !this.isSuspended &&
      this.isAvailable &&
      this.hasValidDocuments() &&
      this.maintenanceStatus !== 'overdue'
    );
  }

  get vehicleAge() {
    const currentYear = new Date().getFullYear();
    return currentYear - this.year;
  }

  get isVintage() {
    return this.vehicleAge > 15;
  }

  get needsMaintenance() {
    if (this.maintenanceStatus === 'overdue' || this.maintenanceStatus === 'due') {
      return true;
    }

    if (this.nextMaintenanceDate && new Date() >= this.nextMaintenanceDate) {
      return true;
    }

    if (this.nextMaintenanceMileage && this.mileage >= this.nextMaintenanceMileage) {
      return true;
    }

    return false;
  }

  get displayName() {
    return `${this.year} ${this.make} ${this.model}`;
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.vehicleId) errors.push('Vehicle ID is required');
    if (!this.ownerId) errors.push('Owner ID is required');

    // Basic information validation
    if (!this.make || this.make.length < 2) errors.push('Vehicle make is required');
    if (!this.model || this.model.length < 2) errors.push('Vehicle model is required');
    if (!this.year || this.year < 1990 || this.year > new Date().getFullYear() + 1) {
      errors.push('Invalid vehicle year');
    }
    if (!this.color) errors.push('Vehicle color is required');
    if (!this.plateNumber || !this.isValidPlateNumber(this.plateNumber)) {
      errors.push('Valid plate number is required');
    }

    // Vehicle type validation
    const validTypes = ['sedan', 'suv', 'minivan', 'hatchback', 'pickup'];
    if (!validTypes.includes(this.vehicleType)) {
      errors.push('Invalid vehicle type');
    }

    // Capacity validation
    if (!this.seatingCapacity || this.seatingCapacity < 2 || this.seatingCapacity > 18) {
      errors.push('Seating capacity must be between 2 and 18');
    }

    if (this.availableSeats >= this.seatingCapacity) {
      errors.push('Available seats cannot exceed total seating capacity');
    }

    // Maximum 7 available seats for carpooling (as per business rules)
    if (this.availableSeats > 7) {
      errors.push('Maximum 7 seats allowed for carpooling');
    }

    // Registration validation
    if (!this.registrationNumber) errors.push('Registration number is required');
    if (!this.chassisNumber) errors.push('Chassis number is required');
    if (!this.engineNumber) errors.push('Engine number is required');

    // Insurance validation
    if (!this.insuranceProvider) errors.push('Insurance provider is required');
    if (!this.insurancePolicyNumber) errors.push('Insurance policy number is required');
    if (!['third-party', 'comprehensive'].includes(this.insuranceType)) {
      errors.push('Invalid insurance type');
    }

    // Fuel type validation
    const validFuelTypes = ['petrol', 'diesel', 'hybrid', 'electric', 'cng'];
    if (!validFuelTypes.includes(this.fuelType)) {
      errors.push('Invalid fuel type');
    }

    // Transmission type validation
    if (!['automatic', 'manual'].includes(this.transmissionType)) {
      errors.push('Invalid transmission type');
    }

    // Vehicle condition validation
    const validConditions = ['excellent', 'good', 'fair', 'needs-maintenance'];
    if (!validConditions.includes(this.vehicleCondition)) {
      errors.push('Invalid vehicle condition');
    }

    // Check vehicle age
    if (this.vehicleAge > 15) {
      errors.push('Vehicle is too old for carpooling service (maximum 15 years)');
    }

    if (errors.length > 0) {
      throw new Error(`Vehicle validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  isValidPlateNumber(plateNumber) {
    // Nigerian plate number format validation
    // Examples: ABC-123-XY, XY-123-ABC
    const plateRegex = /^[A-Z]{2,3}-?\d{3}-?[A-Z]{2,3}$/;
    return plateRegex.test(plateNumber.toUpperCase().replace(/\s/g, ''));
  }

  // Document Management
  hasValidDocuments() {
    const now = new Date();

    // Check registration validity
    if (
      !this.registrationVerified ||
      (this.registrationExpiryDate && this.registrationExpiryDate < now)
    ) {
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
      registration: {
        verified: this.registrationVerified,
        expired: this.registrationExpiryDate ? this.registrationExpiryDate < now : false,
        expiringSoon: this.registrationExpiryDate
          ? this.registrationExpiryDate < thirtyDaysFromNow
          : false,
        expiryDate: this.registrationExpiryDate ? this.registrationExpiryDate.toISOString() : null,
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
        lastInspection: this.lastInspectionDate ? this.lastInspectionDate.toISOString() : null,
      },
    };
  }

  uploadDocument(documentType, url, expiryDate = null) {
    const validDocumentTypes = ['registration', 'insurance', 'roadworthiness'];

    if (!validDocumentTypes.includes(documentType)) {
      throw new Error('Invalid document type');
    }

    if (!url) {
      throw new Error('Document URL is required');
    }

    switch (documentType) {
      case 'registration':
        this.registrationDocumentUrl = url;
        if (expiryDate) {
          this.registrationExpiryDate = new Date(expiryDate);
        }
        this.registrationVerified = false; // Reset verification
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
        this.lastInspectionDate = new Date();
        break;

      default:
        throw new Error('Invalid document type');
    }

    this.updatedAt = new Date();
    return true;
  }

  // Photo Management
  addPhoto(photoUrl, isPrimary = false) {
    if (!photoUrl) {
      throw new Error('Photo URL is required');
    }

    // Maximum 5 photos
    if (this.vehiclePhotos.length >= 5) {
      throw new Error('Maximum 5 photos allowed');
    }

    this.vehiclePhotos.push(photoUrl);

    if (isPrimary || !this.primaryPhotoUrl) {
      this.primaryPhotoUrl = photoUrl;
    }

    this.updatedAt = new Date();
    return this.vehiclePhotos;
  }

  removePhoto(photoUrl) {
    const index = this.vehiclePhotos.indexOf(photoUrl);

    if (index === -1) {
      throw new Error('Photo not found');
    }

    this.vehiclePhotos.splice(index, 1);

    // If removed photo was primary, set new primary
    if (this.primaryPhotoUrl === photoUrl) {
      this.primaryPhotoUrl = this.vehiclePhotos[0] || null;
    }

    this.updatedAt = new Date();
    return this.vehiclePhotos;
  }

  setPrimaryPhoto(photoUrl) {
    if (!this.vehiclePhotos.includes(photoUrl)) {
      throw new Error('Photo not found in vehicle photos');
    }

    this.primaryPhotoUrl = photoUrl;
    this.updatedAt = new Date();

    return this.primaryPhotoUrl;
  }

  // Feature Management
  addFeature(feature) {
    const validFeatures = [
      'ac',
      'music',
      'usb-charging',
      'comfortable-seats',
      'trunk-space',
      'child-seat',
      'wifi',
      'bluetooth',
      'gps',
      'sunroof',
    ];

    if (!validFeatures.includes(feature)) {
      throw new Error('Invalid feature');
    }

    if (this.features.includes(feature)) {
      throw new Error('Feature already exists');
    }

    this.features.push(feature);

    // Update hasAirConditioning and hasTrunkSpace flags
    if (feature === 'ac') this.hasAirConditioning = true;
    if (feature === 'trunk-space') this.hasTrunkSpace = true;

    this.updatedAt = new Date();
    return this.features;
  }

  removeFeature(feature) {
    const index = this.features.indexOf(feature);

    if (index === -1) {
      throw new Error('Feature not found');
    }

    this.features.splice(index, 1);

    // Update flags
    if (feature === 'ac') this.hasAirConditioning = false;
    if (feature === 'trunk-space') this.hasTrunkSpace = false;

    this.updatedAt = new Date();
    return this.features;
  }

  // Verification Management
  verify(verifiedBy, comments = null) {
    if (this.isVerified) {
      throw new Error('Vehicle is already verified');
    }

    if (!this.hasValidDocuments()) {
      throw new Error('Cannot verify vehicle without valid documents');
    }

    if (this.vehicleAge > 15) {
      throw new Error('Vehicle is too old to be verified');
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
      throw new Error('Vehicle is already suspended');
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
      throw new Error('Vehicle is not suspended');
    }

    this.verificationStatus = 'verified';
    this.suspendedAt = null;
    this.suspensionReason = null;
    this.isActive = true;
    this.isAvailable = true;
    this.verifiedBy = reinstatedBy;
    this.verificationComments = comments || 'Reinstated after suspension';
    this.updatedAt = new Date();

    return true;
  }

  // Maintenance Management
  scheduleMaintenance(date, mileage = null) {
    const maintenanceDate = date instanceof Date ? date : new Date(date);

    if (maintenanceDate < new Date()) {
      throw new Error('Maintenance date cannot be in the past');
    }

    this.nextMaintenanceDate = maintenanceDate;

    if (mileage) {
      if (mileage <= this.mileage) {
        throw new Error('Maintenance mileage must be greater than current mileage');
      }
      this.nextMaintenanceMileage = mileage;
    }

    // Update maintenance status
    const daysUntilMaintenance = (maintenanceDate - new Date()) / (24 * 60 * 60 * 1000);

    if (daysUntilMaintenance <= 7) {
      this.maintenanceStatus = 'due';
    } else {
      this.maintenanceStatus = 'up-to-date';
    }

    this.updatedAt = new Date();
    return {
      nextMaintenanceDate: this.nextMaintenanceDate,
      nextMaintenanceMileage: this.nextMaintenanceMileage,
      status: this.maintenanceStatus,
    };
  }

  recordMaintenance(mileage, notes = null) {
    this.lastMaintenanceDate = new Date();
    this.lastMaintenanceMileage = this.mileage;
    this.maintenanceStatus = 'up-to-date';
    this.maintenanceNotes = notes;

    // Schedule next maintenance (typically after 5000km or 3 months)
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 3);
    this.nextMaintenanceDate = nextDate;
    this.nextMaintenanceMileage = this.mileage + 5000;

    this.updatedAt = new Date();
    return true;
  }

  setInMaintenance() {
    this.maintenanceStatus = 'in-maintenance';
    this.isAvailable = false;
    this.maintenanceStartedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  completeMaintenanceAndReturn(mileage) {
    if (this.maintenanceStatus !== 'in-maintenance') {
      throw new Error('Vehicle is not in maintenance');
    }

    this.recordMaintenance(mileage);
    this.isAvailable = true;
    this.maintenanceCompletedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  // Usage Statistics
  recordTrip(distance, passengers) {
    this.totalTrips += 1;
    this.totalDistance += distance;
    this.totalPassengers += passengers;
    this.mileage += distance;
    this.lastUsedAt = new Date();

    // Check if maintenance is due based on mileage
    if (this.nextMaintenanceMileage && this.mileage >= this.nextMaintenanceMileage) {
      this.maintenanceStatus = 'due';
    }

    this.updatedAt = new Date();
    return {
      totalTrips: this.totalTrips,
      totalDistance: this.totalDistance,
      mileage: this.mileage,
    };
  }

  updateRating(newRating) {
    if (newRating < 1 || newRating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const totalScore = this.averageRating * this.totalRatings + newRating;
    this.totalRatings += 1;
    this.averageRating = parseFloat((totalScore / this.totalRatings).toFixed(2));
    this.updatedAt = new Date();

    return this.averageRating;
  }

  updateMileage(newMileage) {
    if (newMileage < this.mileage) {
      throw new Error('New mileage cannot be less than current mileage');
    }

    this.mileage = newMileage;

    // Check if maintenance is due
    if (this.nextMaintenanceMileage && this.mileage >= this.nextMaintenanceMileage) {
      this.maintenanceStatus = 'due';
    }

    this.updatedAt = new Date();
    return this.mileage;
  }

  updateCondition(condition) {
    const validConditions = ['excellent', 'good', 'fair', 'needs-maintenance'];

    if (!validConditions.includes(condition)) {
      throw new Error('Invalid vehicle condition');
    }

    this.vehicleCondition = condition;

    if (condition === 'needs-maintenance') {
      this.maintenanceStatus = 'due';
    }

    this.updatedAt = new Date();
    return this.vehicleCondition;
  }

  // Availability Management
  setAvailability(isAvailable) {
    if (!this.canBeUsedForRides && isAvailable) {
      throw new Error('Vehicle cannot be made available - check documents and maintenance status');
    }

    this.isAvailable = isAvailable;
    this.updatedAt = new Date();

    return this.isAvailable;
  }

  // Serialization
  toJSON() {
    return {
      vehicleId: this.vehicleId,
      ownerId: this.ownerId,

      // Basic Info
      displayName: this.displayName,
      make: this.make,
      model: this.model,
      year: this.year,
      color: this.color,
      plateNumber: this.plateNumber,
      vehicleType: this.vehicleType,
      vehicleAge: this.vehicleAge,
      isVintage: this.isVintage,

      // Capacity
      seatingCapacity: this.seatingCapacity,
      availableSeats: this.availableSeats,

      // Features
      features: this.features,
      hasAirConditioning: this.hasAirConditioning,
      hasTrunkSpace: this.hasTrunkSpace,

      // Technical
      fuelType: this.fuelType,
      transmissionType: this.transmissionType,
      mileage: this.mileage,
      vehicleCondition: this.vehicleCondition,

      // Photos
      vehiclePhotos: this.vehiclePhotos,
      primaryPhotoUrl: this.primaryPhotoUrl,

      // Status
      isActive: this.isActive,
      isAvailable: this.isAvailable,
      isVerified: this.isVerified,
      isSuspended: this.isSuspended,
      canBeUsedForRides: this.canBeUsedForRides,
      verificationStatus: this.verificationStatus,

      // Maintenance
      maintenanceStatus: this.maintenanceStatus,
      needsMaintenance: this.needsMaintenance,
      nextMaintenanceDate: this.nextMaintenanceDate ? this.nextMaintenanceDate.toISOString() : null,
      nextMaintenanceMileage: this.nextMaintenanceMileage,

      // Documents
      documentStatus: this.getDocumentStatus(),

      // Statistics
      totalTrips: this.totalTrips,
      totalDistance: this.totalDistance,
      totalPassengers: this.totalPassengers,
      averageRating: this.averageRating,
      totalRatings: this.totalRatings,

      // Insurance Info
      insuranceProvider: this.insuranceProvider,
      insuranceType: this.insuranceType,

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastUsedAt: this.lastUsedAt ? this.lastUsedAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Vehicle({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : null,
      registrationExpiryDate: data.registrationExpiryDate
        ? new Date(data.registrationExpiryDate)
        : null,
      insuranceExpiryDate: data.insuranceExpiryDate ? new Date(data.insuranceExpiryDate) : null,
      roadworthinessExpiryDate: data.roadworthinessExpiryDate
        ? new Date(data.roadworthinessExpiryDate)
        : null,
      lastInspectionDate: data.lastInspectionDate ? new Date(data.lastInspectionDate) : null,
      nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null,
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
      suspendedAt: data.suspendedAt ? new Date(data.suspendedAt) : null,
    });
  }
}

module.exports = Vehicle;
