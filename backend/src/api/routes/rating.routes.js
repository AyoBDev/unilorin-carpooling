/**
 * Rating Routes
 * Path: src/api/routes/rating.routes.js
 */

const { Router } = require('express');
const { RatingController } = require('../controllers');
const { authenticate, requireVerified } = require('../middlewares/auth.middleware');
const { validateBody, sanitizeBody } = require('../middlewares/validation.middleware');
const { ratingSchema } = require('../../shared/utils/validation');

const router = Router();

router.use(authenticate);

router.post(
  '/',
  requireVerified,
  sanitizeBody,
  validateBody(ratingSchema),
  RatingController.createRating,
);

router.get('/given', RatingController.getMyRatingsGiven);
router.get('/received', RatingController.getMyRatingsReceived);
router.get('/analytics', RatingController.getRatingAnalytics);
router.get('/unrated', RatingController.getUnratedBookings);

router.get('/user/:userId', RatingController.getUserRatings);
router.get('/reliability/:userId', RatingController.getReliabilityScore);

router.get('/:ratingId', RatingController.getRating);
router.put('/:ratingId', sanitizeBody, RatingController.updateRating);
router.post('/:ratingId/report', sanitizeBody, RatingController.reportRating);

module.exports = router;
