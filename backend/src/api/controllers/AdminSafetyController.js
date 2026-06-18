'use strict';

const SafetyService = require('../../core/services/SafetyService');
const { success } = require('../../shared/utils/response');

class AdminSafetyController {
  constructor() {
    this.safetyService = new SafetyService();

    this.getSOSAlerts = this.getSOSAlerts.bind(this);
    this.getSOSAlertDetail = this.getSOSAlertDetail.bind(this);
    this.updateSOSAlert = this.updateSOSAlert.bind(this);
    this.getIncidents = this.getIncidents.bind(this);
    this.getIncidentDetail = this.getIncidentDetail.bind(this);
    this.updateIncident = this.updateIncident.bind(this);
    this.getSafetyStats = this.getSafetyStats.bind(this);
  }

  async getSOSAlerts(req, res, next) {
    try {
      const { limit } = req.query;
      const result = await this.safetyService.getRecentSOSAlerts({
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return success(res, 'SOS alerts retrieved', result);
    } catch (error) {
      return next(error);
    }
  }

  async getSOSAlertDetail(req, res, next) {
    try {
      const alert = await this.safetyService.getSOSAlertDetail(req.params.alertId);
      return success(res, 'SOS alert detail retrieved', alert);
    } catch (error) {
      return next(error);
    }
  }

  async updateSOSAlert(req, res, next) {
    try {
      const { status, notes, assignedTo } = req.body;
      const updates = {};
      if (status) updates.status = status;
      if (notes) updates.adminNotes = notes;
      if (assignedTo) updates.assignedTo = assignedTo;

      const result = await this.safetyService.adminUpdateSOSAlert(req.params.alertId, updates);
      return success(res, 'SOS alert updated', result);
    } catch (error) {
      return next(error);
    }
  }

  async getIncidents(req, res, next) {
    try {
      const { type, severity, status, limit } = req.query;
      const result = await this.safetyService.getIncidents({
        type,
        severity,
        status,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return success(res, 'Incidents retrieved', result);
    } catch (error) {
      return next(error);
    }
  }

  async getIncidentDetail(req, res, next) {
    try {
      const incident = await this.safetyService.getIncidentDetail(req.params.incidentId);
      return success(res, 'Incident detail retrieved', incident);
    } catch (error) {
      return next(error);
    }
  }

  async updateIncident(req, res, next) {
    try {
      const { status, notes, assignedTo } = req.body;
      const updates = {};
      if (status) updates.status = status;
      if (notes) updates.adminNotes = notes;
      if (assignedTo) updates.assignedTo = assignedTo;

      const result = await this.safetyService.adminUpdateIncident(req.params.incidentId, updates);
      return success(res, 'Incident updated', result);
    } catch (error) {
      return next(error);
    }
  }

  async getSafetyStats(req, res, next) {
    try {
      const stats = await this.safetyService.getSafetyStats();
      return success(res, 'Safety stats retrieved', stats);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new AdminSafetyController();
