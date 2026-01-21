/**
 * DynamoDB Client Configuration
 * University of Ilorin Carpooling Platform
 * Configures DynamoDB client for both local development and AWS environments
 */

const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

/**
 * Environment configuration
 */
const config = {
  region: process.env.AWS_REGION || 'eu-west-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined, // For local DynamoDB
  credentials:
    process.env.NODE_ENV === 'development' && process.env.DYNAMODB_ENDPOINT
      ? {
          accessKeyId: 'dummy',
          secretAccessKey: 'dummy',
        }
      : undefined,
};

/**
 * Create base DynamoDB client
 */
const dynamoDBClient = new DynamoDBClient(config);

/**
 * Document client configuration with marshalling options
 */
const marshallOptions = {
  // Whether to automatically convert empty strings, blobs, and sets to `null`
  convertEmptyValues: false,
  // Whether to remove undefined values while marshalling
  removeUndefinedValues: true,
  // Whether to convert typeof object to map attribute
  convertClassInstanceToMap: true,
};

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers
  wrapNumbers: false,
};

const translateConfig = { marshallOptions, unmarshallOptions };

/**
 * DynamoDB Document Client - handles marshalling/unmarshalling automatically
 */
const docClient = DynamoDBDocumentClient.from(dynamoDBClient, translateConfig);

/**
 * Table name based on environment
 */
const getTableName = () => {
  const env = process.env.NODE_ENV || 'development';
  const baseTableName = process.env.DYNAMODB_TABLE || 'carpool-main';

  // For development, use the table name as-is or append -dev
  if (env === 'development') {
    return baseTableName.includes('-dev') ? baseTableName : `${baseTableName}-dev`;
  }

  // For other environments, use the exact table name from env
  return baseTableName;
};

/**
 * Global Secondary Indexes
 */
const GSI = {
  GSI1: 'GSI1', // User/Email queries, Driver's rides
  GSI2: 'GSI2', // Date/Time queries, Ride bookings
  GSI3: 'GSI3', // Location/Route queries, User bookings
  GSI4: 'GSI4', // Status queries
};

/**
 * Common query parameters
 */
const commonParams = {
  TableName: getTableName(),
};

/**
 * Utility function to build query parameters
 */
const buildQueryParams = (params) => ({
  ...commonParams,
  ...params,
});

/**
 * Error handler for DynamoDB operations
 */
const handleDynamoDBError = (error, operation) => {
  console.error(`DynamoDB ${operation} Error:`, {
    name: error.name,
    message: error.message,
    code: error.$metadata?.httpStatusCode,
  });

  // Map DynamoDB errors to application errors
  const errorMap = {
    ResourceNotFoundException: 'Resource not found',
    ConditionalCheckFailedException: 'Condition check failed',
    ProvisionedThroughputExceededException: 'Request rate too high',
    ValidationException: 'Invalid request parameters',
    ItemCollectionSizeLimitExceededException: 'Item collection too large',
  };

  const message = errorMap[error.name] || error.message;
  throw new Error(`${operation} failed: ${message}`);
};

/**
 * Health check function
 */
const healthCheck = async () => {
  try {
    const command = new DescribeTableCommand({ TableName: getTableName() });
    await dynamoDBClient.send(command);
    return { healthy: true, table: getTableName() };
  } catch (error) {
    console.error('DynamoDB health check failed:', error.message);
    return { healthy: false, error: error.message };
  }
};

/**
 * Batch write helper with automatic chunking
 */
const batchWriteWithRetry = async (items, maxRetries = 3) => {
  const BATCH_SIZE = 25; // DynamoDB limit

  // Create chunks using array methods
  const chunks = Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, i) =>
    items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
  );

  const processChunk = async (chunk) => {
    let retries = 0;
    let unprocessedItems = chunk;

    const processWithRetry = async () => {
      if (unprocessedItems.length === 0 || retries >= maxRetries) {
        return;
      }

      const params = {
        RequestItems: {
          [getTableName()]: unprocessedItems.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      };

      const result = await docClient.send(new BatchWriteCommand(params));

      unprocessedItems =
        result.UnprocessedItems?.[getTableName()]?.map((req) => req.PutRequest.Item) || [];

      if (unprocessedItems.length > 0) {
        retries += 1;
        // Exponential backoff
        const delay = 2 ** retries * 100;
        await new Promise((resolve) => {
          setTimeout(resolve, delay);
        });
        processWithRetry();
      }
    };

    await processWithRetry();

    if (unprocessedItems.length > 0) {
      throw new Error(
        `Failed to process ${unprocessedItems.length} items after ${maxRetries} retries`,
      );
    }
  };

  // Process all chunks in parallel
  await Promise.all(chunks.map(processChunk));
};

/**
 * Export configuration and clients
 */
module.exports = {
  // Clients
  dynamoDBClient,
  docClient,

  // Configuration
  getTableName,
  GSI,
  commonParams,

  // Utilities
  buildQueryParams,
  handleDynamoDBError,
  healthCheck,
  batchWriteWithRetry,

  // Constants
  TABLE_NAME: getTableName(),
  MAX_BATCH_SIZE: 25,
  MAX_QUERY_LIMIT: 1000,
};
