/**
 * Routes Index
 * University of Ilorin Carpooling Platform
 *
 * Mounts all route modules under /api/v1.
 *
 * Path: src/api/routes/index.js
 *
 * @module routes
 */

const { Router } = require('express');

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const rideRoutes = require('./ride.routes');
const bookingRoutes = require('./booking.routes');
const ratingRoutes = require('./rating.routes');
const notificationRoutes = require('./notification.routes');
const safetyRoutes = require('./safety.routes');
const reportRoutes = require('./report.routes');
const adminRoutes = require('./admin.routes');

const router = Router();

// ─── HEALTH CHECK ──────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PSRide API is running',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API ROUTES ────────────────────────────────────────────────

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rides', rideRoutes);
router.use('/bookings', bookingRoutes);
router.use('/ratings', ratingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/safety', safetyRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
