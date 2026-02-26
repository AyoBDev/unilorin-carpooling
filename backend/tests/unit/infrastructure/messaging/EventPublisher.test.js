/**
 * EventPublisher Unit Tests
 */

'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

// Mock SQS client
jest.mock('@aws-sdk/client-sqs', () => {
  const mockSend = jest.fn();
  return {
    SQSClient: jest.fn(() => ({ send: mockSend })),
    SendMessageCommand: jest.fn((params) => params),
    __mockSend: mockSend,
  };
});

const EventPublisher = require('../../../../src/infrastructure/messaging/EventPublisher');

describe('EventPublisher', () => {
  const originalEnv = process.env;
  let mockSend;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = require('@aws-sdk/client-sqs').__mockSend;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('publish', () => {
    it('should return null when NOTIFICATION_QUEUE_URL is not set', async () => {
      delete process.env.NOTIFICATION_QUEUE_URL;
      const publisher = new EventPublisher();

      const result = await publisher.publish({ type: 'email' });

      expect(result).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should call SQS with correct params when queue URL is set', async () => {
      process.env.NOTIFICATION_QUEUE_URL = 'https://sqs.eu-west-1.amazonaws.com/123/test-queue';
      mockSend.mockResolvedValue({ MessageId: 'msg-123' });

      const publisher = new EventPublisher();
      const message = { type: 'email', recipient: { email: 'test@unilorin.edu.ng' } };

      const result = await publisher.publish(message);

      expect(result).toEqual({ MessageId: 'msg-123' });
      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl: 'https://sqs.eu-west-1.amazonaws.com/123/test-queue',
        MessageBody: JSON.stringify(message),
      });
    });

    it('should include delaySeconds when provided', async () => {
      process.env.NOTIFICATION_QUEUE_URL = 'https://sqs.example.com/queue';
      mockSend.mockResolvedValue({ MessageId: 'msg-456' });

      const publisher = new EventPublisher();
      await publisher.publish({ type: 'email' }, { delaySeconds: 30 });

      expect(SendMessageCommand).toHaveBeenCalledWith(
        expect.objectContaining({ DelaySeconds: 30 }),
      );
    });

    it('should return null on SQS error (never throws)', async () => {
      process.env.NOTIFICATION_QUEUE_URL = 'https://sqs.example.com/queue';
      mockSend.mockRejectedValue(new Error('SQS unavailable'));

      const publisher = new EventPublisher();
      const result = await publisher.publish({ type: 'email' });

      expect(result).toBeNull();
    });
  });

  describe('publishBatch', () => {
    it('should return zeroes for empty array', async () => {
      const publisher = new EventPublisher();
      const result = await publisher.publishBatch([]);

      expect(result).toEqual({ succeeded: 0, failed: 0 });
    });

    it('should return zeroes for null input', async () => {
      const publisher = new EventPublisher();
      const result = await publisher.publishBatch(null);

      expect(result).toEqual({ succeeded: 0, failed: 0 });
    });

    it('should count successes and failures', async () => {
      process.env.NOTIFICATION_QUEUE_URL = 'https://sqs.example.com/queue';
      mockSend
        .mockResolvedValueOnce({ MessageId: 'msg-1' })
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ MessageId: 'msg-3' });

      const publisher = new EventPublisher();
      const result = await publisher.publishBatch([
        { type: 'email' },
        { type: 'email' },
        { type: 'email' },
      ]);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
    });
  });
});
