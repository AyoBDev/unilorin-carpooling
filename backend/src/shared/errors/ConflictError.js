/**
 * Conflict Error
 * University of Ilorin Carpooling Platform
 *
 * Error class for resource conflict scenarios.
 * HTTP Status: 409
 */

const AppError = require('./AppError');

/**
 * ConflictError - When there's a conflict with the current state of a resource
 * @extends AppError
 */
class ConflictError extends AppError {
  /**
   * Create a ConflictError
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  constructor(message = 'Resource conflict', details = null) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      details,
    });
  }

  /**
   * Create for duplicate resource
   * @param {string} resource - Resource type
   * @param {string} field - Conflicting field
   * @param {any} value - Conflicting value
   * @returns {ConflictError}
   */
  static duplicate(resource, field, value = null) {
    return new ConflictError(`A ${resource} with this ${field} already exists`, {
      resource,
      field,
      ...(value && { value }),
    });
  }

  /**
   * Create for email already exists
   * @param {string} email - Email address
   * @returns {ConflictError}
   */
  static emailExists(email = null) {
    return new ConflictError('An account with this email already exists', {
      field: 'email',
      ...(email && { value: email }),
    });
  }

  /**
   * Create for phone number already exists
   * @param {string} phone - Phone number
   * @returns {ConflictError}
   */
  static phoneExists(phone = null) {
    return new ConflictError('An account with this phone number already exists', {
      field: 'phone',
      ...(phone && { value: phone }),
    });
  }

  /**
   * Create for matric number already exists
   * @param {string} matricNumber - Matric number
   * @returns {ConflictError}
   */
  static matricNumberExists(matricNumber = null) {
    return new ConflictError('An account with this matric number already exists', {
      field: 'matricNumber',
      ...(matricNumber && { value: matricNumber }),
    });
  }

  /**
   * Create for staff ID already exists
   * @param {string} staffId - Staff ID
   * @returns {ConflictError}
   */
  static staffIdExists(staffId = null) {
    return new ConflictError('An account with this staff ID already exists', {
      field: 'staffId',
      ...(staffId && { value: staffId }),
    });
  }

  /**
   * Create for vehicle plate number already exists
   * @param {string} plateNumber - Plate number
   * @returns {ConflictError}
   */
  static plateNumberExists(plateNumber = null) {
    return new ConflictError('A vehicle with this plate number already exists', {
      field: 'plateNumber',
      ...(plateNumber && { value: plateNumber }),
    });
  }

  /**
   * Create for booking conflict
   * @param {string} message - Custom message
   * @returns {ConflictError}
   */
  static bookingConflict(message = 'Booking conflict detected') {
    return new ConflictError(message, { type: 'BOOKING_CONFLICT' });
  }

  /**
   * Create for double booking (user already booked this ride)
   * @returns {ConflictError}
   */
  static alreadyBooked() {
    return new ConflictError('You have already booked this ride', { type: 'ALREADY_BOOKED' });
  }

  /**
   * Create for no available seats
   * @param {number} requested - Requested seats
   * @param {number} available - Available seats
   * @returns {ConflictError}
   */
  static noSeatsAvailable(requested = 1, available = 0) {
    return new ConflictError(
      available === 0
        ? 'No seats available on this ride'
        : `Only ${available} seat(s) available, but ${requested} requested`,
      { type: 'NO_SEATS', requested, available },
    );
  }

  /**
   * Create for ride already started
   * @returns {ConflictError}
   */
  static rideAlreadyStarted() {
    return new ConflictError('This ride has already started', { type: 'RIDE_STARTED' });
  }

  /**
   * Create for ride already completed
   * @returns {ConflictError}
   */
  static rideAlreadyCompleted() {
    return new ConflictError('This ride has already been completed', { type: 'RIDE_COMPLETED' });
  }

  /**
   * Create for ride already cancelled
   * @returns {ConflictError}
   */
  static rideAlreadyCancelled() {
    return new ConflictError('This ride has already been cancelled', { type: 'RIDE_CANCELLED' });
  }

  /**
   * Create for booking already cancelled
   * @returns {ConflictError}
   */
  static bookingAlreadyCancelled() {
    return new ConflictError('This booking has already been cancelled', {
      type: 'BOOKING_CANCELLED',
    });
  }

  /**
   * Create for rating already submitted
   * @returns {ConflictError}
   */
  static alreadyRated() {
    return new ConflictError('You have already rated this booking', { type: 'ALREADY_RATED' });
  }

  /**
   * Create for user already a driver
   * @returns {ConflictError}
   */
  static alreadyDriver() {
    return new ConflictError('You are already registered as a driver', { type: 'ALREADY_DRIVER' });
  }

  /**
   * Create for driver verification pending
   * @returns {ConflictError}
   */
  static verificationPending() {
    return new ConflictError('Your driver verification is already pending', {
      type: 'VERIFICATION_PENDING',
    });
  }

  /**
   * Create for concurrent modification
   * @param {string} resource - Resource type
   * @returns {ConflictError}
   */
  static concurrentModification(resource = 'Resource') {
    return new ConflictError(
      `${resource} was modified by another process. Please refresh and try again`,
      { type: 'CONCURRENT_MODIFICATION' },
    );
  }

  /**
   * Create for state transition conflict
   * @param {string} from - Current state
   * @param {string} to - Target state
   * @returns {ConflictError}
   */
  static invalidStateTransition(from, to) {
    return new ConflictError(`Cannot transition from '${from}' to '${to}'`, {
      type: 'INVALID_STATE_TRANSITION',
      from,
      to,
    });
  }
}

module.exports = ConflictError;
