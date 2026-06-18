'use strict';

const { randomUUID } = require('crypto');
const { ValidationError } = require('../../../shared/errors');

const TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

const TICKET_CATEGORIES = [
  'account_issue',
  'ride_dispute',
  'payment_issue',
  'safety_concern',
  'driver_complaint',
  'app_bug',
  'other',
];

const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
};

const PRIORITY_BY_CATEGORY = {
  safety_concern: TICKET_PRIORITY.HIGH,
  ride_dispute: TICKET_PRIORITY.MEDIUM,
  payment_issue: TICKET_PRIORITY.MEDIUM,
  driver_complaint: TICKET_PRIORITY.MEDIUM,
  account_issue: TICKET_PRIORITY.LOW,
  app_bug: TICKET_PRIORITY.LOW,
  other: TICKET_PRIORITY.LOW,
};

class SupportTicket {
  static create({ userId, category, subject, description, reference }) {
    if (!userId) throw new ValidationError('userId is required');
    if (!category || !TICKET_CATEGORIES.includes(category)) {
      throw new ValidationError(`category must be one of: ${TICKET_CATEGORIES.join(', ')}`);
    }
    if (!subject || subject.length < 5) throw new ValidationError('subject must be at least 5 characters');
    if (!description || description.length < 10) throw new ValidationError('description must be at least 10 characters');

    return {
      ticketId: randomUUID(),
      userId,
      reference: reference || `PSR-${Date.now().toString(36).toUpperCase()}`,
      category,
      subject,
      description,
      status: TICKET_STATUS.OPEN,
      priority: PRIORITY_BY_CATEGORY[category] || TICKET_PRIORITY.LOW,
      assignedTo: null,
      responses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolvedAt: null,
    };
  }
}

module.exports = { SupportTicket, TICKET_STATUS, TICKET_CATEGORIES, TICKET_PRIORITY };
