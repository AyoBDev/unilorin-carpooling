/**
 * Reporting Service
 * University of Ilorin Carpooling Platform
 *
 * Handles cash collection reports, driver payment summaries,
 * booking analytics, and reconciliation reports for Phase 1.
 *
 * @module services/ReportingService
 */

const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { logger } = require('../../shared/utils/logger');
const {
  formatDate,
  now,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseDate,
  getDaysBetween,
  formatDateReadable,
} = require('../../shared/utils/dateTime');
const { NotFoundError, BadRequestError } = require('../../shared/errors');
const { ERROR_CODES } = require('../../shared/constants/errors');

/**
 * Report types
 */
const REPORT_TYPE = {
  DAILY_CASH: 'daily_cash',
  DRIVER_SUMMARY: 'driver_summary',
  BOOKING_SUMMARY: 'booking_summary',
  CASH_RECONCILIATION: 'cash_reconciliation',
  PLATFORM_ANALYTICS: 'platform_analytics',
};

/**
 * Report periods
 */
const REPORT_PERIOD = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  THIS_WEEK: 'this_week',
  LAST_WEEK: 'last_week',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  CUSTOM: 'custom',
};

/**
 * ReportingService class
 * Manages reporting and analytics operations
 */
class ReportingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.rideRepository = new RideRepository();
    this.userRepository = new UserRepository();
    this.serviceName = 'ReportingService';
  }

  // ==================== Cash Collection Reports ====================

  /**
   * Get daily cash collection report
   * @param {string} driverId - Driver ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Promise<Object>} Daily cash report
   */
  async getDailyCashReport(driverId, date = null) {
    const reportDate = date ? parseDate(date) : now();
    const startDate = startOfDay(reportDate);
    const endDate = endOfDay(reportDate);

    logger.info('Generating daily cash report', {
      action: 'DAILY_CASH_REPORT',
      driverId,
      date: formatDate(startDate),
    });

    try {
      // Get completed bookings for the day
      const bookings = await this.bookingRepository.findByDriverAndDateRange(
        driverId,
        formatDate(startDate),
        formatDate(endDate),
      );

      const completedBookings = bookings.filter((b) => b.status === 'completed');
      const cashReceivedBookings = completedBookings.filter((b) => b.paymentStatus === 'confirmed');

      // Calculate totals
      const totalExpected = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalReceived = cashReceivedBookings.reduce(
        (sum, b) => sum + (b.amountReceived || b.totalAmount),
        0,
      );
      const totalWaived = completedBookings
        .filter((b) => b.paymentStatus === 'waived')
        .reduce((sum, b) => sum + b.totalAmount, 0);

      // Get ride statistics
      const rides = await this.rideRepository.findByDriverAndDateRange(
        driverId,
        formatDate(startDate),
        formatDate(endDate),
      );

      const completedRides = rides.filter((r) => r.status === 'completed');

      // Group bookings by ride
      const rideBreakdown = completedRides.map((ride) => {
        const rideBookings = completedBookings.filter((b) => b.rideId === ride.rideId);
        const rideTotal = rideBookings.reduce((sum, b) => sum + b.totalAmount, 0);
        const rideReceived = rideBookings
          .filter((b) => b.paymentStatus === 'confirmed')
          .reduce((sum, b) => sum + (b.amountReceived || b.totalAmount), 0);

        return {
          rideId: ride.rideId,
          departureTime: ride.departureTime,
          route: `${ride.startLocation?.name} → ${ride.endLocation?.name}`,
          passengers: rideBookings.length,
          seatsBooked: rideBookings.reduce((sum, b) => sum + b.seats, 0),
          expectedAmount: rideTotal,
          receivedAmount: rideReceived,
          bookings: rideBookings.map((b) => ({
            bookingId: b.bookingId,
            bookingReference: b.bookingReference,
            passengerName: `${b.passenger?.firstName} ${b.passenger?.lastName}`,
            seats: b.seats,
            amount: b.totalAmount,
            paymentStatus: b.paymentStatus,
            amountReceived: b.amountReceived,
          })),
        };
      });

      const report = {
        reportType: REPORT_TYPE.DAILY_CASH,
        driverId,
        date: formatDateReadable(startDate),
        generatedAt: formatDate(now()),
        summary: {
          totalRides: completedRides.length,
          totalBookings: completedBookings.length,
          totalPassengers: completedBookings.reduce((sum, b) => sum + b.seats, 0),
          totalExpected,
          totalReceived,
          totalWaived,
          collectionRate: totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0,
        },
        rides: rideBreakdown,
        pendingPayments: completedBookings
          .filter((b) => b.paymentStatus === 'pending')
          .map((b) => ({
            bookingId: b.bookingId,
            bookingReference: b.bookingReference,
            amount: b.totalAmount,
            passengerName: `${b.passenger?.firstName} ${b.passenger?.lastName}`,
          })),
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate daily cash report', {
        action: 'DAILY_CASH_REPORT_FAILED',
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get driver payment summary
   * @param {string} driverId - Driver ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Driver payment summary
   */
  async getDriverPaymentSummary(driverId, options = {}) {
    const { period = REPORT_PERIOD.THIS_MONTH, startDate, endDate } = options;

    const { start, end } = this._getDateRange(period, startDate, endDate);

    logger.info('Generating driver payment summary', {
      action: 'DRIVER_PAYMENT_SUMMARY',
      driverId,
      period,
      start: formatDate(start),
      end: formatDate(end),
    });

    try {
      // Verify driver exists
      const driver = await this.userRepository.findById(driverId);
      if (!driver) {
        throw new NotFoundError('Driver not found', ERROR_CODES.USER_NOT_FOUND);
      }

      if (!driver.isDriver) {
        throw new BadRequestError('User is not a driver', ERROR_CODES.USER_NOT_DRIVER);
      }

      // Get bookings for period
      const bookings = await this.bookingRepository.findByDriverAndDateRange(
        driverId,
        formatDate(start),
        formatDate(end),
      );

      // Get rides for period
      const rides = await this.rideRepository.findByDriverAndDateRange(
        driverId,
        formatDate(start),
        formatDate(end),
      );

      // Calculate statistics
      const completedBookings = bookings.filter((b) => b.status === 'completed');
      const cashReceived = completedBookings.filter((b) => b.paymentStatus === 'confirmed');
      const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
      const noShowBookings = bookings.filter((b) => b.status === 'no_show');

      const totalEarnings = cashReceived.reduce(
        (sum, b) => sum + (b.amountReceived || b.totalAmount),
        0,
      );
      const totalWaived = completedBookings
        .filter((b) => b.paymentStatus === 'waived')
        .reduce((sum, b) => sum + b.totalAmount, 0);

      // Daily breakdown
      const dailyBreakdown = this._getDailyBreakdown(completedBookings, start, end);

      // Route performance
      const routePerformance = this._getRoutePerformance(rides, completedBookings);

      const summary = {
        reportType: REPORT_TYPE.DRIVER_SUMMARY,
        driverId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        period: {
          type: period,
          start: formatDateReadable(start),
          end: formatDateReadable(end),
          days: getDaysBetween(start, end),
        },
        generatedAt: formatDate(now()),
        earnings: {
          totalEarnings,
          totalWaived,
          averagePerRide:
            completedBookings.length > 0 ? Math.round(totalEarnings / completedBookings.length) : 0,
          averagePerDay:
            getDaysBetween(start, end) > 0
              ? Math.round(totalEarnings / getDaysBetween(start, end))
              : 0,
        },
        rides: {
          total: rides.length,
          completed: rides.filter((r) => r.status === 'completed').length,
          cancelled: rides.filter((r) => r.status === 'cancelled').length,
          inProgress: rides.filter((r) => r.status === 'in_progress').length,
          completionRate:
            rides.length > 0
              ? Math.round(
                  (rides.filter((r) => r.status === 'completed').length / rides.length) * 100,
                )
              : 0,
        },
        bookings: {
          total: bookings.length,
          completed: completedBookings.length,
          cancelled: cancelledBookings.length,
          noShows: noShowBookings.length,
          totalSeats: completedBookings.reduce((sum, b) => sum + b.seats, 0),
        },
        payments: {
          confirmed: cashReceived.length,
          pending: completedBookings.filter((b) => b.paymentStatus === 'pending').length,
          waived: completedBookings.filter((b) => b.paymentStatus === 'waived').length,
          collectionRate:
            completedBookings.length > 0
              ? Math.round((cashReceived.length / completedBookings.length) * 100)
              : 0,
        },
        dailyBreakdown,
        routePerformance,
      };

      return summary;
    } catch (error) {
      logger.error('Failed to generate driver payment summary', {
        action: 'DRIVER_PAYMENT_SUMMARY_FAILED',
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Booking Reports ====================

  /**
   * Get booking summary report
   * @param {string} userId - User ID (passenger or driver)
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Booking summary
   */
  async getBookingSummary(userId, options = {}) {
    const {
      period = REPORT_PERIOD.THIS_MONTH,
      role = 'passenger', // 'passenger' or 'driver'
      startDate,
      endDate,
    } = options;

    const { start, end } = this._getDateRange(period, startDate, endDate);

    logger.info('Generating booking summary', {
      action: 'BOOKING_SUMMARY',
      userId,
      role,
      period,
    });

    try {
      let bookings;
      if (role === 'driver') {
        bookings = await this.bookingRepository.findByDriverAndDateRange(
          userId,
          formatDate(start),
          formatDate(end),
        );
      } else {
        bookings = await this.bookingRepository.findByPassengerAndDateRange(
          userId,
          formatDate(start),
          formatDate(end),
        );
      }

      // Status breakdown
      const statusBreakdown = {
        pending: bookings.filter((b) => b.status === 'pending').length,
        confirmed: bookings.filter((b) => b.status === 'confirmed').length,
        completed: bookings.filter((b) => b.status === 'completed').length,
        cancelled: bookings.filter((b) => b.status === 'cancelled').length,
        noShow: bookings.filter((b) => b.status === 'no_show').length,
      };

      // Payment breakdown (for passengers)
      const completedBookings = bookings.filter((b) => b.status === 'completed');
      const totalSpent = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);

      // Booking trends
      const weeklyTrend = this._getWeeklyTrend(bookings);

      const summary = {
        reportType: REPORT_TYPE.BOOKING_SUMMARY,
        userId,
        role,
        period: {
          type: period,
          start: formatDateReadable(start),
          end: formatDateReadable(end),
        },
        generatedAt: formatDate(now()),
        overview: {
          totalBookings: bookings.length,
          totalCompleted: completedBookings.length,
          totalSeats: bookings.reduce((sum, b) => sum + b.seats, 0),
          completionRate:
            bookings.length > 0
              ? Math.round((completedBookings.length / bookings.length) * 100)
              : 0,
        },
        statusBreakdown,
        financial:
          role === 'passenger'
            ? {
                totalSpent,
                averagePerRide:
                  completedBookings.length > 0
                    ? Math.round(totalSpent / completedBookings.length)
                    : 0,
              }
            : {
                totalEarned: completedBookings
                  .filter((b) => b.paymentStatus === 'confirmed')
                  .reduce((sum, b) => sum + (b.amountReceived || b.totalAmount), 0),
              },
        weeklyTrend,
        recentBookings: bookings.slice(0, 10).map((b) => ({
          bookingId: b.bookingId,
          bookingReference: b.bookingReference,
          date: b.rideDate,
          time: b.rideTime,
          status: b.status,
          amount: b.totalAmount,
          paymentStatus: b.paymentStatus,
        })),
      };

      return summary;
    } catch (error) {
      logger.error('Failed to generate booking summary', {
        action: 'BOOKING_SUMMARY_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Cash Reconciliation ====================

  /**
   * Get cash reconciliation report
   * @param {string} driverId - Driver ID
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Reconciliation report
   */
  async getCashReconciliation(driverId, options = {}) {
    const { period = REPORT_PERIOD.THIS_WEEK, startDate, endDate } = options;
    const { start, end } = this._getDateRange(period, startDate, endDate);

    logger.info('Generating cash reconciliation', {
      action: 'CASH_RECONCILIATION',
      driverId,
      period,
    });

    try {
      const bookings = await this.bookingRepository.findByDriverAndDateRange(
        driverId,
        formatDate(start),
        formatDate(end),
      );

      const completedBookings = bookings.filter((b) => b.status === 'completed');

      // Calculate discrepancies
      const reconciliationItems = completedBookings.map((b) => {
        const expected = b.totalAmount;
        const received = b.amountReceived || 0;
        const discrepancy = received - expected;

        return {
          bookingId: b.bookingId,
          bookingReference: b.bookingReference,
          date: b.rideDate,
          passengerName: `${b.passenger?.firstName} ${b.passenger?.lastName}`,
          expected,
          received,
          discrepancy,
          paymentStatus: b.paymentStatus,
          hasDiscrepancy: discrepancy !== 0 && b.paymentStatus === 'confirmed',
        };
      });

      const itemsWithDiscrepancy = reconciliationItems.filter((i) => i.hasDiscrepancy);
      const totalExpected = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalReceived = completedBookings
        .filter((b) => b.paymentStatus === 'confirmed')
        .reduce((sum, b) => sum + (b.amountReceived || b.totalAmount), 0);
      const totalDiscrepancy = itemsWithDiscrepancy.reduce((sum, i) => sum + i.discrepancy, 0);

      const report = {
        reportType: REPORT_TYPE.CASH_RECONCILIATION,
        driverId,
        period: {
          type: period,
          start: formatDateReadable(start),
          end: formatDateReadable(end),
        },
        generatedAt: formatDate(now()),
        summary: {
          totalTransactions: completedBookings.length,
          totalExpected,
          totalReceived,
          totalDiscrepancy,
          discrepancyCount: itemsWithDiscrepancy.length,
          isBalanced: totalDiscrepancy === 0,
        },
        items: reconciliationItems,
        discrepancies: itemsWithDiscrepancy,
        pendingCollections: completedBookings
          .filter((b) => b.paymentStatus === 'pending')
          .map((b) => ({
            bookingId: b.bookingId,
            bookingReference: b.bookingReference,
            amount: b.totalAmount,
            date: b.rideDate,
            passengerName: `${b.passenger?.firstName} ${b.passenger?.lastName}`,
          })),
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate cash reconciliation', {
        action: 'CASH_RECONCILIATION_FAILED',
        driverId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Platform Analytics (Admin) ====================

  /**
   * Get platform analytics
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Platform analytics
   */
  async getPlatformAnalytics(options = {}) {
    const { period = REPORT_PERIOD.THIS_MONTH, startDate, endDate } = options;
    const { start, end } = this._getDateRange(period, startDate, endDate);

    logger.info('Generating platform analytics', {
      action: 'PLATFORM_ANALYTICS',
      period,
    });

    try {
      // Get all bookings for period
      const bookings = await this.bookingRepository.findByDateRange(
        formatDate(start),
        formatDate(end),
      );

      // Get all rides for period
      const rides = await this.rideRepository.findByDateRange(formatDate(start), formatDate(end));

      // User statistics
      const userStats = await this.userRepository.getPlatformStatistics();

      // Calculate metrics
      const completedBookings = bookings.filter((b) => b.status === 'completed');
      const completedRides = rides.filter((r) => r.status === 'completed');
      const totalRevenue = completedBookings
        .filter((b) => b.paymentStatus === 'confirmed')
        .reduce((sum, b) => sum + (b.amountReceived || b.totalAmount), 0);

      // Daily active statistics
      const dailyStats = this._getDailyPlatformStats(bookings, rides, start, end);

      // Peak hours analysis
      const peakHours = this._analyzePeakHours(completedRides);

      // Popular routes
      const popularRoutes = this._analyzePopularRoutes(completedRides);

      const analytics = {
        reportType: REPORT_TYPE.PLATFORM_ANALYTICS,
        period: {
          type: period,
          start: formatDateReadable(start),
          end: formatDateReadable(end),
        },
        generatedAt: formatDate(now()),
        users: {
          totalUsers: userStats.totalUsers,
          totalDrivers: userStats.totalDrivers,
          verifiedDrivers: userStats.verifiedDrivers,
          newUsersThisPeriod: userStats.newUsersInPeriod,
          activeUsersThisPeriod: this._countUniqueUsers(bookings),
        },
        rides: {
          total: rides.length,
          completed: completedRides.length,
          cancelled: rides.filter((r) => r.status === 'cancelled').length,
          completionRate:
            rides.length > 0 ? Math.round((completedRides.length / rides.length) * 100) : 0,
          averageSeatsOffered:
            rides.length > 0
              ? Math.round(rides.reduce((sum, r) => sum + r.totalSeats, 0) / rides.length)
              : 0,
        },
        bookings: {
          total: bookings.length,
          completed: completedBookings.length,
          cancelled: bookings.filter((b) => b.status === 'cancelled').length,
          noShows: bookings.filter((b) => b.status === 'no_show').length,
          conversionRate: rides.length > 0 ? Math.round((bookings.length / rides.length) * 100) : 0,
        },
        financial: {
          totalRevenue,
          averageBookingValue:
            completedBookings.length > 0 ? Math.round(totalRevenue / completedBookings.length) : 0,
          totalSeatsBooked: bookings.reduce((sum, b) => sum + b.seats, 0),
        },
        trends: {
          daily: dailyStats,
          peakHours,
          popularRoutes,
        },
      };

      return analytics;
    } catch (error) {
      logger.error('Failed to generate platform analytics', {
        action: 'PLATFORM_ANALYTICS_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Export Reports ====================

  /**
   * Export report as CSV
   * @param {Object} report - Report data
   * @param {string} format - Export format (csv, json)
   * @returns {Promise<Object>} Exported data
   */
  async exportReport(report, format = 'csv') {
    try {
      if (format === 'csv') {
        return this._convertToCSV(report);
      }
      return {
        format: 'json',
        data: JSON.stringify(report, null, 2),
        filename: `report_${report.reportType}_${formatDate(now())}.json`,
      };
    } catch (error) {
      logger.error('Failed to export report', {
        action: 'REPORT_EXPORT_FAILED',
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Get date range based on period
   * @private
   */
  _getDateRange(period, customStart, customEnd) {
    const today = now();

    switch (period) {
      case REPORT_PERIOD.TODAY:
        return { start: startOfDay(today), end: endOfDay(today) };

      case REPORT_PERIOD.YESTERDAY: {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      }

      case REPORT_PERIOD.THIS_WEEK:
        return { start: startOfWeek(today), end: endOfWeek(today) };

      case REPORT_PERIOD.LAST_WEEK: {
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return { start: startOfWeek(lastWeek), end: endOfWeek(lastWeek) };
      }

      case REPORT_PERIOD.THIS_MONTH:
        return { start: startOfMonth(today), end: endOfMonth(today) };

      case REPORT_PERIOD.LAST_MONTH: {
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }

      case REPORT_PERIOD.CUSTOM:
        if (!customStart || !customEnd) {
          throw new BadRequestError(
            'Custom date range requires start and end dates',
            ERROR_CODES.INVALID_DATE_RANGE,
          );
        }
        return {
          start: startOfDay(parseDate(customStart)),
          end: endOfDay(parseDate(customEnd)),
        };

      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  }

  /**
   * Get daily breakdown
   * @private
   */
  _getDailyBreakdown(bookings, start, end) {
    const days = getDaysBetween(start, end);
    const breakdown = [];

    for (let i = 0; i < days; i += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date).split('T')[0];

      const dayBookings = bookings.filter(
        (b) => b.rideDate === dateStr || b.completedAt?.startsWith(dateStr),
      );

      breakdown.push({
        date: dateStr,
        bookings: dayBookings.length,
        earnings: dayBookings
          .filter((b) => b.paymentStatus === 'confirmed')
          .reduce((sum, b) => sum + (b.amountReceived || b.totalAmount), 0),
        seats: dayBookings.reduce((sum, b) => sum + b.seats, 0),
      });
    }

    return breakdown;
  }

  /**
   * Get route performance
   * @private
   */
  _getRoutePerformance(rides, bookings) {
    const routeMap = new Map();

    rides.forEach((ride) => {
      const routeKey = `${ride.startLocation?.name} → ${ride.endLocation?.name}`;
      const rideBookings = bookings.filter((b) => b.rideId === ride.rideId);

      if (!routeMap.has(routeKey)) {
        routeMap.set(routeKey, {
          route: routeKey,
          rides: 0,
          bookings: 0,
          earnings: 0,
          seats: 0,
        });
      }

      const stats = routeMap.get(routeKey);
      stats.rides += 1;
      stats.bookings += rideBookings.length;
      stats.seats += rideBookings.reduce((sum, b) => sum + b.seats, 0);
      stats.earnings += rideBookings
        .filter((b) => b.paymentStatus === 'confirmed')
        .reduce((sum, b) => sum + (b.amountReceived || b.totalAmount), 0);
    });

    return Array.from(routeMap.values())
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 10);
  }

  /**
   * Get weekly trend
   * @private
   */
  _getWeeklyTrend(bookings) {
    const weeks = {};

    bookings.forEach((b) => {
      const date = parseDate(b.rideDate || b.createdAt);
      const weekStart = startOfWeek(date);
      const weekKey = formatDate(weekStart).split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = { week: weekKey, bookings: 0, completed: 0 };
      }

      weeks[weekKey].bookings += 1;
      if (b.status === 'completed') {
        weeks[weekKey].completed += 1;
      }
    });

    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * Get daily platform stats
   * @private
   */
  _getDailyPlatformStats(bookings, rides, start, end) {
    const days = getDaysBetween(start, end);
    const stats = [];

    for (let i = 0; i < Math.min(days, 31); i += 1) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date).split('T')[0];

      const dayBookings = bookings.filter((b) => b.rideDate === dateStr);
      const dayRides = rides.filter((r) => r.departureDate === dateStr);

      stats.push({
        date: dateStr,
        rides: dayRides.length,
        bookings: dayBookings.length,
        completedRides: dayRides.filter((r) => r.status === 'completed').length,
        completedBookings: dayBookings.filter((b) => b.status === 'completed').length,
      });
    }

    return stats;
  }

  /**
   * Analyze peak hours
   * @private
   */
  _analyzePeakHours(rides) {
    const hourCounts = {};

    rides.forEach((ride) => {
      const hour = parseInt(ride.departureTime?.split(':')[0] || '0', 10);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: parseInt(hour, 10),
        timeRange: `${hour}:00 - ${hour}:59`,
        rides: count,
      }))
      .sort((a, b) => b.rides - a.rides)
      .slice(0, 5);
  }

  /**
   * Analyze popular routes
   * @private
   */
  _analyzePopularRoutes(rides) {
    const routeCounts = {};

    rides.forEach((ride) => {
      const route = `${ride.startLocation?.name || 'Unknown'} → ${ride.endLocation?.name || 'Unknown'}`;
      routeCounts[route] = (routeCounts[route] || 0) + 1;
    });

    return Object.entries(routeCounts)
      .map(([route, count]) => ({ route, rides: count }))
      .sort((a, b) => b.rides - a.rides)
      .slice(0, 10);
  }

  /**
   * Count unique users
   * @private
   */
  _countUniqueUsers(bookings) {
    const uniqueUsers = new Set();
    bookings.forEach((b) => {
      uniqueUsers.add(b.passengerId);
      uniqueUsers.add(b.driverId);
    });
    return uniqueUsers.size;
  }

  /**
   * Convert report to CSV
   * @private
   */
  _convertToCSV(report) {
    // Simplified CSV conversion
    let csv = '';
    const items = report.items || report.rides || report.recentBookings || [];

    if (items.length === 0) {
      return {
        format: 'csv',
        data: 'No data available',
        filename: `report_${report.reportType}_${formatDate(now())}.csv`,
      };
    }

    // Headers
    const headers = Object.keys(items[0]);
    csv += `${headers.join(',')}\n`;

    // Rows
    items.forEach((item) => {
      const row = headers.map((h) => {
        const value = item[h];
        if (typeof value === 'object') return JSON.stringify(value);
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return value;
      });
      csv += `${row.join(',')}\n`;
    });

    return {
      format: 'csv',
      data: csv,
      filename: `report_${report.reportType}_${formatDate(now())}.csv`,
    };
  }
}

module.exports = ReportingService;
