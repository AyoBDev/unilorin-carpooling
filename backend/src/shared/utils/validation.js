/**
 * Validation Utility
 * University of Ilorin Carpooling Platform
 *
 * Provides Joi validation schemas for all entities,
 * custom validators, and validation helpers.
 */

const Joi = require('joi');

// Custom error messages
const customMessages = {
  'string.empty': '{{#label}} cannot be empty',
  'string.min': '{{#label}} must be at least {{#limit}} characters',
  'string.max': '{{#label}} must not exceed {{#limit}} characters',
  'string.email': '{{#label}} must be a valid email address',
  'string.pattern.base': '{{#label}} format is invalid',
  'number.min': '{{#label}} must be at least {{#limit}}',
  'number.max': '{{#label}} must not exceed {{#limit}}',
  'any.required': '{{#label}} is required',
  'any.only': '{{#label}} must be one of {{#valids}}',
  'array.min': '{{#label}} must have at least {{#limit}} items',
  'array.max': '{{#label}} must not exceed {{#limit}} items',
};

// Configure Joi defaults
const joi = Joi.defaults((schema) =>
  schema.options({
    abortEarly: false,
    stripUnknown: true,
    messages: customMessages,
  }),
);

/**
 * Common Validation Patterns
 */
const patterns = {
  // Nigerian phone number (08012345678 or +2348012345678)
  phone: /^(\+?234|0)[789][01]\d{8}$/,

  // University of Ilorin matric number (e.g., 19/55EC/001, 20/30AB/123)
  matricNumber: /^\d{2}\/\d{2}[A-Z]{2}\/\d{3}$/,

  // Staff ID (e.g., SS/2020/001, ADM/2019/123)
  staffId: /^[A-Z]{2,4}\/\d{4}\/\d{3,4}$/,

  // Nigerian vehicle plate number (e.g., KWL-123-AB, ABC-456-XY)
  plateNumber: /^[A-Z]{2,3}-\d{3}-[A-Z]{2}$/,

  // Password (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&#]{8,}$/,

  // UUID v4
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  // Verification code (alphanumeric, 6-8 chars)
  verificationCode: /^[A-Z0-9]{6,8}$/,

  // Time format (HH:mm)
  time: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,

  // Date format (YYYY-MM-DD)
  date: /^\d{4}-\d{2}-\d{2}$/,
};

/**
 * Custom Joi Extensions
 */
const customValidators = {
  /**
   * Validate Nigerian phone number
   */
  nigerianPhone: joi
    .string()
    .pattern(patterns.phone)
    .message('Invalid Nigerian phone number format'),

  /**
   * Validate matric number
   */
  matricNumber: joi
    .string()
    .pattern(patterns.matricNumber)
    .message('Invalid matric number format (e.g., 19/55EC/001)'),

  /**
   * Validate staff ID
   */
  staffId: joi
    .string()
    .pattern(patterns.staffId)
    .message('Invalid staff ID format (e.g., SS/2020/001)'),

  /**
   * Validate UUID
   */
  uuid: joi.string().pattern(patterns.uuid).message('Invalid UUID format'),

  /**
   * Validate coordinates
   */
  coordinates: joi
    .array()
    .ordered(
      joi.number().min(-90).max(90).required().label('latitude'),
      joi.number().min(-180).max(180).required().label('longitude'),
    )
    .length(2),

  /**
   * Validate time string
   */
  timeString: joi.string().pattern(patterns.time).message('Invalid time format (HH:mm)'),

  /**
   * Validate date string
   */
  dateString: joi.string().pattern(patterns.date).message('Invalid date format (YYYY-MM-DD)'),
};

/**
 * Shared Schema Components
 */
