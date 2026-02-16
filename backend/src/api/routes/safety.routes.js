/**
 * Safety Routes
 * Path: src/api/routes/safety.routes.js
 */

const { Router } = require('express');
const { SafetyController } = require('../controllers');
const { authenticate } = require('../middlewares/auth.middleware');
const { sosLimiter } = require('../middlewares/rateLimiter.middleware');
const { sanitizeBody } = require('../middlewares/validation.middleware');

const router = Router();

// Shared location endpoint - accessible via share token (no auth)
router.get('/location/:shareToken', SafetyController.getSharedLocation);

// All other routes require authentication
router.use(authenticate);

// ─── SOS ───────────────────────────────────────────────────────

router.post('/sos', sosLimiter, sanitizeBody, SafetyController.triggerSOS);

router.get('/sos', SafetyController.getMySOSAlerts);
router.get('/sos/:alertId', SafetyController.getSOSAlert);
router.post('/sos/:alertId/resolve', SafetyController.resolveSOSAlert);

// ─── LOCATION SHARING ──────────────────────────────────────────

router.post('/location/share', SafetyController.shareLocation);
router.post('/location/stop', SafetyController.stopLocationSharing);
router.put('/location', SafetyController.updateLocation);

// ─── INCIDENTS ─────────────────────────────────────────────────

router.post('/incidents', sanitizeBody, SafetyController.reportIncident);

router.get('/incidents', SafetyController.getIncidentReports);

module.exports = router;
