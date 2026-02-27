/**
 * RatingController Unit Tests
 */

const mockService = {
  createRating: jest.fn(),
  getRatingById: jest.fn(),
  updateRating: jest.fn(),
  getUserRatings: jest.fn(),
  getUserRatingSummary: jest.fn(),
  getUnratedBookings: jest.fn(),
  reportRating: jest.fn(),
  getReliabilityScore: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  RatingService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  created: jest.fn(),
  paginated: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/RatingController');
const { success, created, paginated } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext, createMockRating } = require('../../../helpers/mockFactory');

describe('RatingController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── createRating ──────────────────────────────────────
  describe('createRating', () => {
    it('should create rating and call created', async () => {
      const rating = createMockRating();
      mockService.createRating.mockResolvedValue(rating);
      req = createMockReq({
        user: { userId: 'u1' },
        body: { bookingId: 'b1', score: 5, comment: 'Great ride', ratingType: 'driver_rating' },
      });

      await controller.createRating(req, res, next);

      expect(mockService.createRating).toHaveBeenCalledWith('u1', {
        bookingId: 'b1',
        score: 5,
        comment: 'Great ride',
        ratingType: 'driver_rating',
      });
      expect(created).toHaveBeenCalledWith(
        res,
        expect.stringContaining('Rating submitted'),
        { rating },
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('already rated');
      mockService.createRating.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.createRating(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRating ─────────────────────────────────────────
  describe('getRating', () => {
    it('should get rating and call success', async () => {
      const rating = createMockRating();
      mockService.getRatingById.mockResolvedValue(rating);
      req = createMockReq({ params: { ratingId: 'r1' } });

      await controller.getRating(req, res, next);

      expect(mockService.getRatingById).toHaveBeenCalledWith('r1');
      expect(success).toHaveBeenCalledWith(res, 'Rating retrieved', { rating });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockService.getRatingById.mockRejectedValue(err);
      req = createMockReq({ params: { ratingId: 'bad' } });

      await controller.getRating(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updateRating ──────────────────────────────────────
  describe('updateRating', () => {
    it('should update rating and call success', async () => {
      const rating = createMockRating({ score: 4 });
      mockService.updateRating.mockResolvedValue(rating);
      req = createMockReq({
        params: { ratingId: 'r1' },
        user: { userId: 'u1' },
        body: { score: 4, comment: 'Updated' },
      });

      await controller.updateRating(req, res, next);

      expect(mockService.updateRating).toHaveBeenCalledWith('r1', 'u1', { score: 4, comment: 'Updated' });
      expect(success).toHaveBeenCalledWith(res, 'Rating updated', { rating });
    });

    it('should call next on error', async () => {
      const err = new Error('cannot update');
      mockService.updateRating.mockRejectedValue(err);
      req = createMockReq({ params: { ratingId: 'r1' }, user: { userId: 'u1' }, body: {} });

      await controller.updateRating(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getUserRatings ────────────────────────────────────
  describe('getUserRatings', () => {
    it('should get user ratings and call paginated', async () => {
      const result = { ratings: [], pagination: { page: 1, total: 0 } };
      mockService.getUserRatings.mockResolvedValue(result);
      req = createMockReq({
        params: { userId: 'u2' },
        query: { ratingType: 'driver_rating', page: '2', limit: '10' },
      });

      await controller.getUserRatings(req, res, next);

      expect(mockService.getUserRatings).toHaveBeenCalledWith('u2', {
        ratingType: 'driver_rating',
        page: 2,
        limit: 10,
      });
      expect(paginated).toHaveBeenCalledWith(res, 'User ratings retrieved', result.ratings, result.pagination);
    });

    it('should use defaults when no query params', async () => {
      const result = { ratings: [], pagination: {} };
      mockService.getUserRatings.mockResolvedValue(result);
      req = createMockReq({ params: { userId: 'u2' }, query: {} });

      await controller.getUserRatings(req, res, next);

      expect(mockService.getUserRatings).toHaveBeenCalledWith('u2', {
        ratingType: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserRatings.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' }, query: {} });

      await controller.getUserRatings(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMyRatingsGiven ─────────────────────────────────
  describe('getMyRatingsGiven', () => {
    it('should get given ratings and call paginated', async () => {
      const result = { ratings: [], pagination: {} };
      mockService.getUserRatings.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { page: '1', limit: '20' } });

      await controller.getMyRatingsGiven(req, res, next);

      expect(mockService.getUserRatings).toHaveBeenCalledWith('u1', {
        type: 'given',
        page: 1,
        limit: 20,
      });
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserRatings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getMyRatingsGiven(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMyRatingsReceived ──────────────────────────────
  describe('getMyRatingsReceived', () => {
    it('should get received ratings and call paginated', async () => {
      const result = { ratings: [], pagination: {} };
      mockService.getUserRatings.mockResolvedValue(result);
      req = createMockReq({
        user: { userId: 'u1' },
        query: { ratingType: 'passenger_rating', page: '1', limit: '20' },
      });

      await controller.getMyRatingsReceived(req, res, next);

      expect(mockService.getUserRatings).toHaveBeenCalledWith('u1', {
        type: 'received',
        ratingType: 'passenger_rating',
        page: 1,
        limit: 20,
      });
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserRatings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getMyRatingsReceived(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRatingAnalytics ────────────────────────────────
  describe('getRatingAnalytics', () => {
    it('should get analytics and call success', async () => {
      const analytics = { averageScore: 4.5, totalRatings: 20 };
      mockService.getUserRatingSummary.mockResolvedValue(analytics);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getRatingAnalytics(req, res, next);

      expect(mockService.getUserRatingSummary).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'Rating analytics', { analytics });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserRatingSummary.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getRatingAnalytics(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getUnratedBookings ────────────────────────────────
  describe('getUnratedBookings', () => {
    it('should get unrated bookings and call success', async () => {
      const unrated = [{ bookingId: 'b1' }];
      mockService.getUnratedBookings.mockResolvedValue(unrated);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getUnratedBookings(req, res, next);

      expect(mockService.getUnratedBookings).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'Unrated bookings', { bookings: unrated });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUnratedBookings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getUnratedBookings(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── reportRating ──────────────────────────────────────
  describe('reportRating', () => {
    it('should report rating and call success', async () => {
      mockService.reportRating.mockResolvedValue();
      req = createMockReq({
        params: { ratingId: 'r1' },
        user: { userId: 'u1' },
        body: { reason: 'offensive', details: 'Inappropriate comment' },
      });

      await controller.reportRating(req, res, next);

      expect(mockService.reportRating).toHaveBeenCalledWith('r1', 'u1', {
        reason: 'offensive',
        details: 'Inappropriate comment',
      });
      expect(success).toHaveBeenCalledWith(res, expect.stringContaining('reported'));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.reportRating.mockRejectedValue(err);
      req = createMockReq({ params: { ratingId: 'r1' }, user: { userId: 'u1' }, body: {} });

      await controller.reportRating(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getReliabilityScore ───────────────────────────────
  describe('getReliabilityScore', () => {
    it('should get reliability score and call success', async () => {
      const reliability = { score: 92, punctuality: 95, cancellationRate: 3 };
      mockService.getReliabilityScore.mockResolvedValue(reliability);
      req = createMockReq({ params: { userId: 'u2' } });

      await controller.getReliabilityScore(req, res, next);

      expect(mockService.getReliabilityScore).toHaveBeenCalledWith('u2');
      expect(success).toHaveBeenCalledWith(res, 'Reliability score', { reliability });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getReliabilityScore.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' } });

      await controller.getReliabilityScore(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