const components = {
  // Email (must be university email for students/staff)
  email: joi.string().email().max(255).lowercase().trim(),

  // University email (optional - can be enabled later)
  universityEmail: joi
    .string()
    .email()
    .pattern(/@(student\.)?unilorin\.edu\.ng$/)
    .message('Must be a valid University of Ilorin email'),

  // Password
  password: joi.string().min(8).max(128).pattern(patterns.password).messages({
    'string.pattern.base':
      'Password must contain at least 8 characters, including uppercase, lowercase, and number',
  }),

  // Location object
  location: joi.object({
    address: joi.string().max(500).required(),
    coordinates: joi
      .object({
        latitude: joi.number().min(-90).max(90).required(),
        longitude: joi.number().min(-180).max(180).required(),
      })
      .required(),
    placeId: joi.string().max(100),
    landmark: joi.string().max(200),
  }),

  // Pagination
  pagination: {
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().max(50),
    sortOrder: joi.string().valid('asc', 'desc').default('desc'),
  },

  // Date range
  dateRange: {
    startDate: joi.date().iso(),
    endDate: joi.date().iso().min(joi.ref('startDate')),
  },

  // ID parameter
  id: joi.string().uuid({ version: 'uuidv4' }),
};

/**
 * Authentication Schemas
 */
const auth = {
  register: joi.object({
    email: components.email.required(),
    password: components.password.required(),
    confirmPassword: joi.string().valid(joi.ref('password')).required().messages({
      'any.only': 'Passwords must match',
    }),
    firstName: joi.string().min(2).max(50).trim().required(),
    lastName: joi.string().min(2).max(50).trim().required(),
    phone: customValidators.nigerianPhone.required(),
    role: joi.string().valid('student', 'staff').required(),
    matricNumber: joi.when('role', {
      is: 'student',
      then: customValidators.matricNumber.required(),
      otherwise: joi.forbidden(),
    }),
    staffId: joi.when('role', {
      is: 'staff',
      then: customValidators.staffId.required(),
      otherwise: joi.forbidden(),
    }),
    department: joi.string().max(100).trim(),
    faculty: joi.string().max(100).trim(),
  }),

  login: joi.object({
    email: components.email.required(),
    password: joi.string().required(),
  }),

  refreshToken: joi.object({
    refreshToken: joi.string().required(),
  }),

  forgotPassword: joi.object({
    email: components.email.required(),
  }),

  resetPassword: joi.object({
    token: joi.string().required(),
    password: components.password.required(),
    confirmPassword: joi.string().valid(joi.ref('password')).required().messages({
      'any.only': 'Passwords must match',
    }),
  }),

  changePassword: joi.object({
    currentPassword: joi.string().required(),
    newPassword: components.password.required(),
    confirmPassword: joi.string().valid(joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords must match',
    }),
  }),

  verifyEmail: joi.object({
    token: joi.string().required(),
  }),
};

/**
 * User Schemas
 */
const user = {
  updateProfile: joi.object({
    firstName: joi.string().min(2).max(50).trim(),
    lastName: joi.string().min(2).max(50).trim(),
    phone: customValidators.nigerianPhone,
    department: joi.string().max(100).trim(),
    faculty: joi.string().max(100).trim(),
    profilePhoto: joi.string().uri().max(500),
    bio: joi.string().max(500).trim(),
  }),

  updateEmergencyContact: joi.object({
    name: joi.string().min(2).max(100).trim().required(),
    phone: customValidators.nigerianPhone.required(),
    relationship: joi.string().max(50).trim().required(),
    email: joi.string().email().max(255),
  }),

  becomeDriver: joi.object({
    licenseNumber: joi.string().max(50).trim().required(),
    licenseExpiry: joi.date().iso().greater('now').required(),
    vehicle: joi
      .object({
        make: joi.string().max(50).trim().required(),
        model: joi.string().max(50).trim().required(),
        year: joi
          .number()
          .integer()
          .min(2000)
          .max(new Date().getFullYear() + 1)
          .required(),
        color: joi.string().max(30).trim().required(),
        plateNumber: joi
          .string()
          .pattern(patterns.plateNumber)
          .required()
          .messages({ 'string.pattern.base': 'Invalid plate number format (e.g., KWL-123-AB)' }),
        capacity: joi.number().integer().min(1).max(7).required(),
        vehicleType: joi.string().valid('sedan', 'suv', 'minivan', 'hatchback').required(),
      })
      .required(),
  }),
};

/**
 * Ride Schemas
 */
