/**
 * Matching Service
 * University of Ilorin Carpooling Platform
 *
 * Handles ride matching algorithms, route optimization,
 * and time-based matching for passengers seeking rides.
 *
 * @module services/MatchingService
 */

const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { logger } = require('../../shared/utils/logger');
const {
  now,
  parseDate,
  addMinutes,
  subtractMinutes,
  getDateOnly,
  isBefore,
  isAfter,
} = require('../../shared/utils/dateTime');
const { BadRequestError, NotFoundError } = require('../../shared/errors');
const { ERROR_CODES } = require('../../shared/constants/errors');

/**
 * Matching configuration
 */
const MATCHING_CONFIG = {
  maxDistanceKm: 5, // Maximum distance from pickup/destination
  defaultTimeWindowMinutes: 60, // Time flexibility window
  maxResultsPerQuery: 20,
  scoringWeights: {
    distance: 0.3,
    time: 0.25,
    price: 0.2,
    rating: 0.15,
    pickupProximity: 0.1,
  },
  minDriverRating: 3.0,
  maxWalkingDistanceKm: 1, // Maximum walking distance to pickup
};

/**
 * University of Ilorin campus coordinates
 */
// eslint-disable-next-line no-unused-vars
const CAMPUS_LOCATIONS = {
  mainGate: { lat: 8.4799, lng: 4.5418, name: 'Main Gate' },
  senate: { lat: 8.4821, lng: 4.5456, name: 'Senate Building' },
  library: { lat: 8.4835, lng: 4.5472, name: 'University Library' },
  stadium: { lat: 8.4756, lng: 4.5389, name: 'Stadium' },
  tanke: { lat: 8.4712, lng: 4.5234, name: 'Tanke Junction' },
  gra: { lat: 8.4923, lng: 4.5512, name: 'GRA' },
  oke_odo: { lat: 8.4678, lng: 4.5145, name: 'Oke-Odo' },
};

/**
 * MatchingService class
 * Manages ride matching operations
 */
class MatchingService {
  constructor() {
    this.rideRepository = new RideRepository();
    this.userRepository = new UserRepository();
    this.serviceName = 'MatchingService';
  }

  // ==================== Primary Matching ====================

