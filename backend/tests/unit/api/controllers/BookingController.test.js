/**
 * BookingController Unit Tests
 */

const mockService = {
  createBooking: jest.fn(),
  getBookingById: jest.fn(),
  getPassengerBookings: jest.fn(),
  cancelBooking: jest.fn(),
  confirmBooking: jest.fn(),
  getVerificationCode: jest.fn(),
  startRideForBooking: jest.fn(),
  completeBooking: jest.fn(),
  markNoShow: jest.fn(),
  getUpcomingBookings: jest.fn(),
  getPastBookings: jest.fn(),
  getBookingStatistics: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  BookingService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  created: jest.fn(),
  paginated: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/BookingController');
const { success, created, paginated } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext, createMockBooking } = require('../../../helpers/mockFactory');

describe('BookingController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── createBooking ─────────────────────────────────────
  describe('createBooking', () => {
    it('should create booking and call created', async () => {
      const booking = createMockBooking();
      mockService.createBooking.mockResolvedValue(booking);
      req = createMockReq({ user: { userId: 'p1' }, body: { rideId: 'r1', seats: 1 } });

      await controller.createBooking(req, res, next);

      expect(mockService.createBooking).toHaveBeenCalledWith('p1', expect.objectContaining({ paymentMethod: 'cash' }));
      expect(created).toHaveBeenCalledWith(res, expect.any(String), expect.objectContaining({ booking }));
    });

    it('should call next on error', async () => {
      const err = new Error('no seats');
      mockService.createBooking.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'p1' }, body: {} });

      await controller.createBooking(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getBooking ────────────────────────────────────────
  describe('getBooking', () => {
    it('should get booking and call success', async () => {
      const booking = createMockBooking();
      mockService.getBookingById.mockResolvedValue(booking);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'u1' } });

      await controller.getBooking(req, res, next);

      expect(mockService.getBookingById).toHaveBeenCalledWith('b1', 'u1');
      expect(success).toHaveBeenCalledWith(res, 'Booking details retrieved', { booking });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockService.getBookingById.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'u1' } });

      await controller.getBooking(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMyBookings ─────────────────────────────────────
  describe('getMyBookings', () => {
    it('should get bookings and call paginated', async () => {
      const result = { bookings: [], pagination: {} };
      mockService.getPassengerBookings.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { status: 'confirmed', page: '2', limit: '10' } });

      await controller.getMyBookings(req, res, next);

      expect(mockService.getPassengerBookings).toHaveBeenCalledWith('u1', expect.objectContaining({ page: 2, limit: 10 }));
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getPassengerBookings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getMyBookings(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── cancelBooking ─────────────────────────────────────
  describe('cancelBooking', () => {
    it('should cancel booking and call success', async () => {
      const result = { booking: {}, isLateCancellation: false };
      mockService.cancelBooking.mockResolvedValue(result);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'u1' }, body: { reason: 'changed plans' } });

      await controller.cancelBooking(req, res, next);

      expect(mockService.cancelBooking).toHaveBeenCalledWith('b1', 'u1', 'changed plans');
      expect(success).toHaveBeenCalledWith(res, 'Booking cancelled successfully', expect.objectContaining({ isLateCancellation: false }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.cancelBooking.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'u1' }, body: {} });

      await controller.cancelBooking(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── confirmBooking ────────────────────────────────────
  describe('confirmBooking', () => {
    it('should confirm booking and call success', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockService.confirmBooking.mockResolvedValue(booking);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' } });

      await controller.confirmBooking(req, res, next);

      expect(mockService.confirmBooking).toHaveBeenCalledWith('b1', 'd1');
      expect(success).toHaveBeenCalledWith(res, 'Booking confirmed', { booking });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.confirmBooking.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' } });

      await controller.confirmBooking(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getVerificationCode ───────────────────────────────
  describe('getVerificationCode', () => {
    it('should get code and call success', async () => {
      const verification = { verificationCode: '123456', expiresAt: '2026-03-01T10:00:00Z' };
      mockService.getVerificationCode.mockResolvedValue(verification);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'p1' } });

      await controller.getVerificationCode(req, res, next);

      expect(mockService.getVerificationCode).toHaveBeenCalledWith('b1', 'p1');
      expect(success).toHaveBeenCalledWith(res, 'Verification code retrieved', expect.objectContaining({ verificationCode: '123456' }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getVerificationCode.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'p1' } });

      await controller.getVerificationCode(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── verifyPassenger ───────────────────────────────────
  describe('verifyPassenger', () => {
    it('should verify passenger and call success', async () => {
      const result = { status: 'verified' };
      mockService.startRideForBooking.mockResolvedValue(result);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: { verificationCode: '123456' } });

      await controller.verifyPassenger(req, res, next);

      expect(mockService.startRideForBooking).toHaveBeenCalledWith('b1', 'd1', '123456');
      expect(success).toHaveBeenCalledWith(res, 'Passenger verified successfully', { booking: result });
    });

    it('should call next on error', async () => {
      const err = new Error('wrong code');
      mockService.startRideForBooking.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: { verificationCode: '000' } });

      await controller.verifyPassenger(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── startBooking ──────────────────────────────────────
  describe('startBooking', () => {
    it('should start booking and call success', async () => {
      const booking = { status: 'in_progress' };
      mockService.startRideForBooking.mockResolvedValue(booking);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: { verificationCode: '123456' } });

      await controller.startBooking(req, res, next);

      expect(mockService.startRideForBooking).toHaveBeenCalledWith('b1', 'd1', '123456');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.startRideForBooking.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: {} });

      await controller.startBooking(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── completeBooking ───────────────────────────────────
  describe('completeBooking', () => {
    it('should complete booking and call success', async () => {
      const result = { booking: {}, amount: 500 };
      mockService.completeBooking.mockResolvedValue(result);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: { cashReceived: true } });

      await controller.completeBooking(req, res, next);

      expect(mockService.completeBooking).toHaveBeenCalledWith('b1', 'd1', { cashReceived: true });
      expect(success).toHaveBeenCalledWith(res, expect.any(String), expect.objectContaining({ booking: result.booking }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.completeBooking.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: {} });

      await controller.completeBooking(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── markNoShow ────────────────────────────────────────
  describe('markNoShow', () => {
    it('should mark no-show and call success', async () => {
      const result = { status: 'no_show' };
      mockService.markNoShow.mockResolvedValue(result);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: { reason: 'did not show up' } });

      await controller.markNoShow(req, res, next);

      expect(mockService.markNoShow).toHaveBeenCalledWith('b1', 'd1', 'did not show up');
      expect(success).toHaveBeenCalledWith(res, 'Passenger marked as no-show', { booking: result });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.markNoShow.mockRejectedValue(err);
      req = createMockReq({ params: { bookingId: 'b1' }, user: { userId: 'd1' }, body: {} });

      await controller.markNoShow(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getUpcomingBookings ───────────────────────────────
  describe('getUpcomingBookings', () => {
    it('should get upcoming bookings and call success', async () => {
      const bookings = [{ bookingId: 'b1' }];
      mockService.getUpcomingBookings.mockResolvedValue(bookings);
      req = createMockReq({ user: { userId: 'u1' }, query: { role: 'passenger', limit: '5' } });

      await controller.getUpcomingBookings(req, res, next);

      expect(mockService.getUpcomingBookings).toHaveBeenCalledWith('u1', { role: 'passenger', limit: 5 });
      expect(success).toHaveBeenCalledWith(res, 'Upcoming bookings', { bookings });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUpcomingBookings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getUpcomingBookings(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getPastBookings ───────────────────────────────────
  describe('getPastBookings', () => {
    it('should get past bookings and call paginated', async () => {
      const result = { bookings: [], pagination: {} };
      mockService.getPastBookings.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { role: 'driver', page: '1', limit: '20' } });

      await controller.getPastBookings(req, res, next);

      expect(mockService.getPastBookings).toHaveBeenCalledWith('u1', { role: 'driver', page: 1, limit: 20 });
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getPastBookings.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getPastBookings(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getBookingStatistics ──────────────────────────────
  describe('getBookingStatistics', () => {
    it('should get statistics and call success', async () => {
      const stats = { totalBookings: 10 };
      mockService.getBookingStatistics.mockResolvedValue(stats);
      req = createMockReq({ user: { userId: 'u1' }, query: { role: 'passenger', period: '7days' } });

      await controller.getBookingStatistics(req, res, next);

      expect(mockService.getBookingStatistics).toHaveBeenCalledWith('u1', 'passenger', '7days');
      expect(success).toHaveBeenCalledWith(res, 'Booking statistics', { statistics: stats });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getBookingStatistics.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getBookingStatistics(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
