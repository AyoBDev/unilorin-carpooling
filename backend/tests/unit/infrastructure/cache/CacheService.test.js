/**
 * CacheService Unit Tests
 *
 * Tests the CacheService with a mocked Redis client.
 * All Redis calls are mocked so no actual Redis connection is needed.
 */

// Mock the RedisClient module before importing CacheService
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  scan: jest.fn(),
  hget: jest.fn(),
  hset: jest.fn(),
  hdel: jest.fn(),
  hgetall: jest.fn(),
  incr: jest.fn(),
  incrby: jest.fn(),
  lpush: jest.fn(),
  lrange: jest.fn(),
  sadd: jest.fn(),
  smembers: jest.fn(),
  sismember: jest.fn(),
  zadd: jest.fn(),
  zrange: jest.fn(),
  zrangebyscore: jest.fn(),
  zrem: jest.fn(),
  zcard: jest.fn(),
  eval: jest.fn(),
  pipeline: jest.fn(),
  publish: jest.fn(),
};

jest.mock('../../../../src/infrastructure/cache/RedisClient', () => ({
  getClient: jest.fn().mockResolvedValue(mockRedisClient),
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  isConnected: jest.fn().mockReturnValue(true),
  healthCheck: jest.fn().mockResolvedValue({ connected: true, latency: 5 }),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Force CACHE_ENABLED=true for these tests
process.env.CACHE_ENABLED = 'true';

// CacheService exports a singleton instance
const cache = require('../../../../src/infrastructure/cache/CacheService');

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-enable cache for each test (may be mutated by disabled tests)
    cache.enabled = true;
  });

  // ─── get ───────────────────────────────────────────────
  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ name: 'Alice' }));

      const result = await cache.get('test:key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test:key');
      expect(result).toEqual({ name: 'Alice' });
    });

    it('should return null when key does not exist', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cache.get('missing:key');

      expect(result).toBeNull();
    });

    it('should return null and not throw when Redis fails', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis down'));

      const result = await cache.get('test:key');

      expect(result).toBeNull();
    });

    it('should return null when cache is disabled', async () => {
      cache.enabled = false;

      const result = await cache.get('test:key');

      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // ─── set ───────────────────────────────────────────────
  describe('set', () => {
    it('should call setex when TTL is provided', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await cache.set('test:key', { name: 'Alice' }, 300);

      expect(mockRedisClient.setex).toHaveBeenCalledWith('test:key', 300, JSON.stringify({ name: 'Alice' }));
      expect(result).toBe(true);
    });

    it('should call setex with default TTL when no TTL provided', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await cache.set('test:key', 'value');

      expect(mockRedisClient.setex).toHaveBeenCalledWith('test:key', expect.any(Number), '"value"');
      expect(result).toBe(true);
    });

    it('should call setex with default TTL when TTL is 0 (falsy falls back to default)', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await cache.set('test:key', 'value', 0);

      // TTL of 0 is falsy so `expiry = 0 || defaultTTL` → uses defaultTTL
      expect(mockRedisClient.setex).toHaveBeenCalledWith('test:key', expect.any(Number), '"value"');
      expect(result).toBe(true);
    });

    it('should return false and not throw when Redis fails', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis down'));

      const result = await cache.set('test:key', 'value', 300);

      expect(result).toBe(false);
    });

    it('should return false when cache is disabled', async () => {
      cache.enabled = false;

      const result = await cache.set('test:key', 'value', 300);

      expect(mockRedisClient.setex).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  // ─── del ───────────────────────────────────────────────
  describe('del', () => {
    it('should delete a key and return true', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cache.del('test:key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test:key');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.del.mockResolvedValue(0);

      const result = await cache.del('missing:key');

      expect(result).toBe(false);
    });

    it('should return false and not throw when Redis fails', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis down'));

      const result = await cache.del('test:key');

      expect(result).toBe(false);
    });
  });

  // ─── getOrSet ──────────────────────────────────────────
  describe('getOrSet', () => {
    it('should return cached value without calling fetcher', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ cached: true }));
      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const result = await cache.getOrSet('test:key', fetcher, 300);

      expect(result).toEqual({ cached: true });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should call fetcher on cache miss and cache the result', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const result = await cache.getOrSet('test:key', fetcher, 300);

      expect(fetcher).toHaveBeenCalled();
      expect(result).toEqual({ fresh: true });
      expect(mockRedisClient.setex).toHaveBeenCalledWith('test:key', 300, JSON.stringify({ fresh: true }));
    });

    it('should return fetcher result even if cache set fails', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockRejectedValue(new Error('Redis down'));
      const fetcher = jest.fn().mockResolvedValue({ fresh: true });

      const result = await cache.getOrSet('test:key', fetcher, 300);

      expect(result).toEqual({ fresh: true });
    });
  });

  // ─── exists ────────────────────────────────────────────
  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await cache.exists('test:key');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await cache.exists('missing:key');

      expect(result).toBe(false);
    });

    it('should return false when Redis fails', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Redis down'));

      const result = await cache.exists('test:key');

      expect(result).toBe(false);
    });
  });

  // ─── session management ────────────────────────────────
  describe('setSession / getSession / destroySession', () => {
    it('should set a session', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await cache.setSession('sess1', { userId: 'u1' }, 3600);

      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should get a session', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ userId: 'u1' }));

      const session = await cache.getSession('sess1');

      expect(session).toEqual({ userId: 'u1' });
    });

    it('should destroy a session', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await cache.destroySession('sess1');

      expect(result).toBe(true);
    });
  });

  // ─── token blacklisting ────────────────────────────────
  describe('blacklistToken / isTokenBlacklisted', () => {
    it('should blacklist a token', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await cache.blacklistToken('jwt.token.here', 3600);

      expect(result).toBe(true);
    });

    it('should return true for blacklisted token', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const isBlacklisted = await cache.isTokenBlacklisted('jwt.token.here');

      expect(isBlacklisted).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const isBlacklisted = await cache.isTokenBlacklisted('valid.token');

      expect(isBlacklisted).toBe(false);
    });
  });

  // ─── rate limiting ─────────────────────────────────────
  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      // pipeline().exec() returns [[err, result], ...] for each command
      // zremrangebyscore=0, zcard=3, zadd=1, expire=1
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 0], [null, 3], [null, 1], [null, 1]]),
      };
      mockRedisClient.pipeline.mockReturnValue(mockPipeline);
      mockRedisClient.zrange.mockResolvedValue([]);

      const result = await cache.checkRateLimit('rl:ip:1.2.3.4', 100, 60);

      expect(result).toEqual(expect.objectContaining({
        allowed: true,
      }));
    });

    it('should block request when over limit', async () => {
      // zcard returns 101 (over limit of 100)
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([[null, 0], [null, 101], [null, 1], [null, 1]]),
      };
      mockRedisClient.pipeline.mockReturnValue(mockPipeline);
      mockRedisClient.zrange.mockResolvedValue(['key', String(Date.now() - 1000)]);

      const result = await cache.checkRateLimit('rl:ip:1.2.3.4', 100, 60);

      expect(result).toEqual(expect.objectContaining({
        allowed: false,
      }));
    });

    it('should allow request when Redis fails (fail open)', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis down')),
      };
      mockRedisClient.pipeline.mockReturnValue(mockPipeline);

      const result = await cache.checkRateLimit('rl:ip:1.2.3.4', 100, 60);

      expect(result.allowed).toBe(true);
    });

    it('should return allowed=true when cache is disabled', async () => {
      cache.enabled = false;

      const result = await cache.checkRateLimit('rl:key', 100, 60);

      expect(result.allowed).toBe(true);
    });
  });

  // ─── increment ─────────────────────────────────────────
  describe('increment', () => {
    it('should increment a counter and return new value', async () => {
      mockRedisClient.incrby.mockResolvedValue(5);

      const result = await cache.increment('counter:key', 1);

      expect(typeof result).toBe('number');
    });

    it('should return 0 when Redis fails', async () => {
      mockRedisClient.incrby.mockRejectedValue(new Error('Redis down'));

      const result = await cache.increment('counter:key', 1);

      expect(result).toBe(0);
    });
  });
});
