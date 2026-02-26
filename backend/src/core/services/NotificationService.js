/**
 * Notification Service
 * University of Ilorin Carpooling Platform
 *
 * Handles email, SMS, push, and in-app notifications.
 * Includes cash payment instructions and ride reminders.
 *
 * @module services/NotificationService
 */

const { randomUUID } = require('crypto');
const NotificationRepository = require('../../infrastructure/database/repositories/NotificationRepository');
const UserRepository = require('../../infrastructure/database/repositories/UserRepository');
const { logger } = require('../../shared/utils/logger');
const { formatDate, now, formatDateTime } = require('../../shared/utils/dateTime');
const { NotFoundError, BadRequestError } = require('../../shared/errors');
const { ERROR_CODES } = require('../../shared/constants/errors');
const { NOTIFICATION_EVENTS } = require('../../shared/constants/events');

/**
 * Notification types
 */
const NOTIFICATION_TYPE = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  IN_APP: 'in_app',
};

/**
 * Notification categories
 */
const NOTIFICATION_CATEGORY = {
  BOOKING: 'booking',
  RIDE: 'ride',
  PAYMENT: 'payment',
  SAFETY: 'safety',
  ACCOUNT: 'account',
  RATING: 'rating',
  SYSTEM: 'system',
  PROMOTIONAL: 'promotional',
};

/**
 * Notification priority
 */
const PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

/**
 * Email templates
 */
const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLED: 'booking_cancelled',
  RIDE_REMINDER: 'ride_reminder',
  RIDE_STARTED: 'ride_started',
  RIDE_COMPLETED: 'ride_completed',
  PAYMENT_INSTRUCTIONS: 'payment_instructions',
  RATING_REQUEST: 'rating_request',
  DRIVER_APPROVED: 'driver_approved',
  DOCUMENT_REJECTED: 'document_rejected',
  SOS_ALERT: 'sos_alert',
};

/**
 * NotificationService class
 * Manages all notification operations
 */
class NotificationService {
  constructor() {
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();
    this.serviceName = 'NotificationService';
  }

  // ==================== Email Notifications ====================

  /**
   * Send welcome email after registration
   * @param {Object} user - User object
   * @param {string} verificationToken - Email verification token
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeEmail(user, verificationToken) {
    logger.info('Sending welcome email', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      userId: user.userId,
      template: EMAIL_TEMPLATES.WELCOME,
    });

    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;

    const emailData = {
      to: user.email,
      subject: 'Welcome to UniRide - University of Ilorin Carpooling',
      template: EMAIL_TEMPLATES.WELCOME,
      data: {
        firstName: user.firstName,
        verificationUrl,
        role: user.role,
      },
    };

    return this._sendEmail(emailData, user.userId, NOTIFICATION_CATEGORY.ACCOUNT);
  }

  /**
   * Send email verification link
   * @param {Object} user - User object
   * @param {string} verificationToken - Verification token
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationEmail(user, verificationToken) {
    logger.info('Sending verification email', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      userId: user.userId,
      template: EMAIL_TEMPLATES.EMAIL_VERIFICATION,
    });

    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;

    const emailData = {
      to: user.email,
      subject: 'Verify Your Email - UniRide',
      template: EMAIL_TEMPLATES.EMAIL_VERIFICATION,
      data: {
        firstName: user.firstName,
        verificationUrl,
        expiresIn: '24 hours',
      },
    };

    return this._sendEmail(emailData, user.userId, NOTIFICATION_CATEGORY.ACCOUNT);
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetToken - Password reset token
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(user, resetToken) {
    logger.info('Sending password reset email', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      userId: user.userId,
      template: EMAIL_TEMPLATES.PASSWORD_RESET,
    });

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;

    const emailData = {
      to: user.email,
      subject: 'Reset Your Password - UniRide',
      template: EMAIL_TEMPLATES.PASSWORD_RESET,
      data: {
        firstName: user.firstName,
        resetUrl,
        expiresIn: '1 hour',
      },
    };

    return this._sendEmail(emailData, user.userId, NOTIFICATION_CATEGORY.ACCOUNT, PRIORITY.HIGH);
  }

  /**
   * Send booking confirmation with cash payment instructions
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Send result
   */
  async sendBookingConfirmation(booking) {
    logger.info('Sending booking confirmation', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      bookingId: booking.bookingId,
      template: EMAIL_TEMPLATES.BOOKING_CONFIRMATION,
    });

