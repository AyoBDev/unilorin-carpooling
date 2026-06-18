'use strict';

const SupportRepository = require('../../infrastructure/database/repositories/SupportRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const NotificationService = require('./NotificationService');
const { SupportTicket, TICKET_STATUS } = require('../domain/entities/SupportTicket');
const { NotFoundError, ForbiddenError } = require('../../shared/errors');
const { logger } = require('../../shared/utils/logger');

class SupportService {
  constructor() {
    this.supportRepository = new SupportRepository();
    this.userRepository = new UserRepository();
    this.notificationService = new NotificationService();
  }

  async createTicket(userId, { category, subject, description }) {
    const ticket = SupportTicket.create({ userId, category, subject, description });
    await this.supportRepository.createTicket(ticket);

    const user = await this.userRepository.findById(userId);
    if (user?.email) {
      await this.notificationService._sendEmail(
        {
          to: user.email,
          subject: `Support Ticket Created: ${ticket.reference}`,
          template: 'support_ticket_created',
          data: { firstName: user.firstName, reference: ticket.reference, ticketSubject: subject },
        },
        userId,
        'system',
      );
    }

    logger.info('Support ticket created', { ticketId: ticket.ticketId, userId, category });
    return ticket;
  }

  async getMyTickets(userId, options = {}) {
    return this.supportRepository.getTicketsByUser(userId, options);
  }

  async getTicket(userId, ticketId) {
    const ticket = await this.supportRepository.getTicket(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenError('You do not have access to this ticket');
    return ticket;
  }

  async closeTicket(userId, ticketId) {
    const ticket = await this.supportRepository.getTicket(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenError('You do not have access to this ticket');

    return this.supportRepository.updateTicket(ticketId, userId, {
      status: TICKET_STATUS.CLOSED,
    });
  }

  async getAllTickets(options = {}) {
    return this.supportRepository.getAllTickets(options);
  }

  async getTicketAdmin(ticketId) {
    const ticket = await this.supportRepository.getTicket(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');
    return ticket;
  }

  async respondToTicket(adminId, ticketId, message) {
    const ticket = await this.supportRepository.getTicket(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const response = {
      responderId: adminId,
      message,
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };

    await this.supportRepository.addResponse(ticketId, ticket.userId, response);

    if (ticket.status === TICKET_STATUS.OPEN) {
      await this.supportRepository.updateTicket(ticketId, ticket.userId, {
        status: TICKET_STATUS.IN_PROGRESS,
      });
    }

    const user = await this.userRepository.findById(ticket.userId);
    if (user?.email) {
      await this.notificationService._sendEmail(
        {
          to: user.email,
          subject: `Update on your support ticket: ${ticket.reference}`,
          template: 'support_ticket_response',
          data: { firstName: user.firstName, reference: ticket.reference, responsePreview: message.substring(0, 200) },
        },
        ticket.userId,
        'system',
      );
    }

    logger.info('Admin responded to ticket', { ticketId, adminId });
    return { success: true };
  }

  async updateTicketStatus(adminId, ticketId, status) {
    const ticket = await this.supportRepository.getTicket(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    const updates = { status };
    if (status === TICKET_STATUS.RESOLVED) {
      updates.resolvedAt = new Date().toISOString();
    }

    const updated = await this.supportRepository.updateTicket(ticketId, ticket.userId, updates);

    if (status === TICKET_STATUS.RESOLVED) {
      const user = await this.userRepository.findById(ticket.userId);
      if (user?.email) {
        await this.notificationService._sendEmail(
          {
            to: user.email,
            subject: `Your support ticket has been resolved: ${ticket.reference}`,
            template: 'support_ticket_resolved',
            data: { firstName: user.firstName, reference: ticket.reference, ticketSubject: ticket.subject },
          },
          ticket.userId,
          'system',
        );
      }
    }

    logger.info('Ticket status updated', { ticketId, adminId, status });
    return updated;
  }

  async assignTicket(adminId, ticketId, assigneeId) {
    const ticket = await this.supportRepository.getTicket(ticketId);
    if (!ticket) throw new NotFoundError('Ticket not found');

    return this.supportRepository.updateTicket(ticketId, ticket.userId, {
      assignedTo: assigneeId,
    });
  }
}

module.exports = SupportService;
