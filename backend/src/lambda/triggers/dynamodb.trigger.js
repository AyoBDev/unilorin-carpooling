/**
 * DynamoDB Stream Trigger
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/triggers/dynamodb.trigger.js
 *
 * Processes DynamoDB Streams events when records in the main
 * table are inserted, modified, or removed.
 *
 * This is the backbone of the event-driven architecture:
 *   - New booking → notify driver
 *   - Booking confirmed → notify passenger
 *   - Booking cancelled → release seat, notify counterpart
 *   - Ride cancelled → notify all passengers
 *   - Ride completed → trigger rating prompts
 *   - New rating → update user average rating
 *   - User verified → send welcome email
 *
 * DynamoDB Stream records contain:
 *   eventName: INSERT | MODIFY | REMOVE
 *   dynamodb.NewImage / OldImage: the item data (DynamoDB JSON)
 *
 * @module lambda/triggers/dynamodb
 */

'use strict';

const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { logger } = require('../../shared/utils/logger');
const { withMiddleware } = require('../middleware/lambdaMiddleware');

// ─── Entity Type Detection ──────────────────────────────

/**
 * Determine the entity type from the DynamoDB record's PK/SK pattern.
 *
 * @param {Object} item - Unmarshalled DynamoDB item
 * @returns {string|null} Entity type or null
 */
const detectEntityType = (item) => {
  const pk = item.PK || '';
  const sk = item.SK || '';

  if (pk.startsWith('USER#')) return 'USER';
  if (pk.startsWith('RIDE#') || sk.startsWith('OFFER#')) return 'RIDE';
  if (pk.startsWith('BOOKING#')) return 'BOOKING';
  if (pk.startsWith('RATING#') || sk.startsWith('RATING#')) return 'RATING';
  if (pk.startsWith('NOTIFICATION#')) return 'NOTIFICATION';
  if (pk.startsWith('VEHICLE#') || sk.startsWith('VEHICLE#')) return 'VEHICLE';
  if (sk.startsWith('DRIVER#')) return 'DRIVER';

  return null;
};

// ─── Processors ─────────────────────────────────────────

/**
 * Process booking-related stream events.
 */
const processBookingEvent = async (eventName, newItem, oldItem) => {
  const NotificationService = require('../../core/services/NotificationService');
  const notificationService = new NotificationService();

  const bookingId = newItem?.bookingId || oldItem?.bookingId;
  const newStatus = newItem?.status;
  const oldStatus = oldItem?.status;

  logger.info('Processing booking event', { eventName, bookingId, newStatus, oldStatus });

  if (eventName === 'INSERT') {
    // New booking created → notify driver
    if (newItem.driverId) {
      await notificationService.create({
        userId: newItem.driverId,
        type: 'new_booking',
        title: 'New Booking Request',
        message: `A passenger has booked ${newItem.seatsBooked || 1} seat(s) on your ride.`,
        metadata: {
          bookingId,
          rideId: newItem.rideId,
          passengerId: newItem.passengerId,
        },
      });
    }
  }

  if (eventName === 'MODIFY' && newStatus !== oldStatus) {
    switch (newStatus) {
      case 'confirmed':
        // Driver confirmed → notify passenger
        await notificationService.create({
          userId: newItem.passengerId,
          type: 'booking_confirmed',
          title: 'Booking Confirmed',
          message: 'Your booking has been confirmed! A verification code has been generated.',
          metadata: { bookingId, rideId: newItem.rideId },
        });
        break;

      case 'cancelled':
        // Determine who cancelled and notify the other party
        if (newItem.cancelledBy === newItem.passengerId) {
          // Passenger cancelled → notify driver
          await notificationService.create({
            userId: newItem.driverId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: `A passenger cancelled their booking. Seat(s) have been released.`,
            metadata: { bookingId, rideId: newItem.rideId },
          });
        } else {
          // Driver cancelled → notify passenger
          await notificationService.create({
            userId: newItem.passengerId,
            type: 'booking_cancelled',
            title: 'Booking Cancelled by Driver',
            message: 'The driver has cancelled your booking. Please search for another ride.',
            metadata: { bookingId, rideId: newItem.rideId },
          });
        }
        break;

      case 'in_progress':
        // Ride started for this passenger
        await notificationService.create({
          userId: newItem.passengerId,
          type: 'ride_started',
          title: 'Ride In Progress',
          message: 'Your ride has started. Have a safe trip!',
          metadata: { bookingId, rideId: newItem.rideId },
        });
        break;

      case 'completed':
        // Ride completed → prompt both parties to rate
        await notificationService.create({
          userId: newItem.passengerId,
          type: 'rate_prompt',
          title: 'Rate Your Ride',
          message: 'Your ride is complete! Please rate your experience.',
          metadata: { bookingId, rideId: newItem.rideId, rateTarget: newItem.driverId },
        });
        await notificationService.create({
          userId: newItem.driverId,
          type: 'rate_prompt',
          title: 'Rate Your Passenger',
          message: 'The ride is complete! Please rate your passenger.',
          metadata: { bookingId, rideId: newItem.rideId, rateTarget: newItem.passengerId },
        });
        break;

      case 'no_show':
        await notificationService.create({
          userId: newItem.passengerId,
          type: 'no_show',
          title: 'No-Show Recorded',
          message: 'You were marked as a no-show. Repeated no-shows may affect your account.',
          metadata: { bookingId, rideId: newItem.rideId },
        });
        break;

      default:
        break;
    }
  }
};

/**
 * Process ride-related stream events.
 */
