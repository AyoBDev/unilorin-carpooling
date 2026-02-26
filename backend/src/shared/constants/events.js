/**
 * Event Constants
 * University of Ilorin Carpooling Platform
 *
 * Centralized event types for event-driven architecture.
 * Used with EventBridge, SNS, and internal event emitters.
 */

/**
 * Event sources (services that emit events)
 */
const EventSources = {
  AUTH_SERVICE: 'auth-service',
  USER_SERVICE: 'user-service',
  RIDE_SERVICE: 'ride-service',
  BOOKING_SERVICE: 'booking-service',
  PAYMENT_SERVICE: 'payment-service',
  NOTIFICATION_SERVICE: 'notification-service',
  RATING_SERVICE: 'rating-service',
  ADMIN_SERVICE: 'admin-service',
  SYSTEM: 'system',
};

/**
 * Event types organized by domain
 */
const EventTypes = {
  // User events
  USER: {
    REGISTERED: 'user.registered',
    VERIFIED: 'user.verified',
    LOGGED_IN: 'user.logged_in',
    LOGGED_OUT: 'user.logged_out',
    PROFILE_UPDATED: 'user.profile_updated',
    PASSWORD_CHANGED: 'user.password_changed',
    PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
    PASSWORD_RESET_COMPLETED: 'user.password_reset_completed',
    ACCOUNT_SUSPENDED: 'user.account_suspended',
    ACCOUNT_ACTIVATED: 'user.account_activated',
    ACCOUNT_BANNED: 'user.account_banned',
    ACCOUNT_DELETED: 'user.account_deleted',
    EMERGENCY_CONTACT_ADDED: 'user.emergency_contact_added',
    EMERGENCY_CONTACT_UPDATED: 'user.emergency_contact_updated',
  },

  // Driver events
  DRIVER: {
    REGISTERED: 'driver.registered',
    VERIFICATION_REQUESTED: 'driver.verification_requested',
    VERIFIED: 'driver.verified',
    REJECTED: 'driver.rejected',
    SUSPENDED: 'driver.suspended',
    REACTIVATED: 'driver.reactivated',
    DOCUMENT_UPLOADED: 'driver.document_uploaded',
    DOCUMENT_EXPIRED: 'driver.document_expired',
    RATING_UPDATED: 'driver.rating_updated',
  },

  // Vehicle events
  VEHICLE: {
    ADDED: 'vehicle.added',
    UPDATED: 'vehicle.updated',
    REMOVED: 'vehicle.removed',
    DOCUMENT_UPLOADED: 'vehicle.document_uploaded',
    DOCUMENT_VERIFIED: 'vehicle.document_verified',
    DOCUMENT_EXPIRED: 'vehicle.document_expired',
  },

  // Ride events
  RIDE: {
    CREATED: 'ride.created',
    UPDATED: 'ride.updated',
    CANCELLED: 'ride.cancelled',
    STARTED: 'ride.started',
    COMPLETED: 'ride.completed',
    SEATS_UPDATED: 'ride.seats_updated',
    PICKUP_POINT_ADDED: 'ride.pickup_point_added',
    PICKUP_POINT_REMOVED: 'ride.pickup_point_removed',
    FULLY_BOOKED: 'ride.fully_booked',
    DEPARTURE_REMINDER: 'ride.departure_reminder',
    RECURRING_CREATED: 'ride.recurring_created',
    RECURRING_CANCELLED: 'ride.recurring_cancelled',
  },

  // Booking events
  BOOKING: {
    CREATED: 'booking.created',
    CONFIRMED: 'booking.confirmed',
    CANCELLED: 'booking.cancelled',
    CANCELLED_BY_DRIVER: 'booking.cancelled_by_driver',
    STARTED: 'booking.started',
    COMPLETED: 'booking.completed',
    NO_SHOW: 'booking.no_show',
    PASSENGER_VERIFIED: 'booking.passenger_verified',
    REMINDER_SENT: 'booking.reminder_sent',
    CASH_COLLECTED: 'booking.cash_collected',
  },

  // Payment events (Phase 2)
  PAYMENT: {
    INITIATED: 'payment.initiated',
    PROCESSING: 'payment.processing',
    COMPLETED: 'payment.completed',
    FAILED: 'payment.failed',
    REFUND_INITIATED: 'payment.refund_initiated',
    REFUND_COMPLETED: 'payment.refund_completed',
    REFUND_FAILED: 'payment.refund_failed',
    WEBHOOK_RECEIVED: 'payment.webhook_received',
  },

  // Rating events
  RATING: {
    CREATED: 'rating.created',
    UPDATED: 'rating.updated',
    DELETED: 'rating.deleted',
    DRIVER_RATING_UPDATED: 'rating.driver_rating_updated',
    PASSENGER_RATING_UPDATED: 'rating.passenger_rating_updated',
  },

  // Notification events
  NOTIFICATION: {
    CREATED: 'notification.created',
    SENT: 'notification.sent',
    DELIVERED: 'notification.delivered',
    FAILED: 'notification.failed',
    READ: 'notification.read',
    BULK_SENT: 'notification.bulk_sent',
  },

  // Safety events
  SAFETY: {
    SOS_TRIGGERED: 'safety.sos_triggered',
    SOS_RESOLVED: 'safety.sos_resolved',
    LOCATION_SHARED: 'safety.location_shared',
    EMERGENCY_CONTACT_NOTIFIED: 'safety.emergency_contact_notified',
    INCIDENT_REPORTED: 'safety.incident_reported',
  },

  // Admin events
  ADMIN: {
    USER_VERIFIED: 'admin.user_verified',
    USER_SUSPENDED: 'admin.user_suspended',
    USER_BANNED: 'admin.user_banned',
    DRIVER_APPROVED: 'admin.driver_approved',
    DRIVER_REJECTED: 'admin.driver_rejected',
    REPORT_GENERATED: 'admin.report_generated',
    SETTINGS_UPDATED: 'admin.settings_updated',
  },

  // System events
  SYSTEM: {
    STARTUP: 'system.startup',
    SHUTDOWN: 'system.shutdown',
    ERROR: 'system.error',
    HEALTH_CHECK: 'system.health_check',
    CACHE_CLEARED: 'system.cache_cleared',
    MAINTENANCE_STARTED: 'system.maintenance_started',
    MAINTENANCE_ENDED: 'system.maintenance_ended',
    DAILY_CLEANUP: 'system.daily_cleanup',
  },
};

