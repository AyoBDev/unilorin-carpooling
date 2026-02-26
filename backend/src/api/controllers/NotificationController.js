/**
 * Notification Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles in-app notifications, notification preferences,
 * mark-as-read, and notification history. Multi-channel
 * notifications (email, SMS, push) are triggered internally
 * by other services — this controller manages the in-app view.
 *
 * Path: src/api/controllers/NotificationController.js
 *
 * @module controllers/NotificationController
 */

const { NotificationService } = require('../../core/services');
const { success, paginated } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();

    this.getNotifications = this.getNotifications.bind(this);
    this.getUnreadCount = this.getUnreadCount.bind(this);
    this.getNotification = this.getNotification.bind(this);
    this.markAsRead = this.markAsRead.bind(this);
    this.markAllAsRead = this.markAllAsRead.bind(this);
    this.deleteNotification = this.deleteNotification.bind(this);
    this.getPreferences = this.getPreferences.bind(this);
    this.updatePreferences = this.updatePreferences.bind(this);

    // Admin routes
    this.adminSendNotification = this.adminSendNotification.bind(this);
    this.adminSendBulkNotification = this.adminSendBulkNotification.bind(this);
  }

  /**
   * Get user's notifications
   * GET /api/v1/notifications
   */
  async getNotifications(req, res, next) {
    try {
      const { userId } = req.user;
      const {
        type, // 'booking', 'ride', 'system', 'safety'
        isRead,
        page = 1,
        limit = 20,
      } = req.query;

      let isReadValue;
      if (isRead === 'true') {
        isReadValue = true;
      } else if (isRead === 'false') {
        isReadValue = false;
      }

      const result = await this.notificationService.getNotifications(userId, {
        category: type,
        unreadOnly: isReadValue === false,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Notifications retrieved', result.notifications, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(req, res, next) {
    try {
      const { userId } = req.user;

      const result = await this.notificationService.getUnreadCount(userId);

      return success(res, 'Unread count', { unreadCount: result.unreadCount });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a specific notification
   * GET /api/v1/notifications/:notificationId
   */
  async getNotification(req, res, next) {
    try {
      const { notificationId } = req.params;
      const { userId } = req.user;

      const notification = await this.notificationService.getNotificationById(
        notificationId,
        userId,
      );

      return success(res, 'Notification retrieved', { notification });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Mark a notification as read
   * PATCH /api/v1/notifications/:notificationId/read
   */
  async markAsRead(req, res, next) {
    try {
      const { notificationId } = req.params;
      const { userId } = req.user;

      await this.notificationService.markAsRead(notificationId, userId);

      return success(res, 'Notification marked as read');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/v1/notifications/read-all
   */
  async markAllAsRead(req, res, next) {
    try {
      const { userId } = req.user;

      const result = await this.notificationService.markAllAsRead(userId);

      return success(res, `${result.updatedCount} notifications marked as read`, {
        updatedCount: result.updatedCount,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete a notification
   * DELETE /api/v1/notifications/:notificationId
   */
  async deleteNotification(req, res, next) {
    try {
      const { notificationId } = req.params;
      const { userId } = req.user;

      await this.notificationService.deleteNotification(notificationId, userId);

      return success(res, 'Notification deleted');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get notification preferences
   * GET /api/v1/notifications/preferences
   */
  async getPreferences(req, res, next) {
    try {
      const { userId } = req.user;

      const preferences = await this.notificationService.getPreferences(userId);

      return success(res, 'Notification preferences', { preferences });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update notification preferences
   * PUT /api/v1/notifications/preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const { userId } = req.user;

      const preferences = await this.notificationService.updatePreferences(userId, req.body);

      return success(res, 'Preferences updated', { preferences });
    } catch (error) {
      return next(error);
    }
  }

  // ─── ADMIN ───────────────────────────────────────────────────

  /**
   * Admin: Send a notification to a specific user
   * POST /api/v1/admin/notifications/send
   */
  async adminSendNotification(req, res, next) {
    try {
      const adminId = req.user.userId;
      const { userId, title, message, type = 'system', channels = ['in_app'] } = req.body;

      await this.notificationService.sendNotification(userId, {
        title,
        message,
        type,
        channels,
        metadata: { sentBy: adminId },
      });

      logger.info('Admin sent notification', { adminId, targetUserId: userId, type });

      return success(res, 'Notification sent');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Send bulk notification
   * POST /api/v1/admin/notifications/send-bulk
   */
  async adminSendBulkNotification(req, res, next) {
    try {
      const adminId = req.user.userId;
      const { title, message, type = 'system', channels = ['in_app'], filters } = req.body;

      const result = await this.notificationService.sendAdminBulkNotification({
        title,
        message,
        type,
        channels,
        filters, // { role, isDriver, isVerified }
        metadata: { sentBy: adminId },
      });

      logger.info('Admin sent bulk notification', {
        adminId,
        recipientCount: result.recipientCount,
      });

      return success(res, `Notification sent to ${result.recipientCount} users`, {
        recipientCount: result.recipientCount,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new NotificationController();
