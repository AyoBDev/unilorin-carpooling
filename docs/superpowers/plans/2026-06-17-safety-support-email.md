# Safety, Support & Email Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Resend with Brevo for email delivery, disable SMS, persist safety sessions to DynamoDB, add support ticket system, and build admin safety dashboard.

**Architecture:** Incremental layered approach — email provider first (foundation), then SMS no-op, then safety persistence + emergency emails, then support tickets, then admin dashboard. Each task is independently deployable.

**Tech Stack:** Node.js, Express, DynamoDB (single-table), native `fetch` for Brevo API, Jest for tests.

## Global Constraints

- All repositories extend `BaseRepository` and operate on a single DynamoDB table
- Controllers are class-based singletons with bound methods, exported as `new ClassName()`
- Response helpers: `success(res, message, data)` and `created(res, message, data)` from `shared/utils/response.js`
- Errors thrown as typed errors (`ValidationError`, `NotFoundError`, etc.) — caught by error handler middleware
- Admin routes use `authenticate` + `requireAdmin` middleware at router level
- Environment: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- Entity keys follow pattern: `PK=ENTITY#{id}`, `SK=TYPE#{subId}`
- Brand name: PSRide (never UniRide)
- No SMS sending — channel type kept as no-op

---

### Task 1: Brevo Email Provider

**Files:**
- Create: `backend/src/infrastructure/email/BrevoProvider.js`
- Create: `backend/tests/unit/infrastructure/email/BrevoProvider.test.js`

**Interfaces:**
- Produces: `BrevoProvider` class with `send({ to, subject, htmlContent, textContent, replyTo, tags })` returning `{ messageId, accepted }`, and `sendBatch(messages[])` returning `{ results[] }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/infrastructure/email/BrevoProvider.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/infrastructure/email/BrevoProvider.test.js --no-coverage`
Expected: FAIL — `Cannot find module '../../../../src/infrastructure/email/BrevoProvider'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/infrastructure/email/BrevoProvider.js`:

```javascript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/infrastructure/email/BrevoProvider.test.js --no-coverage`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/infrastructure/email/BrevoProvider.js backend/tests/unit/infrastructure/email/BrevoProvider.test.js
git commit -m "feat: add Brevo email provider with raw fetch transport"
```

---

### Task 2: Swap Resend for Brevo in NotificationService

**Files:**
- Modify: `backend/src/core/services/NotificationService.js` (lines 1161-1192 — `_sendEmailViaProvider` method)
- Modify: `backend/package.json` (remove `resend` dependency)

**Interfaces:**
- Consumes: `BrevoProvider.send({ to, subject, htmlContent, textContent })` from Task 1
- Produces: Same `_sendEmailViaProvider(emailData)` signature returning `{ messageId }` — all callers unchanged

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/services/NotificationService.brevo.test.js`:

```javascript
'use strict';

jest.mock('../../../src/infrastructure/email/BrevoProvider');
jest.mock('../../../src/infrastructure/database/repositories/NotificationRepository');
jest.mock('../../../src/infrastructure/database/repositories/UserRepository');

const BrevoProvider = require('../../../src/infrastructure/email/BrevoProvider');

describe('NotificationService - Brevo integration', () => {
  let service;
  const mockSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'noreply@psride.ng';
    process.env.BREVO_SENDER_NAME = 'PSRide';

    BrevoProvider.mockImplementation(() => ({ send: mockSend }));

    jest.isolateModules(() => {
      service = require('../../../src/core/services/NotificationService');
    });
  });

  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
  });

  it('should send email via Brevo provider instead of Resend', async () => {
    mockSend.mockResolvedValueOnce({ messageId: 'brevo-msg-123', accepted: true });

    const result = await service._sendEmailViaProvider({
      to: 'user@example.com',
      subject: 'Test Subject',
      template: 'welcome',
      data: { firstName: 'John' },
    });

    expect(result).toEqual({ messageId: 'brevo-msg-123' });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test Subject',
      }),
    );
  });

  it('should skip sending when BREVO_API_KEY is not set', async () => {
    delete process.env.BREVO_API_KEY;

    jest.isolateModules(() => {
      service = require('../../../src/core/services/NotificationService');
    });

    const result = await service._sendEmailViaProvider({
      to: 'user@example.com',
      subject: 'Test',
      template: 'welcome',
      data: {},
    });

    expect(result.messageId).toMatch(/^skipped_/);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/NotificationService.brevo.test.js --no-coverage`
Expected: FAIL — test expects Brevo but code still uses Resend

- [ ] **Step 3: Modify NotificationService._sendEmailViaProvider**

In `backend/src/core/services/NotificationService.js`, replace the `_sendEmailViaProvider` method (lines 1161-1192):

```javascript
  async _sendEmailViaProvider(emailData) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'PSRide';

    if (!apiKey || !senderEmail) {
      logger.warn('BREVO_API_KEY or BREVO_SENDER_EMAIL not set — skipping real email send', {
        template: emailData.template,
        to: emailData.to,
      });
      return { messageId: `skipped_${randomUUID()}` };
    }

    const BrevoProvider = require('../../infrastructure/email/BrevoProvider');
    const brevo = new BrevoProvider({ apiKey, senderEmail, senderName });

    const htmlContent = this._buildEmailHtml(emailData.template, emailData.data);
    const textContent = this._buildEmailText(emailData.template, emailData.data);

    const result = await brevo.send({
      to: emailData.to,
      subject: emailData.subject,
      htmlContent,
      textContent,
    });

    return { messageId: result.messageId };
  }
```

- [ ] **Step 4: Remove `resend` from package.json**

Run: `cd backend && npm uninstall resend`

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/services/NotificationService.brevo.test.js --no-coverage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/services/NotificationService.js backend/package.json backend/package-lock.json backend/tests/unit/services/NotificationService.brevo.test.js
git commit -m "feat: replace Resend with Brevo in NotificationService"
```

---

### Task 3: Swap Resend for Brevo in SQS Trigger

**Files:**
- Modify: `backend/src/lambda/triggers/sqs.trigger.js` (lines 36-171 — imports, client init, `deliverEmail`)

**Interfaces:**
- Consumes: `BrevoProvider.send({ to, subject, htmlContent, tags })` from Task 1
- Produces: Same `deliverEmail(recipient, payload)` function signature — SQS handler unchanged

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/lambda/triggers/sqs.trigger.brevo.test.js`:

