/**
 * Safety Service
 * University of Ilorin Carpooling Platform
 *
 * Handles SOS functionality, live tracking, emergency contact alerts,
 * and safety-related features for riders and drivers.
 *
 * @module services/SafetyService
 */

const { randomUUID } = require('crypto');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const BookingRepository = require('../../infrastructure/database/repositories/BookingRepository');
const RideRepository = require('../../infrastructure/database/repositories/RideRepository');
const NotificationService = require('./NotificationService');
const { logger } = require('../../shared/utils/logger');
const { formatDate, now, addMinutes, formatDateTime } = require('../../shared/utils/dateTime');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../../shared/errors');
const { ERROR_CODES } = require('../../shared/constants/errors');
const { SAFETY_EVENTS } = require('../../shared/constants/events');

/**
 * Alert status constants
 */
const ALERT_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  FALSE_ALARM: 'false_alarm',
  ESCALATED: 'escalated',
};

/**
 * Alert types
 */
const ALERT_TYPE = {
  SOS: 'sos',
  ROUTE_DEVIATION: 'route_deviation',
  LONG_STOP: 'long_stop',
  SPEED_ALERT: 'speed_alert',
  MANUAL_CHECK: 'manual_check',
};

/**
 * Safety configuration
 */
const SAFETY_CONFIG = {
  sosAlertExpiryMinutes: 60, // Auto-resolve after 60 minutes
  locationUpdateIntervalSeconds: 30,
  routeDeviationThresholdKm: 2,
  longStopThresholdMinutes: 15,
  maxSpeedKph: 120,
  emergencyNumbers: {
    police: '112',
    ambulance: '112',
    universitySecurty: '+2348012345678',
  },
};

/**
 * SafetyService class
 * Manages safety and emergency features
 */
class SafetyService {
  constructor() {
    this.userRepository = new UserRepository();
    this.bookingRepository = new BookingRepository();
    this.rideRepository = new RideRepository();
    this.notificationService = new NotificationService();
    this.serviceName = 'SafetyService';

    // In-memory store for active tracking sessions
    // In production, this would be Redis or similar
    this.trackingSessions = new Map();
    this.activeAlerts = new Map();
  }

  // ==================== SOS Functionality ====================

