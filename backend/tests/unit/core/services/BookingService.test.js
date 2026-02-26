const BookingService = require('../../../../src/core/services/BookingService');
const { createMockUser, createMockDriver, createMockRide, createMockBooking } = require('../../../helpers');

// Mock all dependencies
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../../src/shared/utils/encryption', () => ({
  generateVerificationCode: jest.fn().mockReturnValue('654321'),
  generateBookingReference: jest.fn().mockReturnValue('BK-TEST123'),
}));

jest.mock('../../../../src/shared/utils/validation', () => ({
  validateBooking: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/dateTime', () => ({
  formatDate: jest.fn((d) => (d ? d.toISOString?.() || d : new Date().toISOString())),
  now: jest.fn(() => new Date()),
  isExpired: jest.fn(),
  addMinutes: jest.fn(() => new Date(Date.now() - 60000)),
  addHours: jest.fn(() => new Date(Date.now() + 3600000)),
  isBefore: jest.fn(),
  calculateDuration: jest.fn().mockReturnValue(25),
}));

const mockBookingRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByReference: jest.fn(),
  findByPassenger: jest.fn(),
  findByDriver: jest.fn(),
  findByRide: jest.fn(),
  findByPassengerAndRide: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
};

const mockRideRepo = {
  findById: jest.fn(),
  updateSeats: jest.fn(),
  getRideBookings: jest.fn(),
};

const mockUserRepo = {
  findById: jest.fn(),
  getUserStatistics: jest.fn(),
  incrementPassengerBookings: jest.fn(),
  incrementPassengerCancellations: jest.fn(),
  incrementLateCancellations: jest.fn(),
  incrementDriverCancellations: jest.fn(),
  incrementPassengerCompletedRides: jest.fn(),
  incrementPassengerTotalSpent: jest.fn(),
  incrementDriverEarnings: jest.fn(),
  incrementPassengerNoShows: jest.fn(),
};

