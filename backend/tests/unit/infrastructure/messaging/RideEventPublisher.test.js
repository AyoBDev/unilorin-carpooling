/**
 * RideEventPublisher Unit Tests
 */

'use strict';

const RideEventPublisher = require('../../../../src/infrastructure/messaging/RideEventPublisher');

describe('RideEventPublisher', () => {
  let mockPublisher;
  let ridePublisher;

  const mockRide = {
    rideId: 'ride-123',
    driverId: 'driver-456',
    departureDate: '2026-03-01',
    departureTime: '08:30',
  };

  const mockBookings = [
    {
      bookingId: 'bk-1',
      bookingReference: 'BK-001',
      passengerId: 'p-1',
      passenger: { firstName: 'Ayo', email: 'ayo@unilorin.edu.ng' },
    },
    {
      bookingId: 'bk-2',
      bookingReference: 'BK-002',
      passengerId: 'p-2',
      passenger: { firstName: 'Bola', email: 'bola@unilorin.edu.ng' },
    },
  ];

  beforeEach(() => {
    mockPublisher = {
      publish: jest.fn().mockResolvedValue({ MessageId: 'msg-1' }),
      publishBatch: jest.fn().mockResolvedValue({ succeeded: 2, failed: 0 }),
    };
    ridePublisher = new RideEventPublisher(mockPublisher);
  });

  describe('rideCancelled', () => {
    it('should publish one message per affected booking', async () => {
      await ridePublisher.rideCancelled(mockRide, mockBookings, 'Emergency');

      expect(mockPublisher.publishBatch).toHaveBeenCalledTimes(1);
      const messages = mockPublisher.publishBatch.mock.calls[0][0];

      expect(messages).toHaveLength(2);
      expect(messages[0].recipient.userId).toBe('p-1');
      expect(messages[1].recipient.userId).toBe('p-2');
      expect(messages[0].payload.data.reason).toBe('Emergency');
      expect(messages[0].metadata.source).toBe('ride-service');
    });

    it('should return early for empty affected bookings', async () => {
      const result = await ridePublisher.rideCancelled(mockRide, [], 'reason');

      expect(result).toEqual({ succeeded: 0, failed: 0 });
      expect(mockPublisher.publishBatch).not.toHaveBeenCalled();
    });

    it('should return early for null affected bookings', async () => {
      const result = await ridePublisher.rideCancelled(mockRide, null, 'reason');

      expect(result).toEqual({ succeeded: 0, failed: 0 });
      expect(mockPublisher.publishBatch).not.toHaveBeenCalled();
    });
  });

  describe('rideUpdated', () => {
    it('should publish one message per affected booking', async () => {
      await ridePublisher.rideUpdated(mockRide, mockBookings);

      expect(mockPublisher.publishBatch).toHaveBeenCalledTimes(1);
      const messages = mockPublisher.publishBatch.mock.calls[0][0];

      expect(messages).toHaveLength(2);
      expect(messages[0].payload.subject).toContain('Updated');
    });

    it('should return early for empty affected bookings', async () => {
      const result = await ridePublisher.rideUpdated(mockRide, []);

      expect(result).toEqual({ succeeded: 0, failed: 0 });
      expect(mockPublisher.publishBatch).not.toHaveBeenCalled();
    });
  });
});
