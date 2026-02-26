/**
 * Response Utility
 * University of Ilorin Carpooling Platform
 *
 * Provides standardized API response formatting,
 * pagination helpers, and response builders.
 */

const { toISO } = require('./dateTime');

/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

/**
 * Standard API Response Format
 * {
 *   success: boolean,
 *   message: string,
 *   data: any,
 *   meta?: object,
 *   timestamp: string
 * }
 */

/**
 * Build a success response.
 *
 * Supports two calling conventions:
 *   success(res, message, data)  – sends JSON response directly
 *   success({ data, message })   – returns { statusCode, body } object
 */
const success = (resOrOpts, message, data) => {
  // Controller shorthand: success(res, message, data)
  if (resOrOpts && typeof resOrOpts === 'object' && typeof resOrOpts.status === 'function') {
    const res = resOrOpts;
    const body = {
      success: true,
      message: message || 'Operation successful',
      data: data || null,
      timestamp: toISO(),
    };
    return res.status(HTTP_STATUS.OK).json(body);
  }

  // Builder form: success({ data, message, meta, statusCode })
  const {
    data: d = null,
    message: msg = 'Operation successful',
    meta = null,
    statusCode = HTTP_STATUS.OK,
  } = resOrOpts || {};

  const response = {
    success: true,
    message: msg,
    data: d,
    timestamp: toISO(),
  };

  if (meta) {
    response.meta = meta;
  }

  return { statusCode, body: response };
};

/**
 * Build an error response
 * @param {Object} options - Response options
 * @param {string} options.code - Error code
 * @param {string} options.message - Error message
 * @param {Object} options.details - Error details
 * @param {number} options.statusCode - HTTP status code
 * @returns {Object} Formatted error response
 */
const error = ({
  code = 'INTERNAL_ERROR',
  message = 'An error occurred',
  details = null,
  statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
} = {}) => {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: toISO(),
  };

  if (details) {
    response.error.details = details;
  }

  return { statusCode, body: response };
};

/**
 * Pre-built Success Responses
 */
const ok = (data, message = 'Success') => success({ data, message, statusCode: HTTP_STATUS.OK });

const created = (resOrData, message = 'Resource created successfully', data) => {
  // Controller shorthand: created(res, message, data)
  if (resOrData && typeof resOrData === 'object' && typeof resOrData.status === 'function') {
    const res = resOrData;
    const body = {
      success: true,
      message: message || 'Resource created successfully',
      data: data || null,
      timestamp: toISO(),
    };
    return res.status(HTTP_STATUS.CREATED).json(body);
  }

  // Builder form: created(data, message)
  return success({ data: resOrData, message, statusCode: HTTP_STATUS.CREATED });
};

const accepted = (data, message = 'Request accepted') =>
  success({ data, message, statusCode: HTTP_STATUS.ACCEPTED });

const noContent = () => ({
  statusCode: HTTP_STATUS.NO_CONTENT,
  body: null,
});

/**
 * Pre-built Error Responses
 */
const badRequest = (message = 'Bad request', details = null) =>
  error({
    code: 'BAD_REQUEST',
    message,
    details,
    statusCode: HTTP_STATUS.BAD_REQUEST,
  });

const unauthorized = (message = 'Unauthorized access') =>
  error({
    code: 'UNAUTHORIZED',
    message,
    statusCode: HTTP_STATUS.UNAUTHORIZED,
  });

const forbidden = (message = 'Access forbidden') =>
  error({
    code: 'FORBIDDEN',
    message,
    statusCode: HTTP_STATUS.FORBIDDEN,
  });

const notFound = (resource = 'Resource', message = null) =>
  error({
    code: 'NOT_FOUND',
    message: message || `${resource} not found`,
    statusCode: HTTP_STATUS.NOT_FOUND,
  });

const conflict = (message = 'Resource conflict') =>
  error({
    code: 'CONFLICT',
    message,
    statusCode: HTTP_STATUS.CONFLICT,
  });

const validationError = (details, message = 'Validation failed') =>
  error({
    code: 'VALIDATION_ERROR',
    message,
    details,
    statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  });

const tooManyRequests = (message = 'Too many requests', retryAfter = 60) =>
  error({
    code: 'RATE_LIMIT_EXCEEDED',
    message,
    details: { retryAfter },
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
  });

const internalError = (message = 'Internal server error') =>
  error({
    code: 'INTERNAL_ERROR',
    message,
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  });

const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  error({
    code: 'SERVICE_UNAVAILABLE',
    message,
    statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
  });

/**
 * Pagination Helper
 */
const paginate = (data, { page = 1, limit = 20, total = 0 } = {}) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    },
  };
};

