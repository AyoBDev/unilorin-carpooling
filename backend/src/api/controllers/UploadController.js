/**
 * Upload Controller
 * Path: src/api/controllers/UploadController.js
 *
 * Handles presigned URL generation, upload confirmation, and deletion.
 */

const UploadService = require('../../core/services/UploadService');
const { success, created } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class UploadController {
  constructor() {
    this.uploadService = new UploadService();

    this.requestUploadUrl = this.requestUploadUrl.bind(this);
    this.confirmUpload = this.confirmUpload.bind(this);
    this.getViewUrl = this.getViewUrl.bind(this);
    this.deleteUpload = this.deleteUpload.bind(this);
  }

  /**
   * Request a presigned upload URL
   * POST /api/v1/uploads/presign
   */
  async requestUploadUrl(req, res, next) {
    try {
      const { userId } = req.user;
      const { category, entityId, contentType } = req.body;

      const result = await this.uploadService.generatePresignedUrl(userId, {
        category,
        entityId,
        contentType,
      });

      return created(res, 'Upload URL generated', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Confirm an upload was completed
   * POST /api/v1/uploads/confirm
   */
  async confirmUpload(req, res, next) {
    try {
      const { userId } = req.user;
      const { key } = req.body;

      const result = await this.uploadService.confirmUpload(userId, key);

      return success(res, 'Upload confirmed', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a signed view URL for a private image
   * POST /api/v1/uploads/view
   */
  async getViewUrl(req, res, next) {
    try {
      const { userId } = req.user;
      const { key } = req.body;

      const result = await this.uploadService.getSignedViewUrl(userId, key);

      return success(res, 'View URL generated', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete an upload
   * DELETE /api/v1/uploads
   */
  async deleteUpload(req, res, next) {
    try {
      const { userId } = req.user;
      const { key } = req.body;

      const result = await this.uploadService.deleteUpload(userId, key);

      logger.info('Upload deleted', { userId, key });

      return success(res, 'Upload deleted', result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UploadController();
