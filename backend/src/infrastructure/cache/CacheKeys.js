/**
 * Cache Keys Configuration
 * University of Ilorin Carpooling Platform
 *
 * Path: src/infrastructure/cache/CacheKeys.js
 *
 * Centralized cache key management with namespacing,
 * TTL definitions, and key generation utilities.
 * Prevents key collisions and ensures consistent naming.
 */

// ============================================================
// Cache Key Prefixes (Namespace)
// ============================================================

const crypto = require('crypto');

const PREFIX = 'uil:carpool';

const NAMESPACES = {
  AUTH: `${PREFIX}:auth`,
  USER: `${PREFIX}:user`,
  RIDE: `${PREFIX}:ride`,
  BOOKING: `${PREFIX}:booking`,
  RATING: `${PREFIX}:rating`,
  NOTIFICATION: `${PREFIX}:notification`,
  SAFETY: `${PREFIX}:safety`,
  REPORT: `${PREFIX}:report`,
  SEARCH: `${PREFIX}:search`,
  SESSION: `${PREFIX}:session`,
  RATE_LIMIT: `${PREFIX}:rl`,
  OTP: `${PREFIX}:otp`,
  LOCK: `${PREFIX}:lock`,
  COUNTER: `${PREFIX}:counter`,
};

// ============================================================
// TTL Definitions (in seconds)
// ============================================================

const TTL = {
  // Authentication & Sessions
  ACCESS_TOKEN: 24 * 60 * 60, // 24 hours
  REFRESH_TOKEN: 30 * 24 * 60 * 60, // 30 days
  SESSION: 24 * 60 * 60, // 24 hours
  OTP: 5 * 60, // 5 minutes
  EMAIL_VERIFICATION: 24 * 60 * 60, // 24 hours
  PASSWORD_RESET: 60 * 60, // 1 hour
  BLACKLISTED_TOKEN: 24 * 60 * 60, // 24 hours (match access token)

  // User Data
  USER_PROFILE: 30 * 60, // 30 minutes
  USER_STATISTICS: 10 * 60, // 10 minutes
  USER_PREFERENCES: 60 * 60, // 1 hour
  DRIVER_PROFILE: 30 * 60, // 30 minutes
  DRIVER_STATUS: 5 * 60, // 5 minutes
  DRIVER_VEHICLES: 60 * 60, // 1 hour

  // Rides
  RIDE_DETAILS: 5 * 60, // 5 minutes
  RIDE_SEARCH: 2 * 60, // 2 minutes (frequently changing)
  RIDE_PASSENGERS: 2 * 60, // 2 minutes
  UPCOMING_RIDES: 3 * 60, // 3 minutes
  DRIVER_RIDES: 5 * 60, // 5 minutes
  ACTIVE_RIDES: 60, // 1 minute (real-time)

  // Bookings
  BOOKING_DETAILS: 5 * 60, // 5 minutes
  USER_BOOKINGS: 5 * 60, // 5 minutes
  DRIVER_BOOKINGS: 3 * 60, // 3 minutes
  BOOKING_VERIFICATION: 30 * 60, // 30 minutes
  BOOKING_STATISTICS: 10 * 60, // 10 minutes

  // Ratings
  USER_RATINGS: 15 * 60, // 15 minutes
  RATING_ANALYTICS: 30 * 60, // 30 minutes
  PENDING_RATINGS: 5 * 60, // 5 minutes

  // Notifications
  UNREAD_COUNT: 60, // 1 minute (frequently polled)
  NOTIFICATION_PREFS: 60 * 60, // 1 hour
  RECENT_NOTIFICATIONS: 2 * 60, // 2 minutes

  // Reports
  CASH_COLLECTION: 5 * 60, // 5 minutes
  DRIVER_SUMMARY: 10 * 60, // 10 minutes
  PLATFORM_STATS: 15 * 60, // 15 minutes

  // Safety
  SOS_ALERT: 0, // No cache (real-time)
  LOCATION_DATA: 30, // 30 seconds (real-time tracking)

  // Rate Limiting
  RATE_LIMIT_WINDOW: 60, // 1 minute default window
  RATE_LIMIT_AUTH: 15 * 60, // 15 minutes auth window
  RATE_LIMIT_OTP: 5 * 60, // 5 minutes OTP window
  RATE_LIMIT_SOS: 60 * 60, // 1 hour SOS window

  // Distributed Locks
  LOCK_DEFAULT: 30, // 30 seconds
  LOCK_BOOKING: 15, // 15 seconds (booking creation)
  LOCK_SEAT_RESERVE: 10, // 10 seconds (seat reservation)

  // Counters
  DAILY_COUNTER: 24 * 60 * 60, // 24 hours
};

