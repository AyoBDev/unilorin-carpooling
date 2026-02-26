const RideService = require('../../../../src/core/services/RideService');
const { createMockDriver, createMockRide, createMockVehicle } = require('../../../helpers');

// Mock all dependencies
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../../src/shared/utils/validation', () => ({
  validateRide: jest.fn(),
  validatePickupPoint: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/dateTime', () => ({
  formatDate: jest.fn((d) => (d ? d.toISOString?.() || d : new Date().toISOString())),
  now: jest.fn(() => new Date()),
  parseDate: jest.fn((s) => new Date(s)),
  addMinutes: jest.fn(() => new Date(Date.now() - 60000)),
  addDays: jest.fn(() => new Date(Date.now() + 86400000 * 3)),
  isExpired: jest.fn(),
  isBefore: jest.fn(),
  isAfter: jest.fn(),
  getDateOnly: jest.fn(() => '2026-03-01'),
  getTimeOnly: jest.fn(() => '08:00'),
  getDayOfWeek: jest.fn(() => 'monday'),
  formatTime: jest.fn(() => '08:05'),
  calculateDuration: jest.fn().mockReturnValue(30),
}));

const mockRideRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByDriver: jest.fn(),
  findByDriverAndDate: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  updateSeats: jest.fn(),
  search: jest.fn(),
  getRideBookings: jest.fn(),
  addPickupPoint: jest.fn(),
  removePickupPoint: jest.fn(),
  reorderPickupPoints: jest.fn(),
  findRecurringInstances: jest.fn(),
};

const mockUserRepo = {
  findById: jest.fn(),
  incrementDriverRides: jest.fn(),
  incrementDriverCancelledRides: jest.fn(),
  incrementDriverCompletedRides: jest.fn(),
};

const mockVehicleRepo = {
  findById: jest.fn(),
  findByUserId: jest.fn(),
};