  /**
   * Trigger SOS alert
   * @param {string} userId - User triggering the alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Alert result
   */
  async triggerSOS(userId, alertData) {
    const startTime = Date.now();
    logger.info('SOS triggered', {
      action: SAFETY_EVENTS.SOS_TRIGGERED,
      userId,
      hasLocation: !!alertData.location,
      hasBooking: !!alertData.bookingId,
    });

    try {
      const { location, bookingId, message } = alertData;

      // Get user info
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      // Get emergency contacts
      const emergencyContacts = user.emergencyContacts || [];
      if (emergencyContacts.length === 0) {
        logger.warn('SOS triggered without emergency contacts', { userId });
      }

      // Get booking info if provided
      let booking = null;
      if (bookingId) {
        booking = await this.bookingRepository.findById(bookingId);
      }

      // Create SOS alert
      const alertId = randomUUID();
      const sosAlert = {
        alertId,
        userId,
        type: ALERT_TYPE.SOS,
        status: ALERT_STATUS.ACTIVE,
        location: location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: formatDate(now()),
            }
          : null,
        bookingId: booking?.bookingId,
        rideId: booking?.rideId,
        message: message || 'SOS Alert - User needs help',
        triggeredAt: formatDate(now()),
        expiresAt: formatDate(addMinutes(now(), SAFETY_CONFIG.sosAlertExpiryMinutes)),
        notificationsSent: [],
      };

      // Store alert
      this.activeAlerts.set(alertId, sosAlert);

      // Also persist to database
      await this._persistAlert(sosAlert);

      // Send notifications to emergency contacts
      const notificationResults = await this.notificationService.sendSOSAlert({
        userId,
        location,
        emergencyContacts,
        booking,
      });

      sosAlert.notificationsSent = notificationResults;

      // If user is a passenger, notify the driver
      if (booking && booking.passengerId === userId) {
        await this._notifyDriverOfSOS(booking, sosAlert);
      }

      // If user is a driver, notify all passengers
      if (booking && booking.driverId === userId) {
        await this._notifyPassengersOfSOS(booking.rideId, sosAlert);
      }

      // Notify university security (in production)
      await this._notifyUniversitySecurity(sosAlert, user, booking);

      logger.info('SOS alert created and notifications sent', {
        action: SAFETY_EVENTS.SOS_TRIGGERED,
        alertId,
        userId,
        contactsNotified: emergencyContacts.length,
        duration: Date.now() - startTime,
      });

      return {
        alertId,
        status: ALERT_STATUS.ACTIVE,
        message: 'SOS alert sent to emergency contacts',
        contactsNotified: emergencyContacts.length,
        emergencyNumbers: SAFETY_CONFIG.emergencyNumbers,
        instructions: [
          'Stay calm and find a safe location if possible',
          'Your emergency contacts have been notified',
          'Keep your phone accessible',
          'If in immediate danger, call 112',
        ],
      };
    } catch (error) {
      logger.error('SOS trigger failed', {
        action: 'SOS_TRIGGER_FAILED',
        userId,
        error: error.message,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Resolve SOS alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User resolving the alert
   * @param {Object} resolution - Resolution data
   * @returns {Promise<Object>} Resolution result
   */
  async resolveSOS(alertId, userId, resolution = {}) {
    logger.info('Resolving SOS alert', {
      action: SAFETY_EVENTS.SOS_RESOLVED,
      alertId,
      userId,
    });

    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new NotFoundError('Alert not found', ERROR_CODES.ALERT_NOT_FOUND);
      }

      if (alert.userId !== userId) {
        throw new ForbiddenError('Not authorized to resolve this alert', ERROR_CODES.FORBIDDEN);
      }

      if (alert.status !== ALERT_STATUS.ACTIVE) {
        throw new BadRequestError('Alert is already resolved', ERROR_CODES.ALERT_ALREADY_RESOLVED);
      }

      const { isFalseAlarm = false, notes = '' } = resolution;

      // Update alert
      alert.status = isFalseAlarm ? ALERT_STATUS.FALSE_ALARM : ALERT_STATUS.RESOLVED;
      alert.resolvedAt = formatDate(now());
      alert.resolutionNotes = notes;
      alert.resolvedBy = userId;

      // Update in store
      this.activeAlerts.set(alertId, alert);

      // Persist update
      await this._updateAlert(alertId, alert);

      // Notify emergency contacts that alert is resolved
      const user = await this.userRepository.findById(userId);
      await this._notifyAlertResolved(alert, user);

      logger.info('SOS alert resolved', {
        action: SAFETY_EVENTS.SOS_RESOLVED,
        alertId,
        isFalseAlarm,
      });

      return {
        alertId,
        status: alert.status,
        message: isFalseAlarm ? 'Alert marked as false alarm' : 'Alert resolved successfully',
      };
    } catch (error) {
      logger.error('SOS resolution failed', {
        action: 'SOS_RESOLVE_FAILED',
        alertId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active alerts for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active alerts
   */
  async getActiveAlerts(userId) {
    const alerts = Array.from(this.activeAlerts.values()).filter(
      (alert) => alert.userId === userId && alert.status === ALERT_STATUS.ACTIVE,
    );

    return alerts;
  }

  // ==================== Live Tracking ====================

  /**
   * Start live tracking for a ride
   * @param {string} rideId - Ride ID
   * @param {string} userId - User starting tracking
   * @returns {Promise<Object>} Tracking session
   */
  async startTracking(rideId, userId) {
    logger.info('Starting live tracking', {
      action: SAFETY_EVENTS.TRACKING_STARTED,
      rideId,
      userId,
    });

    try {
      const ride = await this.rideRepository.findById(rideId);
      if (!ride) {
        throw new NotFoundError('Ride not found', ERROR_CODES.RIDE_NOT_FOUND);
      }

      // Only driver or passenger can start tracking
      const bookings = await this.bookingRepository.findByRide(rideId);
      const passengerIds = bookings.map((b) => b.passengerId);
      const isAuthorized = ride.driverId === userId || passengerIds.includes(userId);

      if (!isAuthorized) {
        throw new ForbiddenError('Not authorized to track this ride', ERROR_CODES.FORBIDDEN);
      }

      const sessionId = randomUUID();
      const session = {
        sessionId,
        rideId,
        userId,
        startedAt: formatDate(now()),
        status: 'active',
        locations: [],
        sharedWith: [], // Users who can view this tracking
      };

      this.trackingSessions.set(sessionId, session);

      return {
        sessionId,
        message: 'Tracking started',
        shareUrl: `${process.env.APP_URL}/track/${sessionId}`,
        updateInterval: SAFETY_CONFIG.locationUpdateIntervalSeconds,
      };
    } catch (error) {
      logger.error('Tracking start failed', {
        action: 'TRACKING_START_FAILED',
        rideId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update location for tracking session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User updating
   * @param {Object} location - Location data
   * @returns {Promise<Object>} Update result
   */
  async updateLocation(sessionId, userId, location) {
    try {
      const session = this.trackingSessions.get(sessionId);
      if (!session) {
        throw new NotFoundError('Tracking session not found', ERROR_CODES.SESSION_NOT_FOUND);
      }

      if (session.userId !== userId) {
        throw new ForbiddenError('Not authorized to update this session', ERROR_CODES.FORBIDDEN);
      }

      const locationUpdate = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        timestamp: formatDate(now()),
      };

      // Add to location history
      session.locations.push(locationUpdate);
      session.lastLocation = locationUpdate;
      session.lastUpdateAt = formatDate(now());

      // Keep only last 100 locations in memory
      if (session.locations.length > 100) {
        session.locations = session.locations.slice(-100);
      }

      // Check for safety alerts
      await this._checkLocationSafety(session, locationUpdate);

      this.trackingSessions.set(sessionId, session);

      return {
        success: true,
        timestamp: locationUpdate.timestamp,
      };
    } catch (error) {
      logger.error('Location update failed', {
        action: 'LOCATION_UPDATE_FAILED',
        sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get current tracking location
   * @param {string} sessionId - Session ID
   * @param {string} viewerId - User viewing the location
   * @returns {Promise<Object>} Current location
   */
  async getTrackingLocation(sessionId, viewerId) {
    const session = this.trackingSessions.get(sessionId);
    if (!session) {
      throw new NotFoundError('Tracking session not found', ERROR_CODES.SESSION_NOT_FOUND);
    }

    // Check if viewer is authorized
    const ride = await this.rideRepository.findById(session.rideId);
    const bookings = await this.bookingRepository.findByRide(session.rideId);
    const passengerIds = bookings.map((b) => b.passengerId);

    const isDriver = ride.driverId === viewerId;
    const isPassenger = passengerIds.includes(viewerId);
    const isEmergencyContact = session.sharedWith.includes(viewerId);

    if (!isDriver && !isPassenger && !isEmergencyContact) {
      throw new ForbiddenError('Not authorized to view this tracking', ERROR_CODES.FORBIDDEN);
    }

    return {
      sessionId,
      rideId: session.rideId,
      currentLocation: session.lastLocation,
      lastUpdateAt: session.lastUpdateAt,
      status: session.status,
      route: session.locations.slice(-20), // Last 20 locations for route display
    };
  }

  /**
   * Share tracking with emergency contacts
   * @param {string} sessionId - Session ID
   * @param {string} userId - User sharing
   * @param {Array} contactIds - Contact IDs to share with
   * @returns {Promise<Object>} Share result
   */
  async shareTracking(sessionId, userId, contactIds) {
    logger.info('Sharing tracking', {
      action: 'TRACKING_SHARED',
      sessionId,
      userId,
      shareCount: contactIds.length,
    });

    try {
      const session = this.trackingSessions.get(sessionId);
      if (!session || session.userId !== userId) {
        throw new ForbiddenError('Not authorized', ERROR_CODES.FORBIDDEN);
      }

      const user = await this.userRepository.findById(userId);
      const emergencyContacts = user.emergencyContacts || [];

      // Filter to valid emergency contacts
      const validContacts = emergencyContacts.filter((c) => contactIds.includes(c.contactId));

      // Add to shared list
      session.sharedWith = [...new Set([...session.sharedWith, ...contactIds])];
      this.trackingSessions.set(sessionId, session);

      // Send share notifications
      const shareUrl = `${process.env.APP_URL}/track/${sessionId}`;
      await Promise.all(
        validContacts.map((contact) =>
          this.notificationService.sendSMS(
            contact.phone,
            `${user.firstName} is sharing their ride location with you. Track here: ${shareUrl}`,
            userId,
          ),
        ),
      );

      return {
        message: 'Tracking shared with emergency contacts',
        sharedWith: validContacts.map((c) => c.name),
        shareUrl,
      };
    } catch (error) {
      logger.error('Tracking share failed', {
        action: 'TRACKING_SHARE_FAILED',
        sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Stop tracking session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User stopping
   * @returns {Promise<Object>} Stop result
   */
  async stopTracking(sessionId, userId) {
    logger.info('Stopping tracking', {
      action: SAFETY_EVENTS.TRACKING_STOPPED,
      sessionId,
      userId,
    });

    try {
      const session = this.trackingSessions.get(sessionId);
      if (!session) {
        return { message: 'Session not found or already stopped' };
      }

      if (session.userId !== userId) {
        throw new ForbiddenError('Not authorized', ERROR_CODES.FORBIDDEN);
      }

      session.status = 'stopped';
      session.stoppedAt = formatDate(now());
      this.trackingSessions.set(sessionId, session);

      // Optionally persist session history for analytics
      await this._persistTrackingSession(session);

      return {
        message: 'Tracking stopped',
        duration: this._calculateSessionDuration(session),
        locationsRecorded: session.locations.length,
      };
    } catch (error) {
      logger.error('Tracking stop failed', {
        action: 'TRACKING_STOP_FAILED',
        sessionId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Safety Checks ====================

  /**
   * Perform safety check on user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Safety check result
   */
  async performSafetyCheck(userId) {
    logger.info('Performing safety check', {
      action: 'SAFETY_CHECK',
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      // Check for active bookings
      const activeBookings = await this.bookingRepository.findActiveByUser(userId);

      // Check for active alerts
      const activeAlerts = await this.getActiveAlerts(userId);

      // Check emergency contacts
      const hasEmergencyContacts = (user.emergencyContacts?.length || 0) > 0;

      const safetyStatus = {
        hasActiveRide: activeBookings.length > 0,
        hasActiveAlert: activeAlerts.length > 0,
        hasEmergencyContacts,
        isVerified: user.isVerified,
        emergencyContactCount: user.emergencyContacts?.length || 0,
        recommendations: [],
      };

      // Generate recommendations
      if (!hasEmergencyContacts) {
        safetyStatus.recommendations.push({
          type: 'emergency_contacts',
          message: 'Add emergency contacts for your safety',
          action: 'add_contacts',
        });
      }

      if (!user.isVerified) {
        safetyStatus.recommendations.push({
          type: 'verification',
          message: 'Verify your email for full access',
          action: 'verify_email',
        });
      }

      if (!user.phoneVerified) {
        safetyStatus.recommendations.push({
          type: 'phone_verification',
          message: 'Verify your phone number for SMS alerts',
          action: 'verify_phone',
        });
      }

      return safetyStatus;
    } catch (error) {
      logger.error('Safety check failed', {
        action: 'SAFETY_CHECK_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Report safety concern
   * @param {string} reporterId - Reporter user ID
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} Report result
   */
  async reportSafetyConcern(reporterId, reportData) {
    logger.info('Safety concern reported', {
      action: 'SAFETY_CONCERN_REPORTED',
      reporterId,
      type: reportData.type,
    });

    try {
      const { type, targetUserId, bookingId, rideId, description, location } = reportData;

      const reportId = randomUUID();
      const report = {
        reportId,
        reporterId,
        type,
        targetUserId,
        bookingId,
        rideId,
        description,
        location,
        status: 'pending',
        createdAt: formatDate(now()),
      };

      // Store report
      await this._persistSafetyReport(report);

      // If urgent, escalate immediately
      const urgentTypes = ['harassment', 'threat', 'violence', 'intoxication'];
      if (urgentTypes.includes(type)) {
        await this._escalateSafetyReport(report);
      }

      return {
        reportId,
        message: 'Safety concern reported. Our team will review it.',
        isUrgent: urgentTypes.includes(type),
      };
    } catch (error) {
      logger.error('Safety report failed', {
        action: 'SAFETY_REPORT_FAILED',
        reporterId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Emergency Contacts ====================

  /**
   * Quick share location with emergency contacts
   * @param {string} userId - User ID
   * @param {Object} location - Current location
   * @returns {Promise<Object>} Share result
   */
  async quickShareLocation(userId, location) {
    logger.info('Quick share location', {
      action: 'QUICK_SHARE',
      userId,
    });

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      const emergencyContacts = user.emergencyContacts || [];
      if (emergencyContacts.length === 0) {
        throw new BadRequestError(
          'No emergency contacts configured',
          ERROR_CODES.NO_EMERGENCY_CONTACTS,
        );
      }

      const mapsUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
      const message = `${user.firstName} shared their location with you: ${mapsUrl} (${formatDateTime(now())})`;

      const results = await Promise.all(
        emergencyContacts.map(async (contact) => {
          try {
            await this.notificationService.sendSMS(contact.phone, message, userId);
            return { contact: contact.name, status: 'sent' };
          } catch (error) {
            return { contact: contact.name, status: 'failed', error: error.message };
          }
        }),
      );

      return {
        message: 'Location shared with emergency contacts',
        results,
        mapsUrl,
      };
    } catch (error) {
      logger.error('Quick share failed', {
        action: 'QUICK_SHARE_FAILED',
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * Check location for safety issues
   * @private
   */
  async _checkLocationSafety(session, location) {
    // Check for route deviation
    if (session.expectedRoute) {
      const deviation = this._calculateRouteDeviation(location, session.expectedRoute);
      if (deviation > SAFETY_CONFIG.routeDeviationThresholdKm) {
        await this._createSafetyAlert(session.userId, {
          type: ALERT_TYPE.ROUTE_DEVIATION,
          message: `Route deviation detected: ${deviation.toFixed(1)}km from expected route`,
          location,
          rideId: session.rideId,
        });
      }
    }

    // Check for long stop
    if (session.lastLocation) {
      const distance = this._calculateDistance(location, session.lastLocation);
      const timeDiff = new Date(location.timestamp) - new Date(session.lastLocation.timestamp);
      const minutesStopped = timeDiff / (1000 * 60);

      if (distance < 0.1 && minutesStopped > SAFETY_CONFIG.longStopThresholdMinutes) {
        await this._createSafetyAlert(session.userId, {
          type: ALERT_TYPE.LONG_STOP,
          message: `Vehicle stopped for ${Math.round(minutesStopped)} minutes`,
          location,
          rideId: session.rideId,
        });
      }
    }

    // Check speed
    if (location.speed && location.speed > SAFETY_CONFIG.maxSpeedKph) {
      logger.warn('High speed detected', {
        sessionId: session.sessionId,
        speed: location.speed,
      });
    }
  }

  /**
   * Create safety alert
   * @private
   */
  async _createSafetyAlert(userId, alertData) {
    const alertId = randomUUID();
    const alert = {
      alertId,
      userId,
      ...alertData,
      status: ALERT_STATUS.ACTIVE,
      createdAt: formatDate(now()),
    };

    this.activeAlerts.set(alertId, alert);
    await this._persistAlert(alert);

    // Notify user
    await this.notificationService._sendPushNotification(userId, {
      title: 'Safety Alert',
      body: alertData.message,
      data: { alertId, type: alertData.type },
    });
  }

  /**
   * Notify driver of SOS
   * @private
   */
  async _notifyDriverOfSOS(booking, alert) {
    await this.notificationService._sendPushNotification(booking.driverId, {
      title: '🚨 Passenger SOS Alert',
      body: `Your passenger ${booking.passenger.firstName} has triggered an SOS alert.`,
      data: { alertId: alert.alertId, type: 'passenger_sos' },
    });

    const driver = await this.userRepository.findById(booking.driverId);
    if (driver?.phone) {
      await this.notificationService.sendSMS(
        driver.phone,
        `ALERT: Your passenger has triggered an SOS. Check on them immediately. If there's an emergency, call 112.`,
        booking.driverId,
      );
    }
  }

  /**
   * Notify passengers of SOS
   * @private
   */
  async _notifyPassengersOfSOS(rideId, alert) {
    const bookings = await this.bookingRepository.findByRide(rideId);
    const activeBookings = bookings.filter((b) => ['confirmed', 'in_progress'].includes(b.status));

    await Promise.all(
      activeBookings.map((booking) =>
        this.notificationService._sendPushNotification(booking.passengerId, {
          title: '🚨 Driver SOS Alert',
          body: 'Your driver has triggered an SOS alert. Stay alert and call 112 if needed.',
          data: { alertId: alert.alertId, type: 'driver_sos' },
        }),
      ),
    );
  }

  /**
   * Notify university security
   * @private
   */
  async _notifyUniversitySecurity(alert, user, booking) {
    // In production, this would integrate with university security systems
    logger.info('Notifying university security', {
      alertId: alert.alertId,
      userId: user.userId,
      location: alert.location,
    });

    // Log for security team
    const securityLog = {
      type: 'SOS_ALERT',
      alertId: alert.alertId,
      user: {
        id: user.userId,
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone,
        role: user.role,
        matricNumber: user.matricNumber,
        staffId: user.staffId,
      },
      location: alert.location,
      booking: booking
        ? {
            bookingId: booking.bookingId,
            driverId: booking.driverId,
            driverName: `${booking.driver.firstName} ${booking.driver.lastName}`,
            driverPhone: booking.driver.phone,
            vehiclePlate: booking.vehicle?.plateNumber,
          }
        : null,
      timestamp: formatDate(now()),
    };

    logger.info('Security notification sent', { securityLog });
  }

  /**
   * Notify that alert is resolved
   * @private
   */
  async _notifyAlertResolved(alert, user) {
    const emergencyContacts = user.emergencyContacts || [];

    await Promise.all(
      emergencyContacts.map((contact) =>
        this.notificationService.sendSMS(
          contact.phone,
          `Good news: ${user.firstName}'s SOS alert has been resolved. They are safe.`,
          user.userId,
        ),
      ),
    );
  }

  /**
   * Calculate distance between two points
   * @private
   */
  _calculateDistance(point1, point2) {
    const R = 6371;
    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLng = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate route deviation
   * @private
   */
  _calculateRouteDeviation(location, expectedRoute) {
    // Simplified: find minimum distance to any point on expected route
    return expectedRoute.reduce((minDistance, point) => {
      const distance = this._calculateDistance(location, point);
      return distance < minDistance ? distance : minDistance;
    }, Infinity);
  }

  /**
   * Calculate session duration
   * @private
   */
  _calculateSessionDuration(session) {
    const start = new Date(session.startedAt);
    const end = session.stoppedAt ? new Date(session.stoppedAt) : new Date();
    return Math.round((end - start) / (1000 * 60)); // Minutes
  }

  /**
   * Persist alert to database
   * @private
   */
  async _persistAlert(alert) {
    // In production, save to DynamoDB
    logger.debug('Alert persisted', { alertId: alert.alertId });
  }

  /**
   * Update alert in database
   * @private
   */
  async _updateAlert(alertId, _alert) {
    // In production, update in DynamoDB
    logger.debug('Alert updated', { alertId });
  }

  /**
   * Persist tracking session
   * @private
   */
  async _persistTrackingSession(session) {
    // In production, save to DynamoDB for analytics
    logger.debug('Tracking session persisted', { sessionId: session.sessionId });
  }

  /**
   * Persist safety report
   * @private
   */
  async _persistSafetyReport(report) {
    // In production, save to DynamoDB
    logger.debug('Safety report persisted', { reportId: report.reportId });
  }

  /**
   * Escalate safety report
   * @private
   */
  async _escalateSafetyReport(report) {
    logger.warn('Safety report escalated', {
      reportId: report.reportId,
      type: report.type,
    });
    // In production, notify admin team immediately
  }
}

module.exports = SafetyService;
