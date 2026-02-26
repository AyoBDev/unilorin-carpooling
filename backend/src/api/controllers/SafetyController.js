/**
 * Safety Controller
 * University of Ilorin Carpooling Platform
 *
 * Handles SOS/emergency alerts, live location sharing,
 * emergency contact notifications, incident reporting,
 * and safety-related features.
 *
 * Path: src/api/controllers/SafetyController.js
 *
 * @module controllers/SafetyController
 */

const { SafetyService } = require('../../core/services');
const { success, created, paginated } = require('../../shared/utils/response');
const { logger } = require('../../shared/utils/logger');

class SafetyController {
  constructor() {
    this.safetyService = new SafetyService();

    this.triggerSOS = this.triggerSOS.bind(this);
    this.resolveSOSAlert = this.resolveSOSAlert.bind(this);
    this.getSOSAlert = this.getSOSAlert.bind(this);
    this.getMySOSAlerts = this.getMySOSAlerts.bind(this);
    this.shareLocation = this.shareLocation.bind(this);
    this.stopLocationSharing = this.stopLocationSharing.bind(this);
    this.getSharedLocation = this.getSharedLocation.bind(this);
    this.updateLocation = this.updateLocation.bind(this);
    this.reportIncident = this.reportIncident.bind(this);
    this.getIncidentReports = this.getIncidentReports.bind(this);

    // Admin routes
    this.adminGetSOSAlerts = this.adminGetSOSAlerts.bind(this);
    this.adminGetIncidents = this.adminGetIncidents.bind(this);
    this.adminResolveIncident = this.adminResolveIncident.bind(this);
  }

  // ─── SOS ALERTS ──────────────────────────────────────────────

  /**
   * Trigger SOS alert
   * POST /api/v1/safety/sos
   */
  async triggerSOS(req, res, next) {
    try {
      const { userId } = req.user;
      const { bookingId, location, message } = req.body;

      const alert = await this.safetyService.triggerSOS(userId, {
        bookingId,
        location, // { lat, lng }
        message,
      });

      logger.warn('SOS alert triggered', {
        userId,
        alertId: alert.alertId,
        bookingId,
      });

      return created(res, 'SOS alert sent. Your emergency contacts have been notified.', {
        alert,
        contactsNotified: alert.contactsNotified,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Resolve an SOS alert (user marks themselves safe)
   * POST /api/v1/safety/sos/:alertId/resolve
   */
  async resolveSOSAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const { userId } = req.user;
      const { resolution } = req.body || {};

      const alert = await this.safetyService.resolveSOSAlert(alertId, userId, resolution);

      logger.info('SOS alert resolved', { userId, alertId });

      return success(res, 'SOS alert resolved. Your contacts have been notified you are safe.', {
        alert,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a specific SOS alert
   * GET /api/v1/safety/sos/:alertId
   */
  async getSOSAlert(req, res, next) {
    try {
      const { alertId } = req.params;
      const { userId } = req.user;

      const alert = await this.safetyService.getSOSAlert(alertId, userId);

      return success(res, 'SOS alert details', { alert });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's SOS alert history
   * GET /api/v1/safety/sos
   */
  async getMySOSAlerts(req, res, next) {
    try {
      const { userId } = req.user;
      const { status, page = 1, limit = 20 } = req.query;

      const result = await this.safetyService.getUserSOSAlerts(userId, {
        status,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'SOS alerts', result.alerts, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  // ─── LIVE LOCATION SHARING ───────────────────────────────────

  /**
   * Start sharing live location for a ride
   * POST /api/v1/safety/location/share
   */
  async shareLocation(req, res, next) {
    try {
      const { userId } = req.user.userId;
      const { bookingId, location } = req.body;

      const sharing = await this.safetyService.startLocationSharing(userId, {
        bookingId,
        location,
      });

      return success(
        res,
        'Location sharing started. Your emergency contacts can track your ride.',
        {
          sharing,
          shareUrl: sharing.shareUrl,
        },
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Stop sharing location
   * POST /api/v1/safety/location/stop
   */
  async stopLocationSharing(req, res, next) {
    try {
      const { userId } = req.user;
      const { bookingId } = req.body;

      await this.safetyService.stopLocationSharing(userId, bookingId);

      return success(res, 'Location sharing stopped');
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get shared location (for emergency contacts)
   * GET /api/v1/safety/location/:shareToken
   */
  async getSharedLocation(req, res, next) {
    try {
      const { shareToken } = req.params;

      const location = await this.safetyService.getSharedLocation(shareToken);

      return success(res, 'Current location', { location });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update current location during a ride
   * PUT /api/v1/safety/location
   */
  async updateLocation(req, res, next) {
    try {
      const { userId } = req.user.userId;
      const { bookingId, location } = req.body;

      await this.safetyService.updateLocation(userId, bookingId, location);

      return success(res, 'Location updated');
    } catch (error) {
      return next(error);
    }
  }

  // ─── INCIDENT REPORTING ──────────────────────────────────────

  /**
   * Report a safety incident
   * POST /api/v1/safety/incidents
   */
  async reportIncident(req, res, next) {
    try {
      const { userId } = req.user.userId;
      const { bookingId, type, description, severity } = req.body;

      const incident = await this.safetyService.reportIncident(userId, {
        bookingId,
        type, // 'harassment', 'unsafe_driving', 'route_deviation', 'other'
        description,
        severity, // 'low', 'medium', 'high', 'critical'
      });

      logger.info('Incident reported', {
        userId,
        incidentId: incident.incidentId,
        type,
        severity,
      });

      return created(res, 'Incident reported. Our safety team will review it.', {
        incident,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get user's incident reports
   * GET /api/v1/safety/incidents
   */
  async getIncidentReports(req, res, next) {
    try {
      const { userId } = req.user;
      const { page = 1, limit = 20 } = req.query;

      const result = await this.safetyService.getUserIncidents(userId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Incident reports', result.incidents, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  // ─── ADMIN ───────────────────────────────────────────────────

  /**
   * Admin: Get all SOS alerts
   * GET /api/v1/admin/safety/sos
   */
  async adminGetSOSAlerts(req, res, next) {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const result = await this.safetyService.getAllSOSAlerts({
        status,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'SOS alerts', result.alerts, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Get all incident reports
   * GET /api/v1/admin/safety/incidents
   */
  async adminGetIncidents(req, res, next) {
    try {
      const { status, severity, type, page = 1, limit = 20 } = req.query;

      const result = await this.safetyService.getAllIncidents({
        status,
        severity,
        type,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return paginated(res, 'Incident reports', result.incidents, result.pagination);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Admin: Resolve an incident
   * POST /api/v1/admin/safety/incidents/:incidentId/resolve
   */
  async adminResolveIncident(req, res, next) {
    try {
      const { incidentId } = req.params;
      const adminId = req.user.userId;
      const { resolution, action } = req.body;

      const incident = await this.safetyService.resolveIncident(incidentId, adminId, {
        resolution,
        action,
      });

      logger.info('Incident resolved by admin', { adminId, incidentId });

      return success(res, 'Incident resolved', { incident });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new SafetyController();
