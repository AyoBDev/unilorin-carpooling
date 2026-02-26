const {
  errorHandler,
  notFoundHandler,
  buildErrorResponse,
  handleAppError,
  handleJoiError,
  handleJwtError,
  handleSyntaxError,
  handleAwsError,
  handleGenericError,
} = require('../../../../src/api/middlewares/error.middleware');
const { createMockReq, createMockRes, createMockNext } = require('../../../helpers');

// Mock the logger
jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
    process.env.NODE_ENV = 'test';
  });

  describe('buildErrorResponse()', () => {
    it('should build structured error response', () => {
      const result = buildErrorResponse({
        code: 'TEST_ERROR',
        message: 'Something failed',
        statusCode: 400,
      });

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error.code).toBe('TEST_ERROR');
      expect(result.body.error.message).toBe('Something failed');
      expect(result.body.timestamp).toBeDefined();
    });

    it('should include details when provided', () => {
      const result = buildErrorResponse({
        code: 'TEST',
        message: 'test',
        statusCode: 400,
        details: { field: 'email' },
      });

      expect(result.body.error.details).toEqual({ field: 'email' });
    });

    it('should include stack in non-production', () => {
      process.env.NODE_ENV = 'development';
      const result = buildErrorResponse({
        code: 'TEST',
        message: 'test',
        statusCode: 500,
        stack: 'Error: test\n    at ...',
      });

      expect(result.body.error.stack).toBeDefined();
    });

    it('should exclude stack in production', () => {
      process.env.NODE_ENV = 'production';
      const result = buildErrorResponse({
        code: 'TEST',
        message: 'test',
        statusCode: 500,
        stack: 'Error: test\n    at ...',
      });

      expect(result.body.error.stack).toBeUndefined();
    });
  });

  describe('handleAppError()', () => {
    it('should handle AppError instances', () => {
      const err = {
        isAppError: true,
        errorCode: 'CUSTOM_ERROR',
        message: 'Custom error',
        statusCode: 422,
        errors: [{ field: 'name' }],
        stack: 'stack trace',
      };

      const result = handleAppError(err);
      expect(result.statusCode).toBe(422);
      expect(result.body.error.code).toBe('CUSTOM_ERROR');
    });
  });

  describe('handleJoiError()', () => {
    it('should format Joi validation errors', () => {
      const joiError = {
        isJoi: true,
        details: [
          {
            path: ['email'],
            message: '"email" is required',
            type: 'any.required',
          },
          {
            path: ['password'],
            message: '"password" must be at least 8 characters',
            type: 'string.min',
          },
        ],
      };

      const result = handleJoiError(joiError);
      expect(result.statusCode).toBe(400);
      expect(result.body.error.code).toBe('VALIDATION_ERROR');
      expect(result.body.error.details).toHaveLength(2);
      expect(result.body.error.details[0].field).toBe('email');
    });

    it('should handle empty details', () => {
      const result = handleJoiError({ details: [] });
      expect(result.body.error.details).toEqual([]);
    });
  });

  describe('handleJwtError()', () => {
    it('should handle JsonWebTokenError', () => {
      const err = { name: 'JsonWebTokenError', stack: 'stack' };
      const result = handleJwtError(err);
      expect(result.statusCode).toBe(401);
      expect(result.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('should handle TokenExpiredError', () => {
      const err = { name: 'TokenExpiredError', stack: 'stack' };
      const result = handleJwtError(err);
      expect(result.statusCode).toBe(401);
      expect(result.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('should handle NotBeforeError', () => {
      const err = { name: 'NotBeforeError', stack: 'stack' };
      const result = handleJwtError(err);
      expect(result.statusCode).toBe(401);
      expect(result.body.error.code).toBe('AUTH_TOKEN_NOT_ACTIVE');
    });
  });

  describe('handleSyntaxError()', () => {
    it('should handle malformed JSON', () => {
      const err = {
        name: 'SyntaxError',
        status: 400,
        body: true,
        message: 'Unexpected token',
        stack: 'stack',
      };

      const result = handleSyntaxError(err);
      expect(result.statusCode).toBe(400);
      expect(result.body.error.code).toBe('INVALID_JSON');
    });
  });

  describe('handleAwsError()', () => {
    it('should handle throttling errors', () => {
      const err = { code: 'ProvisionedThroughputExceededException', stack: 'stack' };
      const result = handleAwsError(err);
      expect(result.statusCode).toBe(503);
      expect(result.body.error.code).toBe('SERVICE_THROTTLED');
    });

    it('should handle ConditionalCheckFailedException', () => {
      const err = { code: 'ConditionalCheckFailedException', stack: 'stack' };
      const result = handleAwsError(err);
      expect(result.statusCode).toBe(409);
      expect(result.body.error.code).toBe('CONFLICT');
    });

    it('should return null for unrecognized AWS errors', () => {
      const err = { code: 'SomeOtherError' };
      expect(handleAwsError(err)).toBeNull();
    });
  });

  describe('handleGenericError()', () => {
    it('should handle unknown errors', () => {
      const err = { message: 'Something broke', stack: 'stack' };
      const result = handleGenericError(err);
      expect(result.statusCode).toBe(500);
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('errorHandler()', () => {
    it('should handle AppError', () => {
      const err = {
        isAppError: true,
        code: 'NOT_FOUND',
        message: 'User not found',
        statusCode: 404,
        stack: 'stack',
      };

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalled();
      expect(res._body.error.code).toBe('NOT_FOUND');
    });

    it('should handle Joi error', () => {
      const err = {
        isJoi: true,
        details: [{ path: ['email'], message: 'required', type: 'any.required' }],
        stack: 'stack',
      };

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle JWT error', () => {
      const err = { name: 'JsonWebTokenError', stack: 'stack' };

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle SyntaxError with status 400 and body', () => {
      const err = Object.assign(new SyntaxError('Unexpected token'), {
        status: 400,
        body: 'invalid json',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res._body.error.code).toBe('INVALID_JSON');
    });

    it('should handle generic errors', () => {
      const err = new Error('Unknown error');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res._body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should not send if headers already sent', () => {
      res.headersSent = true;
      const err = new Error('test');

      errorHandler(err, req, res, next);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('notFoundHandler()', () => {
    it('should return 404 with route info', () => {
      req.method = 'GET';
      req.originalUrl = '/api/v1/unknown';

      notFoundHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res._body.error.code).toBe('ROUTE_NOT_FOUND');
      expect(res._body.error.message).toContain('GET');
      expect(res._body.error.message).toContain('/api/v1/unknown');
    });
  });
});
