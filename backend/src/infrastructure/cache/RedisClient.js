/**
 * Redis Client Configuration
 * University of Ilorin Carpooling Platform
 *
 * Path: src/infrastructure/cache/RedisClient.js
 *
 * Manages Redis connections for both local development (standalone Redis)
 * and production (AWS ElastiCache). Supports automatic reconnection,
 * connection pooling, health monitoring, and graceful shutdown.
 */

const Redis = require('ioredis');
const { logger } = require('../../shared/utils/logger');

// ============================================================
// Configuration
// ============================================================

const DEFAULT_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  keyPrefix: '',
  // Connection
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  // Reconnection
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error('Redis: Max reconnection attempts reached', { attempts: times });
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 5000);
    logger.warn('Redis: Reconnecting...', { attempt: times, delayMs: delay });
    return delay;
  },
  // Performance
  enableReadyCheck: true,
  enableOfflineQueue: true,
  maxLoadingRetryTime: 10000,
};

// ============================================================
// Redis Client Singleton
// ============================================================

class RedisClient {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.isConnected = false;
    this.isReady = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 15;
    this._healthCheckInterval = null;
    this._metrics = {
      totalCommands: 0,
      failedCommands: 0,
      reconnections: 0,
      lastConnectedAt: null,
      lastErrorAt: null,
      lastError: null,
    };
  }

  /**
   * Initialize Redis connection
   * @param {Object} customConfig - Override default configuration
   * @returns {Promise<Redis>} Connected Redis client
   */
  async connect(customConfig = {}) {
    if (this.isReady && this.client) {
      return this.client;
    }

    const config = { ...DEFAULT_CONFIG, ...customConfig };

    // Use REDIS_URL if provided (e.g., ElastiCache endpoint)
    const redisUrl = process.env.REDIS_URL;

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          connectTimeout: config.connectTimeout,
          commandTimeout: config.commandTimeout,
          maxRetriesPerRequest: config.maxRetriesPerRequest,
          retryStrategy: config.retryStrategy,
          lazyConnect: true,
          enableReadyCheck: true,
          tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        });
      } else {
        this.client = new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
          keyPrefix: config.keyPrefix,
          connectTimeout: config.connectTimeout,
          commandTimeout: config.commandTimeout,
          maxRetriesPerRequest: config.maxRetriesPerRequest,
          retryStrategy: config.retryStrategy,
          lazyConnect: true,
          enableReadyCheck: config.enableReadyCheck,
          enableOfflineQueue: config.enableOfflineQueue,
        });
      }

      this._attachEventListeners(this.client, 'main');

      await this.client.connect();

      logger.info('Redis client connected', {
        host: config.host,
        port: config.port,
        db: config.db,
        useTLS: process.env.REDIS_TLS === 'true',
        usingUrl: !!redisUrl,
      });

      // Start health check interval
      this._startHealthCheck();
      return this.client;
    } catch (error) {
      logger.error('Redis connection failed', {
        error: error.message,
        host: config.host,
        port: config.port,
      });
      this._metrics.lastError = error.message;
      this._metrics.lastErrorAt = new Date().toISOString();
      throw error;
    }
  }

  /**
   * Get the Redis client instance, connecting if necessary.
   * @returns {Promise<Redis>} Redis client
   */
  async getClient() {
    if (!this.isReady || !this.client) {
      await this.connect();
    }
    return this.client;
  }

  /**
   * Create a separate subscriber connection for Pub/Sub.
   * Redis requires dedicated connections for subscriptions.
   * @returns {Promise<Redis>} Subscriber client
   */
  async getSubscriber() {
    if (this.subscriber) {
      return this.subscriber;
    }

    const config = { ...DEFAULT_CONFIG };
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.subscriber = new Redis(redisUrl, {
        connectTimeout: config.connectTimeout,
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        retryStrategy: config.retryStrategy,
        lazyConnect: true,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      });
    } else {
      this.subscriber = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        connectTimeout: config.connectTimeout,
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        retryStrategy: config.retryStrategy,
        lazyConnect: true,
      });
    }

    this._attachEventListeners(this.subscriber, 'subscriber');
    await this.subscriber.connect();

    logger.info('Redis subscriber connected');
    return this.subscriber;
  }

  /**
   * Attach event listeners to a Redis client instance
   * @param {Redis} client - Redis client
   * @param {string} label - Label for logging
   */
  _attachEventListeners(client, label) {
    client.on('connect', () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
      logger.info(`Redis [${label}]: Connection established`);
    });

    client.on('ready', () => {
      this.isReady = true;
      this._metrics.lastConnectedAt = new Date().toISOString();
      logger.info(`Redis [${label}]: Ready to accept commands`);
    });

    client.on('error', (error) => {
      this._metrics.lastError = error.message;
      this._metrics.lastErrorAt = new Date().toISOString();
      this._metrics.failedCommands += 1;
      logger.error(`Redis [${label}]: Error`, { error: error.message });
    });

    client.on('close', () => {
      this.isConnected = false;
      this.isReady = false;
      logger.warn(`Redis [${label}]: Connection closed`);
    });

    client.on('reconnecting', (delay) => {
      this._metrics.reconnections += 1;
      this.connectionAttempts += 1;
      logger.warn(`Redis [${label}]: Reconnecting`, {
        attempt: this.connectionAttempts,
        delayMs: delay,
      });
    });

    client.on('end', () => {
      this.isConnected = false;
      this.isReady = false;
      logger.info(`Redis [${label}]: Connection ended`);
    });
  }

  /**
   * Start periodic health checks
   */
  _startHealthCheck() {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
    }

    // Health check every 30 seconds
    this._healthCheckInterval = setInterval(async () => {
      try {
        if (this.client && this.isReady) {
          const start = Date.now();
          await this.client.ping();
          const latency = Date.now() - start;

          if (latency > 100) {
            logger.warn('Redis: High latency detected', { latencyMs: latency });
          }
        }
      } catch (error) {
        logger.error('Redis: Health check failed', { error: error.message });
      }
    }, 30000);

    // Prevent the interval from keeping the process alive
    if (this._healthCheckInterval.unref) {
      this._healthCheckInterval.unref();
    }
  }

  /**
   * Check if Redis is healthy and responding
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const status = {
      connected: this.isConnected,
      ready: this.isReady,
      metrics: { ...this._metrics },
    };

    if (!this.client || !this.isReady) {
      return { ...status, healthy: false, message: 'Redis not connected' };
    }

    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const latency = Date.now() - start;

      // Get server info
      const info = await this.client.info('memory');
      const usedMemory = info.match(/used_memory_human:(\S+)/);

      return {
        ...status,
        healthy: pong === 'PONG',
        latencyMs: latency,
        memoryUsage: usedMemory ? usedMemory[1] : 'unknown',
        message: 'Redis is healthy',
      };
    } catch (error) {
      return {
        ...status,
        healthy: false,
        message: `Health check failed: ${error.message}`,
      };
    }
  }

  /**
   * Get connection metrics
   * @returns {Object} Connection metrics
   */
  getMetrics() {
    return {
      ...this._metrics,
      isConnected: this.isConnected,
      isReady: this.isReady,
      connectionAttempts: this.connectionAttempts,
    };
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect() {
    // Stop health checks
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }

    // Disconnect subscriber
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
        this.subscriber = null;
        logger.info('Redis subscriber disconnected');
      } catch (error) {
        logger.error('Error disconnecting Redis subscriber', { error: error.message });
        this.subscriber.disconnect();
        this.subscriber = null;
      }
    }

    // Disconnect main client
    if (this.client) {
      try {
        await this.client.quit();
        this.client = null;
        this.isConnected = false;
        this.isReady = false;
        logger.info('Redis client disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis client', { error: error.message });
        this.client.disconnect();
        this.client = null;
        this.isConnected = false;
        this.isReady = false;
      }
    }
  }

  /**
   * Flush all keys (use with caution - dev/test only)
   */
  async flushAll() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot flush cache in production');
    }

    if (!this.client || !this.isReady) {
      throw new Error('Redis not connected');
    }

    await this.client.flushall();
    logger.warn('Redis: All keys flushed (dev/test only)');
  }
}

// ============================================================
// Singleton Export
// ============================================================

const redisClient = new RedisClient();

module.exports = redisClient;
