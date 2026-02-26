/**
 * Error Constants
 * University of Ilorin Carpooling Platform
 *
 * Centralized error codes and messages for consistent error handling.
 */

/**
 * Error codes organized by domain
 */
const ErrorCodes = {
  // General errors
  GENERAL: {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    BAD_REQUEST: 'BAD_REQUEST',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  },

  // Authentication errors
  AUTH: {
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    MISSING_TOKEN: 'MISSING_TOKEN',
    INVALID_TOKEN: 'INVALID_TOKEN',
    EXPIRED_TOKEN: 'EXPIRED_TOKEN',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    ACCOUNT_NOT_VERIFIED: 'ACCOUNT_NOT_VERIFIED',
    ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
    ACCOUNT_BANNED: 'ACCOUNT_BANNED',
    WRONG_PASSWORD: 'WRONG_PASSWORD',
    PASSWORD_RESET_EXPIRED: 'PASSWORD_RESET_EXPIRED',
    INVALID_VERIFICATION_CODE: 'INVALID_VERIFICATION_CODE',
  },

  // Authorization errors
  AUTHZ: {
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    ROLE_REQUIRED: 'ROLE_REQUIRED',
    DRIVER_ONLY: 'DRIVER_ONLY',
    ADMIN_ONLY: 'ADMIN_ONLY',
    NOT_OWNER: 'NOT_OWNER',
    DRIVER_NOT_VERIFIED: 'DRIVER_NOT_VERIFIED',
    DRIVER_REJECTED: 'DRIVER_REJECTED',
  },

  // User errors
  USER: {
    NOT_FOUND: 'USER_NOT_FOUND',
    EMAIL_EXISTS: 'EMAIL_EXISTS',
    PHONE_EXISTS: 'PHONE_EXISTS',
    MATRIC_NUMBER_EXISTS: 'MATRIC_NUMBER_EXISTS',
    STAFF_ID_EXISTS: 'STAFF_ID_EXISTS',
    INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
    INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT',
    INVALID_MATRIC_FORMAT: 'INVALID_MATRIC_FORMAT',
    ALREADY_DRIVER: 'ALREADY_DRIVER',
    PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  },

  // Ride errors
  RIDE: {
    NOT_FOUND: 'RIDE_NOT_FOUND',
    ALREADY_CANCELLED: 'RIDE_ALREADY_CANCELLED',
    ALREADY_STARTED: 'RIDE_ALREADY_STARTED',
    ALREADY_COMPLETED: 'RIDE_ALREADY_COMPLETED',
    NO_SEATS_AVAILABLE: 'NO_SEATS_AVAILABLE',
    DEPARTURE_IN_PAST: 'DEPARTURE_IN_PAST',
    DEPARTURE_TOO_FAR: 'DEPARTURE_TOO_FAR',
    INVALID_ROUTE: 'INVALID_ROUTE',
    INVALID_PICKUP_POINT: 'INVALID_PICKUP_POINT',
    CANNOT_MODIFY_STARTED: 'CANNOT_MODIFY_STARTED_RIDE',
    CANCELLATION_DEADLINE_PASSED: 'CANCELLATION_DEADLINE_PASSED',
  },

  // Booking errors
  BOOKING: {
    NOT_FOUND: 'BOOKING_NOT_FOUND',
    ALREADY_BOOKED: 'ALREADY_BOOKED',
    ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
    ALREADY_COMPLETED: 'BOOKING_ALREADY_COMPLETED',
    CANNOT_BOOK_OWN_RIDE: 'CANNOT_BOOK_OWN_RIDE',
    TOO_MANY_SEATS: 'TOO_MANY_SEATS',
    INVALID_PASSENGER_CODE: 'INVALID_PASSENGER_CODE',
    RIDE_NOT_STARTED: 'RIDE_NOT_STARTED',
    CANCELLATION_NOT_ALLOWED: 'CANCELLATION_NOT_ALLOWED',
    NO_SHOW: 'NO_SHOW',
  },

  // Vehicle errors
  VEHICLE: {
    NOT_FOUND: 'VEHICLE_NOT_FOUND',
    PLATE_NUMBER_EXISTS: 'PLATE_NUMBER_EXISTS',
    INVALID_PLATE_FORMAT: 'INVALID_PLATE_FORMAT',
    DOCUMENT_EXPIRED: 'DOCUMENT_EXPIRED',
    CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  },

  // Payment errors (Phase 2)
  PAYMENT: {
    FAILED: 'PAYMENT_FAILED',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    REFUND_FAILED: 'REFUND_FAILED',
    TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
    WEBHOOK_VERIFICATION_FAILED: 'WEBHOOK_VERIFICATION_FAILED',
  },

  // Rating errors
  RATING: {
    NOT_FOUND: 'RATING_NOT_FOUND',
    ALREADY_RATED: 'ALREADY_RATED',
    BOOKING_NOT_COMPLETED: 'BOOKING_NOT_COMPLETED',
    INVALID_SCORE: 'INVALID_SCORE',
  },

  // Notification errors
  NOTIFICATION: {
    NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
    SEND_FAILED: 'NOTIFICATION_SEND_FAILED',
    INVALID_CHANNEL: 'INVALID_NOTIFICATION_CHANNEL',
  },

  // External service errors
  EXTERNAL: {
    MAPS_API_ERROR: 'MAPS_API_ERROR',
    PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
    EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
    SMS_SERVICE_ERROR: 'SMS_SERVICE_ERROR',
    GEOCODING_FAILED: 'GEOCODING_FAILED',
    DISTANCE_CALCULATION_FAILED: 'DISTANCE_CALCULATION_FAILED',
  },

  // Database errors
  DATABASE: {
    CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
    QUERY_ERROR: 'DATABASE_QUERY_ERROR',
    TRANSACTION_ERROR: 'DATABASE_TRANSACTION_ERROR',
    DUPLICATE_KEY: 'DATABASE_DUPLICATE_KEY',
    CONSTRAINT_VIOLATION: 'DATABASE_CONSTRAINT_VIOLATION',
  },

  // Cache errors
  CACHE: {
    CONNECTION_ERROR: 'CACHE_CONNECTION_ERROR',
    READ_ERROR: 'CACHE_READ_ERROR',
    WRITE_ERROR: 'CACHE_WRITE_ERROR',
  },
};

