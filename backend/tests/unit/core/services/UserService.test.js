const UserService = require('../../../../src/core/services/UserService');
const { createMockUser, createMockDriver, createMockVehicle } = require('../../../helpers');

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
  validateUserProfile: jest.fn(),
  validateVehicle: jest.fn(),
  validateEmergencyContact: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/dateTime', () => ({
  formatDate: jest.fn((d) => (d ? d.toISOString?.() || d : new Date().toISOString())),
  now: jest.fn(() => new Date()),
  isExpired: jest.fn(),
}));

const mockUserRepo = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  updateProfile: jest.fn(),
  getUserStatistics: jest.fn(),
  getDriverDocuments: jest.fn(),
  addDriverDocument: jest.fn(),
  updateDriverDocument: jest.fn(),
  addEmergencyContact: jest.fn(),
  updateEmergencyContact: jest.fn(),
  removeEmergencyContact: jest.fn(),
  setPrimaryEmergencyContact: jest.fn(),
  invalidateAllRefreshTokens: jest.fn(),
  getRideHistory: jest.fn(),
};

const mockVehicleRepo = {
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findByPlateNumber: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  setPrimary: jest.fn(),
};

jest.mock('../../../../src/infrastructure/database/repositories/UserRepository', () => {
  return jest.fn().mockImplementation(() => mockUserRepo);
});

jest.mock('../../../../src/infrastructure/database/repositories/VehicleRepository', () => {
  return jest.fn().mockImplementation(() => mockVehicleRepo);
});

const { validateUserProfile, validateVehicle, validateEmergencyContact } = require('../../../../src/shared/utils/validation');
const { isExpired } = require('../../../../src/shared/utils/dateTime');