```javascript
'use strict';

jest.mock('../../../../src/infrastructure/email/BrevoProvider');
jest.mock('web-push');
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../../src/lambda/middleware/lambdaMiddleware', () => ({
  withMiddleware: (handler) => handler,
}));

const BrevoProvider = require('../../../../src/infrastructure/email/BrevoProvider');

describe('SQS Trigger - Brevo email delivery', () => {
  const mockSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.BREVO_SENDER_EMAIL = 'noreply@psride.ng';
    process.env.BREVO_SENDER_NAME = 'PSRide';
    BrevoProvider.mockImplementation(() => ({ send: mockSend }));
  });

  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.BREVO_SENDER_NAME;
  });

  it('should send email via Brevo when processing SQS email message', async () => {
    mockSend.mockResolvedValueOnce({ messageId: '<brevo-123>', accepted: true });

    jest.isolateModules(() => {
      const { handler } = require('../../../../src/lambda/triggers/sqs.trigger');

      const event = {
        Records: [
          {
            messageId: 'sqs-msg-1',
            body: JSON.stringify({
              type: 'email',
              recipient: { email: 'user@example.com', userId: 'user-1' },
              payload: { template: 'booking_confirmed', data: { passengerName: 'John', rideDate: '2026-06-20' } },
              metadata: { correlationId: 'corr-1', source: 'booking-service' },
            }),
          },
        ],
      };

      return handler(event).then((result) => {
        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'user@example.com',
            subject: expect.any(String),
            htmlContent: expect.stringContaining('John'),
            tags: expect.arrayContaining(['booking_confirmed']),
          }),
        );
        expect(result.batchItemFailures).toHaveLength(0);
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/lambda/triggers/sqs.trigger.brevo.test.js --no-coverage`
Expected: FAIL — code still imports and uses Resend

- [ ] **Step 3: Modify sqs.trigger.js**

In `backend/src/lambda/triggers/sqs.trigger.js`, replace the Resend import, client initialization, and `deliverEmail` function:

Replace lines 36-41 (imports):
```javascript
'use strict';

const BrevoProvider = require('../../infrastructure/email/BrevoProvider');
const webpush = require('web-push');
const { logger } = require('../../shared/utils/logger');
const { withMiddleware } = require('../middleware/lambdaMiddleware');
```

Replace lines 53-56 (client initialization):
```javascript
// ─── Brevo Email Client (reused across invocations) ────
const brevo = process.env.BREVO_API_KEY
  ? new BrevoProvider({
      apiKey: process.env.BREVO_API_KEY,
      senderEmail: process.env.BREVO_SENDER_EMAIL || 'noreply@psride.ng',
      senderName: process.env.BREVO_SENDER_NAME || 'PSRide',
    })
  : null;
```

Replace the `deliverEmail` function (lines 138-171):
```javascript
const deliverEmail = async (recipient, payload) => {
  if (!brevo) {
    logger.warn('BREVO_API_KEY not set — skipping email delivery', {
      recipient: recipient.email,
      template: payload.template,
    });
    return { status: 'skipped', reason: 'no_api_key' };
  }

  const templateFn = EMAIL_TEMPLATES[payload.template] || EMAIL_TEMPLATES.default;
  const { subject, html } = templateFn(payload.data || {});

  const result = await brevo.send({
    to: recipient.email,
    subject,
    htmlContent: html,
    tags: [process.env.NODE_ENV || 'development', payload.template || 'default'],
  });

  logger.info('Email sent via Brevo', {
    messageId: result.messageId,
    recipient: recipient.email,
    template: payload.template,
  });
  return result;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/lambda/triggers/sqs.trigger.brevo.test.js --no-coverage`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: No new failures

- [ ] **Step 6: Commit**

```bash
git add backend/src/lambda/triggers/sqs.trigger.js backend/tests/unit/lambda/triggers/sqs.trigger.brevo.test.js
git commit -m "feat: replace Resend with Brevo in SQS email trigger"
```

---

### Task 4: SMS No-Op and Remove Phone Verification Requirement

**Files:**
- Modify: `backend/src/core/services/NotificationService.js` (the `_sendSMSViaProvider` method and any `sendSMS` method)
- Modify: `backend/src/core/services/SafetyService.js` (lines referencing SMS in `shareTracking`)
- Modify: `backend/src/shared/utils/validation.js` (line 185 — make phone optional in registration schema)
- Modify: `backend/src/core/services/AuthService.js` (OTP/phone verification methods — keep but mark as optional)

**Interfaces:**
- Produces: `sendSMS()` becomes no-op returning success. Phone field optional in registration.

- [ ] **Step 1: Make phone optional in registration validation**

In `backend/src/shared/utils/validation.js`, find the registration schema and change:
```javascript
// Before:
phone: customValidators.nigerianPhone.required(),

// After:
phone: customValidators.nigerianPhone.optional().allow('', null),
```

- [ ] **Step 2: Update SMS provider method to explicit no-op**

In `backend/src/core/services/NotificationService.js`, the `_sendSMSViaProvider` method (line ~1198) already returns a skip result. Ensure the public `sendSMS` method also explicitly returns success without attempting delivery:

Find the `sendSMS` method and ensure it logs at debug level (not warn) and returns immediately:
```javascript
  async sendSMS(phone, message, userId) {
    logger.debug('SMS channel disabled', { phone: phone ? `${phone.substring(0, 8)}***` : 'none' });
    return { messageId: `sms_disabled_${randomUUID()}`, status: 'disabled' };
  }
```

- [ ] **Step 3: Replace SMS with email in SafetyService.shareTracking**

In `backend/src/core/services/SafetyService.js`, find the `shareTracking` method (~line 462-470) where it sends SMS to emergency contacts. Replace the SMS call with an email notification:

```javascript
    // Notify contacts via email that location is being shared
    await Promise.all(
      validContacts
        .filter((contact) => contact.email)
        .map((contact) =>
          this.notificationService._sendEmail(
            {
              to: contact.email,
              subject: `${user.firstName} is sharing their ride location with you`,
              template: 'sos_alert',
              data: {
                contactName: contact.name,
                userName: `${user.firstName} ${user.lastName}`,
                shareUrl: `${process.env.APP_URL || ''}/track/${sessionId}`,
                message: `${user.firstName} is sharing their live ride location with you for safety. Click the link to view their location.`,
              },
            },
            userId,
            'safety',
            'high',
          ),
        ),
    );
```

- [ ] **Step 4: Remove phone verification recommendation from SafetyService.performSafetyCheck**

In `backend/src/core/services/SafetyService.js`, find the safety check (~line 586-592) and remove the phone verification recommendation block:

