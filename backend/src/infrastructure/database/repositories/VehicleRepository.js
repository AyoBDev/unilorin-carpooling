/**
 * Vehicle Repository
 * Path: src/infrastructure/database/repositories/VehicleRepository.js
 *
 * Handles all vehicle-related database operations
 */

const { nanoid } = require('nanoid');

const BaseRepository = require('./BaseRepository');

class VehicleRepository extends BaseRepository {
  constructor() {
    super('Vehicle');
  }

  /**
   * Add a vehicle to user
   * @param {string} userId - User ID
   * @param {Object} vehicleData - Vehicle information
   * @returns {Promise<Object>} Vehicle record
   */
  async create(userId, vehicleData) {
    const vehicleId = vehicleData.id || `VEHICLE#${nanoid()}`;
    const timestamp = new Date().toISOString();

    const item = {
      PK: `USER#${userId}`,
      SK: vehicleId,
      ...vehicleData,
      id: vehicleId,
      userId: `USER#${userId}`,
      isActive: vehicleData.isActive !== false,
      isVerified: false,
      createdAt: timestamp,
      updatedAt: timestamp,

      // GSI for vehicle queries
      GSI1PK: vehicleData.isVerified ? 'VERIFIED_VEHICLE' : 'UNVERIFIED_VEHICLE',
      GSI1SK: timestamp,
      GSI2PK: `VEHICLE#${vehicleData.plateNumber.toUpperCase()}`,
      GSI2SK: userId,
    };

    await super.create(item);

    return item;
  }

  /**
   * Get user's vehicles
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User vehicles
   */
  async getUserVehicles(userId) {
    const params = {
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'VEHICLE#',
      },
    };

