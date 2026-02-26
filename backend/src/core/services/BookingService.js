/**
 * Booking Service
 * University of Ilorin Carpooling Platform
 *
 * Handles booking creation, cancellation, verification codes,
 * cash payment workflow, ride start/completion, and no-show handling.
 * Phase 1: Offline cash payment only.
 *
 * @module services/BookingService
 */

const { randomUUID } = require('crypto');
const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { logger } = require('../../shared/utils/logger');
const {
  generateVerificationCode,
  generateBookingReference,
} = require('../../shared/utils/encryption');
const {
  formatDate,
  now,
  isExpired,
  addMinutes,
  addHours,
  isBefore,
  calculateDuration,
} = require('../../shared/utils/dateTime');
const { validateBooking } = require('../../shared/utils/validation');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} = require('../../shared/errors');
const { ERROR_CODES, ERROR_MESSAGES } = require('../../shared/constants/errors');
const { BOOKING_EVENTS } = require('../../shared/constants/events');
const { getBookingEventPublisher } = require('../../infrastructure/messaging');

/**
 * Booking status constants
 */
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  IN_PROGRESS: 'in_progress',
};

/**
 * Payment status constants (Phase 1: Cash only)
 */
const PAYMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed', // Driver confirms cash received
  WAIVED: 'waived', // Payment waived by driver
};

/**
 * Booking configuration
 */
const BOOKING_CONFIG = {
  maxSeatsPerBooking: 4,
  minAdvanceMinutes: 30,
  cancellationDeadlineMinutes: 60, // 1 hour before departure
  verificationCodeLength: 6,
  verificationCodeExpiry: 24, // hours
  noShowGracePeriodMinutes: 15,
};

/**
 * BookingService class
 * Manages booking-related operations
 */