// ============================================================
// Cache Key Generators
// ============================================================

const CacheKeys = {
  // ---------- Authentication ----------
  auth: {
    session: (userId) => `${NAMESPACES.SESSION}:${userId}`,
    sessionDevice: (userId, deviceId) => `${NAMESPACES.SESSION}:${userId}:${deviceId}`,
    accessToken: (tokenId) => `${NAMESPACES.AUTH}:access:${tokenId}`,
    refreshToken: (tokenId) => `${NAMESPACES.AUTH}:refresh:${tokenId}`,
    blacklistedToken: (tokenId) => `${NAMESPACES.AUTH}:blacklist:${tokenId}`,
    otp: (userId, purpose) => `${NAMESPACES.OTP}:${purpose}:${userId}`,
    emailVerification: (token) => `${NAMESPACES.AUTH}:email-verify:${token}`,
    passwordReset: (token) => `${NAMESPACES.AUTH}:pwd-reset:${token}`,
    loginAttempts: (identifier) => `${NAMESPACES.AUTH}:login-attempts:${identifier}`,
    activeSessions: (userId) => `${NAMESPACES.AUTH}:active-sessions:${userId}`,
  },

  // ---------- Users ----------
  user: {
    profile: (userId) => `${NAMESPACES.USER}:profile:${userId}`,
    profileByEmail: (email) => `${NAMESPACES.USER}:email:${email}`,
    profileByMatric: (matricNumber) => `${NAMESPACES.USER}:matric:${matricNumber}`,
    statistics: (userId) => `${NAMESPACES.USER}:stats:${userId}`,
    preferences: (userId) => `${NAMESPACES.USER}:prefs:${userId}`,
    emergencyContacts: (userId) => `${NAMESPACES.USER}:emergency:${userId}`,
    driver: {
      profile: (userId) => `${NAMESPACES.USER}:driver:${userId}`,
      status: (userId) => `${NAMESPACES.USER}:driver-status:${userId}`,
      vehicles: (userId) => `${NAMESPACES.USER}:vehicles:${userId}`,
      vehicle: (userId, vehicleId) => `${NAMESPACES.USER}:vehicle:${userId}:${vehicleId}`,
    },
  },

  // ---------- Rides ----------
  ride: {
    details: (rideId) => `${NAMESPACES.RIDE}:detail:${rideId}`,
    passengers: (rideId) => `${NAMESPACES.RIDE}:passengers:${rideId}`,
    search: (queryHash) => `${NAMESPACES.SEARCH}:rides:${queryHash}`,
    upcoming: (userId) => `${NAMESPACES.RIDE}:upcoming:${userId}`,
    driverRides: (driverId, status) => `${NAMESPACES.RIDE}:driver:${driverId}:${status || 'all'}`,
    activeByDriver: (driverId) => `${NAMESPACES.RIDE}:active:${driverId}`,
    availableSeats: (rideId) => `${NAMESPACES.RIDE}:seats:${rideId}`,
    pickupPoints: (rideId) => `${NAMESPACES.RIDE}:pickups:${rideId}`,
    recurring: (recurringId) => `${NAMESPACES.RIDE}:recurring:${recurringId}`,
  },

  // ---------- Bookings ----------
  booking: {
    details: (bookingId) => `${NAMESPACES.BOOKING}:detail:${bookingId}`,
    userBookings: (userId, status) => `${NAMESPACES.BOOKING}:user:${userId}:${status || 'all'}`,
    driverBookings: (driverId, status) =>
      `${NAMESPACES.BOOKING}:driver:${driverId}:${status || 'all'}`,
    rideBookings: (rideId) => `${NAMESPACES.BOOKING}:ride:${rideId}`,
    verification: (bookingId) => `${NAMESPACES.BOOKING}:verify:${bookingId}`,
    statistics: (userId) => `${NAMESPACES.BOOKING}:stats:${userId}`,
  },

  // ---------- Ratings ----------
  rating: {
    details: (ratingId) => `${NAMESPACES.RATING}:detail:${ratingId}`,
    userRatings: (userId) => `${NAMESPACES.RATING}:user:${userId}`,
    bookingRating: (bookingId) => `${NAMESPACES.RATING}:booking:${bookingId}`,
    pending: (userId) => `${NAMESPACES.RATING}:pending:${userId}`,
    analytics: (userId) => `${NAMESPACES.RATING}:analytics:${userId}`,
    averageRating: (userId) => `${NAMESPACES.RATING}:avg:${userId}`,
  },

  // ---------- Notifications ----------
  notification: {
    unreadCount: (userId) => `${NAMESPACES.NOTIFICATION}:unread:${userId}`,
    preferences: (userId) => `${NAMESPACES.NOTIFICATION}:prefs:${userId}`,
    recent: (userId) => `${NAMESPACES.NOTIFICATION}:recent:${userId}`,
  },

  // ---------- Safety ----------
  safety: {
    activeAlert: (alertId) => `${NAMESPACES.SAFETY}:alert:${alertId}`,
    userActiveAlerts: (userId) => `${NAMESPACES.SAFETY}:user-alerts:${userId}`,
    liveLocation: (rideId, userId) => `${NAMESPACES.SAFETY}:loc:${rideId}:${userId}`,
  },

  // ---------- Reports ----------
  report: {
    cashCollection: (driverId, date) => `${NAMESPACES.REPORT}:cash:${driverId}:${date}`,
    driverSummary: (driverId, period) => `${NAMESPACES.REPORT}:driver:${driverId}:${period}`,
    platformStats: (date) => `${NAMESPACES.REPORT}:platform:${date}`,
    bookingSummary: (userId, period) => `${NAMESPACES.REPORT}:booking:${userId}:${period}`,
  },

  // ---------- Rate Limiting ----------
  rateLimit: {
    global: (ip) => `${NAMESPACES.RATE_LIMIT}:global:${ip}`,
    auth: (ip) => `${NAMESPACES.RATE_LIMIT}:auth:${ip}`,
    login: (identifier) => `${NAMESPACES.RATE_LIMIT}:login:${identifier}`,
    otp: (userId) => `${NAMESPACES.RATE_LIMIT}:otp:${userId}`,
    booking: (userId) => `${NAMESPACES.RATE_LIMIT}:booking:${userId}`,
    sos: (userId) => `${NAMESPACES.RATE_LIMIT}:sos:${userId}`,
    search: (userId) => `${NAMESPACES.RATE_LIMIT}:search:${userId}`,
    passwordReset: (email) => `${NAMESPACES.RATE_LIMIT}:pwd-reset:${email}`,
  },

  // ---------- Distributed Locks ----------
  lock: {
    booking: (rideId) => `${NAMESPACES.LOCK}:booking:${rideId}`,
    seatReserve: (rideId) => `${NAMESPACES.LOCK}:seat:${rideId}`,
    rideStart: (rideId) => `${NAMESPACES.LOCK}:ride-start:${rideId}`,
    rideComplete: (rideId) => `${NAMESPACES.LOCK}:ride-complete:${rideId}`,
    userAction: (userId, action) => `${NAMESPACES.LOCK}:user:${userId}:${action}`,
  },

  // ---------- Counters ----------
  counter: {
    dailyBookings: (date) => `${NAMESPACES.COUNTER}:bookings:${date}`,
    dailyRides: (date) => `${NAMESPACES.COUNTER}:rides:${date}`,
    dailyRegistrations: (date) => `${NAMESPACES.COUNTER}:registrations:${date}`,
    driverTrips: (driverId, date) => `${NAMESPACES.COUNTER}:driver-trips:${driverId}:${date}`,
    userBookings: (userId, date) => `${NAMESPACES.COUNTER}:user-bookings:${userId}:${date}`,
  },
};

