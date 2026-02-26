const RatingService = require('../../../../src/core/services/RatingService');
const { createMockUser, createMockBooking, createMockRating } = require('../../../helpers');

// Mock all dependencies
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../../src/shared/utils/dateTime', () => ({
  formatDate: jest.fn((d) => (d ? d.toISOString?.() || d : new Date().toISOString())),
  now: jest.fn(() => new Date()),
  isExpired: jest.fn(),
  addDays: jest.fn(() => new Date(Date.now() + 86400000 * 7)),
}));

const mockRatingRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByBooking: jest.fn(),
  findByBookingAndRater: jest.fn(),
  findByRater: jest.fn(),
  findByRatedUser: jest.fn(),
  findByType: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addReport: jest.fn(),
};

const mockBookingRepo = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockUserRepo = {
  findById: jest.fn(),
  updateProfile: jest.fn(),
};

jest.mock('../../../../src/infrastructure/database/repositories/RatingRepository', () => {
  return jest.fn().mockImplementation(() => mockRatingRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/BookingRepository', () => {
  return jest.fn().mockImplementation(() => mockBookingRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => mockUserRepo);
});

const { isExpired } = require('../../../../src/shared/utils/dateTime');

describe('RatingService', () => {
  let ratingService;

  beforeEach(() => {
    jest.clearAllMocks();
    ratingService = new RatingService();
  });

  // ==================== createRating ====================

  describe('createRating()', () => {
    const raterId = 'passenger-1';
    const driverId = 'driver-1';

    it('should create a driver rating successfully', async () => {
      const booking = createMockBooking({
        status: 'completed',
        passengerId: raterId,
        driverId,
        completedAt: new Date().toISOString(),
      });
      isExpired.mockReturnValue(false);
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockRatingRepo.findByBookingAndRater.mockResolvedValue(null);
      mockRatingRepo.create.mockImplementation((data) => Promise.resolve(data));
      mockRatingRepo.findByRatedUser.mockResolvedValue([]);

      const result = await ratingService.createRating(raterId, {
        bookingId: booking.bookingId,
        score: 5,
        comment: 'Excellent driver!',
        tags: ['Punctual', 'Safe Driver'],
      });

      expect(result.message).toBe('Rating submitted successfully');
      expect(result.rating).toBeDefined();
      expect(mockRatingRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should create a passenger rating (driver rates passenger)', async () => {
      const booking = createMockBooking({
        status: 'completed',
        passengerId: 'passenger-1',
        driverId,
        completedAt: new Date().toISOString(),
      });
      isExpired.mockReturnValue(false);
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockRatingRepo.findByBookingAndRater.mockResolvedValue(null);
      mockRatingRepo.create.mockImplementation((data) => Promise.resolve(data));
      mockRatingRepo.findByRatedUser.mockResolvedValue([]);

      const result = await ratingService.createRating(driverId, {
        bookingId: booking.bookingId,
        score: 4,
        comment: 'Good passenger',
      });

      expect(result.rating).toBeDefined();
    });

    it('should throw ValidationError for invalid score', async () => {
      await expect(
        ratingService.createRating(raterId, { bookingId: 'b1', score: 0 }),
      ).rejects.toThrow('Invalid rating score');

      await expect(
        ratingService.createRating(raterId, { bookingId: 'b1', score: 6 }),
      ).rejects.toThrow('Invalid rating score');
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findById.mockResolvedValue(null);

      await expect(
        ratingService.createRating(raterId, { bookingId: 'bad-id', score: 4 }),
      ).rejects.toThrow('Booking not found');
    });

    it('should throw BadRequestError when booking not completed', async () => {
      const booking = createMockBooking({ status: 'confirmed', passengerId: raterId });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(
        ratingService.createRating(raterId, { bookingId: booking.bookingId, score: 4 }),
      ).rejects.toThrow('only rate completed bookings');
    });

    it('should throw ForbiddenError when not a participant', async () => {
      const booking = createMockBooking({ status: 'completed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(
        ratingService.createRating('stranger', { bookingId: booking.bookingId, score: 4 }),
      ).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when rating window expired', async () => {
      const booking = createMockBooking({
        status: 'completed',
        passengerId: raterId,
        completedAt: new Date().toISOString(),
      });
      mockBookingRepo.findById.mockResolvedValue(booking);
      isExpired.mockReturnValue(true);

      await expect(
        ratingService.createRating(raterId, { bookingId: booking.bookingId, score: 4 }),
      ).rejects.toThrow('Rating window has expired');
    });

    it('should throw ConflictError when already rated', async () => {
      const booking = createMockBooking({
        status: 'completed',
        passengerId: raterId,
        completedAt: new Date().toISOString(),
      });
      isExpired.mockReturnValue(false);
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockRatingRepo.findByBookingAndRater.mockResolvedValue(createMockRating());

      await expect(
        ratingService.createRating(raterId, { bookingId: booking.bookingId, score: 4 }),
      ).rejects.toThrow('already rated');
    });
  });

  // ==================== updateRating ====================

  describe('updateRating()', () => {
    it('should update rating successfully', async () => {
      const rating = createMockRating({ raterId: 'user-1', ratedUserId: 'user-2' });
      isExpired.mockReturnValue(false);
      mockRatingRepo.findById.mockResolvedValue(rating);
      mockRatingRepo.update.mockResolvedValue({ ...rating, score: 3 });
      mockRatingRepo.findByRatedUser.mockResolvedValue([]);

      const result = await ratingService.updateRating(rating.ratingId, rating.raterId, { score: 3 });

      expect(result.message).toBe('Rating updated successfully');
    });

    it('should throw NotFoundError when rating not found', async () => {
      mockRatingRepo.findById.mockResolvedValue(null);

      await expect(ratingService.updateRating('bad-id', 'user-1', {})).rejects.toThrow('Rating not found');
    });

    it('should throw ForbiddenError when not the rater', async () => {
      const rating = createMockRating({ raterId: 'user-1' });
      mockRatingRepo.findById.mockResolvedValue(rating);

      await expect(ratingService.updateRating(rating.ratingId, 'other-user', {})).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when edit window expired', async () => {
      const rating = createMockRating({ raterId: 'user-1' });
      mockRatingRepo.findById.mockResolvedValue(rating);
      isExpired.mockReturnValue(true);

      await expect(
        ratingService.updateRating(rating.ratingId, rating.raterId, { score: 3 }),
      ).rejects.toThrow('edit window has expired');
    });
  });

  // ==================== deleteRating ====================

  describe('deleteRating()', () => {
    it('should delete rating successfully', async () => {
      const rating = createMockRating({ raterId: 'user-1', ratedUserId: 'user-2' });
      isExpired.mockReturnValue(false);
      mockRatingRepo.findById.mockResolvedValue(rating);
      mockRatingRepo.delete.mockResolvedValue();
      mockRatingRepo.findByRatedUser.mockResolvedValue([]);

      const result = await ratingService.deleteRating(rating.ratingId, rating.raterId);

      expect(result.message).toBe('Rating deleted successfully');
      expect(mockRatingRepo.delete).toHaveBeenCalledWith(rating.ratingId);
    });

    it('should throw NotFoundError when rating not found', async () => {
      mockRatingRepo.findById.mockResolvedValue(null);

      await expect(ratingService.deleteRating('bad-id', 'user-1')).rejects.toThrow('Rating not found');
    });

    it('should throw ForbiddenError when not the rater', async () => {
      const rating = createMockRating({ raterId: 'user-1' });
      mockRatingRepo.findById.mockResolvedValue(rating);

      await expect(ratingService.deleteRating(rating.ratingId, 'other-user')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when delete window expired', async () => {
      const rating = createMockRating({ raterId: 'user-1' });
      mockRatingRepo.findById.mockResolvedValue(rating);
      isExpired.mockReturnValue(true);

      await expect(ratingService.deleteRating(rating.ratingId, rating.raterId)).rejects.toThrow('delete window has expired');
    });
  });

  // ==================== getRatingById ====================

  describe('getRatingById()', () => {
    it('should return rating', async () => {
      const rating = createMockRating();
      mockRatingRepo.findById.mockResolvedValue(rating);

      const result = await ratingService.getRatingById(rating.ratingId, 'user-1');

      expect(result.ratingId).toBe(rating.ratingId);
    });

    it('should throw NotFoundError when not found', async () => {
      mockRatingRepo.findById.mockResolvedValue(null);

      await expect(ratingService.getRatingById('bad-id', 'user-1')).rejects.toThrow('Rating not found');
    });
  });

  // ==================== getUserRatings ====================

  describe('getUserRatings()', () => {
    it('should return paginated user ratings', async () => {
      const ratings = [
        createMockRating({ score: 5 }),
        createMockRating({ score: 3 }),
      ];
      mockRatingRepo.findByRatedUser.mockResolvedValue(ratings);

      const result = await ratingService.getUserRatings('user-1', { page: 1, limit: 10 });

      expect(result.ratings).toHaveLength(2);
      expect(result.statistics).toBeDefined();
      expect(result.pagination.totalCount).toBe(2);
    });

    it('should return given ratings when type is given', async () => {
      const ratings = [createMockRating()];
      mockRatingRepo.findByRater.mockResolvedValue(ratings);

      const result = await ratingService.getUserRatings('user-1', { type: 'given' });

      expect(result.ratings).toHaveLength(1);
      expect(mockRatingRepo.findByRater).toHaveBeenCalledWith('user-1');
    });
  });

  // ==================== getBookingRatings ====================

  describe('getBookingRatings()', () => {
    it('should return booking ratings for participant', async () => {
      const booking = createMockBooking({ status: 'completed' });
      const driverRating = createMockRating({ ratingType: 'driver_rating' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockRatingRepo.findByBooking.mockResolvedValue([driverRating]);

      const result = await ratingService.getBookingRatings(booking.bookingId, booking.passengerId);

      expect(result.driverRating).toBeDefined();
      expect(result.passengerRating).toBeNull();
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findById.mockResolvedValue(null);

      await expect(ratingService.getBookingRatings('bad-id', 'user-1')).rejects.toThrow('Booking not found');
    });

    it('should throw ForbiddenError when not a participant', async () => {
      const booking = createMockBooking();
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(ratingService.getBookingRatings(booking.bookingId, 'stranger')).rejects.toThrow('Not authorized');
    });
  });

  // ==================== getUserRatingSummary ====================

  describe('getUserRatingSummary()', () => {
    it('should return rating summary', async () => {
      const user = createMockUser({ isDriver: true, averageRating: 4.2, totalRatings: 8 });
      const ratings = [
        createMockRating({ ratingType: 'driver_rating', score: 5 }),
        createMockRating({ ratingType: 'driver_rating', score: 4 }),
        createMockRating({ ratingType: 'passenger_rating', score: 3 }),
      ];
      mockUserRepo.findById.mockResolvedValue(user);
      mockRatingRepo.findByRatedUser.mockResolvedValue(ratings);

      const result = await ratingService.getUserRatingSummary(user.userId);

      expect(result.overall).toBeDefined();
      expect(result.asDriver).toBeDefined();
      expect(result.asPassenger).toBeDefined();
      expect(result.recentRatings).toBeDefined();
      expect(result.topTags).toBeDefined();
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(ratingService.getUserRatingSummary('bad-id')).rejects.toThrow('User not found');
    });
  });

  // ==================== reportRating ====================

  describe('reportRating()', () => {
    it('should report rating about yourself', async () => {
      const rating = createMockRating({ ratedUserId: 'user-1' });
      mockRatingRepo.findById.mockResolvedValue(rating);
      mockRatingRepo.addReport.mockResolvedValue();
      mockRatingRepo.update.mockResolvedValue({ ...rating, isReported: true });

      const result = await ratingService.reportRating(rating.ratingId, 'user-1', {
        reason: 'Inappropriate',
        description: 'Contains offensive language',
      });

      expect(result.message).toContain('reported successfully');
      expect(result.reportId).toBeDefined();
    });

    it('should throw NotFoundError when rating not found', async () => {
      mockRatingRepo.findById.mockResolvedValue(null);

      await expect(ratingService.reportRating('bad-id', 'user-1', {})).rejects.toThrow('Rating not found');
    });

    it('should throw ForbiddenError when reporting someone else\'s rating', async () => {
      const rating = createMockRating({ ratedUserId: 'other-user' });
      mockRatingRepo.findById.mockResolvedValue(rating);

      await expect(
        ratingService.reportRating(rating.ratingId, 'user-1', { reason: 'test' }),
      ).rejects.toThrow('only report ratings about yourself');
    });
  });
});
