/**
 * Rate Limiter Middleware
 * University of Ilorin Carpooling Platform
 *
 * Token-bucket style rate limiter with an in-memory store for Phase 1.
 * Designed with a pluggable store interface so Redis can be swapped in
 * once the cache layer is implemented.
 *
 * Features:
 *  - Per-user rate limiting (authenticated requests)
 *  - Per-IP rate limiting (unauthenticated / fallback)
 *  - Per-endpoint limits (e.g., stricter on /auth/login)
 *  - Retry-After & X-RateLimit-* response headers
 *  - Automatic stale-entry cleanup
 *
 * @module middlewares/rateLimiter
 */

const { logger } = require('../../shared/utils/logger');
const { tooManyRequests } = require('../../shared/utils/response');

// ─────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────

const DEFAULTS = {
  /** Maximum requests in the window. */
  maxRequests: 100,
  /** Window size in milliseconds (1 minute). */
  windowMs: 60 * 1000,
  /** Custom message when rate limit is exceeded. */
  message: 'Too many requests. Please try again later.',
  /** Include standard rate-limit headers in every response. */
  headers: true,
  /** How often to sweep expired entries (ms). */
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  /** Skip rate limiting for these user roles. */
  skipRoles: ['admin'],
  /** Skip rate limiting entirely when NODE_ENV === 'test'. */
  skipInTest: true,
};

// ─────────────────────────────────────────────
// In-Memory Store
// ─────────────────────────────────────────────

/**
 * Simple sliding-window counter stored in a Map.
 * Each key maps to { count, resetTime }.
 */
class MemoryStore {
  constructor(cleanupInterval) {
    /** @type {Map<string, { count: number, resetTime: number }>} */
    this.hits = new Map();
    this._timer = null;

    if (cleanupInterval > 0) {
      this._timer = setInterval(() => this._cleanup(), cleanupInterval);
      // Allow Node to exit even if the timer is active
      if (this._timer.unref) this._timer.unref();
    }
  }

  /**
   * Increment the counter for `key` within the given window.
   * @param {string} key
   * @param {number} windowMs
   * @returns {{ count: number, resetTime: number }}
   */
  increment(key, windowMs) {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now >= entry.resetTime) {
      const record = { count: 1, resetTime: now + windowMs };
      this.hits.set(key, record);
      return record;
    }

    entry.count += 1;
    return entry;
  }

  /**
   * Return current state without incrementing.
   * @param {string} key
   * @returns {{ count: number, resetTime: number }|null}
   */
  get(key) {
    return this.hits.get(key) || null;
  }

  /**
   * Reset the counter for a specific key.
   * @param {string} key
   */
  reset(key) {
    this.hits.delete(key);
  }

  /** Remove all expired entries. */
  _cleanup() {
    const now = Date.now();
    Array.from(this.hits.entries())
      .filter(([, entry]) => now >= entry.resetTime)
      .forEach(([key]) => this.hits.delete(key));
  }

  /** Graceful shutdown. */
  destroy() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.hits.clear();
  }
}

// Singleton store shared across middleware instances
let globalStore = null;
const getStore = (cleanupInterval) => {
  if (!globalStore) {
    globalStore = new MemoryStore(cleanupInterval);
  }
  return globalStore;
};

// ─────────────────────────────────────────────
// Key Generators
// ─────────────────────────────────────────────

/**
 * Generate a rate-limit key based on the request.
 * Prefers userId (authenticated) → falls back to IP.
 *
 * @param {import('express').Request} req
 * @param {string} [prefix] – Optional prefix for endpoint-specific limits.
 * @returns {string}
 */
const defaultKeyGenerator = (req, prefix = 'global') => {
  if (req.user && req.user.userId) {
    return `rl:${prefix}:user:${req.user.userId}`;
  }

  // X-Forwarded-For may contain a comma-separated list
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown';

  return `rl:${prefix}:ip:${ip}`;
};

// ─────────────────────────────────────────────
// Middleware Factory
// ─────────────────────────────────────────────

