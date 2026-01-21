/**
 * Base Repository Class
 * Path: src/infrastructure/database/repositories/BaseRepository.js
 *
 * Abstract base class for all repositories with common CRUD operations
 */

const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const logger = require('../../../shared/utils/logger');
const { AppError } = require('../../../shared/errors/AppError');
const { getDocClient, getTableName } = require('../config/dynamodb.config');

class BaseRepository {
  constructor(entityType) {
    this.docClient = getDocClient();
    this.tableName = getTableName();
    this.entityType = entityType;
  }

  /**
   * Create a new item
   * @param {Object} item - Item to create
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created item
   */
  async create(item, options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        Item: {
          ...item,
          EntityType: this.entityType,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || new Date().toISOString(),
        },
        ...options,
      };

      // Add condition to prevent overwrite if specified
      if (options.preventOverwrite) {
        params.ConditionExpression = 'attribute_not_exists(PK)';
      }

      await this.docClient.send(new PutCommand(params));

      logger.debug(`${this.entityType} created`, {
        PK: item.PK || item.id,
        SK: item.SK,
      });

      return params.Item;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new AppError(`${this.entityType} already exists`, 409);
      }
      logger.error(`Failed to create ${this.entityType}`, { error });
      throw new AppError(`Failed to create ${this.entityType}`, 500);
    }
  }

  /**
   * Get an item by primary key
   * @param {string} pk - Partition key
   * @param {string} sk - Sort key
   * @returns {Promise<Object|null>} Item or null
   */
  async get(pk, sk) {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: sk,
        },
      };

      const result = await this.docClient.send(new GetCommand(params));

      if (!result.Item) {
        logger.debug(`${this.entityType} not found`, { pk, sk });
        return null;
      }

      return this.cleanItem(result.Item);
    } catch (error) {
      logger.error(`Failed to get ${this.entityType}`, { error, pk, sk });
      throw new AppError(`Failed to retrieve ${this.entityType}`, 500);
    }
  }

  /**
   * Update an item
   * @param {string} pk - Partition key
   * @param {string} sk - Sort key
   * @param {Object} updates - Fields to update
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated item
   */
  async update(pk, sk, updates, options = {}) {
    try {
      // Remove undefined values and keys
      const cleanUpdates = this.removeUndefined(updates);
      delete cleanUpdates.PK;
      delete cleanUpdates.SK;
      delete cleanUpdates.EntityType;

      // Build update expression
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(cleanUpdates).forEach((key) => {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = cleanUpdates[key];
      });

      // Add updatedAt
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const params = {
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: sk,
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
        ...options,
      };

      // Add condition expression if provided
      if (options.condition) {
        params.ConditionExpression = options.condition;
      }

      const result = await this.docClient.send(new UpdateCommand(params));

      logger.debug(`${this.entityType} updated`, { pk, sk });

      return this.cleanItem(result.Attributes);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new AppError('Update condition failed', 400);
      }
      logger.error(`Failed to update ${this.entityType}`, { error, pk, sk });
      throw new AppError(`Failed to update ${this.entityType}`, 500);
    }
  }

  /**
   * Delete an item
   * @param {string} pk - Partition key
   * @param {string} sk - Sort key
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async delete(pk, sk, options = {}) {
    try {
      const params = {
        TableName: this.tableName,
        Key: {
          PK: pk,
          SK: sk,
        },
        ...options,
      };

      await this.docClient.send(new DeleteCommand(params));

      logger.debug(`${this.entityType} deleted`, { pk, sk });

      return true;
    } catch (error) {
      logger.error(`Failed to delete ${this.entityType}`, { error, pk, sk });
      throw new AppError(`Failed to delete ${this.entityType}`, 500);
    }
  }

  /**
   * Query items by partition key
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Query results
   */
  async query(params) {
    try {
      const queryParams = {
        TableName: this.tableName,
        ...params,
      };

      const result = await this.docClient.send(new QueryCommand(queryParams));

      return {
        items: result.Items ? result.Items.map((item) => this.cleanItem(item)) : [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      logger.error(`Failed to query ${this.entityType}`, { error, params });
      throw new AppError(`Failed to query ${this.entityType}`, 500);
    }
  }

  /**
   * Query with pagination
   * @param {Object} params - Query parameters
   * @param {number} limit - Items per page
   * @param {Object} lastKey - Last evaluated key for pagination
   * @returns {Promise<Object>} Paginated results
   */
  async queryPaginated(params, limit = 20, lastKey = null) {
    const queryParams = {
      ...params,
      Limit: limit,
    };

    if (lastKey) {
      queryParams.ExclusiveStartKey = lastKey;
    }

    return this.query(queryParams);
  }

  /**
   * Scan table (use sparingly)
   * @param {Object} params - Scan parameters
   * @returns {Promise<Object>} Scan results
   */
  async scan(params = {}) {
    try {
      const scanParams = {
        TableName: this.tableName,
        ...params,
      };

      const result = await this.docClient.send(new ScanCommand(scanParams));

      return {
        items: result.Items ? result.Items.map((item) => this.cleanItem(item)) : [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      logger.error(`Failed to scan ${this.entityType}`, { error });
      throw new AppError(`Failed to scan ${this.entityType}`, 500);
    }
  }

  /**
   * Batch get multiple items
   * @param {Array} keys - Array of {PK, SK} objects
   * @returns {Promise<Array>} Items
   */
  async batchGet(keys) {
    try {
      if (!keys || keys.length === 0) {
        return [];
      }

      // DynamoDB BatchGet has a limit of 100 items
      const chunks = this.chunkArray(keys, 100);

      const allItemsPromises = chunks.map(async (chunk) => {
        const params = {
          RequestItems: {
            [this.tableName]: {
              Keys: chunk,
            },
          },
        };

        const result = await this.docClient.send(new BatchGetCommand(params));

        if (result.Responses && result.Responses[this.tableName]) {
          const items = result.Responses[this.tableName].map((item) => this.cleanItem(item));

          // Handle unprocessed items
          if (result.UnprocessedKeys && result.UnprocessedKeys[this.tableName]) {
            logger.warn('Some items were not processed in batch get', {
              count: result.UnprocessedKeys[this.tableName].Keys.length,
            });
          }

          return items;
        }

        return [];
      });

      const allItemsArrays = await Promise.all(allItemsPromises);
      return allItemsArrays.flat();
    } catch (error) {
      logger.error(`Failed to batch get ${this.entityType}`, { error });
      throw new AppError(`Failed to batch get ${this.entityType}`, 500);
    }
  }

  /**
   * Batch write multiple items
   * @param {Array} items - Items to write
   * @param {string} operation - 'put' or 'delete'
   * @returns {Promise<boolean>} Success status
   */
  async batchWrite(items, operation = 'put') {
    try {
      if (!items || items.length === 0) {
        return true;
      }

      // DynamoDB BatchWrite has a limit of 25 items
      const chunks = this.chunkArray(items, 25);

      const writePromises = chunks.map(async (chunk) => {
        const requests = chunk.map((item) => {
          if (operation === 'delete') {
            return {
              DeleteRequest: {
                Key: {
                  PK: item.PK,
                  SK: item.SK,
                },
              },
            };
          }
          return {
            PutRequest: {
              Item: {
                ...item,
                EntityType: this.entityType,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: item.updatedAt || new Date().toISOString(),
              },
            },
          };
        });

        const params = {
          RequestItems: {
            [this.tableName]: requests,
          },
        };

        const result = await this.docClient.send(new BatchWriteCommand(params));

        // Handle unprocessed items
        if (result.UnprocessedItems && result.UnprocessedItems[this.tableName]) {
          logger.warn('Some items were not processed in batch write', {
            count: result.UnprocessedItems[this.tableName].length,
          });
        }
      });

      await Promise.all(writePromises);

      logger.debug(`Batch ${operation} completed for ${this.entityType}`, {
        count: items.length,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to batch write ${this.entityType}`, { error });
      throw new AppError(`Failed to batch write ${this.entityType}`, 500);
    }
  }

  /**
   * Execute transactional write
   * @param {Array} transactItems - Transaction items
   * @returns {Promise<boolean>} Success status
   */
  async transactWrite(transactItems) {
    try {
      const params = {
        TransactItems: transactItems,
      };

      await this.docClient.send(new TransactWriteCommand(params));

      logger.debug('Transaction completed successfully', {
        itemCount: transactItems.length,
      });

      return true;
    } catch (error) {
      if (error.name === 'TransactionCanceledException') {
        logger.error('Transaction cancelled', {
          reasons: error.CancellationReasons,
        });
        throw new AppError('Transaction failed', 400);
      }
      logger.error('Failed to execute transaction', { error });
      throw new AppError('Failed to execute transaction', 500);
    }
  }

  /**
   * Build key condition expression
   * @param {string} pk - Partition key value
   * @param {string} skPrefix - Sort key prefix for begins_with
   * @returns {Object} Query parameters
   */
  buildKeyCondition(pk, skPrefix = null) {
    const params = {
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': pk,
      },
    };

    if (skPrefix) {
      params.KeyConditionExpression += ' AND begins_with(SK, :skPrefix)';
      params.ExpressionAttributeValues[':skPrefix'] = skPrefix;
    }

    return params;
  }

  /**
   * Clean item by removing DynamoDB metadata
   * @param {Object} item - DynamoDB item
   * @returns {Object} Clean item
   */
  cleanItem(item) {
    if (!item) return null;

    // Remove DynamoDB metadata fields if needed
    const cleaned = { ...item };
    delete cleaned.EntityType;

    return cleaned;
  }

  /**
   * Remove undefined values from object
   * @param {Object} obj - Object to clean
   * @returns {Object} Clean object
   */
  removeUndefined(obj) {
    const cleaned = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined && obj[key] !== null) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  /**
   * Chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Build filter expression
   * @param {Object} filters - Filter conditions
   * @returns {Object} Filter expression parameters
   */
  buildFilterExpression(filters) {
    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    Object.keys(filters).forEach((key, index) => {
      const value = filters[key];
      const attrName = `#filter${index}`;
      const attrValue = `:filter${index}`;

      expressionAttributeNames[attrName] = key;

      if (value.operator === 'between') {
        filterExpressions.push(`${attrName} BETWEEN :${key}Start AND :${key}End`);
        expressionAttributeValues[`:${key}Start`] = value.start;
        expressionAttributeValues[`:${key}End`] = value.end;
      } else if (value.operator === 'in') {
        const inValues = value.values.map((v, i) => `:${key}${i}`);
        filterExpressions.push(`${attrName} IN (${inValues.join(', ')})`);
        value.values.forEach((v, i) => {
          expressionAttributeValues[`:${key}${i}`] = v;
        });
      } else if (value.operator === 'contains') {
        filterExpressions.push(`contains(${attrName}, ${attrValue})`);
        expressionAttributeValues[attrValue] = value.value;
      } else {
        // Default to equals
        filterExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeValues[attrValue] = value;
      }
    });

    return {
      FilterExpression: filterExpressions.join(' AND '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    };
  }
}

module.exports = BaseRepository;
