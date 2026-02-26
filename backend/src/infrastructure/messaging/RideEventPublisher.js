/**
 * Ride Event Publisher
 * University of Ilorin Carpooling Platform
 *
 * Formats ride domain events into the SQS trigger's
 * expected message shape and publishes them via EventPublisher.
 *
 * @module infrastructure/messaging/RideEventPublisher
 */

'use strict';

const { randomUUID } = require('crypto');
const { logger } = require('../../shared/utils/logger');

class RideEventPublisher {
  /**
   * @param {import('./EventPublisher')} eventPublisher
   */
  constructor(eventPublisher) {
    this.publisher = eventPublisher;
  }

  /**
   * Ride cancelled — email each affected passenger.
   * @param {Object} ride - The cancelled ride object
   * @param {Array<Object>} affectedBookings - Bookings with passengerId, passenger info
   * @param {string} reason - Cancellation reason
   */
  async rideCancelled(ride, affectedBookings, reason) {
    if (!affectedBookings || affectedBookings.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    const messages = affectedBookings.map((booking) =>
      this._buildMessage({
        recipient: {
          userId: booking.passengerId,
          email: booking.passenger?.email,
        },
        template: 'booking_cancelled',
        subject: 'Ride Cancelled – UniLorin Carpool',
        data: {
          userName: booking.passenger?.firstName || 'there',
          bookingId: booking.bookingReference || booking.bookingId,
          reason: reason || 'The driver cancelled this ride',
          cancelledBy: 'driver',
          rideDate: ride.departureDate,
          departureTime: ride.departureTime,
        },
        source: 'ride-service',
        priority: 'high',
      }),
    );

    return this.publisher.publishBatch(messages);
  }

  /**
   * Ride updated — email passengers about changes.
   * @param {Object} ride - The updated ride object
   * @param {Array<Object>} affectedBookings - Active bookings for this ride
   */
  async rideUpdated(ride, affectedBookings) {
    if (!affectedBookings || affectedBookings.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    const messages = affectedBookings.map((booking) =>
      this._buildMessage({
        recipient: {
          userId: booking.passengerId,
          email: booking.passenger?.email,
        },
        template: 'default',
        subject: 'Ride Updated – UniLorin Carpool',
        data: {
          title: 'Ride Details Updated',
          body: `The driver has updated details for your ride on ${ride.departureDate} at ${ride.departureTime}. Please check the app for the latest information.`,
        },
        source: 'ride-service',
        priority: 'normal',
      }),
    );

    return this.publisher.publishBatch(messages);
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
        source: source || 'ride-service',
        priority: priority || 'normal',
      },
    };
  }
}

module.exports = RideEventPublisher;