const ride = {
  create: joi.object({
    departureDate: customValidators.dateString.required(),
    departureTime: customValidators.timeString.required(),
    startLocation: components.location.required(),
    endLocation: components.location.required(),
    pickupPoints: joi
      .array()
      .items(
        joi.object({
          name: joi.string().max(200).trim().required(),
          location: components.location.required(),
          estimatedTime: customValidators.timeString.required(),
          orderIndex: joi.number().integer().min(0),
        }),
      )
      .min(0)
      .max(5)
      .default([]),
    availableSeats: joi.number().integer().min(1).max(7).required(),
    pricePerSeat: joi.number().min(100).max(5000).required(),
    waitTimeMinutes: joi.number().integer().min(5).max(15).default(10),
    notes: joi.string().max(500).trim(),
    isRecurring: joi.boolean().default(false),
    recurringDays: joi.when('isRecurring', {
      is: true,
      then: joi.array().items(joi.number().integer().min(0).max(6)).min(1).max(7).required(),
      otherwise: joi.forbidden(),
    }),
    recurringEndDate: joi.when('isRecurring', {
      is: true,
      then: joi.date().iso().greater('now').required(),
      otherwise: joi.forbidden(),
    }),
  }),

  update: joi.object({
    departureTime: customValidators.timeString,
    availableSeats: joi.number().integer().min(1).max(7),
    pricePerSeat: joi.number().min(100).max(5000),
    waitTimeMinutes: joi.number().integer().min(5).max(15),
    notes: joi.string().max(500).trim().allow(''),
    status: joi.string().valid('active', 'cancelled'),
    cancellationReason: joi.when('status', {
      is: 'cancelled',
      then: joi.string().max(500).required(),
      otherwise: joi.forbidden(),
    }),
  }),

  search: joi.object({
    date: customValidators.dateString.required(),
    time: customValidators.timeString,
    fromLat: joi.number().min(-90).max(90),
    fromLng: joi.number().min(-180).max(180),
    toLat: joi.number().min(-90).max(90),
    toLng: joi.number().min(-180).max(180),
    seats: joi.number().integer().min(1).max(7).default(1),
    maxPrice: joi.number().min(100).max(5000),
    radius: joi.number().min(0.5).max(10).default(2), // km
    ...components.pagination,
  }),

  addPickupPoint: joi.object({
    name: joi.string().max(200).trim().required(),
    location: components.location.required(),
    estimatedTime: customValidators.timeString.required(),
  }),
};

/**
 * Booking Schemas
 */
const booking = {
  create: joi.object({
    rideId: joi.string().uuid({ version: 'uuidv4' }).required(),
    pickupPointId: joi.string().uuid({ version: 'uuidv4' }),
    seats: joi.number().integer().min(1).max(4).default(1),
    notes: joi.string().max(500).trim(),
    paymentMethod: joi.string().valid('cash').default('cash'), // Phase 1: cash only
  }),

  cancel: joi.object({
    reason: joi.string().max(500).trim().required(),
  }),

  startRide: joi.object({
    passengerCode: joi.string().length(4).pattern(/^\d+$/).required(),
  }),

  completeRide: joi.object({
    cashReceived: joi.boolean().required(),
    actualAmount: joi.number().min(0),
  }),

  list: joi.object({
    status: joi
      .string()
      .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
    dateFrom: joi.date().iso(),
    dateTo: joi.date().iso(),
    asDriver: joi.boolean().default(false),
    ...components.pagination,
  }),
};

/**
 * Rating Schemas
 */
const rating = {
  create: joi.object({
    bookingId: joi.string().uuid({ version: 'uuidv4' }).required(),
    score: joi.number().integer().min(1).max(5).required(),
    comment: joi.string().max(500).trim(),
    tags: joi
      .array()
      .items(joi.string().valid('punctual', 'friendly', 'clean_car', 'safe_driver', 'good_music'))
      .max(5),
  }),

  update: joi.object({
    score: joi.number().integer().min(1).max(5),
    comment: joi.string().max(500).trim(),
  }),
};

/**
 * Notification Schemas
 */
const notification = {
  markRead: joi.object({
    notificationIds: joi
      .array()
      .items(joi.string().uuid({ version: 'uuidv4' }))
      .min(1)
      .max(50),
  }),

  updatePreferences: joi.object({
    email: joi.boolean(),
    push: joi.boolean(),
    sms: joi.boolean(),
    rideReminders: joi.boolean(),
    bookingUpdates: joi.boolean(),
    promotions: joi.boolean(),
  }),
};

/**
 * Report Schemas
 */
