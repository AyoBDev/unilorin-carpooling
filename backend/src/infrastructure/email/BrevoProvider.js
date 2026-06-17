'use strict';

const { logger } = require('../../shared/utils/logger');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

class BrevoProvider {
  constructor({ apiKey, senderEmail, senderName }) {
    this.apiKey = apiKey;
    this.senderEmail = senderEmail;
    this.senderName = senderName;
  }

  async send({ to, subject, htmlContent, textContent, replyTo, tags }) {
    const body = {
      sender: { name: this.senderName, email: this.senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    };

    if (textContent) body.textContent = textContent;
    if (replyTo) body.replyTo = replyTo;
    if (tags && tags.length > 0) body.tags = tags;

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Brevo API error (${response.status}): ${errorData.message}`);
    }

    const data = await response.json();
    logger.info('Email sent via Brevo', { messageId: data.messageId, to });
    return { messageId: data.messageId, accepted: true };
  }

  async sendBatch(messages) {
    const results = await Promise.all(
      messages.map(async (msg) => {
        try {
          return await this.send(msg);
        } catch (error) {
          logger.warn('Batch email failed', { to: msg.to, error: error.message });
          return { messageId: null, accepted: false, error: error.message };
        }
      }),
    );
    return results;
  }
}

module.exports = BrevoProvider;
