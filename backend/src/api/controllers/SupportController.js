/**
 * Support Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles customer support tickets, user inquiries,
 * and admin ticket management.
 *
 * Path: src/api/controllers/SupportController.js
 *
 * @module controllers/SupportController
 */

const SupportService = require('../../core/services/SupportService');
const { success, created } = require('../../shared/utils/response');

class SupportController {
  constructor() {
    this.supportService = new SupportService();

    this.createTicket = this.createTicket.bind(this);
    this.getMyTickets = this.getMyTickets.bind(this);
    this.getTicket = this.getTicket.bind(this);
    this.closeTicket = this.closeTicket.bind(this);
    this.adminGetAllTickets = this.adminGetAllTickets.bind(this);
    this.adminGetTicket = this.adminGetTicket.bind(this);
    this.adminRespond = this.adminRespond.bind(this);
    this.adminUpdateStatus = this.adminUpdateStatus.bind(this);
    this.adminAssign = this.adminAssign.bind(this);
  }

  // ─── USER TICKET OPERATIONS ──────────────────────────────────────

  /**
   * Create a new support ticket
   * POST /api/v1/support/tickets
   */
  async createTicket(req, res, next) {
    try {
      const { category, subject, description } = req.body;
      const ticket = await this.supportService.createTicket(req.user.userId, {
        category,
        subject,
        description,
      });
      return created(res, 'Support ticket created', ticket);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get current user's tickets
   * GET /api/v1/support/tickets
   */
  async getMyTickets(req, res, next) {
    try {
      const { status, limit, lastKey } = req.query;
      const result = await this.supportService.getMyTickets(req.user.userId, {
        status,
        limit: limit ? parseInt(limit, 10) : undefined,
        lastKey: lastKey ? JSON.parse(lastKey) : undefined,
      });
      return success(res, 'Tickets retrieved', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a specific ticket
   * GET /api/v1/support/tickets/:ticketId
   */
  async getTicket(req, res, next) {
    try {
      const ticket = await this.supportService.getTicket(req.user.userId, req.params.ticketId);
      return success(res, 'Ticket retrieved', ticket);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Close a ticket (mark as resolved by user)
   * POST /api/v1/support/tickets/:ticketId/close
   */
  async closeTicket(req, res, next) {
    try {
      const result = await this.supportService.closeTicket(req.user.userId, req.params.ticketId);
      return success(res, 'Ticket closed', result);
    } catch (error) {
      return next(error);
    }
  }

  // ─── ADMIN TICKET MANAGEMENT ─────────────────────────────────────

  /**
   * Admin: Get all support tickets with filters
   * GET /api/v1/admin/support/tickets
   */
  async adminGetAllTickets(req, res, next) {
    try {
      const { status, priority, category, limit } = req.query;
      const result = await this.supportService.getAllTickets({
        status,
        priority,
        category,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      return success(res, 'Tickets retrieved', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Get a specific ticket (full details)
   * GET /api/v1/admin/support/tickets/:ticketId
   */
  async adminGetTicket(req, res, next) {
    try {
      const ticket = await this.supportService.getTicketAdmin(req.params.ticketId);
      return success(res, 'Ticket retrieved', ticket);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Respond to a ticket
   * POST /api/v1/admin/support/tickets/:ticketId/respond
   */
  async adminRespond(req, res, next) {
    try {
      const { message } = req.body;
      const result = await this.supportService.respondToTicket(
        req.user.userId,
        req.params.ticketId,
        message,
      );
      return success(res, 'Response added', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Update ticket status
   * PUT /api/v1/admin/support/tickets/:ticketId/status
   */
  async adminUpdateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const result = await this.supportService.updateTicketStatus(
        req.user.userId,
        req.params.ticketId,
        status,
      );
      return success(res, 'Ticket status updated', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Assign ticket to a support agent
   * PUT /api/v1/admin/support/tickets/:ticketId/assign
   */
  async adminAssign(req, res, next) {
    try {
      const { assigneeId } = req.body;
      const result = await this.supportService.assignTicket(
        req.user.userId,
        req.params.ticketId,
        assigneeId,
      );
      return success(res, 'Ticket assigned', result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new SupportController();
