/**
 * DynamoDB Client Configuration
 * University of Ilorin Carpooling Platform
 * 
 * Configures DynamoDB client for both local development and AWS environments
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

/**
 * Environment configuration
 */
const config = {
  region: process.env.AWS_REGION || 'eu-west-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined, // For local DynamoDB
  credentials: process.env.NODE_ENV === 'development' && process.env.DYNAMODB_ENDPOINT
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
    const { DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
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
  const { BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
  const BATCH_SIZE = 25; // DynamoDB limit
  
  const chunks = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    let retries = 0;
    let unprocessedItems = chunk;

    while (unprocessedItems.length > 0 && retries < maxRetries) {
      const params = {
        RequestItems: {
          [getTableName()]: unprocessedItems.map(item => ({
            PutRequest: { Item: item }
          }))
        }
      };

      const result = await docClient.send(new BatchWriteCommand(params));
      
      unprocessedItems = result.UnprocessedItems?.[getTableName()]?.map(
        req => req.PutRequest.Item
      ) || [];

      if (unprocessedItems.length > 0) {
        retries++;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      }
    }

    if (unprocessedItems.length > 0) {
      throw new Error(`Failed to process ${unprocessedItems.length} items after ${maxRetries} retries`);
    }
  }
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