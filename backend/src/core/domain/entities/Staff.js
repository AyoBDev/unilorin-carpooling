/**
 * Staff Entity - Represents a staff member
 * Extends User entity
 * University of Ilorin Carpooling Platform
 */

const User = require('./User');

class Staff extends User {
  constructor({
    // User base properties
    userId,
    email,
    firstName,
    lastName,
    phone,
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

    // Staff-specific properties
    staffId,
    staffType = 'academic', // 'academic' | 'non-academic' | 'technical' | 'administrative'
    department,
    faculty = null, // May be null for non-academic staff
    designation, // Professor, Senior Lecturer, Lecturer, etc.
    employmentDate,
    officeLocation = null,
    staffIdCardUrl = null,
    staffIdVerified = false,
    canAuthorizeDrivers = false, // For designated staff who can verify drivers
    workSchedule = {
      monday: { start: '08:00', end: '17:00' },
      tuesday: { start: '08:00', end: '17:00' },
      wednesday: { start: '08:00', end: '17:00' },
      thursday: { start: '08:00', end: '17:00' },
      friday: { start: '08:00', end: '17:00' },
      saturday: null,
      sunday: null,
    },
  }) {
    // Call parent constructor
    super({
      userId,
      email,
      firstName,
      lastName,
      phone,
      userRole: 'staff',
      isVerified,
      isActive,
      profilePicture,
      emergencyContacts,
      rating,
      totalRatings,
      averageRating,
      createdAt,
      updatedAt,
      lastLoginAt,
    });

    // Staff-specific fields
    this.staffId = staffId;
    this.staffType = staffType;
    this.department = department;
    this.faculty = faculty;
    this.designation = designation;
    this.employmentDate =
      employmentDate instanceof Date ? employmentDate : new Date(employmentDate);
    this.officeLocation = officeLocation;
    this.staffIdCardUrl = staffIdCardUrl;
    this.staffIdVerified = staffIdVerified;
    this.canAuthorizeDrivers = canAuthorizeDrivers;
    this.workSchedule = workSchedule;

    // Validate staff-specific fields
    this.validateStaff();
  }

  // Override displayName to include staff ID
  get displayName() {
    return `${this.designation} ${this.fullName}`;
  }

  get yearsOfService() {
    const currentDate = new Date();
    const years = (currentDate - this.employmentDate) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.floor(years);
  }

  get isAcademicStaff() {
    return this.staffType === 'academic';
  }

  get isAdministrativeStaff() {
    return this.staffType === 'administrative';
  }

  get isSeniorStaff() {
    const seniorDesignations = [
      'Professor',
      'Associate Professor',
      'Senior Lecturer',
      'Director',
      'Deputy Director',
      'Principal Officer',
    ];

    return seniorDesignations.some((designation) => this.designation.includes(designation));
  }