class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.rideRepository = new RideRepository();
    this.userRepository = new UserRepository();
    this.serviceName = 'BookingService';
    this.eventPublisher = getBookingEventPublisher();
  }

  // ==================== Booking Creation ====================

  /**
   * Create a new booking
   * @param {string} passengerId - Passenger user ID
   * @param {Object} bookingData - Booking data
   * @returns {Promise<Object>} Created booking
   */
  async createBooking(passengerId, bookingData) {
    const startTime = Date.now();
    logger.info('Creating booking', {
      action: BOOKING_EVENTS.BOOKING_CREATED,
      passengerId,
      rideId: bookingData.rideId,
    });

    try {
      // Validate booking data
      const { error, value } = validateBooking(bookingData);
      if (error) {
        throw new ValidationError('Booking validation failed', error.details);
      }

      const { rideId, pickupPointId, seats = 1, notes } = value;

      // Validate passenger
      const passenger = await this._validatePassenger(passengerId);

      // Validate ride
      const ride = await this._validateRideForBooking(rideId, passengerId, seats);

      // Validate pickup point
      const pickupPoint = this._validatePickupPoint(ride, pickupPointId);

      // Check for existing booking
      await this._checkExistingBooking(passengerId, rideId);

      // Generate booking reference and verification code
      const bookingReference = generateBookingReference();
      const verificationCode = generateVerificationCode(BOOKING_CONFIG.verificationCodeLength);
      const verificationExpiry = addHours(now(), BOOKING_CONFIG.verificationCodeExpiry);

      // Calculate total amount
      const totalAmount = ride.pricePerSeat * seats;

      // Create booking ID
      const bookingId = randomUUID();

      // Build booking data
      const booking = {
        bookingId,
        bookingReference,
        rideId,
        passengerId,
        driverId: ride.driverId,
        pickupPointId: pickupPoint?.pickupPointId || null,
        pickupPointName: pickupPoint?.name || ride.startLocation.name,
        seats,
        pricePerSeat: ride.pricePerSeat,
        totalAmount,
        status: BOOKING_STATUS.PENDING,
        paymentMethod: 'cash', // Phase 1: Cash only
        paymentStatus: PAYMENT_STATUS.PENDING,
        verificationCode,
        verificationExpiry: formatDate(verificationExpiry),
        notes: notes || null,
        // Ride details denormalized
        rideDate: ride.departureDate,
        rideTime: ride.departureTime,
        rideDepartureDateTime: ride.departureDateTime,
        startLocation: ride.startLocation,
        endLocation: ride.endLocation,
        // Passenger info denormalized
        passenger: {
          userId: passenger.userId,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          phone: passenger.phone,
          profilePhoto: passenger.profilePhoto,
        },
        // Driver info denormalized
        driver: {
          userId: ride.driver.userId,
          firstName: ride.driver.firstName,
          lastName: ride.driver.lastName,
          phone: ride.driver.phone,
        },
        // Vehicle info denormalized
        vehicle: ride.vehicle,
        // Timestamps
        createdAt: formatDate(now()),
        updatedAt: formatDate(now()),
      };

      // Save booking
      const createdBooking = await this.bookingRepository.create(booking);

      // Update ride available seats
      await this.rideRepository.updateSeats(rideId, -seats);

      // Update passenger statistics
      await this.userRepository.incrementPassengerBookings(passengerId);

      logger.info('Booking created successfully', {
        action: BOOKING_EVENTS.BOOKING_CREATED,
        bookingId,
        bookingReference,
        rideId,
        passengerId,
        seats,
        totalAmount,
        duration: Date.now() - startTime,
      });

      // Fire-and-forget: notify passenger via SQS
      this.eventPublisher.bookingCreated(booking).catch((err) => {
        logger.warn('Failed to publish bookingCreated event', { bookingId, error: err.message });
      });

      return {
        booking: this._sanitizeBooking(createdBooking),
        message: 'Booking created successfully',
        paymentInstructions: this._getPaymentInstructions(createdBooking),
      };
    } catch (error) {
      logger.error('Failed to create booking', {
        action: 'BOOKING_CREATE_FAILED',
        passengerId,
        rideId: bookingData.rideId,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  // ==================== Booking Retrieval ====================

  /**
   * Get booking by ID
   * @param {string} bookingId - Booking ID
   * @param {string} userId - Requesting user ID
   * @returns {Promise<Object>} Booking details
   */
  async getBookingById(bookingId, userId) {
    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      // Check authorization (passenger or driver can view)
      if (booking.passengerId !== userId && booking.driverId !== userId) {
        throw new ForbiddenError('Not authorized to view this booking', ERROR_CODES.FORBIDDEN);
      }

      const isDriver = booking.driverId === userId;
      const isPassenger = booking.passengerId === userId;

      return {
        ...this._sanitizeBooking(booking),
        isDriver,
        isPassenger,
        // Show verification code only to passenger and only if pending/confirmed
        verificationCode:
          isPassenger && ['pending', 'confirmed'].includes(booking.status)
            ? booking.verificationCode
            : undefined,
        canCancel: this._canCancelBooking(booking, userId),
        canConfirmPayment: isDriver && booking.paymentStatus === PAYMENT_STATUS.PENDING,
      };
    } catch (error) {
      logger.error('Failed to get booking', {
        action: 'BOOKING_GET_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get booking by reference
   * @param {string} reference - Booking reference
   * @returns {Promise<Object>} Booking details
   */
  async getBookingByReference(reference) {
    try {
      const booking = await this.bookingRepository.findByReference(reference);
      if (!booking) {
        throw new NotFoundError(
          'Booking not found with this reference',
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }
      return booking;
    } catch (error) {
      logger.error('Failed to get booking by reference', {
        action: 'BOOKING_GET_BY_REF_FAILED',
        reference,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get bookings for passenger
   * @param {string} passengerId - Passenger ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Passenger bookings
   */
  async getPassengerBookings(passengerId, filters = {}) {
    try {
      const { status, upcoming = true, page = 1, limit = 20 } = filters;

      let bookings = await this.bookingRepository.findByPassenger(passengerId);

      // Filter by status
      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        bookings = bookings.filter((b) => statuses.includes(b.status));
      }

      // Filter upcoming vs past
      if (upcoming !== undefined) {
        bookings = bookings.filter((b) => {
          const isPast = isExpired(b.rideDepartureDateTime);
          return upcoming ? !isPast : isPast;
        });
      }

      // Sort by ride date (upcoming first, then most recent)
      bookings.sort(
        (a, b) => new Date(a.rideDepartureDateTime) - new Date(b.rideDepartureDateTime),
      );

      // Paginate
      const totalCount = bookings.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedBookings = bookings.slice(startIndex, startIndex + limit);

      return {
        bookings: paginatedBookings.map((b) => this._sanitizeBooking(b)),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get passenger bookings', {
        action: 'PASSENGER_BOOKINGS_FETCH_FAILED',
        passengerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get bookings for a ride (driver view)
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID (for authorization)
   * @returns {Promise<Object>} Ride bookings
   */
  async getRideBookings(rideId, driverId) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError(
          'Not authorized to view bookings for this ride',
          ERROR_CODES.FORBIDDEN,
        );
      }

      const bookings = await this.bookingRepository.findByRide(rideId);

      // Group by status
      const grouped = {
        confirmed: bookings.filter((b) => b.status === BOOKING_STATUS.CONFIRMED),
        pending: bookings.filter((b) => b.status === BOOKING_STATUS.PENDING),
        inProgress: bookings.filter((b) => b.status === BOOKING_STATUS.IN_PROGRESS),
        completed: bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED),
        cancelled: bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED),
        noShow: bookings.filter((b) => b.status === BOOKING_STATUS.NO_SHOW),
      };

      // Calculate totals
      const activeBookings = [...grouped.confirmed, ...grouped.pending, ...grouped.inProgress];
      const totalSeatsBooked = activeBookings.reduce((sum, b) => sum + b.seats, 0);
      const totalExpectedCash = activeBookings.reduce((sum, b) => sum + b.totalAmount, 0);

      return {
        bookings: bookings.map((b) => ({
          ...this._sanitizeBooking(b),
          // Include verification code for driver to verify
          verificationCode: b.verificationCode,
        })),
        grouped,
        summary: {
          totalBookings: bookings.length,
          activeBookings: activeBookings.length,
          totalSeatsBooked,
          availableSeats: ride.availableSeats,
          totalExpectedCash,
        },
      };
    } catch (error) {
      logger.error('Failed to get ride bookings', {
        action: 'RIDE_BOOKINGS_FETCH_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Booking Confirmation ====================

  /**
   * Confirm booking (driver confirms passenger)
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Confirmed booking
   */
  async confirmBooking(bookingId, driverId) {
    logger.info('Confirming booking', {
      action: BOOKING_EVENTS.BOOKING_CONFIRMED,
      bookingId,
      driverId,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to confirm this booking', ERROR_CODES.FORBIDDEN);
      }

      if (booking.status !== BOOKING_STATUS.PENDING) {
        throw new BadRequestError(
          `Cannot confirm booking with status: ${booking.status}`,
          ERROR_CODES.BOOKING_INVALID_STATUS,
        );
      }

      const updatedBooking = await this.bookingRepository.updateStatus(
        bookingId,
        BOOKING_STATUS.CONFIRMED,
        {
          confirmedAt: formatDate(now()),
          confirmedBy: driverId,
        },
      );

      logger.info('Booking confirmed', {
        action: BOOKING_EVENTS.BOOKING_CONFIRMED,
        bookingId,
      });

      // Fire-and-forget: notify passenger via SQS
      this.eventPublisher.bookingConfirmed(booking).catch((err) => {
        logger.warn('Failed to publish bookingConfirmed event', { bookingId, error: err.message });
      });

      return {
        booking: this._sanitizeBooking(updatedBooking),
        message: 'Booking confirmed successfully',
        notifyPassenger: true,
      };
    } catch (error) {
      logger.error('Failed to confirm booking', {
        action: 'BOOKING_CONFIRM_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Booking Cancellation ====================

  /**
   * Cancel booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID (passenger or driver)
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelBooking(bookingId, userId, reason = '') {
    logger.info('Cancelling booking', {
      action: BOOKING_EVENTS.BOOKING_CANCELLED,
      bookingId,
      userId,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      // Check authorization
      const isPassenger = booking.passengerId === userId;
      const isDriver = booking.driverId === userId;

      if (!isPassenger && !isDriver) {
        throw new ForbiddenError('Not authorized to cancel this booking', ERROR_CODES.FORBIDDEN);
      }

      // Check if booking can be cancelled
      if (!this._canCancelBooking(booking, userId)) {
        throw new BadRequestError(
          'Booking cannot be cancelled at this time',
          ERROR_CODES.BOOKING_CANNOT_CANCEL,
        );
      }

      // Determine cancellation type
      const cancelledBy = isPassenger ? 'passenger' : 'driver';
      const isLateCancellation = this._isLateCancellation(booking);

      // Update booking status
      const updatedBooking = await this.bookingRepository.updateStatus(
        bookingId,
        BOOKING_STATUS.CANCELLED,
        {
          cancelledAt: formatDate(now()),
          cancelledBy: userId,
          cancellationReason: reason,
          cancellationType: cancelledBy,
          isLateCancellation,
        },
      );

      // Return seats to ride
      await this.rideRepository.updateSeats(booking.rideId, booking.seats);

      // Update statistics
      if (isPassenger) {
        await this.userRepository.incrementPassengerCancellations(userId);
        if (isLateCancellation) {
          await this.userRepository.incrementLateCancellations(userId);
        }
      } else {
        await this.userRepository.incrementDriverCancellations(userId);
      }

      logger.info('Booking cancelled', {
        action: BOOKING_EVENTS.BOOKING_CANCELLED,
        bookingId,
        cancelledBy,
        isLateCancellation,
      });

      // Fire-and-forget: notify other party via SQS
      this.eventPublisher.bookingCancelled(booking, cancelledBy, reason).catch((err) => {
        logger.warn('Failed to publish bookingCancelled event', { bookingId, error: err.message });
      });

      return {
        booking: this._sanitizeBooking(updatedBooking),
        message: 'Booking cancelled successfully',
        cancelledBy,
        isLateCancellation,
        notifyOtherParty: true,
      };
    } catch (error) {
      logger.error('Failed to cancel booking', {
        action: 'BOOKING_CANCEL_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride Start / Verification ====================

  /**
   * Start ride for booking (verify passenger code)
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @param {string} verificationCode - Passenger's verification code
   * @returns {Promise<Object>} Started booking
   */
  async startRideForBooking(bookingId, driverId, verificationCode) {
    logger.info('Starting ride for booking', {
      action: BOOKING_EVENTS.BOOKING_STARTED,
      bookingId,
      driverId,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to start this booking', ERROR_CODES.FORBIDDEN);
      }

      // Verify status
      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw new BadRequestError(
          `Cannot start booking with status: ${booking.status}`,
          ERROR_CODES.BOOKING_INVALID_STATUS,
        );
      }

      // Verify the code
      if (!this._verifyCode(booking, verificationCode)) {
        throw new BadRequestError(
          'Invalid verification code',
          ERROR_CODES.INVALID_VERIFICATION_CODE,
        );
      }

      // Update booking status
      const updatedBooking = await this.bookingRepository.updateStatus(
        bookingId,
        BOOKING_STATUS.IN_PROGRESS,
        {
          startedAt: formatDate(now()),
          verifiedAt: formatDate(now()),
          verifiedBy: driverId,
        },
      );

      logger.info('Booking started', {
        action: BOOKING_EVENTS.BOOKING_STARTED,
        bookingId,
      });

      return {
        booking: this._sanitizeBooking(updatedBooking),
        message: 'Passenger verified and ride started',
        verified: true,
      };
    } catch (error) {
      logger.error('Failed to start booking', {
        action: 'BOOKING_START_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get verification code for booking
   * @param {string} bookingId - Booking ID
   * @param {string} passengerId - Passenger ID
   * @returns {Promise<Object>} Verification code
   */
  async getVerificationCode(bookingId, passengerId) {
    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.passengerId !== passengerId) {
        throw new ForbiddenError('Not authorized to view verification code', ERROR_CODES.FORBIDDEN);
      }

      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw new BadRequestError(
          'Verification code not available for this booking status',
          ERROR_CODES.BOOKING_INVALID_STATUS,
        );
      }

      // Check if code is expired
      if (isExpired(booking.verificationExpiry)) {
        // Generate new code
        const newCode = generateVerificationCode(BOOKING_CONFIG.verificationCodeLength);
        const newExpiry = addHours(now(), BOOKING_CONFIG.verificationCodeExpiry);

        await this.bookingRepository.update(bookingId, {
          verificationCode: newCode,
          verificationExpiry: formatDate(newExpiry),
        });

        return {
          verificationCode: newCode,
          expiresAt: formatDate(newExpiry),
          regenerated: true,
        };
      }

      return {
        verificationCode: booking.verificationCode,
        expiresAt: booking.verificationExpiry,
        regenerated: false,
      };
    } catch (error) {
      logger.error('Failed to get verification code', {
        action: 'VERIFICATION_CODE_GET_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Regenerate verification code
   * @param {string} bookingId - Booking ID
   * @param {string} passengerId - Passenger ID
   * @returns {Promise<Object>} New verification code
   */
  async regenerateVerificationCode(bookingId, passengerId) {
    logger.info('Regenerating verification code', {
      action: 'VERIFICATION_CODE_REGENERATED',
      bookingId,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.passengerId !== passengerId) {
        throw new ForbiddenError('Not authorized to regenerate code', ERROR_CODES.FORBIDDEN);
      }

      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw new BadRequestError(
          'Cannot regenerate code for this booking status',
          ERROR_CODES.BOOKING_INVALID_STATUS,
        );
      }

      const newCode = generateVerificationCode(BOOKING_CONFIG.verificationCodeLength);
      const newExpiry = addHours(now(), BOOKING_CONFIG.verificationCodeExpiry);

      await this.bookingRepository.update(bookingId, {
        verificationCode: newCode,
        verificationExpiry: formatDate(newExpiry),
        codeRegeneratedAt: formatDate(now()),
      });

      return {
        verificationCode: newCode,
        expiresAt: formatDate(newExpiry),
      };
    } catch (error) {
      logger.error('Failed to regenerate verification code', {
        action: 'VERIFICATION_CODE_REGEN_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride Completion & Payment ====================

  /**
   * Complete booking and confirm cash payment
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @param {Object} completionData - Completion data
   * @returns {Promise<Object>} Completed booking
   */
  async completeBooking(bookingId, driverId, completionData = {}) {
    logger.info('Completing booking', {
      action: BOOKING_EVENTS.BOOKING_COMPLETED,
      bookingId,
      driverId,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to complete this booking', ERROR_CODES.FORBIDDEN);
      }

      if (booking.status !== BOOKING_STATUS.IN_PROGRESS) {
        throw new BadRequestError(
          'Booking must be in progress to complete',
          ERROR_CODES.BOOKING_INVALID_STATUS,
        );
      }

      const { cashReceived = true, amountReceived, notes } = completionData;

      // Calculate duration
      const duration = calculateDuration(booking.startedAt, now());

      // Update booking
      const updatedBooking = await this.bookingRepository.updateStatus(
        bookingId,
        BOOKING_STATUS.COMPLETED,
        {
          completedAt: formatDate(now()),
          paymentStatus: cashReceived ? PAYMENT_STATUS.CONFIRMED : PAYMENT_STATUS.WAIVED,
          amountReceived: cashReceived ? amountReceived || booking.totalAmount : 0,
          cashReceivedAt: cashReceived ? formatDate(now()) : null,
          duration,
          completionNotes: notes,
        },
      );

      // Update statistics
      await this.userRepository.incrementPassengerCompletedRides(booking.passengerId);
      await this.userRepository.incrementPassengerTotalSpent(
        booking.passengerId,
        booking.totalAmount,
      );

      if (cashReceived) {
        await this.userRepository.incrementDriverEarnings(driverId, booking.totalAmount);
      }

      logger.info('Booking completed', {
        action: BOOKING_EVENTS.BOOKING_COMPLETED,
        bookingId,
        cashReceived,
        amount: booking.totalAmount,
        duration,
      });

      return {
        booking: this._sanitizeBooking(updatedBooking),
        message: 'Booking completed successfully',
        cashReceived,
        amountReceived: cashReceived ? amountReceived || booking.totalAmount : 0,
        duration,
        promptForRating: true,
      };
    } catch (error) {
      logger.error('Failed to complete booking', {
        action: 'BOOKING_COMPLETE_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Confirm cash payment received
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @param {number} amountReceived - Amount received
   * @returns {Promise<Object>} Updated booking
   */
  async confirmCashPayment(bookingId, driverId, amountReceived) {
    logger.info('Confirming cash payment', {
      action: 'CASH_PAYMENT_CONFIRMED',
      bookingId,
      driverId,
      amountReceived,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to confirm payment', ERROR_CODES.FORBIDDEN);
      }

      if (booking.paymentStatus === PAYMENT_STATUS.CONFIRMED) {
        throw new BadRequestError(
          'Payment already confirmed',
          ERROR_CODES.PAYMENT_ALREADY_CONFIRMED,
        );
      }

      const updatedBooking = await this.bookingRepository.update(bookingId, {
        paymentStatus: PAYMENT_STATUS.CONFIRMED,
        amountReceived: amountReceived || booking.totalAmount,
        cashReceivedAt: formatDate(now()),
        paymentConfirmedBy: driverId,
      });

      // Update driver earnings
      await this.userRepository.incrementDriverEarnings(
        driverId,
        amountReceived || booking.totalAmount,
      );

      return {
        booking: this._sanitizeBooking(updatedBooking),
        message: 'Cash payment confirmed',
        amountReceived: amountReceived || booking.totalAmount,
      };
    } catch (error) {
      logger.error('Failed to confirm cash payment', {
        action: 'CASH_PAYMENT_CONFIRM_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== No-Show Handling ====================

  /**
   * Mark booking as no-show
   * @param {string} bookingId - Booking ID
   * @param {string} driverId - Driver ID
   * @param {string} notes - Notes
   * @returns {Promise<Object>} Updated booking
   */
  async markNoShow(bookingId, driverId, notes = '') {
    logger.info('Marking no-show', {
      action: BOOKING_EVENTS.BOOKING_NO_SHOW,
      bookingId,
      driverId,
    });

    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.BOOKING_NOT_FOUND],
          ERROR_CODES.BOOKING_NOT_FOUND,
        );
      }

      if (booking.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to mark no-show', ERROR_CODES.FORBIDDEN);
      }

      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw new BadRequestError(
          `Cannot mark no-show for booking with status: ${booking.status}`,
          ERROR_CODES.BOOKING_INVALID_STATUS,
        );
      }

      // Check if past departure time + grace period
      const graceEnd = addMinutes(
        booking.rideDepartureDateTime,
        BOOKING_CONFIG.noShowGracePeriodMinutes,
      );

      if (!isExpired(graceEnd)) {
        throw new BadRequestError(
          `Please wait until ${BOOKING_CONFIG.noShowGracePeriodMinutes} minutes after departure time`,
          ERROR_CODES.NO_SHOW_TOO_EARLY,
        );
      }

      const updatedBooking = await this.bookingRepository.updateStatus(
        bookingId,
        BOOKING_STATUS.NO_SHOW,
        {
          noShowAt: formatDate(now()),
          noShowNotes: notes,
          markedBy: driverId,
        },
      );

      // Return seats to ride (if ride still active)
      await this.rideRepository.updateSeats(booking.rideId, booking.seats);

      // Update passenger no-show count
      await this.userRepository.incrementPassengerNoShows(booking.passengerId);

      logger.info('Booking marked as no-show', {
        action: BOOKING_EVENTS.BOOKING_NO_SHOW,
        bookingId,
        passengerId: booking.passengerId,
      });

      // Fire-and-forget: notify passenger via SQS
      this.eventPublisher.bookingNoShow(booking).catch((err) => {
        logger.warn('Failed to publish bookingNoShow event', { bookingId, error: err.message });
      });

      return {
        booking: this._sanitizeBooking(updatedBooking),
        message: 'Passenger marked as no-show',
        notifyPassenger: true,
      };
    } catch (error) {
      logger.error('Failed to mark no-show', {
        action: 'NO_SHOW_MARK_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== History & Statistics ====================

  /**
   * Get upcoming bookings for a user
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Upcoming bookings
   */
  async getUpcomingBookings(userId, options = {}) {
    const { role = 'passenger', limit = 10 } = options;

    try {
      let bookings;
      if (role === 'driver') {
        bookings = await this.bookingRepository.findByDriver(userId);
      } else {
        bookings = await this.bookingRepository.findByPassenger(userId);
      }

      // Filter to upcoming only (not departed yet) and active statuses
      const upcomingBookings = bookings
        .filter(
          (b) =>
            ['pending', 'confirmed'].includes(b.status) &&
            !isExpired(b.rideDepartureDateTime),
        )
        .sort((a, b) => new Date(a.rideDepartureDateTime) - new Date(b.rideDepartureDateTime))
        .slice(0, limit);

      return upcomingBookings.map((b) => this._sanitizeBooking(b));
    } catch (error) {
      logger.error('Failed to get upcoming bookings', {
        action: 'UPCOMING_BOOKINGS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get past bookings for a user
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Past bookings with pagination
   */
  async getPastBookings(userId, options = {}) {
    const { role = 'passenger', page = 1, limit = 20 } = options;

    try {
      let bookings;
      if (role === 'driver') {
        bookings = await this.bookingRepository.findByDriver(userId);
      } else {
        bookings = await this.bookingRepository.findByPassenger(userId);
      }

      // Filter to past bookings (completed, cancelled, no_show, or departed)
      const pastBookings = bookings
        .filter(
          (b) =>
            ['completed', 'cancelled', 'no_show'].includes(b.status) ||
            isExpired(b.rideDepartureDateTime),
        )
        .sort((a, b) => new Date(b.rideDepartureDateTime) - new Date(a.rideDepartureDateTime));

      // Paginate
      const totalCount = pastBookings.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedBookings = pastBookings.slice(startIndex, startIndex + limit);

      return {
        bookings: paginatedBookings.map((b) => this._sanitizeBooking(b)),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get past bookings', {
        action: 'PAST_BOOKINGS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get booking statistics for a user
   * @param {string} userId - User ID
   * @param {string} role - 'passenger' or 'driver'
   * @param {string} period - Time period (e.g., '30days', '90days', 'all')
   * @returns {Promise<Object>} Booking statistics
   */
  async getBookingStatistics(userId, role = 'passenger', period = '30days') {
    try {
      let bookings;
      if (role === 'driver') {
        bookings = await this.bookingRepository.findByDriver(userId);
      } else {
        bookings = await this.bookingRepository.findByPassenger(userId);
      }

      // Filter by period
      const periodDays = period === 'all' ? null : parseInt(period, 10) || 30;
      if (periodDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - periodDays);
        bookings = bookings.filter((b) => new Date(b.createdAt) >= cutoff);
      }

      const totalBookings = bookings.length;
      const completed = bookings.filter((b) => b.status === BOOKING_STATUS.COMPLETED);
      const cancelled = bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED);
      const noShows = bookings.filter((b) => b.status === BOOKING_STATUS.NO_SHOW);

      const totalSpent = completed.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const completionRate = totalBookings > 0 ? (completed.length / totalBookings) * 100 : 0;

      return {
        period,
        totalBookings,
        completedBookings: completed.length,
        cancelledBookings: cancelled.length,
        noShowBookings: noShows.length,
        totalAmount: totalSpent,
        currency: 'NGN',
        completionRate: Math.round(completionRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get booking statistics', {
        action: 'BOOKING_STATISTICS_FETCH_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Availability Check ====================

  /**
   * Check seat availability for a ride
   * @param {string} rideId - Ride ID
   * @param {number} requestedSeats - Number of seats
   * @returns {Promise<Object>} Availability result
   */
  async checkAvailability(rideId, requestedSeats = 1) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      const isAvailable = ride.availableSeats >= requestedSeats;
      const canBook =
        isAvailable &&
        ride.status === 'active' &&
        !isExpired(addMinutes(ride.departureDateTime, -BOOKING_CONFIG.minAdvanceMinutes));

      return {
        rideId,
        available: isAvailable,
        canBook,
        availableSeats: ride.availableSeats,
        requestedSeats,
        pricePerSeat: ride.pricePerSeat,
        totalPrice: ride.pricePerSeat * requestedSeats,
        rideStatus: ride.status,
        departureDateTime: ride.departureDateTime,
        reasons: !canBook ? this._getUnavailabilityReasons(ride, requestedSeats) : [],
      };
    } catch (error) {
      logger.error('Failed to check availability', {
        action: 'AVAILABILITY_CHECK_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Bulk Operations ====================

  /**
   * Complete all bookings for a ride
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Completion result
   */
  async completeAllBookingsForRide(rideId, driverId) {
    logger.info('Completing all bookings for ride', {
      action: 'BULK_BOOKING_COMPLETE',
      rideId,
      driverId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride || ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized', ERROR_CODES.FORBIDDEN);
      }

      const bookings = await this.bookingRepository.findByRide(rideId);
      const inProgressBookings = bookings.filter((b) => b.status === BOOKING_STATUS.IN_PROGRESS);

      const results = await inProgressBookings.reduce(
        async (accPromise, booking) => {
          const acc = await accPromise;
          try {
            await this.completeBooking(booking.bookingId, driverId, { cashReceived: true });
            acc.completed.push(booking.bookingId);
          } catch (error) {
            acc.failed.push({
              bookingId: booking.bookingId,
              error: error.message,
            });
          }
          return acc;
        },
        Promise.resolve({
          completed: [],
          failed: [],
        }),
      );

      return {
        message: `Completed ${results.completed.length} bookings`,
        results,
      };
    } catch (error) {
      logger.error('Failed to complete all bookings', {
        action: 'BULK_BOOKING_COMPLETE_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Validate passenger eligibility
   * @private
   */
  async _validatePassenger(passengerId) {
    const passenger = await this.userRepository.findById(passengerId);

    if (!passenger) {
      throw new NotFoundError('Passenger not found', ERROR_CODES.USER_NOT_FOUND);
    }

    if (!passenger.isVerified) {
      throw new ForbiddenError(
        'Email must be verified to book rides',
        ERROR_CODES.USER_NOT_VERIFIED,
      );
    }

    if (!passenger.isActive) {
      throw new ForbiddenError('Account is not active', ERROR_CODES.ACCOUNT_DISABLED);
    }

    // Check no-show history (optional restriction)
    const stats = await this.userRepository.getUserStatistics(passengerId);
    if (stats.noShowCount >= 5) {
      logger.warn('High no-show count passenger', {
        passengerId,
        noShowCount: stats.noShowCount,
      });
      // Could restrict booking here
    }

    return passenger;
  }

  /**
   * Validate ride for booking
   * @private
   */
  async _validateRideForBooking(rideId, passengerId, seats) {
    const ride = await this.rideRepository.findById(rideId);

    if (!ride) {
      throw new NotFoundError(
        ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
        ERROR_CODES.RIDE_NOT_FOUND,
      );
    }

    // Can't book own ride
    if (ride.driverId === passengerId) {
      throw new BadRequestError('Cannot book your own ride', ERROR_CODES.BOOKING_OWN_RIDE);
    }

    // Check ride status
    if (ride.status !== 'active') {
      throw new BadRequestError(
        `Ride is not available for booking (status: ${ride.status})`,
        ERROR_CODES.RIDE_NOT_AVAILABLE,
      );
    }

    // Check seats
    if (ride.availableSeats < seats) {
      throw new BadRequestError(
        `Only ${ride.availableSeats} seats available`,
        ERROR_CODES.INSUFFICIENT_SEATS,
      );
    }

    if (seats > BOOKING_CONFIG.maxSeatsPerBooking) {
      throw new ValidationError('Too many seats requested', [
        {
          field: 'seats',
          message: `Maximum ${BOOKING_CONFIG.maxSeatsPerBooking} seats per booking`,
        },
      ]);
    }

    // Check departure time
    const minBookingTime = addMinutes(now(), BOOKING_CONFIG.minAdvanceMinutes);
    if (isBefore(ride.departureDateTime, minBookingTime)) {
      throw new BadRequestError(
        `Booking must be made at least ${BOOKING_CONFIG.minAdvanceMinutes} minutes before departure`,
        ERROR_CODES.BOOKING_TOO_LATE,
      );
    }

    return ride;
  }

  /**
   * Validate pickup point
   * @private
   */
  _validatePickupPoint(ride, pickupPointId) {
    if (!pickupPointId) return null;

    const pickupPoint = ride.pickupPoints?.find((p) => p.pickupPointId === pickupPointId);
    if (!pickupPoint) {
      throw new ValidationError('Invalid pickup point', [
        {
          field: 'pickupPointId',
          message: 'Pickup point not found for this ride',
        },
      ]);
    }

    return pickupPoint;
  }

  /**
   * Check for existing booking
   * @private
   */
  async _checkExistingBooking(passengerId, rideId) {
    const existingBooking = await this.bookingRepository.findByPassengerAndRide(
      passengerId,
      rideId,
    );

    if (
      existingBooking &&
      ['pending', 'confirmed', 'in_progress'].includes(existingBooking.status)
    ) {
      throw new ConflictError(
        'You already have a booking for this ride',
        ERROR_CODES.BOOKING_EXISTS,
        { existingBookingId: existingBooking.bookingId },
      );
    }
  }

  /**
   * Verify verification code
   * @private
   */
  _verifyCode(booking, code) {
    if (!code || !booking.verificationCode) return false;

    // Check expiry
    if (booking.verificationExpiry && isExpired(booking.verificationExpiry)) {
      return false;
    }

    // Case-insensitive comparison
    return booking.verificationCode.toUpperCase() === code.toUpperCase();
  }

  /**
   * Check if booking can be cancelled
   * @private
   */
  _canCancelBooking(booking, userId) {
    // Already cancelled or completed
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      return false;
    }

    // In progress - only driver can cancel
    if (booking.status === 'in_progress') {
      return booking.driverId === userId;
    }

    // Past departure time
    if (isExpired(booking.rideDepartureDateTime)) {
      return false;
    }

    return true;
  }

  /**
   * Check if it's a late cancellation
   * @private
   */
  _isLateCancellation(booking) {
    const deadline = addMinutes(
      booking.rideDepartureDateTime,
      -BOOKING_CONFIG.cancellationDeadlineMinutes,
    );
    return isExpired(deadline);
  }

  /**
   * Get payment instructions
   * @private
   */
  _getPaymentInstructions(booking) {
    return {
      paymentMethod: 'cash',
      amount: booking.totalAmount,
      currency: 'NGN',
      instructions: [
        `Pay ₦${booking.totalAmount} in cash to the driver when boarding`,
        'Show your verification code to the driver',
        `Your verification code: ${booking.verificationCode}`,
        'Keep exact change if possible',
        'Get a confirmation from the driver after payment',
      ],
      verificationCode: booking.verificationCode,
      verificationExpiry: booking.verificationExpiry,
    };
  }

  /**
   * Get unavailability reasons
   * @private
   */
  _getUnavailabilityReasons(ride, requestedSeats) {
    const reasons = [];

    if (ride.status !== 'active') {
      reasons.push(`Ride status is ${ride.status}`);
    }

    if (ride.availableSeats < requestedSeats) {
      reasons.push(`Only ${ride.availableSeats} seats available`);
    }

    if (isExpired(ride.departureDateTime)) {
      reasons.push('Ride has already departed');
    }

    const minBookingTime = addMinutes(now(), BOOKING_CONFIG.minAdvanceMinutes);
    if (isBefore(ride.departureDateTime, minBookingTime)) {
      reasons.push(
        `Booking deadline passed (${BOOKING_CONFIG.minAdvanceMinutes} min before departure)`,
      );
    }

    return reasons;
  }

  /**
   * Sanitize booking for response
   * @private
   */
  _sanitizeBooking(booking) {
    const sanitized = { ...booking };

    // Remove sensitive internal fields
    delete sanitized.verificationCode; // Only include when needed
    delete sanitized.verificationExpiry;

    return sanitized;
  }
}

module.exports = BookingService;