// ============================================================
// Utility Functions
// ============================================================

/**
 * Generate a hash for search queries (for cache key)
 * @param {Object} params - Search parameters
 * @returns {string} Hash string
 */
function generateSearchHash(params) {
  const normalized = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        acc[key] = params[key];
      }
      return acc;
    }, {});
  return crypto.createHash('md5').update(JSON.stringify(normalized)).digest('hex').substring(0, 12);
}

/**
 * Get TTL for a specific cache key pattern
 * @param {string} key - The cache key
 * @returns {number} TTL in seconds
 */
function getTTLForKey(key) {
  if (key.includes(':session:')) return TTL.SESSION;
  if (key.includes(':profile:')) return TTL.USER_PROFILE;
  if (key.includes(':detail:') && key.includes(':ride:')) return TTL.RIDE_DETAILS;
  if (key.includes(':detail:') && key.includes(':booking:')) return TTL.BOOKING_DETAILS;
  if (key.includes(':search:')) return TTL.RIDE_SEARCH;
  if (key.includes(':unread:')) return TTL.UNREAD_COUNT;
  if (key.includes(':rl:')) return TTL.RATE_LIMIT_WINDOW;
  if (key.includes(':lock:')) return TTL.LOCK_DEFAULT;
  return TTL.USER_PROFILE; // default 30 minutes
}