/**
 * Error messages by code
 */
const ErrorMessages = {
  // General
  [ErrorCodes.GENERAL.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ErrorCodes.GENERAL.BAD_REQUEST]: 'Invalid request',
  [ErrorCodes.GENERAL.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCodes.GENERAL.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ErrorCodes.GENERAL.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later',
  [ErrorCodes.GENERAL.MAINTENANCE_MODE]: 'System is under maintenance',

  // Authentication
  [ErrorCodes.AUTH.UNAUTHORIZED]: 'Authentication required',
  [ErrorCodes.AUTH.INVALID_CREDENTIALS]: 'Invalid email or password',
  [ErrorCodes.AUTH.MISSING_TOKEN]: 'Authentication token is required',
  [ErrorCodes.AUTH.INVALID_TOKEN]: 'Invalid authentication token',
  [ErrorCodes.AUTH.EXPIRED_TOKEN]: 'Authentication token has expired',
  [ErrorCodes.AUTH.TOKEN_REVOKED]: 'Authentication token has been revoked',
  [ErrorCodes.AUTH.INVALID_REFRESH_TOKEN]: 'Invalid refresh token',
  [ErrorCodes.AUTH.SESSION_EXPIRED]: 'Your session has expired. Please log in again',
  [ErrorCodes.AUTH.ACCOUNT_NOT_VERIFIED]: 'Please verify your email address',
  [ErrorCodes.AUTH.ACCOUNT_SUSPENDED]: 'Your account has been suspended',
  [ErrorCodes.AUTH.ACCOUNT_BANNED]: 'Your account has been banned',
  [ErrorCodes.AUTH.WRONG_PASSWORD]: 'Current password is incorrect',
  [ErrorCodes.AUTH.PASSWORD_RESET_EXPIRED]: 'Password reset link has expired',
  [ErrorCodes.AUTH.INVALID_VERIFICATION_CODE]: 'Invalid or expired verification code',

  // Authorization
  [ErrorCodes.AUTHZ.FORBIDDEN]: 'You do not have permission to perform this action',
  [ErrorCodes.AUTHZ.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
  [ErrorCodes.AUTHZ.ROLE_REQUIRED]: 'This action requires a specific role',
  [ErrorCodes.AUTHZ.DRIVER_ONLY]: 'This action is only available to verified drivers',
  [ErrorCodes.AUTHZ.ADMIN_ONLY]: 'This action requires administrator privileges',
  [ErrorCodes.AUTHZ.NOT_OWNER]: 'You can only modify your own resources',
  [ErrorCodes.AUTHZ.DRIVER_NOT_VERIFIED]: 'Your driver account is pending verification',
  [ErrorCodes.AUTHZ.DRIVER_REJECTED]: 'Your driver verification was rejected',

  // User
  [ErrorCodes.USER.NOT_FOUND]: 'User not found',
  [ErrorCodes.USER.EMAIL_EXISTS]: 'An account with this email already exists',
  [ErrorCodes.USER.PHONE_EXISTS]: 'An account with this phone number already exists',
  [ErrorCodes.USER.MATRIC_NUMBER_EXISTS]: 'An account with this matric number already exists',
  [ErrorCodes.USER.STAFF_ID_EXISTS]: 'An account with this staff ID already exists',
  [ErrorCodes.USER.INVALID_EMAIL_FORMAT]: 'Invalid email format',
  [ErrorCodes.USER.INVALID_PHONE_FORMAT]: 'Invalid phone number format',
  [ErrorCodes.USER.INVALID_MATRIC_FORMAT]: 'Invalid matric number format',
  [ErrorCodes.USER.ALREADY_DRIVER]: 'You are already registered as a driver',
  [ErrorCodes.USER.PROFILE_INCOMPLETE]: 'Please complete your profile first',

  // Ride
  [ErrorCodes.RIDE.NOT_FOUND]: 'Ride not found',
  [ErrorCodes.RIDE.ALREADY_CANCELLED]: 'This ride has already been cancelled',
  [ErrorCodes.RIDE.ALREADY_STARTED]: 'This ride has already started',
  [ErrorCodes.RIDE.ALREADY_COMPLETED]: 'This ride has already been completed',
  [ErrorCodes.RIDE.NO_SEATS_AVAILABLE]: 'No seats available on this ride',
  [ErrorCodes.RIDE.DEPARTURE_IN_PAST]: 'Departure time must be at least 30 minutes in the future',
  [ErrorCodes.RIDE.DEPARTURE_TOO_FAR]: 'Departure time must be within 7 days',
  [ErrorCodes.RIDE.INVALID_ROUTE]: 'Invalid route configuration',
  [ErrorCodes.RIDE.INVALID_PICKUP_POINT]: 'Invalid pickup point',
  [ErrorCodes.RIDE.CANNOT_MODIFY_STARTED]: 'Cannot modify a ride that has started',
  [ErrorCodes.RIDE.CANCELLATION_DEADLINE_PASSED]: 'Cancellation deadline has passed',

  // Booking
  [ErrorCodes.BOOKING.NOT_FOUND]: 'Booking not found',
  [ErrorCodes.BOOKING.ALREADY_BOOKED]: 'You have already booked this ride',
  [ErrorCodes.BOOKING.ALREADY_CANCELLED]: 'This booking has already been cancelled',
  [ErrorCodes.BOOKING.ALREADY_COMPLETED]: 'This booking has already been completed',
  [ErrorCodes.BOOKING.CANNOT_BOOK_OWN_RIDE]: 'You cannot book your own ride',
  [ErrorCodes.BOOKING.TOO_MANY_SEATS]: 'Cannot book more than 4 seats at once',
  [ErrorCodes.BOOKING.INVALID_PASSENGER_CODE]: 'Invalid passenger verification code',
  [ErrorCodes.BOOKING.RIDE_NOT_STARTED]: 'Ride has not started yet',
  [ErrorCodes.BOOKING.CANCELLATION_NOT_ALLOWED]: 'Cancellation is not allowed for this booking',
  [ErrorCodes.BOOKING.NO_SHOW]: 'Passenger did not show up',

  // Vehicle
  [ErrorCodes.VEHICLE.NOT_FOUND]: 'Vehicle not found',
  [ErrorCodes.VEHICLE.PLATE_NUMBER_EXISTS]: 'A vehicle with this plate number already exists',
  [ErrorCodes.VEHICLE.INVALID_PLATE_FORMAT]: 'Invalid plate number format',
  [ErrorCodes.VEHICLE.DOCUMENT_EXPIRED]: 'Vehicle documents have expired',
  [ErrorCodes.VEHICLE.CAPACITY_EXCEEDED]: 'Vehicle capacity exceeded',

  // Payment
  [ErrorCodes.PAYMENT.FAILED]: 'Payment failed',
  [ErrorCodes.PAYMENT.INVALID_AMOUNT]: 'Invalid payment amount',
  [ErrorCodes.PAYMENT.REFUND_FAILED]: 'Refund processing failed',
  [ErrorCodes.PAYMENT.TRANSACTION_NOT_FOUND]: 'Transaction not found',
  [ErrorCodes.PAYMENT.WEBHOOK_VERIFICATION_FAILED]: 'Payment webhook verification failed',

  // Rating
  [ErrorCodes.RATING.NOT_FOUND]: 'Rating not found',
  [ErrorCodes.RATING.ALREADY_RATED]: 'You have already rated this booking',
  [ErrorCodes.RATING.BOOKING_NOT_COMPLETED]: 'You can only rate completed bookings',
  [ErrorCodes.RATING.INVALID_SCORE]: 'Rating score must be between 1 and 5',

  // Notification
  [ErrorCodes.NOTIFICATION.NOT_FOUND]: 'Notification not found',
  [ErrorCodes.NOTIFICATION.SEND_FAILED]: 'Failed to send notification',
  [ErrorCodes.NOTIFICATION.INVALID_CHANNEL]: 'Invalid notification channel',

  // External
  [ErrorCodes.EXTERNAL.MAPS_API_ERROR]: 'Maps service temporarily unavailable',
  [ErrorCodes.EXTERNAL.PAYMENT_GATEWAY_ERROR]: 'Payment gateway temporarily unavailable',
  [ErrorCodes.EXTERNAL.EMAIL_SERVICE_ERROR]: 'Email service temporarily unavailable',
  [ErrorCodes.EXTERNAL.SMS_SERVICE_ERROR]: 'SMS service temporarily unavailable',
  [ErrorCodes.EXTERNAL.GEOCODING_FAILED]: 'Unable to geocode the provided address',
  [ErrorCodes.EXTERNAL.DISTANCE_CALCULATION_FAILED]: 'Unable to calculate distance',

  // Database
  [ErrorCodes.DATABASE.CONNECTION_ERROR]: 'Database connection error',
  [ErrorCodes.DATABASE.QUERY_ERROR]: 'Database query error',
  [ErrorCodes.DATABASE.TRANSACTION_ERROR]: 'Database transaction error',
  [ErrorCodes.DATABASE.DUPLICATE_KEY]: 'Duplicate entry',
  [ErrorCodes.DATABASE.CONSTRAINT_VIOLATION]: 'Data constraint violation',

  // Cache
  [ErrorCodes.CACHE.CONNECTION_ERROR]: 'Cache connection error',
  [ErrorCodes.CACHE.READ_ERROR]: 'Cache read error',
  [ErrorCodes.CACHE.WRITE_ERROR]: 'Cache write error',
};

/**
 * HTTP status codes by error code
 */
const ErrorStatusCodes = {
  [ErrorCodes.GENERAL.INTERNAL_ERROR]: 500,
  [ErrorCodes.GENERAL.BAD_REQUEST]: 400,
  [ErrorCodes.GENERAL.VALIDATION_ERROR]: 422,
  [ErrorCodes.GENERAL.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.GENERAL.RATE_LIMIT_EXCEEDED]: 429,

  [ErrorCodes.AUTH.UNAUTHORIZED]: 401,
  [ErrorCodes.AUTH.INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH.MISSING_TOKEN]: 401,
  [ErrorCodes.AUTH.INVALID_TOKEN]: 401,
  [ErrorCodes.AUTH.EXPIRED_TOKEN]: 401,

  [ErrorCodes.AUTHZ.FORBIDDEN]: 403,
  [ErrorCodes.AUTHZ.INSUFFICIENT_PERMISSIONS]: 403,

  [ErrorCodes.USER.NOT_FOUND]: 404,
  [ErrorCodes.USER.EMAIL_EXISTS]: 409,
  [ErrorCodes.USER.PHONE_EXISTS]: 409,

  [ErrorCodes.RIDE.NOT_FOUND]: 404,
  [ErrorCodes.BOOKING.NOT_FOUND]: 404,
  [ErrorCodes.VEHICLE.NOT_FOUND]: 404,
};

/**
 * Get error message by code
 * @param {string} code - Error code
 * @param {string} defaultMessage - Default message if code not found
 * @returns {string}
 */
const getErrorMessage = (code, defaultMessage = 'An error occurred') =>
  ErrorMessages[code] || defaultMessage;

/**
 * Get HTTP status by error code
 * @param {string} code - Error code
 * @param {number} defaultStatus - Default status if code not found
 * @returns {number}
 */
const getErrorStatus = (code, defaultStatus = 500) => ErrorStatusCodes[code] || defaultStatus;


// ─────────────────────────────────────────────
// Flat error code aliases (used by service layer)
// Services use ERROR_CODES.USER_EMAIL_EXISTS instead of ErrorCodes.USER.EMAIL_EXISTS
// ─────────────────────────────────────────────

const ERROR_CODES = {
  // Auth
  AUTH_INVALID_CREDENTIALS: ErrorCodes.AUTH.INVALID_CREDENTIALS,
  AUTH_ACCOUNT_DISABLED: ErrorCodes.AUTH.ACCOUNT_SUSPENDED,
  AUTH_ACCOUNT_LOCKED: ErrorCodes.AUTH.ACCOUNT_BANNED,
  AUTH_EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  AUTH_INVALID_TOKEN: ErrorCodes.AUTH.INVALID_TOKEN,
  AUTH_TOKEN_EXPIRED: ErrorCodes.AUTH.EXPIRED_TOKEN,
  AUTH_INVALID_REFRESH_TOKEN: ErrorCodes.AUTH.INVALID_REFRESH_TOKEN,
  AUTH_REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  AUTH_REFRESH_TOKEN_REQUIRED: 'REFRESH_TOKEN_REQUIRED',
  AUTH_PASSWORD_SAME: 'PASSWORD_SAME_AS_OLD',
  AUTH_OTP_EXPIRED: 'OTP_EXPIRED',
  AUTH_OTP_INVALID: 'OTP_INVALID',
  AUTH_OTP_NOT_FOUND: 'OTP_NOT_FOUND',
  INVALID_VERIFICATION_CODE: ErrorCodes.AUTH.INVALID_VERIFICATION_CODE,

  // User
  USER_NOT_FOUND: ErrorCodes.USER.NOT_FOUND,
  USER_EMAIL_EXISTS: ErrorCodes.USER.EMAIL_EXISTS,
  USER_MATRIC_EXISTS: ErrorCodes.USER.MATRIC_NUMBER_EXISTS,
  USER_STAFF_ID_EXISTS: ErrorCodes.USER.STAFF_ID_EXISTS,
  USER_NOT_VERIFIED: 'USER_NOT_VERIFIED',
  USER_ALREADY_DRIVER: 'USER_ALREADY_DRIVER',
  USER_NOT_DRIVER: 'USER_NOT_DRIVER',
  ACCOUNT_DISABLED: ErrorCodes.AUTH.ACCOUNT_SUSPENDED,

  // Driver
  DRIVER_NOT_VERIFIED: ErrorCodes.AUTHZ.DRIVER_NOT_VERIFIED,

  // Ride
  RIDE_NOT_FOUND: 'RIDE_NOT_FOUND',
  RIDE_NOT_AVAILABLE: 'RIDE_NOT_AVAILABLE',
  RIDE_ALREADY_CANCELLED: 'RIDE_ALREADY_CANCELLED',
  RIDE_ALREADY_COMPLETED: 'RIDE_ALREADY_COMPLETED',
  RIDE_ALREADY_DEPARTED: 'RIDE_ALREADY_DEPARTED',
  RIDE_CANNOT_START: 'RIDE_CANNOT_START',
  RIDE_CANNOT_UPDATE: 'RIDE_CANNOT_UPDATE',
  RIDE_IN_PROGRESS: 'RIDE_IN_PROGRESS',
  RIDE_NOT_IN_PROGRESS: 'RIDE_NOT_IN_PROGRESS',
  RIDE_SEATS_CONFLICT: 'RIDE_SEATS_CONFLICT',
  RIDE_TIME_CONFLICT: 'RIDE_TIME_CONFLICT',
  INSUFFICIENT_SEATS: 'INSUFFICIENT_SEATS',

  // Booking
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_EXISTS: 'BOOKING_ALREADY_EXISTS',
  BOOKING_INVALID_STATUS: 'BOOKING_INVALID_STATUS',
  BOOKING_NOT_COMPLETED: 'BOOKING_NOT_COMPLETED',
  BOOKING_OWN_RIDE: 'CANNOT_BOOK_OWN_RIDE',
  BOOKING_TOO_LATE: 'BOOKING_TOO_LATE',
  BOOKING_CANNOT_CANCEL: 'BOOKING_CANNOT_CANCEL',

  // Rating
  RATING_NOT_FOUND: 'RATING_NOT_FOUND',
  RATING_EXISTS: 'RATING_ALREADY_EXISTS',
  RATING_WINDOW_EXPIRED: 'RATING_WINDOW_EXPIRED',
  RATING_EDIT_EXPIRED: 'RATING_EDIT_EXPIRED',
  RATING_DELETE_EXPIRED: 'RATING_DELETE_EXPIRED',

  // Notification
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',

  // Vehicle
  VEHICLE_NOT_FOUND: 'VEHICLE_NOT_FOUND',
  VEHICLE_NOT_VERIFIED: 'VEHICLE_NOT_VERIFIED',
  VEHICLE_PLATE_EXISTS: 'VEHICLE_PLATE_EXISTS',
  VEHICLE_HAS_ACTIVE_RIDES: 'VEHICLE_HAS_ACTIVE_RIDES',
  MAX_VEHICLES_REACHED: 'MAX_VEHICLES_REACHED',

  // Safety
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  ALERT_ALREADY_RESOLVED: 'ALERT_ALREADY_RESOLVED',
  NO_EMERGENCY_CONTACTS: 'NO_EMERGENCY_CONTACTS',

  // Emergency contacts
  EMERGENCY_CONTACT_NOT_FOUND: 'EMERGENCY_CONTACT_NOT_FOUND',
  DUPLICATE_EMERGENCY_CONTACT: 'DUPLICATE_EMERGENCY_CONTACT',
  MAX_EMERGENCY_CONTACTS: 'MAX_EMERGENCY_CONTACTS',

  // Misc
  PAYMENT_ALREADY_CONFIRMED: 'PAYMENT_ALREADY_CONFIRMED',
  PICKUP_POINT_HAS_BOOKINGS: 'PICKUP_POINT_HAS_BOOKINGS',
  MAX_PICKUP_POINTS: 'MAX_PICKUP_POINTS',
  NO_SHOW_TOO_EARLY: 'NO_SHOW_TOO_EARLY',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_ACTION: 'INVALID_ACTION',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_REQUEST: ErrorCodes.GENERAL.BAD_REQUEST,
  FORBIDDEN: ErrorCodes.AUTHZ.FORBIDDEN,
};

const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [ERROR_CODES.AUTH_ACCOUNT_DISABLED]: 'Your account has been suspended',
  [ERROR_CODES.AUTH_ACCOUNT_LOCKED]: 'Your account has been locked',
  [ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [ERROR_CODES.USER_EMAIL_EXISTS]: 'Email address is already registered',
  [ERROR_CODES.USER_MATRIC_EXISTS]: 'Matric number is already registered',
  [ERROR_CODES.USER_STAFF_ID_EXISTS]: 'Staff ID is already registered',
  [ERROR_CODES.RIDE_NOT_FOUND]: 'Ride not found',
  [ERROR_CODES.BOOKING_NOT_FOUND]: 'Booking not found',
  [ERROR_CODES.RATING_NOT_FOUND]: 'Rating not found',
  [ERROR_CODES.NOTIFICATION_NOT_FOUND]: 'Notification not found',
  [ERROR_CODES.VEHICLE_NOT_FOUND]: 'Vehicle not found',
  [ERROR_CODES.INSUFFICIENT_SEATS]: 'Not enough seats available',
  [ERROR_CODES.BOOKING_OWN_RIDE]: 'You cannot book your own ride',
  [ERROR_CODES.DRIVER_NOT_VERIFIED]: 'Driver verification required',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action',
};

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
  ErrorCodes,
  ErrorMessages,
  ErrorStatusCodes,
  getErrorMessage,
  getErrorStatus,
};
