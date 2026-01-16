/**
 * PickupPoint Entity - Represents a pickup/dropoff point in the carpooling system
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const {
  parseDate,
  calculateDistance,
  isValidNigerianCoordinates,
} = require('./utils/entityHelpers');

class PickupPoint {
  constructor({
    pickupPointId,

    // Basic Information
    name,
    description = null,
    type = 'pickup', // 'pickup' | 'dropoff' | 'both'
    category = 'general', // 'general' | 'bus-stop' | 'landmark' | 'residential' | 'commercial' | 'campus'

    // Location Details
    address,
    coordinates, // { lat, lng }
    plusCode = null, // Google Plus Code for precise location

    // Area Information
    area = null, // e.g., 'Tanke', 'Fate', 'Oke-Odo'
    localGovernmentArea = 'Ilorin', // LGA
    state = 'Kwara',
    country = 'Nigeria',
    postalCode = null,

    // University Relation
    isOnCampus = false,
    campusZone = null, // 'main-campus' | 'permanent-site' | 'college-of-medicine' | 'off-campus'
    distanceFromCampus = null, // in kilometers
    estimatedTimeFromCampus = null, // in minutes

    // Popular Landmarks
    nearbyLandmarks = [],
    nearestBusStop = null,
    distanceFromNearestBusStop = null,

    // Accessibility
    isAccessible = true,
    accessibilityFeatures = [], // ['wheelchair-accessible', 'covered-waiting-area', 'seating', 'lighting']
    hasWaitingArea = false,
    hasShelter = false,
    hasLighting = false,
    hasSeating = false,

    // Safety
    safetyRating = 5, // 1-5 scale
    isWellLit = false,
    hasSecurityPresence = false,
    hasCCTV = false,
    safetyNotes = null,

    // Traffic Information
    typicalTrafficLevel = 'moderate', // 'light' | 'moderate' | 'heavy' | 'very-heavy'
    peakHours = [],
    averageWaitTime = 5, // minutes

    // Usage Statistics
    usageCount = 0,
    popularityScore = 0,
    averageRating = 0,
    totalRatings = 0,

    // Operational Hours
    operationalHours = {
      monday: { open: '06:00', close: '22:00' },
      tuesday: { open: '06:00', close: '22:00' },
      wednesday: { open: '06:00', close: '22:00' },
      thursday: { open: '06:00', close: '22:00' },
      friday: { open: '06:00', close: '22:00' },
      saturday: { open: '07:00', close: '20:00' },
      sunday: { open: '08:00', close: '18:00' },
    },
    is24Hours = false,

    // Restrictions
    isActive = true,
    isTemporary = false,
    temporaryStartDate = null,
    temporaryEndDate = null,
    restrictions = [], // ['no-parking', 'time-limited', 'permit-required']
    maxWaitTime = 15, // minutes

    // Photos
    photos = [],
    primaryPhotoUrl = null,
    streetViewUrl = null,

    // Verification
    isVerified = false,
    verifiedBy = null,
    verifiedAt = null,
    verificationNotes = null,

    // User Contributions
    suggestedBy = null, // User ID who suggested this point
    suggestedAt = null,
    approvedBy = null,
    approvedAt = null,

    // Metadata
    tags = [], // ['popular', 'safe', 'covered', 'main-road']
    customAttributes = {},
    notes = null,

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    lastUsedAt = null,
    deactivatedAt = null,
  }) {
    // Basic Information
    this.pickupPointId = pickupPointId;
    this.name = name;
    this.description = description;
    this.type = type;
    this.category = category;

    // Location Details
    this.address = address;
    this.coordinates = coordinates;
    this.plusCode = plusCode;

    // Area Information
    this.area = area;
    this.localGovernmentArea = localGovernmentArea;
    this.state = state;
    this.country = country;
    this.postalCode = postalCode;

    // University Relation
    this.isOnCampus = isOnCampus;
    this.campusZone = campusZone;
    this.distanceFromCampus = distanceFromCampus || this.calculateDistanceFromCampus();
    this.estimatedTimeFromCampus = estimatedTimeFromCampus || this.estimateTimeFromCampus();

    // Landmarks
    this.nearbyLandmarks = nearbyLandmarks;
    this.nearestBusStop = nearestBusStop;
    this.distanceFromNearestBusStop = distanceFromNearestBusStop;

    // Accessibility
    this.isAccessible = isAccessible;
    this.accessibilityFeatures = accessibilityFeatures;
    this.hasWaitingArea = hasWaitingArea;
    this.hasShelter = hasShelter;
    this.hasLighting = hasLighting;
    this.hasSeating = hasSeating;

    // Safety
    this.safetyRating = safetyRating;
    this.isWellLit = isWellLit;
    this.hasSecurityPresence = hasSecurityPresence;
    this.hasCCTV = hasCCTV;
    this.safetyNotes = safetyNotes;

    // Traffic
    this.typicalTrafficLevel = typicalTrafficLevel;
    this.peakHours = peakHours;
    this.averageWaitTime = averageWaitTime;

    // Usage Statistics
    this.usageCount = usageCount;
    this.popularityScore = popularityScore;
    this.averageRating = averageRating;
    this.totalRatings = totalRatings;

    // Operational Hours
    this.operationalHours = operationalHours;
    this.is24Hours = is24Hours;

    // Restrictions
    this.isActive = isActive;
    this.isTemporary = isTemporary;
    this.temporaryStartDate = parseDate(temporaryStartDate);
    this.temporaryEndDate = parseDate(temporaryEndDate);
    this.restrictions = restrictions;
    this.maxWaitTime = maxWaitTime;

    // Photos
    this.photos = photos;
    this.primaryPhotoUrl = primaryPhotoUrl || photos[0] || null;
    this.streetViewUrl = streetViewUrl;

    // Verification
    this.isVerified = isVerified;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = parseDate(verifiedAt);
    this.verificationNotes = verificationNotes;

    // User Contributions
    this.suggestedBy = suggestedBy;
    this.suggestedAt = parseDate(suggestedAt);
    this.approvedBy = approvedBy;
    this.approvedAt = parseDate(approvedAt);

    // Metadata
    this.tags = tags;
    this.customAttributes = customAttributes;
    this.notes = notes;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.lastUsedAt = parseDate(lastUsedAt);
    this.deactivatedAt = parseDate(deactivatedAt);

    // Validate on creation
    this.validate();
  }

  // Getters
  get isAvailable() {
    if (!this.isActive) return false;

    if (this.isTemporary) {
      const now = new Date();
      if (this.temporaryStartDate && now < this.temporaryStartDate) return false;
      if (this.temporaryEndDate && now > this.temporaryEndDate) return false;
    }

    return true;
  }

  get isCurrentlyOpen() {
    if (this.is24Hours) return true;

    const now = new Date();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[now.getDay()];
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const hours = this.operationalHours[currentDay];
    if (!hours) return false;

    return currentTime >= hours.open && currentTime <= hours.close;
  }

  get isSafe() {
    return this.safetyRating >= 4;
  }

  get isPopular() {
    return this.popularityScore > 0.7 || this.usageCount > 100;
  }

  get isMainCampus() {
    return this.campusZone === 'main-campus';
  }

  get isPermanentSite() {
    return this.campusZone === 'permanent-site';
  }

  get suitabilityScore() {
    // Calculate a suitability score based on various factors
    let score = 0;

    // Safety (max 30 points)
    score += this.safetyRating * 6;

    // Accessibility (max 20 points)
    if (this.isAccessible) score += 10;
    if (this.hasWaitingArea) score += 5;
    if (this.hasShelter) score += 5;

    // Convenience (max 20 points)
    if (this.distanceFromCampus <= 5) score += 10;
    else if (this.distanceFromCampus <= 10) score += 5;

    if (this.averageWaitTime <= 5) score += 10;
    else if (this.averageWaitTime <= 10) score += 5;

    // Popularity (max 20 points)
    score += Math.min(this.popularityScore * 20, 20);

    // Verification (max 10 points)
    if (this.isVerified) score += 10;

    return Math.min(score, 100); // Cap at 100
  }

  get displayCategory() {
    const categoryMap = {
      general: 'General Pickup Point',
      busStop: 'Bus Stop',
      landmark: 'Landmark',
      residential: 'Residential Area',
      commercial: 'Commercial Area',
      campus: 'Campus Location',
    };

    return categoryMap[this.category] || 'Pickup Point';
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.pickupPointId) errors.push('Pickup point ID is required');
    if (!this.name || this.name.length < 3) {
      errors.push('Name must be at least 3 characters');
    }

    // Type validation
    if (!['pickup', 'dropoff', 'both'].includes(this.type)) {
      errors.push('Invalid pickup point type');
    }

    // Category validation
    const validCategories = [
      'general',
      'bus-stop',
      'landmark',
      'residential',
      'commercial',
      'campus',
    ];
    if (!validCategories.includes(this.category)) {
      errors.push('Invalid category');
    }

    // Location validation
    if (!this.address) errors.push('Address is required');
    if (!this.coordinates || !this.coordinates.lat || !this.coordinates.lng) {
      errors.push('Valid coordinates are required');
    }

    // Validate coordinates are within Nigeria (roughly)
    if (this.coordinates) {
      if (!isValidNigerianCoordinates(this.coordinates.lat, this.coordinates.lng)) {
        errors.push('Coordinates appear to be outside Nigeria');
      }
    }

    // Campus zone validation
    if (this.isOnCampus) {
      const validZones = ['main-campus', 'permanent-site', 'college-of-medicine', 'off-campus'];
      if (!validZones.includes(this.campusZone)) {
        errors.push('Valid campus zone is required for on-campus locations');
      }
    }

    // Safety rating validation
    if (this.safetyRating < 1 || this.safetyRating > 5) {
      errors.push('Safety rating must be between 1 and 5');
    }

    // Traffic level validation
    const validTrafficLevels = ['light', 'moderate', 'heavy', 'very-heavy'];
    if (!validTrafficLevels.includes(this.typicalTrafficLevel)) {
      errors.push('Invalid traffic level');
    }

    // Wait time validation
    if (this.averageWaitTime < 0 || this.averageWaitTime > 60) {
      errors.push('Average wait time must be between 0 and 60 minutes');
    }

    if (this.maxWaitTime < 1 || this.maxWaitTime > 30) {
      errors.push('Max wait time must be between 1 and 30 minutes');
    }

    // Temporary date validation
    if (this.isTemporary) {
      if (!this.temporaryStartDate || !this.temporaryEndDate) {
        errors.push('Temporary pickup points must have start and end dates');
      }
      if (
        this.temporaryStartDate &&
        this.temporaryEndDate &&
        this.temporaryStartDate >= this.temporaryEndDate
      ) {
        errors.push('Temporary end date must be after start date');
      }
    }

    // Operational hours validation
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    Object.entries(this.operationalHours).forEach(([day, hours]) => {
      if (hours && (!timeRegex.test(hours.open) || !timeRegex.test(hours.close))) {
        errors.push(`Invalid operational hours for ${day}`);
      }
      if (hours && hours.open >= hours.close) {
        errors.push(`Opening time must be before closing time for ${day}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`PickupPoint validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  // Distance Calculations
  calculateDistanceFromCampus() {
    // University of Ilorin main campus coordinates
    const campusCoordinates = { lat: 4.6696, lng: 8.4789 };

    if (!this.coordinates) return null;

    return calculateDistance(
      this.coordinates.lat,
      this.coordinates.lng,
      campusCoordinates.lat,
      campusCoordinates.lng,
    );
  }

  estimateTimeFromCampus() {
    if (!this.distanceFromCampus) return null;

    // Estimate based on average speed in Ilorin (25 km/h in traffic)
    const averageSpeed = 25;
    return Math.round((this.distanceFromCampus / averageSpeed) * 60);
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }

  calculateDistanceTo(otherPoint) {
    if (!otherPoint.coordinates) {
      throw new Error('Other point must have coordinates');
    }

    return this.calculateDistance(
      this.coordinates.lat,
      this.coordinates.lng,
      otherPoint.coordinates.lat,
      otherPoint.coordinates.lng,
    );
  }

  // Management Methods
  activate() {
    if (this.isActive) {
      throw new Error('Pickup point is already active');
    }

    this.isActive = true;
    this.deactivatedAt = null;
    this.updatedAt = new Date();

    return true;
  }

  deactivate(reason = null) {
    if (!this.isActive) {
      throw new Error('Pickup point is already inactive');
    }

    this.isActive = false;
    this.deactivatedAt = new Date();
    this.deactivationReason = reason;
    this.updatedAt = new Date();

    return true;
  }

  verify(verifiedBy, notes = null) {
    if (this.isVerified) {
      throw new Error('Pickup point is already verified');
    }

    this.isVerified = true;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
    this.verificationNotes = notes;
    this.updatedAt = new Date();

    return true;
  }

  approve(approvedBy) {
    if (!this.suggestedBy) {
      throw new Error('Only suggested pickup points can be approved');
    }

    if (this.approvedBy) {
      throw new Error('Pickup point is already approved');
    }

    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.isActive = true;
    this.updatedAt = new Date();

    // Auto-verify on approval
    this.verify(approvedBy, 'Auto-verified on approval');

    return true;
  }

  // Photo Management
  addPhoto(photoUrl, isPrimary = false) {
    if (!photoUrl) {
      throw new Error('Photo URL is required');
    }

    if (this.photos.length >= 5) {
      throw new Error('Maximum 5 photos allowed');
    }

    this.photos.push(photoUrl);

    if (isPrimary || !this.primaryPhotoUrl) {
      this.primaryPhotoUrl = photoUrl;
    }

    this.updatedAt = new Date();
    return this.photos;
  }

  removePhoto(photoUrl) {
    const index = this.photos.indexOf(photoUrl);

    if (index === -1) {
      throw new Error('Photo not found');
    }

    this.photos.splice(index, 1);

    // Update primary photo if needed
    if (this.primaryPhotoUrl === photoUrl) {
      this.primaryPhotoUrl = this.photos[0] || null;
    }

    this.updatedAt = new Date();
    return this.photos;
  }

  // Landmark Management
  addNearbyLandmark(landmark) {
    if (!landmark || !landmark.name) {
      throw new Error('Landmark must have a name');
    }

    // Check for duplicates
    if (this.nearbyLandmarks.some((l) => l.name === landmark.name)) {
      throw new Error('Landmark already exists');
    }

    this.nearbyLandmarks.push({
      name: landmark.name,
      type: landmark.type || 'general',
      distance: landmark.distance || null,
      addedAt: new Date(),
    });

    this.updatedAt = new Date();
    return this.nearbyLandmarks;
  }

  removeNearbyLandmark(index) {
    if (index < 0 || index >= this.nearbyLandmarks.length) {
      throw new Error('Invalid landmark index');
    }

    this.nearbyLandmarks.splice(index, 1);
    this.updatedAt = new Date();

    return this.nearbyLandmarks;
  }

  // Accessibility Management
  updateAccessibility(features) {
    const validFeatures = [
      'wheelchair-accessible',
      'covered-waiting-area',
      'seating',
      'lighting',
      'signage',
      'tactile-paving',
      'audio-announcements',
    ];

    const invalidFeature = features.find((feature) => !validFeatures.includes(feature));
    if (invalidFeature) {
      throw new Error(`Invalid accessibility feature: ${invalidFeature}`);
    }

    this.accessibilityFeatures = features;

    // Update related flags
    this.hasWaitingArea = features.includes('covered-waiting-area');
    this.hasSeating = features.includes('seating');
    this.hasLighting = features.includes('lighting');
    this.isAccessible = features.includes('wheelchair-accessible');

    this.updatedAt = new Date();
    return this.accessibilityFeatures;
  }

  // Safety Management
  updateSafetyRating(rating, notes = null) {
    if (rating < 1 || rating > 5) {
      throw new Error('Safety rating must be between 1 and 5');
    }

    this.safetyRating = rating;
    if (notes) {
      this.safetyNotes = notes;
    }

    // Update safety flags based on rating
    this.isWellLit = rating >= 4;

    this.updatedAt = new Date();
    return this.safetyRating;
  }

  updateSafetyFeatures(features) {
    if (features.lighting !== undefined) {
      this.hasLighting = features.lighting;
      this.isWellLit = features.lighting;
    }

    if (features.security !== undefined) {
      this.hasSecurityPresence = features.security;
    }

    if (features.cctv !== undefined) {
      this.hasCCTV = features.cctv;
    }

    // Recalculate safety rating based on features
    let safetyScore = 3; // Base score
    if (this.isWellLit) safetyScore += 0.5;
    if (this.hasSecurityPresence) safetyScore += 1;
    if (this.hasCCTV) safetyScore += 0.5;

    this.safetyRating = Math.min(safetyScore, 5);
    this.updatedAt = new Date();

    return {
      lighting: this.hasLighting,
      security: this.hasSecurityPresence,
      cctv: this.hasCCTV,
      safetyRating: this.safetyRating,
    };
  }

  // Usage Tracking
  recordUsage() {
    this.usageCount += 1;
    this.lastUsedAt = new Date();

    // Update popularity score (simple algorithm)
    const basePopularity = Math.min(this.usageCount / 500, 0.5);
    const ratingBonus = (this.averageRating / 5) * 0.3;
    const safetyBonus = (this.safetyRating / 5) * 0.2;

    this.popularityScore = Math.min(basePopularity + ratingBonus + safetyBonus, 1);

    this.updatedAt = new Date();
    return this.usageCount;
  }

  addRating(rating) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const totalScore = this.averageRating * this.totalRatings + rating;
    this.totalRatings += 1;
    this.averageRating = parseFloat((totalScore / this.totalRatings).toFixed(2));

    this.updatedAt = new Date();
    return this.averageRating;
  }

  // Operational Hours Management
  updateOperationalHours(day, hours) {
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

    if (hours === null) {
      // Closed on this day
      this.operationalHours[day.toLowerCase()] = null;
    } else {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

      if (!hours.open || !hours.close) {
        throw new Error('Hours must include open and close times');
      }

      if (!timeRegex.test(hours.open) || !timeRegex.test(hours.close)) {
        throw new Error('Invalid time format. Use HH:MM');
      }

      if (hours.open >= hours.close) {
        throw new Error('Opening time must be before closing time');
      }

      this.operationalHours[day.toLowerCase()] = hours;
    }

    this.updatedAt = new Date();
    return this.operationalHours;
  }

  setAs24Hours(is24Hours = true) {
    this.is24Hours = is24Hours;

    if (is24Hours) {
      // Set all days to 00:00 - 23:59
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach((day) => {
        this.operationalHours[day] = { open: '00:00', close: '23:59' };
      });
    }

    this.updatedAt = new Date();
    return this.is24Hours;
  }

  // Tag Management
  addTag(tag) {
    if (!tag) {
      throw new Error('Tag is required');
    }

    if (this.tags.includes(tag)) {
      throw new Error('Tag already exists');
    }

    this.tags.push(tag.toLowerCase());
    this.updatedAt = new Date();

    return this.tags;
  }

  removeTag(tag) {
    const index = this.tags.indexOf(tag.toLowerCase());

    if (index === -1) {
      throw new Error('Tag not found');
    }

    this.tags.splice(index, 1);
    this.updatedAt = new Date();

    return this.tags;
  }

  // Search Helpers
  matchesSearchCriteria(criteria) {
    // Area match
    if (criteria.area && this.area !== criteria.area) {
      return false;
    }

    // Campus zone match
    if (criteria.campusZone && this.campusZone !== criteria.campusZone) {
      return false;
    }

    // Distance from campus
    if (
      criteria.maxDistanceFromCampus &&
      this.distanceFromCampus > criteria.maxDistanceFromCampus
    ) {
      return false;
    }

    // Safety rating
    if (criteria.minSafetyRating && this.safetyRating < criteria.minSafetyRating) {
      return false;
    }

    // Accessibility
    if (criteria.requiresAccessibility && !this.isAccessible) {
      return false;
    }

    // Features
    if (criteria.requiredFeatures) {
      const hasAllFeatures = criteria.requiredFeatures.every((feature) =>
        this.accessibilityFeatures.includes(feature),
      );
      if (!hasAllFeatures) {
        return false;
      }
    }

    // Currently open
    if (criteria.mustBeOpen && !this.isCurrentlyOpen) {
      return false;
    }

    return true;
  }

  // Serialization
  toJSON() {
    return {
      pickupPointId: this.pickupPointId,

      // Basic Info
      name: this.name,
      description: this.description,
      type: this.type,
      category: this.category,
      displayCategory: this.displayCategory,

      // Location
      address: this.address,
      coordinates: this.coordinates,
      plusCode: this.plusCode,
      area: this.area,
      localGovernmentArea: this.localGovernmentArea,
      state: this.state,

      // University Relation
      isOnCampus: this.isOnCampus,
      campusZone: this.campusZone,
      distanceFromCampus: this.distanceFromCampus,
      estimatedTimeFromCampus: this.estimatedTimeFromCampus,

      // Landmarks
      nearbyLandmarks: this.nearbyLandmarks,
      nearestBusStop: this.nearestBusStop,

      // Accessibility
      isAccessible: this.isAccessible,
      accessibilityFeatures: this.accessibilityFeatures,
      hasWaitingArea: this.hasWaitingArea,
      hasShelter: this.hasShelter,

      // Safety
      safetyRating: this.safetyRating,
      isSafe: this.isSafe,
      isWellLit: this.isWellLit,
      hasSecurityPresence: this.hasSecurityPresence,
      hasCCTV: this.hasCCTV,

      // Traffic
      typicalTrafficLevel: this.typicalTrafficLevel,
      averageWaitTime: this.averageWaitTime,

      // Usage
      usageCount: this.usageCount,
      popularityScore: this.popularityScore,
      isPopular: this.isPopular,
      averageRating: this.averageRating,
      totalRatings: this.totalRatings,

      // Operational
      operationalHours: this.operationalHours,
      is24Hours: this.is24Hours,
      isCurrentlyOpen: this.isCurrentlyOpen,

      // Status
      isActive: this.isActive,
      isAvailable: this.isAvailable,
      isTemporary: this.isTemporary,
      isVerified: this.isVerified,

      // Scoring
      suitabilityScore: this.suitabilityScore,

      // Photos
      photos: this.photos,
      primaryPhotoUrl: this.primaryPhotoUrl,
      streetViewUrl: this.streetViewUrl,

      // Metadata
      tags: this.tags,
      notes: this.notes,

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastUsedAt: this.lastUsedAt ? this.lastUsedAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new PickupPoint({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : null,
      deactivatedAt: data.deactivatedAt ? new Date(data.deactivatedAt) : null,
      temporaryStartDate: data.temporaryStartDate ? new Date(data.temporaryStartDate) : null,
      temporaryEndDate: data.temporaryEndDate ? new Date(data.temporaryEndDate) : null,
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
      suggestedAt: data.suggestedAt ? new Date(data.suggestedAt) : null,
      approvedAt: data.approvedAt ? new Date(data.approvedAt) : null,
    });
  }

  // Popular Pickup Points in Ilorin (Predefined)
  static getPopularPickupPoints() {
    return [
      {
        name: 'Tanke Junction',
        area: 'Tanke',
        coordinates: { lat: 4.6743, lng: 8.4833 },
        category: 'bus-stop',
        isPopular: true,
      },
      {
        name: 'Fate Roundabout',
        area: 'Fate',
        coordinates: { lat: 4.6589, lng: 8.4897 },
        category: 'landmark',
        isPopular: true,
      },
      {
        name: 'University Main Gate',
        area: 'University',
        coordinates: { lat: 4.6696, lng: 8.4789 },
        category: 'campus',
        isOnCampus: true,
        campusZone: 'main-campus',
      },
      {
        name: 'Pipeline Junction',
        area: 'Pipeline',
        coordinates: { lat: 4.6812, lng: 8.4756 },
        category: 'bus-stop',
      },
      {
        name: 'Oke-Odo',
        area: 'Oke-Odo',
        coordinates: { lat: 4.6654, lng: 8.4923 },
        category: 'residential',
      },
      {
        name: 'Tipper Garage',
        area: 'Tanke',
        coordinates: { lat: 4.6778, lng: 8.4801 },
        category: 'bus-stop',
      },
      {
        name: 'Al-Hikmah University Junction',
        area: 'Adewole',
        coordinates: { lat: 4.6523, lng: 8.4845 },
        category: 'landmark',
      },
      {
        name: 'Permanent Site',
        area: 'University',
        coordinates: { lat: 4.6234, lng: 8.4567 },
        category: 'campus',
        isOnCampus: true,
        campusZone: 'permanent-site',
      },
    ];
  }
}

module.exports = PickupPoint;
