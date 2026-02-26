const {
  success,
  error,
  ok,
  created,
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
  paginate,
  paginatedSuccess,
  transform,
  HTTP_STATUS,
  send,
  lambdaResponse,
} = require('../../../../src/shared/utils/response');

describe('Response Utility', () => {
  describe('HTTP_STATUS', () => {
    it('should have standard status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('success()', () => {
    it('should build default success response', () => {
      const result = success();
      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.body.message).toBe('Operation successful');
      expect(result.body.timestamp).toBeDefined();
    });

    it('should include data and meta', () => {
      const result = success({
        data: { id: 1 },
        meta: { total: 10 },
        message: 'Found',
      });
      expect(result.body.data).toEqual({ id: 1 });
      expect(result.body.meta).toEqual({ total: 10 });
      expect(result.body.message).toBe('Found');
    });
  });

  describe('error()', () => {
    it('should build default error response', () => {
      const result = error();
      expect(result.statusCode).toBe(500);
      expect(result.body.success).toBe(false);
      expect(result.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should include details when provided', () => {
      const result = error({ details: { field: 'email' } });
      expect(result.body.error.details).toEqual({ field: 'email' });
    });
  });

  describe('pre-built success responses', () => {
    it('ok() returns 200', () => {
      const result = ok({ id: 1 });
      expect(result.statusCode).toBe(200);
      expect(result.body.data).toEqual({ id: 1 });
    });

    it('created() returns 201', () => {
      const result = created({ id: 1 });
      expect(result.statusCode).toBe(201);
    });

    it('noContent() returns 204 with null body', () => {
      const result = noContent();
      expect(result.statusCode).toBe(204);
      expect(result.body).toBeNull();
    });
  });

  describe('pre-built error responses', () => {
    it('badRequest() returns 400', () => {
      const result = badRequest('Invalid data');
      expect(result.statusCode).toBe(400);
      expect(result.body.error.code).toBe('BAD_REQUEST');
    });

    it('unauthorized() returns 401', () => {
      const result = unauthorized();
      expect(result.statusCode).toBe(401);
      expect(result.body.error.code).toBe('UNAUTHORIZED');
    });

    it('forbidden() returns 403', () => {
      const result = forbidden();
      expect(result.statusCode).toBe(403);
    });

    it('notFound() returns 404', () => {
      const result = notFound('User');
      expect(result.statusCode).toBe(404);
      expect(result.body.error.message).toBe('User not found');
    });

    it('conflict() returns 409', () => {
      const result = conflict();
      expect(result.statusCode).toBe(409);
    });

    it('validationError() returns 422', () => {
      const result = validationError([{ field: 'email' }]);
      expect(result.statusCode).toBe(422);
      expect(result.body.error.details).toBeDefined();
    });

    it('tooManyRequests() returns 429', () => {
      const result = tooManyRequests();
      expect(result.statusCode).toBe(429);
      expect(result.body.error.details.retryAfter).toBe(60);
    });

    it('internalError() returns 500', () => {
      const result = internalError();
      expect(result.statusCode).toBe(500);
    });

    it('serviceUnavailable() returns 503', () => {
      const result = serviceUnavailable();
      expect(result.statusCode).toBe(503);
    });
  });

  describe('paginate()', () => {
    it('should calculate pagination metadata', () => {
      const result = paginate([1, 2, 3], { page: 1, limit: 10, total: 25 });
      expect(result.data).toEqual([1, 2, 3]);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);
      expect(result.pagination.nextPage).toBe(2);
      expect(result.pagination.prevPage).toBeNull();
    });

    it('should handle last page', () => {
      const result = paginate([], { page: 3, limit: 10, total: 25 });
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
      expect(result.pagination.nextPage).toBeNull();
      expect(result.pagination.prevPage).toBe(2);
    });
  });

  describe('paginatedSuccess()', () => {
    it('should build paginated success response', () => {
      const result = paginatedSuccess([1, 2], { page: 1, limit: 10, total: 2 });
      expect(result.statusCode).toBe(200);
      expect(result.body.meta.pagination).toBeDefined();
      expect(result.body.meta.pagination.total).toBe(2);
    });
  });

  describe('transform()', () => {
    it('should remove sensitive fields', () => {
      const data = {
        userId: '123',
        email: 'test@test.com',
        passwordHash: 'secret',
        refreshToken: 'token',
      };
      const result = transform(data);
      expect(result.userId).toBe('123');
      expect(result.email).toBe('test@test.com');
      expect(result.passwordHash).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });

    it('should handle null input', () => {
      expect(transform(null)).toBeNull();
    });

    it('should handle arrays', () => {
      const data = [
        { id: 1, passwordHash: 'x' },
        { id: 2, passwordHash: 'y' },
      ];
      const result = transform(data);
      expect(result).toHaveLength(2);
      expect(result[0].passwordHash).toBeUndefined();
      expect(result[1].passwordHash).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(transform('hello')).toBe('hello');
      expect(transform(42)).toBe(42);
    });

    it('should use custom exclude list', () => {
      const data = { name: 'test', secret: 'hidden' };
      const result = transform(data, { exclude: ['secret'] });
      expect(result.secret).toBeUndefined();
      expect(result.name).toBe('test');
    });
  });

  describe('send()', () => {
    it('should send JSON response', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      send(res, ok({ id: 1 }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle null body (204)', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };
      send(res, noContent());
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('lambdaResponse()', () => {
    it('should format for API Gateway', () => {
      const result = lambdaResponse(ok({ id: 1 }));
      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(result.body)).toBeDefined();
    });

    it('should handle empty body', () => {
      const result = lambdaResponse(noContent());
      expect(result.body).toBe('');
    });
  });
});
