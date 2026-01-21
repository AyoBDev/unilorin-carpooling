/**
 * DateTime Utility
 * University of Ilorin Carpooling Platform
 *
 * Provides comprehensive date/time operations using dayjs,
 * Nigerian timezone support (WAT - West Africa Time),
 * and ride-specific time calculations.
 */

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const relativeTime = require('dayjs/plugin/relativeTime');
const duration = require('dayjs/plugin/duration');
const isBetween = require('dayjs/plugin/isBetween');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const weekday = require('dayjs/plugin/weekday');
const weekOfYear = require('dayjs/plugin/weekOfYear');
const advancedFormat = require('dayjs/plugin/advancedFormat');

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(customParseFormat);
dayjs.extend(weekday);
dayjs.extend(weekOfYear);
dayjs.extend(advancedFormat);

// Constants
const TIMEZONE = 'Africa/Lagos'; // Nigerian timezone (WAT - UTC+1)
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
const DEFAULT_TIME_FORMAT = 'HH:mm';
const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const ISO_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ';

// Business hours for the university (7 AM to 8 PM)
const BUSINESS_HOURS_START = 7;
const BUSINESS_HOURS_END = 20;

// Minimum advance booking time (30 minutes)
const MIN_BOOKING_ADVANCE_MINUTES = 30;

// Maximum advance booking days (7 days)
const MAX_BOOKING_ADVANCE_DAYS = 7;

// Cancellation deadline (1 hour before ride)
const CANCELLATION_DEADLINE_MINUTES = 60;

// Wait time limits
const MIN_WAIT_TIME_MINUTES = 5;
const MAX_WAIT_TIME_MINUTES = 15;

/**
 * Create a dayjs instance in Nigerian timezone
 * @param {Date|string|number} date - Date input
 * @returns {dayjs.Dayjs} Dayjs instance in WAT
 */
const now = (date = undefined) => (date ? dayjs(date).tz(TIMEZONE) : dayjs().tz(TIMEZONE));

/**
 * Format a date/time
 * @param {Date|string|dayjs.Dayjs} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted date string
 */
const format = (date, formatStr = DEFAULT_DATETIME_FORMAT) => {
  if (!date) return null;
  return dayjs(date).tz(TIMEZONE).format(formatStr);
};

/**
 * Parse a date string
 * @param {string} dateStr - Date string to parse
 * @param {string} formatStr - Expected format of the string
 * @returns {dayjs.Dayjs} Parsed dayjs instance
 */
const parse = (dateStr, formatStr = DEFAULT_DATETIME_FORMAT) =>
  dayjs(dateStr, formatStr).tz(TIMEZONE);

/**
 * Get ISO string in UTC
 * @param {Date|string|dayjs.Dayjs} date - Date input
 * @returns {string} ISO 8601 string
 */
const toISO = (date = undefined) => (date ? dayjs(date) : dayjs()).toISOString();

/**
 * Convert to Unix timestamp (seconds)
 * @param {Date|string|dayjs.Dayjs} date - Date input
 * @returns {number} Unix timestamp
 */
const toUnix = (date = undefined) => (date ? dayjs(date) : dayjs()).unix();

/**
 * Get timestamp in milliseconds
 * @param {Date|string|dayjs.Dayjs} date - Date input
 * @returns {number} Timestamp in milliseconds
 */
const toTimestamp = (date = undefined) => (date ? dayjs(date) : dayjs()).valueOf();

/**
 * Date Comparison Utilities
 */
const compare = {
  /**
   * Check if date is before another date
   */
  isBefore: (date1, date2) => dayjs(date1).isBefore(dayjs(date2)),

  /**
   * Check if date is after another date
   */
  isAfter: (date1, date2) => dayjs(date1).isAfter(dayjs(date2)),

  /**
   * Check if date is same as another date
   */
  isSame: (date1, date2, unit = 'day') => dayjs(date1).isSame(dayjs(date2), unit),

  /**
   * Check if date is between two dates
   */
  isBetween: (date, start, end, unit = 'minute', inclusivity = '[]') =>
    dayjs(date).isBetween(dayjs(start), dayjs(end), unit, inclusivity),

  /**
   * Check if date is same or after
   */
  isSameOrAfter: (date1, date2, unit = 'minute') => dayjs(date1).isSameOrAfter(dayjs(date2), unit),

  /**
   * Check if date is same or before
   */
  isSameOrBefore: (date1, date2, unit = 'minute') =>
    dayjs(date1).isSameOrBefore(dayjs(date2), unit),

  /**
   * Check if date is today
   */
  isToday: (date) => dayjs(date).tz(TIMEZONE).isSame(now(), 'day'),

  /**
   * Check if date is in the past
   */
  isPast: (date) => dayjs(date).isBefore(now()),

  /**
   * Check if date is in the future
   */
  isFuture: (date) => dayjs(date).isAfter(now()),
};

