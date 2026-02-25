/**
 * Scheduled Tasks Lambda Handler
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/handlers/scheduled.handler.js
 *
 * Triggered by EventBridge (CloudWatch Events) on a schedule.
 * Handles periodic tasks that keep the platform running smoothly.
 *
 * Scheduled tasks:
 *   1. expireRides        — Mark past rides as completed/expired
 *   2. sendRideReminders  — Notify users 1 hour before departure
 *   3. cleanupSessions    — Purge expired sessions/tokens
 *   4. markNoShows        — Flag passengers who didn't show up
 *   5. generateDailyReport — Aggregate daily stats
 *   6. cleanupOldData     — Archive/delete old records
 *
 * Each EventBridge rule sends a `detail.task` field so this
 * single handler can dispatch to the correct routine.
 *
 * Example EventBridge rule payload:
 * {
 *   "source": "carpool.scheduler",
 *   "detail-type": "ScheduledTask",
 *   "detail": { "task": "expireRides" }
 * }
 *
 * @module lambda/handlers/scheduled
 */

'use strict';

const { logger } = require('../../shared/utils/logger');
const { withMiddleware } = require('../middleware/lambdaMiddleware');

// ─── Task: Expire Past Rides ────────────────────────────

/**
 * Find all rides whose departureDate + departureTime is in the
 * past and whose status is still "active".  Move them to
 * "expired" or "completed" depending on whether they had bookings.
 */
const expireRides = async () => {
  const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
  const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');

  const rideRepo = new RideRepository();
  const bookingRepo = new BookingRepository();

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  logger.info('Running expireRides', { today, currentTime });

  try {
    // Get active rides for today and earlier
    const activeRides = await rideRepo.findActiveRidesBefore(today, currentTime);

    let expired = 0;
    let completed = 0;

    for (const ride of activeRides) {
      // Check if ride had confirmed bookings
      const bookings = await bookingRepo.findByRideId(ride.rideId);
      const hasConfirmedBookings = bookings.some(
        (b) => b.status === 'confirmed' || b.status === 'in_progress' || b.status === 'completed'
      );

      if (hasConfirmedBookings) {
        await rideRepo.updateStatus(ride.rideId, 'completed');
        completed++;
      } else {
        await rideRepo.updateStatus(ride.rideId, 'expired');
        expired++;
      }
    }

    logger.info('expireRides completed', { expired, completed, total: activeRides.length });
    return { expired, completed, total: activeRides.length };
  } catch (error) {
    logger.error('expireRides failed', { error: error.message });
    throw error;
  }
};

// ─── Task: Send Ride Reminders ──────────────────────────

/**
 * Find rides departing in ~1 hour and send push/email reminders
 * to both the driver and confirmed passengers.
 */
const sendRideReminders = async () => {
  const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
  const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
  const NotificationService = require('../../core/services/NotificationService');

  const rideRepo = new RideRepository();
  const bookingRepo = new BookingRepository();
  const notificationService = new NotificationService();

  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const targetDate = oneHourLater.toISOString().split('T')[0];
  const targetTime = oneHourLater.toTimeString().slice(0, 5);

  logger.info('Running sendRideReminders', { targetDate, targetTime });

  try {
    // Find rides departing around the target time (±10 min window)
    const upcomingRides = await rideRepo.findRidesDepartingAround(
      targetDate,
      targetTime,
      10 // ±10 minute window
    );

    let remindersSent = 0;

    for (const ride of upcomingRides) {
      // Remind the driver
      await notificationService.create({
        userId: ride.driverId,
        type: 'ride_reminder',
        title: 'Ride Starting Soon',
        message: `Your ride departs in approximately 1 hour at ${ride.departureTime}`,
        metadata: { rideId: ride.rideId },
      });
      remindersSent++;

      // Remind confirmed passengers
      const bookings = await bookingRepo.findConfirmedByRideId(ride.rideId);
      for (const booking of bookings) {
        await notificationService.create({
          userId: booking.passengerId,
          type: 'ride_reminder',
          title: 'Ride Starting Soon',
          message: `Your ride departs in approximately 1 hour. Please be at your pickup point by ${ride.departureTime}`,
          metadata: {
            rideId: ride.rideId,
            bookingId: booking.bookingId,
            pickupPoint: booking.pickupPointName,
          },
        });
        remindersSent++;
      }
    }

    logger.info('sendRideReminders completed', {
      ridesFound: upcomingRides.length,
      remindersSent,
    });
    return { ridesFound: upcomingRides.length, remindersSent };
  } catch (error) {
    logger.error('sendRideReminders failed', { error: error.message });
    throw error;
  }
};

// ─── Task: Cleanup Expired Sessions ─────────────────────

/**
 * Remove expired JWT sessions and blacklisted tokens
 * from Redis and DynamoDB session store.
 */
