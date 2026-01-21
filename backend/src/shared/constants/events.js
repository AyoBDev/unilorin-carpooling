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

module.exports = {
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
