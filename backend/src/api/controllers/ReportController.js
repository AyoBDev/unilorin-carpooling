/**
 * Report Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles reporting and analytics endpoints including
 * cash collection reports, driver payment summaries,
 * booking analytics, and platform statistics.
 *
 * Phase 1: Cash payment tracking and reconciliation.
 *
 * Path: src/api/controllers/ReportController.js
 *
 * @module controllers/ReportController
 */

const { ReportingService } = require('../../core/services');
const { success } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class ReportController {
  constructor() {
    this.reportingService = new ReportingService();

    // Driver reports
    this.getDriverCashReport = this.getDriverCashReport.bind(this);
    this.getDriverEarnings = this.getDriverEarnings.bind(this);
    this.getDriverSummary = this.getDriverSummary.bind(this);

    // Admin reports
    this.getDailyCashCollection = this.getDailyCashCollection.bind(this);
    this.getCashReconciliation = this.getCashReconciliation.bind(this);
    this.getBookingSummary = this.getBookingSummary.bind(this);
    this.getPlatformStatistics = this.getPlatformStatistics.bind(this);
    this.getDriverLeaderboard = this.getDriverLeaderboard.bind(this);
    this.getUserGrowth = this.getUserGrowth.bind(this);
    this.getRideAnalytics = this.getRideAnalytics.bind(this);
    this.getRevenueReport = this.getRevenueReport.bind(this);
  }

  // ─── DRIVER REPORTS ──────────────────────────────────────────

  /**
   * Get driver's cash collection report
   * GET /api/v1/reports/driver/cash
   */
  async getDriverCashReport(req, res, next) {
    try {
      const driverId = req.user.userId;
      const { startDate, endDate, page = 1, limit = 20 } = req.query;

      const report = await this.reportingService.getDriverCashReport(driverId, {
        startDate,
        endDate,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return success(res, 'Cash collection report', { report });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get driver's earnings summary
   * GET /api/v1/reports/driver/earnings
   */
  async getDriverEarnings(req, res, next) {
    try {
      const driverId = req.user.userId;
      const { period = '30days' } = req.query; // 'today', '7days', '30days', 'all'

      const earnings = await this.reportingService.getDriverEarnings(driverId, period);

      return success(res, 'Earnings summary', { earnings });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get driver's overall summary
   * GET /api/v1/reports/driver/summary
   */
  async getDriverSummary(req, res, next) {
    try {
      const driverId = req.user.userId;

      const summary = await this.reportingService.getDriverSummary(driverId);

      return success(res, 'Driver summary', { summary });
    } catch (error) {
      return next(error);
    }
  }

  // ─── ADMIN REPORTS ───────────────────────────────────────────

  /**
   * Admin: Get daily cash collection report
   * GET /api/v1/admin/reports/cash-collection
   */
  async getDailyCashCollection(req, res, next) {
    try {
      const { date, startDate, endDate } = req.query;

      const report = await this.reportingService.getDailyCashCollection({
        date,
        startDate,
        endDate,
      });

      logger.info('Cash collection report generated', { date });

      return success(res, 'Daily cash collection report', { report });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Cash reconciliation report
   * GET /api/v1/admin/reports/reconciliation
   */
  async getCashReconciliation(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const report = await this.reportingService.getCashReconciliation({
        startDate,
        endDate,
      });

      return success(res, 'Cash reconciliation report', { report });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Booking summary report
   * GET /api/v1/admin/reports/bookings
   */
  async getBookingSummary(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const report = await this.reportingService.getBookingSummary({
        startDate,
        endDate,
        groupBy, // 'day', 'week', 'month'
      });

      return success(res, 'Booking summary report', { report });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Platform statistics
   * GET /api/v1/admin/reports/statistics
   */
  async getPlatformStatistics(req, res, next) {
    try {
      const stats = await this.reportingService.getPlatformStatistics();

      return success(res, 'Platform statistics', { statistics: stats });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Driver leaderboard
   * GET /api/v1/admin/reports/driver-leaderboard
   */
  async getDriverLeaderboard(req, res, next) {
    try {
      const { period = '30days', sortBy = 'totalRides', limit = 20 } = req.query;

      const leaderboard = await this.reportingService.getDriverLeaderboard({
        period,
        sortBy, // 'totalRides', 'earnings', 'rating'
        limit: parseInt(limit, 10),
      });

      return success(res, 'Driver leaderboard', { leaderboard });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: User growth report
   * GET /api/v1/admin/reports/user-growth
   */
  async getUserGrowth(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'week' } = req.query;

      const report = await this.reportingService.getUserGrowthReport({
        startDate,
        endDate,
        groupBy,
      });

      return success(res, 'User growth report', { report });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Ride analytics
   * GET /api/v1/admin/reports/rides
   */
  async getRideAnalytics(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const report = await this.reportingService.getRideAnalytics({
        startDate,
        endDate,
        groupBy,
      });

      return success(res, 'Ride analytics', { report });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Revenue report
   * GET /api/v1/admin/reports/revenue
   */
  async getRevenueReport(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;

      const report = await this.reportingService.getRevenueReport({
        startDate,
        endDate,
        groupBy,
      });

      return success(res, 'Revenue report', { report });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ReportController();
