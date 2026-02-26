const {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  sanitizeBody,
  stripHtmlFromBody,
  Joi,
} = require('../../../../src/api/middlewares/validation.middleware');
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

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = createMockReq();
    res = createMockRes();
    next = createMockNext();
  });

  describe('validate()', () => {
    const schema = {
      body: Joi.object({
        email: Joi.string().email().required(),
        name: Joi.string().min(2).required(),
      }),
    };

    it('should pass with valid data', () => {
      req.body = { email: 'test@test.com', name: 'John' };

      validate(schema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should call next with ValidationError on invalid data', () => {
      req.body = { email: 'not-an-email' };

      validate(schema)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe('Validation failed');
    });

    it('should collect multiple errors', () => {
      req.body = {};

      validate(schema)(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should replace req.body with coerced values on success', () => {
      const coerceSchema = {
        body: Joi.object({
          count: Joi.number().default(10),
        }),
      };
      req.body = {};

      validate(coerceSchema)(req, res, next);

      expect(req.body.count).toBe(10);
    });
  });

  describe('validateBody()', () => {
    it('should validate body only', () => {
      const schema = Joi.object({ name: Joi.string().required() });
      req.body = { name: 'Test' };

      validateBody(schema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should fail on invalid body', () => {
      const schema = Joi.object({ name: Joi.string().required() });
      req.body = {};

      validateBody(schema)(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateQuery()', () => {
    it('should validate query parameters', () => {
      const schema = Joi.object({ page: Joi.number().integer().min(1) });
      req.query = { page: 1 };

      validateQuery(schema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should prefix errors with query.', () => {
      const schema = Joi.object({ page: Joi.number().integer().min(1).required() });
      req.query = {};

      validateQuery(schema)(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.errors[0].field).toContain('query.');
    });
  });

  describe('validateParams()', () => {
    it('should validate URL params', () => {
      const schema = Joi.object({
        id: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
      });
      req.params = { id: 'abc-123' };

      validateParams(schema)(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should prefix errors with params.', () => {
      const schema = Joi.object({ id: Joi.string().required() });
      req.params = {};

      validateParams(schema)(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.errors[0].field).toContain('params.');
    });
  });

  describe('sanitizeBody()', () => {
    it('should trim string values in body', () => {
      req.body = {
        name: '  John  ',
        email: ' test@test.com ',
        age: 25,
      };

      sanitizeBody(req, res, next);

      expect(req.body.name).toBe('John');
      expect(req.body.email).toBe('test@test.com');
      expect(req.body.age).toBe(25);
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty body', () => {
      req.body = null;

      sanitizeBody(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('stripHtmlFromBody()', () => {
    it('should remove HTML tags from string values', () => {
      req.body = {
        name: '<script>alert("xss")</script>John',
        bio: 'Hello <b>World</b>',
        count: 5,
      };

      stripHtmlFromBody(req, res, next);

      expect(req.body.name).toBe('alert("xss")John');
      expect(req.body.bio).toBe('Hello World');
      expect(req.body.count).toBe(5);
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty body', () => {
      req.body = null;

      stripHtmlFromBody(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