/**
 * Notification channels
 */
const NotificationChannels = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  IN_APP: 'in_app',
};

/**
 * Notification types (what triggers notifications)
 */
const NotificationTypes = {
  // Booking notifications
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLATION: 'booking_cancellation',
  BOOKING_CANCELLED_BY_DRIVER: 'booking_cancelled_by_driver',
  BOOKING_REMINDER: 'booking_reminder',
  RIDE_STARTING: 'ride_starting',
  RIDE_COMPLETED: 'ride_completed',
  PASSENGER_CODE: 'passenger_code',

  // Driver notifications
  NEW_BOOKING: 'new_booking',
  BOOKING_CANCELLED_BY_PASSENGER: 'booking_cancelled_by_passenger',
  PASSENGER_NO_SHOW: 'passenger_no_show',
  VERIFICATION_APPROVED: 'verification_approved',
  VERIFICATION_REJECTED: 'verification_rejected',

  // Account notifications
  WELCOME: 'welcome',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',
  ACCOUNT_SUSPENDED: 'account_suspended',

  // Rating notifications
  NEW_RATING: 'new_rating',
  RATING_REMINDER: 'rating_reminder',

  // Safety notifications
  SOS_ALERT: 'sos_alert',
  LOCATION_SHARED: 'location_shared',

  // System notifications
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  PROMOTIONAL: 'promotional',
};

/**
 * Event priorities
 */
const EventPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Event schema version for backward compatibility
 */
const EVENT_SCHEMA_VERSION = '1.0';

/**
 * Create a standardized event object
 * @param {string} eventType - Event type from EventTypes
 * @param {Object} payload - Event payload
 * @param {Object} options - Additional options
 * @returns {Object} Standardized event object
 */
const createEvent = (eventType, payload, options = {}) => {
  const {
    source = EventSources.SYSTEM,
    userId = null,
    correlationId = null,
    priority = EventPriority.NORMAL,
  } = options;

  return {
    eventType,
    version: EVENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    source,
    payload,
    metadata: {
      ...(userId && { userId }),
      ...(correlationId && { correlationId }),
      priority,
    },
  };
};

