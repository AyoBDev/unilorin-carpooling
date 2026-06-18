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
  AdminAuthController,
} = require('../controllers');
const SupportController = require('../controllers/SupportController');
const AdminSafetyController = require('../controllers/AdminSafetyController');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const { adminInviteSchema } = require('../../shared/utils/validation');

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

// ─── VEHICLE MANAGEMENT ───────────────────────────────────────────

router.get('/vehicles/pending', UserController.adminGetPendingVehicles);
router.post('/vehicles/:userId/:vehicleId/verify', UserController.adminVerifyVehicle);

// ─── NOTIFICATIONS ─────────────────────────────────────────────

router.post('/notifications/send', NotificationController.adminSendNotification);
router.post('/notifications/send-bulk', NotificationController.adminSendBulkNotification);

// ─── SAFETY DASHBOARD ──────────────────────────────────────────

router.get('/safety/sos', AdminSafetyController.getSOSAlerts);
router.get('/safety/sos/:alertId', AdminSafetyController.getSOSAlertDetail);
router.put('/safety/sos/:alertId', AdminSafetyController.updateSOSAlert);
router.get('/safety/incidents', AdminSafetyController.getIncidents);
router.get('/safety/incidents/:incidentId', AdminSafetyController.getIncidentDetail);
router.put('/safety/incidents/:incidentId', AdminSafetyController.updateIncident);
router.get('/safety/stats', AdminSafetyController.getSafetyStats);

// ─── SUPPORT TICKET MANAGEMENT ─────────────────────────────────

router.get('/support/tickets', SupportController.adminGetAllTickets);
router.get('/support/tickets/:ticketId', SupportController.adminGetTicket);
router.post('/support/tickets/:ticketId/respond', SupportController.adminRespond);
router.put('/support/tickets/:ticketId/status', SupportController.adminUpdateStatus);
router.put('/support/tickets/:ticketId/assign', SupportController.adminAssign);

// ─── REPORTS ───────────────────────────────────────────────────

router.get('/reports/cash-collection', ReportController.getDailyCashCollection);
router.get('/reports/reconciliation', ReportController.getCashReconciliation);
router.get('/reports/bookings', ReportController.getBookingSummary);
router.get('/reports/statistics', ReportController.getPlatformStatistics);
router.get('/reports/driver-leaderboard', ReportController.getDriverLeaderboard);
router.get('/reports/user-growth', ReportController.getUserGrowth);
router.get('/reports/rides', ReportController.getRideAnalytics);
router.get('/reports/revenue', ReportController.getRevenueReport);

// ─── INVITE MANAGEMENT ───────────────────────────────────────
router.post('/invites', validateBody(adminInviteSchema), AdminAuthController.createInvite);
router.get('/invites', AdminAuthController.listInvites);
router.delete('/invites/:inviteId', AdminAuthController.revokeInvite);

module.exports = router;
