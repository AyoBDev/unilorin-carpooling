/**
 * Domain Entities Export
 * Central export point for all domain entities
 */

const User = require('./User');
const Student = require('./Student');
const Staff = require('./Staff');
const Driver = require('./Driver');
const Vehicle = require('./Vehicle');
const Ride = require('./Ride');
const Booking = require('./Booking');
const Payment = require('./Payment');
const Rating = require('./Rating');
const Notification = require('./Notification');
const Route = require('./Route');
const PickupPoint = require('./PickupPoint');

module.exports = {
  User,
  Student,
  Staff,
  Driver,
  Vehicle,
  Ride,
  Booking,
  Payment,
  Rating,
  Notification,
  Route,
  PickupPoint,
};
