const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { docClient, getTableName, GSI, handleDynamoDBError } = require('../config/dynamodb.config');

class InviteRepository {
  constructor() {
    this.tableName = getTableName();
  }

  _generateKeys(inviteId) {
    return {
      PK: `INVITE#${inviteId}`,
      SK: `INVITE#${inviteId}`,
    };
  }

  async create({ inviteId, codeHash, createdBy, email, expiresAt }) {
    const keys = this._generateKeys(inviteId);

    const item = {
      ...keys,
      GSI1PK: `INVITE_CODE#${codeHash}`,
      GSI1SK: 'INVITE',
      entityType: 'ADMIN_INVITE',
      inviteId,
      codeHash,
      createdBy,
      email: email ? email.toLowerCase() : null,
      expiresAt,
      usedBy: null,
      usedAt: null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return item;
    } catch (error) {
      throw handleDynamoDBError(error);
    }
  }

  async findById(inviteId) {
    const keys = this._generateKeys(inviteId);

    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: keys,
        }),
      );
      return result.Item || null;
    } catch (error) {
      throw handleDynamoDBError(error);
    }
  }

  async findByCodeHash(codeHash) {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: GSI.GSI1,
          KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
          ExpressionAttributeValues: {
            ':pk': `INVITE_CODE#${codeHash}`,
            ':sk': 'INVITE',
          },
          Limit: 1,
        }),
      );
      return result.Items?.[0] || null;
    } catch (error) {
      throw handleDynamoDBError(error);
    }
  }

  async markUsed(inviteId, usedBy) {
    const keys = this._generateKeys(inviteId);

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: keys,
          UpdateExpression: 'SET #status = :status, usedBy = :usedBy, usedAt = :usedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'used',
            ':usedBy': usedBy,
            ':usedAt': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes;
    } catch (error) {
      throw handleDynamoDBError(error);
    }
  }

  async revoke(inviteId) {
    const keys = this._generateKeys(inviteId);

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: keys,
          UpdateExpression: 'SET #status = :status',
          ConditionExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'revoked',
            ':active': 'active',
          },
          ReturnValues: 'ALL_NEW',
        }),
      );
      return result.Attributes;
    } catch (error) {
      throw handleDynamoDBError(error);
    }
  }

  async listAll({ limit = 50 } = {}) {
    try {
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'entityType = :type',
          ExpressionAttributeValues: {
            ':type': 'ADMIN_INVITE',
          },
          Limit: limit,
        }),
      );
      return result.Items || [];
    } catch (error) {
      throw handleDynamoDBError(error);
    }
  }
}

module.exports = InviteRepository;