    const result = await this.query(params);
    return result.items.filter((item) => item.isActive !== false);
  }

  /**
   * Get vehicle by ID
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object|null>} Vehicle or null
   */
  async findById(userId, vehicleId) {
    const pk = `USER#${userId}`;
    const sk = vehicleId.startsWith('VEHICLE#') ? vehicleId : `VEHICLE#${vehicleId}`;

    return super.get(pk, sk);
  }

  /**
   * Find vehicle by plate number
   * @param {string} plateNumber - Vehicle plate number
   * @returns {Promise<Object|null>} Vehicle or null
   */
  async findByPlateNumber(plateNumber) {
    const params = {
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :plate',
      ExpressionAttributeValues: {
        ':plate': `VEHICLE#${plateNumber.toUpperCase()}`,
      },
      Limit: 1,
    };

    const result = await this.query(params);
    return result.items[0] || null;
  }

  /**
   * Update vehicle
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated vehicle
   */
  async update(userId, vehicleId, updates) {
    const pk = `USER#${userId}`;
    const sk = vehicleId.startsWith('VEHICLE#') ? vehicleId : `VEHICLE#${vehicleId}`;

    // Update GSI if verification status changes
    if (updates.isVerified !== undefined) {
      updates.GSI1PK = updates.isVerified ? 'VERIFIED_VEHICLE' : 'UNVERIFIED_VEHICLE';
      updates.GSI1SK = new Date().toISOString();
      updates.verifiedAt = updates.isVerified ? new Date().toISOString() : null;
    }

    // Update plate number GSI if changed
    if (updates.plateNumber) {
      updates.GSI2PK = `VEHICLE#${updates.plateNumber.toUpperCase()}`;
    }

    return super.update(pk, sk, updates);
  }

  /**
   * Verify vehicle
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} verificationData - Verification details
   * @returns {Promise<Object>} Updated vehicle
   */
  async verifyVehicle(userId, vehicleId, verificationData = {}) {
    return this.update(userId, vehicleId, {
      isVerified: true,
      verificationData,
      verifiedAt: new Date().toISOString(),
      verifiedBy: verificationData.verifiedBy || 'system',
    });
  }

  /**
   * Deactivate vehicle
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Updated vehicle
   */
  async deactivate(userId, vehicleId) {
    return this.update(userId, vehicleId, {
      isActive: false,
      deactivatedAt: new Date().toISOString(),
    });
  }

  /**
   * Get all verified vehicles
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Verified vehicles
   */
  async getVerifiedVehicles(options = {}) {
    const params = {
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :verified',
      ExpressionAttributeValues: {
        ':verified': 'VERIFIED_VEHICLE',
      },
      ScanIndexForward: false,
      Limit: options.limit || 50,
    };

    if (options.lastKey) {
      params.ExclusiveStartKey = options.lastKey;
    }

    const result = await this.query(params);
    return result.items;
  }

  /**
   * Get unverified vehicles (for admin review)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Unverified vehicles
   */
  async getUnverifiedVehicles(options = {}) {
    const params = {
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :unverified',
      ExpressionAttributeValues: {
        ':unverified': 'UNVERIFIED_VEHICLE',
      },
      ScanIndexForward: true, // Oldest first for review
      Limit: options.limit || 20,
    };

    if (options.lastKey) {
      params.ExclusiveStartKey = options.lastKey;
    }

    const result = await this.query(params);
    return result.items;
  }

  /**
   * Check if vehicle can be used for rides
   * @param {string} userId - User ID
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Validation result
   */
  async validateForRide(userId, vehicleId) {
    const vehicle = await this.findById(userId, vehicleId);

    if (!vehicle) {
      return { valid: false, reason: 'Vehicle not found' };
    }

    if (!vehicle.isActive) {
      return { valid: false, reason: 'Vehicle is not active' };
    }

    if (!vehicle.isVerified) {
      return { valid: false, reason: 'Vehicle is not verified' };
    }

    // Check if insurance is valid (if applicable)
    if (vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < new Date()) {
      return { valid: false, reason: 'Vehicle insurance has expired' };
    }

    // Check if road worthiness is valid (Nigerian requirement)
    if (vehicle.roadWorthinessExpiry && new Date(vehicle.roadWorthinessExpiry) < new Date()) {
      return { valid: false, reason: 'Vehicle road worthiness has expired' };
    }

    return { valid: true, vehicle };
  }

  /**
   * Get vehicle statistics
   * @param {string} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Statistics
   */
  async getVehicleStatistics(_vehicleId) {
    // This would query rides and bookings associated with the vehicle
    // For now, return basic stats
    return {
      totalRides: 0,
      totalPassengers: 0,
      totalEarnings: 0,
      averageRating: 0,
      lastRideDate: null,
    };
  }

  /**
   * Search vehicles
   * @param {Object} searchCriteria - Search parameters
   * @returns {Promise<Array>} Matching vehicles
   */
  async searchVehicles(searchCriteria) {
    const { make, model, year, minCapacity, isVerified } = searchCriteria;

    const filterExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (make) {
      filterExpressions.push('contains(#make, :make)');
      expressionAttributeNames['#make'] = 'make';
      expressionAttributeValues[':make'] = make.toLowerCase();
    }

    if (model) {
      filterExpressions.push('contains(#model, :model)');
      expressionAttributeNames['#model'] = 'model';
      expressionAttributeValues[':model'] = model.toLowerCase();
    }

    if (year) {
      filterExpressions.push('#year = :year');
      expressionAttributeNames['#year'] = 'year';
      expressionAttributeValues[':year'] = year;
    }

    if (minCapacity) {
      filterExpressions.push('capacity >= :minCapacity');
      expressionAttributeValues[':minCapacity'] = minCapacity;
    }

    if (isVerified !== undefined) {
      filterExpressions.push('isVerified = :isVerified');
      expressionAttributeValues[':isVerified'] = isVerified;
    }

    const params = {
      FilterExpression: filterExpressions.join(' AND '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    };

    return this.scan(params);
  }
}

module.exports = VehicleRepository;