```javascript
// Remove this block entirely:
// if (!user.phoneVerified) {
//   safetyStatus.recommendations.push({
//     type: 'phone_verification',
//     message: 'Verify your phone number for SMS alerts',
//     action: 'verify_phone',
//   });
// }
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: PASS (phone is now optional, SMS is disabled)

- [ ] **Step 6: Commit**

```bash
git add backend/src/shared/utils/validation.js backend/src/core/services/NotificationService.js backend/src/core/services/SafetyService.js
git commit -m "feat: disable SMS channel, make phone verification optional"
```

---

### Task 5: Safety Repository

**Files:**
- Create: `backend/src/infrastructure/database/repositories/SafetyRepository.js`
- Create: `backend/tests/unit/infrastructure/database/repositories/SafetyRepository.test.js`

**Interfaces:**
- Produces:
  - `createAlert(alertData)` → returns alert object
  - `getAlert(alertId)` → returns alert or null
  - `getAlertsByUser(userId, options)` → returns `{ items, lastEvaluatedKey, count }`
  - `getAlertsByStatus(status, options)` → returns `{ items, lastEvaluatedKey, count }`
  - `updateAlert(alertId, userId, updates)` → returns updated alert
  - `createTrackingSession(sessionData)` → returns session object
  - `getTrackingSession(sessionId)` → returns session or null
  - `updateTrackingSession(sessionId, bookingId, updates)` → returns updated session
  - `createLocationShare(shareData)` → returns share object
  - `getLocationShare(shareToken)` → returns share or null
  - `updateLocationShare(shareToken, updates)` → returns updated share

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/infrastructure/database/repositories/SafetyRepository.test.js`:

```javascript
'use strict';

jest.mock('../../../../../src/infrastructure/database/dynamodb', () => ({
  getDocClientInstance: { send: jest.fn() },
  getTableName: () => 'psride-test',
}));

const SafetyRepository = require('../../../../../src/infrastructure/database/repositories/SafetyRepository');

describe('SafetyRepository', () => {
  let repo;
  let mockSend;

  beforeEach(() => {
    repo = new SafetyRepository();
    const { getDocClientInstance } = require('../../../../../src/infrastructure/database/dynamodb');
    mockSend = getDocClientInstance.send;
    mockSend.mockReset();
  });

  describe('createAlert', () => {
    it('should create SOS alert with correct PK/SK and GSI keys', async () => {
      mockSend.mockResolvedValueOnce({});

      const alertData = {
        alertId: 'alert-123',
        userId: 'user-456',
        type: 'sos',
        status: 'active',
        location: { latitude: 8.4799, longitude: 4.5418 },
        message: 'Help!',
        triggeredAt: '2026-06-17T10:00:00Z',
        expiresAt: '2026-06-17T11:00:00Z',
      };

      const result = await repo.createAlert(alertData);

      expect(mockSend).toHaveBeenCalled();
      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('USER#user-456');
      expect(putParams.Item.SK).toBe('SOS#alert-123');
      expect(putParams.Item.GSI1PK).toBe('SOS#STATUS#active');
      expect(putParams.Item.GSI1SK).toBe('2026-06-17T10:00:00Z');
      expect(putParams.Item.EntityType).toBe('SOS_ALERT');
      expect(result.alertId).toBe('alert-123');
    });
  });

  describe('getAlertsByStatus', () => {
    it('should query GSI1 for alerts by status', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ alertId: 'a1', status: 'active' }],
        Count: 1,
      });

      const result = await repo.getAlertsByStatus('active', { limit: 20 });

      const queryParams = mockSend.mock.calls[0][0].input;
      expect(queryParams.IndexName).toBe('GSI1');
      expect(queryParams.KeyConditionExpression).toContain('GSI1PK = :gsi1pk');
      expect(queryParams.ExpressionAttributeValues[':gsi1pk']).toBe('SOS#STATUS#active');
    });
  });

  describe('createTrackingSession', () => {
    it('should create tracking session with correct keys', async () => {
      mockSend.mockResolvedValueOnce({});

      const sessionData = {
        sessionId: 'sess-789',
        bookingId: 'booking-111',
        rideId: 'ride-222',
        userId: 'user-456',
        status: 'active',
        startedAt: '2026-06-17T10:00:00Z',
      };

      await repo.createTrackingSession(sessionData);

      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('BOOKING#booking-111');
      expect(putParams.Item.SK).toBe('TRACKING#sess-789');
      expect(putParams.Item.GSI1PK).toBe('TRACKING#ACTIVE');
      expect(putParams.Item.EntityType).toBe('SAFETY_SESSION');
    });
  });

  describe('createLocationShare', () => {
    it('should create location share with shareToken as PK', async () => {
      mockSend.mockResolvedValueOnce({});

      const shareData = {
        shareToken: 'token-abc',
        userId: 'user-456',
        bookingId: 'booking-111',
        status: 'active',
      };

      await repo.createLocationShare(shareData);

      const putParams = mockSend.mock.calls[0][0].input;
      expect(putParams.Item.PK).toBe('SHARE#token-abc');
      expect(putParams.Item.SK).toBe('LOCATION');
      expect(putParams.Item.GSI1PK).toBe('USER#user-456');
      expect(putParams.Item.EntityType).toBe('LOCATION_SHARE');
    });
  });

  describe('getLocationShare', () => {
    it('should get location share by token', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { PK: 'SHARE#token-abc', SK: 'LOCATION', shareToken: 'token-abc', status: 'active' },
      });

      const result = await repo.getLocationShare('token-abc');
      const getParams = mockSend.mock.calls[0][0].input;
      expect(getParams.Key.PK).toBe('SHARE#token-abc');
      expect(getParams.Key.SK).toBe('LOCATION');
      expect(result.shareToken).toBe('token-abc');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/infrastructure/database/repositories/SafetyRepository.test.js --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write SafetyRepository implementation**

Create `backend/src/infrastructure/database/repositories/SafetyRepository.js`:

```javascript
'use strict';

const BaseRepository = require('./BaseRepository');
const { logger } = require('../../../shared/utils/logger');

class SafetyRepository extends BaseRepository {
  constructor() {
    super('SOS_ALERT');
  }

  async createAlert(alertData) {
    const item = {
      PK: `USER#${alertData.userId}`,
      SK: `SOS#${alertData.alertId}`,
      GSI1PK: `SOS#STATUS#${alertData.status}`,
      GSI1SK: alertData.triggeredAt,
      EntityType: 'SOS_ALERT',
      ...alertData,
    };

    if (alertData.expiresAt) {
      item.TTL = Math.floor(new Date(alertData.expiresAt).getTime() / 1000) + 86400 * 7;
    }

    await this.create(item, { preventOverwrite: true });
    return alertData;
  }

  async getAlert(alertId, userId) {
    return this.get(`USER#${userId}`, `SOS#${alertId}`);
  }