/**
 * Build paginated response
 */
const paginatedSuccess = (data, pagination, message = 'Success') => {
  const paginated = paginate(data, pagination);
  return success({
    data: paginated.data,
    meta: { pagination: paginated.pagination },
    message,
  });
};

/**
 * Express Response Helper
 * Sends formatted response to client
 */
const send = (res, response) => {
  const { statusCode, body } = response;

  if (body === null) {
    return res.status(statusCode).end();
  }

  return res.status(statusCode).json(body);
};

/**
 * Express Middleware for Response Methods
 * Adds helper methods to response object
 */
const responseMiddleware = (req, res, next) => {
  // Success methods
  res.ok = (data, message) => send(res, ok(data, message));
  res.created = (data, message) => send(res, created(data, message));
  res.accepted = (data, message) => send(res, accepted(data, message));
  res.noContent = () => send(res, noContent());

  // Error methods
  res.badRequest = (message, details) => send(res, badRequest(message, details));
  res.unauthorized = (message) => send(res, unauthorized(message));
  res.forbidden = (message) => send(res, forbidden(message));
  res.notFound = (resource, message) => send(res, notFound(resource, message));
  res.conflict = (message) => send(res, conflict(message));
  res.validationError = (details, message) => send(res, validationError(details, message));
  res.tooManyRequests = (message, retryAfter) => send(res, tooManyRequests(message, retryAfter));
  res.internalError = (message) => send(res, internalError(message));

  // Paginated response
  res.paginated = (data, pagination, message) =>
    send(res, paginatedSuccess(data, pagination, message));

  // Generic success/error
  res.success = (options) => send(res, success(options));
  res.error = (options) => send(res, error(options));

  next();
};

/**
 * Lambda Response Builder
 * Formats response for AWS Lambda/API Gateway
 */
const lambdaResponse = (response, headers = {}) => {
  const { statusCode, body } = response;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      ...headers,
    },
    body: body ? JSON.stringify(body) : '',
  };
};

/**
 * Transform data for API response
 * Removes sensitive fields and formats dates
 */
const transform = (data, options = {}) => {
  const {
    exclude = ['passwordHash', 'refreshToken', '__v'],
    dateFields = ['createdAt', 'updatedAt', 'deletedAt'],
  } = options;

  if (!data) return null;

  if (Array.isArray(data)) {
    return data.map((item) => transform(item, options));
  }

  if (typeof data !== 'object') return data;

  const transformed = Object.entries(data).reduce((acc, [key, value]) => {
    // Skip excluded fields
    if (exclude.includes(key)) return acc;

    // Format date fields
    if (dateFields.includes(key) && value) {
      acc[key] = toISO(value);
      return acc;
    }

    // Recursively transform nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      acc[key] = transform(value, options);
      return acc;
    }

    // Transform arrays
    if (Array.isArray(value)) {
      acc[key] = value.map((item) => (typeof item === 'object' ? transform(item, options) : item));
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});

  return transformed;
};

/**
 * Collection Response Builder
 * For list endpoints with items and metadata
 */
const collection = (items, { total, page, limit, filters = {} } = {}) => ({
  items: transform(items),
  meta: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    filters,
  },
});

/**
 * Single Resource Response Builder
 */
const resource = (data, includes = {}) => {
  const transformed = transform(data);

  if (Object.keys(includes).length > 0) {
    return {
      ...transformed,
      _includes: includes,
    };
  }

  return transformed;
};

/**
 * API Links Builder (HATEOAS)
 */
const buildLinks = (baseUrl, resourceId, options = {}) => {
  const { actions = ['self', 'update', 'delete'], customLinks = {} } = options;

  const links = {};

  if (actions.includes('self')) {
    links.self = { href: `${baseUrl}/${resourceId}`, method: 'GET' };
  }

  if (actions.includes('update')) {
    links.update = { href: `${baseUrl}/${resourceId}`, method: 'PATCH' };
  }

  if (actions.includes('delete')) {
    links.delete = { href: `${baseUrl}/${resourceId}`, method: 'DELETE' };
  }

  return { ...links, ...customLinks };
};

module.exports = {
  // HTTP Status codes
  HTTP_STATUS,

  // Response builders
  success,
  error,

  // Pre-built responses
  ok,
  created,
  accepted,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validationError,
  tooManyRequests,
  internalError,
  serviceUnavailable,

  // Pagination
  paginate,
  paginatedSuccess,

  // Express helpers
  send,
  responseMiddleware,

  // Lambda helpers
  lambdaResponse,

  // Data transformation
  transform,
  collection,
  resource,
  buildLinks,
};
