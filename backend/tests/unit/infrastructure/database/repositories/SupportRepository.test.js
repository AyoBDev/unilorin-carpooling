'use strict';

jest.mock('../../../../../src/infrastructure/database/config/dynamodb.config', () => ({
  docClient: { send: jest.fn() },
  getTableName: () => 'psride-test',
}));

const SupportRepository = require('../../../../../src/infrastructure/database/repositories/SupportRepository');

describe('SupportRepository', () => {
  let repo;
  let mockSend;

  beforeEach(() => {
    repo = new SupportRepository();
    const { docClient } = require('../../../../../src/infrastructure/database/config/dynamodb.config');
    mockSend = docClient.send;
    mockSend.mockReset();
  });

  describe('createTicket', () => {
    it('should store ticket with correct PK/SK and GSI keys', async () => {
      mockSend.mockResolvedValueOnce({});

      const ticket = {
        ticketId: 'ticket-001',
        userId: 'user-456',
        reference: 'PSR-ABC123',
        category: 'ride_dispute',
        subject: 'Driver was rude',
        description: 'The driver was very rude during the ride',
        status: 'OPEN',
        priority: 'MEDIUM',
        responses: [],
        createdAt: '2026-06-17T10:00:00Z',
      };

      await repo.createTicket(ticket);

      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('USER#user-456');
      expect(putParams.Item.SK).toBe('TICKET#ticket-001');
      expect(putParams.Item.GSI1PK).toBe('TICKET#STATUS#OPEN');
      expect(putParams.Item.GSI1SK).toBe('2026-06-17T10:00:00Z');
      expect(putParams.Item.GSI2PK).toBe('TICKET#ticket-001');
      expect(putParams.Item.GSI2SK).toBe('TICKET');
      expect(putParams.Item.EntityType).toBe('SUPPORT_TICKET');
    });
  });

  describe('getTicket', () => {
    it('should query GSI2 to find ticket by ticketId alone', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ ticketId: 'ticket-001', subject: 'Test' }],
        Count: 1,
      });

      const result = await repo.getTicket('ticket-001');

      const queryParams = mockSend.mock.calls[0][0].input;
      expect(queryParams.IndexName).toBe('GSI2');
      expect(queryParams.ExpressionAttributeValues[':gsi2pk']).toBe('TICKET#ticket-001');
      expect(result.ticketId).toBe('ticket-001');
    });
  });

  describe('getTicketsByStatus', () => {
    it('should query GSI1 for tickets filtered by status', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ ticketId: 't1', status: 'OPEN' }],
        Count: 1,
      });

      await repo.getTicketsByStatus('OPEN', { limit: 10 });

      const queryParams = mockSend.mock.calls[0][0].input;
      expect(queryParams.IndexName).toBe('GSI1');
      expect(queryParams.ExpressionAttributeValues[':gsi1pk']).toBe('TICKET#STATUS#OPEN');
    });
  });
});
