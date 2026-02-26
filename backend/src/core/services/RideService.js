/**
 * Ride Service
 * University of Ilorin Carpooling Platform
 *
 * Handles ride offer creation, updates, search, cancellation,
 * pickup point management, and recurring ride scheduling.
 *
 * @module services/RideService
 */

const { randomUUID } = require('crypto');
const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const VehicleRepository = require('../../infrastructure/database/repositories/VehicleRepository');
const { logger } = require('../../shared/utils/logger');
const {
  formatDate,
  now,
  parseDate,
  addMinutes,
  addDays,
  isExpired,
  isBefore,
  isAfter,
  getDateOnly,
  getTimeOnly,
  getDayOfWeek,
  formatTime,
  calculateDuration,
} = require('../../shared/utils/dateTime');
const { validateRide, validatePickupPoint } = require('../../shared/utils/validation');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} = require('../../shared/errors');
const { ERROR_CODES, ERROR_MESSAGES } = require('../../shared/constants/errors');
const { RIDE_EVENTS } = require('../../shared/constants/events');
const { getRideEventPublisher } = require('../../infrastructure/messaging');

/**
 * Ride status constants
 */
const RIDE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  FULL: 'full',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * Ride configuration
 */
const RIDE_CONFIG = {
  maxSeats: 7,
  minSeats: 1,
  minAdvanceBookingMinutes: 30,
  maxAdvanceBookingDays: 7,
  minPrice: 100, // ₦100
  maxPrice: 2000, // ₦2000
  defaultWaitTime: 5, // minutes
  maxWaitTime: 15, // minutes
  maxPickupPoints: 5,
  searchRadiusKm: 5, // km
  recurringMaxWeeks: 8, // 2 months
};

/**
 * RideService class
 * Manages ride-related operations
 */
class RideService {
  constructor() {
    this.rideRepository = new RideRepository();
    this.userRepository = new UserRepository();
    this.vehicleRepository = new VehicleRepository();
    this.serviceName = 'RideService';
    this.eventPublisher = getRideEventPublisher();
  }

  // ==================== Ride Creation ====================

