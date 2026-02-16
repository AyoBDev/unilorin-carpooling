/**
 * Booking Routes
 * Path: src/api/routes/booking.routes.js
 *
 * All booking routes require authentication.
 * Driver-specific actions require driver role.
 */

const { Router } = require('express');
const { BookingController } = require('../controllers');
const { authenticate, requireDriver, requireVerified } = require('../middlewares/auth.middleware');
const { validateBody, sanitizeBody } = require('../middlewares/validation.middleware');
const { bookingLimiter } = require('../middlewares/rateLimiter.middleware');
const { bookingCreationSchema } = require('../../shared/utils/validation');

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── PASSENGER ROUTES ──────────────────────────────────────────

router.post(
  '/',
  bookingLimiter,
  requireVerified,
  sanitizeBody,
  validateBody(bookingCreationSchema),
  BookingController.createBooking,
);

router.get('/', BookingController.getMyBookings);

router.get('/upcoming', BookingController.getUpcomingBookings);

router.get('/past', BookingController.getPastBookings);

router.get('/statistics', BookingController.getBookingStatistics);

router.get('/:bookingId', BookingController.getBooking);

router.post('/:bookingId/cancel', BookingController.cancelBooking);

router.get('/:bookingId/verification', BookingController.getVerificationCode);

// ─── DRIVER ROUTES ─────────────────────────────────────────────

router.post('/:bookingId/confirm', requireDriver, BookingController.confirmBooking);

router.post('/:bookingId/verify', requireDriver, BookingController.verifyPassenger);

router.post('/:bookingId/start', requireDriver, BookingController.startBooking);

router.post('/:bookingId/complete', requireDriver, BookingController.completeBooking);

router.post('/:bookingId/no-show', requireDriver, BookingController.markNoShow);

module.exports = router;
