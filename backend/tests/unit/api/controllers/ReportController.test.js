/**
 * ReportController Unit Tests
 */

const mockService = {
  getDailyCashReport: jest.fn(),
  getDriverEarnings: jest.fn(),
  getDriverPaymentSummary: jest.fn(),
  getDailyCashCollection: jest.fn(),
  getCashReconciliation: jest.fn(),
  getBookingSummary: jest.fn(),
  getPlatformAnalytics: jest.fn(),
  getDriverLeaderboard: jest.fn(),
  getUserGrowth: jest.fn(),
  getRideAnalytics: jest.fn(),
  getRevenueReport: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  ReportingService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/ReportController');
const { success } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext } = require('../../../helpers/mockFactory');

describe('ReportController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── getDriverCashReport ───────────────────────────────
  describe('getDriverCashReport', () => {
    it('should get driver cash report and call success', async () => {
      const report = { totalCash: 5000, rideCount: 10 };
      mockService.getDailyCashReport.mockResolvedValue(report);
      req = createMockReq({ user: { userId: 'd1' }, query: { date: '2026-02-27' } });

      await controller.getDriverCashReport(req, res, next);

      expect(mockService.getDailyCashReport).toHaveBeenCalledWith('d1', '2026-02-27');
      expect(success).toHaveBeenCalledWith(res, 'Cash collection report', { report });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing date param', async () => {
      const report = { totalCash: 5000 };
      mockService.getDailyCashReport.mockResolvedValue(report);
      req = createMockReq({ user: { userId: 'd1' }, query: {} });

      await controller.getDriverCashReport(req, res, next);

      expect(mockService.getDailyCashReport).toHaveBeenCalledWith('d1', undefined);
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDailyCashReport.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' }, query: {} });

      await controller.getDriverCashReport(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getDriverEarnings ─────────────────────────────────
  describe('getDriverEarnings', () => {
    it('should get driver earnings with default period and call success', async () => {
      const earnings = { total: 25000, rides: 50 };
      mockService.getDriverEarnings.mockResolvedValue(earnings);
      req = createMockReq({ user: { userId: 'd1' }, query: {} });

      await controller.getDriverEarnings(req, res, next);

      expect(mockService.getDriverEarnings).toHaveBeenCalledWith('d1', '30days');
      expect(success).toHaveBeenCalledWith(res, 'Earnings summary', { earnings });
    });

    it('should pass custom period', async () => {
      const earnings = { total: 3000 };
      mockService.getDriverEarnings.mockResolvedValue(earnings);
      req = createMockReq({ user: { userId: 'd1' }, query: { period: '7days' } });

      await controller.getDriverEarnings(req, res, next);

      expect(mockService.getDriverEarnings).toHaveBeenCalledWith('d1', '7days');
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDriverEarnings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' }, query: {} });

      await controller.getDriverEarnings(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getDriverSummary ──────────────────────────────────
  describe('getDriverSummary', () => {
    it('should get driver summary and call success', async () => {
      const summary = { totalRides: 100, totalEarnings: 50000, averageRating: 4.7 };
      mockService.getDriverPaymentSummary.mockResolvedValue(summary);
      req = createMockReq({ user: { userId: 'd1' } });

      await controller.getDriverSummary(req, res, next);

      expect(mockService.getDriverPaymentSummary).toHaveBeenCalledWith('d1');
      expect(success).toHaveBeenCalledWith(res, 'Driver summary', { summary });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDriverPaymentSummary.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' } });

      await controller.getDriverSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getDailyCashCollection ────────────────────────────
  describe('getDailyCashCollection', () => {
    it('should get daily cash collection and call success', async () => {
      const report = { totalCash: 200000, driverCount: 20 };
      mockService.getDailyCashCollection.mockResolvedValue(report);
      req = createMockReq({ query: { date: '2026-02-27' } });

      await controller.getDailyCashCollection(req, res, next);

      expect(mockService.getDailyCashCollection).toHaveBeenCalledWith({
        date: '2026-02-27',
        startDate: undefined,
        endDate: undefined,
      });
      expect(success).toHaveBeenCalledWith(res, 'Daily cash collection report', { report });
    });

    it('should pass date range when provided', async () => {
      const report = { totalCash: 1000000 };
      mockService.getDailyCashCollection.mockResolvedValue(report);
      req = createMockReq({ query: { startDate: '2026-02-01', endDate: '2026-02-28' } });

      await controller.getDailyCashCollection(req, res, next);

      expect(mockService.getDailyCashCollection).toHaveBeenCalledWith({
        date: undefined,
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDailyCashCollection.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getDailyCashCollection(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getCashReconciliation ─────────────────────────────
  describe('getCashReconciliation', () => {
    it('should get cash reconciliation and call success', async () => {
      const report = { reconciled: true, discrepancies: 0 };
      mockService.getCashReconciliation.mockResolvedValue(report);
      req = createMockReq({ query: { startDate: '2026-02-01', endDate: '2026-02-28' } });

      await controller.getCashReconciliation(req, res, next);

      expect(mockService.getCashReconciliation).toHaveBeenCalledWith({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });
      expect(success).toHaveBeenCalledWith(res, 'Cash reconciliation report', { report });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getCashReconciliation.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getCashReconciliation(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getBookingSummary ─────────────────────────────────
  describe('getBookingSummary', () => {
    it('should get booking summary with defaults and call success', async () => {
      const report = { total: 500, completed: 480 };
      mockService.getBookingSummary.mockResolvedValue(report);
      req = createMockReq({ query: {} });

      await controller.getBookingSummary(req, res, next);

      expect(mockService.getBookingSummary).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        groupBy: 'day',
      });
      expect(success).toHaveBeenCalledWith(res, 'Booking summary report', { report });
    });

    it('should pass groupBy when provided', async () => {
      const report = { total: 500 };
      mockService.getBookingSummary.mockResolvedValue(report);
      req = createMockReq({ query: { groupBy: 'month' } });

      await controller.getBookingSummary(req, res, next);

      expect(mockService.getBookingSummary).toHaveBeenCalledWith(expect.objectContaining({ groupBy: 'month' }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getBookingSummary.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getBookingSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getPlatformStatistics ─────────────────────────────
  describe('getPlatformStatistics', () => {
    it('should get platform statistics and call success', async () => {
      const stats = { totalUsers: 500, activeRides: 12 };
      mockService.getPlatformAnalytics.mockResolvedValue(stats);
      req = createMockReq({});

      await controller.getPlatformStatistics(req, res, next);

      expect(mockService.getPlatformAnalytics).toHaveBeenCalled();
      expect(success).toHaveBeenCalledWith(res, 'Platform statistics', { statistics: stats });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getPlatformAnalytics.mockRejectedValue(err);
      req = createMockReq({});

      await controller.getPlatformStatistics(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getDriverLeaderboard ──────────────────────────────
  describe('getDriverLeaderboard', () => {
    it('should get driver leaderboard with defaults and call success', async () => {
      const leaderboard = [{ driverId: 'd1', rank: 1 }];
      mockService.getDriverLeaderboard.mockResolvedValue(leaderboard);
      req = createMockReq({ query: {} });

      await controller.getDriverLeaderboard(req, res, next);

      expect(mockService.getDriverLeaderboard).toHaveBeenCalledWith({
        period: '30days',
        sortBy: 'totalRides',
        limit: 20,
      });
      expect(success).toHaveBeenCalledWith(res, 'Driver leaderboard', { leaderboard });
    });

    it('should respect custom query params', async () => {
      mockService.getDriverLeaderboard.mockResolvedValue([]);
      req = createMockReq({ query: { period: '7days', sortBy: 'earnings', limit: '10' } });

      await controller.getDriverLeaderboard(req, res, next);

      expect(mockService.getDriverLeaderboard).toHaveBeenCalledWith({
        period: '7days',
        sortBy: 'earnings',
        limit: 10,
      });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDriverLeaderboard.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getDriverLeaderboard(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getUserGrowth ─────────────────────────────────────
  describe('getUserGrowth', () => {
    it('should get user growth and call success', async () => {
      const report = { periods: [], growthRate: 5.2 };
      mockService.getUserGrowth.mockResolvedValue(report);
      req = createMockReq({ query: { startDate: '2026-01-01', endDate: '2026-02-28', groupBy: 'week' } });

      await controller.getUserGrowth(req, res, next);

      expect(mockService.getUserGrowth).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-02-28',
        groupBy: 'week',
      });
      expect(success).toHaveBeenCalledWith(res, 'User growth report', { report });
    });

    it('should use default groupBy', async () => {
      mockService.getUserGrowth.mockResolvedValue({});
      req = createMockReq({ query: {} });

      await controller.getUserGrowth(req, res, next);

      expect(mockService.getUserGrowth).toHaveBeenCalledWith(expect.objectContaining({ groupBy: 'week' }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserGrowth.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getUserGrowth(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRideAnalytics ──────────────────────────────────
  describe('getRideAnalytics', () => {
    it('should get ride analytics and call success', async () => {
      const report = { totalRides: 300, avgOccupancy: 3.2 };
      mockService.getRideAnalytics.mockResolvedValue(report);
      req = createMockReq({ query: { startDate: '2026-02-01', endDate: '2026-02-28', groupBy: 'day' } });

      await controller.getRideAnalytics(req, res, next);

      expect(mockService.getRideAnalytics).toHaveBeenCalledWith({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        groupBy: 'day',
      });
      expect(success).toHaveBeenCalledWith(res, 'Ride analytics', { report });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getRideAnalytics.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getRideAnalytics(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRevenueReport ──────────────────────────────────
  describe('getRevenueReport', () => {
    it('should get revenue report and call success', async () => {
      const report = { totalRevenue: 500000, currency: 'NGN' };
      mockService.getRevenueReport.mockResolvedValue(report);
      req = createMockReq({ query: { startDate: '2026-02-01', endDate: '2026-02-28', groupBy: 'week' } });

      await controller.getRevenueReport(req, res, next);

      expect(mockService.getRevenueReport).toHaveBeenCalledWith({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        groupBy: 'week',
      });
      expect(success).toHaveBeenCalledWith(res, 'Revenue report', { report });
    });

    it('should use default groupBy when not provided', async () => {
      mockService.getRevenueReport.mockResolvedValue({});
      req = createMockReq({ query: {} });

      await controller.getRevenueReport(req, res, next);

      expect(mockService.getRevenueReport).toHaveBeenCalledWith(expect.objectContaining({ groupBy: 'day' }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getRevenueReport.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getRevenueReport(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