/**
 * Build invalidation patterns for entity updates.
 * Returns an array of cache keys to invalidate when an entity changes.
 * @param {string} entity - Entity type (user, ride, booking, etc.)
 * @param {Object} context - Context object with IDs
 * @returns {string[]} Array of cache key patterns to invalidate
 */
function getInvalidationKeys(entity, context = {}) {
  const keys = [];

  switch (entity) {
    case 'user': {
      const { userId, email, matricNumber } = context;
      if (userId) {
        keys.push(
          CacheKeys.user.profile(userId),
          CacheKeys.user.statistics(userId),
          CacheKeys.user.preferences(userId),
          CacheKeys.user.emergencyContacts(userId),
          CacheKeys.user.driver.profile(userId),
          CacheKeys.user.driver.status(userId),
          CacheKeys.user.driver.vehicles(userId),
        );
      }
      if (email) keys.push(CacheKeys.user.profileByEmail(email));
      if (matricNumber) keys.push(CacheKeys.user.profileByMatric(matricNumber));
      break;
    }

    case 'ride': {
      const { rideId, driverId } = context;
      if (rideId) {
        keys.push(
          CacheKeys.ride.details(rideId),
          CacheKeys.ride.passengers(rideId),
          CacheKeys.ride.availableSeats(rideId),
          CacheKeys.ride.pickupPoints(rideId),
        );
      }
      if (driverId) {
        keys.push(
          CacheKeys.ride.driverRides(driverId, 'all'),
          CacheKeys.ride.driverRides(driverId, 'active'),
          CacheKeys.ride.driverRides(driverId, 'completed'),
          CacheKeys.ride.activeByDriver(driverId),
        );
      }
      break;
    }

    case 'booking': {
      const { bookingId, userId, driverId, rideId } = context;
      if (bookingId) {
        keys.push(CacheKeys.booking.details(bookingId));
      }
      if (userId) {
        keys.push(
          CacheKeys.booking.userBookings(userId, 'all'),
          CacheKeys.booking.userBookings(userId, 'pending'),
          CacheKeys.booking.userBookings(userId, 'confirmed'),
          CacheKeys.booking.userBookings(userId, 'completed'),
          CacheKeys.booking.statistics(userId),
        );
      }
      if (driverId) {
        keys.push(
          CacheKeys.booking.driverBookings(driverId, 'all'),
          CacheKeys.booking.driverBookings(driverId, 'pending'),
          CacheKeys.booking.driverBookings(driverId, 'confirmed'),
        );
      }
      if (rideId) {
        keys.push(
          CacheKeys.booking.rideBookings(rideId),
          CacheKeys.ride.availableSeats(rideId),
          CacheKeys.ride.passengers(rideId),
        );
      }
      break;
    }

    case 'rating': {
      const { ratingId, userId, ratedUserId, bookingId } = context;
      if (ratingId) keys.push(CacheKeys.rating.details(ratingId));
      if (userId) {
        keys.push(
          CacheKeys.rating.userRatings(userId),
          CacheKeys.rating.pending(userId),
          CacheKeys.rating.analytics(userId),
        );
      }
      if (ratedUserId) {
        keys.push(
          CacheKeys.rating.userRatings(ratedUserId),
          CacheKeys.rating.averageRating(ratedUserId),
          CacheKeys.rating.analytics(ratedUserId),
          CacheKeys.user.profile(ratedUserId), // rating affects profile
        );
      }
      if (bookingId) keys.push(CacheKeys.rating.bookingRating(bookingId));
      break;
    }

    case 'notification': {
      const { userId } = context;
      if (userId) {
        keys.push(
          CacheKeys.notification.unreadCount(userId),
          CacheKeys.notification.recent(userId),
        );
      }
      break;
    }

    default:
      break;
  }

  return keys;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  CacheKeys,
  TTL,
  NAMESPACES,
  PREFIX,
  generateSearchHash,
  getTTLForKey,
  getInvalidationKeys,
};
