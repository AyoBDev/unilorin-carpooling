const {
  now,
  format,
  toISO,
  toUnix,
  toTimestamp,
  compare,
  manipulate,
  duration,
  validate,
  display,
  ride,
  TIMEZONE,
  DEFAULT_DATETIME_FORMAT,
  MIN_BOOKING_ADVANCE_MINUTES,
  MAX_BOOKING_ADVANCE_DAYS,
} = require('../../../../src/shared/utils/dateTime');

describe('DateTime Utility', () => {
  describe('now()', () => {
    it('should return current time in Nigerian timezone', () => {
      const current = now();
      expect(current).toBeDefined();
      expect(current.isValid()).toBe(true);
    });

    it('should parse a date when provided', () => {
      const date = now('2024-06-15T10:00:00Z');
      expect(date.isValid()).toBe(true);
    });
  });

  describe('format()', () => {
    it('should format a date with default format', () => {
      const result = format('2024-06-15T10:00:00Z');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return null for null input', () => {
      expect(format(null)).toBeNull();
    });

    it('should use custom format', () => {
      const result = format('2024-06-15T10:00:00Z', 'YYYY-MM-DD');
      expect(result).toBe('2024-06-15');
    });
  });

  describe('toISO()', () => {
    it('should return ISO string for current time', () => {
      const result = toISO();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should convert given date to ISO', () => {
      const result = toISO('2024-06-15T10:00:00Z');
      expect(result).toContain('2024-06-15');
    });
  });

  describe('toUnix()', () => {
    it('should return unix timestamp in seconds', () => {
      const result = toUnix();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(1700000000);
    });
  });

  describe('toTimestamp()', () => {
    it('should return timestamp in milliseconds', () => {
      const result = toTimestamp();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(1700000000000);
    });
  });

  describe('compare', () => {
    const past = '2020-01-01T00:00:00Z';
    const future = '2030-01-01T00:00:00Z';

    it('isBefore', () => {
      expect(compare.isBefore(past, future)).toBe(true);
      expect(compare.isBefore(future, past)).toBe(false);
    });

    it('isAfter', () => {
      expect(compare.isAfter(future, past)).toBe(true);
      expect(compare.isAfter(past, future)).toBe(false);
    });

    it('isSame', () => {
      expect(compare.isSame('2024-06-15', '2024-06-15', 'day')).toBe(true);
    });

    it('isPast', () => {
      expect(compare.isPast(past)).toBe(true);
      expect(compare.isPast(future)).toBe(false);
    });

    it('isFuture', () => {
      expect(compare.isFuture(future)).toBe(true);
      expect(compare.isFuture(past)).toBe(false);
    });
  });

  describe('manipulate', () => {
    it('add should add time', () => {
      const base = '2024-06-15T10:00:00Z';
      const result = manipulate.add(base, 1, 'hour');
      expect(result.isValid()).toBe(true);
    });

    it('subtract should subtract time', () => {
      const base = '2024-06-15T10:00:00Z';
      const result = manipulate.subtract(base, 30, 'minute');
      expect(result.isValid()).toBe(true);
    });
  });

  describe('duration', () => {
    it('diff should calculate difference', () => {
      const start = '2024-06-15T10:00:00Z';
      const end = '2024-06-15T12:00:00Z';
      expect(duration.diff(start, end, 'hours')).toBe(2);
    });

    it('formatHM should format minutes as HH:mm', () => {
      expect(duration.formatHM(90)).toBe('01:30');
      expect(duration.formatHM(30)).toBe('00:30');
      expect(duration.formatHM(120)).toBe('02:00');
    });
  });

  describe('validate', () => {
    it('isValidDate should validate dates', () => {
      expect(validate.isValidDate('2024-06-15')).toBe(true);
      expect(validate.isValidDate('not-a-date')).toBe(false);
    });

    it('isValidTime should validate HH:mm format', () => {
      expect(validate.isValidTime('14:30')).toBe(true);
      expect(validate.isValidTime('25:00')).toBe(false);
      expect(validate.isValidTime('abc')).toBe(false);
    });

    it('isValidWaitTime should check range', () => {
      expect(validate.isValidWaitTime(5)).toBe(true);
      expect(validate.isValidWaitTime(15)).toBe(true);
      expect(validate.isValidWaitTime(3)).toBe(false);
      expect(validate.isValidWaitTime(20)).toBe(false);
    });
  });

  describe('display', () => {
    const date = '2024-06-15T14:30:00Z';

    it('forUser should format for display', () => {
      const result = display.forUser(date);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('dateOnly should show date without time', () => {
      const result = display.dateOnly(date);
      expect(typeof result).toBe('string');
    });

    it('timeOnly should show time without date', () => {
      const result = display.timeOnly(date);
      expect(typeof result).toBe('string');
    });

    it('duration should format minutes', () => {
      expect(display.duration(30)).toBe('30 min');
      expect(display.duration(90)).toBe('1h 30m');
      expect(display.duration(60)).toBe('1h');
    });
  });

  describe('ride utilities', () => {
    it('isValidDepartureTime rejects past times', () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      const result = ride.isValidDepartureTime(pastTime);
      expect(result.valid).toBe(false);
    });

    it('isValidDepartureTime accepts valid future time', () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      const result = ride.isValidDepartureTime(futureTime);
      expect(result.valid).toBe(true);
    });

    it('isValidDepartureTime rejects too far in future', () => {
      const tooFar = new Date(Date.now() + 10 * 24 * 3600000).toISOString();
      const result = ride.isValidDepartureTime(tooFar);
      expect(result.valid).toBe(false);
    });

    it('canCancel returns result with canCancel flag', () => {
      const futureTime = new Date(Date.now() + 3 * 3600000).toISOString();
      const result = ride.canCancel(futureTime);
      expect(result).toHaveProperty('canCancel');
      expect(result).toHaveProperty('deadline');
    });

    it('calculateETA adds duration', () => {
      const departure = '2024-06-15T10:00:00Z';
      const eta = ride.calculateETA(departure, 30);
      expect(eta.isValid()).toBe(true);
    });
  });
});
