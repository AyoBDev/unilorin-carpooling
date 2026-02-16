/**
 * Ride Routes
 * Path: src/api/routes/ride.routes.js
 *
 * Search is public (optionalAuthenticate). All other routes
 * require authentication; driver routes require verified driver status.
 */

const { Router } = require('express');
const { RideController } = require('../controllers');
const {
  authenticate,
  optionalAuthenticate,
  requireDriver,
} = require('../middlewares/auth.middleware');
const {
  validateBody,
  validateQuery,
  sanitizeBody,
} = require('../middlewares/validation.middleware');
const { searchLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  rideCreationSchema,
  rideSearchSchema,
  pickupPointSchema,
} = require('../../shared/utils/validation');

const router = Router();

// ─── PUBLIC / OPTIONAL AUTH ────────────────────────────────────

router.get(
  '/search',
  searchLimiter,
  optionalAuthenticate,
  validateQuery(rideSearchSchema),
  RideController.searchRides,
);

router.get('/popular-routes', optionalAuthenticate, RideController.getPopularRoutes);

// ─── AUTHENTICATED ROUTES ──────────────────────────────────────

router.use(authenticate);

router.get('/', RideController.getAvailableRides);

router.get('/match', RideController.getMatchingRides);

router.get('/suggestions', RideController.getSuggestions);

router.get('/my-rides', requireDriver, RideController.getMyRides);

// ─── DRIVER ROUTES ─────────────────────────────────────────────

router.post(
  '/',
  requireDriver,
  sanitizeBody,
  validateBody(rideCreationSchema),
  RideController.createRide,
);

router.put('/:rideId', requireDriver, sanitizeBody, RideController.updateRide);

router.post('/:rideId/cancel', requireDriver, RideController.cancelRide);

router.post('/:rideId/start', requireDriver, RideController.startRide);

router.post('/:rideId/complete', requireDriver, RideController.completeRide);

// ─── PICKUP POINTS ─────────────────────────────────────────────

router.get('/:rideId/pickup-points', RideController.getPickupPoints);

router.post(
  '/:rideId/pickup-points',
  requireDriver,
  sanitizeBody,
  validateBody(pickupPointSchema),
  RideController.addPickupPoint,
);

router.put('/:rideId/pickup-points/reorder', requireDriver, RideController.reorderPickupPoints);

router.delete(
  '/:rideId/pickup-points/:pickupPointId',
  requireDriver,
  RideController.removePickupPoint,
);

// ─── RIDE DETAILS (must be after specific paths) ───────────────

router.get('/:rideId/bookings', requireDriver, RideController.getRideBookings);

router.get('/:rideId/passengers', requireDriver, RideController.getRidePassengers);

router.get('/:rideId', optionalAuthenticate, RideController.getRide);

// ─── RECURRING RIDES ───────────────────────────────────────────

router.post('/recurring', requireDriver, sanitizeBody, RideController.createRecurringRide);

router.get('/recurring/my-schedules', requireDriver, RideController.getMyRecurringRides);

router.post('/recurring/:scheduleId/cancel', requireDriver, RideController.cancelRecurringRide);

module.exports = router;
