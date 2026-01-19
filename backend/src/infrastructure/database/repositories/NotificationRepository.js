/**
 * Notification Repository
 * Path: src/infrastructure/database/repositories/NotificationRepository.js
 *
 * Handles all notification-related database operations
 */

const { nanoid } = require('nanoid');
const dayjs = require('dayjs');

const BaseRepository = require('./BaseRepository');

class NotificationRepository extends BaseRepository {
  constructor() {
    super('Notification');
  }

  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async create(notificationData) {
    const notificationId = notificationData.id || `NOTIF#${nanoid()}`;
    const timestamp = new Date().toISOString();

    const item = {
      PK: `USER#${notificationData.userId}`,
      SK: `NOTIFICATION#${timestamp}#${notificationId}`,
      ...notificationData,
      id: notificationId,
      isRead: false,
      createdAt: timestamp,

      // GSI for unread notifications
      ...(notificationData.isRead === false && {
        GSI1PK: `USER_UNREAD#${notificationData.userId}`,
        GSI1SK: timestamp,
      }),

      // GSI for notification type
      GSI2PK: `NOTIF_TYPE#${notificationData.type}`,
      GSI2SK: timestamp,
    };

    await super.create(item);

    return item;
  }

  /**
   * Get user notifications
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications and pagination
   */
  async getUserNotifications(userId, options = {}) {
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'NOTIFICATION#',
      },
      ScanIndexForward: false, // Most recent first
      Limit: options.limit || 20,
    };

    if (options.unreadOnly) {
      params.FilterExpression = 'isRead = :isRead';
      params.ExpressionAttributeValues[':isRead'] = false;
    }

    if (options.type) {
      params.FilterExpression = params.FilterExpression
        ? `${params.FilterExpression} AND #type = :type`
        : '#type = :type';
      params.ExpressionAttributeNames = { '#type': 'type' };
      params.ExpressionAttributeValues[':type'] = options.type;
    }

    if (options.lastKey) {
      params.ExclusiveStartKey = options.lastKey;
    }

    return this.query(params);
  }

  /**
   * Get unread notifications count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    const params = {
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER_UNREAD#${userId}`,
      },
      Select: 'COUNT',
    };

    const result = await this.query(params);
    return result.count || 0;
  }

  /**
   * Mark notification as read
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(userId, notificationId) {
    // Find the notification first to get the SK
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'NOTIFICATION#',
        ':notifId': notificationId,
      },
      FilterExpression: 'id = :notifId',
    };

    const result = await this.query(params);
    const notification = result.items[0];

    if (!notification) {
      throw new Error('Notification not found');
    }

    // Update the notification
    const updates = {
      isRead: true,
      readAt: new Date().toISOString(),
      GSI1PK: null, // Remove from unread index
      GSI1SK: null,
    };

    return super.update(notification.PK, notification.SK, updates);
  }

  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications marked
   */
  async markAllAsRead(userId) {
    // Get all unread notifications
    const params = {
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER_UNREAD#${userId}`,
      },
    };

    const result = await this.query(params);
    const notifications = result.items;

    if (notifications.length === 0) {
      return 0;
    }

    // Update each notification
    const updatePromises = notifications.map((notif) => this.markAsRead(userId, notif.id));

    await Promise.all(updatePromises);

    return notifications.length;
  }

  /**
   * Delete old notifications
   * @param {string} userId - User ID
   * @param {number} daysOld - Delete notifications older than this
   * @returns {Promise<number>} Number deleted
   */
  async deleteOldNotifications(userId, daysOld = 30) {
    const cutoffDate = dayjs().subtract(daysOld, 'days').toISOString();

    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'NOTIFICATION#',
        ':cutoff': cutoffDate,
      },
      FilterExpression: 'createdAt < :cutoff',
    };

    const result = await this.query(params);
    const oldNotifications = result.items;

    if (oldNotifications.length === 0) {
      return 0;
    }

    // Delete each old notification
    const deletePromises = oldNotifications.map((notif) => super.delete(notif.PK, notif.SK));

    await Promise.all(deletePromises);

    return oldNotifications.length;
  }

  /**
   * Create bulk notifications
   * @param {Array} notifications - Array of notification data
   * @returns {Promise<boolean>} Success status
   */
  async createBulk(notifications) {
    const items = notifications.map((notif) => {
      const notificationId = notif.id || `NOTIF#${nanoid()}`;
      const timestamp = new Date().toISOString();

      return {
        PK: `USER#${notif.userId}`,
        SK: `NOTIFICATION#${timestamp}#${notificationId}`,
        ...notif,
        id: notificationId,
        isRead: false,
        createdAt: timestamp,
        GSI1PK: `USER_UNREAD#${notif.userId}`,
        GSI1SK: timestamp,
        GSI2PK: `NOTIF_TYPE#${notif.type}`,
        GSI2SK: timestamp,
      };
    });

    return this.batchWrite(items);
  }

  /**
   * Get notification statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getUserNotificationStats(userId) {
    const allNotifs = await this.getUserNotifications(userId, { limit: 100 });
    const unreadCount = await this.getUnreadCount(userId);

    const byType = {};
    allNotifs.items.forEach((notif) => {
      byType[notif.type] = (byType[notif.type] || 0) + 1;
    });

    return {
      total: allNotifs.items.length,
      unread: unreadCount,
      read: allNotifs.items.length - unreadCount,
      byType,
      oldestUnread: allNotifs.items.find((n) => !n.isRead)?.createdAt,
    };
  }

  /**
   * Get system-wide notifications (admin broadcasts)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} System notifications
   */
  async getSystemNotifications(options = {}) {
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'SYSTEM#BROADCAST',
        ':skPrefix': 'NOTIFICATION#',
      },
      ScanIndexForward: false,
      Limit: options.limit || 10,
    };

    const result = await this.query(params);
    return result.items;
  }

  /**
   * Create system broadcast notification
   * @param {Object} broadcastData - Broadcast notification data
   * @returns {Promise<Object>} Created broadcast
   */
  async createSystemBroadcast(broadcastData) {
    const notificationId = `BROADCAST#${nanoid()}`;
    const timestamp = new Date().toISOString();

    const item = {
      PK: 'SYSTEM#BROADCAST',
      SK: `NOTIFICATION#${timestamp}#${notificationId}`,
      ...broadcastData,
      id: notificationId,
      type: 'system_broadcast',
      createdAt: timestamp,
    };

    await super.create(item);

    return item;
  }
}

module.exports = NotificationRepository;
