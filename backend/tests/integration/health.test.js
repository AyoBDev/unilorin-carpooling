const request = require('supertest');

// Mock Redis before requiring app
jest.mock('../../src/infrastructure/cache/RedisClient', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue('ok'),
}));

// Mock the logger to silence output
jest.mock('../../src/shared/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

// Mock rate limiter — return a passthrough middleware for every export
const passthroughMiddleware = (req, res, next) => next();
jest.mock('../../src/api/middlewares/rateLimiter.middleware', () =>
  new Proxy({}, {
    get: () => passthroughMiddleware,
  }),
);

// Mock the logging middleware
jest.mock('../../src/api/middlewares/logging.middleware', () => ({
  requestLogger: () => (req, res, next) => next(),
  correlationId: (req, res, next) => {
    req.correlationId = 'test-correlation-id';
    next();
  },
}));

const app = require('../../src/app');

describe('Health Endpoint', () => {
  describe('GET /api/v1/health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('PSRide API is running');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });
});
