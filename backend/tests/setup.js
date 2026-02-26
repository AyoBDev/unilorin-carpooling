/**
 * Jest Test Setup
 * University of Ilorin Carpooling Platform
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_EXPIRY = '1h';
process.env.CACHE_ENABLED = 'false';
process.env.DYNAMODB_TABLE = 'unilorin-carpooling-test';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.AWS_REGION = 'eu-west-1';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:3000';

// Increase timeout for async operations
jest.setTimeout(10000);
