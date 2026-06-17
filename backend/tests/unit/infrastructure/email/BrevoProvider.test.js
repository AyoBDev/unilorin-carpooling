'use strict';

const BrevoProvider = require('../../../../src/infrastructure/email/BrevoProvider');

// Mock global fetch
global.fetch = jest.fn();

describe('BrevoProvider', () => {
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new BrevoProvider({
      apiKey: 'test-brevo-key',
      senderEmail: 'noreply@psride.ng',
      senderName: 'PSRide',
    });
  });

  describe('send', () => {
    it('should send email via Brevo API and return messageId', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: '<msg-123@brevo.com>' }),
      });

      const result = await provider.send({
        to: 'user@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Hello</h1>',
        textContent: 'Hello',
      });

      expect(result).toEqual({ messageId: '<msg-123@brevo.com>', accepted: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': 'test-brevo-key',
          },
          body: JSON.stringify({
            sender: { name: 'PSRide', email: 'noreply@psride.ng' },
            to: [{ email: 'user@example.com' }],
            subject: 'Test Email',
            htmlContent: '<h1>Hello</h1>',
            textContent: 'Hello',
          }),
        }),
      );
    });

    it('should throw on API error response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' }),
      });

      await expect(
        provider.send({ to: 'user@example.com', subject: 'Test', htmlContent: '<p>Hi</p>' }),
      ).rejects.toThrow('Brevo API error (401): Invalid API key');
    });

    it('should include replyTo and tags when provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messageId: '<msg-456@brevo.com>' }),
      });

      await provider.send({
        to: 'user@example.com',
        subject: 'Test',
        htmlContent: '<p>Hi</p>',
        replyTo: { email: 'support@psride.ng' },
        tags: ['booking', 'confirmation'],
      });

      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.replyTo).toEqual({ email: 'support@psride.ng' });
      expect(body.tags).toEqual(['booking', 'confirmation']);
    });
  });

  describe('sendBatch', () => {
    it('should send multiple emails and return results', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<msg-1>' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<msg-2>' }) });

      const results = await provider.sendBatch([
        { to: 'a@example.com', subject: 'A', htmlContent: '<p>A</p>' },
        { to: 'b@example.com', subject: 'B', htmlContent: '<p>B</p>' },
      ]);

      expect(results).toEqual([
        { messageId: '<msg-1>', accepted: true },
        { messageId: '<msg-2>', accepted: true },
      ]);
    });

    it('should return failed result without throwing when one email fails', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: '<msg-1>' }) })
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: 'Bad request' }) });

      const results = await provider.sendBatch([
        { to: 'a@example.com', subject: 'A', htmlContent: '<p>A</p>' },
        { to: 'bad', subject: 'B', htmlContent: '<p>B</p>' },
      ]);

      expect(results[0]).toEqual({ messageId: '<msg-1>', accepted: true });
      expect(results[1]).toEqual({ messageId: null, accepted: false, error: 'Brevo API error (400): Bad request' });
    });
  });
});