jest.mock('../../../../src/infrastructure/database/repositories/RideRepository', () => {
  return jest.fn().mockImplementation(() => mockRideRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => mockUserRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/VehicleRepository', () => {
  return jest.fn().mockImplementation(() => mockVehicleRepo);
});

const mockEventPublisher = {
  rideCreated: jest.fn().mockResolvedValue(),
  rideCancelled: jest.fn().mockResolvedValue(),
};

jest.mock('../../../../src/infrastructure/messaging', () => ({
  getRideEventPublisher: jest.fn(() => mockEventPublisher),
}));

const { validateRide } = require('../../../../src/shared/utils/validation');
const { isExpired, isBefore, isAfter } = require('../../../../src/shared/utils/dateTime');

describe('RideService', () => {
  let rideService;

  beforeEach(() => {
    jest.clearAllMocks();
    rideService = new RideService();
  });

  // ==================== createRide ====================

  describe('createRide()', () => {
    const driverId = 'driver-1';
    const rideData = {
      departureDate: '2026-03-01',
      departureTime: '08:00',
      startLocation: { address: 'Main Gate', coordinates: [8.4799, 4.5418], name: 'Main Gate' },
      endLocation: { address: 'Tanke', coordinates: [8.4866, 4.5591], name: 'Tanke' },
      availableSeats: 3,
      pricePerSeat: 500,
      vehicleId: 'vehicle-1',
    };

    beforeEach(() => {
      validateRide.mockReturnValue({ error: null, value: rideData });
      isBefore.mockReturnValue(false);
      isAfter.mockReturnValue(false);
    });

    it('should create a ride successfully', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'approved', capacity: 4 });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      mockRideRepo.findByDriverAndDate.mockResolvedValue([]);
      mockRideRepo.create.mockImplementation((data) => Promise.resolve(data));

      const result = await rideService.createRide(driverId, rideData);

      expect(result.ride).toBeDefined();
      expect(result.message).toBe('Ride created successfully');
      expect(mockRideRepo.create).toHaveBeenCalledTimes(1);
      expect(mockUserRepo.incrementDriverRides).toHaveBeenCalledWith(driverId);
    });

    it('should throw ValidationError on invalid data', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      mockUserRepo.findById.mockResolvedValue(driver);
      validateRide.mockReturnValue({
        error: { details: [{ message: 'departureDate is required' }] },
        value: null,
      });

      await expect(rideService.createRide(driverId, {})).rejects.toThrow('Ride validation failed');
    });

    it('should throw NotFoundError when driver not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Driver not found');
    });

    it('should throw ForbiddenError when user is not a driver', async () => {
      const user = createMockDriver({ userId: driverId, isDriver: false });
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('not registered as a driver');
    });

    it('should throw ForbiddenError when driver not verified', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'pending' });
      mockUserRepo.findById.mockResolvedValue(driver);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('pending or rejected');
    });

    it('should throw NotFoundError when vehicle not found', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(null);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Vehicle not found');
    });

    it('should throw ForbiddenError when vehicle not approved', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'pending', capacity: 4 });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('pending or rejected');
    });

    it('should throw ValidationError when seats exceed vehicle capacity', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'approved', capacity: 2 });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('exceed vehicle capacity');
    });

    it('should throw ValidationError when departure too soon', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'approved', capacity: 4 });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      isBefore.mockReturnValue(true);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Invalid departure time');
    });

    it('should throw ValidationError when departure too far in future', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'approved', capacity: 4 });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      isBefore.mockReturnValue(false);
      isAfter.mockReturnValue(true);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Invalid departure time');
    });

    it('should throw ConflictError when overlapping ride exists', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'approved', capacity: 4 });
      // Use the same departure time as the new ride so time diff < 30 min
      const nowDate = new Date();
      const { parseDate } = require('../../../../src/shared/utils/dateTime');
      parseDate.mockReturnValue(nowDate);
      const existingRide = createMockRide({ status: 'active', departureDateTime: nowDate.toISOString() });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      mockRideRepo.findByDriverAndDate.mockResolvedValue([existingRide]);

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('already have a ride');
    });

    it('should throw ValidationError when price out of range', async () => {
      const driver = createMockDriver({ userId: driverId, driverVerificationStatus: 'verified' });
      const vehicle = createMockVehicle({ vehicleId: 'vehicle-1', userId: driverId, verificationStatus: 'approved', capacity: 4 });
      mockUserRepo.findById.mockResolvedValue(driver);
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      mockRideRepo.findByDriverAndDate.mockResolvedValue([]);
      validateRide.mockReturnValue({ error: null, value: { ...rideData, pricePerSeat: 50 } });

      await expect(rideService.createRide(driverId, rideData)).rejects.toThrow('Invalid price');
    });
  });

  // ==================== updateRide ====================

  describe('updateRide()', () => {
    it('should update ride successfully', async () => {
      const ride = createMockRide({ status: 'active', bookedSeats: 0 });
      isExpired.mockReturnValue(false);
      mockRideRepo.findById.mockResolvedValue(ride);
      mockRideRepo.update.mockResolvedValue({ ...ride, notes: 'Updated' });

      const result = await rideService.updateRide(ride.rideId, ride.driverId, { notes: 'Updated' });

      expect(result.message).toBe('Ride updated successfully');
    });

    it('should throw NotFoundError when ride not found', async () => {
      mockRideRepo.findById.mockResolvedValue(null);

      await expect(rideService.updateRide('bad-id', 'driver-1', {})).rejects.toThrow();
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.updateRide(ride.rideId, 'other-driver', {})).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when ride is cancelled', async () => {
      const ride = createMockRide({ status: 'cancelled' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.updateRide(ride.rideId, ride.driverId, {})).rejects.toThrow('Cannot update ride');
    });

    it('should throw BadRequestError when departure has passed', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);
      isExpired.mockReturnValue(true);

      await expect(rideService.updateRide(ride.rideId, ride.driverId, {})).rejects.toThrow('already departed');
    });

    it('should throw BadRequestError when reducing seats below booked count', async () => {
      const ride = createMockRide({ status: 'active', bookedSeats: 3 });
      isExpired.mockReturnValue(false);
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(
        rideService.updateRide(ride.rideId, ride.driverId, { availableSeats: 2 }),
      ).rejects.toThrow('below booked count');
    });
  });

  // ==================== cancelRide ====================

  describe('cancelRide()', () => {
    it('should cancel ride with no bookings', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockRideRepo.getRideBookings.mockResolvedValue([]);

      const result = await rideService.cancelRide(ride.rideId, ride.driverId, 'Cannot make it');

      expect(result.message).toBe('Ride cancelled successfully');
      expect(mockRideRepo.updateStatus).toHaveBeenCalled();
      expect(mockUserRepo.incrementDriverCancelledRides).toHaveBeenCalledWith(ride.driverId);
    });

    it('should cancel ride and notify affected passengers', async () => {
      const ride = createMockRide({ status: 'active' });
      const bookings = [
        { bookingId: 'b1', passengerId: 'p1', seats: 1, status: 'confirmed' },
        { bookingId: 'b2', passengerId: 'p2', seats: 2, status: 'pending' },
      ];
      mockRideRepo.findById.mockResolvedValue(ride);
      mockRideRepo.getRideBookings.mockResolvedValue(bookings);

      const result = await rideService.cancelRide(ride.rideId, ride.driverId);

      expect(result.affectedBookings).toHaveLength(2);
      expect(result.notifyPassengers).toBe(true);
    });

    it('should throw NotFoundError when ride not found', async () => {
      mockRideRepo.findById.mockResolvedValue(null);

      await expect(rideService.cancelRide('bad-id', 'driver-1')).rejects.toThrow();
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.cancelRide(ride.rideId, 'other-driver')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when already cancelled', async () => {
      const ride = createMockRide({ status: 'cancelled' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.cancelRide(ride.rideId, ride.driverId)).rejects.toThrow('already cancelled');
    });

    it('should throw BadRequestError when already completed', async () => {
      const ride = createMockRide({ status: 'completed' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.cancelRide(ride.rideId, ride.driverId)).rejects.toThrow('completed ride');
    });

    it('should throw BadRequestError when in progress', async () => {
      const ride = createMockRide({ status: 'in_progress' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.cancelRide(ride.rideId, ride.driverId)).rejects.toThrow('in progress');
    });
  });

  // ==================== searchRides ====================

  describe('searchRides()', () => {
    it('should return filtered and paginated results', async () => {
      const rides = [
        createMockRide({ pricePerSeat: 400 }),
        createMockRide({ pricePerSeat: 600 }),
      ];
      mockRideRepo.search.mockResolvedValue(rides);

      const result = await rideService.searchRides({ date: '2026-03-01', seats: 1, page: 1, limit: 10 });

      expect(result.rides).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalCount).toBe(2);
    });
  });

  // ==================== getRideById ====================

  describe('getRideById()', () => {
    it('should return ride for driver with bookings', async () => {
      const ride = createMockRide();
      const driver = createMockDriver({ userId: ride.driverId });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockUserRepo.findById.mockResolvedValue(driver);
      mockRideRepo.getRideBookings.mockResolvedValue([{ bookingId: 'b1' }]);

      const result = await rideService.getRideById(ride.rideId, ride.driverId);

      expect(result.isOwner).toBe(true);
      expect(result.bookings).toHaveLength(1);
    });

    it('should return ride for non-driver without bookings', async () => {
      const ride = createMockRide();
      const driver = createMockDriver({ userId: ride.driverId });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockUserRepo.findById.mockResolvedValue(driver);

      const result = await rideService.getRideById(ride.rideId, 'other-user');

      expect(result.isOwner).toBe(false);
      expect(result.bookings).toBeUndefined();
    });

    it('should throw NotFoundError when ride not found', async () => {
      mockRideRepo.findById.mockResolvedValue(null);

      await expect(rideService.getRideById('bad-id')).rejects.toThrow();
    });
  });

  // ==================== startRide ====================

  describe('startRide()', () => {
    it('should start an active ride', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockRideRepo.updateStatus.mockResolvedValue({ ...ride, status: 'in_progress' });

      const result = await rideService.startRide(ride.rideId, ride.driverId);

      expect(result.message).toBe('Ride started successfully');
      expect(mockRideRepo.updateStatus).toHaveBeenCalledWith(ride.rideId, 'in_progress', expect.any(Object));
    });

    it('should start a full ride', async () => {
      const ride = createMockRide({ status: 'full' });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockRideRepo.updateStatus.mockResolvedValue({ ...ride, status: 'in_progress' });

      const result = await rideService.startRide(ride.rideId, ride.driverId);

      expect(result.message).toBe('Ride started successfully');
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.startRide(ride.rideId, 'other-driver')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when wrong status', async () => {
      const ride = createMockRide({ status: 'cancelled' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.startRide(ride.rideId, ride.driverId)).rejects.toThrow('Cannot start ride');
    });
  });

  // ==================== completeRide ====================

  describe('completeRide()', () => {
    it('should complete an in-progress ride', async () => {
      const ride = createMockRide({ status: 'in_progress', startedAt: new Date().toISOString() });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockRideRepo.updateStatus.mockResolvedValue({ ...ride, status: 'completed' });

      const result = await rideService.completeRide(ride.rideId, ride.driverId);

      expect(result.message).toBe('Ride completed successfully');
      expect(result.promptForRatings).toBe(true);
      expect(mockUserRepo.incrementDriverCompletedRides).toHaveBeenCalledWith(ride.driverId);
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const ride = createMockRide({ status: 'in_progress' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.completeRide(ride.rideId, 'other-driver')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when not in progress', async () => {
      const ride = createMockRide({ status: 'active' });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(rideService.completeRide(ride.rideId, ride.driverId)).rejects.toThrow('must be in progress');
    });
  });
});
