/**
 * Safety Repository
 * Path: src/infrastructure/database/repositories/SafetyRepository.js
 *
 * Handles all safety-related database operations including SOS alerts,
 * tracking sessions, and location shares
 */

'use strict';

const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const BaseRepository = require('./BaseRepository');
const { logger } = require('../../../shared/utils/logger');

class SafetyRepository extends BaseRepository {
  constructor() {
    super('SOS_ALERT');
  }

  /**
   * Create an SOS alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Created alert
   */
  async createAlert(alertData) {
    const item = {
      PK: `USER#${alertData.userId}`,
      SK: `SOS#${alertData.alertId}`,
      GSI1PK: `SOS#STATUS#${alertData.status}`,
      GSI1SK: alertData.triggeredAt,
      EntityType: 'SOS_ALERT',
      ...alertData,
    };

    if (alertData.expiresAt) {
      item.TTL = Math.floor(new Date(alertData.expiresAt).getTime() / 1000) + 86400 * 7;
    }

    await this.create(item, { preventOverwrite: true });
    return alertData;
  }

  /**
   * Get alert by ID
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Alert or null
   */
  async getAlert(alertId, userId) {
    return this.get(`USER#${userId}`, `SOS#${alertId}`);
  }

  /**
   * Get alerts by user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async getAlertsByUser(userId, options = {}) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'SOS#',
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };
    if (options.lastKey) params.ExclusiveStartKey = options.lastKey;
    return this.query(params);
  }

  /**
   * Get alerts by status
   * @param {string} status - Alert status
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query results
   */
  async getAlertsByStatus(status, options = {}) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `SOS#STATUS#${status}`,
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };
    if (options.lastKey) params.ExclusiveStartKey = options.lastKey;
    return this.query(params);
  }

  /**
   * Update alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated alert
   */
  async updateAlert(alertId, userId, updates) {
    const newUpdates = { ...updates };
    if (updates.status) {
      newUpdates.GSI1PK = `SOS#STATUS#${updates.status}`;
    }
    return this.update(`USER#${userId}`, `SOS#${alertId}`, newUpdates);
  }

  /**
   * Create tracking session
   * @param {Object} sessionData - Session data
   * @returns {Promise<Object>} Created session
   */
  async createTrackingSession(sessionData) {
    const timestamp = new Date().toISOString();
    const item = {
      PK: `BOOKING#${sessionData.bookingId}`,
      SK: `TRACKING#${sessionData.sessionId}`,
      GSI1PK: 'TRACKING#ACTIVE',
      GSI1SK: sessionData.startedAt,
      GSI2PK: `SESSION#${sessionData.sessionId}`,
      GSI2SK: 'TRACKING',
      EntityType: 'SAFETY_SESSION',
      ...sessionData,
      locations: sessionData.locations || [],
      createdAt: sessionData.createdAt || timestamp,
      updatedAt: sessionData.updatedAt || timestamp,
    };

    const params = {
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    };

    await this.docClient.send(new PutCommand(params));
    logger.debug('Tracking session created', {
      sessionId: sessionData.sessionId,
      bookingId: sessionData.bookingId,
    });
    return sessionData;
  }

  /**
   * Get tracking session
   * @param {string} sessionId - Session ID
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object|null>} Session or null
   */
  async getTrackingSession(sessionId, bookingId) {
    return this.get(`BOOKING#${bookingId}`, `TRACKING#${sessionId}`);
  }

  /**
   * Get tracking session by session ID only (using GSI2)
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session or null
   */
  async getTrackingSessionBySessionId(sessionId) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk',
      ExpressionAttributeValues: {
        ':gsi2pk': `SESSION#${sessionId}`,
      },
      Limit: 1,
    };
    const result = await this.query(params);
    return result.items[0] || null;
  }

  /**
   * Update tracking session
   * @param {string} sessionId - Session ID
   * @param {string} bookingId - Booking ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated session
   */
  async updateTrackingSession(sessionId, bookingId, updates) {
    if (updates.status && updates.status !== 'active') {
      updates.GSI1PK = `TRACKING#${updates.status.toUpperCase()}`;
    }
    return this.update(`BOOKING#${bookingId}`, `TRACKING#${sessionId}`, updates);
  }

  /**
   * Create location share
   * @param {Object} shareData - Share data
   * @returns {Promise<Object>} Created share
   */
  async createLocationShare(shareData) {
    const timestamp = new Date().toISOString();
    const item = {
      PK: `SHARE#${shareData.shareToken}`,
      SK: 'LOCATION',
      GSI1PK: `USER#${shareData.userId}`,
      GSI1SK: `LOCSHARE#${shareData.startedAt || timestamp}`,
      EntityType: 'LOCATION_SHARE',
      ...shareData,
      createdAt: shareData.createdAt || timestamp,
      updatedAt: shareData.updatedAt || timestamp,
    };

    const params = {
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    };

    await this.docClient.send(new PutCommand(params));
    logger.debug('Location share created', {
      shareToken: shareData.shareToken,
      userId: shareData.userId,
    });
    return shareData;
  }

  /**
   * Get location share by token
   * @param {string} shareToken - Share token
   * @returns {Promise<Object|null>} Share or null
   */
  async getLocationShare(shareToken) {
    return this.get(`SHARE#${shareToken}`, 'LOCATION');
  }

  /**
   * Update location share
   * @param {string} shareToken - Share token
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated share
   */
  async updateLocationShare(shareToken, updates) {
    return this.update(`SHARE#${shareToken}`, 'LOCATION', updates);
  }

  /**
   * Get active sessions by ride
   * @param {string} rideId - Ride ID
   * @returns {Promise<Object>} Query results
   */
  async getActiveSessionsByRide(rideId) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BOOKING#${rideId}`,
        ':skPrefix': 'TRACKING#',
      },
    };
    return this.query(params);
  }
}

module.exports = SafetyRepository;
