/**
 * Request Validation Middleware
 * University of Ilorin Carpooling Platform
 *
 * Validates request body, query parameters, and URL params against
 * Joi schemas.  Returns structured field-level errors using the
 * project's ValidationError class.
 *
 * @module middlewares/validation
 */

const Joi = require('joi');
const { ValidationError } = require('../../shared/errors');
const { logger } = require('../../shared/utils/logger');

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const DEFAULT_JOI_OPTIONS = {
  abortEarly: false, // Collect all errors, not just the first
  allowUnknown: false, // Reject unknown fields
  stripUnknown: false, // Don't silently remove unknowns
  errors: {
    wrap: { label: false }, // Don't wrap labels in quotes
  },
};

// ─────────────────────────────────────────────
// Helper – format Joi errors into field-level errors
// ─────────────────────────────────────────────

/**
 * Transform Joi validation details into the structure expected by
 * our ValidationError class:
 *   [{ field: 'email', message: '...', type: '...' }, ...]
 *
 * @param {Joi.ValidationError} joiError
 * @returns {{ field: string, message: string, type: string }[]}
 */
const formatJoiErrors = (joiError) => {
  if (!joiError || !joiError.details) return [];

  return joiError.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type,
  }));
};

// ─────────────────────────────────────────────
// Core factory – validate()
// ─────────────────────────────────────────────

/**
 * Create a validation middleware for one or more request sources.
 *
 * @param {Object}  schemas                  – Keyed by source.
 * @param {Joi.ObjectSchema} [schemas.body]  – Schema for req.body
 * @param {Joi.ObjectSchema} [schemas.query] – Schema for req.query
 * @param {Joi.ObjectSchema} [schemas.params]– Schema for req.params
 * @param {Object}  [options]                – Override default Joi options.
 * @returns {Function} Express middleware
 *
 * @example
 *   const { validate } = require('../middlewares/validation.middleware');
 *   const { rideSchema } = require('../../shared/utils/validation');
 *
 *   router.post(
 *     '/rides',
 *     authenticate,
 *     validate({ body: rideSchema }),
 *     rideController.create
 *   );
 *
 * @example  // validate query + params together
 *   router.get(
 *     '/rides/:rideId/bookings',
 *     authenticate,
 *     validate({
 *       params: Joi.object({ rideId: Joi.string().uuid().required() }),
 *       query: Joi.object({ page: Joi.number().integer().min(1).default(1) }),
 *     }),
 *     bookingController.listByRide
 *   );
 */
const validate = (schemas = {}, options = {}) => {
  const joiOptions = { ...DEFAULT_JOI_OPTIONS, ...options };

  return (req, _res, next) => {
    const allErrors = [];

    // Validate each source that has a corresponding schema
    ['body', 'query', 'params']
      .filter((source) => schemas[source])
      .forEach((source) => {
        const schema = schemas[source];
        const { error, value } = schema.validate(req[source], joiOptions);

        if (error) {
          const formattedErrors = formatJoiErrors(error);
          formattedErrors.forEach((e) => {
            // Prefix the source so consumers know where the issue is
            e.field = source === 'body' ? e.field : `${source}.${e.field}`;
            allErrors.push(e);
          });
        } else {
          // Replace with the coerced / defaulted value
          req[source] = value;
        }
      });

    if (allErrors.length > 0) {
      logger.debug('Validation failed', {
        path: req.path,
        method: req.method,
        errorCount: allErrors.length,
        fields: allErrors.map((e) => e.field),
      });

      return next(new ValidationError('Validation failed', allErrors));
    }

    return next();
  };
};

// ─────────────────────────────────────────────
// Convenience wrappers
// ─────────────────────────────────────────────

/**
 * Validate only the request body.
 *
 * @param {Joi.ObjectSchema} schema
 * @param {Object} [options]
 * @returns {Function} Express middleware
 *
 * @example
 *   router.post('/auth/register', validateBody(registrationSchema), authController.register);
 */
const validateBody = (schema, options = {}) => validate({ body: schema }, options);

/**
 * Validate only the query string.
 *
 * @param {Joi.ObjectSchema} schema
 * @param {Object} [options]
 * @returns {Function} Express middleware
 */
const validateQuery = (schema, options = {}) => validate({ query: schema }, options);

/**
 * Validate only the URL params.
 *
 * @param {Joi.ObjectSchema} schema
 * @param {Object} [options]
 * @returns {Function} Express middleware
 */
const validateParams = (schema, options = {}) => validate({ params: schema }, options);

// ─────────────────────────────────────────────
// Common Param Schemas (re-usable across routes)
// ─────────────────────────────────────────────

const commonSchemas = {
  /** Validates a single `:id` or `:userId` style UUID param. */
  idParam: (paramName = 'id') =>
    Joi.object({
      [paramName]: Joi.string()
        .pattern(/^[a-zA-Z0-9_-]{8,64}$/)
        .required()
        .messages({
          'string.pattern.base': `${paramName} must be a valid identifier`,
          'any.required': `${paramName} is required`,
        }),
    }),

  /** Standard pagination query schema. */
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().max(50).default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  /** Date range query schema (used by reports, ride search, etc.). */
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }).and('startDate', 'endDate'),
};

// ─────────────────────────────────────────────
// Sanitisation middleware
// ─────────────────────────────────────────────

/**
 * Trim all string values in req.body (shallow).
 * Useful as a pre-validation step to avoid whitespace-only inputs.
 */
const sanitizeBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

/**
 * Strip any HTML tags from all string values in req.body (shallow).
 * Prevents stored XSS in case upstream sanitisation is missed.
 */
const stripHtmlFromBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    const tagRegex = /<\/?[^>]+(>|$)/g;
    Object.keys(req.body).forEach((key) => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].replace(tagRegex, '');
      }
    });
  }
  next();
};

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

module.exports = {
  // Core
  validate,
  validateBody,
  validateQuery,
  validateParams,

  // Common schemas
  commonSchemas,

  // Sanitisation helpers
  sanitizeBody,
  stripHtmlFromBody,

  // Re-export for convenience
  Joi,
};