jest.mock('../../../../src/infrastructure/database/repositories/BookingRepository', () => {
  return jest.fn().mockImplementation(() => mockBookingRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/RideRepository', () => {
  return jest.fn().mockImplementation(() => mockRideRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => mockUserRepo);
});

const mockEventPublisher = {
  bookingCreated: jest.fn().mockResolvedValue(),
  bookingConfirmed: jest.fn().mockResolvedValue(),
  bookingCancelled: jest.fn().mockResolvedValue(),
  bookingNoShow: jest.fn().mockResolvedValue(),
};

jest.mock('../../../../src/infrastructure/messaging', () => ({
  getBookingEventPublisher: jest.fn(() => mockEventPublisher),
}));

const { validateBooking } = require('../../../../src/shared/utils/validation');
const { isExpired, isBefore } = require('../../../../src/shared/utils/dateTime');

describe('BookingService', () => {
  let bookingService;

  beforeEach(() => {
    jest.clearAllMocks();
    bookingService = new BookingService();
  });

  // ==================== createBooking ====================

  describe('createBooking()', () => {
    const passengerId = 'passenger-1';
    const bookingData = { rideId: 'ride-1', seats: 1 };

    beforeEach(() => {
      validateBooking.mockReturnValue({ error: null, value: { rideId: 'ride-1', seats: 1 } });
      isBefore.mockReturnValue(false);
      isExpired.mockReturnValue(false);
    });

    it('should create a booking successfully', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: true, isActive: true });
      const ride = createMockRide({ rideId: 'ride-1', status: 'active', availableSeats: 3 });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockBookingRepo.findByPassengerAndRide.mockResolvedValue(null);
      mockBookingRepo.create.mockImplementation((data) => Promise.resolve(data));

      const result = await bookingService.createBooking(passengerId, bookingData);

      expect(result.booking).toBeDefined();
      expect(result.message).toBe('Booking created successfully');
      expect(result.paymentInstructions).toBeDefined();
      expect(mockBookingRepo.create).toHaveBeenCalledTimes(1);
      expect(mockRideRepo.updateSeats).toHaveBeenCalledWith('ride-1', -1);
      expect(mockUserRepo.incrementPassengerBookings).toHaveBeenCalledWith(passengerId);
    });

    it('should throw ValidationError on invalid data', async () => {
      validateBooking.mockReturnValue({
        error: { details: [{ message: 'rideId is required' }] },
        value: null,
      });

      await expect(bookingService.createBooking(passengerId, {})).rejects.toThrow('Booking validation failed');
    });

    it('should throw NotFoundError when passenger not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow('Passenger not found');
    });

    it('should throw ForbiddenError when passenger not verified', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: false, isActive: true });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow('Email must be verified');
    });

    it('should throw NotFoundError when ride not found', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: true, isActive: true });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(null);

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow();
    });

    it('should throw BadRequestError when ride is not active', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: true, isActive: true });
      const ride = createMockRide({ rideId: 'ride-1', status: 'cancelled' });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow('not available for booking');
    });

    it('should throw BadRequestError when insufficient seats', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: true, isActive: true });
      const ride = createMockRide({ rideId: 'ride-1', status: 'active', availableSeats: 0 });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow('seats available');
    });

    it('should throw BadRequestError when booking own ride', async () => {
      const driverId = 'driver-1';
      const passenger = createMockUser({ userId: driverId, isVerified: true, isActive: true });
      const ride = createMockRide({ rideId: 'ride-1', status: 'active', driverId, availableSeats: 3 });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);

      await expect(bookingService.createBooking(driverId, bookingData)).rejects.toThrow('Cannot book your own ride');
    });

    it('should throw BadRequestError when booking too late', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: true, isActive: true });
      const ride = createMockRide({ rideId: 'ride-1', status: 'active', availableSeats: 3 });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);
      isBefore.mockReturnValue(true);

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow('minutes before departure');
    });

    it('should throw ConflictError when existing active booking', async () => {
      const passenger = createMockUser({ userId: passengerId, isVerified: true, isActive: true });
      const ride = createMockRide({ rideId: 'ride-1', status: 'active', availableSeats: 3 });
      mockUserRepo.findById.mockResolvedValue(passenger);
      mockUserRepo.getUserStatistics.mockResolvedValue({ noShowCount: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);
      mockBookingRepo.findByPassengerAndRide.mockResolvedValue(
        createMockBooking({ status: 'confirmed' }),
      );

      await expect(bookingService.createBooking(passengerId, bookingData)).rejects.toThrow('already have a booking');
    });
  });

  // ==================== getBookingById ====================

  describe('getBookingById()', () => {
    it('should return booking for passenger with verification code', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      const result = await bookingService.getBookingById(booking.bookingId, booking.passengerId);

      expect(result.isPassenger).toBe(true);
      expect(result.verificationCode).toBe(booking.verificationCode);
    });

    it('should return booking for driver without verification code', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      const result = await bookingService.getBookingById(booking.bookingId, booking.driverId);

      expect(result.isDriver).toBe(true);
      expect(result.verificationCode).toBeUndefined();
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findById.mockResolvedValue(null);

      await expect(bookingService.getBookingById('bad-id', 'user-1')).rejects.toThrow();
    });

    it('should throw ForbiddenError when user not authorized', async () => {
      const booking = createMockBooking();
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.getBookingById(booking.bookingId, 'stranger')).rejects.toThrow('Not authorized');
    });
  });

  // ==================== confirmBooking ====================

  describe('confirmBooking()', () => {
    it('should confirm a pending booking', async () => {
      const booking = createMockBooking({ status: 'pending' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockBookingRepo.updateStatus.mockResolvedValue({ ...booking, status: 'confirmed' });

      const result = await bookingService.confirmBooking(booking.bookingId, booking.driverId);

      expect(result.message).toBe('Booking confirmed successfully');
      expect(mockBookingRepo.updateStatus).toHaveBeenCalledWith(
        booking.bookingId,
        'confirmed',
        expect.any(Object),
      );
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findById.mockResolvedValue(null);

      await expect(bookingService.confirmBooking('bad-id', 'driver-1')).rejects.toThrow();
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const booking = createMockBooking({ status: 'pending' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.confirmBooking(booking.bookingId, 'other-driver')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when booking not pending', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.confirmBooking(booking.bookingId, booking.driverId)).rejects.toThrow('Cannot confirm booking');
    });
  });

  // ==================== cancelBooking ====================

  describe('cancelBooking()', () => {
    it('should cancel booking by passenger', async () => {
      const booking = createMockBooking({ status: 'pending' });
      isExpired.mockReturnValue(false);
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockBookingRepo.updateStatus.mockResolvedValue({ ...booking, status: 'cancelled' });

      const result = await bookingService.cancelBooking(booking.bookingId, booking.passengerId, 'Changed plans');

      expect(result.message).toBe('Booking cancelled successfully');
      expect(result.cancelledBy).toBe('passenger');
      expect(mockRideRepo.updateSeats).toHaveBeenCalledWith(booking.rideId, booking.seats);
      expect(mockUserRepo.incrementPassengerCancellations).toHaveBeenCalledWith(booking.passengerId);
    });

    it('should cancel booking by driver', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      isExpired.mockReturnValue(false);
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockBookingRepo.updateStatus.mockResolvedValue({ ...booking, status: 'cancelled' });

      const result = await bookingService.cancelBooking(booking.bookingId, booking.driverId, 'Emergency');

      expect(result.cancelledBy).toBe('driver');
      expect(mockUserRepo.incrementDriverCancellations).toHaveBeenCalledWith(booking.driverId);
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findById.mockResolvedValue(null);

      await expect(bookingService.cancelBooking('bad-id', 'user-1')).rejects.toThrow();
    });

    it('should throw ForbiddenError when not authorized', async () => {
      const booking = createMockBooking({ status: 'pending' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.cancelBooking(booking.bookingId, 'stranger')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when booking cannot be cancelled', async () => {
      const booking = createMockBooking({ status: 'completed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(
        bookingService.cancelBooking(booking.bookingId, booking.passengerId),
      ).rejects.toThrow('cannot be cancelled');
    });
  });

  // ==================== markNoShow ====================

  describe('markNoShow()', () => {
    it('should mark booking as no-show', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      isExpired.mockReturnValue(true); // grace period expired
      mockBookingRepo.updateStatus.mockResolvedValue({ ...booking, status: 'no_show' });

      const result = await bookingService.markNoShow(booking.bookingId, booking.driverId);

      expect(result.message).toBe('Passenger marked as no-show');
      expect(mockRideRepo.updateSeats).toHaveBeenCalledWith(booking.rideId, booking.seats);
      expect(mockUserRepo.incrementPassengerNoShows).toHaveBeenCalledWith(booking.passengerId);
    });

    it('should throw NotFoundError when booking not found', async () => {
      mockBookingRepo.findById.mockResolvedValue(null);

      await expect(bookingService.markNoShow('bad-id', 'driver-1')).rejects.toThrow();
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.markNoShow(booking.bookingId, 'other-driver')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when wrong status', async () => {
      const booking = createMockBooking({ status: 'completed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.markNoShow(booking.bookingId, booking.driverId)).rejects.toThrow('Cannot mark no-show');
    });

    it('should throw BadRequestError when grace period not expired', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      isExpired.mockReturnValue(false); // grace period NOT expired

      await expect(bookingService.markNoShow(booking.bookingId, booking.driverId)).rejects.toThrow('Please wait');
    });
  });

  // ==================== checkAvailability ====================

  describe('checkAvailability()', () => {
    it('should return available when seats exist', async () => {
      const ride = createMockRide({ status: 'active', availableSeats: 3 });
      mockRideRepo.findById.mockResolvedValue(ride);
      isExpired.mockReturnValue(false);

      const result = await bookingService.checkAvailability(ride.rideId, 1);

      expect(result.available).toBe(true);
      expect(result.availableSeats).toBe(3);
      expect(result.totalPrice).toBe(ride.pricePerSeat);
    });

    it('should return not available when no seats', async () => {
      const ride = createMockRide({ status: 'active', availableSeats: 0 });
      mockRideRepo.findById.mockResolvedValue(ride);
      isExpired.mockReturnValue(false);

      const result = await bookingService.checkAvailability(ride.rideId, 1);

      expect(result.available).toBe(false);
    });

    it('should throw NotFoundError when ride not found', async () => {
      mockRideRepo.findById.mockResolvedValue(null);

      await expect(bookingService.checkAvailability('bad-id')).rejects.toThrow();
    });
  });

  // ==================== completeBooking ====================

  describe('completeBooking()', () => {
    it('should complete an in-progress booking with cash received', async () => {
      const booking = createMockBooking({ status: 'in_progress', startedAt: new Date().toISOString() });
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockBookingRepo.updateStatus.mockResolvedValue({ ...booking, status: 'completed' });

      const result = await bookingService.completeBooking(booking.bookingId, booking.driverId);

      expect(result.message).toBe('Booking completed successfully');
      expect(result.cashReceived).toBe(true);
      expect(mockUserRepo.incrementPassengerCompletedRides).toHaveBeenCalledWith(booking.passengerId);
      expect(mockUserRepo.incrementDriverEarnings).toHaveBeenCalledWith(booking.driverId, booking.totalAmount);
    });

    it('should throw ForbiddenError when not the driver', async () => {
      const booking = createMockBooking({ status: 'in_progress' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.completeBooking(booking.bookingId, 'other-driver')).rejects.toThrow('Not authorized');
    });

    it('should throw BadRequestError when not in progress', async () => {
      const booking = createMockBooking({ status: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(bookingService.completeBooking(booking.bookingId, booking.driverId)).rejects.toThrow('must be in progress');
    });
  });

  // ==================== startRideForBooking ====================

  describe('startRideForBooking()', () => {
    it('should verify code and start ride for booking', async () => {
      const booking = createMockBooking({ status: 'confirmed', verificationCode: 'ABC123' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      isExpired.mockReturnValue(false);
      mockBookingRepo.updateStatus.mockResolvedValue({ ...booking, status: 'in_progress' });

      const result = await bookingService.startRideForBooking(booking.bookingId, booking.driverId, 'ABC123');

      expect(result.verified).toBe(true);
      expect(result.message).toBe('Passenger verified and ride started');
    });

    it('should throw BadRequestError with invalid code', async () => {
      const booking = createMockBooking({ status: 'confirmed', verificationCode: 'ABC123' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      isExpired.mockReturnValue(false);

      await expect(
        bookingService.startRideForBooking(booking.bookingId, booking.driverId, 'WRONG'),
      ).rejects.toThrow('Invalid verification code');
    });

    it('should throw BadRequestError when wrong status', async () => {
      const booking = createMockBooking({ status: 'cancelled' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(
        bookingService.startRideForBooking(booking.bookingId, booking.driverId, '123456'),
      ).rejects.toThrow('Cannot start booking');
    });
  });

  // ==================== getPassengerBookings ====================

  describe('getPassengerBookings()', () => {
    it('should return paginated passenger bookings', async () => {
      const bookings = [
        createMockBooking({ rideDepartureDateTime: new Date(Date.now() + 3600000).toISOString() }),
        createMockBooking({ rideDepartureDateTime: new Date(Date.now() + 7200000).toISOString() }),
      ];
      mockBookingRepo.findByPassenger.mockResolvedValue(bookings);
      isExpired.mockReturnValue(false);

      const result = await bookingService.getPassengerBookings('passenger-1', { page: 1, limit: 10 });

      expect(result.bookings).toHaveLength(2);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalCount).toBe(2);
    });
  });

  // ==================== confirmCashPayment ====================

  describe('confirmCashPayment()', () => {
    it('should confirm cash payment', async () => {
      const booking = createMockBooking({ paymentStatus: 'pending' });
      mockBookingRepo.findById.mockResolvedValue(booking);
      mockBookingRepo.update.mockResolvedValue({ ...booking, paymentStatus: 'confirmed' });

      const result = await bookingService.confirmCashPayment(booking.bookingId, booking.driverId, 500);

      expect(result.message).toBe('Cash payment confirmed');
      expect(mockUserRepo.incrementDriverEarnings).toHaveBeenCalled();
    });

    it('should throw BadRequestError when payment already confirmed', async () => {
      const booking = createMockBooking({ paymentStatus: 'confirmed' });
      mockBookingRepo.findById.mockResolvedValue(booking);

      await expect(
        bookingService.confirmCashPayment(booking.bookingId, booking.driverId, 500),
      ).rejects.toThrow('Payment already confirmed');
    });
  });
});
