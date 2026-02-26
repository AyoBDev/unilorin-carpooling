/**
 * Event Publisher — SQS Transport
 * University of Ilorin Carpooling Platform
 *
 * Low-level abstraction for publishing messages to the
 * notifications SQS queue. Degrades gracefully when the
 * queue URL is not configured or SQS is unreachable.
 *
 * @module infrastructure/messaging/EventPublisher
 */

'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { logger } = require('../../shared/utils/logger');

class EventPublisher {
  constructor() {
    this.queueUrl = process.env.NOTIFICATION_QUEUE_URL || null;
    this.client = this.queueUrl
      ? new SQSClient({ region: process.env.AWS_REGION || 'eu-west-1' })
      : null;
  }

  /**
   * Publish a single message to the notification queue.
   * @param {Object} message - SQS message body (will be JSON-stringified)
   * @param {Object} [options] - Optional SQS send options
   * @param {string} [options.messageGroupId] - FIFO group ID (ignored for standard queues)
   * @param {number} [options.delaySeconds] - Delivery delay in seconds
   * @returns {Promise<Object|null>} SQS response or null on failure / no-op
   */
  async publish(message, options = {}) {
    if (!this.queueUrl || !this.client) {
      logger.debug('EventPublisher: NOTIFICATION_QUEUE_URL not set, skipping publish', {
        messageType: message?.type,
      });
      return null;
    }

    try {
      const params = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      };

      if (options.delaySeconds) {
        params.DelaySeconds = options.delaySeconds;
      }

      if (options.messageGroupId) {
        params.MessageGroupId = options.messageGroupId;
      }

      const result = await this.client.send(new SendMessageCommand(params));

      logger.info('EventPublisher: message published', {
        messageId: result.MessageId,
        messageType: message?.type,
        template: message?.payload?.template,
      });

      return result;
    } catch (error) {
      logger.warn('EventPublisher: failed to publish message', {
        error: error.message,
        messageType: message?.type,
      });
      return null;
    }
  }

  /**
   * Publish multiple messages. Uses Promise.allSettled so one
   * failure does not block others.
   * @param {Array<Object>} messages - Array of message bodies
   * @returns {Promise<{succeeded: number, failed: number}>}
   */
  async publishBatch(messages) {
    if (!messages || messages.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      messages.map((msg) => this.publish(msg)),
    );

    const succeeded = results.filter(
      (r) => r.status === 'fulfilled' && r.value !== null,
    ).length;
    const failed = results.length - succeeded;

    if (failed > 0) {
      logger.warn('EventPublisher: batch had failures', { succeeded, failed });
    }

    return { succeeded, failed };
  }
}

module.exports = EventPublisher;