/**
 * Event patterns for EventBridge rules
 */
const EventPatterns = {
  // All user events
  ALL_USER_EVENTS: {
    source: [EventSources.USER_SERVICE, EventSources.AUTH_SERVICE],
    'detail-type': Object.values(EventTypes.USER),
  },

  // All booking events
  ALL_BOOKING_EVENTS: {
    source: [EventSources.BOOKING_SERVICE],
    'detail-type': Object.values(EventTypes.BOOKING),
  },

  // All ride events
  ALL_RIDE_EVENTS: {
    source: [EventSources.RIDE_SERVICE],
    'detail-type': Object.values(EventTypes.RIDE),
  },

  // Critical events requiring immediate notification
  CRITICAL_EVENTS: {
    'detail-type': [
      EventTypes.SAFETY.SOS_TRIGGERED,
      EventTypes.BOOKING.CANCELLED_BY_DRIVER,
      EventTypes.RIDE.CANCELLED,
      EventTypes.SYSTEM.ERROR,
    ],
  },

  // Events requiring email notification
  EMAIL_NOTIFICATION_EVENTS: {
    'detail-type': [
      EventTypes.USER.REGISTERED,
      EventTypes.USER.PASSWORD_RESET_REQUESTED,
      EventTypes.BOOKING.CREATED,
      EventTypes.BOOKING.CANCELLED,
      EventTypes.DRIVER.VERIFIED,
      EventTypes.DRIVER.REJECTED,
    ],
  },
};

/**
 * DynamoDB Stream event types
 */
const DynamoDBStreamEvents = {
  INSERT: 'INSERT',
  MODIFY: 'MODIFY',
  REMOVE: 'REMOVE',
};

/**
 * WebSocket event types
 */
const WebSocketEvents = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Subscription events
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',

  // Real-time updates
  RIDE_UPDATE: 'ride_update',
  BOOKING_UPDATE: 'booking_update',
  LOCATION_UPDATE: 'location_update',
  NOTIFICATION: 'notification',

  // Chat events
  MESSAGE: 'message',
  TYPING: 'typing',

  // Error events
  ERROR: 'error',
};


// ─────────────────────────────────────────────
// Flat event aliases (used by service layer)
// ─────────────────────────────────────────────

const AUTH_EVENTS = {
  REGISTRATION_STARTED: 'auth.registration_started',
  REGISTRATION_COMPLETED: 'auth.registration_completed',
  REGISTRATION_FAILED: 'auth.registration_failed',
  LOGIN_STARTED: 'auth.login_started',
  LOGIN_COMPLETED: 'auth.login_completed',
  LOGIN_FAILED: 'auth.login_failed',
  EMAIL_VERIFICATION_STARTED: 'auth.email_verification_started',
  EMAIL_VERIFICATION_COMPLETED: 'auth.email_verification_completed',
  EMAIL_VERIFICATION_FAILED: 'auth.email_verification_failed',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  PASSWORD_RESET_STARTED: 'auth.password_reset_started',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  PASSWORD_RESET_FAILED: 'auth.password_reset_failed',
  TOKEN_REFRESH_STARTED: 'auth.token_refresh_started',
  TOKEN_REFRESH_COMPLETED: 'auth.token_refresh_completed',
  TOKEN_REFRESH_FAILED: 'auth.token_refresh_failed',
  LOGOUT_STARTED: 'auth.logout_started',
  LOGOUT_COMPLETED: 'auth.logout_completed',
  LOGOUT_FAILED: 'auth.logout_failed',
};

const BOOKING_EVENTS = {
  BOOKING_CREATED: EventTypes.BOOKING.CREATED,
  BOOKING_CONFIRMED: EventTypes.BOOKING.CONFIRMED,
  BOOKING_CANCELLED: EventTypes.BOOKING.CANCELLED,
  BOOKING_CANCELLED_BY_DRIVER: EventTypes.BOOKING.CANCELLED_BY_DRIVER,
  BOOKING_STARTED: EventTypes.BOOKING.STARTED,
  BOOKING_COMPLETED: EventTypes.BOOKING.COMPLETED,
  BOOKING_NO_SHOW: EventTypes.BOOKING.NO_SHOW,
  BOOKING_PASSENGER_VERIFIED: EventTypes.BOOKING.PASSENGER_VERIFIED,
  BOOKING_REMINDER_SENT: EventTypes.BOOKING.REMINDER_SENT,
  BOOKING_CASH_COLLECTED: EventTypes.BOOKING.CASH_COLLECTED,
};