  async getAlertsByUser(userId, options = {}) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'SOS#',
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };
    if (options.lastKey) params.ExclusiveStartKey = options.lastKey;
    return this.query(params);
  }

  async getAlertsByStatus(status, options = {}) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `SOS#STATUS#${status}`,
      },
      ScanIndexForward: false,
      Limit: options.limit || 20,
    };
    if (options.lastKey) params.ExclusiveStartKey = options.lastKey;
    return this.query(params);
  }

  async updateAlert(alertId, userId, updates) {
    const newUpdates = { ...updates };
    if (updates.status) {
      newUpdates.GSI1PK = `SOS#STATUS#${updates.status}`;
    }
    return this.update(`USER#${userId}`, `SOS#${alertId}`, newUpdates);
  }

  async createTrackingSession(sessionData) {
    const item = {
      PK: `BOOKING#${sessionData.bookingId}`,
      SK: `TRACKING#${sessionData.sessionId}`,
      GSI1PK: 'TRACKING#ACTIVE',
      GSI1SK: sessionData.startedAt,
      EntityType: 'SAFETY_SESSION',
      ...sessionData,
      locations: sessionData.locations || [],
    };

    await this.create(item, { preventOverwrite: true });
    return sessionData;
  }

  async getTrackingSession(sessionId, bookingId) {
    return this.get(`BOOKING#${bookingId}`, `TRACKING#${sessionId}`);
  }

  async getTrackingSessionBySessionId(sessionId) {
    const params = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :gsi2pk',
      ExpressionAttributeValues: {
        ':gsi2pk': `SESSION#${sessionId}`,
      },
      Limit: 1,
    };
    const result = await this.query(params);
    return result.items[0] || null;
  }

  async updateTrackingSession(sessionId, bookingId, updates) {
    if (updates.status && updates.status !== 'active') {
      updates.GSI1PK = `TRACKING#${updates.status.toUpperCase()}`;
    }
    return this.update(`BOOKING#${bookingId}`, `TRACKING#${sessionId}`, updates);
  }

  async createLocationShare(shareData) {
    const item = {
      PK: `SHARE#${shareData.shareToken}`,
      SK: 'LOCATION',
      GSI1PK: `USER#${shareData.userId}`,
      GSI1SK: `LOCSHARE#${shareData.startedAt || new Date().toISOString()}`,
      EntityType: 'LOCATION_SHARE',
      ...shareData,
    };

    await this.create(item, { preventOverwrite: true });
    return shareData;
  }

  async getLocationShare(shareToken) {
    return this.get(`SHARE#${shareToken}`, 'LOCATION');
  }

  async updateLocationShare(shareToken, updates) {
    return this.update(`SHARE#${shareToken}`, 'LOCATION', updates);
  }

  async getActiveSessionsByRide(rideId) {
    const params = {
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BOOKING#${rideId}`,
        ':skPrefix': 'TRACKING#',
      },
    };
    return this.query(params);
  }
}

module.exports = SafetyRepository;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/unit/infrastructure/database/repositories/SafetyRepository.test.js --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/infrastructure/database/repositories/SafetyRepository.js backend/tests/unit/infrastructure/database/repositories/SafetyRepository.test.js
git commit -m "feat: add SafetyRepository for DynamoDB persistence of safety sessions"
```

---

### Task 6: Migrate SafetyService from In-Memory to DynamoDB

**Files:**
- Modify: `backend/src/core/services/SafetyService.js` (replace Map operations with SafetyRepository calls)

**Interfaces:**
- Consumes: `SafetyRepository` methods from Task 5
- Produces: Same public API — `triggerSOS`, `resolveSOS`, `startTracking`, `updateLocation`, `stopTracking`, `startLocationSharing`, `stopLocationSharing`, `getSharedLocation`, `shareTracking`, `getTrackingLocation`

- [ ] **Step 1: Add SafetyRepository import and remove Maps**

In `backend/src/core/services/SafetyService.js`, add import after line 14:

```javascript
const SafetyRepository = require('../../infrastructure/database/repositories/SafetyRepository');
```

Replace the constructor (lines 64-75):

```javascript
  constructor() {
    this.userRepository = new UserRepository();
    this.bookingRepository = new BookingRepository();
    this.rideRepository = new RideRepository();
    this.notificationService = new NotificationService();
    this.safetyRepository = new SafetyRepository();
    this.serviceName = 'SafetyService';
  }
```

- [ ] **Step 2: Migrate triggerSOS method**

Replace lines 138-142 (store alert):
```javascript
    // Before:
    // this.activeAlerts.set(alertId, sosAlert);
    // await this._persistAlert(sosAlert);

    // After:
    await this.safetyRepository.createAlert(sosAlert);
```

- [ ] **Step 3: Migrate resolveSOS method**

Replace the alert retrieval and update logic in `resolveSOS`:
```javascript
    // Before:
    // const alert = this.activeAlerts.get(alertId);

    // After:
    const alert = await this.safetyRepository.getAlert(alertId, userId);

    // ... validation stays the same ...

    // Before:
    // this.activeAlerts.set(alertId, alert);
    // await this._updateAlert(alertId, alert);

    // After:
    await this.safetyRepository.updateAlert(alertId, userId, {
      status: alert.status,
      resolvedAt: alert.resolvedAt,
      resolutionNotes: alert.resolutionNotes,
      resolvedBy: alert.resolvedBy,
    });
```

- [ ] **Step 4: Migrate startTracking method**

Replace line 320 (store in memory):
```javascript
    // Before:
    // this.trackingSessions.set(sessionId, session);

    // After:
    await this.safetyRepository.createTrackingSession(session);
```

- [ ] **Step 5: Migrate updateLocation method**

Replace the session retrieval, location append, and session update:
```javascript
    // Before:
    // const session = this.trackingSessions.get(sessionId);

    // After:
    const session = await this.safetyRepository.getTrackingSessionBySessionId(sessionId);

    // ... validation stays the same ...

    // Location history: keep last 10 in DynamoDB (not 100)
    const locations = session.locations || [];
    locations.push(locationUpdate);
    const trimmedLocations = locations.slice(-10);

    // Before:
    // this.trackingSessions.set(sessionId, session);

    // After:
    await this.safetyRepository.updateTrackingSession(sessionId, session.bookingId, {
      locations: trimmedLocations,
      lastLocation: locationUpdate,
      lastUpdateAt: formatDate(now()),
    });
```

- [ ] **Step 6: Migrate stopTracking method**

```javascript
    // Before:
    // const session = this.trackingSessions.get(sessionId);

    // After:
    const session = await this.safetyRepository.getTrackingSessionBySessionId(sessionId);

    // ... validation stays the same ...

    // Before:
    // session.status = 'stopped';
    // this.trackingSessions.set(sessionId, session);
    // await this._persistTrackingSession(session);

    // After:
    await this.safetyRepository.updateTrackingSession(sessionId, session.bookingId, {
      status: 'stopped',
      stoppedAt: formatDate(now()),
    });
