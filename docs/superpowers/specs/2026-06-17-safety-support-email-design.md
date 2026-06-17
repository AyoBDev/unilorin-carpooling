# Safety, Support & Email Infrastructure Design

**Date:** 2026-06-17
**Approach:** Incremental (email first, then SMS no-op, safety persistence, support tickets, admin dashboard)

---

## 1. Email Infrastructure (Resend → Brevo)

### Overview

Replace Resend with Brevo's transactional email REST API. Keep all HTML template generation in code — Brevo is used purely as a transport layer.

### Changes

| File | Action |
|------|--------|
| `backend/src/infrastructure/email/BrevoProvider.js` | New — wraps Brevo REST API |
| `backend/src/core/services/NotificationService.js` | Modify — swap Resend calls for BrevoProvider |
| `backend/src/lambda/triggers/sqs.trigger.js` | Modify — swap Resend calls for BrevoProvider |
| `backend/package.json` | Remove `resend`, no new SDK (raw fetch) |

### BrevoProvider Interface

```javascript
class BrevoProvider {
  constructor({ apiKey, senderEmail, senderName })

  async send({ to, subject, htmlContent, textContent, replyTo, tags })
  // Returns: { messageId, accepted: boolean }

  async sendBatch(messages[])
  // Returns: { results: [{ messageId, accepted }] }
}
```

### API Details

- Endpoint: `POST https://api.brevo.com/v3/smtp/email`
- Auth: `api-key` header with `BREVO_API_KEY`
- No SDK dependency — uses native `fetch` for minimal Lambda bundle size

### Environment Variables

- Remove: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Add: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (default: `noreply@psride.ng`), `BREVO_SENDER_NAME` (default: `PSRide`)

### Existing Templates (unchanged, transport only)

WELCOME, EMAIL_VERIFICATION, PASSWORD_RESET, BOOKING_CONFIRMATION, BOOKING_CANCELLED, RIDE_REMINDER, RIDE_STARTED, RIDE_COMPLETED, PAYMENT_INSTRUCTIONS, RATING_REQUEST, DRIVER_APPROVED, DOCUMENT_REJECTED, SOS_ALERT

---

## 2. SMS Discontinuation

### Overview

Keep `sms` as a valid notification channel type but make the handler a no-op. Remove phone verification as a requirement for user registration and access.

### Changes

| File | Action |
|------|--------|
| `NotificationService.js` | SMS handler becomes no-op (log + return success) |
| Auth middleware / registration | Remove phone verification requirement |
| `SafetyService.js` | Emergency contact SMS → email via Brevo |
| User validation schemas | Phone number becomes optional field |

### Behavioral Changes

- `sms` channel type remains in enums/constants (future-proof)
- Any code path that attempts to send SMS logs `"SMS channel disabled"` at debug level and returns success
- Phone number is retained as an optional user profile field
- No verification flow for phone numbers
- Emergency contacts: notified exclusively via email

---

## 3. Safety System Persistence

### Overview

Replace in-memory `Map` storage in SafetyService with DynamoDB via a new SafetyRepository. Active sessions survive Lambda cold starts.

### New: SafetyRepository.js

Extends `BaseRepository`. Manages three entity types:

#### DynamoDB Key Design

| Entity | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| SOS Alert | `USER#{userId}` | `SOS#{alertId}` | `SOS#STATUS#{status}` | `{createdAt}` |
| Safety Session | `BOOKING#{bookingId}` | `TRACKING#{sessionId}` | `TRACKING#ACTIVE` | `{startedAt}` |
| Location Share | `SHARE#{shareToken}` | `LOCATION` | `USER#{userId}` | `LOCSHARE#{createdAt}` |

GSI1 for SOS uses status in the partition key (`SOS#STATUS#ACTIVE`, `SOS#STATUS#RESOLVED`, etc.) so the admin dashboard can query by status.

#### TTL Rules

- SOS alerts: 24h after resolution, 7 days if unresolved
- Location shares: session end + 1 hour
- Tracking sessions: ride completion + 24 hours

### SafetyService Modifications

- Remove: `this.activeAlerts = new Map()`, `this.trackingSessions = new Map()`, `this.locationShares = new Map()`
- Replace with: `this.safetyRepository` calls
- Location history: store last 10 points per session in DynamoDB item (array attribute)
- Route deviation / long stop / speed checks: read latest location from DB, compare against thresholds

### Emergency Contact Email

When SOS is triggered:

1. Look up user's emergency contacts (stored on user profile)
2. For each contact with an email address, send via Brevo:
   - Subject: `URGENT: {userName} triggered an emergency alert on PSRide`
   - Body: user name, last known location (Google Maps link from lat/lng), timestamp, ride details (route, driver name if passenger), action guidance
3. Log notification attempt and result

---

## 4. Support Ticket System

### Overview

Simple ticket system: users create tickets, admins view/respond/close. Email notifications on status changes.

### New Files

| File | Purpose |
|------|---------|
| `backend/src/core/services/SupportService.js` | Business logic |
| `backend/src/infrastructure/database/repositories/SupportRepository.js` | DynamoDB persistence |
| `backend/src/api/controllers/SupportController.js` | HTTP handler |
| `backend/src/api/routes/support.routes.js` | Route definitions |
| `backend/src/core/domain/entities/SupportTicket.js` | Domain entity |

