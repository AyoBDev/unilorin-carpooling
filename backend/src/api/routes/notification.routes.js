/**
 * Notification Routes
 * Path: src/api/routes/notification.routes.js
 */

const { Router } = require('express');
const { NotificationController } = require('../controllers');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);

// Push subscriptions (PWA Web Push)
router.get('/push/vapid-key', NotificationController.getVapidKey);
router.post('/push/subscribe', NotificationController.subscribePush);
router.post('/push/unsubscribe', NotificationController.unsubscribePush);

router.get('/', NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.get('/preferences', NotificationController.getPreferences);
router.put('/preferences', NotificationController.updatePreferences);
router.patch('/read-all', NotificationController.markAllAsRead);

router.get('/:notificationId', NotificationController.getNotification);
router.patch('/:notificationId/read', NotificationController.markAsRead);
router.delete('/:notificationId', NotificationController.deleteNotification);

module.exports = router;
