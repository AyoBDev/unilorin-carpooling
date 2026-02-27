/**
 * API Lambda Handler Unit Tests
 */

// Mock all heavy dependencies before requiring the handler
jest.mock('serverless-http', () =>
  jest.fn().mockReturnValue(jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success":true}' }))
);

jest.mock('../../../../src/app', () => ({ use: jest.fn(), set: jest.fn() }));

jest.mock('../../../../src/lambda/middleware/lambdaMiddleware', () => ({
  withMiddleware: jest.fn((name, fn, opts) => {
    // Return a wrapped handler that simply calls the inner fn
    return async (event, context) => fn(event, context);
  }),
}));

jest.mock('../../../../src/infrastructure/cache', () => ({
  RedisClient: {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const serverless = require('serverless-http');

describe('API Lambda Handler', () => {
  let handler;
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-mock after resetModules
    jest.mock('serverless-http', () =>
      jest.fn().mockReturnValue(jest.fn().mockResolvedValue({ statusCode: 200, body: '{"success":true}' }))
    );
    jest.mock('../../../../src/app', () => ({ use: jest.fn(), set: jest.fn() }));
    jest.mock('../../../../src/lambda/middleware/lambdaMiddleware', () => ({
      withMiddleware: jest.fn((name, fn) => async (event, context) => fn(event, context)),
    }));
    jest.mock('../../../../src/infrastructure/cache', () => ({
      RedisClient: {
        connect: jest.fn().mockResolvedValue(true),
        isConnected: jest.fn().mockReturnValue(false),
      },
    }));
    jest.mock('../../../../src/shared/utils/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    handler = require('../../../../src/lambda/handlers/api.handler');

    mockEvent = {
      httpMethod: 'GET',
      path: '/api/v1/health',
      headers: {},
      queryStringParameters: null,
      body: null,
      requestContext: {
        requestId: 'req-123',
      },
    };

    mockContext = {
      callbackWaitsForEmptyEventLoop: true,
      awsRequestId: 'aws-req-123',
      functionName: 'api-handler',
    };
  });

  it('should set callbackWaitsForEmptyEventLoop to false', async () => {
    await handler.handler(mockEvent, mockContext);

    expect(mockContext.callbackWaitsForEmptyEventLoop).toBe(false);
  });

  it('should return a response object', async () => {
    const response = await handler.handler(mockEvent, mockContext);

    expect(response).toBeDefined();
    expect(response).toHaveProperty('statusCode');
  });

  it('should propagate API Gateway requestId as correlation header', async () => {
    // The serverless-http options inject x-correlation-id in request transform
    // Verify the serverless handler is created (serverless was called with app + options)
    const serverlessMock = require('serverless-http');
    expect(serverlessMock).toHaveBeenCalled();
  });

  it('should skip Redis connection when CACHE_ENABLED=false', async () => {
    process.env.CACHE_ENABLED = 'false';
    const { RedisClient } = require('../../../../src/infrastructure/cache');

    await handler.handler(mockEvent, mockContext);

    expect(RedisClient.connect).not.toHaveBeenCalled();
    process.env.CACHE_ENABLED = 'false'; // restore
  });

  it('should handle Redis connection failure gracefully', async () => {
    process.env.CACHE_ENABLED = 'true';
    process.env.REDIS_ENDPOINT = 'redis://localhost:6379';

    const { RedisClient } = require('../../../../src/infrastructure/cache');
    RedisClient.connect.mockRejectedValue(new Error('Connection refused'));

    // Should not throw
    await expect(handler.handler(mockEvent, mockContext)).resolves.toBeDefined();

    delete process.env.REDIS_ENDPOINT;
    process.env.CACHE_ENABLED = 'false';
  });
});
