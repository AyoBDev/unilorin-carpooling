/**
 * Ride Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles ride offer creation, updates, search, cancellation,
 * pickup points, recurring rides, and ride lifecycle management.
 *
 * Path: src/api/controllers/RideController.js
 *
 * @module controllers/RideController
 */

const { RideService, MatchingService } = require('../../core/services');
const { success, created, paginated } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class RideController {
  constructor() {
    this.rideService = new RideService();
    this.matchingService = new MatchingService();

    this.createRide = this.createRide.bind(this);
    this.getRide = this.getRide.bind(this);
    this.updateRide = this.updateRide.bind(this);
    this.cancelRide = this.cancelRide.bind(this);
    this.searchRides = this.searchRides.bind(this);
    this.getAvailableRides = this.getAvailableRides.bind(this);
    this.getMyRides = this.getMyRides.bind(this);
    this.startRide = this.startRide.bind(this);
    this.completeRide = this.completeRide.bind(this);
    this.addPickupPoint = this.addPickupPoint.bind(this);
    this.removePickupPoint = this.removePickupPoint.bind(this);
    this.reorderPickupPoints = this.reorderPickupPoints.bind(this);
    this.getPickupPoints = this.getPickupPoints.bind(this);
    this.createRecurringRide = this.createRecurringRide.bind(this);
    this.getMyRecurringRides = this.getMyRecurringRides.bind(this);
    this.cancelRecurringRide = this.cancelRecurringRide.bind(this);
    this.getRideBookings = this.getRideBookings.bind(this);
    this.getRidePassengers = this.getRidePassengers.bind(this);
    this.getMatchingRides = this.getMatchingRides.bind(this);
    this.getSuggestions = this.getSuggestions.bind(this);
    this.getPopularRoutes = this.getPopularRoutes.bind(this);
  }

  // ─── RIDE CRUD ───────────────────────────────────────────────

  /**
   * Create a new ride offer
   * POST /api/v1/rides
   */
  async createRide(req, res, next) {
    try {
      const driverId = req.user.userId;

      const ride = await this.rideService.createRide(driverId, req.body);

      logger.info('Ride created', { driverId, rideId: ride.rideId });

      return created(res, 'Ride offer created successfully', { ride });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get ride details
   * GET /api/v1/rides/:rideId
   */
  async getRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const userId = req.user?.userId; // Optional - may be unauthenticated

      const ride = await this.rideService.getRideById(rideId, userId);

      return success(res, 'Ride details retrieved', { ride });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update a ride offer
   * PUT /api/v1/rides/:rideId
   */
  async updateRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;

      const ride = await this.rideService.updateRide(rideId, driverId, req.body);

      logger.info('Ride updated', { driverId, rideId });

      return success(res, 'Ride updated successfully', { ride });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cancel a ride offer
   * POST /api/v1/rides/:rideId/cancel
   */
  async cancelRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;
      const { reason } = req.body || {};

      const result = await this.rideService.cancelRide(rideId, driverId, reason);

      logger.info('Ride cancelled', { driverId, rideId, reason });

      return success(res, 'Ride cancelled successfully', {
        ride: result.ride,
        affectedBookings: result.affectedBookings,
      });
    } catch (error) {
      return next(error);
    }
  }

  // ─── SEARCH & DISCOVERY ──────────────────────────────────────

  /**
   * Search for available rides
   * GET /api/v1/rides/search
   */
  async searchRides(req, res, next) {
    try {
      const {
        date,
        time,
        fromLat,
        fromLng,
        toLat,
        toLng,
        fromAddress,
        toAddress,
        seats = 1,
        maxPrice,
        page = 1,
        limit = 20,
        sortBy = 'departureTime',
        sortOrder = 'asc',
      } = req.query;

      const result = await this.rideService.searchRides({
        date,
        time,
        from:
          fromLat && fromLng ? { lat: parseFloat(fromLat), lng: parseFloat(fromLng) } : undefined,
        to: toLat && toLng ? { lat: parseFloat(toLat), lng: parseFloat(toLng) } : undefined,
        fromAddress,
        toAddress,
        seats: parseInt(seats, 10),
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sortBy,
        sortOrder,
      });

      return paginated(res, 'Rides found', result.rides, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get available rides (general listing)
   * GET /api/v1/rides
   */
  async getAvailableRides(req, res, next) {
    try {
      const { date, page = 1, limit = 20 } = req.query;

      const result = await this.rideService.getAvailableRides({
        date,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Available rides', result.rides, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get driver's own rides
   * GET /api/v1/rides/my-rides
   */
  async getMyRides(req, res, next) {
    try {
      const driverId = req.user.userId;
      const { status, page = 1, limit = 20 } = req.query;

      const result = await this.rideService.getRidesByDriver(driverId, {
        status,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Your rides', result.rides, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  // ─── RIDE LIFECYCLE ──────────────────────────────────────────

  /**
   * Start a ride (driver departs)
   * POST /api/v1/rides/:rideId/start
   */
  async startRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;

      const ride = await this.rideService.startRide(rideId, driverId);

      logger.info('Ride started', { driverId, rideId });

      return success(res, 'Ride started', { ride });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Complete a ride
   * POST /api/v1/rides/:rideId/complete
   */
  async completeRide(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;

      const result = await this.rideService.completeRide(rideId, driverId);

      logger.info('Ride completed', { driverId, rideId });

      return success(res, 'Ride completed successfully', {
        ride: result.ride,
        summary: result.summary,
      });
    } catch (error) {
      return next(error);
    }
  }

  // ─── PICKUP POINTS ──────────────────────────────────────────

  /**
   * Add a pickup point to a ride
   * POST /api/v1/rides/:rideId/pickup-points
   */
  async addPickupPoint(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;

      const pickupPoint = await this.rideService.addPickupPoint(rideId, driverId, req.body);

      return created(res, 'Pickup point added', { pickupPoint });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Remove a pickup point
   * DELETE /api/v1/rides/:rideId/pickup-points/:pickupPointId
   */
  async removePickupPoint(req, res, next) {
    try {
      const { rideId, pickupPointId } = req.params;
      const driverId = req.user.userId;

      await this.rideService.removePickupPoint(rideId, pickupPointId, driverId);

      return success(res, 'Pickup point removed');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Reorder pickup points
   * PUT /api/v1/rides/:rideId/pickup-points/reorder
   */
  async reorderPickupPoints(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;
      const { orderedIds } = req.body; // Array of pickupPointIds in new order

      const pickupPoints = await this.rideService.reorderPickupPoints(rideId, driverId, orderedIds);

      return success(res, 'Pickup points reordered', { pickupPoints });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get pickup points for a ride
   * GET /api/v1/rides/:rideId/pickup-points
   */
  async getPickupPoints(req, res, next) {
    try {
      const { rideId } = req.params;

      const pickupPoints = await this.rideService.getPickupPoints(rideId);

      return success(res, 'Pickup points retrieved', { pickupPoints });
    } catch (error) {
      return next(error);
    }
  }

  // ─── RECURRING RIDES ─────────────────────────────────────────

  /**
   * Create a recurring ride schedule
   * POST /api/v1/rides/recurring
   */
  async createRecurringRide(req, res, next) {
    try {
      const driverId = req.user.userId;

      const result = await this.rideService.createRecurringRide(driverId, req.body);

      logger.info('Recurring ride created', { driverId, scheduleId: result.scheduleId });

      return created(res, 'Recurring ride schedule created', { schedule: result });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get driver's recurring ride schedules
   * GET /api/v1/rides/recurring/my-schedules
   */
  async getMyRecurringRides(req, res, next) {
    try {
      const driverId = req.user.userId;

      const schedules = await this.rideService.getRecurringRidesByDriver(driverId);

      return success(res, 'Recurring ride schedules', { schedules });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cancel a recurring ride schedule
   * POST /api/v1/rides/recurring/:scheduleId/cancel
   */
  async cancelRecurringRide(req, res, next) {
    try {
      const { scheduleId } = req.params;
      const driverId = req.user.userId;

      await this.rideService.cancelRecurringRides(scheduleId, driverId);

      return success(res, 'Recurring ride schedule cancelled');
    } catch (error) {
      return next(error);
    }
  }

  // ─── RIDE BOOKINGS & PASSENGERS ──────────────────────────────

  /**
   * Get bookings for a ride (driver view)
   * GET /api/v1/rides/:rideId/bookings
   */
  async getRideBookings(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;
      const { status } = req.query;

      const bookings = await this.rideService.getRideBookings(rideId, driverId, { status });

      return success(res, 'Ride bookings retrieved', { bookings });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get confirmed passengers for a ride (driver view)
   * GET /api/v1/rides/:rideId/passengers
   */
  async getRidePassengers(req, res, next) {
    try {
      const { rideId } = req.params;
      const driverId = req.user.userId;

      const passengers = await this.rideService.getRidePassengers(rideId, driverId);

      return success(res, 'Passengers retrieved', { passengers });
    } catch (error) {
      return next(error);
    }
  }

  // ─── MATCHING & SUGGESTIONS ──────────────────────────────────

  /**
   * Get matching rides for a passenger
   * GET /api/v1/rides/match
   */
  async getMatchingRides(req, res, next) {
    try {
      const { userId } = req.user;
      const { fromLat, fromLng, toLat, toLng, date, time, seats = 1 } = req.query;

      const matches = await this.matchingService.findMatchingRides(userId, {
        from: { lat: parseFloat(fromLat), lng: parseFloat(fromLng) },
        to: { lat: parseFloat(toLat), lng: parseFloat(toLng) },
        date,
        time,
        seats: parseInt(seats, 10),
      });

      return success(res, 'Matching rides found', { matches });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get ride suggestions based on user's history
   * GET /api/v1/rides/suggestions
   */
  async getSuggestions(req, res, next) {
    try {
      const { userId } = req.user;

      const suggestions = await this.matchingService.getSuggestions(userId);

      return success(res, 'Ride suggestions', { suggestions });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get popular routes
   * GET /api/v1/rides/popular-routes
   */
  async getPopularRoutes(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const routes = await this.rideService.getPopularRoutes(parseInt(limit, 10));

      return success(res, 'Popular routes', { routes });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new RideController();
