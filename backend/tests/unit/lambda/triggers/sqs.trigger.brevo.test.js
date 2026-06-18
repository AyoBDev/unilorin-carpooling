'use strict';

jest.mock('../../../../src/infrastructure/email/BrevoProvider');
jest.mock('web-push');
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../../src/lambda/middleware/lambdaMiddleware', () => ({
  withMiddleware: (name, handler) => handler,
}));

// Mock AWS SDK SNS client (not installed in dev dependencies, only available in Lambda runtime)
jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn().mockImplementation(() => ({})),
  PublishCommand: jest.fn(),
}), { virtual: true });

const BrevoProvider = require('../../../../src/infrastructure/email/BrevoProvider');

describe('SQS Trigger - Brevo email delivery', () => {
  const mockSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_SENDER_EMAIL = 'noreply@psride.ng';
    process.env.BREVO_SENDER_NAME = 'PSRide';
    BrevoProvider.mockImplementation(() => ({ send: mockSend }));
  });

  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
  });

  it('should send email via Brevo when processing SQS email message', async () => {
    mockSend.mockResolvedValueOnce({ messageId: '<brevo-123>', accepted: true });

    jest.isolateModules(() => {
      const { handler } = require('../../../../src/lambda/triggers/sqs.trigger');

      const event = {
        Records: [
          {
            messageId: 'sqs-msg-1',
            body: JSON.stringify({
              type: 'email',
              recipient: { email: 'user@example.com', userId: 'user-1' },
              payload: { template: 'booking_confirmed', data: { passengerName: 'John', rideDate: '2026-06-20' } },
              metadata: { correlationId: 'corr-1', source: 'booking-service' },
            }),
          },
        ],
      };

      return handler(event).then((result) => {
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: expect.any(String),
            htmlContent: expect.stringContaining('John'),
            tags: expect.arrayContaining(['booking_confirmed']),
          }),
        );
        expect(result.batchItemFailures).toHaveLength(0);
      });
    });
  });
});
