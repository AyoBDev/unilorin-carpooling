/**
 * Support Routes
 * Path: src/api/routes/support.routes.js
 *
 * User-facing customer support ticket endpoints.
 */

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');
const SupportController = require('../controllers/SupportController');

const router = Router();

// All support routes require authentication
router.use(authenticate);

// ─── TICKET OPERATIONS ─────────────────────────────────────────────

router.post('/tickets', SupportController.createTicket);
router.get('/tickets', SupportController.getMyTickets);
router.get('/tickets/:ticketId', SupportController.getTicket);
router.post('/tickets/:ticketId/close', SupportController.closeTicket);

module.exports = router;
