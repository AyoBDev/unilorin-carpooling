/**
 * Rating Repository
 * Path: src/infrastructure/database/repositories/RatingRepository.js
 *
 * Handles all rating-related database operations
 */

const { nanoid } = require('nanoid');
const dayjs = require('dayjs');
const logger = require('@shared/utils/logger');
const { AppError } = require('@shared/errors/AppError');
const BaseRepository = require('./BaseRepository');

class RatingRepository extends BaseRepository {
  constructor() {
    super('Rating');
  }

  /**
   * Create a new rating
   * @param {Object} ratingData - Rating data
   * @returns {Promise<Object>} Created rating
   */
  async create(ratingData) {
    const ratingId = ratingData.id || `RATING#${nanoid()}`;
    const timestamp = new Date().toISOString();

    // Main rating record
    const ratingItem = {
      PK: ratingId,
      SK: 'DETAILS',
      ...ratingData,
      id: ratingId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // User's given rating (ratings they gave)
    const givenRatingItem = {
      PK: `USER#${ratingData.raterId}`,
      SK: `RATING_GIVEN#${timestamp}#${ratingId}`,
      ...ratingData,
      id: ratingId,
      EntityType: 'RatingGiven',
    };

    // User's received rating (ratings they received)
    const receivedRatingItem = {
      PK: `USER#${ratingData.ratedUserId}`,
      SK: `RATING_RECEIVED#${timestamp}#${ratingId}`,
      ...ratingData,
      id: ratingId,
      EntityType: 'RatingReceived',
    };

    // Booking's rating
    const bookingRatingItem = {
      PK: `BOOKING#${ratingData.bookingId}`,
      SK: `RATING#${ratingData.ratingType}#${ratingId}`,
      ...ratingData,
      id: ratingId,
      EntityType: 'BookingRating',
    };

    // GSI attributes
    ratingItem.GSI1PK = `USER_RATING#${ratingData.ratedUserId}`;
    ratingItem.GSI1SK = timestamp;
    ratingItem.GSI2PK = `RATING_TYPE#${ratingData.ratingType}`;
    ratingItem.GSI2SK = `SCORE#${ratingData.score}#${timestamp}`;

    // Use transaction to create all records
    const transactItems = [
      {
        Put: {
          TableName: this.tableName,
          Item: ratingItem,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: givenRatingItem,
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: receivedRatingItem,
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: bookingRatingItem,
        },
      },
    ];

    await this.transactWrite(transactItems);

    // Update user's average rating
    await this.updateUserAverageRating(ratingData.ratedUserId);

    logger.info('Rating created', {
      ratingId,
      bookingId: ratingData.bookingId,
      raterId: ratingData.raterId,
    });

    return ratingItem;
  }

  /**
   * Get rating by ID
   * @param {string} ratingId - Rating ID
   * @returns {Promise<Object|null>} Rating or null
   */
  async findById(ratingId) {
    const pk = ratingId.startsWith('RATING#') ? ratingId : `RATING#${ratingId}`;
    return super.get(pk, 'DETAILS');
  }

  /**
   * Get rating by booking and type
   * @param {string} bookingId - Booking ID
   * @param {string} ratingType - 'driver' or 'passenger'
   * @returns {Promise<Object|null>} Rating or null
   */
  async findByBookingAndType(bookingId, ratingType) {
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BOOKING#${bookingId}`,
        ':skPrefix': `RATING#${ratingType}`,
      },
      Limit: 1,
    };

