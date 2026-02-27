/**
 * Student Entity - Represents a student user
 * Extends User entity
 * University of Ilorin Carpooling Platform
 */

const User = require('./User');

class Student extends User {
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

    // Student-specific properties
    matricNumber,
    faculty,
    department,
    level, // 100, 200, 300, 400, 500, 600
    program = 'undergraduate', // 'undergraduate' | 'postgraduate'
    enrollmentYear,
    expectedGraduationYear,
    studentIdCardUrl = null,
    studentIdVerified = false,
    campusResidence = 'off-campus', // 'on-campus' | 'off-campus'
    residentialAddress = null,
  }) {
    // Call parent constructor
    super({
      userId,
      email,
      firstName,
      lastName,
      phone,
      userRole: 'student',
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
    // Student-specific fields
    this.matricNumber = matricNumber;
    this.faculty = faculty;
    this.department = department;
    this.level = level;
    this.program = program;
    this.enrollmentYear = enrollmentYear;
    this.expectedGraduationYear = expectedGraduationYear;
    this.studentIdCardUrl = studentIdCardUrl;
    this.studentIdVerified = studentIdVerified;
    this.campusResidence = campusResidence;
    this.residentialAddress = residentialAddress;
    // Validate student-specific fields
    this.validateStudent();
  }

  // Override displayName to include matric number
  get displayName() {
    return `${this.fullName} (${this.matricNumber})`;
  }

  get academicYear() {
    const currentYear = new Date().getFullYear();
    const yearDiff = currentYear - this.enrollmentYear;
    const academicLevel = Math.ceil(this.level / 100);
    return `${academicLevel}/${yearDiff + 1}`;
  }

  get isGraduating() {
    const currentYear = new Date().getFullYear();
    return currentYear >= this.expectedGraduationYear;
  }

  get canBookRides() {
    return this.isActive && this.isVerified && !this.isGraduating;
  }

  // Student-specific validation
  validateStudent() {
    const errors = [];

    // Validate matric number format (e.g., 19/55EC/123)
    if (!this.matricNumber || !this.isValidMatricNumber(this.matricNumber)) {
      errors.push('Valid matric number is required (format: YY/XXXX/NNN)');
    }

    // Validate faculty and department
    if (!this.faculty || this.faculty.length < 3) {
      errors.push('Faculty is required');
    }

    if (!this.department || this.department.length < 3) {
      errors.push('Department is required');
    }

    // Validate level
    const validLevels = [100, 200, 300, 400, 500, 600];
    if (!validLevels.includes(this.level)) {
      errors.push('Invalid student level');
    }

    // Validate program
    if (!['undergraduate', 'postgraduate'].includes(this.program)) {
      errors.push('Invalid program type');
    }

    // Validate enrollment year
    const currentYear = new Date().getFullYear();
    if (!this.enrollmentYear || this.enrollmentYear < 2000 || this.enrollmentYear > currentYear) {
      errors.push('Invalid enrollment year');
    }

    // Validate expected graduation year
    if (
      !this.expectedGraduationYear ||
      this.expectedGraduationYear < this.enrollmentYear ||
      this.expectedGraduationYear > this.enrollmentYear + 7
    ) {
      errors.push('Invalid expected graduation year');
    }

    // Validate campus residence
    if (!['on-campus', 'off-campus'].includes(this.campusResidence)) {
      errors.push('Invalid campus residence status');
    }

    // Validate University email
    if (
      !this.email.endsWith('@student.unilorin.edu.ng') &&
      !this.email.endsWith('@unilorin.edu.ng')
    ) {
      errors.push('Must use university email address');
    }

    if (errors.length > 0) {
      throw new Error(`Student validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  isValidMatricNumber(matricNumber) {
    // Format: YY/NNCCCNNN where:
    // YY = year (2 digits)
    // NN = 2-digit number prefix
    // CCC = 2-4 letter department/faculty code
    // NNN = 3-digit serial number
    // Example: 21/52HP029, 19/56CS001
    const matricRegex = /^\d{2}\/\d{2}[A-Z]{2,4}\d{3}$/;
    return matricRegex.test(matricNumber);
  }

  // Verify student ID card
  verifyStudentId() {
    // For simplicity, we skip actual code verification
    if (this.studentIdVerified) {
      throw new Error('Student ID is already verified');
    }

    if (!this.studentIdCardUrl) {
      throw new Error('Please upload student ID card first');
    }

    // In production, this would verify against university database
    this.studentIdVerified = true;
    this.studentIdVerificationDate = new Date();
    this.updatedAt = new Date();

    // Also verify the main account
    this.verifyAccount();

    return true;
  }

  // Upload student ID card
  uploadStudentIdCard(url) {
    if (!url) {
      throw new Error('Student ID card URL is required');
    }

    this.studentIdCardUrl = url;
    this.studentIdVerified = false; // Reset verification status
    this.updatedAt = new Date();

    return this.studentIdCardUrl;
  }

  // Update level (for new academic year)
  promoteToNextLevel() {
    const maxLevel = this.program === 'undergraduate' ? 500 : 600;

    if (this.level >= maxLevel) {
      throw new Error('Student is already at maximum level');
    }

    this.level += 100;
    this.updatedAt = new Date();

    // Check if graduating
    if (this.level > maxLevel - 100) {
      this.expectedGraduationYear = new Date().getFullYear();
    }

    return this.level;
  }

  // Update residential information
  updateResidentialInfo(campusResidence, address = null) {
    const validResidenceTypes = ['on-campus', 'off-campus'];

    if (!validResidenceTypes.includes(campusResidence)) {
      throw new Error('Invalid campus residence type');
    }

    if (campusResidence === 'off-campus' && !address) {
      throw new Error('Residential address is required for off-campus students');
    }

    this.campusResidence = campusResidence;
    this.residentialAddress = campusResidence === 'on-campus' ? null : address;
    this.updatedAt = new Date();

    return {
      campusResidence: this.campusResidence,
      residentialAddress: this.residentialAddress,
    };
  }

  // Check if eligible for driver status
  canBecomeDriver() {
    // Students can only become drivers if:
    // - Level 300 and above
    // - Account is verified
    // - Student ID is verified
    return this.level >= 300 && this.isVerified && this.studentIdVerified && this.isActive;
  }

  // Override parent's canPerformAction
  canPerformAction(action) {
    if (!super.canPerformAction(action)) return false;

    // Additional student-specific checks
    switch (action) {
      case 'become_driver':
        return this.canBecomeDriver();
      case 'book_ride':
        return this.canBookRides;
      case 'create_ride':
        return this.canBecomeDriver();
      default:
        return true;
    }
  }

  // Calculate transport allowance eligibility
  getTransportAllowanceEligibility() {
    return {
      isEligible: this.campusResidence === 'off-campus',
      residenceType: this.campusResidence,
      level: this.level,
      program: this.program,
    };
  }

  // Override toJSON to include student-specific fields
  toJSON() {
    return {
      ...super.toJSON(),
      matricNumber: this.matricNumber,
      faculty: this.faculty,
      department: this.department,
      level: this.level,
      program: this.program,
      enrollmentYear: this.enrollmentYear,
      expectedGraduationYear: this.expectedGraduationYear,
      studentIdCardUrl: this.studentIdCardUrl,
      studentIdVerified: this.studentIdVerified,
      campusResidence: this.campusResidence,
      residentialAddress: this.residentialAddress,
      academicYear: this.academicYear,
      isGraduating: this.isGraduating,
      canBecomeDriver: this.canBecomeDriver(),
      canBookRides: this.canBookRides,
    };
  }

  // Factory method for creating from database
  static fromDatabase(data) {
    return new Student({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastLoginAt: data.lastLoginAt ? new Date(data.lastLoginAt) : null,
    });
  }
}

module.exports = Student;
