/**
 * User Routes
 * Path: src/api/routes/user.routes.js
 *
 * All user routes require authentication.
 */

const { Router } = require('express');
const { UserController } = require('../controllers');
const { authenticate, requireVerified } = require('../middlewares/auth.middleware');
const { validateBody, sanitizeBody } = require('../middlewares/validation.middleware');
const {
  userProfileUpdateSchema,
  vehicleSchema,
  emergencyContactSchema,
  driverRegistrationSchema,
} = require('../../shared/utils/validation');

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── PROFILE ───────────────────────────────────────────────────

router.get('/profile', UserController.getProfile);

router.put(
  '/profile',
  sanitizeBody,
  validateBody(userProfileUpdateSchema),
  UserController.updateProfile,
);

router.delete('/profile', UserController.deleteAccount);

router.get('/statistics', UserController.getStatistics);

router.get('/ride-history', UserController.getRideHistory);

// ─── PUBLIC USER PROFILE ───────────────────────────────────────

router.get('/:userId', UserController.getUserById);

// ─── DRIVER REGISTRATION ───────────────────────────────────────

router.post(
  '/driver/register',
  requireVerified,
  sanitizeBody,
  validateBody(driverRegistrationSchema),
  UserController.registerAsDriver,
);

router.get('/driver/status', UserController.getVerificationStatus);

router.post('/driver/documents', requireVerified, UserController.uploadDocument);

router.get('/driver/documents', UserController.getDocuments);

// ─── VEHICLES ──────────────────────────────────────────────────

router.get('/vehicles', UserController.getVehicles);

router.post(
  '/vehicles',
  requireVerified,
  sanitizeBody,
  validateBody(vehicleSchema),
  UserController.addVehicle,
);

router.put('/vehicles/:vehicleId', sanitizeBody, UserController.updateVehicle);

router.delete('/vehicles/:vehicleId', UserController.deleteVehicle);

// ─── EMERGENCY CONTACTS ────────────────────────────────────────

router.get('/emergency-contacts', UserController.getEmergencyContacts);

router.post(
  '/emergency-contacts',
  sanitizeBody,
  validateBody(emergencyContactSchema),
  UserController.addEmergencyContact,
);

router.put('/emergency-contacts/:contactId', sanitizeBody, UserController.updateEmergencyContact);

router.delete('/emergency-contacts/:contactId', UserController.deleteEmergencyContact);

// ─── PREFERENCES ───────────────────────────────────────────────

router.get('/preferences', UserController.getPreferences);

router.put('/preferences', sanitizeBody, UserController.updatePreferences);

module.exports = router;