const RIDE_EVENTS = {
  RIDE_CREATED: EventTypes.RIDE.CREATED,
  RIDE_UPDATED: EventTypes.RIDE.UPDATED,
  RIDE_CANCELLED: EventTypes.RIDE.CANCELLED,
  RIDE_STARTED: EventTypes.RIDE.STARTED,
  RIDE_COMPLETED: EventTypes.RIDE.COMPLETED,
  RIDE_SEATS_UPDATED: EventTypes.RIDE.SEATS_UPDATED,
  RIDE_SEARCHED: 'ride.searched',
  RIDE_FULLY_BOOKED: EventTypes.RIDE.FULLY_BOOKED,
  RIDE_DEPARTURE_REMINDER: EventTypes.RIDE.DEPARTURE_REMINDER,
  RIDE_RECURRING_CREATED: EventTypes.RIDE.RECURRING_CREATED,
  RIDE_RECURRING_CANCELLED: EventTypes.RIDE.RECURRING_CANCELLED,
};

const NOTIFICATION_EVENTS = {
  EMAIL_SENT: 'notification.email_sent',
  SMS_SENT: 'notification.sms_sent',
  PUSH_SENT: 'notification.push_sent',
  IN_APP_SENT: 'notification.in_app_sent',
  NOTIFICATION_CREATED: EventTypes.NOTIFICATION.CREATED,
  NOTIFICATION_READ: EventTypes.NOTIFICATION.READ,
  NOTIFICATION_FAILED: EventTypes.NOTIFICATION.FAILED,
  BULK_SENT: EventTypes.NOTIFICATION.BULK_SENT,
};

const RATING_EVENTS = {
  RATING_CREATED: EventTypes.RATING.CREATED,
  RATING_UPDATED: EventTypes.RATING.UPDATED,
  RATING_DELETED: EventTypes.RATING.DELETED,
  DRIVER_RATING_UPDATED: EventTypes.RATING.DRIVER_RATING_UPDATED,
  PASSENGER_RATING_UPDATED: EventTypes.RATING.PASSENGER_RATING_UPDATED,
};

const SAFETY_EVENTS = {
  SOS_TRIGGERED: EventTypes.SAFETY.SOS_TRIGGERED,
  SOS_RESOLVED: EventTypes.SAFETY.SOS_RESOLVED,
  LOCATION_SHARED: EventTypes.SAFETY.LOCATION_SHARED,
  EMERGENCY_CONTACT_NOTIFIED: EventTypes.SAFETY.EMERGENCY_CONTACT_NOTIFIED,
  INCIDENT_REPORTED: EventTypes.SAFETY.INCIDENT_REPORTED,
  TRACKING_STARTED: 'safety.tracking_started',
  TRACKING_STOPPED: 'safety.tracking_stopped',
};

const USER_EVENTS = {
  PROFILE_VIEWED: 'user.profile_viewed',
  PROFILE_UPDATED: EventTypes.USER.PROFILE_UPDATED,
  ACCOUNT_DELETED: EventTypes.USER.ACCOUNT_DELETED,
  DRIVER_REGISTERED: EventTypes.DRIVER.REGISTERED,
  REGISTERED: EventTypes.USER.REGISTERED,
  VERIFIED: EventTypes.USER.VERIFIED,
  LOGGED_IN: EventTypes.USER.LOGGED_IN,
  LOGGED_OUT: EventTypes.USER.LOGGED_OUT,
};

module.exports = {
  USER_EVENTS,
  SAFETY_EVENTS,
  RATING_EVENTS,
  NOTIFICATION_EVENTS,
  RIDE_EVENTS,
  BOOKING_EVENTS,
  AUTH_EVENTS,
  EventSources,
  EventTypes,
  NotificationChannels,
  NotificationTypes,
  EventPriority,
  EVENT_SCHEMA_VERSION,
  createEvent,
  EventPatterns,
  DynamoDBStreamEvents,
  WebSocketEvents,
};
