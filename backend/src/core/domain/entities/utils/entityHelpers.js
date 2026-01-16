/**
 * Entity Helper Utilities
 * Common utility functions for domain entities
 * University of Ilorin Carpooling Platform
 */

/**
 * Parse a date value to a Date object or null
 * @param {Date|string|null} date - Date value to parse
 * @returns {Date|null} Parsed date or null
 */
function parseDate(date) {
  if (!date) {
    return null;
  }
  if (date instanceof Date) {
    return date;
  }
  return new Date(date);
}

/**
 * Validate if a value is within a numeric range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if valid
 */
function isInRange(value, min, max) {
  return value >= min && value <= max;
}

/**
 * Generate a unique token
 * @param {string} prefix - Token prefix
 * @param {string} id - Entity ID
 * @returns {string} Generated token
 */
function generateToken(prefix, id) {
  return `${prefix}_${id}_${Date.now().toString(36)}`;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (Nigerian)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
  const phoneRegex = /^(\+234|0)[789]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

/**
 * Validate coordinates are within Nigeria
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid
 */
function isValidNigerianCoordinates(lat, lng) {
  return lat >= 4 && lat <= 14 && lng >= 2 && lng <= 15;
}

/**
 * Format time string to HH:MM
 * @param {Date} date - Date object
 * @returns {string} Formatted time string
 */
function formatTime(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Validate time format (HH:MM)
 * @param {string} time - Time string
 * @returns {boolean} True if valid
 */
function isValidTimeFormat(time) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Sanitize string input
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
function sanitizeString(input, maxLength = 1000) {
  if (!input) return '';
  return input.trim().substring(0, maxLength);
}

/**
 * Generate a random alphanumeric string
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
function generateRandomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = {
  parseDate,
  isInRange,
  generateToken,
  isValidEmail,
  isValidPhone,
  calculateDistance,
  isValidNigerianCoordinates,
  formatTime,
  isValidTimeFormat,
  sanitizeString,
  generateRandomString,
};
