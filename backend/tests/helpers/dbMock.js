/**
 * Database Mock Helper
 * Provides mock DynamoDB client and repository methods
 */

const createMockDynamoClient = () => ({
  send: jest.fn(),
});

const createMockRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  findOne: jest.fn(),
  findMany: jest.fn(),
  batchGet: jest.fn(),
  batchWrite: jest.fn(),
  count: jest.fn(),
});

module.exports = {
  createMockDynamoClient,
  createMockRepository,
};
