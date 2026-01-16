/**
 * User Entity - Base class for all users in the system
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate, isValidEmail, isValidPhone } = require('./utils/entityHelpers');

class User {
  constructor({
    userId,
    email,
    firstName,
    lastName,
    phone,
    userRole, // 'student' | 'staff' | 'admin'
    isVerified = false,
    isActive = true,
    profilePicture = null,
    emergencyContacts = [],
    rating = null,
    totalRatings = 0,
    averageRating = 0,
    createdAt = new Date(),
    updatedAt = new Date(),
    lastLoginAt = null,
  }) {
    // Core identification
    this.userId = userId;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone;
    this.userRole = userRole;
    // Verification and status
    this.isVerified = isVerified;
    this.isActive = isActive;
    // Profile information
    this.profilePicture = profilePicture;
    this.emergencyContacts = emergencyContacts;
    // Rating information
    this.rating = rating;
    this.totalRatings = totalRatings;
    this.averageRating = averageRating;
    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.lastLoginAt = parseDate(lastLoginAt);
    // Validate on creation
    this.validate();
  }

  // Getters
  get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  get isDriver() {
    // Will be overridden if user has driver privileges
    return false;
  }

  get displayName() {
    return this.fullName;
  }

  // Business logic methods
  validate() {
    const errors = [];

    if (!this.userId) errors.push('User ID is required');
    if (!this.email || !isValidEmail(this.email)) errors.push('Valid email is required');
    if (!this.firstName || this.firstName.length < 2)
      errors.push('First name must be at least 2 characters');
    if (!this.lastName || this.lastName.length < 2)
      errors.push('Last name must be at least 2 characters');
    if (!this.phone || !isValidPhone(this.phone))
      errors.push('Valid Nigerian phone number is required');
    if (!['student', 'staff', 'admin'].includes(this.userRole)) errors.push('Invalid user role');

    if (errors.length > 0) {
      throw new Error(`User validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  normalizePhone(phone) {
    // Remove spaces and normalize to international format
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.startsWith('0')) {
      return `+234${cleaned.substring(1)}`;
    }
    return cleaned;
  }

  // Emergency contact management
  addEmergencyContact(contact) {
    if (!contact.name || !contact.phone || !contact.relationship) {
      throw new Error('Emergency contact must have name, phone, and relationship');
    }

    if (!isValidPhone(contact.phone)) {
      throw new Error('Invalid emergency contact phone number');
    }

    // Maximum of 3 emergency contacts
    if (this.emergencyContacts.length >= 3) {
      throw new Error('Maximum of 3 emergency contacts allowed');
    }

    this.emergencyContacts.push({
      ...contact,
      phone: this.normalizePhone(contact.phone),
      addedAt: new Date(),
    });

    this.updatedAt = new Date();
    return this.emergencyContacts;
  }

  removeEmergencyContact(index) {
    if (index < 0 || index >= this.emergencyContacts.length) {
      throw new Error('Invalid emergency contact index');
    }

    this.emergencyContacts.splice(index, 1);
    this.updatedAt = new Date();
    return this.emergencyContacts;
  }

  // Account verification
  verifyAccount() {
    if (this.isVerified) {
      throw new Error('Account is already verified');
    }

    this.isVerified = true;
    this.updatedAt = new Date();
    return true;
  }

  // Account status management
  activateAccount() {
    if (this.isActive) {
      throw new Error('Account is already active');
    }

    this.isActive = true;
    this.updatedAt = new Date();
    return true;
  }

  deactivateAccount(reason = null) {
    if (!this.isActive) {
      throw new Error('Account is already deactivated');
    }

    this.isActive = false;
    this.deactivationReason = reason;
    this.deactivatedAt = new Date();
    this.updatedAt = new Date();
    return true;
  }

  // Rating management
  updateRating(newRating) {
    if (newRating < 1 || newRating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const totalScore = this.averageRating * this.totalRatings + newRating;
    this.totalRatings += 1;
    this.averageRating = parseFloat((totalScore / this.totalRatings).toFixed(2));
    this.rating = this.averageRating;
    this.updatedAt = new Date();

    return this.averageRating;
  }

  // Profile update
  updateProfile(updates) {
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'profilePicture'];
    const updateKeys = Object.keys(updates);

    updateKeys.forEach((key) => {
      if (allowedUpdates.includes(key)) {
        // Validate phone if updating
        if (key === 'phone' && !isValidPhone(updates[key])) {
          throw new Error('Invalid phone number');
        }
        this[key] = key === 'phone' ? this.normalizePhone(updates[key]) : updates[key];
      }
    });

    this.updatedAt = new Date();
    this.validate();
    return this;
  }

  // Login tracking
  recordLogin() {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
    return this.lastLoginAt;
  }

  // Security checks
  canPerformAction(action) {
    if (!this.isActive) return false;
    if (!this.isVerified && ['create_ride', 'book_ride'].includes(action)) return false;
    return true;
  }

  // Serialization
  toJSON() {
    return {
      userId: this.userId,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.fullName,
      phone: this.phone,
      userRole: this.userRole,
      isVerified: this.isVerified,
      isActive: this.isActive,
      profilePicture: this.profilePicture,
      emergencyContacts: this.emergencyContacts,
      rating: this.rating,
      totalRatings: this.totalRatings,
      averageRating: this.averageRating,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastLoginAt: this.lastLoginAt ? this.lastLoginAt.toISOString() : null,
    };
  }

  // Factory method for creating from database
  static fromDatabase(data) {
    return new User({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : null,
    });
  }
}

module.exports = User;
