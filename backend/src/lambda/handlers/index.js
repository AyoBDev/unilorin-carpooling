/**
 * Lambda Handlers Barrel Export
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/index.js
 *
 * Re-exports all Lambda handler functions for convenience.
 * Each handler can also be imported directly from its own file.
 */

'use strict';

module.exports = {
  // ── API Handlers ──────────────────────────────────────
  api: require('./api.handler'),
  auth: require('./auth.handler'),
  rides: require('./rides.handler'),
  bookings: require('./bookings.handler'),
  notifications: require('./notifications.handler'),
  reports: require('./reports.handler'),

  // ── Scheduled Tasks ───────────────────────────────────
  scheduled: require('./scheduled.handler'),
};
