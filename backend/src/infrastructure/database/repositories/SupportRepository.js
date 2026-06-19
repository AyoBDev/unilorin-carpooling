'use strict';

const BaseRepository = require('./BaseRepository');
const { logger } = require('../../../shared/utils/logger');

class SupportRepository extends BaseRepository {
  constructor() {
    super('SUPPORT_TICKET');
  }

  async createTicket(ticket) {
    const item = {
      PK: `USER#${ticket.userId}`,
      SK: `TICKET#${ticket.ticketId}`,
      GSI1PK: `TICKET#STATUS#${ticket.status}`,
      GSI1SK: ticket.createdAt,
      GSI2PK: `TICKET#${ticket.ticketId}`,
      GSI2SK: 'TICKET',
      EntityType: 'SUPPORT_TICKET',
      ...ticket,
    };

    await this.create(item, { preventOverwrite: true });
    return ticket;
  }

  async getTicket(ticketId) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk AND GSI2SK = :gsi2sk',
      ExpressionAttributeValues: {
        ':gsi2pk': `TICKET#${ticketId}`,
        ':gsi2sk': 'TICKET',
      },
      Limit: 1,
    };
    const result = await this.query(params);
    return result.items[0] || null;
  }

  async getTicketsByUser(userId, options = {}) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'TICKET#',
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };

    if (options.status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues[':status'] = options.status;
    }

    if (options.lastKey) params.ExclusiveStartKey = options.lastKey;
    return this.query(params);
  }

  async getTicketsByStatus(status, options = {}) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `TICKET#STATUS#${status}`,
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };
    if (options.lastKey) params.ExclusiveStartKey = options.lastKey;
    return this.query(params);
  }

  async getAllTickets(options = {}) {
    const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    const targetStatuses = options.status ? [options.status] : statuses.slice(0, 3);

    const allItems = [];
    for (const status of targetStatuses) {
      const result = await this.getTicketsByStatus(status, { limit: options.limit || 50 });
      allItems.push(...result.items);
    }

    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { items: allItems.slice(0, options.limit || 50), count: allItems.length };
  }

  async updateTicket(ticketId, userId, updates) {
    const newUpdates = { ...updates };
    if (updates.status) {
      newUpdates.GSI1PK = `TICKET#STATUS#${updates.status}`;
    }
    return this.update(`USER#${userId}`, `TICKET#${ticketId}`, newUpdates);
  }

  async addResponse(ticketId, userId, response) {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return null;

    const responses = ticket.responses || [];
    responses.push(response);

    return this.update(`USER#${ticket.userId}`, `TICKET#${ticketId}`, {
      responses,
    });
  }
}

module.exports = SupportRepository;