```

- [ ] **Step 7: Migrate startLocationSharing method**

```javascript
    // Before:
    // this.trackingSessions.set(shareToken, session);

    // After:
    await this.safetyRepository.createLocationShare({
      shareToken,
      userId,
      bookingId,
      rideId: booking.rideId,
      status: 'active',
      startedAt: formatDate(now()),
      lastLocation: location,
      lastUpdateAt: formatDate(now()),
    });
```

- [ ] **Step 8: Migrate getSharedLocation method**

```javascript
    // Before:
    // const session = this.trackingSessions.get(shareToken);

    // After:
    const session = await this.safetyRepository.getLocationShare(shareToken);
```

- [ ] **Step 9: Migrate stopLocationSharing method**

```javascript
    // Before: iterates Map
    // for (const [token, session] of this.trackingSessions.entries()) { ... }

    // After: query by user's location shares and update matching one
    // This needs a different approach since we're no longer iterating in memory
    const params = {
      TableName: this.safetyRepository.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: { ':gsi1pk': `USER#${userId}` },
    };
    const { items } = await this.safetyRepository.query(params);
    const activeShare = items.find(
      (s) => s.bookingId === bookingId && s.status === 'active',
    );
    if (activeShare) {
      await this.safetyRepository.updateLocationShare(activeShare.shareToken, {
        status: 'stopped',
        stoppedAt: formatDate(now()),
      });
    }
```

- [ ] **Step 10: Migrate getTrackingLocation / shareTracking**

Replace `this.trackingSessions.get(sessionId)` calls with:
```javascript
    const session = await this.safetyRepository.getTrackingSessionBySessionId(sessionId);
```

- [ ] **Step 11: Remove old _persist stub methods**

Delete the `_persistAlert`, `_updateAlert`, `_persistTrackingSession` methods that were debug-only stubs.

- [ ] **Step 12: Migrate getSOSAlert and getMySOSAlerts**

```javascript
  async getSOSAlert(alertId, userId) {
    const alert = await this.safetyRepository.getAlert(alertId, userId);
    if (!alert) throw new NotFoundError('SOS alert not found');
    return alert;
  }

  async getMySOSAlerts(userId, options = {}) {
    return this.safetyRepository.getAlertsByUser(userId, options);
  }
```

- [ ] **Step 13: Run tests**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add backend/src/core/services/SafetyService.js
git commit -m "feat: migrate SafetyService from in-memory Maps to DynamoDB via SafetyRepository"
```

---

### Task 7: Emergency Contact Email on SOS

**Files:**
- Modify: `backend/src/core/services/NotificationService.js` (add/update `SOS_EMERGENCY_CONTACT` template)

**Interfaces:**
- Consumes: `BrevoProvider.send()` via existing `_sendEmail` flow
- Produces: Enhanced `sendSOSAlert()` that sends personalized email per emergency contact with location link

- [ ] **Step 1: Add emergency contact email template**

In `backend/src/core/services/NotificationService.js`, add `SOS_EMERGENCY_CONTACT` to the `EMAIL_TEMPLATES` constant and add a case in `_buildEmailHtml`:

Inside the `_buildEmailHtml` method's switch/if block, add handling for a new template `sos_emergency_contact`:

```javascript
    case EMAIL_TEMPLATES.SOS_EMERGENCY_CONTACT:
      return baseWrapper(`
        ${alertBox(`
          <h2 style="color:${RED};margin:0 0 10px">EMERGENCY ALERT</h2>
          <p><strong>${data.userName}</strong> has triggered an emergency alert on PSRide.</p>
        `)}
        ${infoBox(`
          ${infoRow('Time', data.triggeredAt)}
          ${data.location ? infoRow('Location', `<a href="https://www.google.com/maps?q=${data.location.latitude},${data.location.longitude}">View on Google Maps</a>`) : ''}
          ${data.rideDetails ? infoRow('Ride', data.rideDetails) : ''}
          ${data.driverName ? infoRow('Driver', data.driverName) : ''}
          ${data.message ? infoRow('Message', data.message) : ''}
        `)}
        <p style="margin-top:20px"><strong>What to do:</strong></p>
        <ul>
          <li>Try to contact ${data.userName} immediately</li>
          <li>If you cannot reach them, call emergency services: 112</li>
          <li>University Security: ${data.universitySecurityPhone || '+2348012345678'}</li>
        </ul>
      `);
```

- [ ] **Step 2: Update sendSOSAlert to send per-contact personalized emails**

In the `sendSOSAlert` method (~line 908), after sending the general SOS notification, add per-contact email delivery:

```javascript
    // Send personalized email to each emergency contact
    const contactEmailResults = await Promise.all(
      (alertData.emergencyContacts || [])
        .filter((contact) => contact.email)
        .map((contact) =>
          this._sendEmail(
            {
              to: contact.email,
              subject: `URGENT: ${user.firstName} ${user.lastName} triggered an emergency alert on PSRide`,
              template: EMAIL_TEMPLATES.SOS_EMERGENCY_CONTACT,
              data: {
                contactName: contact.name,
                userName: `${user.firstName} ${user.lastName}`,
                triggeredAt: formatDateTime(now()),
                location: alertData.location,
                rideDetails: alertData.booking
                  ? `${alertData.booking.pickupLocation} → ${alertData.booking.destination}`
                  : null,
                driverName: alertData.booking?.driverName,
                message: alertData.message || 'Emergency alert triggered',
                universitySecurityPhone: SAFETY_CONFIG?.emergencyNumbers?.universitySecurty,
              },
            },
            alertData.userId,
            'safety',
            'urgent',
          ),
        ),
    );
```

- [ ] **Step 3: Add SOS_EMERGENCY_CONTACT to EMAIL_TEMPLATES constant**

Add to the `EMAIL_TEMPLATES` object near line 23:
```javascript
  SOS_EMERGENCY_CONTACT: 'sos_emergency_contact',
```

- [ ] **Step 4: Add plain text template for sos_emergency_contact**

In `_buildEmailText` method, add the case:
```javascript
    case EMAIL_TEMPLATES.SOS_EMERGENCY_CONTACT:
      return `EMERGENCY ALERT\n\n${data.userName} has triggered an emergency alert on PSRide.\n\nTime: ${data.triggeredAt}\n${data.location ? `Location: https://www.google.com/maps?q=${data.location.latitude},${data.location.longitude}` : ''}\n${data.rideDetails ? `Ride: ${data.rideDetails}` : ''}\n\nTry to contact ${data.userName} immediately. If you cannot reach them, call 112.\nUniversity Security: ${data.universitySecurityPhone || '+2348012345678'}`;
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/services/NotificationService.js
git commit -m "feat: add emergency contact email template and per-contact SOS notifications"
```

