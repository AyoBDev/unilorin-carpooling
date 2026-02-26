/**
 * Booking Event Publisher
 * University of Ilorin Carpooling Platform
 *
 * Formats booking domain events into the SQS trigger's
 * expected message shape and publishes them via EventPublisher.
 *
 * @module infrastructure/messaging/BookingEventPublisher
 */

'use strict';

const { randomUUID } = require('crypto');
const { logger } = require('../../shared/utils/logger');

class BookingEventPublisher {
  /**
   * @param {import('./EventPublisher')} eventPublisher
   */
  constructor(eventPublisher) {
    this.publisher = eventPublisher;
  }

  /**
   * Booking created — email passenger with confirmation + verification code.
   * @param {Object} booking - The created booking object
   */
  async bookingCreated(booking) {
    const message = this._buildMessage({
      recipient: {
        userId: booking.passengerId,
        email: booking.passenger?.email,
      },
      template: 'booking_confirmed',
      subject: 'Booking Confirmed – UniLorin Carpool',
      data: {
        passengerName: booking.passenger?.firstName || 'there',
        rideDate: booking.rideDate,
        departureTime: booking.rideTime,
        verificationCode: booking.verificationCode,
        pickupPoint: booking.pickupPointName,
        amount: booking.totalAmount,
        bookingReference: booking.bookingReference,
      },
      source: 'booking-service',
      priority: 'high',
    });

    return this.publisher.publish(message);
  }

  /**
   * Booking confirmed by driver — email passenger.
   * @param {Object} booking - The confirmed booking object
   */
  async bookingConfirmed(booking) {
    const message = this._buildMessage({
      recipient: {
        userId: booking.passengerId,
        email: booking.passenger?.email,
      },
      template: 'booking_confirmed',
      subject: 'Booking Confirmed by Driver – UniLorin Carpool',
      data: {
        passengerName: booking.passenger?.firstName || 'there',
        rideDate: booking.rideDate,
        departureTime: booking.rideTime,
        verificationCode: booking.verificationCode,
        pickupPoint: booking.pickupPointName,
        amount: booking.totalAmount,
        bookingReference: booking.bookingReference,
      },
      source: 'booking-service',
      priority: 'high',
    });

    return this.publisher.publish(message);
  }

  /**
   * Booking cancelled — email the other party.
   * @param {Object} booking - The cancelled booking object
   * @param {string} cancelledBy - 'passenger' or 'driver'
   * @param {string} reason - Cancellation reason
   */
  async bookingCancelled(booking, cancelledBy, reason) {
    // Notify the party that did NOT cancel
    const isPassengerCancel = cancelledBy === 'passenger';
    const recipient = isPassengerCancel
      ? { userId: booking.driverId, email: booking.driver?.email }
      : { userId: booking.passengerId, email: booking.passenger?.email };

    const userName = isPassengerCancel
      ? booking.driver?.firstName
      : booking.passenger?.firstName;

    const message = this._buildMessage({
      recipient,
      template: 'booking_cancelled',
      subject: 'Booking Cancelled – UniLorin Carpool',
      data: {
        userName: userName || 'there',
        bookingId: booking.bookingReference || booking.bookingId,
        reason: reason || 'No reason provided',
        cancelledBy,
        rideDate: booking.rideDate,
        departureTime: booking.rideTime,
      },
      source: 'booking-service',
      priority: 'normal',
    });

    return this.publisher.publish(message);
  }

  /**
   * Booking no-show — email passenger.
   * @param {Object} booking - The no-show booking object
   */
  async bookingNoShow(booking) {
    const message = this._buildMessage({
      recipient: {
        userId: booking.passengerId,
        email: booking.passenger?.email,
      },
      template: 'default',
      subject: 'No-Show Recorded – UniLorin Carpool',
      data: {
        title: 'No-Show Recorded',
        body: `You were marked as a no-show for your ride on ${booking.rideDate} at ${booking.rideTime}. Repeated no-shows may affect your ability to book future rides.`,
      },
      source: 'booking-service',
      priority: 'normal',
    });

    return this.publisher.publish(message);
  }

  /**
   * Build the standard SQS message shape expected by the SQS trigger.
   * @private
   */
  _buildMessage({ recipient, template, subject, data, source, priority }) {
    return {
      type: 'email',
      recipient,
      payload: {
        template,
        subject,
        data,
      },
      metadata: {
        correlationId: randomUUID(),
        source: source || 'booking-service',
        priority: priority || 'normal',
      },
    };
  }
}

module.exports = BookingEventPublisher;
