/**
 * BookingEventPublisher Unit Tests
 */

'use strict';

const BookingEventPublisher = require('../../../../src/infrastructure/messaging/BookingEventPublisher');

describe('BookingEventPublisher', () => {
  let mockPublisher;
  let bookingPublisher;

  const mockBooking = {
    bookingId: 'booking-123',
    bookingReference: 'BK-ABC123',
    rideId: 'ride-456',
    passengerId: 'passenger-789',
    driverId: 'driver-101',
    rideDate: '2026-03-01',
    rideTime: '08:30',
    totalAmount: 500,
    verificationCode: '123456',
    pickupPointName: 'Main Gate',
    passenger: {
      userId: 'passenger-789',
      firstName: 'Ayo',
      email: 'ayo@unilorin.edu.ng',
    },
    driver: {
      userId: 'driver-101',
      firstName: 'Chidi',
      email: 'chidi@unilorin.edu.ng',
    },
  };

  beforeEach(() => {
    mockPublisher = { publish: jest.fn().mockResolvedValue({ MessageId: 'msg-1' }) };
    bookingPublisher = new BookingEventPublisher(mockPublisher);
  });

  describe('bookingCreated', () => {
    it('should publish message with correct SQS trigger shape', async () => {
      await bookingPublisher.bookingCreated(mockBooking);

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      const message = mockPublisher.publish.mock.calls[0][0];

      expect(message).toMatchObject({
        type: 'email',
        recipient: { userId: 'passenger-789', email: 'ayo@unilorin.edu.ng' },
        payload: {
          template: 'booking_confirmed',
          subject: expect.any(String),
          data: expect.objectContaining({
            verificationCode: '123456',
            amount: 500,
            passengerName: 'Ayo',
          }),
        },
        metadata: {
          correlationId: expect.any(String),
          source: 'booking-service',
          priority: 'high',
        },
      });
    });
  });

  describe('bookingConfirmed', () => {
    it('should send to passenger with confirmed template', async () => {
      await bookingPublisher.bookingConfirmed(mockBooking);

      const message = mockPublisher.publish.mock.calls[0][0];
      expect(message.recipient.userId).toBe('passenger-789');
      expect(message.payload.template).toBe('booking_confirmed');
    });
  });

  describe('bookingCancelled', () => {
    it('should notify driver when passenger cancels', async () => {
      await bookingPublisher.bookingCancelled(mockBooking, 'passenger', 'Changed plans');

      const message = mockPublisher.publish.mock.calls[0][0];
      expect(message.recipient.userId).toBe('driver-101');
      expect(message.recipient.email).toBe('chidi@unilorin.edu.ng');
      expect(message.payload.data.reason).toBe('Changed plans');
    });

    it('should notify passenger when driver cancels', async () => {
      await bookingPublisher.bookingCancelled(mockBooking, 'driver', 'Emergency');

      const message = mockPublisher.publish.mock.calls[0][0];
      expect(message.recipient.userId).toBe('passenger-789');
      expect(message.recipient.email).toBe('ayo@unilorin.edu.ng');
    });
  });

  describe('bookingNoShow', () => {
    it('should send no-show notification to passenger', async () => {
      await bookingPublisher.bookingNoShow(mockBooking);

      const message = mockPublisher.publish.mock.calls[0][0];
      expect(message.recipient.userId).toBe('passenger-789');
      expect(message.payload.subject).toContain('No-Show');
    });
  });
});