---

### Task 8: Support Ticket Entity and Repository

**Files:**
- Create: `backend/src/core/domain/entities/SupportTicket.js`
- Create: `backend/src/infrastructure/database/repositories/SupportRepository.js`
- Create: `backend/tests/unit/infrastructure/database/repositories/SupportRepository.test.js`

**Interfaces:**
- Produces:
  - `SupportTicket.create(data)` — factory method returning validated ticket object
  - `SupportRepository.createTicket(ticket)` → persists and returns ticket
  - `SupportRepository.getTicket(ticketId)` → returns ticket by ID (via GSI2)
  - `SupportRepository.getTicketsByUser(userId, options)` → paginated user tickets
  - `SupportRepository.getTicketsByStatus(status, options)` → admin: filter by status
  - `SupportRepository.updateTicket(ticketId, userId, updates)` → update ticket fields
  - `SupportRepository.addResponse(ticketId, userId, response)` → append response to ticket

- [ ] **Step 1: Write the SupportTicket entity**

Create `backend/src/core/domain/entities/SupportTicket.js`:

```javascript
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
```

- [ ] **Step 2: Write the SupportRepository test**

Create `backend/tests/unit/infrastructure/database/repositories/SupportRepository.test.js`:

```javascript
'use strict';

jest.mock('../../../../../src/infrastructure/database/dynamodb', () => ({
  getDocClientInstance: { send: jest.fn() },
  getTableName: () => 'psride-test',
}));

const SupportRepository = require('../../../../../src/infrastructure/database/repositories/SupportRepository');

describe('SupportRepository', () => {
  let repo;
  let mockSend;

  beforeEach(() => {
    repo = new SupportRepository();
    const { getDocClientInstance } = require('../../../../../src/infrastructure/database/dynamodb');
    mockSend = getDocClientInstance.send;
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && npx jest tests/unit/infrastructure/database/repositories/SupportRepository.test.js --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 4: Write SupportRepository implementation**

Create `backend/src/infrastructure/database/repositories/SupportRepository.js`:

```javascript
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
    const newUpdates = { ...updates, updatedAt: new Date().toISOString() };
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
      updatedAt: new Date().toISOString(),
    });
  }
}

module.exports = SupportRepository;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/infrastructure/database/repositories/SupportRepository.test.js --no-coverage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/domain/entities/SupportTicket.js backend/src/infrastructure/database/repositories/SupportRepository.js backend/tests/unit/infrastructure/database/repositories/SupportRepository.test.js
git commit -m "feat: add SupportTicket entity and SupportRepository"
```

---

### Task 9: Support Service

**Files:**
- Create: `backend/src/core/services/SupportService.js`
- Create: `backend/tests/unit/services/SupportService.test.js`

**Interfaces:**
- Consumes: `SupportRepository` from Task 8, `NotificationService._sendEmail()` from Task 2, `SupportTicket.create()` from Task 8
- Produces:
  - `createTicket(userId, { category, subject, description })` → returns ticket
  - `getMyTickets(userId, { status, page })` → returns paginated tickets
  - `getTicket(userId, ticketId)` → returns single ticket (validates ownership)
  - `closeTicket(userId, ticketId)` → closes user's own ticket
  - `getAllTickets(filters)` → admin: all tickets
  - `respondToTicket(adminId, ticketId, message)` → admin adds response
  - `updateTicketStatus(adminId, ticketId, status)` → admin changes status
  - `assignTicket(adminId, ticketId, assigneeId)` → admin assigns ticket

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/services/SupportService.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/unit/services/SupportService.test.js --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Write SupportService implementation**

Create `backend/src/core/services/SupportService.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest tests/unit/services/SupportService.test.js --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/core/services/SupportService.js backend/tests/unit/services/SupportService.test.js
git commit -m "feat: add SupportService with ticket CRUD and admin operations"
```

---

### Task 10: Support Controller and Routes

**Files:**
- Create: `backend/src/api/controllers/SupportController.js`
- Create: `backend/src/api/routes/support.routes.js`
- Modify: `backend/src/api/routes/index.js` (mount support routes)
- Modify: `backend/src/api/routes/admin.routes.js` (mount admin support routes)

**Interfaces:**
- Consumes: `SupportService` from Task 9
- Produces: REST endpoints as defined in the spec

- [ ] **Step 1: Create SupportController**

Create `backend/src/api/controllers/SupportController.js`:

```javascript
'use strict';

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

  async getTicket(req, res, next) {
    try {
      const ticket = await this.supportService.getTicket(req.user.userId, req.params.ticketId);
      return success(res, 'Ticket retrieved', ticket);
    } catch (error) {
      return next(error);
    }
  }

  async closeTicket(req, res, next) {
    try {
      const result = await this.supportService.closeTicket(req.user.userId, req.params.ticketId);
      return success(res, 'Ticket closed', result);
    } catch (error) {
      return next(error);
    }
  }

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

  async adminGetTicket(req, res, next) {
    try {
      const ticket = await this.supportService.getTicketAdmin(req.params.ticketId);
      return success(res, 'Ticket retrieved', ticket);
    } catch (error) {
      return next(error);
    }
  }

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
```

- [ ] **Step 2: Create support.routes.js**

Create `backend/src/api/routes/support.routes.js`:

```javascript
'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const SupportController = require('../controllers/SupportController');

const router = Router();

router.use(authenticate);

router.post('/tickets', SupportController.createTicket);
router.get('/tickets', SupportController.getMyTickets);
router.get('/tickets/:ticketId', SupportController.getTicket);
router.post('/tickets/:ticketId/close', SupportController.closeTicket);

module.exports = router;
```

- [ ] **Step 3: Mount support routes in index.js**

In `backend/src/api/routes/index.js`, add import after line 21:
```javascript
const supportRoutes = require('./support.routes');
```

Add route mount after line 49 (after safety routes):
```javascript
router.use('/support', supportRoutes);
```

- [ ] **Step 4: Add admin support routes to admin.routes.js**

In `backend/src/api/routes/admin.routes.js`, add import for SupportController and add these routes in a new section:

```javascript
const SupportController = require('../controllers/SupportController');

// ─── SUPPORT TICKET MANAGEMENT ─────────────────────────────
router.get('/support/tickets', SupportController.adminGetAllTickets);
router.get('/support/tickets/:ticketId', SupportController.adminGetTicket);
router.post('/support/tickets/:ticketId/respond', SupportController.adminRespond);
router.put('/support/tickets/:ticketId/status', SupportController.adminUpdateStatus);
router.put('/support/tickets/:ticketId/assign', SupportController.adminAssign);
```

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/api/controllers/SupportController.js backend/src/api/routes/support.routes.js backend/src/api/routes/index.js backend/src/api/routes/admin.routes.js
git commit -m "feat: add support ticket routes and controller (user + admin)"
```

