/**
 * UserRepository
 * University of Ilorin Carpooling Platform
 *
 * Handles all database operations for users (students, staff, drivers)
 * Supports authentication, profile management, and driver verification
 * Implements single-table design with DynamoDB
 */

const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} = require('@aws-sdk/lib-dynamodb');

const { docClient, getTableName, GSI, handleDynamoDBError } = require('../config/dynamodb.config');

class UserRepository {
  constructor() {
    this.tableName = getTableName();
  }

  /**
   * Generate partition and sort keys for a user
   */
  _generateKeys(userId) {
    return {
      PK: `USER#${userId}`,
      SK: `USER#${userId}`,
    };
  }

  /**
   * Generate GSI keys for indexing
   */
  _generateGSIKeys(email, role, institutionId, institutionIdType, status = 'active') {
    const gsiKeys = {
      GSI1PK: `EMAIL#${email.toLowerCase()}`, // For email lookup
      GSI1SK: `USER`,
      GSI3PK: `ROLE#${role}`, // For role-based queries
      GSI3SK: `USER`,
      GSI4PK: `STATUS#${status}`, // For status queries
      GSI4SK: `USER`,
    };

    // GSI2 for institution ID (matricNumber for students, staffId for staff)
    if (institutionId) {
      gsiKeys.GSI2PK = `${institutionIdType}#${institutionId}`;
      gsiKeys.GSI2SK = `USER`;
    }

    return gsiKeys;
  }

  /**
   * Create a new user
   * @param {Object} userData - User information
   * @returns {Promise<Object>} Created user
   */
  async create(userData) {
    try {
      const {
        userId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role, // 'student' or 'staff'
        matricNumber = null,
        staffId = null,
        department = null,
        faculty = null,
        level = null, // For students
        designation = null, // For staff
        isDriver = false,
        profileImage = null,
        verificationToken = null,
        verificationExpiry = null,
        createdAt = new Date().toISOString(),
      } = userData;

      // Validate role-specific fields
      if (role === 'student' && !matricNumber) {
        throw new Error('Matric number is required for students');
      }
      if (role === 'staff' && !staffId) {
        throw new Error('Staff ID is required for staff');
      }

      const institutionId = role === 'student' ? matricNumber : staffId;
      const institutionIdType = role === 'student' ? 'MATRIC' : 'STAFF';

      const keys = this._generateKeys(userId);
      const gsiKeys = this._generateGSIKeys(
        email,
        role,
        institutionId,
        institutionIdType,
        'active',
      );

      const item = {
        ...keys,
        ...gsiKeys,
        entityType: 'USER',
        userId,
        email: email.toLowerCase(),
        passwordHash,

        // Personal information
        firstName,
        lastName,
        phone,
        profileImage,

        // Institution details
        role,
        matricNumber,
        staffId,
        department,
        faculty,
        level, // For students
        designation, // For staff

        // Driver information
        isDriver,
        driverVerified: false,
        licenseNumber: null,
        licenseExpiry: null,
        documents: [],

        // Vehicle information (if driver)
        vehicles: [],

        // Emergency contacts
        emergencyContacts: [],

        // Verification
        emailVerified: false,
        emailVerificationToken: verificationToken,
        verificationTokenExpiry: verificationExpiry,
        phoneVerified: false,

        // Status
        status: 'active', // active, suspended, inactive, deleted

        // Statistics
        totalRidesAsDriver: 0,
        totalRidesAsPassenger: 0,
        totalBookings: 0,
        completedRides: 0,
        cancelledRides: 0,
        noShows: 0,

        // Ratings
        averageRating: 0,
        totalRatings: 0,
        ratingsAsDriver: [],
        ratingsAsPassenger: [],

        // Timestamps
        createdAt,
        updatedAt: createdAt,
        lastLoginAt: null,
      };

      const params = {
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      };

      await docClient.send(new PutCommand(params));

      // Remove sensitive data before returning
      const userWithoutPassword = { ...item };
      delete userWithoutPassword.passwordHash;
      return userWithoutPassword;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User already exists');
      }
      return handleDynamoDBError(error, 'CreateUser');
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User identifier
   * @param {boolean} includePassword - Include password hash in result
   * @returns {Promise<Object|null>} User data or null
   */
  async getById(userId, includePassword = false) {
    try {
      const keys = this._generateKeys(userId);

      const params = {
        TableName: this.tableName,
        Key: keys,
      };

      const result = await docClient.send(new GetCommand(params));

      if (!result.Item) {
        return null;
      }

      // Remove password hash unless explicitly requested
      if (!includePassword) {
        const userWithoutPassword = { ...result.Item };
        delete userWithoutPassword.passwordHash;
        return userWithoutPassword;
      }

      return result.Item;
    } catch (error) {
      return handleDynamoDBError(error, 'GetUser');
    }
  }

  /**
   * Get user by email (for login)
   * @param {string} email - User email
   * @param {boolean} includePassword - Include password hash
   * @returns {Promise<Object|null>} User data or null
   */
  async getByEmail(email, includePassword = false) {
    try {
      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI1,
        KeyConditionExpression: 'GSI1PK = :email AND GSI1SK = :user',
        ExpressionAttributeValues: {
          ':email': `EMAIL#${email.toLowerCase()}`,
          ':user': 'USER',
        },
        Limit: 1,
      };

      const result = await docClient.send(new QueryCommand(params));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const user = result.Items[0];

      // Remove password hash unless explicitly requested
      if (!includePassword) {
        const userWithoutPassword = { ...user };
        delete userWithoutPassword.passwordHash;
        return userWithoutPassword;
      }

      return user;
    } catch (error) {
      return handleDynamoDBError(error, 'GetUserByEmail');
    }
  }

