/**
 * Admin Routes
 * Path: src/api/routes/admin.routes.js
 *
 * All routes require admin role.
 */

const { Router } = require('express');
const {
  UserController,
  NotificationController,
  SafetyController,
  ReportController,
} = require('../controllers');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// ─── USER MANAGEMENT ───────────────────────────────────────────

router.get('/users', UserController.adminGetUsers);
router.get('/users/:userId', UserController.adminGetUserById);
router.put('/users/:userId', UserController.adminUpdateUser);
router.post('/users/:userId/verify-driver', UserController.adminVerifyDriver);
router.post('/users/:userId/suspend', UserController.adminSuspendUser);

// ─── NOTIFICATIONS ─────────────────────────────────────────────

router.post('/notifications/send', NotificationController.adminSendNotification);
router.post('/notifications/send-bulk', NotificationController.adminSendBulkNotification);

// ─── SAFETY ────────────────────────────────────────────────────

router.get('/safety/sos', SafetyController.adminGetSOSAlerts);
router.get('/safety/incidents', SafetyController.adminGetIncidents);
router.post('/safety/incidents/:incidentId/resolve', SafetyController.adminResolveIncident);

// ─── REPORTS ───────────────────────────────────────────────────

router.get('/reports/cash-collection', ReportController.getDailyCashCollection);
router.get('/reports/reconciliation', ReportController.getCashReconciliation);
router.get('/reports/bookings', ReportController.getBookingSummary);
router.get('/reports/statistics', ReportController.getPlatformStatistics);
router.get('/reports/driver-leaderboard', ReportController.getDriverLeaderboard);
router.get('/reports/user-growth', ReportController.getUserGrowth);
router.get('/reports/rides', ReportController.getRideAnalytics);
router.get('/reports/revenue', ReportController.getRevenueReport);

module.exports = router;