  /**
   * Create a new ride offer
   * @param {string} driverId - Driver user ID
   * @param {Object} rideData - Ride data
   * @returns {Promise<Object>} Created ride
   */
  async createRide(driverId, rideData) {
    const startTime = Date.now();
    logger.info('Creating ride offer', {
      action: RIDE_EVENTS.RIDE_CREATED,
      driverId,
    });

    try {
      // Validate driver
      const driver = await this._validateDriver(driverId);

      // Validate ride data
      const { error, value } = validateRide(rideData);
      if (error) {
        throw new ValidationError('Ride validation failed', error.details);
      }

      const {
        departureDate,
        departureTime,
        startLocation,
        endLocation,
        pickupPoints,
        availableSeats,
        pricePerSeat,
        waitTime,
        vehicleId,
        isRecurring,
        recurringDays,
        recurringEndDate,
        notes,
      } = value;

      // Validate vehicle
      const vehicle = await this._validateVehicle(vehicleId, driverId, availableSeats);

      // Validate departure time (must be in future)
      const departureDateTime = this._combineDateAndTime(departureDate, departureTime);
      await this._validateDepartureTime(departureDateTime);

      // Validate price range
      this._validatePrice(pricePerSeat);

      // Check for overlapping rides
      await this._checkOverlappingRides(driverId, departureDateTime);

      // Generate ride ID
      const rideId = randomUUID();

      // Process pickup points
      const processedPickupPoints = this._processPickupPoints(pickupPoints, departureDateTime);

      // Calculate route info (simplified - would use Mapbox in production)
      const routeInfo = this._calculateRouteInfo(startLocation, endLocation, processedPickupPoints);

      // Create ride data
      const ride = {
        rideId,
        driverId,
        vehicleId,
        departureDate: getDateOnly(departureDateTime),
        departureTime: getTimeOnly(departureDateTime),
        departureDateTime: formatDate(departureDateTime),
        startLocation: {
          address: startLocation.address,
          coordinates: startLocation.coordinates,
          name: startLocation.name || startLocation.address,
        },
        endLocation: {
          address: endLocation.address,
          coordinates: endLocation.coordinates,
          name: endLocation.name || endLocation.address,
        },
        pickupPoints: processedPickupPoints,
        totalSeats: availableSeats,
        availableSeats,
        bookedSeats: 0,
        pricePerSeat,
        waitTime: waitTime || RIDE_CONFIG.defaultWaitTime,
        status: RIDE_STATUS.ACTIVE,
        routePolyline: routeInfo.polyline,
        estimatedDistance: routeInfo.distance,
        estimatedDuration: routeInfo.duration,
        isRecurring: isRecurring || false,
        notes: notes || null,
        createdAt: formatDate(now()),
        updatedAt: formatDate(now()),
        // Driver info denormalized for quick access
        driver: {
          userId: driver.userId,
          firstName: driver.firstName,
          lastName: driver.lastName,
          phone: driver.phone,
          averageRating: driver.averageRating || 0,
          profilePhoto: driver.profilePhoto,
        },
        // Vehicle info denormalized
        vehicle: {
          vehicleId: vehicle.vehicleId,
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          plateNumber: vehicle.plateNumber,
          capacity: vehicle.capacity,
        },
      };

      // Save ride
      const createdRide = await this.rideRepository.create(ride);

      // Handle recurring rides
      let recurringRides = [];
      if (isRecurring && recurringDays && recurringDays.length > 0) {
        recurringRides = await this._createRecurringRides(
          createdRide,
          recurringDays,
          recurringEndDate,
        );
      }

      // Update driver statistics
      await this.userRepository.incrementDriverRides(driverId);

      logger.info('Ride created successfully', {
        action: RIDE_EVENTS.RIDE_CREATED,
        rideId,
        driverId,
        departureDateTime: formatDate(departureDateTime),
        recurringCount: recurringRides.length,
        duration: Date.now() - startTime,
      });

      return {
        ride: createdRide,
        recurringRides: recurringRides.length > 0 ? recurringRides : undefined,
        message: isRecurring
          ? `Ride created with ${recurringRides.length} recurring instances`
          : 'Ride created successfully',
      };
    } catch (error) {
      logger.error('Failed to create ride', {
        action: 'RIDE_CREATE_FAILED',
        driverId,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  // ==================== Ride Updates ====================

  /**
   * Update ride offer
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID (for authorization)
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated ride
   */
  async updateRide(rideId, driverId, updates) {
    logger.info('Updating ride', {
      action: RIDE_EVENTS.RIDE_UPDATED,
      rideId,
      driverId,
      fields: Object.keys(updates),
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      // Check authorization
      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to update this ride', ERROR_CODES.FORBIDDEN);
      }

      // Check if ride can be updated
      if (![RIDE_STATUS.ACTIVE, RIDE_STATUS.FULL].includes(ride.status)) {
        throw new BadRequestError(
          `Cannot update ride with status: ${ride.status}`,
          ERROR_CODES.RIDE_CANNOT_UPDATE,
        );
      }

      // Check if departure time has passed
      if (isExpired(ride.departureDateTime)) {
        throw new BadRequestError(
          'Cannot update ride that has already departed',
          ERROR_CODES.RIDE_ALREADY_DEPARTED,
        );
      }

      // Allowed update fields
      const allowedUpdates = [
        'departureTime',
        'pricePerSeat',
        'waitTime',
        'availableSeats',
        'notes',
      ];

      const filteredUpdates = {};
      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      // Validate seat changes
      if (filteredUpdates.availableSeats !== undefined) {
        const newTotal = filteredUpdates.availableSeats;
        if (newTotal < ride.bookedSeats) {
          throw new BadRequestError(
            `Cannot reduce seats below booked count (${ride.bookedSeats})`,
            ERROR_CODES.RIDE_SEATS_CONFLICT,
          );
        }
        filteredUpdates.totalSeats = newTotal;
        // Recalculate available seats
        filteredUpdates.availableSeats = newTotal - ride.bookedSeats;
      }

      // Validate price changes
      if (filteredUpdates.pricePerSeat !== undefined) {
        this._validatePrice(filteredUpdates.pricePerSeat);
        // If ride has bookings, warn about price change
        if (ride.bookedSeats > 0) {
          logger.warn('Price changed for ride with existing bookings', {
            action: 'RIDE_PRICE_CHANGED_WITH_BOOKINGS',
            rideId,
            oldPrice: ride.pricePerSeat,
            newPrice: filteredUpdates.pricePerSeat,
            bookedSeats: ride.bookedSeats,
          });
        }
      }

      // Validate departure time changes
      if (filteredUpdates.departureTime) {
        const newDepartureDateTime = this._combineDateAndTime(
          ride.departureDate,
          filteredUpdates.departureTime,
        );
        await this._validateDepartureTime(newDepartureDateTime);
        filteredUpdates.departureDateTime = formatDate(newDepartureDateTime);
        filteredUpdates.departureTime = getTimeOnly(newDepartureDateTime);
      }

      filteredUpdates.updatedAt = formatDate(now());

      const updatedRide = await this.rideRepository.update(rideId, filteredUpdates);

      // Update status if seats changed
      if (filteredUpdates.availableSeats !== undefined) {
        const newStatus =
          filteredUpdates.availableSeats === 0 ? RIDE_STATUS.FULL : RIDE_STATUS.ACTIVE;
        if (updatedRide.status !== newStatus) {
          await this.rideRepository.updateStatus(rideId, newStatus);
          updatedRide.status = newStatus;
        }
      }

      logger.info('Ride updated successfully', {
        action: RIDE_EVENTS.RIDE_UPDATED,
        rideId,
        updatedFields: Object.keys(filteredUpdates),
      });

      return {
        ride: updatedRide,
        message: 'Ride updated successfully',
        notifyPassengers: ride.bookedSeats > 0,
      };
    } catch (error) {
      logger.error('Failed to update ride', {
        action: 'RIDE_UPDATE_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride Search ====================

  /**
   * Search for available rides
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchRides(searchParams) {
    const startTime = Date.now();
    logger.info('Searching rides', {
      action: RIDE_EVENTS.RIDE_SEARCHED,
      params: searchParams,
    });

    try {
      const {
        date,
        time,
        fromLocation,
        toLocation,
        seats = 1,
        maxPrice,
        minRating,
        sortBy = 'departureTime',
        sortOrder = 'asc',
        page = 1,
        limit = 20,
      } = searchParams;

      // Build search criteria
      const criteria = {
        departureDate: date,
        minSeats: seats,
        status: [RIDE_STATUS.ACTIVE],
      };

      // Add time filter if provided
      if (time) {
        criteria.departureTimeStart = time;
        criteria.departureTimeEnd = formatTime(addMinutes(parseDate(`${date}T${time}`), 120)); // 2 hour window
      }

      // Add price filter
      if (maxPrice) {
        criteria.maxPrice = maxPrice;
      }

      // Get rides from repository
      let rides = await this.rideRepository.search(criteria);

      // Filter by location proximity
      if (fromLocation && fromLocation.coordinates) {
        rides = this._filterByProximity(rides, fromLocation.coordinates, 'startLocation');
      }

      if (toLocation && toLocation.coordinates) {
        rides = this._filterByProximity(rides, toLocation.coordinates, 'endLocation');
      }

      // Filter by driver rating
      if (minRating) {
        rides = rides.filter((ride) => (ride.driver?.averageRating || 0) >= minRating);
      }

      // Sort results
      rides = this._sortRides(rides, sortBy, sortOrder);

      // Paginate
      const totalCount = rides.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedRides = rides.slice(startIndex, startIndex + limit);

      // Enrich ride data
      const enrichedRides = paginatedRides.map((ride) => this._enrichRideForSearch(ride, seats));

      logger.info('Ride search completed', {
        action: RIDE_EVENTS.RIDE_SEARCHED,
        resultsCount: totalCount,
        returnedCount: enrichedRides.length,
        duration: Date.now() - startTime,
      });

      return {
        rides: enrichedRides,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        filters: {
          date,
          time,
          seats,
          maxPrice,
          minRating,
        },
      };
    } catch (error) {
      logger.error('Ride search failed', {
        action: 'RIDE_SEARCH_FAILED',
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Get available rides (general listing)
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Available rides with pagination
   */
  async getAvailableRides(options = {}) {
    try {
      const { date, page = 1, limit = 20 } = options;

      const criteria = {
        status: [RIDE_STATUS.ACTIVE],
      };

      if (date) {
        criteria.departureDate = date;
      }

      let rides = await this.rideRepository.search(criteria);

      // Only include future rides
      rides = rides.filter((r) => !isExpired(r.departureDateTime));

      // Sort by departure time
      rides.sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

      // Paginate
      const totalCount = rides.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedRides = rides.slice(startIndex, startIndex + limit);

      return {
        rides: paginatedRides,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to get available rides', {
        action: 'AVAILABLE_RIDES_FETCH_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get ride details by ID
   * @param {string} rideId - Ride ID
   * @param {string} userId - Requesting user ID (for context)
   * @returns {Promise<Object>} Ride details
   */
  async getRideById(rideId, userId = null) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      // Get full driver info
      const driver = await this.userRepository.findById(ride.driverId);

      // Get bookings for this ride (if user is driver)
      let bookings = [];
      if (userId === ride.driverId) {
        bookings = await this.rideRepository.getRideBookings(rideId);
      }

      return {
        ...ride,
        driver: driver
          ? {
              userId: driver.userId,
              firstName: driver.firstName,
              lastName: driver.lastName,
              phone: userId === ride.driverId ? driver.phone : undefined, // Only show phone to driver
              averageRating: driver.averageRating || 0,
              totalRatings: driver.totalRatings || 0,
              profilePhoto: driver.profilePhoto,
              totalRidesCompleted: driver.totalRidesCompleted || 0,
            }
          : ride.driver,
        bookings: bookings.length > 0 ? bookings : undefined,
        isOwner: userId === ride.driverId,
        canBook:
          ride.availableSeats > 0 && ride.status === RIDE_STATUS.ACTIVE && userId !== ride.driverId,
        canEdit:
          userId === ride.driverId && [RIDE_STATUS.ACTIVE, RIDE_STATUS.FULL].includes(ride.status),
        canCancel: userId === ride.driverId && !isExpired(ride.departureDateTime),
      };
    } catch (error) {
      logger.error('Failed to get ride', {
        action: 'RIDE_GET_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get rides by driver
   * @param {string} driverId - Driver ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Driver's rides
   */
  async getRidesByDriver(driverId, filters = {}) {
    try {
      const { status, upcoming = true, page = 1, limit = 20 } = filters;

      let rides = await this.rideRepository.findByDriver(driverId);

      // Filter by status
      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        rides = rides.filter((r) => statuses.includes(r.status));
      }

      // Filter upcoming vs past
      if (upcoming) {
        rides = rides.filter((r) => !isExpired(r.departureDateTime));
      }

      // Sort by departure time
      rides.sort((a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime));

      // Paginate
      const totalCount = rides.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedRides = rides.slice(startIndex, startIndex + limit);

      return {
        rides: paginatedRides,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get driver rides', {
        action: 'DRIVER_RIDES_FETCH_FAILED',
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride Cancellation ====================

  /**
   * Cancel ride
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelRide(rideId, driverId, reason = '') {
    logger.info('Cancelling ride', {
      action: RIDE_EVENTS.RIDE_CANCELLED,
      rideId,
      driverId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      // Check authorization
      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to cancel this ride', ERROR_CODES.FORBIDDEN);
      }

      // Check if ride can be cancelled
      if (ride.status === RIDE_STATUS.CANCELLED) {
        throw new BadRequestError('Ride is already cancelled', ERROR_CODES.RIDE_ALREADY_CANCELLED);
      }

      if (ride.status === RIDE_STATUS.COMPLETED) {
        throw new BadRequestError(
          'Cannot cancel completed ride',
          ERROR_CODES.RIDE_ALREADY_COMPLETED,
        );
      }

      if (ride.status === RIDE_STATUS.IN_PROGRESS) {
        throw new BadRequestError('Cannot cancel ride in progress', ERROR_CODES.RIDE_IN_PROGRESS);
      }

      // Get affected bookings
      const bookings = await this.rideRepository.getRideBookings(rideId);
      const activeBookings = bookings.filter((b) => ['pending', 'confirmed'].includes(b.status));

      // Update ride status
      await this.rideRepository.updateStatus(rideId, RIDE_STATUS.CANCELLED, {
        cancelledAt: formatDate(now()),
        cancellationReason: reason,
        cancelledBy: driverId,
      });

      // Update driver statistics (cancelled ride count)
      await this.userRepository.incrementDriverCancelledRides(driverId);

      logger.info('Ride cancelled successfully', {
        action: RIDE_EVENTS.RIDE_CANCELLED,
        rideId,
        affectedBookings: activeBookings.length,
      });

      // Fire-and-forget: notify affected passengers via SQS
      if (activeBookings.length > 0) {
        this.eventPublisher.rideCancelled(ride, activeBookings, reason).catch((err) => {
          logger.warn('Failed to publish rideCancelled event', { rideId, error: err.message });
        });
      }

      return {
        message: 'Ride cancelled successfully',
        rideId,
        affectedBookings: activeBookings.map((b) => ({
          bookingId: b.bookingId,
          passengerId: b.passengerId,
          seats: b.seats,
        })),
        notifyPassengers: activeBookings.length > 0,
      };
    } catch (error) {
      logger.error('Failed to cancel ride', {
        action: 'RIDE_CANCEL_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Pickup Points ====================

  /**
   * Add pickup point to ride
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID
   * @param {Object} pickupPointData - Pickup point data
   * @returns {Promise<Object>} Updated ride with new pickup point
   */
  async addPickupPoint(rideId, driverId, pickupPointData) {
    logger.info('Adding pickup point', {
      action: 'PICKUP_POINT_ADDED',
      rideId,
      driverId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to modify this ride', ERROR_CODES.FORBIDDEN);
      }

      // Check max pickup points
      const currentPoints = ride.pickupPoints || [];
      if (currentPoints.length >= RIDE_CONFIG.maxPickupPoints) {
        throw new BadRequestError(
          `Maximum ${RIDE_CONFIG.maxPickupPoints} pickup points allowed`,
          ERROR_CODES.MAX_PICKUP_POINTS,
        );
      }

      // Validate pickup point
      const { error, value } = validatePickupPoint(pickupPointData);
      if (error) {
        throw new ValidationError('Pickup point validation failed', error.details);
      }

      // Create pickup point
      const pickupPoint = {
        pickupPointId: randomUUID(),
        name: value.name,
        address: value.address,
        coordinates: value.coordinates,
        estimatedTime: value.estimatedTime,
        order: currentPoints.length + 1,
        createdAt: formatDate(now()),
      };

      // Add to ride
      const updatedRide = await this.rideRepository.addPickupPoint(rideId, pickupPoint);

      return {
        ride: updatedRide,
        pickupPoint,
        message: 'Pickup point added successfully',
      };
    } catch (error) {
      logger.error('Failed to add pickup point', {
        action: 'PICKUP_POINT_ADD_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove pickup point from ride
   * @param {string} rideId - Ride ID
   * @param {string} pickupPointId - Pickup point ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Updated ride
   */
  async removePickupPoint(rideId, pickupPointId, driverId) {
    logger.info('Removing pickup point', {
      action: 'PICKUP_POINT_REMOVED',
      rideId,
      pickupPointId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to modify this ride', ERROR_CODES.FORBIDDEN);
      }

      // Check if pickup point has bookings
      const bookings = await this.rideRepository.getRideBookings(rideId);
      const hasBookingsAtPoint = bookings.some(
        (b) => b.pickupPointId === pickupPointId && ['pending', 'confirmed'].includes(b.status),
      );

      if (hasBookingsAtPoint) {
        throw new BadRequestError(
          'Cannot remove pickup point with active bookings',
          ERROR_CODES.PICKUP_POINT_HAS_BOOKINGS,
        );
      }

      const updatedRide = await this.rideRepository.removePickupPoint(rideId, pickupPointId);

      return {
        ride: updatedRide,
        message: 'Pickup point removed successfully',
      };
    } catch (error) {
      logger.error('Failed to remove pickup point', {
        action: 'PICKUP_POINT_REMOVE_FAILED',
        rideId,
        pickupPointId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Reorder pickup points
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID
   * @param {Array} newOrder - Array of pickup point IDs in new order
   * @returns {Promise<Object>} Updated ride
   */
  async reorderPickupPoints(rideId, driverId, newOrder) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to modify this ride', ERROR_CODES.FORBIDDEN);
      }

      const updatedRide = await this.rideRepository.reorderPickupPoints(rideId, newOrder);

      return {
        ride: updatedRide,
        message: 'Pickup points reordered successfully',
      };
    } catch (error) {
      logger.error('Failed to reorder pickup points', {
        action: 'PICKUP_POINTS_REORDER_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get pickup points for a ride
   * @param {string} rideId - Ride ID
   * @returns {Promise<Array>} List of pickup points
   */
  async getPickupPoints(rideId) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      return ride.pickupPoints || [];
    } catch (error) {
      logger.error('Failed to get pickup points', {
        action: 'PICKUP_POINTS_FETCH_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride Lifecycle ====================

  /**
   * Start ride (driver begins journey)
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Updated ride
   */
  async startRide(rideId, driverId) {
    logger.info('Starting ride', {
      action: RIDE_EVENTS.RIDE_STARTED,
      rideId,
      driverId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to start this ride', ERROR_CODES.FORBIDDEN);
      }

      if (ride.status !== RIDE_STATUS.ACTIVE && ride.status !== RIDE_STATUS.FULL) {
        throw new BadRequestError(
          `Cannot start ride with status: ${ride.status}`,
          ERROR_CODES.RIDE_CANNOT_START,
        );
      }

      // Update ride status
      const updatedRide = await this.rideRepository.updateStatus(rideId, RIDE_STATUS.IN_PROGRESS, {
        startedAt: formatDate(now()),
      });

      logger.info('Ride started', {
        action: RIDE_EVENTS.RIDE_STARTED,
        rideId,
      });

      return {
        ride: updatedRide,
        message: 'Ride started successfully',
        notifyPassengers: true,
      };
    } catch (error) {
      logger.error('Failed to start ride', {
        action: 'RIDE_START_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Complete ride
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID
   * @returns {Promise<Object>} Completed ride
   */
  async completeRide(rideId, driverId) {
    logger.info('Completing ride', {
      action: RIDE_EVENTS.RIDE_COMPLETED,
      rideId,
      driverId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to complete this ride', ERROR_CODES.FORBIDDEN);
      }

      if (ride.status !== RIDE_STATUS.IN_PROGRESS) {
        throw new BadRequestError(
          'Ride must be in progress to complete',
          ERROR_CODES.RIDE_NOT_IN_PROGRESS,
        );
      }

      // Calculate actual duration
      const actualDuration = calculateDuration(ride.startedAt, now());

      // Update ride status
      const updatedRide = await this.rideRepository.updateStatus(rideId, RIDE_STATUS.COMPLETED, {
        completedAt: formatDate(now()),
        actualDuration,
      });

      // Update driver statistics
      await this.userRepository.incrementDriverCompletedRides(driverId);

      logger.info('Ride completed', {
        action: RIDE_EVENTS.RIDE_COMPLETED,
        rideId,
        actualDuration,
      });

      return {
        ride: updatedRide,
        message: 'Ride completed successfully',
        actualDuration,
        promptForRatings: true,
      };
    } catch (error) {
      logger.error('Failed to complete ride', {
        action: 'RIDE_COMPLETE_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Ride Bookings & Passengers ====================

  /**
   * Get bookings for a ride (driver view)
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID (for authorization)
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} List of bookings
   */
  async getRideBookings(rideId, driverId, filters = {}) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to view ride bookings', ERROR_CODES.FORBIDDEN);
      }

      let bookings = await this.rideRepository.getRideBookings(rideId);

      // Filter by status if provided
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        bookings = bookings.filter((b) => statuses.includes(b.status));
      }

      return bookings;
    } catch (error) {
      logger.error('Failed to get ride bookings', {
        action: 'RIDE_BOOKINGS_FETCH_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get confirmed passengers for a ride (driver view)
   * @param {string} rideId - Ride ID
   * @param {string} driverId - Driver ID (for authorization)
   * @returns {Promise<Array>} List of confirmed passengers
   */
  async getRidePassengers(rideId, driverId) {
    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError(
          ERROR_MESSAGES[ERROR_CODES.RIDE_NOT_FOUND],
          ERROR_CODES.RIDE_NOT_FOUND,
        );
      }

      if (ride.driverId !== driverId) {
        throw new ForbiddenError('Not authorized to view ride passengers', ERROR_CODES.FORBIDDEN);
      }

      const bookings = await this.rideRepository.getRideBookings(rideId);
      const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');

      // Enrich with passenger details
      const passengers = await Promise.all(
        confirmedBookings.map(async (booking) => {
          const user = await this.userRepository.findById(booking.passengerId);
          return {
            bookingId: booking.bookingId,
            passengerId: booking.passengerId,
            firstName: user?.firstName,
            lastName: user?.lastName,
            phone: user?.phone,
            profilePhoto: user?.profilePhoto,
            seats: booking.seats,
            pickupPointId: booking.pickupPointId,
            bookedAt: booking.createdAt,
          };
        }),
      );

      return passengers;
    } catch (error) {
      logger.error('Failed to get ride passengers', {
        action: 'RIDE_PASSENGERS_FETCH_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Popular Routes ====================

  /**
   * Get popular routes based on ride history
   * @param {number} limit - Maximum number of routes to return
   * @returns {Promise<Array>} List of popular routes
   */
  async getPopularRoutes(limit = 10) {
    try {
      // Get recent completed rides to determine popular routes
      const completedRides = await this.rideRepository.search({
        status: [RIDE_STATUS.COMPLETED],
      });

      // Aggregate routes by start/end location pairs
      const routeMap = {};
      for (const ride of completedRides) {
        const startName = ride.startLocation?.name || ride.startLocation?.address || 'Unknown';
        const endName = ride.endLocation?.name || ride.endLocation?.address || 'Unknown';
        const routeKey = `${startName}::${endName}`;

        if (!routeMap[routeKey]) {
          routeMap[routeKey] = {
            startLocation: ride.startLocation,
            endLocation: ride.endLocation,
            rideCount: 0,
            averagePrice: 0,
            totalPrice: 0,
          };
        }

        routeMap[routeKey].rideCount += 1;
        routeMap[routeKey].totalPrice += ride.pricePerSeat || 0;
      }

      // Calculate averages and sort by popularity
      const routes = Object.values(routeMap)
        .map((route) => ({
          ...route,
          averagePrice: route.rideCount > 0 ? Math.round(route.totalPrice / route.rideCount) : 0,
          totalPrice: undefined,
        }))
        .sort((a, b) => b.rideCount - a.rideCount)
        .slice(0, limit);

      return routes;
    } catch (error) {
      logger.error('Failed to get popular routes', {
        action: 'POPULAR_ROUTES_FETCH_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Recurring Rides ====================

  /**
   * Create a recurring ride schedule
   * @param {string} driverId - Driver ID
   * @param {Object} scheduleData - Recurring ride schedule data
   * @returns {Promise<Object>} Created recurring schedule
   */
  async createRecurringRide(driverId, scheduleData) {
    logger.info('Creating recurring ride schedule', {
      action: 'RECURRING_RIDE_CREATED',
      driverId,
    });

    try {
      // Create the initial ride first
      const result = await this.createRide(driverId, {
        ...scheduleData,
        isRecurring: true,
      });

      return {
        scheduleId: result.ride.rideId,
        parentRide: result.ride,
        instances: result.recurringRides || [],
        message: result.message,
      };
    } catch (error) {
      logger.error('Failed to create recurring ride', {
        action: 'RECURRING_RIDE_CREATE_FAILED',
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get recurring ride schedules for a driver
   * @param {string} driverId - Driver ID
   * @returns {Promise<Array>} List of recurring ride schedules
   */
  async getRecurringRidesByDriver(driverId) {
    try {
      const rides = await this.rideRepository.findByDriver(driverId);

      // Filter to recurring parent rides only
      const recurringRides = rides.filter(
        (r) => r.isRecurring && !r.isRecurringInstance && r.status !== RIDE_STATUS.CANCELLED,
      );

      // Enrich with instance counts
      const schedules = await Promise.all(
        recurringRides.map(async (ride) => {
          const instances = await this.rideRepository.findRecurringInstances(ride.rideId);
          return {
            scheduleId: ride.rideId,
            ride,
            recurringDays: ride.recurringDays,
            recurringEndDate: ride.recurringEndDate,
            instanceCount: instances.length,
            activeInstances: instances.filter((i) => i.status === RIDE_STATUS.ACTIVE).length,
          };
        }),
      );

      return schedules;
    } catch (error) {
      logger.error('Failed to get recurring rides for driver', {
        action: 'RECURRING_RIDES_BY_DRIVER_FETCH_FAILED',
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get recurring ride instances
   * @param {string} parentRideId - Parent ride ID
   * @returns {Promise<Array>} List of recurring ride instances
   */
  async getRecurringRideInstances(parentRideId) {
    try {
      return await this.rideRepository.findRecurringInstances(parentRideId);
    } catch (error) {
      logger.error('Failed to get recurring rides', {
        action: 'RECURRING_RIDES_FETCH_FAILED',
        parentRideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Cancel recurring ride series
   * @param {string} parentRideId - Parent ride ID
   * @param {string} driverId - Driver ID
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelRecurringRides(parentRideId, driverId, options = {}) {
    const { cancelFutureOnly = true, reason = '' } = options;

    logger.info('Cancelling recurring rides', {
      action: 'RECURRING_RIDES_CANCELLED',
      parentRideId,
      cancelFutureOnly,
    });

    try {
      const instances = await this.rideRepository.findRecurringInstances(parentRideId);

      // Filter to future rides if requested
      const ridesToCancel = cancelFutureOnly
        ? instances.filter(
            (r) => !isExpired(r.departureDateTime) && r.status === RIDE_STATUS.ACTIVE,
          )
        : instances.filter((r) => r.status === RIDE_STATUS.ACTIVE);

      // Cancel each ride
      const validRidesToCancel = ridesToCancel.filter((ride) => ride.driverId === driverId);

      const results = await Promise.all(
        validRidesToCancel.map((ride) => this.cancelRide(ride.rideId, driverId, reason)),
      );

      const affectedBookings = results.flatMap((result) => result.affectedBookings || []);

      return {
        message: `Cancelled ${validRidesToCancel.length} recurring rides`,
        cancelledCount: validRidesToCancel.length,
        affectedBookings,
      };
    } catch (error) {
      logger.error('Failed to cancel recurring rides', {
        action: 'RECURRING_RIDES_CANCEL_FAILED',
        parentRideId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Validate driver eligibility
   * @private
   */
  async _validateDriver(driverId) {
    const driver = await this.userRepository.findById(driverId);

    if (!driver) {
      throw new NotFoundError('Driver not found', ERROR_CODES.USER_NOT_FOUND);
    }

    if (!driver.isDriver) {
      throw new ForbiddenError('User is not registered as a driver', ERROR_CODES.USER_NOT_DRIVER);
    }

    if (driver.driverVerificationStatus !== 'verified') {
      throw new ForbiddenError(
        'Driver verification is pending or rejected',
        ERROR_CODES.DRIVER_NOT_VERIFIED,
      );
    }

    if (!driver.isVerified) {
      throw new ForbiddenError(
        'Email must be verified to create rides',
        ERROR_CODES.USER_NOT_VERIFIED,
      );
    }

    return driver;
  }

  /**
   * Validate vehicle
   * @private
   */
  async _validateVehicle(vehicleId, driverId, requestedSeats) {
    let vehicle;

    if (vehicleId) {
      vehicle = await this.vehicleRepository.findById(vehicleId);
      if (!vehicle) {
        throw new NotFoundError('Vehicle not found', ERROR_CODES.VEHICLE_NOT_FOUND);
      }
      if (vehicle.userId !== driverId) {
        throw new ForbiddenError('Vehicle does not belong to driver', ERROR_CODES.FORBIDDEN);
      }
    } else {
      // Get primary vehicle
      const vehicles = await this.vehicleRepository.findByUserId(driverId);
      vehicle = vehicles.find((v) => v.isPrimary) || vehicles[0];
      if (!vehicle) {
        throw new BadRequestError(
          'No vehicle found. Please add a vehicle first.',
          ERROR_CODES.VEHICLE_NOT_FOUND,
        );
      }
    }

    if (vehicle.verificationStatus !== 'approved') {
      throw new ForbiddenError(
        'Vehicle verification is pending or rejected',
        ERROR_CODES.VEHICLE_NOT_VERIFIED,
      );
    }

    if (requestedSeats > vehicle.capacity) {
      throw new ValidationError('Seats exceed vehicle capacity', [
        {
          field: 'availableSeats',
          message: `Maximum seats for this vehicle is ${vehicle.capacity}`,
        },
      ]);
    }

    return vehicle;
  }

  /**
   * Validate departure time
   * @private
   */
  async _validateDepartureTime(departureDateTime) {
    const minDeparture = addMinutes(now(), RIDE_CONFIG.minAdvanceBookingMinutes);
    const maxDeparture = addDays(now(), RIDE_CONFIG.maxAdvanceBookingDays);

    if (isBefore(departureDateTime, minDeparture)) {
      throw new ValidationError('Invalid departure time', [
        {
          field: 'departureTime',
          message: `Departure must be at least ${RIDE_CONFIG.minAdvanceBookingMinutes} minutes from now`,
        },
      ]);
    }

    if (isAfter(departureDateTime, maxDeparture)) {
      throw new ValidationError('Invalid departure time', [
        {
          field: 'departureDate',
          message: `Departure must be within ${RIDE_CONFIG.maxAdvanceBookingDays} days`,
        },
      ]);
    }
  }

  /**
   * Validate price
   * @private
   */
  _validatePrice(price) {
    if (price < RIDE_CONFIG.minPrice || price > RIDE_CONFIG.maxPrice) {
      throw new ValidationError('Invalid price', [
        {
          field: 'pricePerSeat',
          message: `Price must be between ₦${RIDE_CONFIG.minPrice} and ₦${RIDE_CONFIG.maxPrice}`,
        },
      ]);
    }
  }

  /**
   * Check for overlapping rides
   * @private
   */
  async _checkOverlappingRides(driverId, departureDateTime) {
    const existingRides = await this.rideRepository.findByDriverAndDate(
      driverId,
      getDateOnly(departureDateTime),
    );

    const overlapping = existingRides.find((ride) => {
      if (ride.status === RIDE_STATUS.CANCELLED) return false;

      const rideDeparture = parseDate(ride.departureDateTime);
      const timeDiff = Math.abs(departureDateTime - rideDeparture) / (1000 * 60); // minutes

      // Consider overlapping if within 30 minutes
      return timeDiff < 30;
    });

    if (overlapping) {
      throw new ConflictError(
        'You already have a ride scheduled around this time',
        ERROR_CODES.RIDE_TIME_CONFLICT,
        { existingRideId: overlapping.rideId },
      );
    }
  }

  /**
   * Combine date and time strings
   * @private
   */
  _combineDateAndTime(date, time) {
    const dateStr = typeof date === 'string' ? date : getDateOnly(date);
    return parseDate(`${dateStr}T${time}`);
  }

  /**
   * Process pickup points
   * @private
   */
  _processPickupPoints(pickupPoints, departureDateTime) {
    if (!pickupPoints || pickupPoints.length === 0) return [];

    return pickupPoints.map((point, index) => ({
      pickupPointId: randomUUID(),
      name: point.name,
      address: point.address,
      coordinates: point.coordinates,
      estimatedTime:
        point.estimatedTime || formatTime(addMinutes(departureDateTime, (index + 1) * 5)),
      order: index + 1,
    }));
  }

  /**
   * Calculate route info (simplified)
   * @private
   */
  _calculateRouteInfo(startLocation, endLocation, _pickupPoints) {
    // In production, this would call Mapbox Directions API
    // Simplified calculation for now
    const distance = this._calculateDistance(startLocation.coordinates, endLocation.coordinates);

    return {
      polyline: null, // Would be encoded polyline from Mapbox
      distance: Math.round(distance * 10) / 10, // km
      duration: Math.round(distance * 3), // Rough estimate: 3 min per km
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * @private
   */
  _calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const dLat = this._toRad(lat2 - lat1);
    const dLon = this._toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRad(lat1)) *
        Math.cos(this._toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  _toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Filter rides by proximity to location
   * @private
   */
  _filterByProximity(rides, targetCoords, locationField) {
    return rides.filter((ride) => {
      const rideCoords = ride[locationField]?.coordinates;
      if (!rideCoords) return false;

      const distance = this._calculateDistance(targetCoords, rideCoords);
      return distance <= RIDE_CONFIG.searchRadiusKm;
    });
  }

  /**
   * Sort rides
   * @private
   */
  _sortRides(rides, sortBy, sortOrder) {
    const sortFunctions = {
      departureTime: (a, b) => new Date(a.departureDateTime) - new Date(b.departureDateTime),
      price: (a, b) => a.pricePerSeat - b.pricePerSeat,
      rating: (a, b) => (b.driver?.averageRating || 0) - (a.driver?.averageRating || 0),
      seats: (a, b) => b.availableSeats - a.availableSeats,
    };

    const sortFn = sortFunctions[sortBy] || sortFunctions.departureTime;
    const sorted = [...rides].sort(sortFn);

    return sortOrder === 'desc' ? sorted.reverse() : sorted;
  }

  /**
   * Enrich ride data for search results
   * @private
   */
  _enrichRideForSearch(ride, requestedSeats) {
    return {
      rideId: ride.rideId,
      departureDate: ride.departureDate,
      departureTime: ride.departureTime,
      startLocation: ride.startLocation,
      endLocation: ride.endLocation,
      pickupPoints: ride.pickupPoints,
      availableSeats: ride.availableSeats,
      pricePerSeat: ride.pricePerSeat,
      totalPrice: ride.pricePerSeat * requestedSeats,
      waitTime: ride.waitTime,
      estimatedDuration: ride.estimatedDuration,
      estimatedDistance: ride.estimatedDistance,
      driver: {
        firstName: ride.driver?.firstName,
        lastName: `${ride.driver?.lastName?.charAt(0)}.`,
        averageRating: ride.driver?.averageRating || 0,
        profilePhoto: ride.driver?.profilePhoto,
      },
      vehicle: {
        make: ride.vehicle?.make,
        model: ride.vehicle?.model,
        color: ride.vehicle?.color,
      },
    };
  }

  /**
   * Create recurring ride instances
   * @private
   */
  async _createRecurringRides(parentRide, recurringDays, endDate) {
    const maxEndDate = endDate
      ? parseDate(endDate)
      : addDays(now(), RIDE_CONFIG.recurringMaxWeeks * 7);

    let currentDate = addDays(parseDate(parentRide.departureDate), 1);
    const ridesToCreate = [];

    while (isBefore(currentDate, maxEndDate) && ridesToCreate.length < 50) {
      const dayOfWeek = getDayOfWeek(currentDate);

      if (recurringDays.includes(dayOfWeek)) {
        ridesToCreate.push({
          ...parentRide,
          rideId: randomUUID(),
          parentRideId: parentRide.rideId,
          departureDate: getDateOnly(currentDate),
          departureDateTime: formatDate(
            this._combineDateAndTime(currentDate, parentRide.departureTime),
          ),
          isRecurringInstance: true,
          createdAt: formatDate(now()),
        });
      }

      currentDate = addDays(currentDate, 1);
    }

    const instances = await Promise.all(
      ridesToCreate.map((instanceRide) => this.rideRepository.create(instanceRide)),
    );

    // Update parent ride with recurring info
    await this.rideRepository.update(parentRide.rideId, {
      recurringDays,
      recurringEndDate: formatDate(maxEndDate),
      recurringInstanceCount: instances.length,
    });

    return instances;
  }
}

module.exports = RideService;