/**
 * Create a rate-limiter middleware instance.
 *
 * @param {Object}   [opts]
 * @param {number}   [opts.maxRequests=100]  – Max hits per window.
 * @param {number}   [opts.windowMs=60000]   – Window in ms.
 * @param {string}   [opts.message]          – Error message.
 * @param {boolean}  [opts.headers=true]     – Send X-RateLimit-* headers.
 * @param {Function} [opts.keyGenerator]     – Custom key generator.
 * @param {string[]} [opts.skipRoles]        – Roles that bypass the limiter.
 * @param {boolean}  [opts.skipInTest=true]  – Disable in NODE_ENV=test.
 * @returns {Function} Express middleware
 *
 * @example
 *   // Global: 100 req / min
 *   app.use(rateLimiter());
 *
 *   // Strict: 5 login attempts / 15 min
 *   router.post('/auth/login', rateLimiter({
 *     maxRequests: 5,
 *     windowMs: 15 * 60 * 1000,
 *     message: 'Too many login attempts. Try again in 15 minutes.',
 *   }), authController.login);
 */
const rateLimiter = (opts = {}) => {
  const config = { ...DEFAULTS, ...opts };
  const store = getStore(config.cleanupInterval);
  const keyGen = config.keyGenerator || defaultKeyGenerator;
  const prefix = config.prefix || 'global';

  return (req, res, next) => {
    // Skip in test
    if (config.skipInTest && process.env.NODE_ENV === 'test') {
      return next();
    }

    // Skip whitelisted roles
    if (req.user && config.skipRoles.includes(req.user.role)) {
      return next();
    }

    const key = keyGen(req, prefix);
    const { count, resetTime } = store.increment(key, config.windowMs);
    const remaining = Math.max(config.maxRequests - count, 0);
    const retryAfterSec = Math.ceil((resetTime - Date.now()) / 1000);

    // Always set headers (helps clients self-throttle)
    if (config.headers) {
      res.set({
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
      });
    }

    if (count > config.maxRequests) {
      res.set('Retry-After', String(retryAfterSec));

      logger.warn('Rate limit exceeded', {
        key,
        count,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        userId: req.user?.userId || null,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      const response = tooManyRequests(config.message);
      return res.status(response.statusCode).json(response.body);
    }

    return next();
  };
};

// ─────────────────────────────────────────────
// Pre-configured limiters for common endpoints
// ─────────────────────────────────────────────

/** General API limiter – 100 req / min */
const apiLimiter = rateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
  prefix: 'api',
});

/** Auth endpoints – 10 req / 15 min per IP (brute-force protection) */
const authLimiter = rateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  prefix: 'auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/** Strict login limiter – 5 attempts / 15 min */
const loginLimiter = rateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
  prefix: 'login',
  message:
    'Too many login attempts. Your account may be temporarily locked. Try again in 15 minutes.',
});

/** Password reset limiter – 3 req / hour */
const passwordResetLimiter = rateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60 * 1000,
  prefix: 'pwd-reset',
  message: 'Too many password reset requests. Please try again in an hour.',
});

/** OTP / verification limiter – 5 req / 10 min */
const otpLimiter = rateLimiter({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  prefix: 'otp',
  message: 'Too many verification attempts. Please try again later.',
});

/** Booking creation limiter – 20 / min (prevent seat-hogging) */
const bookingLimiter = rateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
  prefix: 'booking',
  message: 'Too many booking requests. Please slow down.',
});

/** SOS limiter – 5 / 10 min (prevent abuse) */
const sosLimiter = rateLimiter({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  prefix: 'sos',
  message:
    'Too many SOS alerts. If this is a real emergency, please call emergency services directly.',
});

/** Search limiter – 30 / min (heavier on the backend) */
const searchLimiter = rateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000,
  prefix: 'search',
  message: 'Too many search requests. Please try again shortly.',
});

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {
  // Factory
  rateLimiter,

  // Pre-configured
  apiLimiter,
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
  otpLimiter,
  bookingLimiter,
  sosLimiter,
  searchLimiter,

  // Internals (for testing / advanced use)
  MemoryStore,
  defaultKeyGenerator,
  getStore,
};