  // Staff-specific validation
  validateStaff() {
    const errors = [];

    // Validate staff ID format
    if (!this.staffId || !this.isValidStaffId(this.staffId)) {
      errors.push('Valid staff ID is required');
    }

    // Validate staff type
    const validStaffTypes = ['academic', 'non-academic', 'technical', 'administrative'];
    if (!validStaffTypes.includes(this.staffType)) {
      errors.push('Invalid staff type');
    }

    // Validate department
    if (!this.department || this.department.length < 3) {
      errors.push('Department is required');
    }

    // Academic staff must have faculty
    if (this.staffType === 'academic' && !this.faculty) {
      errors.push('Faculty is required for academic staff');
    }

    // Validate designation
    if (!this.designation || this.designation.length < 3) {
      errors.push('Designation is required');
    }

    // Validate employment date
    const currentDate = new Date();
    if (!this.employmentDate || this.employmentDate > currentDate) {
      errors.push('Invalid employment date');
    }

    // Validate university email
    if (!this.email.endsWith('@unilorin.edu.ng')) {
      errors.push('Must use official university email address');
    }

    if (errors.length > 0) {
      throw new Error(`Staff validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  isValidStaffId(staffId) {
    // Staff ID format validation
    // Example formats: ACAD/2020/001, ADMIN/2019/045, TECH/2021/012
    const staffIdRegex = /^(ACAD|ADMIN|TECH|NON-ACAD)\/\d{4}\/\d{3,5}$/;
    return staffIdRegex.test(staffId);
  }

  // Verify staff ID card
  verifyStaffId() {
    if (this.staffIdVerified) {
      throw new Error('Staff ID is already verified');
    }

    if (!this.staffIdCardUrl) {
      throw new Error('Please upload staff ID card first');
    }

    // In production, this would verify against university HR database
    this.staffIdVerified = true;
    this.staffIdVerificationDate = new Date();
    this.updatedAt = new Date();

    // Also verify the main account
    this.verifyAccount();

    return true;
  }

  // Upload staff ID card
  uploadStaffIdCard(url) {
    if (!url) {
      throw new Error('Staff ID card URL is required');
    }

    this.staffIdCardUrl = url;
    this.staffIdVerified = false; // Reset verification status
    this.updatedAt = new Date();

    return this.staffIdCardUrl;
  }

  // Update work schedule
  updateWorkSchedule(day, schedule) {
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

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (schedule) {
      if (!timeRegex.test(schedule.start) || !timeRegex.test(schedule.end)) {
        throw new Error('Invalid time format. Use HH:MM format');
      }

      // Ensure start time is before end time
      if (schedule.start >= schedule.end) {
        throw new Error('Start time must be before end time');
      }
    }

    this.workSchedule[day.toLowerCase()] = schedule;
    this.updatedAt = new Date();

    return this.workSchedule;
  }

  // Get today's work schedule
  getTodaySchedule() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    return {
      day: today,
      schedule: this.workSchedule[today],
    };
  }

  // Check if currently working (based on schedule)
  isCurrentlyWorking() {
    const now = new Date();
    const todaySchedule = this.getTodaySchedule();

    if (!todaySchedule.schedule) {
      return false; // Not a working day
    }

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTime >= todaySchedule.schedule.start && currentTime <= todaySchedule.schedule.end;
  }

  // Update office location
  updateOfficeLocation(location) {
    if (!location || location.length < 3) {
      throw new Error('Valid office location is required');
    }

    this.officeLocation = location;
    this.updatedAt = new Date();

    return this.officeLocation;
  }

  // Grant driver authorization privileges
  grantDriverAuthorizationPrivilege() {
    if (!this.isSeniorStaff) {
      throw new Error('Only senior staff can be granted driver authorization privileges');
    }

    this.canAuthorizeDrivers = true;
    this.authorizationGrantedDate = new Date();
    this.updatedAt = new Date();

    return true;
  }

  // Revoke driver authorization privileges
  revokeDriverAuthorizationPrivilege() {
    this.canAuthorizeDrivers = false;
    this.authorizationRevokedDate = new Date();
    this.updatedAt = new Date();

    return true;
  }

  // Authorize a driver (if has privileges)
  authorizeDriver(driverId, documents) {
    if (!this.canAuthorizeDrivers) {
      throw new Error('You do not have driver authorization privileges');
    }

    if (!driverId || !documents) {
      throw new Error('Driver ID and documents are required');
    }

    // This would be handled by the Driver service in production
    const authorization = {
      authorizedBy: this.userId,
      authorizedByName: this.fullName,
      authorizedByDesignation: this.designation,
      driverId: this.driverId,
      documents: this.documents,
      authorizedAt: new Date(),
      status: 'approved',
    };

    return authorization;
  }

  // Check if eligible for driver status
  canBecomeDriver() {
    // All verified staff can become drivers
    return this.isVerified && this.staffIdVerified && this.isActive;
  }

  // Override parent's canPerformAction
  canPerformAction(action) {
    if (!super.canPerformAction(action)) return false;

    // Additional staff-specific checks
    switch (action) {
      case 'become_driver':
        return this.canBecomeDriver();
      case 'authorize_driver':
        return this.canAuthorizeDrivers;
      case 'create_ride':
        return this.canBecomeDriver();
      case 'book_ride':
        return this.isActive && this.isVerified;
      default:
        return true;
    }
  }

  // Calculate commute pattern (for ride matching)
  getCommutePattern() {
    const workDays = Object.keys(this.workSchedule).filter(
      (day) => this.workSchedule[day] !== null,
    );

    return {
      workDays: this.workDays,
      typicalArrival: this.workSchedule[workDays[0]]?.start || '08:00',
      typicalDeparture: this.workSchedule[workDays[0]]?.end || '17:00',
      officeLocation: this.officeLocation,
      flexibility: 'low', // Staff usually have fixed schedules
    };
  }

  // Override toJSON to include staff-specific fields
  toJSON() {
    return {
      ...super.toJSON(),
      staffId: this.staffId,
      staffType: this.staffType,
      department: this.department,
      faculty: this.faculty,
      designation: this.designation,
      employmentDate: this.employmentDate.toISOString(),
      yearsOfService: this.yearsOfService,
      officeLocation: this.officeLocation,
      staffIdCardUrl: this.staffIdCardUrl,
      staffIdVerified: this.staffIdVerified,
      canAuthorizeDrivers: this.canAuthorizeDrivers,
      workSchedule: this.workSchedule,
      isAcademicStaff: this.isAcademicStaff,
      isSeniorStaff: this.isSeniorStaff,
      canBecomeDriver: this.canBecomeDriver(),
      isCurrentlyWorking: this.isCurrentlyWorking(),
      todaySchedule: this.getTodaySchedule(),
    };
  }

  // Factory method for creating from database
  static fromDatabase(data) {
    return new Staff({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : null,
      employmentDate: new Date(data.employmentDate),
    });
  }
}

module.exports = Staff;
