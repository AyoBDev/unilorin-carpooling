/**
 * Upload Service
 * Path: src/core/services/UploadService.js
 *
 * Handles S3 presigned URL generation, upload confirmation,
 * and image reference management.
 */

const { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { nanoid } = require('nanoid');

const { s3Client, getBucketName } = require('../../infrastructure/storage/s3Client');
const { logger } = require('../../shared/utils/logger');
const ValidationError = require('../../shared/errors/ValidationError');
const NotFoundError = require('../../shared/errors/NotFoundError');
const ForbiddenError = require('../../shared/errors/ForbiddenError');

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const CATEGORY_CONFIG = {
  'profile-photo': { maxSize: 5 * 1024 * 1024, folder: 'profile-photos' },
  'driver-document': { maxSize: 10 * 1024 * 1024, folder: 'driver-documents' },
  'vehicle-photo': { maxSize: 10 * 1024 * 1024, folder: 'vehicle-photos' },
};

const URL_EXPIRY_SECONDS = parseInt(process.env.S3_UPLOAD_URL_EXPIRY || '900', 10);

class UploadService {
  /**
   * Generate a presigned PUT URL for uploading
   */
  async generatePresignedUrl(userId, { category, entityId, contentType }) {
    if (!CATEGORY_CONFIG[category]) {
      throw new ValidationError(`Invalid upload category: ${category}`);
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new ValidationError(
        `Invalid content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    const config = CATEGORY_CONFIG[category];
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const fileId = nanoid();

    let key;
    if (entityId) {
      key = `uploads/${config.folder}/${userId}/${entityId}/${fileId}.${ext}`;
    } else {
      key = `uploads/${config.folder}/${userId}/${fileId}.${ext}`;
    }

    const bucket = getBucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRY_SECONDS,
    });

    const expiresAt = new Date(Date.now() + URL_EXPIRY_SECONDS * 1000).toISOString();

    logger.info('Presigned upload URL generated', { userId, category, key });

    return {
      uploadUrl,
      key,
      expiresAt,
      maxSize: config.maxSize,
      contentType,
    };
  }

  /**
   * Confirm an upload exists in S3 and return its URL
   */
  async confirmUpload(userId, key) {
    // Verify ownership — key must contain the userId
    if (!key.includes(`/${userId}/`)) {
      throw new ForbiddenError('You do not own this upload');
    }

    const bucket = getBucketName();

    // Verify object exists in S3
    try {
      const head = await s3Client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );

      const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION || 'eu-west-1'}.amazonaws.com/${key}`;

      logger.info('Upload confirmed', { userId, key, size: head.ContentLength });

      return {
        key,
        imageUrl,
        contentType: head.ContentType,
        size: head.ContentLength,
      };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw new NotFoundError('Upload not found in S3. File may not have been uploaded yet.');
      }
      throw error;
    }
  }

  /**
   * Generate a presigned GET URL for viewing a private image
   */
  async getSignedViewUrl(userId, key) {
    const bucket = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const viewUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    return { viewUrl, expiresIn: 3600 };
  }

  /**
   * Delete an upload from S3
   */
  async deleteUpload(userId, key) {
    if (!key.includes(`/${userId}/`)) {
      throw new ForbiddenError('You do not own this upload');
    }

    const bucket = getBucketName();

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );

    logger.info('Upload deleted', { userId, key });

    return { deleted: true, key };
  }
}

module.exports = UploadService;
