/**
 * Controllers Index
 * University of Ilorin Carpooling Platform
 *
 * Central export point for all controllers.
 * Each controller is a singleton instance.
 *
 * Path: src/api/controllers/index.js
 *
 * @module controllers
 */

const AuthController = require('./auth.controller');
const UserController = require('./user.controller');
const RideController = require('./ride.controller');
const BookingController = require('./booking.controller');
const RatingController = require('./rating.controller');
const NotificationController = require('./notification.controller');
const SafetyController = require('./safety.controller');
const ReportController = require('./report.controller');

module.exports = {
  AuthController,
  UserController,
  RideController,
  BookingController,
  RatingController,
  NotificationController,
  SafetyController,
  ReportController,
};