  /**
   * Get user by matric number (students)
   * @param {string} matricNumber - Student matric number
   * @returns {Promise<Object|null>} User data or null
   */
  async getByMatricNumber(matricNumber) {
    try {
      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI2,
        KeyConditionExpression: 'GSI2PK = :matric AND GSI2SK = :user',
        ExpressionAttributeValues: {
          ':matric': `MATRIC#${matricNumber}`,
          ':user': 'USER',
        },
        Limit: 1,
      };

      const result = await docClient.send(new QueryCommand(params));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const user = result.Items[0];
      delete user.passwordHash;
      return user;
    } catch (error) {
      return handleDynamoDBError(error, 'GetUserByMatricNumber');
    }
  }

  /**
   * Get user by staff ID
   * @param {string} staffId - Staff identifier
   * @returns {Promise<Object|null>} User data or null
   */
  async getByStaffId(staffId) {
    try {
      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI2,
        KeyConditionExpression: 'GSI2PK = :staffId AND GSI2SK = :user',
        ExpressionAttributeValues: {
          ':staffId': `STAFF#${staffId}`,
          ':user': 'USER',
        },
        Limit: 1,
      };

      const result = await docClient.send(new QueryCommand(params));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const user = result.Items[0];
      delete user.passwordHash;
      return user;
    } catch (error) {
      return handleDynamoDBError(error, 'GetUserByStaffId');
    }
  }

  /**
   * Update user information
   * @param {string} userId - User identifier
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated user
   */
  async update(userId, updates) {
    try {
      const keys = this._generateKeys(userId);

      // Build update expression dynamically
      const allowedUpdates = [
        'firstName',
        'lastName',
        'phone',
        'profileImage',
        'department',
        'faculty',
        'level',
        'designation',
        'isDriver',
        'driverVerified',
        'licenseNumber',
        'licenseExpiry',
        'documents',
        'vehicles',
        'emergencyContacts',
        'emailVerified',
        'phoneVerified',
        'status',
        'lastLoginAt',
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
        updateExpression.push('#GSI4PK = :GSI4PK');
        expressionAttributeNames['#GSI4PK'] = 'GSI4PK';
        expressionAttributeValues[':GSI4PK'] = `STATUS#${updates.status}`;
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

      // Remove password hash from result
      delete result.Attributes.passwordHash;
      return result.Attributes;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User not found');
      }
      return handleDynamoDBError(error, 'UpdateUser');
    }
  }

  /**
   * Update user password
   * @param {string} userId - User identifier
   * @param {string} newPasswordHash - New password hash
   * @returns {Promise<Object>} Updated user
   */
  async updatePassword(userId, newPasswordHash) {
    try {
      const keys = this._generateKeys(userId);
      // Support both string and object { passwordHash } signatures
      const hash = typeof newPasswordHash === 'object' ? newPasswordHash.passwordHash : newPasswordHash;

      const params = {
        TableName: this.tableName,
        Key: keys,
        UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt, passwordResetToken = :null, passwordResetExpiry = :null',
        ExpressionAttributeValues: {
          ':passwordHash': hash,
          ':null': null,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(PK)',
      };

      const result = await docClient.send(new UpdateCommand(params));

      // Remove password hash from result
      delete result.Attributes.passwordHash;
      return result.Attributes;
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new Error('User not found');
      }
      return handleDynamoDBError(error, 'UpdatePassword');
    }
  }

  /**
   * Verify user email
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Updated user
   */
  async verifyEmail(userId) {
    return this.update(userId, {
      emailVerified: true,
      emailVerificationToken: null,
    });
  }

  /**
   * Update driver status
   * @param {string} userId - User identifier
   * @param {boolean} isDriver - Driver status
   * @param {Object} driverInfo - Driver information (license, etc.)
   * @returns {Promise<Object>} Updated user
   */
  async updateDriverStatus(userId, isDriver, driverInfo = {}) {
    const updates = {
      isDriver,
      ...driverInfo,
    };

    if (!isDriver) {
      updates.driverVerified = false;
    }

    return this.update(userId, updates);
  }

  /**
   * Add emergency contact
   * @param {string} userId - User identifier
   * @param {Object} contact - Emergency contact information
   * @returns {Promise<Object>} Updated user
   */
  async addEmergencyContact(userId, contact) {
    const user = await this.getById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const emergencyContacts = user.emergencyContacts || [];

    const newContact = {
      id: `contact-${Date.now()}`,
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email || null,
      isPrimary: emergencyContacts.length === 0, // First contact is primary
      createdAt: new Date().toISOString(),
    };

    emergencyContacts.push(newContact);

    return this.update(userId, { emergencyContacts });
  }

  /**
   * Remove emergency contact
   * @param {string} userId - User identifier
   * @param {string} contactId - Contact identifier
   * @returns {Promise<Object>} Updated user
   */
  async removeEmergencyContact(userId, contactId) {
    const user = await this.getById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const emergencyContacts = (user.emergencyContacts || []).filter(
      (contact) => contact.id !== contactId,
    );

    return this.update(userId, { emergencyContacts });
  }

  /**
   * Update user rating
   * @param {string} userId - User identifier
   * @param {number} newRating - New rating value (1-5)
   * @param {string} ratingType - 'driver' or 'passenger'
   * @returns {Promise<Object>} Updated user
   */
  async updateRating(userId, newRating, ratingType = 'driver') {
    const user = await this.getById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const totalRatings = user.totalRatings || 0;
    const averageRating = user.averageRating || 0;

    // Calculate new average
    const newTotal = totalRatings + 1;
    const newAverage = (averageRating * totalRatings + newRating) / newTotal;

    // Update rating arrays
    const ratingKey = ratingType === 'driver' ? 'ratingsAsDriver' : 'ratingsAsPassenger';
    const ratings = user[ratingKey] || [];
    ratings.push({
      rating: newRating,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50 ratings
    if (ratings.length > 50) {
      ratings.shift();
    }

    return this.update(userId, {
      averageRating: Math.round(newAverage * 10) / 10, // Round to 1 decimal
      totalRatings: newTotal,
      [ratingKey]: ratings,
    });
  }

  /**
   * Increment ride count
   * @param {string} userId - User identifier
   * @param {string} rideType - 'driver' or 'passenger'
   * @param {string} status - 'completed' or 'cancelled'
   * @returns {Promise<Object>} Updated user
   */
  async incrementRideCount(userId, rideType = 'passenger', status = 'completed') {
    try {
      const keys = this._generateKeys(userId);

      const countField = rideType === 'driver' ? 'totalRidesAsDriver' : 'totalRidesAsPassenger';
      const statusField = status === 'completed' ? 'completedRides' : 'cancelledRides';

      const params = {
        TableName: this.tableName,
        Key: keys,
        UpdateExpression: `SET ${countField} = if_not_exists(${countField}, :zero) + :inc, ${statusField} = if_not_exists(${statusField}, :zero) + :inc, updatedAt = :updatedAt`,
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };

      const result = await docClient.send(new UpdateCommand(params));

      // Remove password hash from result
      delete result.Attributes.passwordHash;
      return result.Attributes;
    } catch (error) {
      return handleDynamoDBError(error, 'IncrementRideCount');
    }
  }

  /**
   * Increment no-show count
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Updated user
   */
  async incrementNoShowCount(userId) {
    try {
      const keys = this._generateKeys(userId);

      const params = {
        TableName: this.tableName,
        Key: keys,
        UpdateExpression:
          'SET noShows = if_not_exists(noShows, :zero) + :inc, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };

      const result = await docClient.send(new UpdateCommand(params));

      // Remove password hash from result
      delete result.Attributes.passwordHash;
      return result.Attributes;
    } catch (error) {
      return handleDynamoDBError(error, 'IncrementNoShowCount');
    }
  }

  /**
   * Get users by role
   * @param {string} role - User role ('student' or 'staff')
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users with pagination
   */
  async getUsersByRole(role, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI3,
        KeyConditionExpression: 'GSI3PK = :role AND GSI3SK = :user',
        ExpressionAttributeValues: {
          ':role': `ROLE#${role}`,
          ':user': 'USER',
        },
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      // Remove password hashes
      const items = (result.Items || []).map(({ passwordHash: _, ...user }) => user);

      return {
        items,
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      return handleDynamoDBError(error, 'GetUsersByRole');
    }
  }

  /**
   * Get all drivers
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Drivers with pagination
   */
  async getDrivers(options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null, verified = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI3,
        FilterExpression: 'isDriver = :true',
        ExpressionAttributeValues: {
          ':true': true,
        },
        Limit: limit,
      };

      if (verified !== null) {
        params.FilterExpression += ' AND driverVerified = :verified';
        params.ExpressionAttributeValues[':verified'] = verified;
      }

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      // Query both student and staff roles
      const [studentDrivers, staffDrivers] = await Promise.all([
        this._queryDriversByRole('student', params),
        this._queryDriversByRole('staff', params),
      ]);

      const items = [...studentDrivers, ...staffDrivers];

      return {
        items,
        count: items.length,
      };
    } catch (error) {
      return handleDynamoDBError(error, 'GetDrivers');
    }
  }

  /**
   * Helper method to query drivers by role
   */
  async _queryDriversByRole(role, baseParams) {
    const params = {
      ...baseParams,
      KeyConditionExpression: 'GSI3PK = :role AND GSI3SK = :user',
      ExpressionAttributeValues: {
        ...baseParams.ExpressionAttributeValues,
        ':role': `ROLE#${role}`,
        ':user': 'USER',
      },
    };

    const result = await docClient.send(new QueryCommand(params));
    return (result.Items || []).map(({ passwordHash: _, ...user }) => user);
  }

  /**
   * Get users by status
   * @param {string} status - User status
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users with pagination
   */
  async getUsersByStatus(status, options = {}) {
    try {
      const { limit = 50, lastEvaluatedKey = null } = options;

      const params = {
        TableName: this.tableName,
        IndexName: GSI.GSI4,
        KeyConditionExpression: 'GSI4PK = :status AND GSI4SK = :user',
        ExpressionAttributeValues: {
          ':status': `STATUS#${status}`,
          ':user': 'USER',
        },
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new QueryCommand(params));

      // Remove password hashes
      const items = (result.Items || []).map(({ passwordHash: _, ...user }) => user);

      return {
        items,
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      return handleDynamoDBError(error, 'GetUsersByStatus');
    }
  }

  /**
   * Suspend user account
   * @param {string} userId - User identifier
   * @param {string} reason - Suspension reason
   * @returns {Promise<Object>} Updated user
   */
  async suspendUser(userId, reason) {
    return this.update(userId, {
      status: 'suspended',
      suspensionReason: reason,
      suspendedAt: new Date().toISOString(),
    });
  }

  /**
   * Reactivate user account
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Updated user
   */
  async reactivateUser(userId) {
    return this.update(userId, {
      status: 'active',
      suspensionReason: null,
      suspendedAt: null,
    });
  }

  /**
   * Soft delete user account
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Updated user
   */
  async delete(userId) {
    return this.update(userId, {
      status: 'deleted',
      deletedAt: new Date().toISOString(),
    });
  }

  /**
   * Update last login timestamp
   * @param {string} userId - User identifier
   * @returns {Promise<Object>} Updated user
   */
  async updateLastLogin(userId) {
    return this.update(userId, {
      lastLoginAt: new Date().toISOString(),
    });
  }

  /**
   * Search users by name or email
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching users
   */
  async searchUsers(searchTerm, options = {}) {
    try {
      const { limit = 50, role = null } = options;

      const lowerSearchTerm = searchTerm.toLowerCase();

      // Note: This is a scan operation - not ideal for production at scale
      // Consider implementing Elasticsearch or similar for better search
      const params = {
        TableName: this.tableName,
        FilterExpression:
          'contains(#firstName, :term) OR contains(#lastName, :term) OR contains(#email, :term)',
        ExpressionAttributeNames: {
          '#firstName': 'firstName',
          '#lastName': 'lastName',
          '#email': 'email',
        },
        ExpressionAttributeValues: {
          ':term': lowerSearchTerm,
          ':entityType': 'USER',
        },
        Limit: limit,
      };

      if (role) {
        params.FilterExpression += ' AND #role = :role';
        params.ExpressionAttributeNames['#role'] = 'role';
        params.ExpressionAttributeValues[':role'] = role;
      }

      // Add entity type filter to only get users
      params.FilterExpression += ' AND entityType = :entityType';

      const result = await docClient.send(new QueryCommand(params));

      // Remove password hashes
      const items = (result.Items || []).map(({ passwordHash: _, ...user }) => user);

      return items;
    } catch (error) {
      return handleDynamoDBError(error, 'SearchUsers');
    }
  }

  /**
   * Batch get users by IDs
   * @param {Array} userIds - Array of user IDs
   * @returns {Promise<Array>} List of users
   */
  async batchGet(userIds) {
    try {
      const keys = userIds.map((userId) => this._generateKeys(userId));

      const params = {
        RequestItems: {
          [this.tableName]: {
            Keys: keys,
          },
        },
      };

      const result = await docClient.send(new BatchGetCommand(params));

      // Remove password hashes
      const items = (result.Responses[this.tableName] || []).map(
        ({ passwordHash: _, ...user }) => user,
      );

      return items;
    } catch (error) {
      return handleDynamoDBError(error, 'BatchGetUsers');
    }
  }

  // ── Aliases for AuthService compatibility ──────────────

  _addComputedFields(user) {
    if (!user) return user;
    return {
      ...user,
      isActive: user.status === 'active',
      isVerified: user.emailVerified || false,
    };
  }

  async findByEmail(email, includePassword = true) {
    const user = await this.getByEmail(email, includePassword);
    return this._addComputedFields(user);
  }

  async findById(userId, includePassword = false) {
    const user = await this.getById(userId, includePassword);
    return this._addComputedFields(user);
  }

  async findByMatricNumber(matricNumber) {
    return this.getByMatricNumber(matricNumber);
  }

  async findByStaffId(staffId) {
    return this.getByStaffId(staffId);
  }

  // ── Token & Session Management ────────────────────────

  async updateLoginAttempts(userId, attempts, lockedUntil = null) {
    const keys = this._generateKeys(userId);
    const updateExpr = lockedUntil
      ? 'SET loginAttempts = :attempts, lockedUntil = :lockedUntil, updatedAt = :now'
      : 'SET loginAttempts = :attempts, updatedAt = :now REMOVE lockedUntil';
    const values = { ':attempts': attempts, ':now': new Date().toISOString() };
    if (lockedUntil) values[':lockedUntil'] = lockedUntil;

    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: keys,
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: values,
    }));
  }

  async storeRefreshToken(userId, tokenData) {
    const keys = this._generateKeys(userId);
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: keys,
      UpdateExpression: 'SET refreshTokens = list_append(if_not_exists(refreshTokens, :empty), :token), updatedAt = :now',
      ExpressionAttributeValues: {
        ':token': [tokenData],
        ':empty': [],
        ':now': new Date().toISOString(),
      },
    }));
  }

  async removeRefreshToken(userId, refreshToken) {
    const user = await this.getById(userId, true);
    if (!user) return;
    const tokens = (user.refreshTokens || []).filter(t => t.token !== refreshToken);
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'SET refreshTokens = :tokens, updatedAt = :now',
      ExpressionAttributeValues: { ':tokens': tokens, ':now': new Date().toISOString() },
    }));
  }

  async findByRefreshToken(refreshToken) {
    // Scan for user with matching refresh token — not ideal but functional for MVP
    const params = {
      TableName: this.tableName,
      FilterExpression: 'entityType = :type AND contains(#rt, :token)',
      ExpressionAttributeNames: { '#rt': 'refreshTokens' },
      ExpressionAttributeValues: { ':type': 'USER', ':token': refreshToken },
    };
    try {
      const result = await docClient.send(new ScanCommand(params));
      return result.Items?.[0] || null;
    } catch {
      return null;
    }
  }

  async invalidateAllRefreshTokens(userId) {
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'SET refreshTokens = :empty, updatedAt = :now',
      ExpressionAttributeValues: { ':empty': [], ':now': new Date().toISOString() },
    }));
  }

  async getRefreshTokens(userId) {
    const user = await this.getById(userId, true);
    return user?.refreshTokens || [];
  }

  async removeRefreshTokenById(userId, tokenId) {
    const user = await this.getById(userId, true);
    if (!user) return;
    const tokens = (user.refreshTokens || []).filter(t => t.id !== tokenId);
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'SET refreshTokens = :tokens, updatedAt = :now',
      ExpressionAttributeValues: { ':tokens': tokens, ':now': new Date().toISOString() },
    }));
  }

  // ── Verification & Password Reset Tokens ──────────────

  async updateVerificationToken(userId, tokenData) {
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'SET emailVerificationToken = :token, verificationTokenExpiry = :expiry, updatedAt = :now',
      ExpressionAttributeValues: {
        ':token': tokenData.token,
        ':expiry': tokenData.expiresAt,
        ':now': new Date().toISOString(),
      },
    }));
  }

  async findByVerificationToken(token) {
    const params = {
      TableName: this.tableName,
      FilterExpression: 'entityType = :type AND emailVerificationToken = :token',
      ExpressionAttributeValues: { ':type': 'USER', ':token': token },
    };
    try {
      const result = await docClient.send(new ScanCommand(params));
      return result.Items?.[0] || null;
    } catch {
      return null;
    }
  }

  async storePasswordResetToken(userId, tokenData) {
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'SET passwordResetToken = :token, passwordResetExpiry = :expiry, updatedAt = :now',
      ExpressionAttributeValues: {
        ':token': tokenData.token,
        ':expiry': tokenData.expiresAt,
        ':now': new Date().toISOString(),
      },
    }));
  }

  async findByPasswordResetToken(token) {
    const params = {
      TableName: this.tableName,
      FilterExpression: 'entityType = :type AND passwordResetToken = :token',
      ExpressionAttributeValues: { ':type': 'USER', ':token': token },
    };
    try {
      const result = await docClient.send(new ScanCommand(params));
      return result.Items?.[0] || null;
    } catch {
      return null;
    }
  }

  // ── OTP Management ────────────────────────────────────

  async storeOTP(userId, otpData) {
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'SET otpData = if_not_exists(otpData, :empty)',
      ExpressionAttributeValues: { ':empty': {} },
    }));
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: `SET otpData.#purpose = :otp, updatedAt = :now`,
      ExpressionAttributeNames: { '#purpose': otpData.purpose },
      ExpressionAttributeValues: {
        ':otp': { code: otpData.code, expiresAt: otpData.expiresAt, attempts: 0 },
        ':now': new Date().toISOString(),
      },
    }));
  }

  async getOTP(userId, purpose) {
    const user = await this.getById(userId, true);
    return user?.otpData?.[purpose] || null;
  }

  async removeOTP(userId, purpose) {
    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: this._generateKeys(userId),
      UpdateExpression: 'REMOVE otpData.#purpose SET updatedAt = :now',
      ExpressionAttributeNames: { '#purpose': purpose },
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));
  }

  // ── Profile Update ────────────────────────────────────

  async updateProfile(userId, updates) {
    return this.update(userId, updates);
  }

  /**
   * Check if profile is complete
   * @param {Object} user - User object
   * @returns {Object} Profile completeness status
   */
  checkProfileCompleteness(user) {
    const requiredFields = ['firstName', 'lastName', 'phone', 'email'];
    const missingFields = requiredFields.filter((field) => !user[field]);

    const driverFields = user.isDriver ? ['licenseNumber', 'licenseExpiry', 'vehicles'] : [];
    const missingDriverFields = driverFields.filter(
      (field) => !user[field] || (Array.isArray(user[field]) && user[field].length === 0),
    );

    const isComplete = missingFields.length === 0 && missingDriverFields.length === 0;
    const completeness = Math.round(
      ((requiredFields.length +
        driverFields.length -
        missingFields.length -
        missingDriverFields.length) /
        (requiredFields.length + driverFields.length)) *
        100,
    );

    return {
      isComplete,
      completeness,
      missingFields: [...missingFields, ...missingDriverFields],
    };
  }
}

module.exports = UserRepository;
