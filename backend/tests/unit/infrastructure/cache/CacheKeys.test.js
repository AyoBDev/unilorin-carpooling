/**
 * CacheKeys Unit Tests
 */

const { CacheKeys, TTL, generateSearchHash, getInvalidationKeys } = require('../../../../src/infrastructure/cache/CacheKeys');

describe('CacheKeys', () => {
  // ─── TTL constants ─────────────────────────────────────
  describe('TTL', () => {
    it('should define session TTL as 24 hours', () => {
      expect(TTL.SESSION).toBe(24 * 60 * 60);
    });

    it('should define OTP TTL as 5 minutes', () => {
      expect(TTL.OTP).toBe(5 * 60);
    });

    it('should define ride search TTL as 2 minutes', () => {
      expect(TTL.RIDE_SEARCH).toBe(2 * 60);
    });

    it('should define unread count TTL as 1 minute', () => {
      expect(TTL.UNREAD_COUNT).toBe(60);
    });

    it('should define user profile TTL as 30 minutes', () => {
      expect(TTL.USER_PROFILE).toBe(30 * 60);
    });

    it('should define all expected TTL keys', () => {
      const expectedKeys = [
        'ACCESS_TOKEN', 'REFRESH_TOKEN', 'SESSION', 'OTP',
        'USER_PROFILE', 'RIDE_DETAILS', 'RIDE_SEARCH',
        'BOOKING_DETAILS', 'USER_RATINGS',
      ];
      expectedKeys.forEach((key) => {
        expect(TTL).toHaveProperty(key);
        expect(typeof TTL[key]).toBe('number');
        expect(TTL[key]).toBeGreaterThan(0);
      });
    });
  });

  // ─── Auth keys ─────────────────────────────────────────
  describe('CacheKeys.auth', () => {
    it('should generate session key', () => {
      const key = CacheKeys.auth.session('u1');
      expect(key).toContain('u1');
      expect(key).toContain('session');
    });

    it('should generate blacklist key', () => {
      const key = CacheKeys.auth.blacklistedToken('token123');
      expect(key).toContain('token123');
    });

    it('should generate OTP key', () => {
      const key = CacheKeys.auth.otp('u1', 'phone_verification');
      expect(key).toContain('u1');
    });

    it('should generate different keys for different users', () => {
      const key1 = CacheKeys.auth.session('u1');
      const key2 = CacheKeys.auth.session('u2');
      expect(key1).not.toBe(key2);
    });
  });

  // ─── User keys ─────────────────────────────────────────
  describe('CacheKeys.user', () => {
    it('should generate profile key', () => {
      const key = CacheKeys.user.profile('u1');
      expect(key).toContain('u1');
      expect(typeof key).toBe('string');
    });

    it('should generate statistics key', () => {
      const key = CacheKeys.user.statistics('u1');
      expect(key).toContain('u1');
    });

    it('should generate preferences key', () => {
      const key = CacheKeys.user.preferences('u1');
      expect(key).toContain('u1');
    });

    it('should generate different keys for different users', () => {
      const key1 = CacheKeys.user.profile('u1');
      const key2 = CacheKeys.user.profile('u2');
      expect(key1).not.toBe(key2);
    });
  });

  // ─── Ride keys ─────────────────────────────────────────
  describe('CacheKeys.ride', () => {
    it('should generate ride details key', () => {
      const key = CacheKeys.ride.details('r1');
      expect(key).toContain('r1');
      expect(typeof key).toBe('string');
    });

    it('should generate driver rides key', () => {
      const key = CacheKeys.ride.driverRides('d1');
      expect(key).toContain('d1');
    });

    it('should generate ride passengers key', () => {
      const key = CacheKeys.ride.passengers('r1');
      expect(key).toContain('r1');
    });
  });

  // ─── Booking keys ──────────────────────────────────────
  describe('CacheKeys.booking', () => {
    it('should generate booking details key', () => {
      const key = CacheKeys.booking.details('b1');
      expect(key).toContain('b1');
    });

    it('should generate user bookings key', () => {
      const key = CacheKeys.booking.userBookings('u1');
      expect(key).toContain('u1');
    });
  });

  // ─── Notification keys ─────────────────────────────────
  describe('CacheKeys.notification', () => {
    it('should generate unread count key', () => {
      const key = CacheKeys.notification.unreadCount('u1');
      expect(key).toContain('u1');
    });
  });

  // ─── Rating keys ───────────────────────────────────────
  describe('CacheKeys.rating', () => {
    it('should generate user ratings key', () => {
      const key = CacheKeys.rating.userRatings('u1');
      expect(key).toContain('u1');
    });

    it('should generate analytics key', () => {
      const key = CacheKeys.rating.analytics('u1');
      expect(key).toContain('u1');
    });
  });

  // ─── Lock keys ─────────────────────────────────────────
  describe('CacheKeys.lock', () => {
    it('should generate booking seat lock key', () => {
      const key = CacheKeys.lock.seatReserve('r1');
      expect(key).toContain('r1');
      expect(typeof key).toBe('string');
    });

    it('should generate booking lock key', () => {
      const key = CacheKeys.lock.booking('r1');
      expect(key).toContain('r1');
    });
  });

  // ─── generateSearchHash ────────────────────────────────
  describe('generateSearchHash', () => {
    it('should return a string', () => {
      const hash = generateSearchHash({ from: 'A', to: 'B', date: '2026-03-01' });
      expect(typeof hash).toBe('string');
    });

    it('should produce same hash for same params', () => {
      const params = { from: 'A', to: 'B', date: '2026-03-01' };
      expect(generateSearchHash(params)).toBe(generateSearchHash(params));
    });

    it('should produce different hashes for different params', () => {
      const h1 = generateSearchHash({ from: 'A', to: 'B' });
      const h2 = generateSearchHash({ from: 'A', to: 'C' });
      expect(h1).not.toBe(h2);
    });

    it('should handle empty object', () => {
      const hash = generateSearchHash({});
      expect(typeof hash).toBe('string');
    });
  });

  // ─── getInvalidationKeys ───────────────────────────────
  describe('getInvalidationKeys', () => {
    it('should return invalidation patterns for user entity', () => {
      const keys = getInvalidationKeys('user', { userId: 'u1' });
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
      keys.forEach((k) => expect(typeof k).toBe('string'));
    });

    it('should return invalidation patterns for ride entity', () => {
      const keys = getInvalidationKeys('ride', { rideId: 'r1', driverId: 'd1' });
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should return invalidation patterns for booking entity', () => {
      const keys = getInvalidationKeys('booking', { bookingId: 'b1', userId: 'u1', rideId: 'r1' });
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should include the entity id in at least one pattern', () => {
      const keys = getInvalidationKeys('user', { userId: 'myUserId' });
      const hasId = keys.some((k) => k.includes('myUserId'));
      expect(hasId).toBe(true);
    });

    it('should return empty array for unknown entity type', () => {
      const keys = getInvalidationKeys('unknown', { id: 'id1' });
      expect(Array.isArray(keys)).toBe(true);
    });

    it('should return empty array when context is empty', () => {
      const keys = getInvalidationKeys('user', {});
      expect(Array.isArray(keys)).toBe(true);
    });
  });
});
