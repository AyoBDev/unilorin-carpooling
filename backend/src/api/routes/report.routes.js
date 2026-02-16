/**
 * Report Routes
 * Path: src/api/routes/report.routes.js
 *
 * Driver-facing reports. Admin reports are in admin.routes.js.
 */

const { Router } = require('express');
const { ReportController } = require('../controllers');
const { authenticate, requireDriver } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authenticate);
router.use(requireDriver);

router.get('/driver/cash', ReportController.getDriverCashReport);
router.get('/driver/earnings', ReportController.getDriverEarnings);
router.get('/driver/summary', ReportController.getDriverSummary);

module.exports = router;