const cleanupSessions = async () => {
  const cacheService = require('../../infrastructure/cache').CacheService;

  logger.info('Running cleanupSessions');

  try {
    let cleaned = 0;

    // Redis handles TTL-based expiry automatically,
    // but we clean up any orphaned keys with a scan
    if (cacheService.isAvailable()) {
      const orphanedKeys = await cacheService.scanKeys('session:*');
      for (const key of orphanedKeys) {
        const session = await cacheService.get(key);
        if (!session) {
          await cacheService.delete(key);
          cleaned++;
        }
      }
    }

    logger.info('cleanupSessions completed', { cleaned });
    return { cleaned };
  } catch (error) {
    logger.error('cleanupSessions failed', { error: error.message });
    throw error;
  }
};

// ─── Task: Mark No-Shows ────────────────────────────────

/**
 * For rides that have completed but still have bookings
 * in "confirmed" status (passenger never showed up),
 * mark those bookings as no-show.
 */
const markNoShows = async () => {
  const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
  const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
  const NotificationService = require('../../core/services/NotificationService');

  const rideRepo = new RideRepository();
  const bookingRepo = new BookingRepository();
  const notificationService = new NotificationService();

  logger.info('Running markNoShows');

  try {
    // Find rides completed in the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentlyCompleted = await rideRepo.findCompletedAfter(twoHoursAgo.toISOString());

    let noShows = 0;

    for (const ride of recentlyCompleted) {
      const bookings = await bookingRepo.findByRideId(ride.rideId);
      const staleConfirmed = bookings.filter((b) => b.status === 'confirmed');

      for (const booking of staleConfirmed) {
        await bookingRepo.updateStatus(booking.bookingId, 'no_show');
        noShows++;

        // Notify the passenger
        await notificationService.create({
          userId: booking.passengerId,
          type: 'booking_no_show',
          title: 'Marked as No-Show',
          message: 'You were marked as a no-show for your booked ride. Repeated no-shows may affect your account standing.',
          metadata: { bookingId: booking.bookingId, rideId: ride.rideId },
        });
      }
    }

    logger.info('markNoShows completed', {
      ridesChecked: recentlyCompleted.length,
      noShows,
    });
    return { ridesChecked: recentlyCompleted.length, noShows };
  } catch (error) {
    logger.error('markNoShows failed', { error: error.message });
    throw error;
  }
};

// ─── Task: Generate Daily Report ────────────────────────

/**
 * Aggregate yesterday's stats into a summary record.
 * Useful for the admin dashboard and cash reconciliation.
 */
const generateDailyReport = async () => {
  const ReportingService = require('../../core/services/ReportingService');
  const reportingService = new ReportingService();

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  logger.info('Running generateDailyReport', { date: yesterday });

  try {
    const report = await reportingService.generateDailySummary(yesterday);

    logger.info('generateDailyReport completed', {
      date: yesterday,
      totalRides: report.totalRides,
      totalBookings: report.totalBookings,
      totalRevenue: report.totalRevenue,
    });
    return report;
  } catch (error) {
    logger.error('generateDailyReport failed', { error: error.message });
    throw error;
  }
};

// ─── Task: Cleanup Old Data ─────────────────────────────

/**
 * Archive or soft-delete records older than the retention period.
 * Notifications > 90 days, completed bookings > 365 days, etc.
 */
const cleanupOldData = async () => {
  const NotificationRepository = require('../../infrastructure/database/repositories/NotificationRepository');
  const notificationRepo = new NotificationRepository();

  logger.info('Running cleanupOldData');

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Delete read notifications older than 90 days
    const deletedNotifications = await notificationRepo.deleteReadBefore(ninetyDaysAgo);

    logger.info('cleanupOldData completed', { deletedNotifications });
    return { deletedNotifications };
  } catch (error) {
    logger.error('cleanupOldData failed', { error: error.message });
    throw error;
  }
};

// ─── Task Dispatcher ────────────────────────────────────

const TASKS = {
  expireRides,
  sendRideReminders,
  cleanupSessions,
  markNoShows,
  generateDailyReport,
  cleanupOldData,
};

// ─── Lambda Handler ─────────────────────────────────────

module.exports.handler = withMiddleware(
  'scheduled-handler',
  async (event) => {
    const taskName =
      (event.detail && event.detail.task) ||    // EventBridge rule
      event.task ||                               // Direct invocation
      null;

    // If no specific task, run all (useful for a nightly "run everything" rule)
    if (!taskName) {
      logger.info('Running ALL scheduled tasks');
      const results = {};

      for (const [name, fn] of Object.entries(TASKS)) {
        try {
          results[name] = await fn();
        } catch (error) {
          results[name] = { error: error.message };
          logger.error(`Task ${name} failed`, { error: error.message });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'All scheduled tasks executed',
          data: results,
        }),
      };
    }

    // Run a specific task
    const taskFn = TASKS[taskName];
    if (!taskFn) {
      logger.warn('Unknown scheduled task', { taskName });
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: { code: 'UNKNOWN_TASK', message: `Task "${taskName}" not found` },
        }),
      };
    }

    logger.info('Running scheduled task', { taskName });
    const result = await taskFn();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Task "${taskName}" completed`,
        data: result,
      }),
    };
  },
  { enableTimeoutGuard: true }
);
