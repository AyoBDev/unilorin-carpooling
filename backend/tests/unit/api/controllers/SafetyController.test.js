/**
 * SafetyController Unit Tests
 */

const mockService = {
  triggerSOS: jest.fn(),
  resolveSOS: jest.fn(),
  getSOSAlert: jest.fn(),
  getUserSOSAlerts: jest.fn(),
  startLocationSharing: jest.fn(),
  stopLocationSharing: jest.fn(),
  getSharedLocation: jest.fn(),
  updateLocation: jest.fn(),
  reportIncident: jest.fn(),
  getUserIncidents: jest.fn(),
  getAllSOSAlerts: jest.fn(),
  getAllIncidents: jest.fn(),
  resolveIncident: jest.fn(),
};

jest.mock('../../../../src/core/services', () => ({
  SafetyService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock('../../../../src/shared/utils/response', () => ({
  success: jest.fn(),
  created: jest.fn(),
  paginated: jest.fn(),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const controller = require('../../../../src/api/controllers/SafetyController');
const { success, created, paginated } = require('../../../../src/shared/utils/response');
const { createMockReq, createMockRes, createMockNext } = require('../../../helpers/mockFactory');

describe('SafetyController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    next = createMockNext();
  });

  // ─── triggerSOS ────────────────────────────────────────
  describe('triggerSOS', () => {
    it('should trigger SOS and call created', async () => {
      const alert = { alertId: 'a1', contactsNotified: 2 };
      mockService.triggerSOS.mockResolvedValue(alert);
      req = createMockReq({
        user: { userId: 'u1' },
        body: { bookingId: 'b1', location: { lat: 8.48, lng: 4.54 }, message: 'Help' },
      });

      await controller.triggerSOS(req, res, next);

      expect(mockService.triggerSOS).toHaveBeenCalledWith('u1', {
        bookingId: 'b1',
        location: { lat: 8.48, lng: 4.54 },
        message: 'Help',
      });
      expect(created).toHaveBeenCalledWith(
        res,
        expect.stringContaining('SOS alert sent'),
        { alert, contactsNotified: 2 },
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.triggerSOS.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.triggerSOS(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── resolveSOSAlert ───────────────────────────────────
  describe('resolveSOSAlert', () => {
    it('should resolve SOS and call success', async () => {
      const alert = { alertId: 'a1', status: 'resolved' };
      mockService.resolveSOS.mockResolvedValue(alert);
      req = createMockReq({
        params: { alertId: 'a1' },
        user: { userId: 'u1' },
        body: { resolution: 'false alarm' },
      });

      await controller.resolveSOSAlert(req, res, next);

      expect(mockService.resolveSOS).toHaveBeenCalledWith('a1', 'u1', 'false alarm');
      expect(success).toHaveBeenCalledWith(
        res,
        expect.stringContaining('resolved'),
        { alert },
      );
    });

    it('should handle missing body gracefully', async () => {
      const alert = { alertId: 'a1', status: 'resolved' };
      mockService.resolveSOS.mockResolvedValue(alert);
      req = createMockReq({ params: { alertId: 'a1' }, user: { userId: 'u1' } });
      req.body = undefined;

      await controller.resolveSOSAlert(req, res, next);

      expect(mockService.resolveSOS).toHaveBeenCalledWith('a1', 'u1', undefined);
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.resolveSOS.mockRejectedValue(err);
      req = createMockReq({ params: { alertId: 'a1' }, user: { userId: 'u1' }, body: {} });

      await controller.resolveSOSAlert(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getSOSAlert ───────────────────────────────────────
  describe('getSOSAlert', () => {
    it('should get SOS alert and call success', async () => {
      const alert = { alertId: 'a1' };
      mockService.getSOSAlert.mockResolvedValue(alert);
      req = createMockReq({ params: { alertId: 'a1' }, user: { userId: 'u1' } });

      await controller.getSOSAlert(req, res, next);

      expect(mockService.getSOSAlert).toHaveBeenCalledWith('a1', 'u1');
      expect(success).toHaveBeenCalledWith(res, 'SOS alert details', { alert });
    });

    it('should call next on error', async () => {
      const err = new Error('not found');
      mockService.getSOSAlert.mockRejectedValue(err);
      req = createMockReq({ params: { alertId: 'a1' }, user: { userId: 'u1' } });

      await controller.getSOSAlert(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getMySOSAlerts ────────────────────────────────────
  describe('getMySOSAlerts', () => {
    it('should get SOS alert history and call paginated', async () => {
      const result = { alerts: [], pagination: { page: 1, total: 0 } };
      mockService.getUserSOSAlerts.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { status: 'active', page: '2', limit: '5' } });

      await controller.getMySOSAlerts(req, res, next);

      expect(mockService.getUserSOSAlerts).toHaveBeenCalledWith('u1', {
        status: 'active',
        page: 2,
        limit: 5,
      });
      expect(paginated).toHaveBeenCalledWith(res, 'SOS alerts', result.alerts, result.pagination);
    });

    it('should use defaults when no query params', async () => {
      const result = { alerts: [], pagination: {} };
      mockService.getUserSOSAlerts.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getMySOSAlerts(req, res, next);

      expect(mockService.getUserSOSAlerts).toHaveBeenCalledWith('u1', {
        status: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserSOSAlerts.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getMySOSAlerts(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── shareLocation ─────────────────────────────────────
  describe('shareLocation', () => {
    it('should start location sharing and call success', async () => {
      const sharing = { shareUrl: 'https://example.com/track/abc', shareId: 'abc' };
      mockService.startLocationSharing.mockResolvedValue(sharing);
      req = createMockReq({
        user: { userId: 'u1' },
        body: { bookingId: 'b1', location: { lat: 8.48, lng: 4.54 } },
      });

      await controller.shareLocation(req, res, next);

      expect(mockService.startLocationSharing).toHaveBeenCalledWith('u1', {
        bookingId: 'b1',
        location: { lat: 8.48, lng: 4.54 },
      });
      expect(success).toHaveBeenCalledWith(
        res,
        expect.stringContaining('Location sharing started'),
        { sharing, shareUrl: sharing.shareUrl },
      );
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.startLocationSharing.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.shareLocation(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── stopLocationSharing ───────────────────────────────
  describe('stopLocationSharing', () => {
    it('should stop location sharing and call success', async () => {
      mockService.stopLocationSharing.mockResolvedValue();
      req = createMockReq({ user: { userId: 'u1' }, body: { bookingId: 'b1' } });

      await controller.stopLocationSharing(req, res, next);

      expect(mockService.stopLocationSharing).toHaveBeenCalledWith('u1', 'b1');
      expect(success).toHaveBeenCalledWith(res, 'Location sharing stopped');
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.stopLocationSharing.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.stopLocationSharing(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getSharedLocation ─────────────────────────────────
  describe('getSharedLocation', () => {
    it('should get shared location and call success', async () => {
      const location = { lat: 8.48, lng: 4.54, timestamp: '2026-03-01T10:00:00Z' };
      mockService.getSharedLocation.mockResolvedValue(location);
      req = createMockReq({ params: { shareToken: 'tok123' } });

      await controller.getSharedLocation(req, res, next);

      expect(mockService.getSharedLocation).toHaveBeenCalledWith('tok123');
      expect(success).toHaveBeenCalledWith(res, 'Current location', { location });
    });

    it('should call next on error', async () => {
      const err = new Error('expired token');
      mockService.getSharedLocation.mockRejectedValue(err);
      req = createMockReq({ params: { shareToken: 'bad' } });

      await controller.getSharedLocation(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── updateLocation ────────────────────────────────────
  describe('updateLocation', () => {
    it('should update location and call success', async () => {
      mockService.updateLocation.mockResolvedValue();
      req = createMockReq({
        user: { userId: 'u1' },
        body: { bookingId: 'b1', location: { lat: 8.49, lng: 4.55 } },
      });

      await controller.updateLocation(req, res, next);

      expect(mockService.updateLocation).toHaveBeenCalledWith('u1', 'b1', { lat: 8.49, lng: 4.55 });
      expect(success).toHaveBeenCalledWith(res, 'Location updated');
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.updateLocation.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.updateLocation(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── reportIncident ────────────────────────────────────
  describe('reportIncident', () => {
    it('should report incident and call created', async () => {
      const incident = { incidentId: 'i1', type: 'harassment' };
      mockService.reportIncident.mockResolvedValue(incident);
      req = createMockReq({
        user: { userId: 'u1' },
        body: {
          bookingId: 'b1',
          type: 'harassment',
          description: 'Driver was rude',
          severity: 'high',
        },
      });

      await controller.reportIncident(req, res, next);

      expect(mockService.reportIncident).toHaveBeenCalledWith('u1', {
        bookingId: 'b1',
        type: 'harassment',
        description: 'Driver was rude',
        severity: 'high',
      });
      expect(created).toHaveBeenCalledWith(
        res,
        expect.stringContaining('Incident reported'),
        { incident },
      );
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.reportIncident.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, body: {} });

      await controller.reportIncident(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── getIncidentReports ────────────────────────────────
  describe('getIncidentReports', () => {
    it('should get incident reports and call paginated', async () => {
      const result = { incidents: [], pagination: { page: 1, total: 0 } };
      mockService.getUserIncidents.mockResolvedValue(result);
      req = createMockReq({ user: { userId: 'u1' }, query: { page: '1', limit: '10' } });

      await controller.getIncidentReports(req, res, next);

      expect(mockService.getUserIncidents).toHaveBeenCalledWith('u1', { page: 1, limit: 10 });
      expect(paginated).toHaveBeenCalledWith(res, 'Incident reports', result.incidents, result.pagination);
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getUserIncidents.mockRejectedValue(err);
      req = createMockReq({ user: { userId: 'u1' }, query: {} });

      await controller.getIncidentReports(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminGetSOSAlerts ─────────────────────────────────
  describe('adminGetSOSAlerts', () => {
    it('should get all SOS alerts and call paginated', async () => {
      const result = { alerts: [], pagination: { page: 1, total: 0 } };
      mockService.getAllSOSAlerts.mockResolvedValue(result);
      req = createMockReq({ query: { status: 'active', page: '1', limit: '20' } });

      await controller.adminGetSOSAlerts(req, res, next);

      expect(mockService.getAllSOSAlerts).toHaveBeenCalledWith({ status: 'active', page: 1, limit: 20 });
      expect(paginated).toHaveBeenCalledWith(res, 'SOS alerts', result.alerts, result.pagination);
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getAllSOSAlerts.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.adminGetSOSAlerts(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminGetIncidents ─────────────────────────────────
  describe('adminGetIncidents', () => {
    it('should get all incidents and call paginated', async () => {
      const result = { incidents: [], pagination: { page: 1 } };
      mockService.getAllIncidents.mockResolvedValue(result);
      req = createMockReq({
        query: { status: 'open', severity: 'high', type: 'harassment', page: '1', limit: '20' },
      });

      await controller.adminGetIncidents(req, res, next);

      expect(mockService.getAllIncidents).toHaveBeenCalledWith({
        status: 'open',
        severity: 'high',
        type: 'harassment',
        page: 1,
        limit: 20,
      });
      expect(paginated).toHaveBeenCalled();
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.getAllIncidents.mockRejectedValue(err);
      req = createMockReq({ query: {} });

      await controller.adminGetIncidents(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ─── adminResolveIncident ──────────────────────────────
  describe('adminResolveIncident', () => {
    it('should resolve incident and call success', async () => {
      const incident = { incidentId: 'i1', status: 'resolved' };
      mockService.resolveIncident.mockResolvedValue(incident);
      req = createMockReq({
        params: { incidentId: 'i1' },
        user: { userId: 'admin1' },
        body: { resolution: 'Warned driver', action: 'warning_issued' },
      });

      await controller.adminResolveIncident(req, res, next);

      expect(mockService.resolveIncident).toHaveBeenCalledWith('i1', 'admin1', {
        resolution: 'Warned driver',
        action: 'warning_issued',
      });
      expect(success).toHaveBeenCalledWith(res, 'Incident resolved', { incident });
    });

    it('should call next on error', async () => {
      const err = new Error('fail');
      mockService.resolveIncident.mockRejectedValue(err);
      req = createMockReq({ params: { incidentId: 'i1' }, user: { userId: 'admin1' }, body: {} });

      await controller.adminResolveIncident(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
