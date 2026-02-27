/**
 * UserController Unit Tests
 */

const mockService = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  deleteAccount: jest.fn(),
  getPublicProfile: jest.fn(),
  registerAsDriver: jest.fn(),
  getDriverVerificationStatus: jest.fn(),
  uploadDriverDocument: jest.fn(),
  getDriverDocuments: jest.fn(),
  getVehicles: jest.fn(),
  addVehicle: jest.fn(),
  updateVehicle: jest.fn(),
  removeVehicle: jest.fn(),
  getEmergencyContacts: jest.fn(),
  addEmergencyContact: jest.fn(),
  updateEmergencyContact: jest.fn(),
  removeEmergencyContact: jest.fn(),
  getUserStatistics: jest.fn(),
  getRideHistory: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  getUsers: jest.fn(),
  adminUpdateUser: jest.fn(),
  verifyDriver: jest.fn(),
  suspendUser: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  UserService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  created: jest.fn(),
  paginated: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/UserController');
const { success, created, paginated } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext, createMockUser } = require('../../../helpers/mockFactory');

describe('UserController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── getProfile ────────────────────────────────────────
  describe('getProfile', () => {
    it('should get profile and call success', async () => {
      const profile = createMockUser();
      mockService.getProfile.mockResolvedValue(profile);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getProfile(req, res, next);

      expect(mockService.getProfile).toHaveBeenCalledWith('u1');
      expect(success).toHaveBeenCalledWith(res, 'Profile retrieved', { user: profile });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getProfile.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getProfile(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updateProfile ─────────────────────────────────────
  describe('updateProfile', () => {
    it('should update profile and call success', async () => {
      const updated = createMockUser({ firstName: 'New' });
      mockService.updateProfile.mockResolvedValue(updated);
      req = createMockReq({ user: { userId: 'u1' }, body: { firstName: 'New' } });

      await controller.updateProfile(req, res, next);

      expect(mockService.updateProfile).toHaveBeenCalledWith('u1', req.body);
      expect(success).toHaveBeenCalledWith(res, 'Profile updated successfully', { user: updated });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.updateProfile.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.updateProfile(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── deleteAccount ─────────────────────────────────────
  describe('deleteAccount', () => {
    it('should delete account and call success', async () => {
      mockService.deleteAccount.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, body: { reason: 'leaving' } });

      await controller.deleteAccount(req, res, next);

      expect(mockService.deleteAccount).toHaveBeenCalledWith('u1', 'leaving');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.deleteAccount.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.deleteAccount(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getUserById ───────────────────────────────────────
  describe('getUserById', () => {
    it('should get user by id and call success', async () => {
      const profile = createMockUser();
      mockService.getPublicProfile.mockResolvedValue(profile);
      req = createMockReq({ params: { userId: 'u2' } });

      await controller.getUserById(req, res, next);

      expect(mockService.getPublicProfile).toHaveBeenCalledWith('u2');
      expect(success).toHaveBeenCalledWith(res, 'User profile retrieved', { user: profile });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockService.getPublicProfile.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' } });

      await controller.getUserById(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── registerAsDriver ──────────────────────────────────
  describe('registerAsDriver', () => {
    it('should register as driver and call created', async () => {
      const result = { driverStatus: 'pending' };
      mockService.registerAsDriver.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, body: { licenseNumber: 'LN1' } });

      await controller.registerAsDriver(req, res, next);

      expect(mockService.registerAsDriver).toHaveBeenCalledWith('u1', req.body);
      expect(created).toHaveBeenCalledWith(res, expect.any(String), { driver: result });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.registerAsDriver.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.registerAsDriver(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getVerificationStatus ─────────────────────────────
  describe('getVerificationStatus', () => {
    it('should get status and call success', async () => {
      const status = { status: 'pending' };
      mockService.getDriverVerificationStatus.mockResolvedValue(status);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getVerificationStatus(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Verification status retrieved', { verification: status });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDriverVerificationStatus.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getVerificationStatus(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── uploadDocument ────────────────────────────────────
  describe('uploadDocument', () => {
    it('should upload and call created', async () => {
      const doc = { documentId: 'd1' };
      mockService.uploadDriverDocument.mockResolvedValue(doc);
      req = createMockReq({
        user: { userId: 'u1' },
        body: { documentType: 'license', documentUrl: 'url', expiryDate: '2027-01-01' },
      });

      await controller.uploadDocument(req, res, next);

      expect(mockService.uploadDriverDocument).toHaveBeenCalledWith('u1', expect.objectContaining({ documentType: 'license' }));
      expect(created).toHaveBeenCalledWith(res, 'Document uploaded successfully', { document: doc });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.uploadDriverDocument.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.uploadDocument(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getDocuments ──────────────────────────────────────
  describe('getDocuments', () => {
    it('should get documents and call success', async () => {
      const docs = [{ id: 'd1' }];
      mockService.getDriverDocuments.mockResolvedValue(docs);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getDocuments(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Documents retrieved', { documents: docs });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getDriverDocuments.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getDocuments(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getVehicles ───────────────────────────────────────
  describe('getVehicles', () => {
    it('should get vehicles and call success', async () => {
      const vehicles = [{ vehicleId: 'v1' }];
      mockService.getVehicles.mockResolvedValue(vehicles);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getVehicles(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Vehicles retrieved', { vehicles });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getVehicles.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getVehicles(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── addVehicle ────────────────────────────────────────
  describe('addVehicle', () => {
    it('should add vehicle and call created', async () => {
      const vehicle = { vehicleId: 'v1' };
      mockService.addVehicle.mockResolvedValue(vehicle);
      req = createMockReq({ user: { userId: 'u1' }, body: { make: 'Toyota' } });

      await controller.addVehicle(req, res, next);

      expect(mockService.addVehicle).toHaveBeenCalledWith('u1', req.body);
      expect(created).toHaveBeenCalledWith(res, 'Vehicle added successfully', { vehicle });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.addVehicle.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.addVehicle(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updateVehicle ─────────────────────────────────────
  describe('updateVehicle', () => {
    it('should update vehicle and call success', async () => {
      const vehicle = { vehicleId: 'v1' };
      mockService.updateVehicle.mockResolvedValue(vehicle);
      req = createMockReq({ user: { userId: 'u1' }, params: { vehicleId: 'v1' }, body: { color: 'Red' } });

      await controller.updateVehicle(req, res, next);

      expect(mockService.updateVehicle).toHaveBeenCalledWith(req.user, 'v1', req.body);
      expect(success).toHaveBeenCalledWith(res, 'Vehicle updated successfully', { vehicle });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.updateVehicle.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, params: { vehicleId: 'v1' }, body: {} });

      await controller.updateVehicle(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── deleteVehicle ─────────────────────────────────────
  describe('deleteVehicle', () => {
    it('should delete vehicle and call success', async () => {
      mockService.removeVehicle.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, params: { vehicleId: 'v1' } });

      await controller.deleteVehicle(req, res, next);

      expect(mockService.removeVehicle).toHaveBeenCalledWith('u1', 'v1');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.removeVehicle.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, params: { vehicleId: 'v1' } });

      await controller.deleteVehicle(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getEmergencyContacts ──────────────────────────────
  describe('getEmergencyContacts', () => {
    it('should get contacts and call success', async () => {
      const contacts = [{ name: 'Mom' }];
      mockService.getEmergencyContacts.mockResolvedValue(contacts);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getEmergencyContacts(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Emergency contacts retrieved', { contacts });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getEmergencyContacts.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getEmergencyContacts(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── addEmergencyContact ───────────────────────────────
  describe('addEmergencyContact', () => {
    it('should add contact and call created', async () => {
      const contact = { name: 'Dad' };
      mockService.addEmergencyContact.mockResolvedValue(contact);
      req = createMockReq({ user: { userId: 'u1' }, body: { name: 'Dad', phone: '+234' } });

      await controller.addEmergencyContact(req, res, next);

      expect(mockService.addEmergencyContact).toHaveBeenCalledWith(req.user, req.body);
      expect(created).toHaveBeenCalledWith(res, 'Emergency contact added', { contact });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.addEmergencyContact.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.addEmergencyContact(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updateEmergencyContact ────────────────────────────
  describe('updateEmergencyContact', () => {
    it('should update contact and call success', async () => {
      const contact = { name: 'Dad' };
      mockService.updateEmergencyContact.mockResolvedValue(contact);
      req = createMockReq({ user: { userId: 'u1' }, params: { contactId: 'c1' }, body: { name: 'Dad' } });

      await controller.updateEmergencyContact(req, res, next);

      expect(mockService.updateEmergencyContact).toHaveBeenCalledWith('u1', 'c1', req.body);
      expect(success).toHaveBeenCalledWith(res, 'Emergency contact updated', { contact });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.updateEmergencyContact.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, params: { contactId: 'c1' }, body: {} });

      await controller.updateEmergencyContact(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── deleteEmergencyContact ────────────────────────────
  describe('deleteEmergencyContact', () => {
    it('should delete contact and call success', async () => {
      mockService.removeEmergencyContact.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, params: { contactId: 'c1' } });

      await controller.deleteEmergencyContact(req, res, next);

      expect(mockService.removeEmergencyContact).toHaveBeenCalledWith('u1', 'c1');
      expect(success).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.removeEmergencyContact.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, params: { contactId: 'c1' } });

      await controller.deleteEmergencyContact(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getStatistics ─────────────────────────────────────
  describe('getStatistics', () => {
    it('should get stats and call success', async () => {
      const stats = { totalRides: 10 };
      mockService.getUserStatistics.mockResolvedValue(stats);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getStatistics(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Statistics retrieved', { statistics: stats });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserStatistics.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getStatistics(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getRideHistory ────────────────────────────────────
  describe('getRideHistory', () => {
    it('should get ride history and call paginated', async () => {
      const result = { rides: [], pagination: { page: 1, total: 0 } };
      mockService.getRideHistory.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { role: 'passenger', page: '1', limit: '20' } });

      await controller.getRideHistory(req, res, next);

      expect(mockService.getRideHistory).toHaveBeenCalledWith('u1', { role: 'passenger', page: 1, limit: 20 });
      expect(paginated).toHaveBeenCalledWith(res, 'Ride history retrieved', result.rides, result.pagination);
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getRideHistory.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getRideHistory(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getPreferences ────────────────────────────────────
  describe('getPreferences', () => {
    it('should get preferences and call success', async () => {
      const prefs = { theme: 'dark' };
      mockService.getPreferences.mockResolvedValue(prefs);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getPreferences(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Preferences retrieved', { preferences: prefs });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getPreferences.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' } });

      await controller.getPreferences(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updatePreferences ─────────────────────────────────
  describe('updatePreferences', () => {
    it('should update preferences and call success', async () => {
      const prefs = { theme: 'light' };
      mockService.updatePreferences.mockResolvedValue(prefs);
      req = createMockReq({ user: { userId: 'u1' }, body: { theme: 'light' } });

      await controller.updatePreferences(req, res, next);

      expect(success).toHaveBeenCalledWith(res, 'Preferences updated', { preferences: prefs });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.updatePreferences.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.updatePreferences(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminGetUsers ─────────────────────────────────────
  describe('adminGetUsers', () => {
    it('should get users and call paginated', async () => {
      const result = { users: [], pagination: { page: 1, total: 0 } };
      mockService.getUsers.mockResolvedValue(result);
      req = createMockReq({ query: { page: '1', limit: '20' } });

      await controller.adminGetUsers(req, res, next);

      expect(mockService.getUsers).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
      expect(paginated).toHaveBeenCalledWith(res, 'Users retrieved', result.users, result.pagination);
    });

    it('should parse isDriver and isVerified boolean strings', async () => {
      const result = { users: [], pagination: {} };
      mockService.getUsers.mockResolvedValue(result);
      req = createMockReq({ query: { isDriver: 'true', isVerified: 'false' } });

      await controller.adminGetUsers(req, res, next);

      expect(mockService.getUsers).toHaveBeenCalledWith(expect.objectContaining({ isDriver: true, isVerified: false }));
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUsers.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.adminGetUsers(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminGetUserById ──────────────────────────────────
  describe('adminGetUserById', () => {
    it('should get user and call success', async () => {
      const user = createMockUser();
      mockService.getProfile.mockResolvedValue(user);
      req = createMockReq({ params: { userId: 'u2' } });

      await controller.adminGetUserById(req, res, next);

      expect(mockService.getProfile).toHaveBeenCalledWith('u2');
      expect(success).toHaveBeenCalledWith(res, 'User details retrieved', { user });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getProfile.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' } });

      await controller.adminGetUserById(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminUpdateUser ───────────────────────────────────
  describe('adminUpdateUser', () => {
    it('should update user and call success', async () => {
      const updated = createMockUser();
      mockService.adminUpdateUser.mockResolvedValue(updated);
      req = createMockReq({ params: { userId: 'u2' }, user: { userId: 'admin1' }, body: { role: 'staff' } });

      await controller.adminUpdateUser(req, res, next);

      expect(mockService.adminUpdateUser).toHaveBeenCalledWith('u2', req.body, 'admin1');
      expect(success).toHaveBeenCalledWith(res, 'User updated', { user: updated });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.adminUpdateUser.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' }, user: { userId: 'admin1' }, body: {} });

      await controller.adminUpdateUser(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminVerifyDriver ─────────────────────────────────
  describe('adminVerifyDriver', () => {
    it('should verify driver and call success', async () => {
      const result = { driverStatus: 'verified' };
      mockService.verifyDriver.mockResolvedValue(result);
      req = createMockReq({ params: { userId: 'u2' }, user: { userId: 'admin1' }, body: { status: 'verified', reason: 'ok' } });

      await controller.adminVerifyDriver(req, res, next);

      expect(mockService.verifyDriver).toHaveBeenCalledWith('u2', 'verified', 'ok', 'admin1');
      expect(success).toHaveBeenCalledWith(res, 'Driver verified successfully', { driver: result });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.verifyDriver.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' }, user: { userId: 'admin1' }, body: { status: 'verified' } });

      await controller.adminVerifyDriver(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminSuspendUser ──────────────────────────────────
  describe('adminSuspendUser', () => {
    it('should suspend user and call success', async () => {
      const result = { status: 'suspended' };
      mockService.suspendUser.mockResolvedValue(result);
      req = createMockReq({ params: { userId: 'u2' }, user: { userId: 'admin1' }, body: { suspended: true, reason: 'abuse' } });

      await controller.adminSuspendUser(req, res, next);

      expect(mockService.suspendUser).toHaveBeenCalledWith('u2', true, 'abuse', 'admin1');
      expect(success).toHaveBeenCalledWith(res, 'User suspended successfully', { user: result });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.suspendUser.mockRejectedValue(err);
      req = createMockReq({ params: { userId: 'u2' }, user: { userId: 'admin1' }, body: { suspended: true } });

      await controller.adminSuspendUser(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
