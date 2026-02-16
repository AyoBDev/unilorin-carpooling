/**
 * Cache Service
 * University of Ilorin Carpooling Platform
 *
 * Path: src/infrastructure/cache/CacheService.js
 *
 * High-level caching abstraction over Redis. Provides:
 * - Cache-aside pattern (read-through / write-through)
 * - Distributed locking for concurrency control
 * - Rate limiting (sliding window)
 * - Pub/Sub for real-time events
 * - Batch operations
 * - Cache invalidation helpers
 * - Session management
 * - Counter/increment operations
 *
 * All methods are safe to call even when Redis is unavailable —
 * they degrade gracefully and log warnings instead of throwing.
 */

const redisClient = require('./RedisClient');
const { TTL, CacheKeys, generateSearchHash, getInvalidationKeys } = require('./CacheKeys');
const { logger } = require('../../shared/utils/logger');
const ConflictError = require('../../shared/errors/ConflictError');

// ============================================================
// Cache Service
// ============================================================

class CacheService {
  constructor() {
    this.defaultTTL = TTL.USER_PROFILE; // 30 minutes
    this.enabled = process.env.CACHE_ENABLED !== 'false';
  }

  // ============================================================
  // Core CRUD Operations
  // ============================================================

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<*>} Parsed value or null
   */
  async get(key) {
    if (!this.enabled) return null;

    try {
      const client = await redisClient.getClient();
      const data = await client.get(key);

      if (data === null) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.warn('Cache GET failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache (will be JSON-serialized)
   * @param {number} [ttl] - TTL in seconds (default: 30 minutes)
   * @returns {Promise<boolean>} Success flag
   */
  async set(key, value, ttl) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      if (expiry > 0) {
        await client.setex(key, expiry, serialized);
      } else {
        await client.set(key, serialized);
      }

      return true;
    } catch (error) {
      logger.warn('Cache SET failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Whether the key was deleted
   */
  async del(key) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      logger.warn('Cache DEL failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<number>} Number of keys deleted
   */
  async delMany(keys) {
    if (!this.enabled || !keys.length) return 0;

    try {
      const client = await redisClient.getClient();
      const pipeline = client.pipeline();
      keys.forEach((key) => pipeline.del(key));
      const results = await pipeline.exec();
      return results.filter(([err, res]) => !err && res > 0).length;
    } catch (error) {
      logger.warn('Cache DEL_MANY failed', { keyCount: keys.length, error: error.message });
      return 0;
    }
  }

  /**
   * Check if a key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.warn('Cache EXISTS failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Set TTL on an existing key
   * @param {string} key - Cache key
   * @param {number} ttl - TTL in seconds
   * @returns {Promise<boolean>}
   */
  async expire(key, ttl) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.warn('Cache EXPIRE failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key) {
    if (!this.enabled) return -2;

    try {
      const client = await redisClient.getClient();
      return await client.ttl(key);
    } catch (error) {
      logger.warn('Cache TTL failed', { key, error: error.message });
      return -2;
    }
  }

  // ============================================================
  // Cache-Aside Pattern (Read-Through)
  // ============================================================

  /**
   * Get from cache or fetch from source and cache the result.
   * This is the primary pattern for all read operations.
   *
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data if cache misses
   * @param {number} [ttl] - TTL in seconds
   * @returns {Promise<*>} Cached or freshly fetched data
   *
   * @example
   * const user = await cacheService.getOrSet(
   *   CacheKeys.user.profile(userId),
   *   () => userRepository.findById(userId),
   *   TTL.USER_PROFILE
   * );
   */
  async getOrSet(key, fetchFn, ttl) {
    // Try cache first
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss — fetch from source
    try {
      const data = await fetchFn();

      if (data !== null && data !== undefined) {
        // Cache the result (fire and forget)
        this.set(key, data, ttl).catch(() => {});
      }

      return data;
    } catch (error) {
      logger.error('Cache getOrSet fetch failed', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate cache after a write operation.
   * Deletes all related cache keys for the given entity.
   *
   * @param {string} entity - Entity type (user, ride, booking, rating, notification)
   * @param {Object} context - Context with relevant IDs
   * @returns {Promise<number>} Number of keys invalidated
   *
   * @example
   * await cacheService.invalidate('booking', {
   *   bookingId: 'bk_123',
   *   userId: 'usr_456',
   *   driverId: 'usr_789',
   *   rideId: 'ride_012'
   * });
   */
  async invalidate(entity, context) {
    const keys = getInvalidationKeys(entity, context);
    if (!keys.length) return 0;

    const deleted = await this.delMany(keys);

    logger.debug('Cache invalidated', {
      entity,
      keysTargeted: keys.length,
      keysDeleted: deleted,
    });

    return deleted;
  }

  /**
   * Invalidate all keys matching a pattern (use sparingly).
   * @param {string} pattern - Redis glob pattern (e.g., "uil:carpool:ride:*")
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidatePattern(pattern) {
    if (!this.enabled) return 0;

    try {
      const client = await redisClient.getClient();
      let cursor = '0';
      const allKeys = [];

      do {
        // eslint-disable-next-line no-await-in-loop
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          allKeys.push(...keys);
        }
      } while (cursor !== '0');

      if (allKeys.length > 0) {
        const pipeline = client.pipeline();
        allKeys.forEach((key) => pipeline.del(key));
        await pipeline.exec();
      }

      logger.debug('Cache pattern invalidated', { pattern, keysDeleted: allKeys.length });
      return allKeys.length;
    } catch (error) {
      logger.warn('Cache pattern invalidation failed', { pattern, error: error.message });
      return 0;
    }
  }

  // ============================================================
  // Hash Operations (for structured data)
  // ============================================================

  /**
   * Set a hash field
   */
  async hset(key, field, value, ttl) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      await client.hset(key, field, JSON.stringify(value));
      if (ttl) await client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.warn('Cache HSET failed', { key, field, error: error.message });
      return false;
    }
  }

  /**
   * Set multiple hash fields at once
   */
  async hmset(key, data, ttl) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const serialized = Object.entries(data).reduce((acc, [field, value]) => {
        acc[field] = JSON.stringify(value);
        return acc;
      }, {});
      await client.hmset(key, serialized);
      if (ttl) await client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.warn('Cache HMSET failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get a hash field
   */
  async hget(key, field) {
    if (!this.enabled) return null;

    try {
      const client = await redisClient.getClient();
      const data = await client.hget(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Cache HGET failed', { key, field, error: error.message });
      return null;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall(key) {
    if (!this.enabled) return null;

    try {
      const client = await redisClient.getClient();
      const data = await client.hgetall(key);
      if (!data || Object.keys(data).length === 0) return null;

      const parsed = Object.entries(data).reduce((acc, [field, value]) => {
        try {
          acc[field] = JSON.parse(value);
        } catch {
          acc[field] = value;
        }
        return acc;
      }, {});
      return parsed;
    } catch (error) {
      logger.warn('Cache HGETALL failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Delete a hash field
   */
  async hdel(key, ...fields) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      await client.hdel(key, ...fields);
      return true;
    } catch (error) {
      logger.warn('Cache HDEL failed', { key, error: error.message });
      return false;
    }
  }

  // ============================================================
  // Distributed Locking
  // ============================================================

  /**
   * Acquire a distributed lock using SET NX EX.
   * Prevents race conditions for critical sections like booking creation.
   *
   * @param {string} key - Lock key
   * @param {number} [ttlSeconds=30] - Lock expiry in seconds
   * @param {string} [lockValue] - Unique lock value for safe release
   * @returns {Promise<string|null>} Lock value if acquired, null if not
   *
   * @example
   * const lock = await cacheService.acquireLock(
   *   CacheKeys.lock.seatReserve(rideId),
   *   TTL.LOCK_SEAT_RESERVE
   * );
   * if (!lock) throw new ConflictError('Another booking in progress');
   * try {
   *   // ... critical section
   * } finally {
   *   await cacheService.releaseLock(CacheKeys.lock.seatReserve(rideId), lock);
   * }
   */
  async acquireLock(key, lockValue, ttlSeconds = 30) {
    if (!this.enabled) return 'no-cache-lock';

    try {
      const client = await redisClient.getClient();
      const value = lockValue || `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');

      if (result === 'OK') {
        logger.debug('Lock acquired', { key, ttlSeconds });
        return value;
      }

      logger.debug('Lock not acquired (already held)', { key });
      return null;
    } catch (error) {
      logger.warn('Lock acquire failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * Release a distributed lock (only if we own it).
   * Uses a Lua script for atomic check-and-delete.
   *
   * @param {string} key - Lock key
   * @param {string} lockValue - The value returned by acquireLock
   * @returns {Promise<boolean>} Whether the lock was released
   */
  async releaseLock(key, lockValue) {
    if (!this.enabled || lockValue === 'no-cache-lock') return true;

    try {
      const client = await redisClient.getClient();

      // Lua script: only delete if the value matches (safe release)
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await client.eval(script, 1, key, lockValue);
      const released = result === 1;

      if (released) {
        logger.debug('Lock released', { key });
      } else {
        logger.warn('Lock release failed (not owner or expired)', { key });
      }

      return released;
    } catch (error) {
      logger.warn('Lock release error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Execute a function with a distributed lock.
   * Acquires lock, runs the function, then releases the lock.
   *
   * @param {string} key - Lock key
   * @param {Function} fn - Async function to execute
   * @param {number} [ttlSeconds=30] - Lock TTL
   * @returns {Promise<*>} Result of the function
   */
  async withLock(key, fn, ttlSeconds = 30) {
    const lockValue = await this.acquireLock(key, undefined, ttlSeconds);

    if (!lockValue) {
      throw new ConflictError('Resource is locked. Please try again shortly.');
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(key, lockValue);
    }
  }

  // ============================================================
  // Rate Limiting (Sliding Window Counter)
  // ============================================================

  /**
   * Check and increment rate limit counter.
   * Uses a sliding window approach with sorted sets.
   *
   * @param {string} key - Rate limit key
   * @param {number} maxRequests - Maximum allowed requests in the window
   * @param {number} windowSeconds - Time window in seconds
   * @returns {Promise<Object>} { allowed, remaining, retryAfter, total }
   *
   * @example
   * const result = await cacheService.checkRateLimit(
   *   CacheKeys.rateLimit.login(userEmail),
   *   5,   // max 5 attempts
   *   900  // per 15 minutes
   * );
   * if (!result.allowed) {
   *   throw new TooManyRequestsError(result.retryAfter);
   * }
   */
  async checkRateLimit(key, maxRequests, windowSeconds) {
    if (!this.enabled) {
      return { allowed: true, remaining: maxRequests, retryAfter: 0, total: 0 };
    }

    try {
      const client = await redisClient.getClient();
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;

      // Use a pipeline for atomicity
      const pipeline = client.pipeline();
      // Remove expired entries
      pipeline.zremrangebyscore(key, 0, windowStart);
      // Count current entries
      pipeline.zcard(key);
      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random().toString(36).substring(2, 8)}`);
      // Set expiry on the sorted set
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();

      const currentCount = results[1][1]; // zcard result
      const allowed = currentCount < maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0));

      // Calculate retry-after if limited
      let retryAfter = 0;
      if (!allowed) {
        // Get the oldest entry to calculate when it expires
        const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
        if (oldest.length >= 2) {
          const oldestTimestamp = parseInt(oldest[1], 10);
          retryAfter = Math.ceil((oldestTimestamp + windowSeconds * 1000 - now) / 1000);
        }
      }

      return {
        allowed,
        remaining,
        retryAfter: Math.max(0, retryAfter),
        total: currentCount + (allowed ? 1 : 0),
        limit: maxRequests,
        window: windowSeconds,
      };
    } catch (error) {
      logger.warn('Rate limit check failed, allowing request', { key, error: error.message });
      return { allowed: true, remaining: maxRequests, retryAfter: 0, total: 0 };
    }
  }

  /**
   * Reset rate limit counter for a key
   * @param {string} key - Rate limit key
   * @returns {Promise<boolean>}
   */
  async resetRateLimit(key) {
    return this.del(key);
  }

  // ============================================================
  // Counter Operations
  // ============================================================

  /**
   * Increment a counter
   * @param {string} key - Counter key
   * @param {number} [ttl] - TTL in seconds
   * @param {number} [amount=1] - Increment amount
   * @returns {Promise<number>} New counter value
   */
  async increment(key, ttl, amount = 1) {
    if (!this.enabled) return 0;

    try {
      const client = await redisClient.getClient();
      const result = await client.incrby(key, amount);

      // Set TTL only on first increment (when result equals amount)
      if (ttl && result === amount) {
        await client.expire(key, ttl);
      }

      return result;
    } catch (error) {
      logger.warn('Cache INCREMENT failed', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Decrement a counter (minimum 0)
   * @param {string} key - Counter key
   * @param {number} [amount=1] - Decrement amount
   * @returns {Promise<number>} New counter value
   */
  async decrement(key, amount = 1) {
    if (!this.enabled) return 0;

    try {
      const client = await redisClient.getClient();
      const result = await client.decrby(key, amount);

      // Ensure counter doesn't go below 0
      if (result < 0) {
        await client.set(key, 0);
        return 0;
      }

      return result;
    } catch (error) {
      logger.warn('Cache DECREMENT failed', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Get counter value
   * @param {string} key - Counter key
   * @returns {Promise<number>} Current value
   */
  async getCounter(key) {
    if (!this.enabled) return 0;

    try {
      const client = await redisClient.getClient();
      const value = await client.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.warn('Cache GET_COUNTER failed', { key, error: error.message });
      return 0;
    }
  }

  // ============================================================
  // Session Management
  // ============================================================

  /**
   * Store user session data
   * @param {string} userId - User ID
   * @param {Object} sessionData - Session data
   * @param {number} [ttl] - TTL (default: 24h)
   * @returns {Promise<boolean>}
   */
  async setSession(userId, sessionData, ttl = TTL.SESSION) {
    const key = CacheKeys.auth.session(userId);
    return this.set(
      key,
      {
        ...sessionData,
        lastActivity: new Date().toISOString(),
      },
      ttl,
    );
  }

  /**
   * Get user session data
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async getSession(userId) {
    const key = CacheKeys.auth.session(userId);
    return this.get(key);
  }

  /**
   * Update session last activity timestamp
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async touchSession(userId) {
    const key = CacheKeys.auth.session(userId);
    const session = await this.get(key);

    if (!session) return false;

    session.lastActivity = new Date().toISOString();
    return this.set(key, session, TTL.SESSION);
  }

  /**
   * Destroy user session
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async destroySession(userId) {
    const key = CacheKeys.auth.session(userId);
    return this.del(key);
  }

  /**
   * Blacklist a JWT token (e.g., on logout)
   * @param {string} tokenId - Token ID (jti claim)
   * @param {number} [ttl] - TTL (default: match access token TTL)
   * @returns {Promise<boolean>}
   */
  async blacklistToken(tokenId, ttl = TTL.BLACKLISTED_TOKEN) {
    const key = CacheKeys.auth.blacklistedToken(tokenId);
    return this.set(key, { blacklistedAt: new Date().toISOString() }, ttl);
  }

  /**
   * Check if a JWT token is blacklisted
   * @param {string} tokenId - Token ID (jti claim)
   * @returns {Promise<boolean>}
   */
  async isTokenBlacklisted(tokenId) {
    const key = CacheKeys.auth.blacklistedToken(tokenId);
    return this.exists(key);
  }

  // ============================================================
  // Batch Operations
  // ============================================================

  /**
   * Get multiple keys at once using pipeline
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<Object>} Map of key -> parsed value
   */
  async getMany(keys) {
    if (!this.enabled || !keys.length) return {};

    try {
      const client = await redisClient.getClient();
      const pipeline = client.pipeline();
      keys.forEach((key) => pipeline.get(key));
      const results = await pipeline.exec();

      const map = {};
      keys.forEach((key, index) => {
        const [err, data] = results[index];
        if (!err && data) {
          try {
            map[key] = JSON.parse(data);
          } catch {
            map[key] = data;
          }
        }
      });

      return map;
    } catch (error) {
      logger.warn('Cache GET_MANY failed', { keyCount: keys.length, error: error.message });
      return {};
    }
  }

  /**
   * Set multiple keys at once using pipeline
   * @param {Array<{key: string, value: *, ttl?: number}>} entries
   * @returns {Promise<boolean>}
   */
  async setMany(entries) {
    if (!this.enabled || !entries.length) return false;

    try {
      const client = await redisClient.getClient();
      const pipeline = client.pipeline();

      entries.forEach(({ key, value, ttl }) => {
        const serialized = JSON.stringify(value);
        const expiry = ttl || this.defaultTTL;
        if (expiry > 0) {
          pipeline.setex(key, expiry, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      logger.warn('Cache SET_MANY failed', { count: entries.length, error: error.message });
      return false;
    }
  }

  // ============================================================
  // Pub/Sub (for real-time events)
  // ============================================================

  /**
   * Publish a message to a channel
   * @param {string} channel - Channel name
   * @param {*} message - Message payload
   * @returns {Promise<number>} Number of subscribers that received the message
   */
  async publish(channel, message) {
    if (!this.enabled) return 0;

    try {
      const client = await redisClient.getClient();
      const serialized = JSON.stringify(message);
      return await client.publish(channel, serialized);
    } catch (error) {
      logger.warn('Cache PUBLISH failed', { channel, error: error.message });
      return 0;
    }
  }

  /**
   * Subscribe to a channel
   * @param {string} channel - Channel name
   * @param {Function} handler - Message handler (receives parsed message)
   * @returns {Promise<void>}
   */
  async subscribe(channel, handler) {
    if (!this.enabled) return;

    try {
      const subscriber = await redisClient.getSubscriber();
      await subscriber.subscribe(channel);

      subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          try {
            const parsed = JSON.parse(message);
            handler(parsed);
          } catch {
            handler(message);
          }
        }
      });

      logger.info('Subscribed to channel', { channel });
    } catch (error) {
      logger.warn('Cache SUBSCRIBE failed', { channel, error: error.message });
    }
  }

  /**
   * Unsubscribe from a channel
   * @param {string} channel - Channel name
   */
  async unsubscribe(channel) {
    if (!this.enabled) return;

    try {
      const subscriber = await redisClient.getSubscriber();
      await subscriber.unsubscribe(channel);
      logger.info('Unsubscribed from channel', { channel });
    } catch (error) {
      logger.warn('Cache UNSUBSCRIBE failed', { channel, error: error.message });
    }
  }

  // ============================================================
  // List Operations (for queues, recent items)
  // ============================================================

  /**
   * Push to the left of a list (most recent first)
   * @param {string} key - List key
   * @param {*} value - Value
   * @param {number} [maxLength] - Trim list to this length
   * @param {number} [ttl] - TTL in seconds
   * @returns {Promise<boolean>}
   */
  async lpush(key, value, maxLength, ttl) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const pipeline = client.pipeline();
      pipeline.lpush(key, JSON.stringify(value));
      if (maxLength) {
        pipeline.ltrim(key, 0, maxLength - 1);
      }
      if (ttl) {
        pipeline.expire(key, ttl);
      }
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.warn('Cache LPUSH failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get a range of items from a list
   * @param {string} key - List key
   * @param {number} [start=0] - Start index
   * @param {number} [end=-1] - End index (-1 for all)
   * @returns {Promise<Array>}
   */
  async lrange(key, start = 0, end = -1) {
    if (!this.enabled) return [];

    try {
      const client = await redisClient.getClient();
      const items = await client.lrange(key, start, end);
      return items.map((item) => {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      });
    } catch (error) {
      logger.warn('Cache LRANGE failed', { key, error: error.message });
      return [];
    }
  }

  // ============================================================
  // Set Operations (for unique collections)
  // ============================================================

  /**
   * Add member to a set
   */
  async sadd(key, member, ttl) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      await client.sadd(key, typeof member === 'object' ? JSON.stringify(member) : member);
      if (ttl) await client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.warn('Cache SADD failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key, member) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      const result = await client.sismember(
        key,
        typeof member === 'object' ? JSON.stringify(member) : member,
      );
      return result === 1;
    } catch (error) {
      logger.warn('Cache SISMEMBER failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Remove member from set
   */
  async srem(key, member) {
    if (!this.enabled) return false;

    try {
      const client = await redisClient.getClient();
      await client.srem(key, typeof member === 'object' ? JSON.stringify(member) : member);
      return true;
    } catch (error) {
      logger.warn('Cache SREM failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key) {
    if (!this.enabled) return [];

    try {
      const client = await redisClient.getClient();
      const members = await client.smembers(key);
      return members.map((m) => {
        try {
          return JSON.parse(m);
        } catch {
          return m;
        }
      });
    } catch (error) {
      logger.warn('Cache SMEMBERS failed', { key, error: error.message });
      return [];
    }
  }

  // ============================================================
  // Convenience: Domain-Specific Methods
  // ============================================================

  /**
   * Cache ride search results
   */
  async cacheSearchResults(searchParams, results) {
    const hash = generateSearchHash(searchParams);
    const key = CacheKeys.ride.search(hash);
    return this.set(key, results, TTL.RIDE_SEARCH);
  }

  /**
   * Get cached ride search results
   */
  async getCachedSearchResults(searchParams) {
    const hash = generateSearchHash(searchParams);
    const key = CacheKeys.ride.search(hash);
    return this.get(key);
  }

  /**
   * Track available seats for a ride (decrement on booking)
   */
  async updateAvailableSeats(rideId, seatChange) {
    const key = CacheKeys.ride.availableSeats(rideId);
    if (seatChange < 0) {
      return this.decrement(key, Math.abs(seatChange));
    }
    return this.increment(key, seatChange);
  }

  /**
   * Store live location data for real-time tracking
   */
  async updateLiveLocation(rideId, userId, locationData) {
    const key = CacheKeys.safety.liveLocation(rideId, userId);
    return this.set(
      key,
      {
        ...locationData,
        updatedAt: new Date().toISOString(),
      },
      TTL.LOCATION_DATA,
    );
  }

  /**
   * Get live location data
   */
  async getLiveLocation(rideId, userId) {
    const key = CacheKeys.safety.liveLocation(rideId, userId);
    return this.get(key);
  }

  // ============================================================
  // Cache Warming
  // ============================================================

  /**
   * Warm cache with frequently accessed data.
   * Call this on application startup or after a cache flush.
   * @param {Object} repositories - { userRepo, rideRepo, ... }
   */
  async warmCache(repositories = {}) {
    logger.info('Cache warming started');

    try {
      // Warm active rides for today
      if (repositories.rideRepo) {
        const today = new Date().toISOString().split('T')[0];
        const activeRides = await repositories.rideRepo.findByDate(today);
        if (activeRides && activeRides.length) {
          const entries = activeRides.map((ride) => ({
            key: CacheKeys.ride.details(ride.rideId),
            value: ride,
            ttl: TTL.RIDE_DETAILS,
          }));
          await this.setMany(entries);
          logger.info('Cache warmed: active rides', { count: activeRides.length });
        }
      }

      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed', { error: error.message });
    }
  }

  // ============================================================
  // Health & Status
  // ============================================================

  /**
   * Get cache health status
   */
  async getHealth() {
    return redisClient.healthCheck();
  }

  /**
   * Check if cache is available
   */
  isAvailable() {
    return this.enabled && redisClient.isReady;
  }
}

// ============================================================
// Singleton Export
// ============================================================

const cacheService = new CacheService();

module.exports = cacheService;
