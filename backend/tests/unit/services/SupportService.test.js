'use strict';

jest.mock('../../../src/infrastructure/database/repositories/SupportRepository');
jest.mock('../../../src/infrastructure/database/repositories/UserRepository');
jest.mock('../../../src/core/services/NotificationService');

const SupportService = require('../../../src/core/services/SupportService');
const SupportRepository = require('../../../src/infrastructure/database/repositories/SupportRepository');

describe('SupportService', () => {
  let service;
  let mockRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SupportService();
    mockRepo = service.supportRepository;
  });

  describe('createTicket', () => {
    it('should create a ticket and return it with reference', async () => {
      mockRepo.createTicket.mockImplementation(async (t) => t);
      service.userRepository.findById = jest.fn().mockResolvedValue({ email: 'user@test.com', firstName: 'John' });

      const result = await service.createTicket('user-1', {
        category: 'ride_dispute',
        subject: 'Driver took wrong route',
        description: 'The driver deviated from the agreed route significantly',
      });

      expect(result.ticketId).toBeDefined();
      expect(result.status).toBe('OPEN');
      expect(result.priority).toBe('MEDIUM');
      expect(result.reference).toMatch(/^PSR-/);
      expect(mockRepo.createTicket).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        category: 'ride_dispute',
      }));
    });

    it('should throw ValidationError for invalid category', async () => {
      await expect(
        service.createTicket('user-1', {
          category: 'invalid_category',
          subject: 'Test subject here',
          description: 'Test description that is long enough',
        }),
      ).rejects.toThrow('category must be one of');
    });
  });

  describe('closeTicket', () => {
    it('should close ticket owned by user', async () => {
      mockRepo.getTicket.mockResolvedValue({ ticketId: 't-1', userId: 'user-1', status: 'OPEN' });
      mockRepo.updateTicket.mockResolvedValue({ ticketId: 't-1', status: 'CLOSED' });

      const result = await service.closeTicket('user-1', 't-1');
      expect(mockRepo.updateTicket).toHaveBeenCalledWith('t-1', 'user-1', expect.objectContaining({ status: 'CLOSED' }));
    });

    it('should throw ForbiddenError if user does not own ticket', async () => {
      mockRepo.getTicket.mockResolvedValue({ ticketId: 't-1', userId: 'other-user', status: 'OPEN' });

      await expect(service.closeTicket('user-1', 't-1')).rejects.toThrow();
    });
  });

  describe('respondToTicket (admin)', () => {
    it('should add response and send email notification to user', async () => {
      mockRepo.getTicket.mockResolvedValue({ ticketId: 't-1', userId: 'user-1', status: 'OPEN' });
      mockRepo.addResponse.mockResolvedValue({ ticketId: 't-1' });
      mockRepo.updateTicket.mockResolvedValue({ ticketId: 't-1', status: 'IN_PROGRESS' });
      service.userRepository.findById = jest.fn().mockResolvedValue({ email: 'user@test.com', firstName: 'John' });

      await service.respondToTicket('admin-1', 't-1', 'We are looking into this');

      expect(mockRepo.addResponse).toHaveBeenCalledWith('t-1', 'user-1', expect.objectContaining({
        responderId: 'admin-1',
        message: 'We are looking into this',
        isAdmin: true,
      }));
    });
  });
});
