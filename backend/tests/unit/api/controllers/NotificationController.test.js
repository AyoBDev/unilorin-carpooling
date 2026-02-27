/**
 * NotificationController Unit Tests
 */

const mockService = {
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  getNotificationById: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  sendNotification: jest.fn(),
  sendAdminBulkNotification: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  NotificationService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  paginated: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/NotificationController');
const { success, paginated } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext } = require('../../../helpers/mockFactory');

describe('NotificationController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── getNotifications ──────────────────────────────────
  describe('getNotifications', () => {
    it('should get notifications and call paginated', async () => {
      const result = { notifications: [], pagination: { page: 1, total: 0 } };
      mockService.getNotifications.mockResolvedValue(result);
      req = createMockReq({
        user: { userId: 'u1' },
        query: { type: 'booking', isRead: 'false', page: '2', limit: '10' },
      });

      await controller.getNotifications(req, res, next);

      expect(mockService.getNotifications).toHaveBeenCalledWith('u1', {
        category: 'booking',
        unreadOnly: true,
        page: 2,
        limit: 10,
      });
      expect(paginated).toHaveBeenCalledWith(res, 'Notifications retrieved', result.notifications, result.pagination);
      expect(next).not.toHaveBeenCalled();
    });

    it('should set unreadOnly=false when isRead=true', async () => {
      const result = { notifications: [], pagination: {} };
      mockService.getNotifications.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { isRead: 'true' } });

      await controller.getNotifications(req, res, next);

      expect(mockService.getNotifications).toHaveBeenCalledWith('u1', expect.objectContaining({
        unreadOnly: false,
      }));
    });

    it('should handle missing isRead (unreadOnly=false)', async () => {
      const result = { notifications: [], pagination: {} };
      mockService.getNotifications.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getNotifications(req, res, next);

      expect(mockService.getNotifications).toHaveBeenCalledWith('u1', expect.objectContaining({
        unreadOnly: false,
      }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getNotifications.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getNotifications(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getUnreadCount ────────────────────────────────────
  describe('getUnreadCount', () => {
    it('should get unread count and call success', async () => {
      mockService.getUnreadCount.mockResolvedValue({ unreadCount: 5 });
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getUnreadCount(req, res, next);

      expect(mockService.getUnreadCount).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'Unread count', { unreadCount: 5 });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUnreadCount.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getUnreadCount(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getNotification ───────────────────────────────────
  describe('getNotification', () => {
    it('should get single notification and call success', async () => {
      const notification = { notificationId: 'n1', title: 'Booking confirmed' };
      mockService.getNotificationById.mockResolvedValue(notification);
      req = createMockReq({ params: { notificationId: 'n1' }, user: { userId: 'u1' } });

      await controller.getNotification(req, res, next);

      expect(mockService.getNotificationById).toHaveBeenCalledWith('n1', 'u1');
      expect(success).toHaveBeenCalledWith(res, 'Notification retrieved', { notification });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockService.getNotificationById.mockRejectedValue(err);
      req = createMockReq({ params: { notificationId: 'n1' }, user: { userId: 'u1' } });

      await controller.getNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── markAsRead ────────────────────────────────────────
  describe('markAsRead', () => {
    it('should mark as read and call success', async () => {
      mockService.markAsRead.mockResolvedValue();
      req = createMockReq({ params: { notificationId: 'n1' }, user: { userId: 'u1' } });

      await controller.markAsRead(req, res, next);

      expect(mockService.markAsRead).toHaveBeenCalledWith('n1', 'u1');
      expect(success).toHaveBeenCalledWith(res, 'Notification marked as read');
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.markAsRead.mockRejectedValue(err);
      req = createMockReq({ params: { notificationId: 'n1' }, user: { userId: 'u1' } });

      await controller.markAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── markAllAsRead ─────────────────────────────────────
  describe('markAllAsRead', () => {
    it('should mark all as read and call success with count', async () => {
      mockService.markAllAsRead.mockResolvedValue({ updatedCount: 7 });
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.markAllAsRead(req, res, next);

      expect(mockService.markAllAsRead).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(
        res,
        expect.stringContaining('7'),
        { updatedCount: 7 },
      );
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.markAllAsRead.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.markAllAsRead(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── deleteNotification ────────────────────────────────
  describe('deleteNotification', () => {
    it('should delete notification and call success', async () => {
      mockService.deleteNotification.mockResolvedValue();
      req = createMockReq({ params: { notificationId: 'n1' }, user: { userId: 'u1' } });

      await controller.deleteNotification(req, res, next);

      expect(mockService.deleteNotification).toHaveBeenCalledWith('n1', 'u1');
      expect(success).toHaveBeenCalledWith(res, 'Notification deleted');
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.deleteNotification.mockRejectedValue(err);
      req = createMockReq({ params: { notificationId: 'n1' }, user: { userId: 'u1' } });

      await controller.deleteNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getPreferences ────────────────────────────────────
  describe('getPreferences', () => {
    it('should get preferences and call success', async () => {
      const preferences = { email: true, sms: false, push: true };
      mockService.getPreferences.mockResolvedValue(preferences);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getPreferences(req, res, next);

      expect(mockService.getPreferences).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'Notification preferences', { preferences });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getPreferences.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getPreferences(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updatePreferences ─────────────────────────────────
  describe('updatePreferences', () => {
    it('should update preferences and call success', async () => {
      const preferences = { email: false, sms: true };
      mockService.updatePreferences.mockResolvedValue(preferences);
      req = createMockReq({ user: { userId: 'u1' }, body: { email: false, sms: true } });

      await controller.updatePreferences(req, res, next);

      expect(mockService.updatePreferences).toHaveBeenCalledWith('u1', req.body);
      expect(success).toHaveBeenCalledWith(res, 'Preferences updated', { preferences });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.updatePreferences.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.updatePreferences(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminSendNotification ─────────────────────────────
  describe('adminSendNotification', () => {
    it('should send notification and call success', async () => {
      mockService.sendNotification.mockResolvedValue();
      req = createMockReq({
        user: { userId: 'admin1' },
        body: {
          userId: 'u2',
          title: 'System Alert',
          message: 'Maintenance tonight',
          type: 'system',
          channels: ['in_app', 'email'],
        },
      });

      await controller.adminSendNotification(req, res, next);

      expect(mockService.sendNotification).toHaveBeenCalledWith('u2', expect.objectContaining({
        title: 'System Alert',
        message: 'Maintenance tonight',
        type: 'system',
        channels: ['in_app', 'email'],
        metadata: { sentBy: 'admin1' },
      }));
      expect(success).toHaveBeenCalledWith(res, 'Notification sent');
    });

    it('should use defaults when type/channels not provided', async () => {
      mockService.sendNotification.mockResolvedValue();
      req = createMockReq({
        user: { userId: 'admin1' },
        body: { userId: 'u2', title: 'Hi', message: 'Hello' },
      });

      await controller.adminSendNotification(req, res, next);

      expect(mockService.sendNotification).toHaveBeenCalledWith('u2', expect.objectContaining({
        type: 'system',
        channels: ['in_app'],
      }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.sendNotification.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'admin1' }, body: { userId: 'u2' } });

      await controller.adminSendNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminSendBulkNotification ─────────────────────────
  describe('adminSendBulkNotification', () => {
    it('should send bulk notification and call success with count', async () => {
      mockService.sendAdminBulkNotification.mockResolvedValue({ recipientCount: 42 });
      req = createMockReq({
        user: { userId: 'admin1' },
        body: {
          title: 'Bulk Alert',
          message: 'For all drivers',
          type: 'system',
          channels: ['in_app'],
          filters: { isDriver: true },
        },
      });

      await controller.adminSendBulkNotification(req, res, next);

      expect(mockService.sendAdminBulkNotification).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Bulk Alert',
        filters: { isDriver: true },
        metadata: { sentBy: 'admin1' },
      }));
      expect(success).toHaveBeenCalledWith(
        res,
        expect.stringContaining('42'),
        { recipientCount: 42 },
      );
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.sendAdminBulkNotification.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'admin1' }, body: {} });

      await controller.adminSendBulkNotification(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
