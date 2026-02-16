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

const AuthController = require('./AuthController');
const UserController = require('./UserController');
const RideController = require('./RideController');
const BookingController = require('./BookingController');
const RatingController = require('./RatingController');
const NotificationController = require('./NotificationController');
const SafetyController = require('./SafetyController');
const ReportController = require('./ReportController');

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