---

### Task 11: Admin Safety Dashboard

**Files:**
- Create: `backend/src/api/controllers/AdminSafetyController.js`
- Create: `backend/src/api/routes/admin-safety.routes.js`
- Modify: `backend/src/api/routes/admin.routes.js` (add safety admin routes)
- Modify: `backend/src/core/services/SafetyService.js` (add admin query methods)

**Interfaces:**
- Consumes: `SafetyRepository.getAlertsByStatus()`, `SafetyRepository.updateAlert()` from Task 5
- Produces: Admin REST endpoints for SOS alerts, incidents, and safety stats

- [ ] **Step 1: Add admin methods to SafetyService**

Add these methods to `backend/src/core/services/SafetyService.js`:

```javascript
  // ==================== Admin Dashboard Methods ====================

  async getActiveSOSAlerts(options = {}) {
    return this.safetyRepository.getAlertsByStatus(ALERT_STATUS.ACTIVE, options);
  }

  async getRecentSOSAlerts(options = {}) {
    const active = await this.safetyRepository.getAlertsByStatus(ALERT_STATUS.ACTIVE, options);
    const resolved = await this.safetyRepository.getAlertsByStatus(ALERT_STATUS.RESOLVED, { limit: 10 });
    const escalated = await this.safetyRepository.getAlertsByStatus(ALERT_STATUS.ESCALATED, { limit: 10 });

    const allAlerts = [...active.items, ...resolved.items, ...escalated.items];
    allAlerts.sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));

    return { items: allAlerts.slice(0, options.limit || 20), count: allAlerts.length };
  }

  async getSOSAlertDetail(alertId) {
    // Search across statuses since admin doesn't know the userId
    for (const status of Object.values(ALERT_STATUS)) {
      const result = await this.safetyRepository.getAlertsByStatus(status, { limit: 100 });
      const alert = result.items.find((a) => a.alertId === alertId);
      if (alert) {
        const user = await this.userRepository.findById(alert.userId);
        return { ...alert, user: { firstName: user?.firstName, lastName: user?.lastName, email: user?.email, phone: user?.phone } };
      }
    }
    throw new NotFoundError('SOS alert not found');
  }

  async adminUpdateSOSAlert(alertId, updates) {
    const alert = await this.getSOSAlertDetail(alertId);
    return this.safetyRepository.updateAlert(alertId, alert.userId, updates);
  }

  async getSafetyStats() {
    const active = await this.safetyRepository.getAlertsByStatus(ALERT_STATUS.ACTIVE, { limit: 100 });
    const resolved = await this.safetyRepository.getAlertsByStatus(ALERT_STATUS.RESOLVED, { limit: 100 });
    const escalated = await this.safetyRepository.getAlertsByStatus(ALERT_STATUS.ESCALATED, { limit: 100 });

    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const allResolved = resolved.items;
    const thisWeek = allResolved.filter((a) => new Date(a.triggeredAt) > weekAgo);
    const thisMonth = allResolved.filter((a) => new Date(a.triggeredAt) > monthAgo);

    const resolutionTimes = allResolved
      .filter((a) => a.resolvedAt)
      .map((a) => (new Date(a.resolvedAt) - new Date(a.triggeredAt)) / 3600000);
    const avgResolution = resolutionTimes.length > 0
      ? resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length
      : 0;

    return {
      activeSosCount: active.count,
      escalatedCount: escalated.count,
      incidentsThisWeek: thisWeek.length,
      incidentsThisMonth: thisMonth.length,
      averageResolutionHours: Math.round(avgResolution * 10) / 10,
    };
  }
```

- [ ] **Step 2: Create AdminSafetyController**

Create `backend/src/api/controllers/AdminSafetyController.js`:

```javascript
'use strict';

const SafetyService = require('../../core/services/SafetyService');
const { success } = require('../../shared/utils/response');

class AdminSafetyController {
  constructor() {
    this.safetyService = new SafetyService();

    this.getSOSAlerts = this.getSOSAlerts.bind(this);
    this.getSOSAlertDetail = this.getSOSAlertDetail.bind(this);
    this.updateSOSAlert = this.updateSOSAlert.bind(this);
    this.getIncidents = this.getIncidents.bind(this);
    this.getIncidentDetail = this.getIncidentDetail.bind(this);
    this.updateIncident = this.updateIncident.bind(this);
    this.getSafetyStats = this.getSafetyStats.bind(this);
  }

  async getSOSAlerts(req, res, next) {
    try {
      const { limit } = req.query;
      const result = await this.safetyService.getRecentSOSAlerts({
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return success(res, 'SOS alerts retrieved', result);
    } catch (error) {
      return next(error);
    }
  }

  async getSOSAlertDetail(req, res, next) {
    try {
      const alert = await this.safetyService.getSOSAlertDetail(req.params.alertId);
      return success(res, 'SOS alert detail retrieved', alert);
    } catch (error) {
      return next(error);
    }
  }

  async updateSOSAlert(req, res, next) {
    try {
      const { status, notes, assignedTo } = req.body;
      const updates = {};
      if (status) updates.status = status;
      if (notes) updates.adminNotes = notes;
      if (assignedTo) updates.assignedTo = assignedTo;

      const result = await this.safetyService.adminUpdateSOSAlert(req.params.alertId, updates);
      return success(res, 'SOS alert updated', result);
    } catch (error) {
      return next(error);
    }
  }

  async getIncidents(req, res, next) {
    try {
      const { type, severity, status, limit } = req.query;
      const result = await this.safetyService.getIncidents({
        type, severity, status,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return success(res, 'Incidents retrieved', result);
    } catch (error) {
      return next(error);
    }
  }

  async getIncidentDetail(req, res, next) {
    try {
      const incident = await this.safetyService.getIncidentDetail(req.params.incidentId);
      return success(res, 'Incident detail retrieved', incident);
    } catch (error) {
      return next(error);
    }
  }

  async updateIncident(req, res, next) {
    try {
      const { status, notes, assignedTo } = req.body;
      const updates = {};
      if (status) updates.status = status;
      if (notes) updates.adminNotes = notes;
      if (assignedTo) updates.assignedTo = assignedTo;

      const result = await this.safetyService.adminUpdateIncident(req.params.incidentId, updates);
      return success(res, 'Incident updated', result);
    } catch (error) {
      return next(error);
    }
  }

  async getSafetyStats(req, res, next) {
    try {
      const stats = await this.safetyService.getSafetyStats();
      return success(res, 'Safety stats retrieved', stats);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AdminSafetyController();
```

- [ ] **Step 3: Add admin safety routes to admin.routes.js**

