const AppError = require('../../../../src/shared/errors/AppError');
const ValidationError = require('../../../../src/shared/errors/ValidationError');
const NotFoundError = require('../../../../src/shared/errors/NotFoundError');
const UnauthorizedError = require('../../../../src/shared/errors/UnauthorizedError');
const ForbiddenError = require('../../../../src/shared/errors/ForbiddenError');
const ConflictError = require('../../../../src/shared/errors/ConflictError');
const BadRequestError = require('../../../../src/shared/errors/BadRequestError');

describe('AppError', () => {
  it('should create with default options', () => {
    const error = new AppError('Something went wrong');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
    expect(error.isAppError).toBe(true);
    expect(error.details).toBeNull();
    expect(error.timestamp).toBeDefined();
    expect(error.name).toBe('AppError');
  });

  it('should create with custom options', () => {
    const error = new AppError('Not found', {
      code: 'NOT_FOUND',
      statusCode: 404,
      details: { resource: 'User' },
      isOperational: true,
    });

    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.details).toEqual({ resource: 'User' });
  });

  it('should have stack trace', () => {
    const error = new AppError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).not.toContain('new AppError');
  });

  describe('toJSON', () => {
    it('should serialize without stack by default', () => {
      const error = new AppError('test error', { code: 'TEST', statusCode: 400 });
      const json = error.toJSON();

      expect(json.success).toBe(false);
      expect(json.error.code).toBe('TEST');
      expect(json.error.message).toBe('test error');
      expect(json.error.statusCode).toBe(400);
      expect(json.error.stack).toBeUndefined();
      expect(json.timestamp).toBeDefined();
    });

    it('should include stack when requested', () => {
      const error = new AppError('test');
      const json = error.toJSON(true);

      expect(json.error.stack).toBeDefined();
    });

    it('should include details when present', () => {
      const error = new AppError('test', { details: { field: 'email' } });
      const json = error.toJSON();

      expect(json.error.details).toEqual({ field: 'email' });
    });
  });

  describe('toString', () => {
    it('should format as Name [CODE]: message', () => {
      const error = new AppError('Something failed', { code: 'FAIL' });
      expect(error.toString()).toBe('AppError [FAIL]: Something failed');
    });
  });

  describe('fromError', () => {
    it('should return the same error if already AppError', () => {
      const original = new AppError('already app error');
      const result = AppError.fromError(original);
      expect(result).toBe(original);
    });

    it('should wrap a generic Error', () => {
      const original = new Error('generic error');
      const result = AppError.fromError(original);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('generic error');
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.statusCode).toBe(500);
      expect(result.isOperational).toBe(false);
      expect(result.details.originalError).toBe('Error');
    });

    it('should accept custom options when wrapping', () => {
      const original = new Error('db error');
      const result = AppError.fromError(original, {
        code: 'DB_ERROR',
        statusCode: 503,
      });

      expect(result.code).toBe('DB_ERROR');
      expect(result.statusCode).toBe(503);
    });
  });

  describe('static factory methods', () => {
    it('badRequest', () => {
      const err = AppError.badRequest('Invalid input');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
    });

    it('unauthorized', () => {
      const err = AppError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('forbidden', () => {
      const err = AppError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('notFound', () => {
      const err = AppError.notFound('User');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('User not found');
    });

    it('conflict', () => {
      const err = AppError.conflict('Duplicate entry');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('validationError', () => {
      const err = AppError.validationError();
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('tooManyRequests', () => {
      const err = AppError.tooManyRequests();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(err.details.retryAfter).toBe(60);
    });

    it('internal', () => {
      const err = AppError.internal();
      expect(err.statusCode).toBe(500);
      expect(err.isOperational).toBe(false);
    });

    it('serviceUnavailable', () => {
      const err = AppError.serviceUnavailable();
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('isOperationalError getter', () => {
    it('should return true for operational errors', () => {
      const err = new AppError('test', { isOperational: true });
      expect(err.isOperationalError).toBe(true);
    });

    it('should return false for programming errors', () => {
      const err = new AppError('test', { isOperational: false });
      expect(err.isOperationalError).toBe(false);
    });
  });
});

describe('Error Subclasses', () => {
  describe('ValidationError', () => {
    it('should create with default message', () => {
      const err = new ValidationError();
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('Validation failed');
    });

    it('should format field errors', () => {
      const err = new ValidationError('Bad input', [
        { field: 'email', message: 'required', type: 'required' },
      ]);
      expect(err.errors).toHaveLength(1);
      expect(err.details.errors).toHaveLength(1);
      expect(err.details.errors[0].field).toBe('email');
    });

    it('should create from Joi error', () => {
      const joiError = {
        details: [
          { path: ['email'], message: '"email" is required', type: 'any.required' },
        ],
      };
      const err = ValidationError.fromJoi(joiError);
      expect(err).toBeInstanceOf(ValidationError);
    });

    it('should create for single field', () => {
      const err = ValidationError.forField('name', 'Name is required');
      expect(err.errors[0].field).toBe('name');
    });

    it('should create for required field', () => {
      const err = ValidationError.required('email');
      expect(err.errors[0].type).toBe('required');
    });

    it('should check hasFieldError', () => {
      const err = new ValidationError('fail', [
        { field: 'email', message: 'invalid' },
      ]);
      expect(err.hasFieldError('email')).toBe(true);
      expect(err.hasFieldError('phone')).toBe(false);
    });

    it('should get field error message', () => {
      const err = new ValidationError('fail', [
        { field: 'email', message: 'invalid format' },
      ]);
      expect(err.getFieldError('email')).toBe('invalid format');
      expect(err.getFieldError('phone')).toBeNull();
    });
  });

  describe('NotFoundError', () => {
    it('should create with resource name', () => {
      const err = new NotFoundError('User');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('User not found');
    });

    it('should create with resource and identifier', () => {
      const err = new NotFoundError('User', 'abc-123');
      expect(err.message).toContain('abc-123');
      expect(err.details.identifier).toBe('abc-123');
    });

    it('should have static factory methods', () => {
      expect(NotFoundError.user('id1').resource).toBe('User');
      expect(NotFoundError.ride('id1').resource).toBe('Ride');
      expect(NotFoundError.booking().resource).toBe('Booking');
      expect(NotFoundError.vehicle().resource).toBe('Vehicle');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create with default message', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('should create with reason', () => {
      const err = new UnauthorizedError('Token expired', 'EXPIRED_TOKEN');
      expect(err.reason).toBe('EXPIRED_TOKEN');
      expect(err.details.reason).toBe('EXPIRED_TOKEN');
    });

    it('should have static factory methods', () => {
      expect(UnauthorizedError.missingToken().reason).toBe('MISSING_TOKEN');
      expect(UnauthorizedError.invalidToken().reason).toBe('INVALID_TOKEN');
      expect(UnauthorizedError.expiredToken().reason).toBe('EXPIRED_TOKEN');
      expect(UnauthorizedError.invalidCredentials().reason).toBe('INVALID_CREDENTIALS');
    });

    it('should check if token expired', () => {
      expect(UnauthorizedError.expiredToken().isTokenExpired()).toBe(true);
      expect(UnauthorizedError.invalidToken().isTokenExpired()).toBe(false);
    });

    it('should check if requires login', () => {
      expect(UnauthorizedError.expiredToken().requiresLogin()).toBe(true);
      expect(UnauthorizedError.invalidCredentials().requiresLogin()).toBe(false);
    });
  });

  describe('ForbiddenError', () => {
    it('should create with default message', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('should have static factory methods', () => {
      expect(ForbiddenError.driverOnly().statusCode).toBe(403);
      expect(ForbiddenError.adminOnly().statusCode).toBe(403);
      expect(ForbiddenError.notOwner('ride').statusCode).toBe(403);
      expect(ForbiddenError.driverNotVerified().statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create with default message', () => {
      const err = new ConflictError();
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('should create for duplicate resource', () => {
      const err = ConflictError.duplicate('User', 'email');
      expect(err.message).toContain('email');
      expect(err.details.resource).toBe('User');
    });

    it('should have static factory methods', () => {
      expect(ConflictError.emailExists().statusCode).toBe(409);
      expect(ConflictError.alreadyBooked().statusCode).toBe(409);
      expect(ConflictError.noSeatsAvailable(2, 1).details.available).toBe(1);
    });
  });

  describe('BadRequestError', () => {
    it('should create with default message', () => {
      const err = new BadRequestError();
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
    });

    it('should have static factory methods', () => {
      expect(BadRequestError.missingField('name').statusCode).toBe(400);
      expect(BadRequestError.invalidJson().statusCode).toBe(400);
      expect(BadRequestError.invalidUuid().details.type).toBe('INVALID_UUID');
      expect(BadRequestError.departureInPast().statusCode).toBe(400);
    });
  });
});