const report = {
  cashCollection: joi.object({
    date: customValidators.dateString,
    startDate: customValidators.dateString,
    endDate: customValidators.dateString,
  }),

  driverSummary: joi.object({
    driverId: joi.string().uuid({ version: 'uuidv4' }),
    startDate: customValidators.dateString.required(),
    endDate: customValidators.dateString.required(),
  }),
};

/**
 * Vehicle Schemas
 */
const vehicle = {
  create: joi.object({
    make: joi.string().max(50).trim().required(),
    model: joi.string().max(50).trim().required(),
    year: joi
      .number()
      .integer()
      .min(2000)
      .max(new Date().getFullYear() + 1)
      .required(),
    color: joi.string().max(30).trim().required(),
    plateNumber: joi.string().pattern(patterns.plateNumber).required().messages({
      'string.pattern.base': 'Invalid plate number format (e.g., KWL-123-AB)',
    }),
    capacity: joi.number().integer().min(1).max(7).required(),
    vehicleType: joi.string().valid('sedan', 'suv', 'minivan', 'hatchback').required(),
    insuranceNumber: joi.string().max(50).trim(),
    insuranceExpiry: joi.date().iso().greater('now'),
  }),

  update: joi.object({
    color: joi.string().max(30).trim(),
    capacity: joi.number().integer().min(1).max(7),
    insuranceNumber: joi.string().max(50).trim(),
    insuranceExpiry: joi.date().iso().greater('now'),
    isActive: joi.boolean(),
  }),
};

/**
 * Admin Schemas
 */
const admin = {
  verifyDriver: joi.object({
    userId: joi.string().uuid({ version: 'uuidv4' }).required(),
    approved: joi.boolean().required(),
    rejectionReason: joi.when('approved', {
      is: false,
      then: joi.string().max(500).required(),
      otherwise: joi.forbidden(),
    }),
  }),

  updateUserStatus: joi.object({
    userId: joi.string().uuid({ version: 'uuidv4' }).required(),
    status: joi.string().valid('active', 'suspended', 'banned').required(),
    reason: joi.string().max(500).trim().required(),
  }),

  userSearch: joi.object({
    query: joi.string().max(100).trim(),
    role: joi.string().valid('student', 'staff', 'admin'),
    isDriver: joi.boolean(),
    status: joi.string().valid('active', 'suspended', 'banned', 'pending'),
    ...components.pagination,
  }),
};

/**
 * Validation Helper Functions
 */
const helpers = {
  /**
   * Validate data against a schema
   * @param {Object} data - Data to validate
   * @param {Joi.Schema} schema - Joi schema
   * @returns {Object} { value, error }
   */
  validate: (data, schema) => {
    const result = schema.validate(data);
    if (result.error) {
      return {
        value: null,
        error: {
          message: 'Validation failed',
          details: result.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          })),
        },
      };
    }
    return { value: result.value, error: null };
  },

  /**
   * Create validation middleware
   * @param {Joi.Schema} schema - Joi schema
   * @param {string} property - Request property to validate (body, query, params)
   */
  validateMiddleware:
    (schema, property = 'body') =>
    (req, res, next) => {
      const { value, error } = helpers.validate(req[property], schema);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            ...error,
          },
        });
      }
      req[property] = value;
      return next();
    },

  /**
   * Async validation helper
   */
  validateAsync: async (data, schema) => {
    try {
      const value = await schema.validateAsync(data);
      return { value, error: null };
    } catch (err) {
      return {
        value: null,
        error: {
          message: 'Validation failed',
          details: err.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          })),
        },
      };
    }
  },

  /**
   * Sanitize string (remove dangerous characters)
   */
  sanitizeString: (str) => {
    if (!str) return str;
    return str.replace(/[<>]/g, '').replace(/&/g, '&amp;').trim();
  },
};

/**
 * Convenience validators for AuthService
 */
const validateRegistration = (data) => helpers.validate(data, auth.register);
const validateLogin = (data) => helpers.validate(data, auth.login);

module.exports = {
  joi,
  patterns,
  customValidators,
  components,
  schemas: {
    auth,
    user,
    ride,
    booking,
    rating,
    notification,
    report,
    vehicle,
    admin,
  },
  validateRegistration,
  validateLogin,
  ...helpers,
};