    const { passenger } = booking;
    const { driver } = booking;

    const emailData = {
      to: passenger.email || (await this._getUserEmail(booking.passengerId)),
      subject: `Booking Confirmed - ${booking.rideDate} at ${booking.rideTime}`,
      template: EMAIL_TEMPLATES.BOOKING_CONFIRMATION,
      data: {
        firstName: passenger.firstName,
        bookingReference: booking.bookingReference,
        rideDate: booking.rideDate,
        rideTime: booking.rideTime,
        pickupLocation: booking.pickupPointName || booking.startLocation?.name,
        destination: booking.endLocation?.name,
        seats: booking.seats,
        totalAmount: booking.totalAmount,
        driverName: `${driver.firstName} ${driver.lastName}`,
        vehicleInfo: booking.vehicle
          ? `${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.color})`
          : 'TBA',
        verificationCode: booking.verificationCode,
        // Cash payment instructions
        paymentMethod: 'Cash',
        paymentInstructions: [
          `Pay ₦${booking.totalAmount} in cash to the driver when boarding`,
          `Show your verification code (${booking.verificationCode}) to the driver`,
          'Keep exact change ready if possible',
          'Request confirmation from driver after payment',
        ],
      },
    };

    // Also create in-app notification
    await this._createInAppNotification(booking.passengerId, {
      title: 'Booking Confirmed',
      message: `Your ride on ${booking.rideDate} at ${booking.rideTime} is confirmed. Pay ₦${booking.totalAmount} cash to driver.`,
      category: NOTIFICATION_CATEGORY.BOOKING,
      data: { bookingId: booking.bookingId },
    });

