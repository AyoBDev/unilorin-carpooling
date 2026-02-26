/**
 * Rating Service
 * University of Ilorin Carpooling Platform
 *
 * Handles rating creation, average calculations, and rating retrieval.
 * Supports both driver and passenger ratings.
 *
 * @module services/RatingService
 */

const { randomUUID } = require('crypto');
const RatingRepository = require('../../infrastructure/database/repositories/RatingRepository');
const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { logger } = require('../../shared/utils/logger');
const { formatDate, now, isExpired, addDays } = require('../../shared/utils/dateTime');
const {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} = require('../../shared/errors');
const { ERROR_CODES } = require('../../shared/constants/errors');
const { RATING_EVENTS } = require('../../shared/constants/events');

/**
 * Rating types
 */
const RATING_TYPE = {
  DRIVER_RATING: 'driver_rating', // Passenger rates driver
  PASSENGER_RATING: 'passenger_rating', // Driver rates passenger
};

/**
 * Rating configuration
 */
const RATING_CONFIG = {
  minRating: 1,
  maxRating: 5,
  ratingWindowDays: 7, // Days after ride to submit rating
  minCommentLength: 0,
  maxCommentLength: 500,
};

/**
 * Predefined rating tags
 */
const RATING_TAGS = {
  driver: {
    positive: [
      'Punctual',
      'Safe Driver',
      'Clean Vehicle',
      'Friendly',
      'Good Communication',
      'Comfortable Ride',
      'Professional',
      'Helpful',
    ],
    negative: [
      'Late',
      'Reckless Driving',
      'Dirty Vehicle',
      'Unfriendly',
      'Poor Communication',
      'Uncomfortable',
      'Unprofessional',
    ],
  },
  passenger: {
    positive: ['Punctual', 'Respectful', 'Good Communication', 'Friendly', 'Clean', 'Paid on Time'],
    negative: ['Late', 'No Show', 'Rude', 'Poor Communication', 'Payment Issues'],
  },
};

/**
 * RatingService class
 * Manages all rating operations
 */
class RatingService {
  constructor() {
    this.ratingRepository = new RatingRepository();
    this.bookingRepository = new BookingRepository();
    this.userRepository = new UserRepository();
    this.serviceName = 'RatingService';
  }

  // ==================== Rating Creation ====================