    const result = await this.query(params);
    return result.items[0] || null;
  }

  /**
   * Get user's received ratings
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Ratings
   */
  async getUserReceivedRatings(userId, options = {}) {
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'RATING_RECEIVED#',
      },
      ScanIndexForward: false, // Most recent first
      Limit: options.limit || 50,
    };

    if (options.minScore) {
      params.FilterExpression = 'score >= :minScore';
      params.ExpressionAttributeValues[':minScore'] = options.minScore;
    }

    const result = await this.query(params);
    return result.items;
  }

  /**
   * Get user's given ratings
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Ratings
   */
  async getUserGivenRatings(userId, options = {}) {
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'RATING_GIVEN#',
      },
      ScanIndexForward: false,
      Limit: options.limit || 50,
    };

    const result = await this.query(params);
    return result.items;
  }

  /**
   * Calculate user's average rating
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rating statistics
   */
  async calculateUserRating(userId) {
    const ratings = await this.getUserReceivedRatings(userId);

    if (ratings.length === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;

    ratings.forEach(({ score }) => {
      totalScore += score;
      distribution[score] = (distribution[score] || 0) + 1;
    });

    return {
      averageRating: (totalScore / ratings.length).toFixed(1),
      totalRatings: ratings.length,
      distribution,
      recentRatings: ratings.slice(0, 5),
    };
  }

  /**
   * Update user's average rating
   * @private
   * @param {string} userId - User ID
   */
  async updateUserAverageRating(userId) {
    try {
      const stats = await this.calculateUserRating(userId);

      // TODO: Update user profile with new average when UserRepository is available
      // For now, just log the stats
      logger.debug('User average rating calculated', { userId, stats });
    } catch (error) {
      logger.error('Failed to calculate user average rating', { error, userId });
    }
  }

  /**
   * Get ratings by type
   * @param {string} ratingType - 'driver' or 'passenger'
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Ratings and pagination
   */
  async getRatingsByType(ratingType, options = {}) {
    const params = {
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :type',
      ExpressionAttributeValues: {
        ':type': `RATING_TYPE#${ratingType}`,
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };

    if (options.minScore) {
      params.KeyConditionExpression += ' AND GSI2SK >= :minScore';
      params.ExpressionAttributeValues[':minScore'] = `SCORE#${options.minScore}`;
    }

    if (options.lastKey) {
      params.ExclusiveStartKey = options.lastKey;
    }

    return this.query(params);
  }

  /**
   * Check if user can rate booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} ratingType - 'driver' or 'passenger'
   * @returns {Promise<boolean>} Can rate
   */
  async canUserRate(bookingId, userId, ratingType) {
    // Check if rating already exists
    const existingRating = await this.findByBookingAndType(bookingId, ratingType);
    if (existingRating) {
      return false;
    }

    // TODO: Implement booking status check when BookingRepository is available
    // For now, allow rating if no existing rating found
    return true;
  }

  /**
   * Get top-rated users
   * @param {string} userType - 'driver' or 'all'
   * @param {number} limit - Number of users to return
   * @returns {Promise<Array>} Top-rated users
   */
  async getTopRatedUsers(userType = 'all', limit = 10) {
    // This would require maintaining a leaderboard GSI
    // For now, scan and sort (not efficient for production)
    const params = {
      FilterExpression: 'averageRating >= :minRating',
      ExpressionAttributeValues: {
        ':minRating': 4.0,
      },
      Limit: limit * 2, // Get more to account for filtering
    };

    if (userType === 'driver') {
      params.FilterExpression += ' AND isDriver = :isDriver';
      params.ExpressionAttributeValues[':isDriver'] = true;
    }

    const result = await this.scan(params);

    // Sort by average rating
    const sorted = result.items
      .filter((item) => item.SK === 'PROFILE' && item.averageRating)
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit);

    return sorted;
  }

  /**
   * Get rating statistics for analytics
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Statistics
   */
  async getRatingStatistics(options = {}) {
    const { startDate, endDate, ratingType } = options;

    const params = {
      FilterExpression: 'SK = :details',
      ExpressionAttributeValues: {
        ':details': 'DETAILS',
      },
    };

    if (startDate && endDate) {
      params.FilterExpression += ' AND createdAt BETWEEN :startDate AND :endDate';
      params.ExpressionAttributeValues[':startDate'] = startDate;
      params.ExpressionAttributeValues[':endDate'] = endDate;
    }

    if (ratingType) {
      params.FilterExpression += ' AND ratingType = :ratingType';
      params.ExpressionAttributeValues[':ratingType'] = ratingType;
    }

    const result = await this.scan(params);
    const ratings = result.items;

    // Calculate statistics
    const stats = {
      totalRatings: ratings.length,
      averageScore: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      withComments: 0,
      byType: { driver: 0, passenger: 0 },
    };

    if (ratings.length === 0) {
      return stats;
    }

    let totalScore = 0;
    ratings.forEach((rating) => {
      totalScore += rating.score;
      stats.distribution[rating.score] += 1;
      if (rating.comment) stats.withComments += 1;
      stats.byType[rating.ratingType] += 1;
    });

    stats.averageScore = (totalScore / ratings.length).toFixed(2);

    return stats;
  }

  /**
   * Get recent reviews with comments
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Recent reviews
   */
  async getRecentReviews(options = {}) {
    const params = {
      FilterExpression: 'SK = :details AND attribute_exists(comments)',
      ExpressionAttributeValues: {
        ':details': 'DETAILS',
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };

    if (options.minScore) {
      params.FilterExpression += ' AND score >= :minScore';
      params.ExpressionAttributeValues[':minScore'] = options.minScore;
    }

    const result = await this.scan(params);

    // Sort by date
    return result.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

module.exports = RatingRepository;