const processRideEvent = async (eventName, newItem, oldItem) => {
  const NotificationService = require('../../core/services/NotificationService');
  const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
  const notificationService = new NotificationService();
  const bookingRepo = new BookingRepository();

  const rideId = newItem?.rideId || oldItem?.rideId;
  const newStatus = newItem?.status;
  const oldStatus = oldItem?.status;

  logger.info('Processing ride event', { eventName, rideId, newStatus, oldStatus });

  if (eventName === 'MODIFY' && newStatus !== oldStatus) {
    if (newStatus === 'cancelled') {
      // Ride cancelled → notify all confirmed passengers
      const bookings = await bookingRepo.findByRideId(rideId);
      const confirmed = bookings.filter(
        (b) => b.status === 'confirmed' || b.status === 'pending'
      );

      for (const booking of confirmed) {
        await notificationService.create({
          userId: booking.passengerId,
          type: 'ride_cancelled',
          title: 'Ride Cancelled',
          message: 'The driver has cancelled the ride. Please search for an alternative.',
          metadata: { rideId, bookingId: booking.bookingId },
        });

        // Also cancel the booking
        await bookingRepo.updateStatus(booking.bookingId, 'cancelled', {
          cancellationReason: 'Ride cancelled by driver',
          cancelledBy: newItem.driverId,
        });
      }
    }

    if (newStatus === 'in_progress') {
      // Ride started → notify pending passengers that driver is on the way
      const bookings = await bookingRepo.findConfirmedByRideId(rideId);
      for (const booking of bookings) {
        await notificationService.create({
          userId: booking.passengerId,
          type: 'driver_departing',
          title: 'Driver Is On The Way',
          message: `Your driver has started the ride. Be ready at your pickup point.`,
          metadata: { rideId, bookingId: booking.bookingId },
        });
      }
    }
  }
};

/**
 * Process rating-related stream events.
 */
const processRatingEvent = async (eventName, newItem) => {
  if (eventName !== 'INSERT') return;

  const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
  const NotificationService = require('../../core/services/NotificationService');
  const userRepo = new UserRepository();
  const notificationService = new NotificationService();

  const { ratedUserId, raterId, score, ratingType } = newItem;

  logger.info('Processing rating event', { ratedUserId, score, ratingType });

  // Update the rated user's average rating
  try {
    await userRepo.recalculateAverageRating(ratedUserId);
  } catch (error) {
    logger.error('Failed to recalculate average rating', {
      ratedUserId,
      error: error.message,
    });
  }

  // Notify the rated user
  await notificationService.create({
    userId: ratedUserId,
    type: 'new_rating',
    title: 'New Rating Received',
    message: `You received a ${score}-star rating.`,
    metadata: { raterId, score, ratingType },
  });
};

/**
 * Process user-related stream events.
 */
const processUserEvent = async (eventName, newItem, oldItem) => {
  if (eventName !== 'MODIFY') return;

  const NotificationService = require('../../core/services/NotificationService');
  const notificationService = new NotificationService();

  // User email verified
  if (newItem.isVerified === true && oldItem.isVerified === false) {
    await notificationService.create({
      userId: newItem.userId,
      type: 'welcome',
      title: 'Welcome to UniLorin Carpool!',
      message: 'Your email has been verified. Start searching for rides or create an offer!',
      metadata: {},
    });
  }

  // Driver verification approved
  if (newItem.driverStatus === 'verified' && oldItem.driverStatus === 'pending') {
    await notificationService.create({
      userId: newItem.userId,
      type: 'driver_verified',
      title: 'Driver Verification Approved',
      message: 'Congratulations! Your driver documents have been verified. You can now create ride offers.',
      metadata: {},
    });
  }

  // Driver verification rejected
  if (newItem.driverStatus === 'rejected' && oldItem.driverStatus === 'pending') {
    await notificationService.create({
      userId: newItem.userId,
      type: 'driver_rejected',
      title: 'Driver Verification Rejected',
      message: 'Your driver documents could not be verified. Please re-upload valid documents.',
      metadata: { reason: newItem.rejectionReason },
    });
  }
};

// ─── Entity Processor Map ───────────────────────────────

const PROCESSORS = {
  BOOKING: processBookingEvent,
  RIDE: processRideEvent,
  RATING: processRatingEvent,
  USER: processUserEvent,
};

// ─── Lambda Handler ─────────────────────────────────────

module.exports.handler = withMiddleware(
  'dynamodb-stream-trigger',
  async (event) => {
    const records = event.Records || [];
    logger.info('DynamoDB Stream trigger received', { recordCount: records.length });

    const results = { processed: 0, skipped: 0, errors: 0 };

    for (const record of records) {
      try {
        const { eventName } = record;
        const newImage = record.dynamodb.NewImage
          ? unmarshall(record.dynamodb.NewImage)
          : null;
        const oldImage = record.dynamodb.OldImage
          ? unmarshall(record.dynamodb.OldImage)
          : null;

        const entityType = detectEntityType(newImage || oldImage);

        if (!entityType || !PROCESSORS[entityType]) {
          results.skipped++;
          continue;
        }

        await PROCESSORS[entityType](eventName, newImage, oldImage);
        results.processed++;
      } catch (error) {
        results.errors++;
        logger.error('Error processing DynamoDB stream record', {
          error: error.message,
          eventID: record.eventID,
          eventName: record.eventName,
        });
        // Don't throw — process remaining records
      }
    }

    logger.info('DynamoDB Stream trigger completed', results);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: results }),
    };
  },
  { enableTimeoutGuard: false } // Stream triggers have their own retry logic
);
