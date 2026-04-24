const { Router } = require('express');
const { AdminAuthController } = require('../controllers');
const { validateBody } = require('../middlewares/validation.middleware');
const {
  adminLoginLimiter,
  adminRegisterLimiter,
} = require('../middlewares/rateLimiter.middleware');
const {
  adminLoginSchema,
  adminRegisterSchema,
} = require('../../shared/utils/validation');

const router = Router();

router.post(
  '/login',
  adminLoginLimiter,
  validateBody(adminLoginSchema),
  AdminAuthController.login,
);

router.post(
  '/register',
  adminRegisterLimiter,
  validateBody(adminRegisterSchema),
  AdminAuthController.register,
);

module.exports = router;