### Ticket Model

```javascript
{
  ticketId: "uuid",
  userId: "uuid",
  reference: "PSR-00001",       // human-readable, auto-incrementing
  category: "ride_dispute",     // enum
  subject: "Driver took wrong route",
  description: "...",
  status: "OPEN",               // OPEN → IN_PROGRESS → RESOLVED → CLOSED
  priority: "MEDIUM",           // LOW, MEDIUM, HIGH (auto-set by category, admin-overridable)
  assignedTo: null,             // admin userId
  responses: [
    { responderId, message, createdAt, isAdmin }
  ],
  createdAt, updatedAt, resolvedAt
}
```

### Categories

`account_issue`, `ride_dispute`, `payment_issue`, `safety_concern`, `driver_complaint`, `app_bug`, `other`

### Priority Auto-Assignment

- `safety_concern` → HIGH
- `ride_dispute`, `payment_issue`, `driver_complaint` → MEDIUM
- `account_issue`, `app_bug`, `other` → LOW

### DynamoDB Key Design

| PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|----|----|----|--------|--------|--------|
| `USER#{userId}` | `TICKET#{ticketId}` | `TICKET#STATUS#{status}` | `{createdAt}` | `TICKET#{ticketId}` | `TICKET` |

### User Routes

```
POST   /api/v1/support/tickets              - Create ticket
GET    /api/v1/support/tickets              - Get my tickets (paginated, filterable by status)
GET    /api/v1/support/tickets/:ticketId    - Get ticket detail with responses
POST   /api/v1/support/tickets/:ticketId/close - Close own ticket
```

### Admin Routes

```
GET    /api/v1/admin/support/tickets                     - All tickets (filter: status, priority, category)
GET    /api/v1/admin/support/tickets/:ticketId           - Ticket detail
POST   /api/v1/admin/support/tickets/:ticketId/respond   - Add response
PUT    /api/v1/admin/support/tickets/:ticketId/status    - Update status
PUT    /api/v1/admin/support/tickets/:ticketId/assign    - Assign to admin
```

### Email Notifications

- **Ticket created** → confirmation email to user with reference number
- **Admin responds** → email to user with response preview and link
- **Ticket resolved** → email to user confirming resolution

---

## 5. Admin Safety Dashboard

### Overview

Admin-only endpoints to monitor and manage safety events across the platform.

### New Files

| File | Purpose |
|------|---------|
| `backend/src/api/controllers/AdminSafetyController.js` | HTTP handler |
| `backend/src/api/routes/admin-safety.routes.js` | Route definitions |

### Routes

```
GET    /api/v1/admin/safety/sos              - Active + recent SOS alerts (paginated)
GET    /api/v1/admin/safety/sos/:alertId     - SOS detail (user, location history, ride context)
PUT    /api/v1/admin/safety/sos/:alertId     - Update SOS (escalate, assign, add notes)
GET    /api/v1/admin/safety/incidents        - All incidents (filter: type, severity, status)
GET    /api/v1/admin/safety/incidents/:id    - Incident detail
PUT    /api/v1/admin/safety/incidents/:id    - Update incident (status, assign, notes)
GET    /api/v1/admin/safety/stats            - Safety overview statistics
```

### Safety Stats Response

```javascript
{
  activeSosCount: 0,
  unresolvedIncidents: { low: 2, medium: 1, high: 0, critical: 0 },
  incidentsThisWeek: 3,
  incidentsThisMonth: 12,
  topCategories: [{ type: "unsafe_driving", count: 5 }, ...],
  averageResolutionHours: 4.2
}
```

### Incident Admin Status Flow

```
REPORTED → INVESTIGATING → ACTION_TAKEN → RESOLVED
                                        → DISMISSED
```

Admin actions on incidents:
- Add internal notes (not visible to reporter)
- Change status
- Assign to another admin
- Suspend involved users (calls existing user management)

### Access Control

All endpoints require `authenticate` + `authorize('admin')` middleware.

---

## 6. Implementation Order

1. **Email infrastructure** — BrevoProvider, swap in NotificationService + SQS trigger
2. **SMS no-op** — disable SMS handler, remove phone verification requirement
3. **Safety persistence** — SafetyRepository, migrate SafetyService from in-memory to DynamoDB
4. **Emergency contact emails** — SOS trigger sends Brevo email to contacts
5. **Support tickets** — full CRUD with email notifications
6. **Admin safety dashboard** — read/manage SOS and incidents

Each step is independently deployable. Steps 1-2 are prerequisites for steps 3-6.

---

## 7. New Email Templates

| Template | Trigger | Priority |
|----------|---------|----------|
| `SOS_EMERGENCY_CONTACT` | SOS alert triggered | Immediate |
| `SUPPORT_TICKET_CREATED` | User creates ticket | Normal |
| `SUPPORT_TICKET_RESPONSE` | Admin responds | Normal |
| `SUPPORT_TICKET_RESOLVED` | Ticket resolved | Normal |

---

## 8. Environment Variables Summary

### Remove
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Add
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL` (default: `noreply@psride.ng`)
- `BREVO_SENDER_NAME` (default: `PSRide`)

### Unchanged
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (push notifications remain)
- All other existing env vars