  /**
   * Find matching rides for a passenger request
   * @param {Object} request - Matching request
   * @returns {Promise<Object>} Matching results
   */
  async findMatchingRides(request) {
    const startTime = Date.now();
    logger.info('Finding matching rides', {
      action: 'MATCHING_STARTED',
      request: {
        date: request.date,
        time: request.time,
        fromLat: request.from?.lat,
        fromLng: request.from?.lng,
        toLat: request.to?.lat,
        toLng: request.to?.lng,
      },
    });

    try {
      const {
        date,
        time,
        from,
        to,
        seats = 1,
        timeFlexibilityMinutes = MATCHING_CONFIG.defaultTimeWindowMinutes,
        maxPrice,
        minRating,
        preferences = {},
      } = request;

      // Validate required fields
      if (!date || !time || !from || !to) {
        throw new BadRequestError(
          'Date, time, from, and to locations are required',
          ERROR_CODES.INVALID_REQUEST,
        );
      }

      // Calculate time window
      const requestedTime = parseDate(`${date}T${time}`);
      const timeWindowStart = subtractMinutes(requestedTime, timeFlexibilityMinutes / 2);
      const timeWindowEnd = addMinutes(requestedTime, timeFlexibilityMinutes / 2);

      // Get candidate rides
      const candidateRides = await this._getCandidateRides({
        date,
        timeWindowStart,
        timeWindowEnd,
        minSeats: seats,
      });

      logger.debug('Candidate rides found', {
        count: candidateRides.length,
      });

      // Score and filter rides
      const scoredRides = await this._scoreRides(candidateRides, {
        from,
        to,
        requestedTime,
        seats,
        maxPrice,
        minRating,
        preferences,
      });

      // Sort by score (descending)
      scoredRides.sort((a, b) => b.matchScore - a.matchScore);

      // Limit results
      const topMatches = scoredRides.slice(0, MATCHING_CONFIG.maxResultsPerQuery);

      // Group by match quality
      const grouped = this._groupByMatchQuality(topMatches);

      logger.info('Matching completed', {
        action: 'MATCHING_COMPLETED',
        totalCandidates: candidateRides.length,
        matchesFound: topMatches.length,
        duration: Date.now() - startTime,
      });

      return {
        matches: topMatches,
        grouped,
        meta: {
          totalCandidates: candidateRides.length,
          matchesReturned: topMatches.length,
          searchCriteria: {
            date,
            time,
            seats,
            timeFlexibility: timeFlexibilityMinutes,
          },
          processingTimeMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      logger.error('Matching failed', {
        action: 'MATCHING_FAILED',
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Find rides near a specific location
   * @param {Object} location - Location coordinates
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Nearby rides
   */
  async findRidesNearLocation(location, options = {}) {
    logger.info('Finding rides near location', {
      action: 'NEARBY_RIDES_SEARCH',
      lat: location.lat,
      lng: location.lng,
    });

    try {
      const {
        date = getDateOnly(now()),
        radiusKm = MATCHING_CONFIG.maxDistanceKm,
        limit = 10,
      } = options;

      // Get rides for the date
      const rides = await this.rideRepository.findByDate(date);

      // Filter by proximity to start location
      const nearbyRides = rides
        .filter((ride) => {
          const distance = this._calculateDistance(location, {
            lat: ride.startLocation.coordinates[0],
            lng: ride.startLocation.coordinates[1],
          });
          return distance <= radiusKm && ride.status === 'active' && ride.availableSeats > 0;
        })
        .map((ride) => ({
          ...ride,
          distanceToPickup: this._calculateDistance(location, {
            lat: ride.startLocation.coordinates[0],
            lng: ride.startLocation.coordinates[1],
          }),
        }))
        .sort((a, b) => a.distanceToPickup - b.distanceToPickup)
        .slice(0, limit);

      return nearbyRides;
    } catch (error) {
      logger.error('Nearby rides search failed', {
        action: 'NEARBY_SEARCH_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get ride suggestions based on user history
   * @param {string} userId - User ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} Suggested rides
   */
  async getSuggestedRides(userId, options = {}) {
    logger.info('Getting suggested rides', {
      action: 'SUGGESTIONS_REQUESTED',
      userId,
    });

    try {
      const { date = getDateOnly(now()), limit = 5 } = options;

      // Get user's booking history
      const userHistory = await this._getUserTravelPatterns(userId);

      if (!userHistory || userHistory.patterns.length === 0) {
        // No history, return popular routes
        return this.getPopularRides({ date, limit });
      }

      // Get rides matching user's common routes
      const suggestions = await userHistory.patterns.reduce(async (accPromise, pattern) => {
        const acc = await accPromise;
        const matchingRides = await this.findMatchingRides({
          date,
          time: pattern.commonTime,
          from: pattern.commonFrom,
          to: pattern.commonTo,
          seats: 1,
        });

        acc.push(...matchingRides.matches.slice(0, 2));
        return acc;
      }, Promise.resolve([]));

      // Remove duplicates and sort
      const uniqueSuggestions = this._deduplicateRides(suggestions).slice(0, limit);

      return {
        suggestions: uniqueSuggestions,
        basedOn: 'travel_history',
        patterns: userHistory.patterns.length,
      };
    } catch (error) {
      logger.error('Suggestions failed', {
        action: 'SUGGESTIONS_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get popular rides on campus
   * @param {Object} options - Options
   * @returns {Promise<Object>} Popular rides
   */
  async getPopularRides(options = {}) {
    try {
      const { date = getDateOnly(now()), limit = 10 } = options;

      const rides = await this.rideRepository.findByDate(date);

      // Sort by booking count and driver rating
      const popularRides = rides
        .filter((r) => r.status === 'active' && r.availableSeats > 0)
        .map((ride) => ({
          ...ride,
          popularityScore: ride.bookedSeats * 2 + (ride.driver?.averageRating || 0),
        }))
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, limit);

      return {
        rides: popularRides,
        basedOn: 'popularity',
      };
    } catch (error) {
      logger.error('Popular rides fetch failed', {
        action: 'POPULAR_RIDES_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Route Optimization ====================

  /**
   * Optimize pickup order for a ride
   * @param {string} rideId - Ride ID
   * @returns {Promise<Object>} Optimized route
   */
  async optimizePickupOrder(rideId) {
    logger.info('Optimizing pickup order', {
      action: 'ROUTE_OPTIMIZATION',
      rideId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError('Ride not found', ERROR_CODES.RIDE_NOT_FOUND);
      }

      if (!ride.pickupPoints || ride.pickupPoints.length <= 1) {
        return {
          message: 'No optimization needed',
          originalOrder: ride.pickupPoints,
          optimizedOrder: ride.pickupPoints,
          timeSaved: 0,
        };
      }

      // Get start and end points
      const start = {
        lat: ride.startLocation.coordinates[0],
        lng: ride.startLocation.coordinates[1],
      };
      const end = {
        lat: ride.endLocation.coordinates[0],
        lng: ride.endLocation.coordinates[1],
      };

      // Optimize using nearest neighbor algorithm
      const optimizedOrder = this._optimizeRouteOrder(start, end, ride.pickupPoints);

      // Calculate time savings
      const originalDistance = this._calculateTotalRouteDistance(start, end, ride.pickupPoints);
      const optimizedDistance = this._calculateTotalRouteDistance(start, end, optimizedOrder);
      const distanceSaved = originalDistance - optimizedDistance;
      const timeSaved = Math.round(distanceSaved * 2); // Rough estimate: 2 min per km

      return {
        originalOrder: ride.pickupPoints,
        optimizedOrder,
        distanceSaved: Math.round(distanceSaved * 10) / 10,
        timeSaved,
        recommendation:
          distanceSaved > 0.5 ? 'Recommend applying optimization' : 'Current order is efficient',
      };
    } catch (error) {
      logger.error('Route optimization failed', {
        action: 'OPTIMIZATION_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate optimal route between multiple points
   * @param {Array} points - Array of location points
   * @returns {Promise<Object>} Optimized route
   */
  async calculateOptimalRoute(points) {
    if (points.length < 2) {
      throw new BadRequestError('At least 2 points required', ERROR_CODES.INVALID_REQUEST);
    }

    const start = points[0];
    const end = points[points.length - 1];
    const waypoints = points.slice(1, -1);

    if (waypoints.length === 0) {
      // Direct route
      const distance = this._calculateDistance(start, end);
      return {
        route: [start, end],
        totalDistance: distance,
        estimatedDuration: Math.round(distance * 3), // 3 min per km
      };
    }

    // Optimize waypoints
    const optimizedWaypoints = this._optimizeWaypointOrder(start, end, waypoints);
    const route = [start, ...optimizedWaypoints, end];
    const totalDistance = this._calculateRouteDistance(route);

    return {
      route,
      totalDistance: Math.round(totalDistance * 10) / 10,
      estimatedDuration: Math.round(totalDistance * 3),
    };
  }

  // ==================== Time-Based Matching ====================

  /**
   * Find rides within time window
   * @param {Object} params - Time-based search params
   * @returns {Promise<Array>} Matching rides
   */
  async findRidesByTimeWindow(params) {
    const { date, startTime, endTime, from, to, seats = 1 } = params;

    const rides = await this.rideRepository.findByDateAndTimeRange(date, startTime, endTime);

    // Filter by location and seats
    let filteredRides = rides.filter((r) => r.status === 'active' && r.availableSeats >= seats);

    if (from) {
      filteredRides = filteredRides.filter((ride) => {
        const distance = this._calculateDistance(from, {
          lat: ride.startLocation.coordinates[0],
          lng: ride.startLocation.coordinates[1],
        });
        return distance <= MATCHING_CONFIG.maxDistanceKm;
      });
    }

    if (to) {
      filteredRides = filteredRides.filter((ride) => {
        const distance = this._calculateDistance(to, {
          lat: ride.endLocation.coordinates[0],
          lng: ride.endLocation.coordinates[1],
        });
        return distance <= MATCHING_CONFIG.maxDistanceKm;
      });
    }

    return filteredRides;
  }

  /**
   * Find recurring rides matching pattern
   * @param {Object} pattern - Recurring pattern
   * @returns {Promise<Array>} Matching recurring rides
   */
  async findRecurringMatches(pattern) {
    // eslint-disable-next-line no-unused-vars
    const { days, time, from, to, seats = 1 } = pattern;

    // Get all recurring rides
    const recurringRides = await this.rideRepository.findRecurring();

    // Filter by matching days
    const matchingRides = recurringRides.filter((ride) => {
      // Check if ride's recurring days overlap with requested days
      const rideHasMatchingDays = ride.recurringDays?.some((d) => days.includes(d));
      if (!rideHasMatchingDays) return false;

      // Check time proximity
      const timeDiff = this._calculateTimeDifference(ride.departureTime, time);
      if (timeDiff > MATCHING_CONFIG.defaultTimeWindowMinutes) return false;

      // Check seats
      if (ride.availableSeats < seats) return false;

      // Check location proximity
      if (from) {
        const pickupDistance = this._calculateDistance(from, {
          lat: ride.startLocation.coordinates[0],
          lng: ride.startLocation.coordinates[1],
        });
        if (pickupDistance > MATCHING_CONFIG.maxDistanceKm) return false;
      }

      return true;
    });

    return matchingRides;
  }

  // ==================== Matching Analytics ====================

  /**
   * Get matching statistics
   * @param {Object} options - Options
   * @returns {Promise<Object>} Matching stats
   */
  async getMatchingStats(_options = {}) {
    try {
      const stats = {
        popularRoutes: await this._getPopularRoutes(),
        peakTimes: await this._getPeakTimes(),
        averageMatchScore: 0,
        matchSuccessRate: 0,
      };

      return stats;
    } catch (error) {
      logger.error('Stats fetch failed', {
        action: 'STATS_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Get candidate rides for matching
   * @private
   */
  async _getCandidateRides({ date, timeWindowStart, timeWindowEnd, minSeats }) {
    const rides = await this.rideRepository.findByDate(date);

    return rides.filter((ride) => {
      // Check status
      if (ride.status !== 'active') return false;

      // Check seats
      if (ride.availableSeats < minSeats) return false;

      // Check time window
      const rideTime = parseDate(`${date}T${ride.departureTime}`);
      if (isBefore(rideTime, timeWindowStart) || isAfter(rideTime, timeWindowEnd)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Score rides based on match criteria
   * @private
   */
  async _scoreRides(rides, criteria) {
    const { from, to, requestedTime, maxPrice, minRating } = criteria;

    return rides
      .filter((ride) => {
        // Apply filters
        if (maxPrice && ride.pricePerSeat > maxPrice) return false;
        if (minRating && (ride.driver?.averageRating || 0) < minRating) return false;
        return true;
      })
      .map((ride) => {
        // Calculate individual scores
        const scores = {
          distance: this._calculateDistanceScore(ride, from, to),
          time: this._calculateTimeScore(ride, requestedTime),
          price: this._calculatePriceScore(ride, maxPrice),
          rating: this._calculateRatingScore(ride, minRating),
          pickupProximity: this._calculatePickupProximityScore(ride, from),
        };

        // Calculate weighted score
        const weights = MATCHING_CONFIG.scoringWeights;
        const matchScore =
          scores.distance * weights.distance +
          scores.time * weights.time +
          scores.price * weights.price +
          scores.rating * weights.rating +
          scores.pickupProximity * weights.pickupProximity;

        return {
          ...ride,
          matchScore: Math.round(matchScore * 100) / 100,
          matchDetails: scores,
          pickupDistance: this._calculateDistance(from, {
            lat: ride.startLocation.coordinates[0],
            lng: ride.startLocation.coordinates[1],
          }),
          destinationDistance: this._calculateDistance(to, {
            lat: ride.endLocation.coordinates[0],
            lng: ride.endLocation.coordinates[1],
          }),
        };
      });
  }

  /**
   * Calculate distance score (0-1)
   * @private
   */
  _calculateDistanceScore(ride, from, to) {
    const pickupDistance = this._calculateDistance(from, {
      lat: ride.startLocation.coordinates[0],
      lng: ride.startLocation.coordinates[1],
    });
    const destinationDistance = this._calculateDistance(to, {
      lat: ride.endLocation.coordinates[0],
      lng: ride.endLocation.coordinates[1],
    });

    // Normalize distances (max 5km = 0 score, 0km = 1 score)
    const pickupScore = Math.max(0, 1 - pickupDistance / MATCHING_CONFIG.maxDistanceKm);
    const destScore = Math.max(0, 1 - destinationDistance / MATCHING_CONFIG.maxDistanceKm);

    return (pickupScore + destScore) / 2;
  }

  /**
   * Calculate time score (0-1)
   * @private
   */
  _calculateTimeScore(ride, requestedTime) {
    const rideTime = parseDate(`${ride.departureDate}T${ride.departureTime}`);
    const timeDiffMinutes = Math.abs(rideTime - requestedTime) / (1000 * 60);

    // Normalize (0 diff = 1 score, 60 min diff = 0 score)
    return Math.max(0, 1 - timeDiffMinutes / MATCHING_CONFIG.defaultTimeWindowMinutes);
  }

  /**
   * Calculate price score (0-1)
   * @private
   */
  _calculatePriceScore(ride, maxPrice) {
    if (!maxPrice) return 0.5; // Neutral score if no max specified

    // Lower price = higher score
    const priceRatio = ride.pricePerSeat / maxPrice;
    return Math.max(0, 1 - (priceRatio - 0.5)); // Center around 50% of max
  }

  /**
   * Calculate rating score (0-1)
   * @private
   */
  _calculateRatingScore(ride, _minRating) {
    const driverRating = ride.driver?.averageRating || 0;

    // Normalize to 0-1 (rating of 5 = 1, rating of 1 = 0)
    return (driverRating - 1) / 4;
  }

  /**
   * Calculate pickup proximity score (0-1)
   * @private
   */
  _calculatePickupProximityScore(ride, from) {
    // Check if any pickup point is closer than the start location
    const startDistance = this._calculateDistance(from, {
      lat: ride.startLocation.coordinates[0],
      lng: ride.startLocation.coordinates[1],
    });

    let closestDistance = startDistance;

    if (ride.pickupPoints && ride.pickupPoints.length > 0) {
      closestDistance = ride.pickupPoints.reduce((closest, point) => {
        const distance = this._calculateDistance(from, {
          lat: point.coordinates[0],
          lng: point.coordinates[1],
        });
        return distance < closest ? distance : closest;
      }, closestDistance);
    }

    // Normalize (0 distance = 1 score, 1km = 0 score)
    return Math.max(0, 1 - closestDistance / MATCHING_CONFIG.maxWalkingDistanceKm);
  }

  /**
   * Group rides by match quality
   * @private
   */
  _groupByMatchQuality(rides) {
    return {
      excellent: rides.filter((r) => r.matchScore >= 0.8),
      good: rides.filter((r) => r.matchScore >= 0.6 && r.matchScore < 0.8),
      fair: rides.filter((r) => r.matchScore >= 0.4 && r.matchScore < 0.6),
      poor: rides.filter((r) => r.matchScore < 0.4),
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * @private
   */
  _calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const lat1 = (point1.lat * Math.PI) / 180;
    const lat2 = (point2.lat * Math.PI) / 180;
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate time difference in minutes
   * @private
   */
  _calculateTimeDifference(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const totalMin1 = h1 * 60 + m1;
    const totalMin2 = h2 * 60 + m2;
    return Math.abs(totalMin1 - totalMin2);
  }

  /**
   * Optimize route order using nearest neighbor
   * @private
   */
  _optimizeRouteOrder(start, end, waypoints) {
    const remaining = [...waypoints];
    const optimized = [];
    let current = start;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i += 1) {
        const point = {
          lat: remaining[i].coordinates[0],
          lng: remaining[i].coordinates[1],
        };
        const dist = this._calculateDistance(current, point);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      const nearest = remaining.splice(nearestIdx, 1)[0];
      optimized.push(nearest);
      current = {
        lat: nearest.coordinates[0],
        lng: nearest.coordinates[1],
      };
    }

    return optimized;
  }

  /**
   * Optimize waypoint order
   * @private
   */
  _optimizeWaypointOrder(start, end, waypoints) {
    // Use same algorithm as route order
    const waypointsCopy = waypoints.map((w) => ({
      ...w,
      coordinates: [w.lat, w.lng],
    }));

    const optimized = this._optimizeRouteOrder(start, end, waypointsCopy);
    return optimized.map((w) => ({ lat: w.coordinates[0], lng: w.coordinates[1] }));
  }

  /**
   * Calculate total route distance
   * @private
   */
  _calculateTotalRouteDistance(start, end, waypoints) {
    const { total } = waypoints.reduce(
      ({ total: acc, current }) => {
        const point = { lat: current.coordinates[0], lng: current.coordinates[1] };
        return {
          total: acc + this._calculateDistance(current, point),
          current: point,
        };
      },
      { total: 0, current: start },
    );

    const finalPoint =
      waypoints.length > 0
        ? {
            lat: waypoints[waypoints.length - 1].coordinates[0],
            lng: waypoints[waypoints.length - 1].coordinates[1],
          }
        : start;

    return total + this._calculateDistance(finalPoint, end);
  }

  /**
   * Calculate route distance from array of points
   * @private
   */
  _calculateRouteDistance(route) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i += 1) {
      total += this._calculateDistance(route[i], route[i + 1]);
    }
    return total;
  }

  /**
   * Get user travel patterns
   * @private
   */
  async _getUserTravelPatterns(_userId) {
    // This would analyze user's booking history
    // Simplified implementation
    return {
      patterns: [],
    };
  }

  /**
   * Remove duplicate rides
   * @private
   */
  _deduplicateRides(rides) {
    const seen = new Set();
    return rides.filter((ride) => {
      if (seen.has(ride.rideId)) return false;
      seen.add(ride.rideId);
      return true;
    });
  }

  /**
   * Get popular routes
   * @private
   */
  async _getPopularRoutes() {
    // Would analyze booking data to find popular routes
    return [
      { from: 'Tanke', to: 'Campus', bookings: 150 },
      { from: 'GRA', to: 'Campus', bookings: 120 },
      { from: 'Oke-Odo', to: 'Campus', bookings: 100 },
    ];
  }

  /**
   * Get peak times
   * @private
   */
  async _getPeakTimes() {
    return {
      morning: { start: '07:00', end: '09:00', demandLevel: 'high' },
      afternoon: { start: '12:00', end: '14:00', demandLevel: 'medium' },
      evening: { start: '16:00', end: '18:00', demandLevel: 'high' },
    };
  }
}

module.exports = MatchingService;
