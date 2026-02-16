/**
 * Cache Layer - Barrel Export
 * University of Ilorin Carpooling Platform
 *
 * Path: src/infrastructure/cache/index.js
 */

const redisClient = require('./RedisClient');
const cacheService = require('./CacheService');
const {
  CacheKeys,
  TTL,
  NAMESPACES,
  generateSearchHash,
  getInvalidationKeys,
} = require('./CacheKeys');

module.exports = {
  // Primary interface — use this for all caching operations
  cacheService,

  // Low-level client — use only when you need raw Redis commands
  redisClient,

  // Key generators and constants
  CacheKeys,
  TTL,
  NAMESPACES,

  // Utilities
  generateSearchHash,
  getInvalidationKeys,
};