In `backend/src/api/routes/admin.routes.js`, add import and routes:

```javascript
const AdminSafetyController = require('../controllers/AdminSafetyController');

// ─── SAFETY DASHBOARD ──────────────────────────────────────
router.get('/safety/sos', AdminSafetyController.getSOSAlerts);
router.get('/safety/sos/:alertId', AdminSafetyController.getSOSAlertDetail);
router.put('/safety/sos/:alertId', AdminSafetyController.updateSOSAlert);
router.get('/safety/incidents', AdminSafetyController.getIncidents);
router.get('/safety/incidents/:incidentId', AdminSafetyController.getIncidentDetail);
router.put('/safety/incidents/:incidentId', AdminSafetyController.updateIncident);
router.get('/safety/stats', AdminSafetyController.getSafetyStats);
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/controllers/AdminSafetyController.js backend/src/api/routes/admin.routes.js backend/src/core/services/SafetyService.js
git commit -m "feat: add admin safety dashboard endpoints (SOS alerts, incidents, stats)"
```

---

### Task 12: Support Email Templates and Terraform Env Vars

**Files:**
- Modify: `backend/src/core/services/NotificationService.js` (add support ticket email templates)
- Modify: `infrastructure/modules/compute/lambda/variables.tf` (add Brevo env vars)
- Modify: `infrastructure/modules/compute/lambda/main.tf` (pass Brevo env vars to Lambda)

**Interfaces:**
- Produces: Email templates for `support_ticket_created`, `support_ticket_response`, `support_ticket_resolved`

- [ ] **Step 1: Add support ticket templates to NotificationService**

In `backend/src/core/services/NotificationService.js`, add to `EMAIL_TEMPLATES` constant:
```javascript
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_RESPONSE: 'support_ticket_response',
  SUPPORT_TICKET_RESOLVED: 'support_ticket_resolved',
```

In `_buildEmailHtml`, add cases:
```javascript
    case EMAIL_TEMPLATES.SUPPORT_TICKET_CREATED:
      return baseWrapper(`
        ${greeting(data.firstName)}
        <p>Your support ticket has been submitted successfully.</p>
        ${infoBox(`
          ${infoRow('Reference', data.reference)}
          ${infoRow('Subject', data.ticketSubject)}
        `)}
        <p>Our team will review your ticket and respond as soon as possible. You'll receive an email when we reply.</p>
      `);

    case EMAIL_TEMPLATES.SUPPORT_TICKET_RESPONSE:
      return baseWrapper(`
        ${greeting(data.firstName)}
        <p>Our support team has responded to your ticket <strong>${data.reference}</strong>:</p>
        ${infoBox(`<p style="white-space:pre-wrap">${data.responsePreview}</p>`)}
        <p>Open the app to view the full response and reply if needed.</p>
      `);

    case EMAIL_TEMPLATES.SUPPORT_TICKET_RESOLVED:
      return baseWrapper(`
        ${greeting(data.firstName)}
        <p>Your support ticket <strong>${data.reference}</strong> has been resolved.</p>
        ${infoBox(`${infoRow('Subject', data.ticketSubject)}`)}
        <p>If you're still experiencing issues, you can reopen the ticket or create a new one in the app.</p>
      `);
```

In `_buildEmailText`, add cases:
```javascript
    case EMAIL_TEMPLATES.SUPPORT_TICKET_CREATED:
      return `Hi ${data.firstName},\n\nYour support ticket (${data.reference}) has been submitted. Our team will respond soon.\n\nSubject: ${data.ticketSubject}\n\n— PSRide Support`;

    case EMAIL_TEMPLATES.SUPPORT_TICKET_RESPONSE:
      return `Hi ${data.firstName},\n\nOur team responded to ticket ${data.reference}:\n\n${data.responsePreview}\n\nOpen the app to view the full response.\n\n— PSRide Support`;

    case EMAIL_TEMPLATES.SUPPORT_TICKET_RESOLVED:
      return `Hi ${data.firstName},\n\nYour ticket ${data.reference} ("${data.ticketSubject}") has been resolved.\n\nIf you still need help, create a new ticket in the app.\n\n— PSRide Support`;
```

- [ ] **Step 2: Add Brevo env vars to Terraform Lambda variables**

In `infrastructure/modules/compute/lambda/variables.tf`, add:
```hcl
variable "brevo_api_key" {
  description = "Brevo transactional email API key"
  type        = string
  sensitive   = true
}

variable "brevo_sender_email" {
  description = "Brevo sender email address"
  type        = string
  default     = "noreply@psride.ng"
}

variable "brevo_sender_name" {
  description = "Brevo sender display name"
  type        = string
  default     = "PSRide"
}
```

- [ ] **Step 3: Pass Brevo env vars to Lambda in main.tf**

In `infrastructure/modules/compute/lambda/main.tf`, find the `environment` block of the main API Lambda and add:
```hcl
      BREVO_API_KEY      = var.brevo_api_key
      BREVO_SENDER_EMAIL = var.brevo_sender_email
      BREVO_SENDER_NAME  = var.brevo_sender_name
```

And remove (if present):
```hcl
      RESEND_API_KEY     = var.resend_api_key
      RESEND_FROM_EMAIL  = var.resend_from_email
```

- [ ] **Step 4: Update tfvars files to remove Resend and add Brevo placeholders**

In `infrastructure/environments/dev/dev.tfvars`, `staging/staging.tfvars`, `production/production.tfvars`:
- Remove any `resend_api_key` or `resend_from_email` references
- Add: `brevo_api_key = ""` (will be set via CI/secrets manager)

- [ ] **Step 5: Run tests**

Run: `cd backend && npx jest --no-coverage 2>&1 | tail -20`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/services/NotificationService.js infrastructure/modules/compute/lambda/variables.tf infrastructure/modules/compute/lambda/main.tf infrastructure/environments/
git commit -m "feat: add support email templates and Brevo env vars to Terraform"
```

---

## Summary

| Task | What | Depends On |
|------|------|-----------|
| 1 | BrevoProvider (raw fetch wrapper) | — |
| 2 | Swap Resend → Brevo in NotificationService | 1 |
| 3 | Swap Resend → Brevo in SQS trigger | 1 |
| 4 | SMS no-op + remove phone verification | — |
| 5 | SafetyRepository (DynamoDB persistence) | — |
| 6 | Migrate SafetyService to DynamoDB | 5 |
| 7 | Emergency contact email on SOS | 2, 6 |
| 8 | SupportTicket entity + SupportRepository | — |
| 9 | SupportService | 8, 2 |
| 10 | Support controller + routes | 9 |
| 11 | Admin safety dashboard | 6 |
| 12 | Support email templates + Terraform | 2, 10 |