  /**
   * Create a rating for a completed booking
   * @param {string} raterId - User giving the rating
   * @param {Object} ratingData - Rating data
   * @returns {Promise<Object>} Created rating
   */
  async createRating(raterId, ratingData) {
    const startTime = Date.now();
    logger.info('Creating rating', {
      action: RATING_EVENTS.RATING_CREATED,
      raterId,
      bookingId: ratingData.bookingId,
    });

    try {
      const { bookingId, score, comment, tags } = ratingData;

      // Validate score
      if (!score || score < RATING_CONFIG.minRating || score > RATING_CONFIG.maxRating) {
        throw new ValidationError('Invalid rating score', [
          {
            field: 'score',
            message: `Score must be between ${RATING_CONFIG.minRating} and ${RATING_CONFIG.maxRating}`,
          },
        ]);
      }

      // Validate comment
      if (comment && comment.length > RATING_CONFIG.maxCommentLength) {
        throw new ValidationError('Comment too long', [
          {
            field: 'comment',
            message: `Comment must be less than ${RATING_CONFIG.maxCommentLength} characters`,
          },
        ]);
      }

      // Get booking
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found', ERROR_CODES.BOOKING_NOT_FOUND);
      }

      // Validate booking is completed
      if (booking.status !== 'completed') {
        throw new BadRequestError(
          'Can only rate completed bookings',
          ERROR_CODES.BOOKING_NOT_COMPLETED,
        );
      }

      // Determine rating type and rated user
      const isPassenger = booking.passengerId === raterId;
      const isDriver = booking.driverId === raterId;

      if (!isPassenger && !isDriver) {
        throw new ForbiddenError('Not authorized to rate this booking', ERROR_CODES.FORBIDDEN);
      }

      const ratingType = isPassenger ? RATING_TYPE.DRIVER_RATING : RATING_TYPE.PASSENGER_RATING;
      const ratedUserId = isPassenger ? booking.driverId : booking.passengerId;

      // Check if rating window has expired
      const ratingDeadline = addDays(booking.completedAt, RATING_CONFIG.ratingWindowDays);
      if (isExpired(ratingDeadline)) {
        throw new BadRequestError(
          `Rating window has expired. Ratings must be submitted within ${RATING_CONFIG.ratingWindowDays} days of ride completion.`,
          ERROR_CODES.RATING_WINDOW_EXPIRED,
        );
      }

      // Check for existing rating
      const existingRating = await this.ratingRepository.findByBookingAndRater(bookingId, raterId);
      if (existingRating) {
        throw new ConflictError('You have already rated this booking', ERROR_CODES.RATING_EXISTS, {
          existingRatingId: existingRating.ratingId,
        });
      }

      // Validate tags
      const validTags = this._validateTags(tags, ratingType, score);

      // Create rating
      const ratingId = randomUUID();
      const rating = {
        ratingId,
        bookingId,
        rideId: booking.rideId,
        raterId,
        ratedUserId,
        ratingType,
        score,
        comment: comment?.trim() || null,
        tags: validTags,
        isAnonymous: ratingData.isAnonymous || false,
        createdAt: formatDate(now()),
      };

      const createdRating = await this.ratingRepository.create(rating);

      // Update user's average rating
      await this._updateUserAverageRating(ratedUserId);

      // Update booking with rating info
      await this._updateBookingRating(bookingId, raterId, ratingType);

      logger.info('Rating created successfully', {
        action: RATING_EVENTS.RATING_CREATED,
        ratingId,
        bookingId,
        ratingType,
        score,
        duration: Date.now() - startTime,
      });

      return {
        rating: this._sanitizeRating(createdRating, raterId),
        message: 'Rating submitted successfully',
      };
    } catch (error) {
      logger.error('Failed to create rating', {
        action: 'RATING_CREATE_FAILED',
        raterId,
        bookingId: ratingData.bookingId,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  // ==================== Rating Updates ====================

  /**
   * Update an existing rating
   * @param {string} ratingId - Rating ID
   * @param {string} raterId - Rater user ID
   * @param {Object} updates - Rating updates
   * @returns {Promise<Object>} Updated rating
   */
  async updateRating(ratingId, raterId, updates) {
    logger.info('Updating rating', {
      action: RATING_EVENTS.RATING_UPDATED,
      ratingId,
      raterId,
    });

    try {
      const rating = await this.ratingRepository.findById(ratingId);
      if (!rating) {
        throw new NotFoundError('Rating not found', ERROR_CODES.RATING_NOT_FOUND);
      }

      if (rating.raterId !== raterId) {
        throw new ForbiddenError('Not authorized to update this rating', ERROR_CODES.FORBIDDEN);
      }

      // Check if edit window has expired (24 hours)
      const editDeadline = addDays(rating.createdAt, 1);
      if (isExpired(editDeadline)) {
        throw new BadRequestError(
          'Rating edit window has expired (24 hours)',
          ERROR_CODES.RATING_EDIT_EXPIRED,
        );
      }

      // Validate updates
      const allowedUpdates = ['score', 'comment', 'tags'];
      const filteredUpdates = allowedUpdates.reduce((acc, key) => {
        if (updates[key] !== undefined) {
          acc[key] = updates[key];
        }
        return acc;
      }, {});

      // Validate score if updated
      if (filteredUpdates.score !== undefined) {
        if (
          filteredUpdates.score < RATING_CONFIG.minRating ||
          filteredUpdates.score > RATING_CONFIG.maxRating
        ) {
          throw new ValidationError('Invalid rating score', [
            {
              field: 'score',
              message: `Score must be between ${RATING_CONFIG.minRating} and ${RATING_CONFIG.maxRating}`,
            },
          ]);
        }
      }

      // Validate tags if updated
      if (filteredUpdates.tags) {
        filteredUpdates.tags = this._validateTags(
          filteredUpdates.tags,
          rating.ratingType,
          filteredUpdates.score || rating.score,
        );
      }

      filteredUpdates.updatedAt = formatDate(now());

      const updatedRating = await this.ratingRepository.update(ratingId, filteredUpdates);

      // Recalculate average if score changed
      if (filteredUpdates.score !== undefined) {
        await this._updateUserAverageRating(rating.ratedUserId);
      }

      logger.info('Rating updated successfully', {
        action: RATING_EVENTS.RATING_UPDATED,
        ratingId,
      });

      return {
        rating: this._sanitizeRating(updatedRating, raterId),
        message: 'Rating updated successfully',
      };
    } catch (error) {
      logger.error('Failed to update rating', {
        action: 'RATING_UPDATE_FAILED',
        ratingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a rating
   * @param {string} ratingId - Rating ID
   * @param {string} raterId - Rater user ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteRating(ratingId, raterId) {
    logger.info('Deleting rating', {
      action: RATING_EVENTS.RATING_DELETED,
      ratingId,
      raterId,
    });

    try {
      const rating = await this.ratingRepository.findById(ratingId);
      if (!rating) {
        throw new NotFoundError('Rating not found', ERROR_CODES.RATING_NOT_FOUND);
      }

      if (rating.raterId !== raterId) {
        throw new ForbiddenError('Not authorized to delete this rating', ERROR_CODES.FORBIDDEN);
      }

      // Check if delete window has expired (24 hours)
      const deleteDeadline = addDays(rating.createdAt, 1);
      if (isExpired(deleteDeadline)) {
        throw new BadRequestError(
          'Rating delete window has expired (24 hours)',
          ERROR_CODES.RATING_DELETE_EXPIRED,
        );
      }

      await this.ratingRepository.delete(ratingId);

      // Recalculate average
      await this._updateUserAverageRating(rating.ratedUserId);

      logger.info('Rating deleted successfully', {
        action: RATING_EVENTS.RATING_DELETED,
        ratingId,
      });

      return {
        message: 'Rating deleted successfully',
      };
    } catch (error) {
      logger.error('Failed to delete rating', {
        action: 'RATING_DELETE_FAILED',
        ratingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Rating Retrieval ====================

  /**
   * Get rating by ID
   * @param {string} ratingId - Rating ID
   * @param {string} requesterId - Requesting user ID
   * @returns {Promise<Object>} Rating details
   */
  async getRatingById(ratingId, requesterId) {
    try {
      const rating = await this.ratingRepository.findById(ratingId);
      if (!rating) {
        throw new NotFoundError('Rating not found', ERROR_CODES.RATING_NOT_FOUND);
      }

      return this._sanitizeRating(rating, requesterId);
    } catch (error) {
      logger.error('Failed to get rating', {
        action: 'RATING_GET_FAILED',
        ratingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get ratings for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User ratings
   */
  async getUserRatings(userId, options = {}) {
    try {
      const {
        type, // 'received' or 'given'
        ratingType, // 'driver_rating' or 'passenger_rating'
        minScore,
        maxScore,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      let ratings;

      if (type === 'given') {
        ratings = await this.ratingRepository.findByRater(userId);
      } else {
        // Default to received ratings
        ratings = await this.ratingRepository.findByRatedUser(userId);
      }

      // Filter by rating type
      if (ratingType) {
        ratings = ratings.filter((r) => r.ratingType === ratingType);
      }

      // Filter by score range
      if (minScore !== undefined) {
        ratings = ratings.filter((r) => r.score >= minScore);
      }
      if (maxScore !== undefined) {
        ratings = ratings.filter((r) => r.score <= maxScore);
      }

      // Sort
      ratings = this._sortRatings(ratings, sortBy, sortOrder);

      // Calculate statistics
      const stats = this._calculateRatingStats(ratings);

      // Paginate
      const totalCount = ratings.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const paginatedRatings = ratings.slice(startIndex, startIndex + limit);

      // Sanitize ratings (hide anonymous rater info)
      const sanitizedRatings = paginatedRatings.map((r) => this._sanitizeRating(r, userId));

      return {
        ratings: sanitizedRatings,
        statistics: stats,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
        },
      };
    } catch (error) {
      logger.error('Failed to get user ratings', {
        action: 'USER_RATINGS_GET_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get ratings for a booking
   * @param {string} bookingId - Booking ID
   * @param {string} requesterId - Requesting user ID
   * @returns {Promise<Object>} Booking ratings
   */
  async getBookingRatings(bookingId, requesterId) {
    try {
      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found', ERROR_CODES.BOOKING_NOT_FOUND);
      }

      // Check authorization
      const isParticipant = [booking.passengerId, booking.driverId].includes(requesterId);
      if (!isParticipant) {
        throw new ForbiddenError('Not authorized to view these ratings', ERROR_CODES.FORBIDDEN);
      }

      const ratings = await this.ratingRepository.findByBooking(bookingId);

      const driverRating = ratings.find((r) => r.ratingType === RATING_TYPE.DRIVER_RATING);
      const passengerRating = ratings.find((r) => r.ratingType === RATING_TYPE.PASSENGER_RATING);

      return {
        driverRating: driverRating ? this._sanitizeRating(driverRating, requesterId) : null,
        passengerRating: passengerRating
          ? this._sanitizeRating(passengerRating, requesterId)
          : null,
        canRateDriver:
          !driverRating && booking.passengerId === requesterId && booking.status === 'completed',
        canRatePassenger:
          !passengerRating && booking.driverId === requesterId && booking.status === 'completed',
      };
    } catch (error) {
      logger.error('Failed to get booking ratings', {
        action: 'BOOKING_RATINGS_GET_FAILED',
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user's rating summary
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rating summary
   */
  async getUserRatingSummary(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      // Get all received ratings
      const ratings = await this.ratingRepository.findByRatedUser(userId);

      // Separate by type
      const driverRatings = ratings.filter((r) => r.ratingType === RATING_TYPE.DRIVER_RATING);
      const passengerRatings = ratings.filter((r) => r.ratingType === RATING_TYPE.PASSENGER_RATING);

      // Calculate stats for each type
      const driverStats = this._calculateRatingStats(driverRatings);
      const passengerStats = this._calculateRatingStats(passengerRatings);
      const overallStats = this._calculateRatingStats(ratings);

      // Get recent ratings
      const recentRatings = ratings
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((r) => this._sanitizeRating(r, userId));

      // Get top tags
      const topTags = this._getTopTags(ratings);

      return {
        overall: {
          averageRating: user.averageRating || overallStats.average,
          totalRatings: user.totalRatings || overallStats.count,
          ...overallStats,
        },
        asDriver: user.isDriver
          ? { averageRating: driverStats.average, totalRatings: driverStats.count, ...driverStats }
          : null,
        asPassenger: {
          averageRating: passengerStats.average,
          totalRatings: passengerStats.count,
          ...passengerStats,
        },
        recentRatings,
        topTags,
      };
    } catch (error) {
      logger.error('Failed to get rating summary', {
        action: 'RATING_SUMMARY_GET_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Rating Analysis ====================

  /**
   * Get rating analytics for admin
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Rating analytics
   */
  async getRatingAnalytics(options = {}) {
    try {
      const { startDate, endDate, ratingType } = options;

      let ratings = await this.ratingRepository.findAll();

      // Filter by date range
      if (startDate) {
        ratings = ratings.filter((r) => new Date(r.createdAt) >= new Date(startDate));
      }
      if (endDate) {
        ratings = ratings.filter((r) => new Date(r.createdAt) <= new Date(endDate));
      }

      // Filter by type
      if (ratingType) {
        ratings = ratings.filter((r) => r.ratingType === ratingType);
      }

      const stats = this._calculateRatingStats(ratings);
      const tagStats = this._getTagStatistics(ratings);
      const trendData = this._calculateRatingTrend(ratings);

      return {
        summary: stats,
        tagStatistics: tagStats,
        trend: trendData,
        totalRatings: ratings.length,
      };
    } catch (error) {
      logger.error('Failed to get rating analytics', {
        action: 'RATING_ANALYTICS_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get top rated users
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Top rated users
   */
  async getTopRatedUsers(options = {}) {
    try {
      const { type = 'driver', limit = 10, minRatings = 5 } = options;

      const ratingType =
        type === 'driver' ? RATING_TYPE.DRIVER_RATING : RATING_TYPE.PASSENGER_RATING;

      // This would typically be a database query with aggregation
      // Simplified implementation here
      const allRatings = await this.ratingRepository.findByType(ratingType);

      // Group by rated user
      const userRatings = allRatings.reduce((acc, rating) => {
        if (!acc[rating.ratedUserId]) {
          acc[rating.ratedUserId] = [];
        }
        acc[rating.ratedUserId].push(rating);
        return acc;
      }, {});

      // Calculate averages and filter by minimum ratings
      const userStats = Object.entries(userRatings)
        .filter(([, ratings]) => ratings.length >= minRatings)
        .map(([userId, ratings]) => ({
          userId,
          averageRating: ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length,
          totalRatings: ratings.length,
        }))
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, limit);

      // Enrich with user data
      const enrichedStats = await Promise.all(
        userStats.map(async (stat) => {
          const user = await this.userRepository.findById(stat.userId);
          return {
            ...stat,
            user: user
              ? {
                  firstName: user.firstName,
                  lastName: `${user.lastName.charAt(0)}.`,
                  profilePhoto: user.profilePhoto,
                }
              : null,
          };
        }),
      );

      return enrichedStats;
    } catch (error) {
      logger.error('Failed to get top rated users', {
        action: 'TOP_RATED_GET_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Unrated & Reliability ====================

  /**
   * Get bookings that the user has not yet rated
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Unrated bookings
   */
  async getUnratedBookings(userId) {
    try {
      // Get completed bookings for this user (as passenger or driver)
      const bookings = await this.bookingRepository.findByUser(userId);
      const completedBookings = bookings.filter((b) => b.status === 'completed');

      // Get ratings this user has given
      const ratingsGiven = await this.ratingRepository.findByRater(userId);
      const ratedBookingIds = new Set(ratingsGiven.map((r) => r.bookingId));

      // Filter to bookings not yet rated and still within rating window
      const unrated = completedBookings.filter((b) => {
        if (ratedBookingIds.has(b.bookingId)) return false;
        const deadline = addDays(b.completedAt, RATING_CONFIG.ratingWindowDays);
        return !isExpired(deadline);
      });

      return unrated.map((b) => ({
        bookingId: b.bookingId,
        bookingReference: b.bookingReference,
        rideId: b.rideId,
        completedAt: b.completedAt,
        ratingDeadline: formatDate(addDays(b.completedAt, RATING_CONFIG.ratingWindowDays)),
        role: b.passengerId === userId ? 'passenger' : 'driver',
      }));
    } catch (error) {
      logger.error('Failed to get unrated bookings', {
        action: 'UNRATED_BOOKINGS_GET_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get reliability score for a user based on rating history
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Reliability score and breakdown
   */
  async getReliabilityScore(userId) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      const ratingsReceived = await this.ratingRepository.findByRatedUser(userId);
      const visibleRatings = ratingsReceived.filter((r) => !r.isHidden);

      const totalRatings = visibleRatings.length;
      const averageScore =
        totalRatings > 0
          ? visibleRatings.reduce((sum, r) => sum + r.score, 0) / totalRatings
          : 0;

      // Reliability score: weighted combination of average rating and volume
      // Scale 0-100; more ratings increase confidence
      const confidenceMultiplier = Math.min(totalRatings / 10, 1); // Full confidence at 10+ ratings
      const reliabilityScore = Math.round(((averageScore / 5) * 100) * confidenceMultiplier);

      return {
        userId,
        reliabilityScore,
        averageRating: Math.round(averageScore * 10) / 10,
        totalRatings,
        confidenceLevel: totalRatings >= 10 ? 'high' : totalRatings >= 5 ? 'medium' : 'low',
      };
    } catch (error) {
      logger.error('Failed to get reliability score', {
        action: 'RELIABILITY_SCORE_GET_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Rating Moderation ====================

  /**
   * Report a rating (for moderation)
   * @param {string} ratingId - Rating ID
   * @param {string} reporterId - Reporter user ID
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} Report result
   */
  async reportRating(ratingId, reporterId, reportData) {
    logger.info('Rating reported', {
      action: 'RATING_REPORTED',
      ratingId,
      reporterId,
    });

    try {
      const rating = await this.ratingRepository.findById(ratingId);
      if (!rating) {
        throw new NotFoundError('Rating not found', ERROR_CODES.RATING_NOT_FOUND);
      }

      // Can only report ratings about yourself
      if (rating.ratedUserId !== reporterId) {
        throw new ForbiddenError('Can only report ratings about yourself', ERROR_CODES.FORBIDDEN);
      }

      const report = {
        reportId: randomUUID(),
        ratingId,
        reporterId,
        reason: reportData.reason,
        description: reportData.description,
        status: 'pending',
        createdAt: formatDate(now()),
      };

      await this.ratingRepository.addReport(report);

      // Flag the rating for review
      await this.ratingRepository.update(ratingId, {
        isReported: true,
        reportCount: (rating.reportCount || 0) + 1,
      });

      return {
        message: 'Rating reported successfully. Our team will review it.',
        reportId: report.reportId,
      };
    } catch (error) {
      logger.error('Failed to report rating', {
        action: 'RATING_REPORT_FAILED',
        ratingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Moderate a rating (admin only)
   * @param {string} ratingId - Rating ID
   * @param {string} adminId - Admin user ID
   * @param {Object} decision - Moderation decision
   * @returns {Promise<Object>} Moderation result
   */
  async moderateRating(ratingId, adminId, decision) {
    logger.info('Moderating rating', {
      action: 'RATING_MODERATED',
      ratingId,
      adminId,
      moderationAction: decision.action,
    });

    try {
      const rating = await this.ratingRepository.findById(ratingId);
      if (!rating) {
        throw new NotFoundError('Rating not found', ERROR_CODES.RATING_NOT_FOUND);
      }

      const { action, reason } = decision;

      if (action === 'remove') {
        // Hide the rating
        await this.ratingRepository.update(ratingId, {
          isHidden: true,
          hiddenBy: adminId,
          hiddenAt: formatDate(now()),
          hiddenReason: reason,
        });

        // Recalculate user's average
        await this._updateUserAverageRating(rating.ratedUserId);

        return { message: 'Rating hidden from public view' };
      }

      if (action === 'approve') {
        // Clear reports and approve
        await this.ratingRepository.update(ratingId, {
          isReported: false,
          isApproved: true,
          approvedBy: adminId,
          approvedAt: formatDate(now()),
        });

        return { message: 'Rating approved' };
      }

      throw new BadRequestError('Invalid moderation action', ERROR_CODES.INVALID_ACTION);
    } catch (error) {
      logger.error('Failed to moderate rating', {
        action: 'RATING_MODERATE_FAILED',
        ratingId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Update user's average rating
   * @private
   */
  async _updateUserAverageRating(userId) {
    try {
      const ratings = await this.ratingRepository.findByRatedUser(userId);

      // Filter out hidden ratings
      const visibleRatings = ratings.filter((r) => !r.isHidden);

      if (visibleRatings.length === 0) {
        await this.userRepository.updateProfile(userId, {
          averageRating: 0,
          totalRatings: 0,
        });
        return;
      }

      const totalScore = visibleRatings.reduce((sum, r) => sum + r.score, 0);
      const averageRating = Math.round((totalScore / visibleRatings.length) * 10) / 10;

      await this.userRepository.updateProfile(userId, {
        averageRating,
        totalRatings: visibleRatings.length,
      });

      logger.debug('Updated user average rating', {
        userId,
        averageRating,
        totalRatings: visibleRatings.length,
      });
    } catch (error) {
      logger.error('Failed to update user average rating', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Update booking with rating info
   * @private
   */
  async _updateBookingRating(bookingId, raterId, ratingType) {
    const updateField =
      ratingType === RATING_TYPE.DRIVER_RATING ? 'driverRatedAt' : 'passengerRatedAt';

    await this.bookingRepository.update(bookingId, {
      [updateField]: formatDate(now()),
    });
  }

  /**
   * Validate rating tags
   * @private
   */
  _validateTags(tags, ratingType, score) {
    if (!tags || tags.length === 0) return [];

    const isPositive = score >= 4;
    const tagCategory = ratingType === RATING_TYPE.DRIVER_RATING ? 'driver' : 'passenger';
    const validTagList = isPositive
      ? RATING_TAGS[tagCategory].positive
      : RATING_TAGS[tagCategory].negative;

    // Filter to only valid tags
    return tags.filter((tag) => validTagList.includes(tag));
  }

  /**
   * Sort ratings
   * @private
   */
  _sortRatings(ratings, sortBy, sortOrder) {
    const sortFunctions = {
      createdAt: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      score: (a, b) => a.score - b.score,
    };

    const sortFn = sortFunctions[sortBy] || sortFunctions.createdAt;
    const sorted = [...ratings].sort(sortFn);

    return sortOrder === 'desc' ? sorted.reverse() : sorted;
  }

  /**
   * Calculate rating statistics
   * @private
   */
  _calculateRatingStats(ratings) {
    if (ratings.length === 0) {
      return {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const totalScore = ratings.reduce((sum, r) => sum + r.score, 0);
    const average = Math.round((totalScore / ratings.length) * 10) / 10;

    // Calculate distribution
    const distribution = ratings.reduce(
      (acc, rating) => {
        acc[rating.score] += acc[rating.score];
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    );

    // Calculate percentages
    const distributionPercent = [5, 4, 3, 2, 1].reduce((acc, score) => {
      acc[score] = Math.round((distribution[score] / ratings.length) * 100);
      return acc;
    }, {});

    return {
      average,
      count: ratings.length,
      distribution,
      distributionPercent,
    };
  }

  /**
   * Get top tags from ratings
   * @private
   */
  _getTopTags(ratings, limit = 5) {
    const tagCounts = ratings.reduce((acc, rating) => {
      if (rating.tags) {
        rating.tags.forEach((tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
      }
      return acc;
    }, {});

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * Get tag statistics
   * @private
   */
  _getTagStatistics(ratings) {
    return ratings.reduce(
      (acc, rating) => {
        if (!rating.tags) return acc;

        const isPositive = rating.score >= 4;
        const target = isPositive ? acc.positive : acc.negative;

        rating.tags.forEach((tag) => {
          target[tag] = (target[tag] || 0) + 1;
        });

        return acc;
      },
      { positive: {}, negative: {} },
    );
  }

  /**
   * Calculate rating trend over time
   * @private
   */
  _calculateRatingTrend(ratings) {
    // Group by month
    const monthlyData = ratings.reduce((acc, rating) => {
      const month = rating.createdAt.substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { total: 0, count: 0 };
      }
      acc[month].total += rating.score;
      acc[month].count += acc[month].count;
      return acc;
    }, {});

    // Calculate averages
    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        average: Math.round((data.total / data.count) * 10) / 10,
        count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Sanitize rating for response
   * @private
   */
  _sanitizeRating(rating, requesterId) {
    const sanitized = { ...rating };

    // Handle anonymous ratings
    if (rating.isAnonymous && rating.raterId !== requesterId) {
      sanitized.raterId = null;
      sanitized.raterName = 'Anonymous';
    }

    // Hide hidden ratings from non-admins
    if (rating.isHidden) {
      sanitized.comment = '[This review has been hidden]';
      sanitized.tags = [];
    }

    return sanitized;
  }
}

module.exports = RatingService;
