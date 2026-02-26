/**
 * Messaging Module — Barrel Export
 * University of Ilorin Carpooling Platform
 *
 * Provides singleton getters for event publishers.
 *
 * @module infrastructure/messaging
 */

'use strict';

const EventPublisher = require('./EventPublisher');
const BookingEventPublisher = require('./BookingEventPublisher');
const RideEventPublisher = require('./RideEventPublisher');

let _eventPublisher = null;
let _bookingEventPublisher = null;
let _rideEventPublisher = null;

function getEventPublisher() {
  if (!_eventPublisher) {
    _eventPublisher = new EventPublisher();
  }
  return _eventPublisher;
}

function getBookingEventPublisher() {
  if (!_bookingEventPublisher) {
    _bookingEventPublisher = new BookingEventPublisher(getEventPublisher());
  }
  return _bookingEventPublisher;
}

function getRideEventPublisher() {
  if (!_rideEventPublisher) {
    _rideEventPublisher = new RideEventPublisher(getEventPublisher());
  }
  return _rideEventPublisher;
}

module.exports = {
  EventPublisher,
  BookingEventPublisher,
  RideEventPublisher,
  getEventPublisher,
  getBookingEventPublisher,
  getRideEventPublisher,
};
