/**
 * Services Index
 * University of Ilorin Carpooling Platform
 *
 * Central export point for all business logic services.
 * Following Clean Architecture, services contain the core
 * business logic and orchestrate operations between repositories.
 *
 * @module services
 */

const AuthService = require('./AuthService');
const UserService = require('./UserService');
const RideService = require('./RideService');
const BookingService = require('./BookingService');
const NotificationService = require('./NotificationService');
const RatingService = require('./RatingService');
const SafetyService = require('./SafetyService');
const MatchingService = require('./MatchingService');
const ReportingService = require('./ReportingService');

/**
 * Service instances (singletons for dependency injection)
 */
let authServiceInstance = null;
let userServiceInstance = null;
let rideServiceInstance = null;
let bookingServiceInstance = null;
let notificationServiceInstance = null;
let ratingServiceInstance = null;
let safetyServiceInstance = null;
let matchingServiceInstance = null;
let reportingServiceInstance = null;

/**
 * Get AuthService instance
 * @returns {AuthService}
 */
const getAuthService = () => {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
};

/**
 * Get UserService instance
 * @returns {UserService}
 */
const getUserService = () => {
  if (!userServiceInstance) {
    userServiceInstance = new UserService();
  }
  return userServiceInstance;
};

/**
 * Get RideService instance
 * @returns {RideService}
 */
const getRideService = () => {
  if (!rideServiceInstance) {
    rideServiceInstance = new RideService();
  }
  return rideServiceInstance;
};

/**
 * Get BookingService instance
 * @returns {BookingService}
 */
const getBookingService = () => {
  if (!bookingServiceInstance) {
    bookingServiceInstance = new BookingService();
  }
  return bookingServiceInstance;
};

/**
 * Get NotificationService instance
 * @returns {NotificationService}
 */
const getNotificationService = () => {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
};

/**
 * Get RatingService instance
 * @returns {RatingService}
 */
const getRatingService = () => {
  if (!ratingServiceInstance) {
    ratingServiceInstance = new RatingService();
  }
  return ratingServiceInstance;
};

/**
 * Get SafetyService instance
 * @returns {SafetyService}
 */
const getSafetyService = () => {
  if (!safetyServiceInstance) {
    safetyServiceInstance = new SafetyService();
  }
  return safetyServiceInstance;
};

/**
 * Get MatchingService instance
 * @returns {MatchingService}
 */
const getMatchingService = () => {
  if (!matchingServiceInstance) {
    matchingServiceInstance = new MatchingService();
  }
  return matchingServiceInstance;
};

/**
 * Get ReportingService instance
 * @returns {ReportingService}
 */
const getReportingService = () => {
  if (!reportingServiceInstance) {
    reportingServiceInstance = new ReportingService();
  }
  return reportingServiceInstance;
};

/**
 * Reset all service instances (useful for testing)
 */
const resetServices = () => {
  authServiceInstance = null;
  userServiceInstance = null;
  rideServiceInstance = null;
  bookingServiceInstance = null;
  notificationServiceInstance = null;
  ratingServiceInstance = null;
  safetyServiceInstance = null;
  matchingServiceInstance = null;
  reportingServiceInstance = null;
};

/**
 * Initialize all services
 * Call this at application startup to pre-instantiate services
 */
const initializeServices = () => ({
  authService: getAuthService(),
  userService: getUserService(),
  rideService: getRideService(),
  bookingService: getBookingService(),
  notificationService: getNotificationService(),
  ratingService: getRatingService(),
  safetyService: getSafetyService(),
  matchingService: getMatchingService(),
  reportingService: getReportingService(),
});

module.exports = {
  // Service classes (for direct instantiation or testing)
  AuthService,
  UserService,
  RideService,
  BookingService,
  NotificationService,
  RatingService,
  SafetyService,
  MatchingService,
  ReportingService,

  // Singleton getters
  getAuthService,
  getUserService,
  getRideService,
  getBookingService,
  getNotificationService,
  getRatingService,
  getSafetyService,
  getMatchingService,
  getReportingService,

  // Utilities
  resetServices,
  initializeServices,
};
