'use strict';

jest.mock('../../../../../src/infrastructure/database/config/dynamodb.config', () => ({
  docClient: { send: jest.fn() },
  getTableName: () => 'psride-test',
}));

const SafetyRepository = require('../../../../../src/infrastructure/database/repositories/SafetyRepository');

describe('SafetyRepository', () => {
  let repo;
  let mockSend;

  beforeEach(() => {
    repo = new SafetyRepository();
    const { docClient } = require('../../../../../src/infrastructure/database/config/dynamodb.config');
    mockSend = docClient.send;
    mockSend.mockReset();
  });

  describe('createAlert', () => {
    it('should create SOS alert with correct PK/SK and GSI keys', async () => {
      mockSend.mockResolvedValueOnce({});

      const alertData = {
        alertId: 'alert-123',
        userId: 'user-456',
        type: 'sos',
        status: 'active',
        location: { latitude: 8.4799, longitude: 4.5418 },
        message: 'Help!',
        triggeredAt: '2026-06-17T10:00:00Z',
        expiresAt: '2026-06-17T11:00:00Z',
      };

      const result = await repo.createAlert(alertData);

      expect(mockSend).toHaveBeenCalled();
      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('USER#user-456');
      expect(putParams.Item.SK).toBe('SOS#alert-123');
      expect(putParams.Item.GSI1PK).toBe('SOS#STATUS#active');
      expect(putParams.Item.GSI1SK).toBe('2026-06-17T10:00:00Z');
      expect(putParams.Item.EntityType).toBe('SOS_ALERT');
      expect(result.alertId).toBe('alert-123');
    });
  });

  describe('getAlertsByStatus', () => {
    it('should query GSI1 for alerts by status', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ alertId: 'a1', status: 'active' }],
        Count: 1,
      });

      const result = await repo.getAlertsByStatus('active', { limit: 20 });

      const queryParams = mockSend.mock.calls[0][0].input;
      expect(queryParams.IndexName).toBe('GSI1');
      expect(queryParams.KeyConditionExpression).toContain('GSI1PK = :gsi1pk');
      expect(queryParams.ExpressionAttributeValues[':gsi1pk']).toBe('SOS#STATUS#active');
    });
  });

  describe('createTrackingSession', () => {
    it('should create tracking session with correct keys', async () => {
      mockSend.mockResolvedValueOnce({});

      const sessionData = {
        sessionId: 'sess-789',
        bookingId: 'booking-111',
        rideId: 'ride-222',
        userId: 'user-456',
        status: 'active',
        startedAt: '2026-06-17T10:00:00Z',
      };

      await repo.createTrackingSession(sessionData);

      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('BOOKING#booking-111');
      expect(putParams.Item.SK).toBe('TRACKING#sess-789');
      expect(putParams.Item.GSI1PK).toBe('TRACKING#ACTIVE');
      expect(putParams.Item.EntityType).toBe('SAFETY_SESSION');
    });
  });

  describe('createLocationShare', () => {
    it('should create location share with shareToken as PK', async () => {
      mockSend.mockResolvedValueOnce({});

      const shareData = {
        shareToken: 'token-abc',
        userId: 'user-456',
        bookingId: 'booking-111',
        status: 'active',
      };

      await repo.createLocationShare(shareData);

      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('SHARE#token-abc');
      expect(putParams.Item.SK).toBe('LOCATION');
      expect(putParams.Item.GSI1PK).toBe('USER#user-456');
      expect(putParams.Item.EntityType).toBe('LOCATION_SHARE');
    });
  });

  describe('getLocationShare', () => {
    it('should get location share by token', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { PK: 'SHARE#token-abc', SK: 'LOCATION', shareToken: 'token-abc', status: 'active' },
      });

      const result = await repo.getLocationShare('token-abc');
      const getParams = mockSend.mock.calls[0][0].input;
      expect(getParams.Key.PK).toBe('SHARE#token-abc');
      expect(getParams.Key.SK).toBe('LOCATION');
      expect(result.shareToken).toBe('token-abc');
    });
  });
});