/**
 * Date Manipulation Utilities
 */
const manipulate = {
  /**
   * Add time to a date
   */
  add: (date, amount, unit) => dayjs(date).add(amount, unit),

  /**
   * Subtract time from a date
   */
  subtract: (date, amount, unit) => dayjs(date).subtract(amount, unit),

  /**
   * Get start of a unit (day, week, month, etc.)
   */
  startOf: (date, unit) => dayjs(date).tz(TIMEZONE).startOf(unit),

  /**
   * Get end of a unit
   */
  endOf: (date, unit) => dayjs(date).tz(TIMEZONE).endOf(unit),

  /**
   * Set specific time on a date
   */
  setTime: (date, hours, minutes = 0) =>
    dayjs(date).tz(TIMEZONE).hour(hours).minute(minutes).second(0).millisecond(0),
};

/**
 * Duration Utilities
 */
const durationUtils = {
  /**
   * Get duration between two dates
   */
  between: (start, end) => dayjs.duration(dayjs(end).diff(dayjs(start))),

  /**
   * Get difference in specific unit
   */
  diff: (start, end, unit = 'minutes') => dayjs(end).diff(dayjs(start), unit),

  /**
   * Format duration as human readable
   */
  humanize: (minutes) => dayjs.duration(minutes, 'minutes').humanize(),

  /**
   * Create duration object
   */
  create: (amount, unit) => dayjs.duration(amount, unit),

  /**
   * Format duration as HH:mm
   */
  formatHM: (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },
};

/**
 * Relative Time Utilities
 */
const relative = {
  /**
   * Get relative time from now
   */
  fromNow: (date) => dayjs(date).fromNow(),

  /**
   * Get relative time to now
   */
  toNow: (date) => dayjs(date).toNow(),

  /**
   * Get relative time from a specific date
   */
  from: (date, reference) => dayjs(date).from(dayjs(reference)),

  /**
   * Get relative time to a specific date
   */
  to: (date, reference) => dayjs(date).to(dayjs(reference)),
};

/**
 * Ride-Specific Time Utilities
 */
const ride = {
  /**
   * Check if a departure time is valid for booking
   * Must be at least 30 minutes in the future and within 7 days
   */
  isValidDepartureTime: (departureTime) => {
    const departure = dayjs(departureTime);
    const currentTime = now();

    // Must be in the future (at least MIN_BOOKING_ADVANCE_MINUTES ahead)
    const minTime = currentTime.add(MIN_BOOKING_ADVANCE_MINUTES, 'minute');
    if (departure.isBefore(minTime)) {
      return {
        valid: false,
        reason: `Departure must be at least ${MIN_BOOKING_ADVANCE_MINUTES} minutes from now`,
      };
    }

    // Must be within MAX_BOOKING_ADVANCE_DAYS days
    const maxTime = currentTime.add(MAX_BOOKING_ADVANCE_DAYS, 'day');
    if (departure.isAfter(maxTime)) {
      return {
        valid: false,
        reason: `Departure must be within ${MAX_BOOKING_ADVANCE_DAYS} days`,
      };
    }

    return { valid: true };
  },

  /**
   * Check if cancellation is still allowed
   */
  canCancel: (departureTime) => {
    const departure = dayjs(departureTime);
    const deadline = departure.subtract(CANCELLATION_DEADLINE_MINUTES, 'minute');
    const canCancel = now().isBefore(deadline);

    return {
      canCancel,
      deadline: deadline.toISOString(),
      reason: canCancel
        ? null
        : `Cancellation deadline passed (${CANCELLATION_DEADLINE_MINUTES} minutes before departure)`,
    };
  },

  /**
   * Calculate estimated arrival time
   */
  calculateETA: (departureTime, durationMinutes) =>
    dayjs(departureTime).add(durationMinutes, 'minute'),

  /**
   * Get wait time window
   */
  getWaitTimeWindow: (scheduledTime, waitTimeMinutes) => {
    const scheduled = dayjs(scheduledTime);
    return {
      start: scheduled.toISOString(),
      end: scheduled.add(waitTimeMinutes, 'minute').toISOString(),
    };
  },

  /**
   * Check if current time is within pickup window
   */
  isWithinPickupWindow: (scheduledTime, waitTimeMinutes) => {
    const scheduled = dayjs(scheduledTime);
    const windowEnd = scheduled.add(waitTimeMinutes, 'minute');
    return compare.isBetween(now(), scheduled, windowEnd);
  },

  /**
   * Get time until departure
   */
  getTimeUntilDeparture: (departureTime) => {
    const minutes = durationUtils.diff(now(), departureTime, 'minutes');
    return {
      minutes,
      formatted: durationUtils.humanize(minutes),
      isNow: minutes <= 5 && minutes >= 0,
      hasStarted: minutes < 0,
    };
  },

  /**
   * Parse time string (HH:mm) to full datetime for today or given date
   */
  parseTimeToDatetime: (timeStr, date = null) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const targetDate = date ? dayjs(date).tz(TIMEZONE) : now();
    return targetDate.hour(hours).minute(minutes).second(0).millisecond(0);
  },

  /**
   * Check if departure time is during business hours
   */
  isDuringBusinessHours: (departureTime) => {
    const hour = dayjs(departureTime).tz(TIMEZONE).hour();
    return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
  },

  /**
   * Get next available departure time (rounded to 5 minutes)
   */
  getNextAvailableDeparture: () => {
    const current = now().add(MIN_BOOKING_ADVANCE_MINUTES, 'minute');
    const minutes = current.minute();
    const roundedMinutes = Math.ceil(minutes / 5) * 5;
    return current.minute(roundedMinutes).second(0).millisecond(0);
  },
};

