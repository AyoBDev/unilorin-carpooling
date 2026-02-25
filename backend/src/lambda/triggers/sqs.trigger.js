/**
 * SQS Trigger – Notification Delivery
 * University of Ilorin Carpooling Platform
 *
 * Path: src/lambda/triggers/sqs.trigger.js
 *
 * Consumes messages from the notifications SQS queue and
 * delivers them via the appropriate channel:
 *   - email  → AWS SES
 *   - sms    → AWS SNS
 *   - push   → Web Push / FCM
 *   - in_app → Already persisted by NotificationService
 *
 * SQS message body shape:
 * {
 *   "type": "email|sms|push",
 *   "recipient": { "userId", "email", "phone", "pushToken" },
 *   "payload": {
 *     "template": "booking_confirmed",
 *     "subject": "...",
 *     "body": "...",
 *     "data": { ... }
 *   },
 *   "metadata": {
 *     "correlationId": "...",
 *     "source": "booking-service",
 *     "priority": "high|normal|low"
 *   }
 * }
 *
 * Batch size configured in serverless.yml (default: 10).
 * Failed messages go to the Dead Letter Queue after 3 retries.
 *
 * @module lambda/triggers/sqs
 */

'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { logger } = require('../../shared/utils/logger');
const { withMiddleware } = require('../middleware/lambdaMiddleware');

// ─── AWS Clients (reused across invocations) ────────────

const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const sns = new SNSClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const SENDER_EMAIL = process.env.SES_SENDER_EMAIL || 'noreply@carpool.unilorin.edu.ng';

// ─── Email Templates ────────────────────────────────────

/**
 * Simple template renderer.
 * In production, migrate to AWS SES Templates or a proper
 * template engine.
 */
