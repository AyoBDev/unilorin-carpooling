/**
 * Auth Routes
 * Path: src/api/routes/auth.routes.js
 *
 * Public and protected authentication endpoints.
 */

const { Router } = require('express');
const { AuthController } = require('../controllers');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateBody } = require('../middlewares/validation.middleware');
const {
  loginLimiter,
  authLimiter,
  passwordResetLimiter,
  otpLimiter,
} = require('../middlewares/rateLimiter.middleware');
const {
  registrationSchema,
  loginSchema,
  emailSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
  otpSchema,
  phoneSchema,
} = require('../../shared/utils/validation');

const router = Router();

// ─── PUBLIC ROUTES ─────────────────────────────────────────────

router.post('/register', authLimiter, validateBody(registrationSchema), AuthController.register);

router.post('/login', loginLimiter, validateBody(loginSchema), AuthController.login);

router.post('/verify-email', authLimiter, AuthController.verifyEmail);

router.post(
  '/resend-verification',
  authLimiter,
  validateBody(emailSchema),
  AuthController.resendVerification,
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validateBody(emailSchema),
  AuthController.forgotPassword,
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  validateBody(resetPasswordSchema),
  AuthController.resetPassword,
);

router.post(
  '/refresh-token',
  authLimiter,
  validateBody(refreshTokenSchema),
  AuthController.refreshToken,
);

// ─── PROTECTED ROUTES ──────────────────────────────────────────

router.use(authenticate);

router.get('/me', AuthController.getMe);

router.post('/change-password', validateBody(changePasswordSchema), AuthController.changePassword);

router.post('/logout', AuthController.logout);

router.post('/logout-all', AuthController.logoutAll);

router.post('/send-otp', otpLimiter, validateBody(phoneSchema), AuthController.sendOTP);

router.post('/verify-otp', otpLimiter, validateBody(otpSchema), AuthController.verifyOTP);

router.get('/sessions', AuthController.getSessions);

router.delete('/sessions/:sessionId', AuthController.revokeSession);

module.exports = router;