/**
 * Recurring Ride Utilities
 */
const recurring = {
  /**
   * Get day of week number (0 = Sunday, 6 = Saturday)
   */
  getDayOfWeek: (date = null) => (date ? dayjs(date) : now()).day(),

  /**
   * Get day of week name
   */
  getDayName: (date = null) => (date ? dayjs(date) : now()).format('dddd'),

  /**
   * Check if day is a weekday
   */
  isWeekday: (date = null) => {
    const day = (date ? dayjs(date) : now()).day();
    return day >= 1 && day <= 5;
  },

  /**
   * Check if day is weekend
   */
  isWeekend: (date = null) => {
    const day = (date ? dayjs(date) : now()).day();
    return day === 0 || day === 6;
  },

  /**
   * Get next occurrence of specific weekdays
   * @param {Array<number>} days - Array of day numbers (0-6)
   * @param {string} time - Time string (HH:mm)
   * @returns {Array} Array of next occurrence datetimes
   */
  getNextOccurrences: (days, time, count = 7) => {
    const occurrences = [];
    let current = now();

    while (occurrences.length < count) {
      if (days.includes(current.day())) {
        const occurrence = ride.parseTimeToDatetime(time, current);
        if (occurrence.isAfter(now())) {
          occurrences.push(occurrence.toISOString());
        }
      }
      current = current.add(1, 'day');
    }

    return occurrences;
  },

  /**
   * Generate dates for recurring ride
   */
  generateRecurringDates: (startDate, endDate, recurringDays, time) => {
    const dates = [];
    let current = dayjs(startDate).tz(TIMEZONE);
    const end = dayjs(endDate).tz(TIMEZONE);

    while (current.isSameOrBefore(end, 'day')) {
      if (recurringDays.includes(current.day())) {
        const datetime = ride.parseTimeToDatetime(time, current);
        if (datetime.isAfter(now())) {
          dates.push(datetime.toISOString());
        }
      }
      current = current.add(1, 'day');
    }

    return dates;
  },
};

/**
 * Display Formatting
 */
const display = {
  /**
   * Format for display to users
   */
  forUser: (date) => format(date, 'ddd, MMM D, YYYY [at] h:mm A'),

  /**
   * Format date only
   */
  dateOnly: (date) => format(date, 'ddd, MMM D, YYYY'),

  /**
   * Format time only
   */
  timeOnly: (date) => format(date, 'h:mm A'),

  /**
   * Format for notification
   */
  forNotification: (date) => format(date, 'MMM D [at] h:mm A'),

  /**
   * Format short date
   */
  shortDate: (date) => format(date, 'MMM D'),

  /**
   * Format for API responses
   */
  forAPI: (date) => toISO(date),

  /**
   * Format duration for display
   */
  duration: (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  },
};

/**
 * Validation Utilities
 */
const validate = {
  /**
   * Check if string is valid date
   */
  isValidDate: (dateStr) => dayjs(dateStr).isValid(),

  /**
   * Check if string is valid time (HH:mm)
   */
  isValidTime: (timeStr) => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr),

  /**
   * Validate wait time
   */
  isValidWaitTime: (minutes) =>
    minutes >= MIN_WAIT_TIME_MINUTES && minutes <= MAX_WAIT_TIME_MINUTES,
};

module.exports = {
  // Core
  dayjs,
  now,
  format,
  parse,
  toISO,
  toUnix,
  toTimestamp,

  // Utilities
  compare,
  manipulate,
  duration: durationUtils,
  relative,
  recurring,
  display,
  validate,

  // Ride specific
  ride,

  // Constants
  TIMEZONE,
  DEFAULT_DATE_FORMAT,
  DEFAULT_TIME_FORMAT,
  DEFAULT_DATETIME_FORMAT,
  ISO_FORMAT,
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  MIN_BOOKING_ADVANCE_MINUTES,
  MAX_BOOKING_ADVANCE_DAYS,
  CANCELLATION_DEADLINE_MINUTES,
  MIN_WAIT_TIME_MINUTES,
  MAX_WAIT_TIME_MINUTES,
};