const EMAIL_TEMPLATES = {
  booking_confirmed: (data) => ({
    subject: 'Booking Confirmed – UniLorin Carpool',
    html: `
      <h2>Your Booking is Confirmed!</h2>
      <p>Hi ${data.passengerName || 'there'},</p>
      <p>Your booking for the ride on <strong>${data.rideDate}</strong> 
         at <strong>${data.departureTime}</strong> has been confirmed.</p>
      ${data.verificationCode
        ? `<p>Your verification code: <strong style="font-size:1.4em">${data.verificationCode}</strong></p>
           <p>Show this code to the driver when boarding.</p>`
        : ''
      }
      <p>Pickup: ${data.pickupPoint || 'See app for details'}</p>
      <p>Amount: ₦${data.amount || '—'} (cash payment)</p>
      <hr/>
      <p style="color:#888;font-size:0.9em">UniLorin Carpool — Safe rides, shared costs</p>
    `,
  }),

  booking_cancelled: (data) => ({
    subject: 'Booking Cancelled – UniLorin Carpool',
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi ${data.userName || 'there'},</p>
      <p>Your booking (ID: ${data.bookingId}) has been cancelled.</p>
      <p>Reason: ${data.reason || 'No reason provided'}</p>
      <p>You can search for another ride in the app.</p>
      <hr/>
      <p style="color:#888;font-size:0.9em">UniLorin Carpool</p>
    `,
  }),

  ride_reminder: (data) => ({
    subject: `Ride Reminder – Departing at ${data.departureTime}`,
    html: `
      <h2>Ride Reminder</h2>
      <p>Hi ${data.userName || 'there'},</p>
      <p>Your ride departs in approximately <strong>1 hour</strong> 
         at <strong>${data.departureTime}</strong>.</p>
      <p>Please be at your pickup point on time.</p>
      <hr/>
      <p style="color:#888;font-size:0.9em">UniLorin Carpool</p>
    `,
  }),

  welcome: (data) => ({
    subject: 'Welcome to UniLorin Carpool!',
    html: `
      <h2>Welcome, ${data.firstName || 'Friend'}!</h2>
      <p>Your email has been verified and your account is now active.</p>
      <p>Start by searching for rides or, if you have a vehicle, create a ride offer!</p>
      <p><a href="${process.env.APP_URL || 'https://carpool.unilorin.edu.ng'}">Open App</a></p>
      <hr/>
      <p style="color:#888;font-size:0.9em">UniLorin Carpool — Safe rides, shared costs</p>
    `,
  }),

  // Fallback for unknown templates
  default: (data) => ({
    subject: data.subject || 'Notification – UniLorin Carpool',
    html: `
      <h2>${data.title || 'Notification'}</h2>
      <p>${data.body || data.message || ''}</p>
      <hr/>
      <p style="color:#888;font-size:0.9em">UniLorin Carpool</p>
    `,
  }),
};

// ─── Delivery Functions ─────────────────────────────────

/**
 * Send email via AWS SES.
 */
const deliverEmail = async (recipient, payload) => {
  const templateFn = EMAIL_TEMPLATES[payload.template] || EMAIL_TEMPLATES.default;
  const { subject, html } = templateFn(payload.data || {});

  const command = new SendEmailCommand({
    Source: SENDER_EMAIL,
    Destination: {
      ToAddresses: [recipient.email],
    },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
      },
    },
    Tags: [
      { Name: 'Environment', Value: process.env.NODE_ENV || 'development' },
      { Name: 'Template', Value: payload.template || 'default' },
    ],
  });

  const result = await ses.send(command);
  logger.info('Email sent', {
    messageId: result.MessageId,
    recipient: recipient.email,
    template: payload.template,
  });
  return result;
};

/**
 * Send SMS via AWS SNS.
 */
const deliverSms = async (recipient, payload) => {
  // Ensure Nigerian format: +234XXXXXXXXXX
  let phone = recipient.phone;
  if (phone.startsWith('0')) {
    phone = `+234${phone.slice(1)}`;
  } else if (!phone.startsWith('+')) {
    phone = `+234${phone}`;
  }

  const message = payload.data?.body || payload.data?.message || payload.body || '';

  const command = new PublishCommand({
    PhoneNumber: phone,
    Message: `UniLorin Carpool: ${message}`.slice(0, 160), // SMS limit
    MessageAttributes: {
      'AWS.SNS.SMS.SenderID': {
        DataType: 'String',
        StringValue: 'UniCarpool',
      },
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: payload.metadata?.priority === 'high' ? 'Transactional' : 'Promotional',
      },
    },
  });

  const result = await sns.send(command);
  logger.info('SMS sent', {
    messageId: result.MessageId,
    phone: `${phone.slice(0, 7)}****`,
  });
  return result;
};

/**
 * Send push notification.
 * Placeholder — integrate with Firebase Cloud Messaging (FCM)
 * or Web Push when the frontend supports it.
 */
const deliverPush = async (recipient, payload) => {
  // TODO: Integrate with FCM or Web Push API
  logger.info('Push notification queued (not yet implemented)', {
    userId: recipient.userId,
    title: payload.data?.title,
  });
  return { status: 'queued' };
};

// ─── Delivery Router ────────────────────────────────────

const DELIVERY_MAP = {
  email: deliverEmail,
  sms: deliverSms,
  push: deliverPush,
};

// ─── Lambda Handler ─────────────────────────────────────

module.exports.handler = withMiddleware(
  'sqs-notification-trigger',
  async (event) => {
    const records = event.Records || [];
    logger.info('SQS notification trigger received', { recordCount: records.length });

    const results = {
      delivered: 0,
      failed: 0,
      batchItemFailures: [], // For partial batch response
    };

    for (const record of records) {
      try {
        const message = JSON.parse(record.body);
        const { type, recipient, payload, metadata } = message;

        if (metadata?.correlationId) {
          process.env._CORRELATION_ID = metadata.correlationId;
        }

        const deliverFn = DELIVERY_MAP[type];
        if (!deliverFn) {
          logger.warn('Unknown delivery channel', { type, messageId: record.messageId });
          results.failed++;
          continue;
        }

        await deliverFn(recipient, payload);
        results.delivered++;
      } catch (error) {
        results.failed++;
        logger.error('Failed to deliver notification', {
          error: error.message,
          messageId: record.messageId,
        });

        // Report failed message for SQS partial batch failure
        results.batchItemFailures.push({
          itemIdentifier: record.messageId,
        });
      }
    }

    logger.info('SQS notification trigger completed', {
      delivered: results.delivered,
      failed: results.failed,
    });

    // Return partial batch failure response so SQS only
    // retries the messages that actually failed
    return {
      batchItemFailures: results.batchItemFailures,
    };
  },
  { enableTimeoutGuard: false }
);
