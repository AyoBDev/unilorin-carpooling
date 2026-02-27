/**
 * RideController Unit Tests
 */

const mockRideService = {
  createRide: jest.fn(),
  getRideById: jest.fn(),
  updateRide: jest.fn(),
  cancelRide: jest.fn(),
  searchRides: jest.fn(),
  getAvailableRides: jest.fn(),
  getRidesByDriver: jest.fn(),
  startRide: jest.fn(),
  completeRide: jest.fn(),
  addPickupPoint: jest.fn(),
  removePickupPoint: jest.fn(),
  reorderPickupPoints: jest.fn(),
  getPickupPoints: jest.fn(),
  createRecurringRide: jest.fn(),
  getRecurringRidesByDriver: jest.fn(),
  cancelRecurringRides: jest.fn(),
  getRideBookings: jest.fn(),
  getRidePassengers: jest.fn(),
  getPopularRoutes: jest.fn(),
};

const mockMatchingService = {
  findMatchingRides: jest.fn(),
  getSuggestions: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  RideService: jest.fn().mockImplementation(() => mockRideService),
  MatchingService: jest.fn().mockImplementation(() => mockMatchingService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  created: jest.fn(),
  paginated: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/RideController');
const { success, created, paginated } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext, createMockRide } = require('../../../helpers/mockFactory');

describe('RideController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── createRide ────────────────────────────────────────
  describe('createRide', () => {
    it('should create ride and call created', async () => {
      const ride = createMockRide();
      mockRideService.createRide.mockResolvedValue(ride);
      req = createMockReq({ user: { userId: 'd1' }, body: { departureDate: '2026-03-01' } });

      await controller.createRide(req, res, next);

      expect(mockRideService.createRide).toHaveBeenCalledWith('d1', req.body);
      expect(created).toHaveBeenCalledWith(res, 'Ride offer created successfully', { ride });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.createRide.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' }, body: {} });

      await controller.createRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRide ───────────────────────────────────────────
  describe('getRide', () => {
    it('should get ride and call success', async () => {
      const ride = createMockRide();
      mockRideService.getRideById.mockResolvedValue(ride);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'u1' } });

      await controller.getRide(req, res, next);

      expect(mockRideService.getRideById).toHaveBeenCalledWith('r1', 'u1');
      expect(success).toHaveBeenCalledWith(res, 'Ride details retrieved', { ride });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockRideService.getRideById.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'u1' } });

      await controller.getRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updateRide ────────────────────────────────────────
  describe('updateRide', () => {
    it('should update ride and call success', async () => {
      const ride = createMockRide();
      mockRideService.updateRide.mockResolvedValue(ride);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: { pricePerSeat: 600 } });

      await controller.updateRide(req, res, next);

      expect(mockRideService.updateRide).toHaveBeenCalledWith('r1', 'd1', req.body);
      expect(success).toHaveBeenCalledWith(res, 'Ride updated successfully', { ride });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.updateRide.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: {} });

      await controller.updateRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── cancelRide ────────────────────────────────────────
  describe('cancelRide', () => {
    it('should cancel ride and call success', async () => {
      const result = { ride: {}, affectedBookings: 2 };
      mockRideService.cancelRide.mockResolvedValue(result);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: { reason: 'flat tire' } });

      await controller.cancelRide(req, res, next);

      expect(mockRideService.cancelRide).toHaveBeenCalledWith('r1', 'd1', 'flat tire');
      expect(success).toHaveBeenCalledWith(res, 'Ride cancelled successfully', expect.objectContaining({ affectedBookings: 2 }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.cancelRide.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: {} });

      await controller.cancelRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── searchRides ───────────────────────────────────────
  describe('searchRides', () => {
    it('should search rides and call paginated', async () => {
      const result = { rides: [], pagination: { page: 1 } };
      mockRideService.searchRides.mockResolvedValue(result);
      req = createMockReq({ query: { date: '2026-03-01', fromLat: '8.48', fromLng: '4.54', toLat: '8.49', toLng: '4.56' } });

      await controller.searchRides(req, res, next);

      expect(mockRideService.searchRides).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-03-01' }));
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.searchRides.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.searchRides(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getAvailableRides ─────────────────────────────────
  describe('getAvailableRides', () => {
    it('should get available rides and call paginated', async () => {
      const result = { rides: [], pagination: {} };
      mockRideService.getAvailableRides.mockResolvedValue(result);
      req = createMockReq({ query: { date: '2026-03-01' } });

      await controller.getAvailableRides(req, res, next);

      expect(paginated).toHaveBeenCalledWith(res, 'Available rides', result.rides, result.pagination);
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getAvailableRides.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getAvailableRides(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMyRides ────────────────────────────────────────
  describe('getMyRides', () => {
    it('should get my rides and call paginated', async () => {
      const result = { rides: [], pagination: {} };
      mockRideService.getRidesByDriver.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'd1' }, query: { status: 'active' } });

      await controller.getMyRides(req, res, next);

      expect(mockRideService.getRidesByDriver).toHaveBeenCalledWith('d1', expect.objectContaining({ status: 'active' }));
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getRidesByDriver.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' }, query: {} });

      await controller.getMyRides(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── startRide ─────────────────────────────────────────
  describe('startRide', () => {
    it('should start ride and call success', async () => {
      const ride = createMockRide({ status: 'in_progress' });
      mockRideService.startRide.mockResolvedValue(ride);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' } });

      await controller.startRide(req, res, next);

      expect(mockRideService.startRide).toHaveBeenCalledWith('r1', 'd1');
      expect(success).toHaveBeenCalledWith(res, 'Ride started', { ride });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.startRide.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' } });

      await controller.startRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── completeRide ──────────────────────────────────────
  describe('completeRide', () => {
    it('should complete ride and call success', async () => {
      const result = { ride: {}, summary: {} };
      mockRideService.completeRide.mockResolvedValue(result);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' } });

      await controller.completeRide(req, res, next);

      expect(mockRideService.completeRide).toHaveBeenCalledWith('r1', 'd1');
      expect(success).toHaveBeenCalledWith(res, 'Ride completed successfully', expect.objectContaining({ ride: result.ride }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.completeRide.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' } });

      await controller.completeRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── addPickupPoint ────────────────────────────────────
  describe('addPickupPoint', () => {
    it('should add pickup point and call created', async () => {
      const pp = { pickupPointId: 'pp1' };
      mockRideService.addPickupPoint.mockResolvedValue(pp);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: { name: 'Gate' } });

      await controller.addPickupPoint(req, res, next);

      expect(created).toHaveBeenCalledWith(res, 'Pickup point added', { pickupPoint: pp });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.addPickupPoint.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: {} });

      await controller.addPickupPoint(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── removePickupPoint ─────────────────────────────────
  describe('removePickupPoint', () => {
    it('should remove pickup point and call success', async () => {
      mockRideService.removePickupPoint.mockResolvedValue();
      req = createMockReq({ params: { rideId: 'r1', pickupPointId: 'pp1' }, user: { userId: 'd1' } });

      await controller.removePickupPoint(req, res, next);

      expect(mockRideService.removePickupPoint).toHaveBeenCalledWith('r1', 'pp1', 'd1');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.removePickupPoint.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1', pickupPointId: 'pp1' }, user: { userId: 'd1' } });

      await controller.removePickupPoint(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── reorderPickupPoints ───────────────────────────────
  describe('reorderPickupPoints', () => {
    it('should reorder and call success', async () => {
      const pps = [{ id: 'pp1' }, { id: 'pp2' }];
      mockRideService.reorderPickupPoints.mockResolvedValue(pps);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: { orderedIds: ['pp2', 'pp1'] } });

      await controller.reorderPickupPoints(req, res, next);

      expect(mockRideService.reorderPickupPoints).toHaveBeenCalledWith('r1', 'd1', ['pp2', 'pp1']);
      expect(success).toHaveBeenCalledWith(res, 'Pickup points reordered', { pickupPoints: pps });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.reorderPickupPoints.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, body: { orderedIds: [] } });

      await controller.reorderPickupPoints(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getPickupPoints ───────────────────────────────────
  describe('getPickupPoints', () => {
    it('should get pickup points and call success', async () => {
      const pps = [{ id: 'pp1' }];
      mockRideService.getPickupPoints.mockResolvedValue(pps);
      req = createMockReq({ params: { rideId: 'r1' } });

      await controller.getPickupPoints(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Pickup points retrieved', { pickupPoints: pps });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getPickupPoints.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' } });

      await controller.getPickupPoints(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── createRecurringRide ───────────────────────────────
  describe('createRecurringRide', () => {
    it('should create recurring ride and call created', async () => {
      const result = { scheduleId: 's1' };
      mockRideService.createRecurringRide.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'd1' }, body: { days: ['Mon', 'Wed'] } });

      await controller.createRecurringRide(req, res, next);

      expect(created).toHaveBeenCalledWith(res, 'Recurring ride schedule created', { schedule: result });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.createRecurringRide.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' }, body: {} });

      await controller.createRecurringRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMyRecurringRides ───────────────────────────────
  describe('getMyRecurringRides', () => {
    it('should get recurring rides and call success', async () => {
      const schedules = [{ scheduleId: 's1' }];
      mockRideService.getRecurringRidesByDriver.mockResolvedValue(schedules);
      req = createMockReq({ user: { userId: 'd1' } });

      await controller.getMyRecurringRides(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Recurring ride schedules', { schedules });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getRecurringRidesByDriver.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'd1' } });

      await controller.getMyRecurringRides(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── cancelRecurringRide ───────────────────────────────
  describe('cancelRecurringRide', () => {
    it('should cancel recurring ride and call success', async () => {
      mockRideService.cancelRecurringRides.mockResolvedValue();
      req = createMockReq({ params: { scheduleId: 's1' }, user: { userId: 'd1' } });

      await controller.cancelRecurringRide(req, res, next);

      expect(mockRideService.cancelRecurringRides).toHaveBeenCalledWith('s1', 'd1');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.cancelRecurringRides.mockRejectedValue(err);
      req = createMockReq({ params: { scheduleId: 's1' }, user: { userId: 'd1' } });

      await controller.cancelRecurringRide(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRideBookings ───────────────────────────────────
  describe('getRideBookings', () => {
    it('should get ride bookings and call success', async () => {
      const bookings = [{ bookingId: 'b1' }];
      mockRideService.getRideBookings.mockResolvedValue(bookings);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, query: { status: 'confirmed' } });

      await controller.getRideBookings(req, res, next);

      expect(mockRideService.getRideBookings).toHaveBeenCalledWith('r1', 'd1', { status: 'confirmed' });
      expect(success).toHaveBeenCalledWith(res, 'Ride bookings retrieved', { bookings });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getRideBookings.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' }, query: {} });

      await controller.getRideBookings(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRidePassengers ─────────────────────────────────
  describe('getRidePassengers', () => {
    it('should get passengers and call success', async () => {
      const passengers = [{ userId: 'p1' }];
      mockRideService.getRidePassengers.mockResolvedValue(passengers);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' } });

      await controller.getRidePassengers(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Passengers retrieved', { passengers });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getRidePassengers.mockRejectedValue(err);
      req = createMockReq({ params: { rideId: 'r1' }, user: { userId: 'd1' } });

      await controller.getRidePassengers(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMatchingRides ──────────────────────────────────
  describe('getMatchingRides', () => {
    it('should find matches and call success', async () => {
      const matches = [{ rideId: 'r1', score: 0.9 }];
      mockMatchingService.findMatchingRides.mockResolvedValue(matches);
      req = createMockReq({
        user: { userId: 'u1' },
        query: { fromLat: '8.48', fromLng: '4.54', toLat: '8.49', toLng: '4.56', date: '2026-03-01', time: '08:00' },
      });

      await controller.getMatchingRides(req, res, next);

      expect(mockMatchingService.findMatchingRides).toHaveBeenCalledWith('u1', expect.objectContaining({ date: '2026-03-01' }));
      expect(success).toHaveBeenCalledWith(res, 'Matching rides found', { matches });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockMatchingService.findMatchingRides.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getMatchingRides(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getSuggestions ────────────────────────────────────
  describe('getSuggestions', () => {
    it('should get suggestions and call success', async () => {
      const suggestions = [{ rideId: 'r1' }];
      mockMatchingService.getSuggestions.mockResolvedValue(suggestions);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getSuggestions(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Ride suggestions', { suggestions });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockMatchingService.getSuggestions.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getSuggestions(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getPopularRoutes ──────────────────────────────────
  describe('getPopularRoutes', () => {
    it('should get popular routes and call success', async () => {
      const routes = [{ route: 'A-B', count: 50 }];
      mockRideService.getPopularRoutes.mockResolvedValue(routes);
      req = createMockReq({ query: { limit: '5' } });

      await controller.getPopularRoutes(req, res, next);

      expect(mockRideService.getPopularRoutes).toHaveBeenCalledWith(5);
      expect(success).toHaveBeenCalledWith(res, 'Popular routes', { routes });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockRideService.getPopularRoutes.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.getPopularRoutes(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