    return this._sendEmail(emailData, booking.passengerId, NOTIFICATION_CATEGORY.BOOKING);
  }

  /**
   * Send booking cancellation notification
   * @param {Object} booking - Booking object
   * @param {string} cancelledBy - 'passenger' or 'driver'
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Send result
   */
  async sendBookingCancellation(booking, cancelledBy, reason = '') {
    logger.info('Sending booking cancellation', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      bookingId: booking.bookingId,
      cancelledBy,
    });

    // Notify the other party
    const recipientId = cancelledBy === 'passenger' ? booking.driverId : booking.passengerId;
    const recipientEmail = await this._getUserEmail(recipientId);
    const recipient = await this.userRepository.findById(recipientId);

    const emailData = {
      to: recipientEmail,
      subject: `Booking Cancelled - ${booking.rideDate}`,
      template: EMAIL_TEMPLATES.BOOKING_CANCELLED,
      data: {
        firstName: recipient.firstName,
        bookingReference: booking.bookingReference,
        rideDate: booking.rideDate,
        rideTime: booking.rideTime,
        cancelledBy: cancelledBy === 'passenger' ? 'The passenger' : 'The driver',
        reason: reason || 'No reason provided',
      },
    };

    // In-app notification
    await this._createInAppNotification(recipientId, {
      title: 'Booking Cancelled',
      message: `A booking for ${booking.rideDate} has been cancelled by the ${cancelledBy}.`,
      category: NOTIFICATION_CATEGORY.BOOKING,
      data: { bookingId: booking.bookingId },
    });

    return this._sendEmail(emailData, recipientId, NOTIFICATION_CATEGORY.BOOKING, PRIORITY.HIGH);
  }

  /**
   * Send ride reminder (1 hour before departure)
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Send result
   */
  async sendRideReminder(booking) {
    logger.info('Sending ride reminder', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      bookingId: booking.bookingId,
      template: EMAIL_TEMPLATES.RIDE_REMINDER,
    });

    const { passenger } = booking;

    const emailData = {
      to: passenger.email || (await this._getUserEmail(booking.passengerId)),
      subject: `Reminder: Your ride is in 1 hour - ${booking.rideTime}`,
      template: EMAIL_TEMPLATES.RIDE_REMINDER,
      data: {
        firstName: passenger.firstName,
        rideTime: booking.rideTime,
        pickupLocation: booking.pickupPointName || booking.startLocation?.name,
        driverName: `${booking.driver.firstName} ${booking.driver.lastName}`,
        driverPhone: booking.driver.phone,
        vehicleInfo: booking.vehicle
          ? `${booking.vehicle.color} ${booking.vehicle.make} ${booking.vehicle.model}`
          : '',
        plateNumber: booking.vehicle?.plateNumber,
        verificationCode: booking.verificationCode,
        totalAmount: booking.totalAmount,
        paymentReminder: `Remember to have ₦${booking.totalAmount} ready in cash`,
      },
    };

    // Push notification
    await this._sendPushNotification(booking.passengerId, {
      title: 'Ride Starting Soon! 🚗',
      body: `Your ride departs at ${booking.rideTime}. Have ₦${booking.totalAmount} cash ready.`,
      data: { bookingId: booking.bookingId, type: 'ride_reminder' },
    });

    // In-app notification
    await this._createInAppNotification(booking.passengerId, {
      title: 'Ride Starting Soon',
      message: `Your ride to ${booking.endLocation?.name} departs at ${booking.rideTime}. Don't forget your verification code!`,
      category: NOTIFICATION_CATEGORY.RIDE,
      priority: PRIORITY.HIGH,
      data: { bookingId: booking.bookingId },
    });

    return this._sendEmail(
      emailData,
      booking.passengerId,
      NOTIFICATION_CATEGORY.RIDE,
      PRIORITY.HIGH,
    );
  }

  /**
   * Send ride started notification to passenger
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Send result
   */
  async sendRideStarted(booking) {
    logger.info('Sending ride started notification', {
      action: NOTIFICATION_EVENTS.PUSH_SENT,
      bookingId: booking.bookingId,
    });

    // Push notification
    await this._sendPushNotification(booking.passengerId, {
      title: 'Ride Started! 🚗',
      body: `Your driver ${booking.driver.firstName} has started the journey.`,
      data: { bookingId: booking.bookingId, type: 'ride_started' },
    });

    // In-app notification
    return this._createInAppNotification(booking.passengerId, {
      title: 'Ride Started',
      message: `Your ride has started. Enjoy your journey!`,
      category: NOTIFICATION_CATEGORY.RIDE,
      data: { bookingId: booking.bookingId },
    });
  }

  /**
   * Send ride completed notification with rating request
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Send result
   */
  async sendRideCompleted(booking) {
    logger.info('Sending ride completed notification', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      bookingId: booking.bookingId,
      template: EMAIL_TEMPLATES.RIDE_COMPLETED,
    });

    const { passenger } = booking;

    const emailData = {
      to: passenger.email || (await this._getUserEmail(booking.passengerId)),
      subject: 'Trip Completed - Rate Your Experience',
      template: EMAIL_TEMPLATES.RIDE_COMPLETED,
      data: {
        firstName: passenger.firstName,
        rideDate: booking.rideDate,
        destination: booking.endLocation?.name,
        driverName: `${booking.driver.firstName} ${booking.driver.lastName}`,
        amountPaid: booking.amountReceived || booking.totalAmount,
        ratingUrl: `${process.env.APP_URL}/rate/${booking.bookingId}`,
      },
    };

    // Push notification
    await this._sendPushNotification(booking.passengerId, {
      title: 'Trip Completed! ⭐',
      body: 'How was your ride? Tap to rate your driver.',
      data: { bookingId: booking.bookingId, type: 'rating_request' },
    });

    // In-app notification
    await this._createInAppNotification(booking.passengerId, {
      title: 'Trip Completed',
      message: 'Thank you for riding with UniRide! Please rate your experience.',
      category: NOTIFICATION_CATEGORY.RATING,
      data: { bookingId: booking.bookingId, action: 'rate' },
    });

    return this._sendEmail(emailData, booking.passengerId, NOTIFICATION_CATEGORY.RIDE);
  }

  // ==================== Driver Notifications ====================

  /**
   * Notify driver of new booking
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Send result
   */
  async notifyDriverNewBooking(booking) {
    logger.info('Notifying driver of new booking', {
      action: NOTIFICATION_EVENTS.PUSH_SENT,
      bookingId: booking.bookingId,
      driverId: booking.driverId,
    });

    // Push notification
    await this._sendPushNotification(booking.driverId, {
      title: 'New Booking! 🎉',
      body: `${booking.passenger.firstName} booked ${booking.seats} seat(s) for your ${booking.rideTime} ride.`,
      data: { bookingId: booking.bookingId, rideId: booking.rideId, type: 'new_booking' },
    });

    // In-app notification
    return this._createInAppNotification(booking.driverId, {
      title: 'New Booking',
      message: `${booking.passenger.firstName} booked ${booking.seats} seat(s) for your ride on ${booking.rideDate} at ${booking.rideTime}. Expected cash: ₦${booking.totalAmount}`,
      category: NOTIFICATION_CATEGORY.BOOKING,
      data: { bookingId: booking.bookingId, rideId: booking.rideId },
    });
  }

  /**
   * Send driver verification approved notification
   * @param {Object} user - User object
   * @returns {Promise<Object>} Send result
   */
  async sendDriverApproved(user) {
    logger.info('Sending driver approval notification', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      userId: user.userId,
      template: EMAIL_TEMPLATES.DRIVER_APPROVED,
    });

    const emailData = {
      to: user.email,
      subject: "Congratulations! You're Now a Verified Driver 🎉",
      template: EMAIL_TEMPLATES.DRIVER_APPROVED,
      data: {
        firstName: user.firstName,
        createRideUrl: `${process.env.APP_URL}/rides/create`,
      },
    };

    // Push notification
    await this._sendPushNotification(user.userId, {
      title: 'Driver Status Approved! 🎉',
      body: 'You can now create ride offers and start earning.',
      data: { type: 'driver_approved' },
    });

    // In-app notification
    await this._createInAppNotification(user.userId, {
      title: 'Driver Verification Approved',
      message: 'Congratulations! Your driver account is now active. Start creating ride offers!',
      category: NOTIFICATION_CATEGORY.ACCOUNT,
      priority: PRIORITY.HIGH,
    });

    return this._sendEmail(emailData, user.userId, NOTIFICATION_CATEGORY.ACCOUNT);
  }

  /**
   * Send document rejected notification
   * @param {Object} user - User object
   * @param {string} documentType - Type of document
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Send result
   */
  async sendDocumentRejected(user, documentType, reason) {
    logger.info('Sending document rejection notification', {
      action: NOTIFICATION_EVENTS.EMAIL_SENT,
      userId: user.userId,
      documentType,
    });

    const emailData = {
      to: user.email,
      subject: `Document Verification Failed - ${documentType}`,
      template: EMAIL_TEMPLATES.DOCUMENT_REJECTED,
      data: {
        firstName: user.firstName,
        documentType,
        reason,
        uploadUrl: `${process.env.APP_URL}/profile/documents`,
      },
    };

    // In-app notification
    await this._createInAppNotification(user.userId, {
      title: 'Document Rejected',
      message: `Your ${documentType} was rejected: ${reason}. Please upload a new document.`,
      category: NOTIFICATION_CATEGORY.ACCOUNT,
      priority: PRIORITY.HIGH,
      data: { documentType, action: 'reupload' },
    });

    return this._sendEmail(emailData, user.userId, NOTIFICATION_CATEGORY.ACCOUNT, PRIORITY.HIGH);
  }

  // ==================== SMS Notifications ====================

  /**
   * Send SMS notification
   * @param {string} phone - Phone number
   * @param {string} message - SMS message
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Send result
   */
  async sendSMS(phone, message, userId = null) {
    logger.info('Sending SMS', {
      action: NOTIFICATION_EVENTS.SMS_SENT,
      phone: `${phone.substring(0, 8)}****`,
      userId,
    });

    try {
      // In production, integrate with AWS SNS or African SMS gateway
      // For now, we'll simulate the SMS send
      const smsResult = await this._sendSMSViaProvider(phone, message);

      // Log the notification
      if (userId) {
        await this._logNotification(userId, {
          type: NOTIFICATION_TYPE.SMS,
          phone,
          message,
          status: 'sent',
          provider: 'aws_sns',
          providerMessageId: smsResult.messageId,
        });
      }

      return {
        success: true,
        messageId: smsResult.messageId,
      };
    } catch (error) {
      logger.error('SMS send failed', {
        action: 'SMS_SEND_FAILED',
        phone: `${phone.substring(0, 8)}****`,
        error: error.message,
      });

      if (userId) {
        await this._logNotification(userId, {
          type: NOTIFICATION_TYPE.SMS,
          phone,
          message,
          status: 'failed',
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Send verification code via SMS
   * @param {string} phone - Phone number
   * @param {string} code - Verification code
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationSMS(phone, code, userId) {
    const message = `Your UniRide verification code is: ${code}. Valid for 10 minutes. Do not share this code.`;
    return this.sendSMS(phone, message, userId);
  }

  /**
   * Send booking verification code via SMS
   * @param {Object} booking - Booking object
   * @returns {Promise<Object>} Send result
   */
  async sendBookingCodeSMS(booking) {
    const phone = booking.passenger?.phone;
    if (!phone) {
      logger.warn('No phone number for booking SMS', { bookingId: booking.bookingId });
      return { success: false, reason: 'no_phone' };
    }

    const message = `UniRide Booking: Your code is ${booking.verificationCode}. Show this to driver ${booking.driver.firstName}. Ride: ${booking.rideDate} ${booking.rideTime}. Pay ₦${booking.totalAmount} cash.`;
    return this.sendSMS(phone, message, booking.passengerId);
  }

  // ==================== Push Notifications ====================

  /**
   * Send push notification
   * @param {string} userId - User ID
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} Send result
   */
  async _sendPushNotification(userId, notification) {
    try {
      // Get user's push tokens
      const user = await this.userRepository.findById(userId);
      const pushTokens = user?.pushTokens || [];

      if (pushTokens.length === 0) {
        logger.debug('No push tokens for user', { userId });
        return { success: false, reason: 'no_tokens' };
      }

      // In production, integrate with Firebase Cloud Messaging or AWS SNS
      const results = await Promise.allSettled(
        pushTokens.map((token) => this._sendPushViaProvider(token, notification)),
      );

      const successCount = results.filter((r) => r.status === 'fulfilled').length;

      logger.info('Push notification sent', {
        action: NOTIFICATION_EVENTS.PUSH_SENT,
        userId,
        successCount,
        totalTokens: pushTokens.length,
      });

      return {
        success: successCount > 0,
        sent: successCount,
        total: pushTokens.length,
      };
    } catch (error) {
      logger.error('Push notification failed', {
        action: 'PUSH_SEND_FAILED',
        userId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Register push token for user
   * @param {string} userId - User ID
   * @param {string} token - Push token
   * @param {string} platform - Platform (ios, android, web)
   * @returns {Promise<Object>} Registration result
   */
  async registerPushToken(userId, token, platform) {
    logger.info('Registering push token', {
      action: 'PUSH_TOKEN_REGISTERED',
      userId,
      platform,
    });

    await this.userRepository.addPushToken(userId, {
      token,
      platform,
      registeredAt: formatDate(now()),
    });

    return { success: true };
  }

  /**
   * Remove push token
   * @param {string} userId - User ID
   * @param {string} token - Push token
   * @returns {Promise<Object>} Removal result
   */
  async removePushToken(userId, token) {
    logger.info('Removing push token', {
      action: 'PUSH_TOKEN_REMOVED',
      userId,
    });

    await this.userRepository.removePushToken(userId, token);
    return { success: true };
  }

  // ==================== In-App Notifications ====================

  /**
   * Create in-app notification
   * @param {string} userId - User ID
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} Created notification
   */
  async _createInAppNotification(userId, notification) {
    const notificationId = randomUUID();

    const notificationData = {
      notificationId,
      userId,
      type: NOTIFICATION_TYPE.IN_APP,
      title: notification.title,
      message: notification.message,
      category: notification.category || NOTIFICATION_CATEGORY.SYSTEM,
      priority: notification.priority || PRIORITY.NORMAL,
      data: notification.data || {},
      isRead: false,
      createdAt: formatDate(now()),
    };

    await this.notificationRepository.create(notificationData);

    return notificationData;
  }

  /**
   * Get a single notification by ID
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for ownership check)
   * @returns {Promise<Object>} Notification
   */
  async getNotificationById(notificationId, userId) {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotFoundError('Notification not found', ERROR_CODES.NOTIFICATION_NOT_FOUND);
    }

    if (notification.userId !== userId) {
      throw new BadRequestError('Not authorized', ERROR_CODES.FORBIDDEN);
    }

    return notification;
  }

  /**
   * Send a notification to a specific user (admin/system use)
   * @param {string} userId - Target user ID
   * @param {Object} options - Notification options
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {string} options.type - Notification category
   * @param {Array} options.channels - Delivery channels
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Created notification
   */
  async sendNotification(userId, options) {
    const { title, message, type = 'system', channels = ['in_app'], metadata = {} } = options;

    logger.info('Sending notification', {
      action: 'SEND_NOTIFICATION',
      userId,
      type,
      channels,
    });

    let result = null;

    if (channels.includes('in_app')) {
      result = await this._createInAppNotification(userId, {
        title,
        message,
        category: type,
        data: metadata,
      });
    }

    if (channels.includes('push')) {
      await this._sendPushNotification(userId, {
        title,
        body: message,
        data: { type, ...metadata },
      });
    }

    if (channels.includes('email')) {
      const userEmail = await this._getUserEmail(userId);
      if (userEmail) {
        await this._sendEmail(
          { to: userEmail, subject: title, template: null, data: { message } },
          userId,
          type,
        );
      }
    }

    return result;
  }

  /**
   * Get user's in-app notifications
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications list
   */
  async getNotifications(userId, options = {}) {
    const { page = 1, limit = 20, unreadOnly = false, category } = options;

    let notifications = await this.notificationRepository.findByUser(userId);

    // Filter by read status
    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead);
    }

    // Filter by category
    if (category) {
      notifications = notifications.filter((n) => n.category === category);
    }

    // Sort by date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Count unread
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    // Paginate
    const totalCount = notifications.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const paginatedNotifications = notifications.slice(startIndex, startIndex + limit);

    return {
      notifications: paginatedNotifications,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
      unreadCount,
    };
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId, userId) {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotFoundError('Notification not found', ERROR_CODES.NOTIFICATION_NOT_FOUND);
    }

    if (notification.userId !== userId) {
      throw new BadRequestError('Not authorized', ERROR_CODES.FORBIDDEN);
    }

    if (notification.isRead) {
      return { notification, alreadyRead: true };
    }

    const updated = await this.notificationRepository.markAsRead(notificationId);
    return { notification: updated, alreadyRead: false };
  }

  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result
   */
  async markAllAsRead(userId) {
    const result = await this.notificationRepository.markAllAsRead(userId);
    return { success: true, updatedCount: result.modifiedCount || 0 };
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteNotification(notificationId, userId) {
    const notification = await this.notificationRepository.findById(notificationId);

    if (!notification) {
      throw new NotFoundError('Notification not found', ERROR_CODES.NOTIFICATION_NOT_FOUND);
    }

    if (notification.userId !== userId) {
      throw new BadRequestError('Not authorized', ERROR_CODES.FORBIDDEN);
    }

    await this.notificationRepository.delete(notificationId);
    return { success: true };
  }

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    const count = await this.notificationRepository.countUnread(userId);
    return { unreadCount: count };
  }

  // ==================== Safety Notifications ====================

  /**
   * Send SOS alert to emergency contacts
   * @param {Object} alertData - SOS alert data
   * @returns {Promise<Object>} Send results
   */
  async sendSOSAlert(alertData) {
    logger.info('Sending SOS alert', {
      action: NOTIFICATION_EVENTS.SOS_TRIGGERED,
      userId: alertData.userId,
      bookingId: alertData.bookingId,
    });

    const { userId, location, emergencyContacts, booking } = alertData;
    const user = await this.userRepository.findById(userId);

    const results = {
      sms: [],
      email: [],
    };

    // Send to each emergency contact
    const contactPromises = emergencyContacts.map(async (contact) => {
      const locationUrl = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
      const contactResults = { sms: null, email: null };

      // SMS alert
      const smsMessage = `EMERGENCY: ${user.firstName} ${user.lastName} triggered an SOS alert. Location: ${locationUrl}. ${booking ? `Ride with ${booking.driver.firstName} (${booking.vehicle?.plateNumber})` : ''}. Call them: ${user.phone}`;

      try {
        await this.sendSMS(contact.phone, smsMessage);
        contactResults.sms = { contact: contact.name, status: 'sent' };
      } catch (error) {
        contactResults.sms = { contact: contact.name, status: 'failed', error: error.message };
      }

      // Email alert if email available
      if (contact.email) {
        try {
          await this._sendEmail(
            {
              to: contact.email,
              subject: `🚨 EMERGENCY: SOS Alert from ${user.firstName}`,
              template: EMAIL_TEMPLATES.SOS_ALERT,
              data: {
                contactName: contact.name,
                userName: `${user.firstName} ${user.lastName}`,
                userPhone: user.phone,
                locationUrl,
                location: `${location.latitude}, ${location.longitude}`,
                rideInfo: booking
                  ? {
                      driverName: `${booking.driver.firstName} ${booking.driver.lastName}`,
                      driverPhone: booking.driver.phone,
                      vehicleInfo: booking.vehicle
                        ? `${booking.vehicle.color} ${booking.vehicle.make} ${booking.vehicle.model}`
                        : '',
                      plateNumber: booking.vehicle?.plateNumber,
                    }
                  : null,
                timestamp: formatDateTime(now()),
              },
            },
            userId,
            NOTIFICATION_CATEGORY.SAFETY,
            PRIORITY.URGENT,
          );
          contactResults.email = { contact: contact.name, status: 'sent' };
        } catch (error) {
          contactResults.email = { contact: contact.name, status: 'failed', error: error.message };
        }
      }

      return contactResults;
    });

    const contactResults = await Promise.all(contactPromises);

    // Aggregate results
    contactResults.forEach((contactResult) => {
      if (contactResult.sms) results.sms.push(contactResult.sms);
      if (contactResult.email) results.email.push(contactResult.email);
    });

    return results;
  }

  // ==================== Bulk Notifications ====================

  /**
   * Send bulk notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} Send results
   */
  async sendBulkNotification(userIds, notification) {
    logger.info('Sending bulk notification', {
      action: 'BULK_NOTIFICATION_SENT',
      recipientCount: userIds.length,
    });

    const results = await userIds.reduce(
      async (accPromise, userId) => {
        const acc = await accPromise;
        try {
          await this._createInAppNotification(userId, notification);
          return {
            ...acc,
            success: acc.success + 1,
          };
        } catch (error) {
          return {
            ...acc,
            failed: acc.failed + 1,
            errors: [...acc.errors, { userId, error: error.message }],
          };
        }
      },
      Promise.resolve({
        success: 0,
        failed: 0,
        errors: [],
      }),
    );

    return results;
  }

  /**
   * Send bulk notification with user filters (admin use)
   * Resolves filters to user IDs, then sends notifications
   * @param {Object} options - Bulk notification options
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {string} options.type - Notification category
   * @param {Array} options.channels - Delivery channels
   * @param {Object} options.filters - User filters (role, isDriver, isVerified)
   * @param {Object} options.metadata - Additional metadata
   * @returns {Promise<Object>} Send results with recipientCount
   */
  async sendAdminBulkNotification(options) {
    const { title, message, type = 'system', channels = ['in_app'], filters = {}, metadata = {} } = options;

    logger.info('Sending admin bulk notification', {
      action: 'ADMIN_BULK_NOTIFICATION',
      type,
      filters,
    });

    // Resolve filters to user list
    const users = await this.userRepository.findAll(filters);
    const userIds = users.map((u) => u.userId);

    if (userIds.length === 0) {
      return { recipientCount: 0 };
    }

    // Send in-app notifications in bulk
    if (channels.includes('in_app')) {
      await this.sendBulkNotification(userIds, {
        title,
        message,
        category: type,
        data: metadata,
      });
    }

    return { recipientCount: userIds.length };
  }

  // ==================== Notification Preferences ====================

  /**
   * Get user notification preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Preferences
   */
  async getPreferences(userId) {
    const user = await this.userRepository.findById(userId);
    return user?.notificationPreferences || this._getDefaultPreferences();
  }

  /**
   * Update notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - New preferences
   * @returns {Promise<Object>} Updated preferences
   */
  async updatePreferences(userId, preferences) {
    const validPreferences = this._validatePreferences(preferences);

    await this.userRepository.updateProfile(userId, {
      notificationPreferences: validPreferences,
    });

    return validPreferences;
  }

  // ==================== Private Methods ====================

  /**
   * Send email via provider
   * @private
   */
  async _sendEmail(emailData, userId, category, priority = PRIORITY.NORMAL) {
    try {
      // In production, integrate with AWS SES
      // For now, we'll simulate the email send
      const emailResult = await this._sendEmailViaProvider(emailData);

      // Log the notification
      await this._logNotification(userId, {
        type: NOTIFICATION_TYPE.EMAIL,
        to: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
        category,
        priority,
        status: 'sent',
        provider: 'aws_ses',
        providerMessageId: emailResult.messageId,
      });

      logger.info('Email sent successfully', {
        action: NOTIFICATION_EVENTS.EMAIL_SENT,
        userId,
        template: emailData.template,
        messageId: emailResult.messageId,
      });

      return {
        success: true,
        messageId: emailResult.messageId,
      };
    } catch (error) {
      logger.error('Email send failed', {
        action: 'EMAIL_SEND_FAILED',
        userId,
        template: emailData.template,
        error: error.message,
      });

      await this._logNotification(userId, {
        type: NOTIFICATION_TYPE.EMAIL,
        to: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
        category,
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Send email via AWS SES (placeholder)
   * @private
   */
  async _sendEmailViaProvider(_emailData) {
    // In production, this would call AWS SES
    // const ses = new AWS.SES();
    // return ses.sendEmail(params).promise();

    // Simulate email send
    return {
      messageId: `sim_${randomUUID()}`,
    };
  }

  /**
   * Send SMS via provider (placeholder)
   * @private
   */
  async _sendSMSViaProvider(_phone, _message) {
    // In production, this would call AWS SNS or African SMS gateway
    // const sns = new AWS.SNS();
    // return sns.publish({ PhoneNumber: phone, Message: message }).promise();

    // Simulate SMS send
    return {
      messageId: `sms_${randomUUID()}`,
    };
  }

  /**
   * Send push via provider (placeholder)
   * @private
   */
  async _sendPushViaProvider(_token, _notification) {
    // In production, this would call Firebase or AWS SNS
    // Simulate push send
    return {
      messageId: `push_${randomUUID()}`,
    };
  }

  /**
   * Log notification
   * @private
   */
  async _logNotification(userId, notificationData) {
    try {
      await this.notificationRepository.logNotification({
        logId: randomUUID(),
        userId,
        ...notificationData,
        createdAt: formatDate(now()),
      });
    } catch (error) {
      logger.error('Failed to log notification', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Get user email
   * @private
   */
  async _getUserEmail(userId) {
    const user = await this.userRepository.findById(userId);
    return user?.email;
  }

  /**
   * Get default notification preferences
   * @private
   */
  _getDefaultPreferences() {
    return {
      email: {
        booking: true,
        ride: true,
        payment: true,
        rating: true,
        account: true,
        promotional: false,
      },
      push: {
        booking: true,
        ride: true,
        payment: true,
        rating: true,
        account: true,
        promotional: false,
      },
      sms: {
        booking: true,
        ride: true,
        safety: true,
      },
    };
  }

  /**
   * Validate preferences
   * @private
   */
  _validatePreferences(preferences) {
    const defaults = this._getDefaultPreferences();

    return {
      email: { ...defaults.email, ...preferences.email },
      push: { ...defaults.push, ...preferences.push },
      sms: { ...defaults.sms, ...preferences.sms },
    };
  }
}

module.exports = NotificationService;