describe('UserService', () => {
  let userService;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
  });

  // ==================== getProfile ====================

  describe('getProfile()', () => {
    it('should return user profile', async () => {
      const user = createMockUser();
      mockUserRepo.findById.mockResolvedValue(user);

      const result = await userService.getProfile(user.userId);

      expect(result.userId).toBe(user.userId);
      expect(result.email).toBe(user.email);
    });

    it('should include vehicles when requested for driver', async () => {
      const user = createMockDriver();
      const vehicles = [createMockVehicle({ userId: user.userId })];
      mockUserRepo.findById.mockResolvedValue(user);
      mockVehicleRepo.findByUserId.mockResolvedValue(vehicles);

      const result = await userService.getProfile(user.userId, { includeVehicles: true });

      expect(result.vehicles).toHaveLength(1);
    });

    it('should include statistics when requested', async () => {
      const user = createMockUser();
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.getUserStatistics.mockResolvedValue({ totalBookings: 5 });

      const result = await userService.getProfile(user.userId, { includeStatistics: true });

      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalBookings).toBe(5);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(userService.getProfile('bad-id')).rejects.toThrow();
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile()', () => {
    it('should update profile successfully', async () => {
      const user = createMockUser();
      validateUserProfile.mockReturnValue({ error: null, value: { firstName: 'Updated' } });
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.updateProfile.mockResolvedValue({ ...user, firstName: 'Updated' });

      const result = await userService.updateProfile(user.userId, { firstName: 'Updated' });

      expect(result.firstName).toBe('Updated');
    });

    it('should throw ValidationError on invalid data', async () => {
      validateUserProfile.mockReturnValue({
        error: { details: [{ message: 'Invalid field' }] },
        value: null,
      });

      await expect(userService.updateProfile('user-1', {})).rejects.toThrow('Profile validation failed');
    });

    it('should throw NotFoundError when user not found', async () => {
      validateUserProfile.mockReturnValue({ error: null, value: { firstName: 'Test' } });
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(userService.updateProfile('bad-id', {})).rejects.toThrow();
    });

    it('should throw ConflictError when email already taken', async () => {
      const user = createMockUser({ email: 'old@unilorin.edu.ng' });
      validateUserProfile.mockReturnValue({ error: null, value: { email: 'taken@unilorin.edu.ng' } });
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.findByEmail.mockResolvedValue(createMockUser());

      await expect(userService.updateProfile(user.userId, { email: 'taken@unilorin.edu.ng' })).rejects.toThrow();
    });
  });

  // ==================== deleteAccount ====================

  describe('deleteAccount()', () => {
    it('should soft delete account successfully', async () => {
      const user = createMockUser();
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.updateProfile.mockResolvedValue({});
      mockUserRepo.invalidateAllRefreshTokens.mockResolvedValue();

      const result = await userService.deleteAccount(user.userId, 'No longer needed');

      expect(result.message).toBe('Account deleted successfully');
      expect(mockUserRepo.updateProfile).toHaveBeenCalledWith(
        user.userId,
        expect.objectContaining({
          isActive: false,
          isDeleted: true,
          firstName: 'Deleted',
          lastName: 'User',
        }),
      );
      expect(mockUserRepo.invalidateAllRefreshTokens).toHaveBeenCalledWith(user.userId);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(userService.deleteAccount('bad-id')).rejects.toThrow();
    });
  });

  // ==================== registerAsDriver ====================

  describe('registerAsDriver()', () => {
    const driverData = {
      licenseNumber: 'DL-12345',
      licenseExpiry: '2028-01-01',
      vehicleData: {
        make: 'Toyota',
        model: 'Camry',
        color: 'Silver',
        plateNumber: 'KWL-123-AB',
        capacity: 4,
        year: 2020,
      },
    };

    it('should register as driver successfully', async () => {
      const user = createMockUser({ isDriver: false, isVerified: true });
      isExpired.mockReturnValue(false);
      validateVehicle.mockReturnValue({ error: null, value: driverData.vehicleData });
      mockUserRepo.findById.mockResolvedValue(user);
      mockVehicleRepo.create.mockImplementation((data) => Promise.resolve(data));
      mockUserRepo.updateProfile.mockResolvedValue({});

      const result = await userService.registerAsDriver(user.userId, driverData);

      expect(result.message).toContain('Driver registration submitted');
      expect(result.driver.verificationStatus).toBe('pending');
      expect(result.vehicle).toBeDefined();
    });

    it('should throw ConflictError when already a driver', async () => {
      const user = createMockDriver();
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(userService.registerAsDriver(user.userId, driverData)).rejects.toThrow('already registered as a driver');
    });

    it('should throw ForbiddenError when email not verified', async () => {
      const user = createMockUser({ isDriver: false, isVerified: false });
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(userService.registerAsDriver(user.userId, driverData)).rejects.toThrow('Email must be verified');
    });

    it('should throw ValidationError when license info missing', async () => {
      const user = createMockUser({ isDriver: false, isVerified: true });
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(
        userService.registerAsDriver(user.userId, { licenseNumber: null, licenseExpiry: null, vehicleData: {} }),
      ).rejects.toThrow('License information is required');
    });

    it('should throw ValidationError when license expired', async () => {
      const user = createMockUser({ isDriver: false, isVerified: true });
      mockUserRepo.findById.mockResolvedValue(user);
      isExpired.mockReturnValue(true);

      await expect(userService.registerAsDriver(user.userId, driverData)).rejects.toThrow('License has expired');
    });
  });

  // ==================== addVehicle ====================

  describe('addVehicle()', () => {
    const vehicleData = {
      make: 'Honda',
      model: 'Civic',
      color: 'Blue',
      plateNumber: 'ABC-123-XY',
      capacity: 4,
      year: 2021,
    };

    it('should add vehicle successfully', async () => {
      const user = createMockDriver();
      validateVehicle.mockReturnValue({ error: null, value: vehicleData });
      mockUserRepo.findById.mockResolvedValue(user);
      mockVehicleRepo.findByUserId.mockResolvedValue([]);
      mockVehicleRepo.findByPlateNumber.mockResolvedValue(null);
      mockVehicleRepo.create.mockImplementation((data) => Promise.resolve(data));

      const result = await userService.addVehicle(user.userId, vehicleData);

      expect(result.message).toContain('Vehicle added successfully');
      expect(result.vehicle).toBeDefined();
    });

    it('should throw ForbiddenError when user is not a driver', async () => {
      const user = createMockUser({ isDriver: false });
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(userService.addVehicle(user.userId, vehicleData)).rejects.toThrow('must be a registered driver');
    });

    it('should throw BadRequestError when max vehicles reached', async () => {
      const user = createMockDriver();
      mockUserRepo.findById.mockResolvedValue(user);
      mockVehicleRepo.findByUserId.mockResolvedValue([{}, {}, {}]); // 3 vehicles

      await expect(userService.addVehicle(user.userId, vehicleData)).rejects.toThrow('Maximum of 3 vehicles');
    });

    it('should throw ConflictError when plate number exists', async () => {
      const user = createMockDriver();
      validateVehicle.mockReturnValue({ error: null, value: vehicleData });
      mockUserRepo.findById.mockResolvedValue(user);
      mockVehicleRepo.findByUserId.mockResolvedValue([]);
      mockVehicleRepo.findByPlateNumber.mockResolvedValue(createMockVehicle());

      await expect(userService.addVehicle(user.userId, vehicleData)).rejects.toThrow('plate number already exists');
    });
  });

  // ==================== updateVehicle ====================

  describe('updateVehicle()', () => {
    it('should update vehicle successfully', async () => {
      const vehicle = createMockVehicle({ userId: 'user-1' });
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      mockVehicleRepo.update.mockResolvedValue({ ...vehicle, color: 'Red' });

      const result = await userService.updateVehicle('user-1', vehicle.vehicleId, { color: 'Red' });

      expect(result.message).toBe('Vehicle updated successfully');
    });

    it('should throw NotFoundError when vehicle not found', async () => {
      mockVehicleRepo.findById.mockResolvedValue(null);

      await expect(userService.updateVehicle('user-1', 'bad-id', {})).rejects.toThrow('Vehicle not found');
    });

    it('should throw ForbiddenError when not owner', async () => {
      const vehicle = createMockVehicle({ userId: 'other-user' });
      mockVehicleRepo.findById.mockResolvedValue(vehicle);

      await expect(userService.updateVehicle('user-1', vehicle.vehicleId, {})).rejects.toThrow('Not authorized');
    });
  });

  // ==================== removeVehicle ====================

  describe('removeVehicle()', () => {
    it('should remove vehicle successfully', async () => {
      const vehicle = createMockVehicle({ userId: 'user-1', isPrimary: false });
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      mockVehicleRepo.delete.mockResolvedValue();

      const result = await userService.removeVehicle('user-1', vehicle.vehicleId);

      expect(result.message).toBe('Vehicle removed successfully');
    });

    it('should set new primary when removing primary vehicle', async () => {
      const vehicle = createMockVehicle({ userId: 'user-1', isPrimary: true });
      const remaining = [createMockVehicle({ userId: 'user-1', vehicleId: 'v2' })];
      mockVehicleRepo.findById.mockResolvedValue(vehicle);
      mockVehicleRepo.delete.mockResolvedValue();
      mockVehicleRepo.findByUserId.mockResolvedValue(remaining);

      await userService.removeVehicle('user-1', vehicle.vehicleId);

      expect(mockVehicleRepo.setPrimary).toHaveBeenCalledWith('user-1', 'v2');
    });

    it('should throw NotFoundError when vehicle not found', async () => {
      mockVehicleRepo.findById.mockResolvedValue(null);

      await expect(userService.removeVehicle('user-1', 'bad-id')).rejects.toThrow('Vehicle not found');
    });

    it('should throw ForbiddenError when not owner', async () => {
      const vehicle = createMockVehicle({ userId: 'other-user' });
      mockVehicleRepo.findById.mockResolvedValue(vehicle);

      await expect(userService.removeVehicle('user-1', vehicle.vehicleId)).rejects.toThrow('Not authorized');
    });
  });

  // ==================== Emergency Contacts ====================

  describe('addEmergencyContact()', () => {
    const contactData = { name: 'Mom', phone: '+2348099887766', relationship: 'Mother' };

    it('should add emergency contact successfully', async () => {
      const user = createMockUser({ emergencyContacts: [] });
      validateEmergencyContact.mockReturnValue({ error: null, value: contactData });
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.addEmergencyContact.mockResolvedValue();

      const result = await userService.addEmergencyContact(user.userId, contactData);

      expect(result.message).toBe('Emergency contact added successfully');
      expect(result.contact.isPrimary).toBe(true); // first contact is primary
    });

    it('should throw BadRequestError when max contacts reached', async () => {
      const user = createMockUser({ emergencyContacts: [{}, {}, {}] });
      validateEmergencyContact.mockReturnValue({ error: null, value: contactData });
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(userService.addEmergencyContact(user.userId, contactData)).rejects.toThrow('Maximum of 3');
    });

    it('should throw ConflictError when duplicate phone', async () => {
      const user = createMockUser({ emergencyContacts: [{ phone: '+2348099887766' }] });
      validateEmergencyContact.mockReturnValue({ error: null, value: contactData });
      mockUserRepo.findById.mockResolvedValue(user);

      await expect(userService.addEmergencyContact(user.userId, contactData)).rejects.toThrow('already exists');
    });
  });

  describe('getEmergencyContacts()', () => {
    it('should return sorted emergency contacts', async () => {
      const contacts = [
        { contactId: 'c1', isPrimary: false },
        { contactId: 'c2', isPrimary: true },
      ];
      const user = createMockUser({ emergencyContacts: contacts });
      mockUserRepo.findById.mockResolvedValue(user);

      const result = await userService.getEmergencyContacts(user.userId);

      expect(result[0].isPrimary).toBe(true);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(userService.getEmergencyContacts('bad-id')).rejects.toThrow();
    });
  });

  describe('removeEmergencyContact()', () => {
    it('should remove emergency contact successfully', async () => {
      mockUserRepo.removeEmergencyContact.mockResolvedValue();

      const result = await userService.removeEmergencyContact('user-1', 'contact-1');

      expect(result.message).toBe('Emergency contact removed successfully');
    });
  });

  // ==================== getUserStatistics ====================

  describe('getUserStatistics()', () => {
    it('should return user statistics', async () => {
      const user = createMockUser({ isDriver: true, averageRating: 4.5, totalRatings: 10 });
      mockUserRepo.findById.mockResolvedValue(user);
      mockUserRepo.getUserStatistics.mockResolvedValue({
        totalBookings: 15,
        completedRidesAsPassenger: 12,
        cancelledBookings: 2,
        noShowCount: 1,
        totalSpent: 6000,
        totalRidesOffered: 20,
        completedRidesAsDriver: 18,
        cancelledRidesAsDriver: 1,
        totalEarnings: 45000,
        totalPassengersCarried: 50,
      });

      const result = await userService.getUserStatistics(user.userId);

      expect(result.passenger.totalBookings).toBe(15);
      expect(result.driver.totalRidesOffered).toBe(20);
      expect(result.ratings.averageRating).toBe(4.5);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(userService.getUserStatistics('bad-id')).rejects.toThrow();
    });
  });
});
