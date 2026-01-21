/**
 * RideRepository
 * University of Ilorin Carpooling Platform
 *
 * Handles all database operations for ride offers
 * Implements single-table design with DynamoDB
 */

const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

const { docClient, getTableName, GSI, handleDynamoDBError } = require('../config/dynamodb.config');

class RideRepository {
  constructor() {
    this.tableName = getTableName();
  }

  /**
   * Generate partition and sort keys for a ride
   */
  _generateKeys(rideId, date) {
    return {
      PK: `RIDE#${date}`, // Partition by date for efficient querying
      SK: `RIDE#${rideId}`,
    };
  }

  /**
   * Generate GSI keys for indexing
   */
  _generateGSIKeys(driverId, departureDate, departureTime, status = 'active') {
    return {
      GSI1PK: `DRIVER#${driverId}`, // For querying driver's rides
      GSI1SK: `${departureDate}#${departureTime}`,
      GSI2PK: `DATE#${departureDate}`, // For querying rides by date
      GSI2SK: `TIME#${departureTime}#${status}`,
      GSI4PK: `STATUS#${status}`, // For querying by status
      GSI4SK: `${departureDate}#${departureTime}`,
    };
  }

  /**
   * Create a new ride offer
   * @param {Object} rideData - Ride information
   * @returns {Promise<Object>} Created ride
   */
  async create(rideData) {
    try {
      const {
        rideId,
        driverId,
        departureDate,
        departureTime,
        route,
        pickupPoints,
        availableSeats,
        totalSeats,
        pricePerSeat,
        vehicleId,
        status = 'active',
        waitTime = 10,
        recurring = false,
        recurringDays = [],
        preferences = {},
        createdAt = new Date().toISOString(),
      } = rideData;

      const keys = this._generateKeys(rideId, departureDate);
      const gsiKeys = this._generateGSIKeys(driverId, departureDate, departureTime, status);

      const item = {
        ...keys,
        ...gsiKeys,
        entityType: 'RIDE',
        rideId,
        driverId,
        departureDate,
        departureTime,
        route: {
          startLocation: route.startLocation,
          endLocation: route.endLocation,
          distance: route.distance,
          estimatedDuration: route.estimatedDuration,
        },
        pickupPoints: pickupPoints || [],
        availableSeats,
        totalSeats,
        bookedSeats: 0,
        pricePerSeat,
        vehicleId,
        status,
        waitTime,
        recurring,
        recurringDays,
        preferences,
        bookingCount: 0,
        completedBookings: 0,
        createdAt,
        updatedAt: createdAt,
      };

      const params = {
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      };

      await docClient.send(new PutCommand(params));
      return item;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Ride already exists');
      }
      return handleDynamoDBError(error, 'CreateRide');
    }
  }

  /**
   * Get ride by ID and date
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @returns {Promise<Object|null>} Ride data or null
   */
  async getById(rideId, date) {
    try {
      const keys = this._generateKeys(rideId, date);

      const params = {
        TableName: this.tableName,
        Key: keys,
      };

      const result = await docClient.send(new GetCommand(params));
      return result.Item || null;
    } catch (error) {
      return handleDynamoDBError(error, 'GetRide');
    }
  }

  /**
   * Update ride information
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated ride
   */
  async update(rideId, date, updates) {
    try {
      const keys = this._generateKeys(rideId, date);

      // Build update expression dynamically
      const allowedUpdates = [
        'availableSeats',
        'bookedSeats',
        'pricePerSeat',
        'status',
        'pickupPoints',
        'waitTime',
        'preferences',
        'route',
        'departureTime',
      ];

      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          const placeholder = `#${key}`;
          const valuePlaceholder = `:${key}`;
          updateExpression.push(`${placeholder} = ${valuePlaceholder}`);
          expressionAttributeNames[placeholder] = key;
          expressionAttributeValues[valuePlaceholder] = updates[key];
        }
      });

      // Always update the updatedAt timestamp
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // Update GSI keys if status changes
      if (updates.status) {
        const ride = await this.getById(rideId, date);
        if (ride) {
          const gsiKeys = this._generateGSIKeys(
            ride.driverId,
            ride.departureDate,
            ride.departureTime,
            updates.status,
          );
          Object.entries(gsiKeys).forEach(([key, value]) => {
            updateExpression.push(`#${key} = :${key}`);
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = value;
          });
        }
      }

      const params = {
        TableName: this.tableName,
        Key: keys,
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
      };

      const result = await docClient.send(new UpdateCommand(params));
      return result.Attributes;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Ride not found');
      }
      return handleDynamoDBError(error, 'UpdateRide');
    }
  }

  /**
   * Delete/Cancel a ride
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @returns {Promise<boolean>} Success status
   */
  async delete(rideId, date) {
    try {
      const keys = this._generateKeys(rideId, date);

      const params = {
        TableName: this.tableName,
        Key: keys,
        ConditionExpression: 'attribute_exists(PK) AND bookedSeats = :zero',
        ExpressionAttributeValues: {
          ':zero': 0,
        },
      };

      await docClient.send(new DeleteCommand(params));
      return true;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Cannot delete ride with existing bookings');
      }
      return handleDynamoDBError(error, 'DeleteRide');
    }
  }

  /**
   * Cancel a ride (soft delete)
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated ride
   */
  async cancel(rideId, date, reason) {
    return this.update(rideId, date, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: new Date().toISOString(),
    });
  }

  /**
   * Search rides by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of rides
   */
  async searchByDateRange(startDate, endDate, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null, status = 'active' } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI2,
        KeyConditionExpression: 'GSI2PK BETWEEN :startDate AND :endDate',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':startDate': `DATE#${startDate}`,
          ':endDate': `DATE#${endDate}`,
          ':status': status,
        },
        Limit: limit,
        ScanIndexForward: true, // Ascending order
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      return handleDynamoDBError(error, 'SearchRidesByDateRange');
    }
  }

  /**
   * Get driver's rides
   * @param {string} driverId - Driver identifier
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of driver's rides
   */
  async getByDriverId(driverId, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null, startDate = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI1,
        KeyConditionExpression: 'GSI1PK = :driverId',
        ExpressionAttributeValues: {
          ':driverId': `DRIVER#${driverId}`,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
      };

      if (startDate) {
        params.KeyConditionExpression += ' AND GSI1SK >= :startDate';
        params.ExpressionAttributeValues[':startDate'] = startDate;
      }

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      return handleDynamoDBError(error, 'GetDriverRides');
    }
  }

  /**
   * Search available rides by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>} Matching rides
   */
  async searchAvailableRides(criteria) {
    try {
      const { date, minSeats = 1, maxPrice = null, status = 'active', limit = 50 } = criteria;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI2,
        KeyConditionExpression: 'GSI2PK = :date',
        FilterExpression: '#status = :status AND availableSeats >= :minSeats',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':date': `DATE#${date}`,
          ':status': status,
          ':minSeats': minSeats,
        },
        Limit: limit,
      };

      if (maxPrice) {
        params.FilterExpression += ' AND pricePerSeat <= :maxPrice';
        params.ExpressionAttributeValues[':maxPrice'] = maxPrice;
      }

      const result = await docClient.send(new QueryCommand(params));
      return result.Items || [];
    } catch (error) {
      return handleDynamoDBError(error, 'SearchAvailableRides');
    }
  }

  /**
   * Update available seats (for booking)
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @param {number} seatsChange - Number of seats to add/remove
   * @returns {Promise<Object>} Updated ride
   */
  async updateAvailableSeats(rideId, date, seatsChange) {
    try {
      const keys = this._generateKeys(rideId, date);

      const params = {
        TableName: this.tableName,
        Key: keys,
        UpdateExpression:
          'SET availableSeats = availableSeats + :change, bookedSeats = bookedSeats - :change, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':change': seatsChange,
          ':updatedAt': new Date().toISOString(),
          ':zero': 0,
        },
        ConditionExpression: 'attribute_exists(PK) AND availableSeats + :change >= :zero',
        ReturnValues: 'ALL_NEW',
      };

      const result = await docClient.send(new UpdateCommand(params));
      return result.Attributes;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('Insufficient seats available');
      }
      return handleDynamoDBError(error, 'UpdateAvailableSeats');
    }
  }

  /**
   * Increment booking count
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @returns {Promise<Object>} Updated ride
   */
  async incrementBookingCount(rideId, date) {
    try {
      const keys = this._generateKeys(rideId, date);

      const params = {
        TableName: this.tableName,
        Key: keys,
        UpdateExpression:
          'SET bookingCount = if_not_exists(bookingCount, :zero) + :inc, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };

      const result = await docClient.send(new UpdateCommand(params));
      return result.Attributes;
    } catch (error) {
      return handleDynamoDBError(error, 'IncrementBookingCount');
    }
  }

  /**
   * Complete a ride
   * @param {string} rideId - Ride identifier
   * @param {string} date - Departure date
   * @returns {Promise<Object>} Updated ride
   */
  async completeRide(rideId, date) {
    return this.update(rideId, date, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Get rides by status
   * @param {string} status - Ride status
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Rides with pagination
   */
  async getByStatus(status, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI4,
        KeyConditionExpression: 'GSI4PK = :status',
        ExpressionAttributeValues: {
          ':status': `STATUS#${status}`,
        },
        Limit: limit,
        ScanIndexForward: true,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      return handleDynamoDBError(error, 'GetRidesByStatus');
    }
  }

  /**
   * Batch get rides by IDs
   * @param {Array} rideKeys - Array of {rideId, date} objects
   * @returns {Promise<Array>} List of rides
   */
  async batchGet(rideKeys) {
    try {
      const keys = rideKeys.map(({ rideId, date }) => this._generateKeys(rideId, date));

      const params = {
        RequestItems: {
          [this.tableName]: {
            Keys: keys,
          },
        },
      };

      const result = await docClient.send(new BatchGetCommand(params));
      return result.Responses[this.tableName] || [];
    } catch (error) {
      return handleDynamoDBError(error, 'BatchGetRides');
    }
  }
}

module.exports = RideRepository;
