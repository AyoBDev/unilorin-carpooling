/**
 * Logger Utility
 * University of Ilorin Carpooling Platform
 *
 * Winston-based structured logging with correlation IDs,
 * AWS CloudWatch support, and environment-aware configuration.
 */

const winston = require('winston');
const { randomUUID } = require('crypto');

// Log levels following syslog severity levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

// Colors for console output
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey',
};

winston.addColors(LOG_COLORS);

/**
 * Custom format for structured JSON logging
 */
const structuredFormat = winston.format.printf(
  ({ timestamp, level, message, correlationId, service, userId, action, ...metadata }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || process.env.SERVICE_NAME || 'carpool-api',
      correlationId: correlationId || 'no-correlation-id',
      message,
      ...(userId && { userId }),
      ...(action && { action }),
      ...(Object.keys(metadata).length > 0 && { metadata }),
    };

    return JSON.stringify(logEntry);
  },
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, correlationId, service, _userId, action, ...metadata }) => {
      let logMessage = `${timestamp} [${level}]`;

      if (correlationId) {
        logMessage += ` [${correlationId.substring(0, 8)}]`;
      }

      if (service) {
        logMessage += ` [${service}]`;
      }

      if (action) {
        logMessage += ` [${action}]`;
      }

      logMessage += `: ${message}`;

      if (Object.keys(metadata).length > 0) {
        logMessage += ` ${JSON.stringify(metadata)}`;
      }

      return logMessage;
    },
  ),
);

/**
 * Determine log level based on environment
 */
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  const configuredLevel = process.env.LOG_LEVEL;

  if (configuredLevel) {
    return configuredLevel;
  }

  switch (env) {
    case 'production':
      return 'info';
    case 'staging':
      return 'debug';
    case 'test':
      return 'error';
    default:
      return 'debug';
  }
};

/**
 * Create transports based on environment
 */
const createTransports = () => {
  const transports = [];
  const env = process.env.NODE_ENV || 'development';

  // Console transport
  if (env === 'development' || env === 'test') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
      }),
    );
  } else {
    // Structured JSON for production/staging (CloudWatch compatible)
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.timestamp(), structuredFormat),
      }),
    );
  }

  // File transport for error logs (optional, useful for local debugging)
  if (env === 'development' && process.env.ENABLE_FILE_LOGGING === 'true') {
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(winston.format.timestamp(), structuredFormat),
      }),
    );

    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(winston.format.timestamp(), structuredFormat),
      }),
    );
  }

  return transports;
};

/**
 * Create the main Winston logger instance
 */
const logger = winston.createLogger({
  level: getLogLevel(),
  levels: LOG_LEVELS,
  transports: createTransports(),
  exitOnError: false,
  silent: process.env.LOG_SILENT === 'true',
});

/**
 * Async local storage for correlation ID tracking
 */
const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Get current correlation ID from async context
 */
const getCorrelationId = () => {
  const store = asyncLocalStorage.getStore();
  return store?.correlationId || null;
};

/**
 * Set correlation ID in async context
 */
const setCorrelationId = (correlationId) => {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.correlationId = correlationId;
  }
};

/**
 * Run function within correlation context
 */
const runWithCorrelation = (correlationId, fn) => asyncLocalStorage.run({ correlationId }, fn);

/**
 * Generate a new correlation ID
 */
const generateCorrelationId = () => randomUUID();

/**
 * Enhanced logger with automatic correlation ID injection
 */
class Logger {
  constructor(defaultMeta = {}) {
    this.defaultMeta = defaultMeta;
  }

  /**
   * Create child logger with additional default metadata
   */
  child(meta = {}) {
    return new Logger({ ...this.defaultMeta, ...meta });
  }

  /**
   * Add correlation ID and default metadata to log entry
   */
  _enrichLogEntry(meta = {}) {
    return {
      ...this.defaultMeta,
      correlationId: meta.correlationId || getCorrelationId() || 'no-correlation-id',
      ...meta,
    };
  }

  error(message, meta = {}) {
    logger.error(message, this._enrichLogEntry(meta));
  }

  warn(message, meta = {}) {
    logger.warn(message, this._enrichLogEntry(meta));
  }

  info(message, meta = {}) {
    logger.info(message, this._enrichLogEntry(meta));
  }

  http(message, meta = {}) {
    logger.http(message, this._enrichLogEntry(meta));
  }

  verbose(message, meta = {}) {
    logger.verbose(message, this._enrichLogEntry(meta));
  }

  debug(message, meta = {}) {
    logger.debug(message, this._enrichLogEntry(meta));
  }

  silly(message, meta = {}) {
    logger.silly(message, this._enrichLogEntry(meta));
  }

  /**
   * Log API request
   */
  logRequest(req, meta = {}) {
    this.http('Incoming request', {
      action: 'API_REQUEST',
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.userId,
      ...meta,
    });
  }

  /**
   * Log API response
   */
  logResponse(req, res, duration, meta = {}) {
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    this[level]('Response sent', {
      action: 'API_RESPONSE',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId,
      ...meta,
    });
  }

  /**
   * Log error with stack trace
   */
  logError(error, context = {}) {
    this.error(error.message, {
      action: 'ERROR',
      errorName: error.name,
      errorCode: error.code,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation, table, duration, meta = {}) {
    this.debug(`Database ${operation}`, {
      action: 'DATABASE_OPERATION',
      operation,
      table,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  /**
   * Log cache operation
   */
  logCacheOperation(operation, key, hit, meta = {}) {
    this.debug(`Cache ${operation}`, {
      action: 'CACHE_OPERATION',
      operation,
      key,
      hit,
      ...meta,
    });
  }

  /**
   * Log external service call
   */
  logExternalCall(service, endpoint, duration, success, meta = {}) {
    const level = success ? 'debug' : 'warn';
    this[level](`External call to ${service}`, {
      action: 'EXTERNAL_CALL',
      service,
      endpoint,
      duration: `${duration}ms`,
      success,
      ...meta,
    });
  }

  /**
   * Log business event
   */
  logBusinessEvent(event, data = {}) {
    this.info(`Business event: ${event}`, {
      action: 'BUSINESS_EVENT',
      event,
      data,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event, data = {}) {
    this.warn(`Security event: ${event}`, {
      action: 'SECURITY_EVENT',
      event,
      data,
    });
  }

  /**
   * Log performance metric
   */
  logMetric(name, value, unit, meta = {}) {
    this.debug(`Metric: ${name}`, {
      action: 'METRIC',
      metricName: name,
      metricValue: value,
      unit,
      ...meta,
    });
  }
}

// Create default logger instance
const defaultLogger = new Logger({ service: process.env.SERVICE_NAME || 'carpool-api' });

// Export both the class and default instance
module.exports = {
  Logger,
  logger: defaultLogger,
  getCorrelationId,
  setCorrelationId,
  runWithCorrelation,
  generateCorrelationId,
  asyncLocalStorage,
  // Also export raw winston logger for advanced use cases
  winstonLogger: logger,
};
