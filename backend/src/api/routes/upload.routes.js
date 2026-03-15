/**
 * Upload Routes
 * Path: src/api/routes/upload.routes.js
 *
 * Presigned URL upload flow for images.
 */

const { Router } = require('express');
const UploadController = require('../controllers/UploadController');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody, sanitizeBody } = require('../middlewares/validation.middleware');
const { presignUploadSchema, confirmUploadSchema, viewUploadSchema } = require('../../shared/utils/validation');

const router = Router();

router.use(authenticate);

// Request a presigned upload URL
router.post(
  '/presign',
  sanitizeBody,
  validateBody(presignUploadSchema),
  UploadController.requestUploadUrl,
);

// Confirm an upload was completed
router.post(
  '/confirm',
  sanitizeBody,
  validateBody(confirmUploadSchema),
  UploadController.confirmUpload,
);

// Get a signed view URL for a private image
router.post(
  '/view',
  sanitizeBody,
  validateBody(viewUploadSchema),
  UploadController.getViewUrl,
);

// Delete an upload
router.delete(
  '/',
  sanitizeBody,
  validateBody(viewUploadSchema),
  UploadController.deleteUpload,
);

module.exports = router;
