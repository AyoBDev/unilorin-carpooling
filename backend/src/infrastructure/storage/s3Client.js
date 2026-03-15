/**
 * S3 Client Configuration
 * Path: src/infrastructure/storage/s3Client.js
 *
 * Configures and exports the S3 client and bucket name.
 */

const { S3Client } = require('@aws-sdk/client-s3');
const { logger } = require('../../shared/utils/logger');

const region = process.env.AWS_REGION || 'eu-west-1';

const s3Config = { region };

// Support local development with LocalStack or MinIO
if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true;
}

const s3Client = new S3Client(s3Config);

const getBucketName = () => {
  const bucket = process.env.S3_UPLOAD_BUCKET;
  if (!bucket) {
    logger.warn('S3_UPLOAD_BUCKET not set, uploads will fail');
  }
  return bucket;
};

module.exports = { s3Client, getBucketName };
