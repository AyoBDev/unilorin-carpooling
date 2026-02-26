/**
 * Rating Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles the dual rating system where passengers rate drivers
 * and drivers rate passengers. Includes rating analytics,
 * reliability scores, and reporting.
 *
 * Path: src/api/controllers/RatingController.js
 *
 * @module controllers/RatingController
 */

const { RatingService } = require('../../core/services');
const { success, created, paginated } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class RatingController {
  constructor() {
    this.ratingService = new RatingService();

    this.createRating = this.createRating.bind(this);
    this.getRating = this.getRating.bind(this);
    this.updateRating = this.updateRating.bind(this);
    this.getUserRatings = this.getUserRatings.bind(this);
    this.getMyRatingsGiven = this.getMyRatingsGiven.bind(this);
    this.getMyRatingsReceived = this.getMyRatingsReceived.bind(this);
    this.getRatingAnalytics = this.getRatingAnalytics.bind(this);
    this.getUnratedBookings = this.getUnratedBookings.bind(this);
    this.reportRating = this.reportRating.bind(this);
    this.getReliabilityScore = this.getReliabilityScore.bind(this);
  }

  /**
   * Create a rating for a completed booking
   * POST /api/v1/ratings
   */
  async createRating(req, res, next) {
    try {
      const raterId = req.user.userId;
      const { bookingId, score, comment, ratingType } = req.body;

      const rating = await this.ratingService.createRating(raterId, {
        bookingId,
        score,
        comment,
        ratingType, // 'driver_rating' or 'passenger_rating'
      });

      logger.info('Rating created', {
        raterId,
        bookingId,
        ratingId: rating.ratingId,
        score,
      });

      return created(res, 'Rating submitted successfully. Thank you for your feedback!', {
        rating,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a specific rating
   * GET /api/v1/ratings/:ratingId
   */
  async getRating(req, res, next) {
    try {
      const { ratingId } = req.params;

      const rating = await this.ratingService.getRatingById(ratingId);

      return success(res, 'Rating retrieved', { rating });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update a rating (within allowed time window)
   * PUT /api/v1/ratings/:ratingId
   */
  async updateRating(req, res, next) {
    try {
      const { ratingId } = req.params;
      const raterId = req.user.userId;
      const { score, comment } = req.body;

      const rating = await this.ratingService.updateRating(ratingId, raterId, {
        score,
        comment,
      });

      return success(res, 'Rating updated', { rating });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get ratings for a specific user (public profile view)
   * GET /api/v1/ratings/user/:userId
   */
  async getUserRatings(req, res, next) {
    try {
      const { userId } = req.params;
      const {
        ratingType, // 'driver_rating' or 'passenger_rating'
        page = 1,
        limit = 20,
      } = req.query;

      const result = await this.ratingService.getUserRatings(userId, {
        ratingType,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'User ratings retrieved', result.ratings, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get ratings I've given
   * GET /api/v1/ratings/given
   */
  async getMyRatingsGiven(req, res, next) {
    try {
      const { userId } = req.user;
      const { page = 1, limit = 20 } = req.query;

      const result = await this.ratingService.getRatingsGiven(userId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, "Ratings you've given", result.ratings, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get ratings I've received
   * GET /api/v1/ratings/received
   */
  async getMyRatingsReceived(req, res, next) {
    try {
      const { userId } = req.user;
      const { ratingType, page = 1, limit = 20 } = req.query;

      const result = await this.ratingService.getRatingsReceived(userId, {
        ratingType,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Ratings received', result.ratings, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get rating analytics for a user
   * GET /api/v1/ratings/analytics
   */
  async getRatingAnalytics(req, res, next) {
    try {
      const { userId } = req.user;

      const analytics = await this.ratingService.getRatingAnalytics(userId);

      return success(res, 'Rating analytics', { analytics });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get bookings that haven't been rated yet
   * GET /api/v1/ratings/unrated
   */
  async getUnratedBookings(req, res, next) {
    try {
      const { userId } = req.user;

      const unrated = await this.ratingService.getUnratedBookings(userId);

      return success(res, 'Unrated bookings', { bookings: unrated });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Report an inappropriate rating
   * POST /api/v1/ratings/:ratingId/report
   */
  async reportRating(req, res, next) {
    try {
      const { ratingId } = req.params;
      const reporterId = req.user.userId;
      const { reason, details } = req.body;

      await this.ratingService.reportRating(ratingId, reporterId, { reason, details });

      logger.info('Rating reported', { reporterId, ratingId, reason });

      return success(res, 'Rating reported. Our team will review it.');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's reliability score
   * GET /api/v1/ratings/reliability/:userId
   */
  async getReliabilityScore(req, res, next) {
    try {
      const { userId } = req.params;

      const reliability = await this.ratingService.getReliabilityScore(userId);

      return success(res, 'Reliability score', { reliability });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new RatingController();
