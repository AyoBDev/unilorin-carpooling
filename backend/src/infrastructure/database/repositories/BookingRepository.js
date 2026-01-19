/**
 * BookingRepository
 * University of Ilorin Carpooling Platform
 * 
 * Handles all database operations for bookings
 * Phase 1: Offline payment (cash) support
 * Implements single-table design with DynamoDB
 */

const { 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

const { 
  docClient, 
  getTableName, 
  GSI, 
  handleDynamoDBError 
} = require('../config/dynamodb.config');

class BookingRepository {
  constructor() {
    this.tableName = getTableName();
  }

  /**
   * Generate partition and sort keys for a booking
   */
  _generateKeys(bookingId) {
    return {
      PK: `BOOKING#${bookingId}`,
      SK: `BOOKING#${bookingId}`,
    };
  }

  /**
   * Generate GSI keys for indexing
   */
  _generateGSIKeys(userId, rideId, status, departureDate) {
    return {
      GSI1PK: `USER#${userId}`, // For querying user's bookings
      GSI1SK: `BOOKING#${departureDate}`,
      GSI2PK: `RIDE#${rideId}`, // For querying ride's bookings
      GSI2SK: `BOOKING#${userId}`,
      GSI4PK: `STATUS#${status}`, // For querying by status
      GSI4SK: `${departureDate}#${bookingId}`,
    };
  }

  /**
   * Generate 4-digit verification code
   */
  _generateVerificationCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Generate booking code (UIL-YYMMDD-XXXX format)
   */
  _generateBookingCode() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    
    return `UIL-${year}${month}${day}-${random}`;
  }

  /**
   * Create a new booking with cash payment
   * @param {Object} bookingData - Booking information
   * @returns {Promise<Object>} Created booking
   */
  async create(bookingData) {
    try {
      const {
        bookingId,
        userId,
        rideId,
        rideDate,
        seats,
        pickupPointId,
        totalAmount,
        driverId,
        createdAt = new Date().toISOString(),
      } = bookingData;

      const verificationCode = this._generateVerificationCode();
      const bookingCode = this._generateBookingCode();
      const status = 'pending';
      
      const keys = this._generateKeys(bookingId);
      const gsiKeys = this._generateGSIKeys(userId, rideId, status, rideDate);

      const item = {
        ...keys,
        ...gsiKeys,
        entityType: 'BOOKING',
        bookingId,
        bookingCode,
        userId,
        rideId,
        rideDate,
        driverId,
        seats,
        pickupPointId,
        
        // Payment information (Phase 1: Cash only)
        paymentMethod: 'cash',
        paymentStatus: 'cash_pending',
        totalAmount,
        amountPaid: 0,
        
        // Verification
        verificationCode,
        codeVerified: false,
        
        // Status tracking
        status, // pending, confirmed, in_progress, completed, cancelled, no_show
        
        // Timestamps
        createdAt,
        updatedAt: createdAt,
        expiresAt: this._calculateExpiryTime(rideDate),
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
        throw new Error('Booking already exists');
      }
      return handleDynamoDBError(error, 'CreateBooking');
    }
  }

  /**
   * Calculate booking expiry time (1 hour before ride)
   */
  _calculateExpiryTime(rideDate) {
    const rideTime = new Date(rideDate);
    rideTime.setHours(rideTime.getHours() - 1);
    return rideTime.toISOString();
  }

  /**
   * Get booking by ID
   * @param {string} bookingId - Booking identifier
   * @returns {Promise<Object|null>} Booking data or null
   */
  async getById(bookingId) {
    try {
      const keys = this._generateKeys(bookingId);

      const params = {
        TableName: this.tableName,
        Key: keys,
      };

      const result = await docClient.send(new GetCommand(params));
      return result.Item || null;
    } catch (error) {
      return handleDynamoDBError(error, 'GetBooking');
    }
  }

  /**
   * Update booking information
   * @param {string} bookingId - Booking identifier
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated booking
   */
  async update(bookingId, updates) {
    try {
      const keys = this._generateKeys(bookingId);
      
      // Build update expression dynamically
      const allowedUpdates = [
        'status',
        'paymentStatus',
        'amountPaid',
        'codeVerified',
        'pickupPointId',
        'cancellationReason',
        'cancelledAt',
        'confirmedAt',
        'startedAt',
        'completedAt',
        'noShowAt',
        'cashReceivedAt',
        'driverNotes',
        'passengerNotes',
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

      // Update GSI4 if status changes
      if (updates.status) {
        const booking = await this.getById(bookingId);
        if (booking) {
          updateExpression.push('#GSI4PK = :GSI4PK');
          expressionAttributeNames['#GSI4PK'] = 'GSI4PK';
          expressionAttributeValues[':GSI4PK'] = `STATUS#${updates.status}`;
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
        throw new Error('Booking not found');
      }
      return handleDynamoDBError(error, 'UpdateBooking');
    }
  }

  /**
   * Confirm booking
   * @param {string} bookingId - Booking identifier
   * @returns {Promise<Object>} Updated booking
   */
  async confirm(bookingId) {
    return this.update(bookingId, {
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    });
  }

  /**
   * Start ride (verify code)
   * @param {string} bookingId - Booking identifier
   * @param {string} code - Verification code to check
   * @returns {Promise<Object>} Updated booking
   */
  async startRide(bookingId, code) {
    try {
      const booking = await this.getById(bookingId);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.verificationCode !== code) {
        throw new Error('Invalid verification code');
      }

      if (booking.status !== 'confirmed') {
        throw new Error(`Cannot start ride. Booking status is ${booking.status}`);
      }

      return this.update(bookingId, {
        status: 'in_progress',
        codeVerified: true,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Complete ride and confirm cash received
   * @param {string} bookingId - Booking identifier
   * @param {number} amountReceived - Amount of cash received
   * @param {string} notes - Optional driver notes
   * @returns {Promise<Object>} Updated booking
   */
  async completeRide(bookingId, amountReceived, notes = '') {
    try {
      const booking = await this.getById(bookingId);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'in_progress') {
        throw new Error(`Cannot complete ride. Booking status is ${booking.status}`);
      }

      return this.update(bookingId, {
        status: 'completed',
        paymentStatus: 'cash_received',
        amountPaid: amountReceived,
        cashReceivedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        driverNotes: notes,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cancel booking
   * @param {string} bookingId - Booking identifier
   * @param {string} reason - Cancellation reason
   * @param {string} cancelledBy - User who cancelled
   * @returns {Promise<Object>} Updated booking
   */
  async cancel(bookingId, reason, cancelledBy) {
    try {
      const booking = await this.getById(bookingId);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (['completed', 'cancelled'].includes(booking.status)) {
        throw new Error(`Cannot cancel booking with status ${booking.status}`);
      }

      return this.update(bookingId, {
        status: 'cancelled',
        cancellationReason: reason,
        cancelledBy,
        cancelledAt: new Date().toISOString(),
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Mark booking as no-show
   * @param {string} bookingId - Booking identifier
   * @param {string} reason - No-show reason
   * @returns {Promise<Object>} Updated booking
   */
  async markNoShow(bookingId, reason) {
    return this.update(bookingId, {
      status: 'no_show',
      noShowReason: reason,
      noShowAt: new Date().toISOString(),
    });
  }

  /**
   * Get user's bookings
   * @param {string} userId - User identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User's bookings with pagination
   */
  async getByUserId(userId, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null, status = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI1,
        KeyConditionExpression: 'GSI1PK = :userId',
        ExpressionAttributeValues: {
          ':userId': `USER#${userId}`,
        },
        Limit: limit,
        ScanIndexForward: false, // Most recent first
      };

      if (status) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues[':status'] = status;
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
      return handleDynamoDBError(error, 'GetUserBookings');
    }
  }

  /**
   * Get ride's bookings
   * @param {string} rideId - Ride identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Ride's bookings with pagination
   */
  async getByRideId(rideId, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null, status = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI2,
        KeyConditionExpression: 'GSI2PK = :rideId',
        ExpressionAttributeValues: {
          ':rideId': `RIDE#${rideId}`,
        },
        Limit: limit,
      };

      if (status) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues[':status'] = status;
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
      return handleDynamoDBError(error, 'GetRideBookings');
    }
  }

  /**
   * Get bookings by status
   * @param {string} status - Booking status
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Bookings with pagination
   */
  async getByStatus(status, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null, date = null } = options;

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

      if (date) {
        params.KeyConditionExpression += ' AND begins_with(GSI4SK, :date)';
        params.ExpressionAttributeValues[':date'] = date;
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
      return handleDynamoDBError(error, 'GetBookingsByStatus');
    }
  }

  /**
   * Get driver's cash collection report
   * @param {string} driverId - Driver identifier
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Object>} Cash collection summary
   */
  async getDriverCashReport(driverId, startDate, endDate) {
    try {
      // First, get all completed bookings for the driver's rides
      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI4,
        KeyConditionExpression: 'GSI4PK = :status AND GSI4SK BETWEEN :startDate AND :endDate',
        FilterExpression: 'driverId = :driverId AND paymentStatus = :paymentStatus',
        ExpressionAttributeValues: {
          ':status': 'STATUS#completed',
          ':startDate': startDate,
          ':endDate': `${endDate}~`, // Tilde ensures we get everything up to end date
          ':driverId': driverId,
          ':paymentStatus': 'cash_received',
        },
      };

      const result = await docClient.send(new QueryCommand(params));
      const bookings = result.Items || [];

      // Calculate totals
      const summary = {
        totalBookings: bookings.length,
        totalCashCollected: bookings.reduce((sum, booking) => sum + (booking.amountPaid || 0), 0),
        totalSeats: bookings.reduce((sum, booking) => sum + (booking.seats || 0), 0),
        byDate: {},
        bookings,
      };

      // Group by date
      bookings.forEach((booking) => {
        const date = booking.rideDate.split('T')[0];
        if (!summary.byDate[date]) {
          summary.byDate[date] = {
            count: 0,
            amount: 0,
            seats: 0,
          };
        }
        summary.byDate[date].count += 1;
        summary.byDate[date].amount += booking.amountPaid || 0;
        summary.byDate[date].seats += booking.seats || 0;
      });

      return summary;
    } catch (error) {
      return handleDynamoDBError(error, 'GetDriverCashReport');
    }
  }

  /**
   * Get pending cash payments
   * @param {string} driverId - Driver identifier (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Pending cash bookings
   */
  async getPendingCashPayments(driverId = null, options = {}) {
    try {
      const { limit = 50 } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI4,
        KeyConditionExpression: 'GSI4PK = :status',
        FilterExpression: 'paymentStatus = :paymentStatus',
        ExpressionAttributeValues: {
          ':status': 'STATUS#confirmed',
          ':paymentStatus': 'cash_pending',
        },
        Limit: limit,
      };

      if (driverId) {
        params.FilterExpression += ' AND driverId = :driverId';
        params.ExpressionAttributeValues[':driverId'] = driverId;
      }

      const result = await docClient.send(new QueryCommand(params));
      return result.Items || [];
    } catch (error) {
      return handleDynamoDBError(error, 'GetPendingCashPayments');
    }
  }

  /**
   * Create booking with transaction (updates ride seats atomically)
   * @param {Object} bookingData - Booking information
   * @param {string} rideDate - Ride date
   * @returns {Promise<Object>} Created booking
   */
  async createWithTransaction(bookingData, rideDate) {
    try {
      const booking = await this.create(bookingData);
      
      // Create transaction to update both booking and ride
      const transactItems = [
        {
          Put: {
            TableName: this.tableName,
            Item: booking,
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        {
          Update: {
            TableName: this.tableName,
            Key: {
              PK: `RIDE#${rideDate}`,
              SK: `RIDE#${bookingData.rideId}`,
            },
            UpdateExpression: 'SET availableSeats = availableSeats - :seats, bookedSeats = bookedSeats + :seats, bookingCount = if_not_exists(bookingCount, :zero) + :one',
            ExpressionAttributeValues: {
              ':seats': bookingData.seats,
              ':zero': 0,
              ':one': 1,
              ':minSeats': bookingData.seats,
            },
            ConditionExpression: 'availableSeats >= :minSeats',
          },
        },
      ];

      const params = {
        TransactItems: transactItems,
      };

      await docClient.send(new TransactWriteCommand(params));
      return booking;
    } catch (error) {
      if (error.name === 'TransactionCanceledException') {
        throw new Error('Insufficient seats available or booking already exists');
      }
      return handleDynamoDBError(error, 'CreateBookingWithTransaction');
    }
  }

  /**
   * Delete booking (for testing only)
   * @param {string} bookingId - Booking identifier
   * @returns {Promise<boolean>} Success status
   */
  async delete(bookingId) {
    try {
      const keys = this._generateKeys(bookingId);

      const params = {
        TableName: this.tableName,
        Key: keys,
      };

      await docClient.send(new DeleteCommand(params));
      return true;
    } catch (error) {
      return handleDynamoDBError(error, 'DeleteBooking');
    }
  }
}

module.exports = BookingRepository;
