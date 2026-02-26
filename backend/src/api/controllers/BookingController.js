/**
 * Booking Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles booking creation, confirmation, verification codes,
 * cash payment workflow, ride start/complete, cancellation,
 * no-show handling, and booking history.
 *
 * Phase 1: Cash/offline payment only.
 *
 * Path: src/api/controllers/BookingController.js
 *
 * @module controllers/
 *
 */

const { BookingService } = require('../../core/services');
const { success, created, paginated } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class BookingController {
  constructor() {
    this.bookingService = new BookingService();

    this.createBooking = this.createBooking.bind(this);
    this.getBooking = this.getBooking.bind(this);
    this.getMyBookings = this.getMyBookings.bind(this);
    this.cancelBooking = this.cancelBooking.bind(this);
    this.confirmBooking = this.confirmBooking.bind(this);
    this.getVerificationCode = this.getVerificationCode.bind(this);
    this.verifyPassenger = this.verifyPassenger.bind(this);
    this.startBooking = this.startBooking.bind(this);
    this.completeBooking = this.completeBooking.bind(this);
    this.markNoShow = this.markNoShow.bind(this);
    this.getBookingStatistics = this.getBookingStatistics.bind(this);
    this.getUpcomingBookings = this.getUpcomingBookings.bind(this);
    this.getPastBookings = this.getPastBookings.bind(this);
  }

  // ─── BOOKING CRUD ────────────────────────────────────────────

  /**
   * Create a new booking (cash payment default for Phase 1)
   * POST /api/v1/bookings
   */
  async createBooking(req, res, next) {
    try {
      const passengerId = req.user.userId;
      const bookingData = {
        ...req.body,
        paymentMethod: 'cash', // Phase 1 default
      };

      const booking = await this.bookingService.createBooking(passengerId, bookingData);

      logger.info('Booking created', {
        passengerId,
        bookingId: booking.bookingId,
        rideId: booking.rideId,
      });

      return created(res, 'Booking created successfully. Please pay cash to the driver.', {
        booking,
        verificationCode: booking.verificationCode,
        paymentInstructions: {
          method: 'cash',
          amount: booking.totalAmount,
          currency: 'NGN',
          note: 'Please have exact change ready. Pay the driver when you board.',
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get booking details
   * GET /api/v1/bookings/:bookingId
   */
  async getBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { userId } = req.user;

      const booking = await this.bookingService.getBookingById(bookingId, userId);

      return success(res, 'Booking details retrieved', { booking });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current user's bookings
   * GET /api/v1/bookings
   */
  async getMyBookings(req, res, next) {
    try {
      const { userId } = req.user;
      const {
        status,
        role = 'passenger', // 'passenger' or 'driver'
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const result = await this.bookingService.getUserBookings(userId, {
        status,
        role,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sortBy,
        sortOrder,
      });

      return paginated(res, 'Bookings retrieved', result.bookings, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  // ─── BOOKING ACTIONS ─────────────────────────────────────────

  /**
   * Cancel a booking
   * POST /api/v1/bookings/:bookingId/cancel
   */
  async cancelBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { userId } = req.user;
      const { reason } = req.body || {};

      const result = await this.bookingService.cancelBooking(bookingId, userId, reason);

      logger.info('Booking cancelled', { userId, bookingId, reason });

      return success(res, 'Booking cancelled successfully', {
        booking: result.booking,
        isLateCancellation: result.isLateCancellation,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Driver confirms a booking
   * POST /api/v1/bookings/:bookingId/confirm
   */
  async confirmBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const { driverId } = req.user;

      const booking = await this.bookingService.confirmBooking(bookingId, driverId);

      logger.info('Booking confirmed by driver', { driverId, bookingId });

      return success(res, 'Booking confirmed', { booking });
    } catch (error) {
      return next(error);
    }
  }

  // ─── VERIFICATION & RIDE FLOW ────────────────────────────────

  /**
   * Get verification code for a booking (passenger)
   * GET /api/v1/bookings/:bookingId/verification
   */
  async getVerificationCode(req, res, next) {
    try {
      const { bookingId } = req.params;
      const passengerId = req.user.userId;

      const verification = await this.bookingService.getVerificationCode(bookingId, passengerId);

      return success(res, 'Verification code retrieved', {
        verificationCode: verification.code,
        expiresAt: verification.expiresAt,
        instructions: 'Show this code to the driver when boarding.',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verify a passenger's code (driver)
   * POST /api/v1/bookings/:bookingId/verify
   */
  async verifyPassenger(req, res, next) {
    try {
      const { bookingId } = req.params;
      const driverId = req.user.userId;
      const { verificationCode } = req.body;

      const result = await this.bookingService.verifyPassenger(
        bookingId,
        driverId,
        verificationCode,
      );

      logger.info('Passenger verified', { driverId, bookingId });

      return success(res, 'Passenger verified successfully', { booking: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Start a booking ride (driver verifies code and starts)
   * POST /api/v1/bookings/:bookingId/start
   */
  async startBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const driverId = req.user.userId;
      const { verificationCode } = req.body;

      const booking = await this.bookingService.startBooking(bookingId, driverId, verificationCode);

      logger.info('Booking ride started', { driverId, bookingId });

      return success(res, 'Ride started. Passenger verified and on board.', { booking });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Complete a booking (driver confirms cash received)
   * POST /api/v1/bookings/:bookingId/complete
   */
  async completeBooking(req, res, next) {
    try {
      const { bookingId } = req.params;
      const driverId = req.user.userId;
      const { cashReceived = true } = req.body;

      const result = await this.bookingService.completeBooking(bookingId, driverId, {
        cashReceived,
      });

      logger.info('Booking completed', {
        driverId,
        bookingId,
        cashReceived,
        amount: result.amount,
      });

      return success(res, 'Booking completed. Cash payment recorded.', {
        booking: result.booking,
        payment: {
          method: 'cash',
          amount: result.amount,
          status: cashReceived ? 'received' : 'pending',
          currency: 'NGN',
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  // ─── NO-SHOW HANDLING ────────────────────────────────────────

  /**
   * Mark a passenger as no-show (driver)
   * POST /api/v1/bookings/:bookingId/no-show
   */
  async markNoShow(req, res, next) {
    try {
      const { bookingId } = req.params;
      const driverId = req.user.userId;
      const { reason } = req.body || {};

      const result = await this.bookingService.markNoShow(bookingId, driverId, reason);

      logger.info('Passenger marked as no-show', { driverId, bookingId });

      return success(res, 'Passenger marked as no-show', { booking: result });
    } catch (error) {
      return next(error);
    }
  }

  // ─── HISTORY & STATISTICS ────────────────────────────────────

  /**
   * Get upcoming bookings
   * GET /api/v1/bookings/upcoming
   */
  async getUpcomingBookings(req, res, next) {
    try {
      const { userId } = req.user;
      const { role = 'passenger', limit = 10 } = req.query;

      const bookings = await this.bookingService.getUpcomingBookings(userId, {
        role,
        limit: parseInt(limit, 10),
      });

      return success(res, 'Upcoming bookings', { bookings });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get past bookings
   * GET /api/v1/bookings/past
   */
  async getPastBookings(req, res, next) {
    try {
      const { userId } = req.user;
      const { role = 'passenger', page = 1, limit = 20 } = req.query;

      const result = await this.bookingService.getPastBookings(userId, {
        role,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Past bookings', result.bookings, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get booking statistics
   * GET /api/v1/bookings/statistics
   */
  async getBookingStatistics(req, res, next) {
    try {
      const { userId } = req.user;
      const { role = 'passenger', period = '30days' } = req.query;

      const stats = await this.bookingService.getBookingStatistics(userId, role, period);

      return success(res, 'Booking statistics', { statistics: stats });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new BookingController();
