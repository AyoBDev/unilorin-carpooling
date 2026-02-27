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
      subject: 'Welcome to PSRide - University of Ilorin Carpooling',
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
      subject: 'Verify Your Email - PSRide',
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
      subject: 'Reset Your Password - PSRide',
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
      message: 'Thank you for riding with PSRide! Please rate your experience.',
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
    const message = `Your PSRide verification code is: ${code}. Valid for 10 minutes. Do not share this code.`;
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

    const message = `PSRide Booking: Your code is ${booking.verificationCode}. Show this to driver ${booking.driver.firstName}. Ride: ${booking.rideDate} ${booking.rideTime}. Pay ₦${booking.totalAmount} cash.`;
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
      const subscriptions = await this.userRepository.getPushSubscriptions(userId);

      if (subscriptions.length === 0) {
        logger.debug('No push subscriptions for user', { userId });
        return { success: false, reason: 'no_subscriptions' };
      }

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this._sendPushViaProvider(sub, notification)),
      );

      // Remove expired/invalid subscriptions (410 Gone from push service)
      const expired = results
        .map((r, i) => ({ result: r, sub: subscriptions[i] }))
        .filter(({ result }) => result.status === 'rejected' && result.reason?.statusCode === 410);

      await Promise.allSettled(
        expired.map(({ sub }) => this.userRepository.removePushSubscription(userId, sub.endpoint)),
      );

      const successCount = results.filter((r) => r.status === 'fulfilled').length;

      logger.info('Push notification sent', {
        action: NOTIFICATION_EVENTS.PUSH_SENT,
        userId,
        successCount,
        total: subscriptions.length,
      });

      return { success: successCount > 0, sent: successCount, total: subscriptions.length };
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
   * Register a Web Push subscription for a user (PWA)
   * @param {string} userId - User ID
   * @param {Object} subscription - PushSubscription object from browser
   * @param {string} subscription.endpoint - Push endpoint URL
   * @param {Object} subscription.keys - { p256dh, auth }
   * @returns {Promise<Object>} Registration result
   */
  async registerPushSubscription(userId, subscription) {
    logger.info('Registering push subscription', {
      action: 'PUSH_SUBSCRIPTION_REGISTERED',
      userId,
    });

    await this.userRepository.addPushSubscription(userId, subscription);
    return { success: true };
  }

  /**
   * Remove a Web Push subscription
   * @param {string} userId - User ID
   * @param {string} endpoint - Subscription endpoint URL
   * @returns {Promise<Object>} Removal result
   */
  async removePushSubscription(userId, endpoint) {
    logger.info('Removing push subscription', {
      action: 'PUSH_SUBSCRIPTION_REMOVED',
      userId,
    });

    await this.userRepository.removePushSubscription(userId, endpoint);
    return { success: true };
  }

  /**
   * Get the VAPID public key for the frontend to use when subscribing
   * @returns {string} VAPID public key
   */
  getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
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
   * Send email via AWS SES
   * Requires env vars: SES_FROM_EMAIL, AWS_REGION
   * @private
   */
  async _sendEmailViaProvider(emailData) {
    const fromEmail = process.env.SES_FROM_EMAIL;

    if (!fromEmail) {
      logger.warn('SES_FROM_EMAIL not set — skipping real email send', {
        template: emailData.template,
        to: emailData.to,
      });
      return { messageId: `skipped_${randomUUID()}` };
    }

    const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
    const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });

    const html = this._buildEmailHtml(emailData.template, emailData.data);
    const text = this._buildEmailText(emailData.template, emailData.data);

    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [emailData.to] },
      Message: {
        Subject: { Data: emailData.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
          Text: { Data: text, Charset: 'UTF-8' },
        },
      },
    });

    const result = await ses.send(command);
    return { messageId: result.MessageId };
  }

  /**
   * Send SMS via AWS SNS
   * @private
   */
  async _sendSMSViaProvider(phone, message) {
    const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    const sns = new SNSClient({ region: process.env.AWS_REGION || 'eu-west-1' });

    const command = new PublishCommand({
      PhoneNumber: phone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'PSRide',
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    });

    const result = await sns.send(command);
    return { messageId: result.MessageId };
  }

  /**
   * Build styled HTML email body for a given template
   * @private
   */
  _buildEmailHtml(template, data) {
    // ── Shared design tokens ──────────────────────────────
    const GREEN = '#1a7f37';
    const LIGHT_GREEN = '#e6f4ea';
    const RED = '#d93025';
    const LIGHT_RED = '#fce8e6';
    const GREY_BG = '#f6f6f6';
    const TEXT = '#1f1f1f';
    const MUTED = '#666666';

    // ── Base layout wrapper ───────────────────────────────
    const base = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PSRide</title>
</head>
<body style="margin:0;padding:0;background:${GREY_BG};font-family:Arial,Helvetica,sans-serif;color:${TEXT};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${GREY_BG};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${GREEN};padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:1px;">PSRide</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">University of Ilorin Carpooling</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${GREY_BG};padding:20px 40px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;font-size:12px;color:${MUTED};">
              University of Ilorin Carpooling Platform &nbsp;|&nbsp; Ilorin, Kwara State
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:${MUTED};">
              This email was sent to you because you have an account on PSRide.<br>
              If you did not request this, please ignore it.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ── Reusable components ───────────────────────────────
    const button = (label, url, color = GREEN) =>
      `<table cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td style="background:${color};border-radius:6px;">
            <a href="${url}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${label}</a>
          </td>
        </tr>
      </table>`;

    const infoRow = (label, value) =>
      `<tr>
        <td style="padding:8px 0;font-size:14px;color:${MUTED};width:160px;">${label}</td>
        <td style="padding:8px 0;font-size:14px;font-weight:600;color:${TEXT};">${value}</td>
      </tr>`;

    const infoBox = (rows) =>
      `<table width="100%" cellpadding="0" cellspacing="0" style="background:${GREY_BG};border-radius:6px;padding:16px 20px;margin:20px 0;">
        ${rows}
      </table>`;

    const alertBox = (content, color = LIGHT_GREEN, border = GREEN) =>
      `<div style="background:${color};border-left:4px solid ${border};border-radius:4px;padding:16px 20px;margin:20px 0;font-size:14px;">
        ${content}
      </div>`;

    const greeting = (firstName) =>
      `<p style="font-size:17px;font-weight:600;margin:0 0 12px;">Hi ${firstName},</p>`;

    // ── Templates ─────────────────────────────────────────

    if (template === EMAIL_TEMPLATES.WELCOME) {
      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 16px;line-height:1.6;">
          Welcome to <strong>PSRide</strong> — the official carpooling platform for University of Ilorin!
          You've joined as a <strong>${data.role}</strong>.
        </p>
        <p style="font-size:15px;margin:0 0 8px;">Please verify your email address to activate your account:</p>
        ${button('Verify My Email', data.verificationUrl)}
        ${alertBox(`<strong>Link expires in 24 hours.</strong> If it expires, you can request a new one from the app.`)}
        <p style="font-size:13px;color:${MUTED};margin:24px 0 0;">
          Once verified, you can book rides or (if you have a vehicle) apply to become a driver.
        </p>
      `);
    }

    if (template === EMAIL_TEMPLATES.EMAIL_VERIFICATION) {
      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 16px;line-height:1.6;">
          We received a request to verify your email address. Click the button below to confirm it's you:
        </p>
        ${button('Verify Email Address', data.verificationUrl)}
        ${alertBox(`<strong>This link expires in ${data.expiresIn || '24 hours'}.</strong>`)}
        <p style="font-size:13px;color:${MUTED};margin:24px 0 0;">
          If you didn't request this, you can safely ignore this email.
        </p>
      `);
    }

    if (template === EMAIL_TEMPLATES.PASSWORD_RESET) {
      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 16px;line-height:1.6;">
          We received a request to reset your PSRide password. Click the button below to choose a new one:
        </p>
        ${button('Reset My Password', data.resetUrl, '#c0392b')}
        ${alertBox(
          `<strong>This link expires in ${data.expiresIn || '1 hour'}.</strong> If you didn't request a reset, your account is safe — just ignore this email.`,
          LIGHT_RED,
          RED,
        )}
      `);
    }

    if (template === EMAIL_TEMPLATES.BOOKING_CONFIRMATION) {
      const paymentList = (data.paymentInstructions || [])
        .map((item) => `<li style="margin:6px 0;font-size:14px;">${item}</li>`)
        .join('');

      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 20px;line-height:1.6;">
          Your ride booking is <strong style="color:${GREEN};">confirmed!</strong> Here are your trip details:
        </p>
        ${infoBox(`
          ${infoRow('Reference', data.bookingReference)}
          ${infoRow('Date', data.rideDate)}
          ${infoRow('Time', data.rideTime)}
          ${infoRow('Pickup', data.pickupLocation)}
          ${infoRow('Destination', data.destination)}
          ${infoRow('Seats', data.seats)}
          ${infoRow('Driver', data.driverName)}
          ${infoRow('Vehicle', data.vehicleInfo)}
          ${infoRow('Total Fare', `₦${data.totalAmount}`)}
        `)}
        ${alertBox(`
          <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Your Verification Code</p>
          <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:6px;color:${GREEN};">${data.verificationCode}</p>
          <p style="margin:8px 0 0;font-size:13px;">Show this code to your driver when boarding.</p>
        `)}
        <p style="font-size:15px;font-weight:600;margin:20px 0 10px;">Cash Payment Instructions</p>
        <ul style="margin:0;padding-left:20px;">${paymentList}</ul>
      `);
    }

    if (template === EMAIL_TEMPLATES.BOOKING_CANCELLED) {
      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 20px;line-height:1.6;">
          We're sorry — a booking has been <strong style="color:${RED};">cancelled</strong>.
        </p>
        ${infoBox(`
          ${infoRow('Reference', data.bookingReference)}
          ${infoRow('Date', data.rideDate)}
          ${infoRow('Time', data.rideTime)}
          ${infoRow('Cancelled by', data.cancelledBy)}
          ${infoRow('Reason', data.reason)}
        `)}
        <p style="font-size:14px;color:${MUTED};margin:20px 0 0;">
          You can search for another available ride on the PSRide app.
        </p>
      `);
    }

    if (template === EMAIL_TEMPLATES.RIDE_REMINDER) {
      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 20px;line-height:1.6;">
          Your ride is <strong>coming up in 1 hour!</strong> Here's what you need to know:
        </p>
        ${infoBox(`
          ${infoRow('Departure', data.rideTime)}
          ${infoRow('Pickup Point', data.pickupLocation)}
          ${infoRow('Driver', data.driverName)}
          ${infoRow('Driver Phone', data.driverPhone)}
          ${infoRow('Vehicle', `${data.vehicleInfo} — ${data.plateNumber || 'TBA'}`)}
        `)}
        ${alertBox(`
          <p style="margin:0 0 8px;font-weight:700;">Verification Code</p>
          <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:5px;color:${GREEN};">${data.verificationCode}</p>
          <p style="margin:8px 0 0;font-size:13px;">${data.paymentReminder}</p>
        `)}
      `);
    }

    if (template === EMAIL_TEMPLATES.RIDE_COMPLETED) {
      return base(`
        ${greeting(data.firstName)}
        <p style="font-size:15px;margin:0 0 20px;line-height:1.6;">
          Your trip is complete! Thank you for riding with PSRide.
        </p>
        ${infoBox(`
          ${infoRow('Date', data.rideDate)}
          ${infoRow('Destination', data.destination)}
          ${infoRow('Driver', data.driverName)}
          ${infoRow('Amount Paid', `₦${data.amountPaid}`)}
        `)}
        <p style="font-size:15px;margin:20px 0 8px;">How was your experience? Rate your driver:</p>
        ${button('Rate Your Driver ⭐', data.ratingUrl)}
      `);
    }

    if (template === EMAIL_TEMPLATES.DRIVER_APPROVED) {
      return base(`
        ${greeting(data.firstName)}
        ${alertBox(
          `<strong style="font-size:16px;">Congratulations! Your driver account is now active.</strong>`,
          LIGHT_GREEN,
          GREEN,
        )}
        <p style="font-size:15px;margin:16px 0;line-height:1.6;">
          You've been verified as a PSRide driver. You can now create ride offers and start earning.
        </p>
        <p style="font-size:14px;margin:0 0 8px;color:${MUTED};">What's next:</p>
        <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:2;">
          <li>Set your available routes and seats</li>
          <li>Schedule regular rides from home to campus</li>
          <li>Passengers will book and pay you in cash</li>
        </ul>
        ${button('Create Your First Ride', data.createRideUrl)}
      `);
    }

    if (template === EMAIL_TEMPLATES.DOCUMENT_REJECTED) {
      return base(`
        ${greeting(data.firstName)}
        ${alertBox(
          `<strong>Your document submission was not accepted.</strong>`,
          LIGHT_RED,
          RED,
        )}
        ${infoBox(`
          ${infoRow('Document', data.documentType)}
          ${infoRow('Reason', data.reason)}
        `)}
        <p style="font-size:15px;margin:20px 0 8px;">Please upload a new document to continue your driver verification:</p>
        ${button('Upload New Document', data.uploadUrl)}
      `);
    }

    if (template === EMAIL_TEMPLATES.SOS_ALERT) {
      const rideInfo = data.rideInfo
        ? `${infoRow('Driver', data.rideInfo.driverName)}
           ${infoRow('Driver Phone', data.rideInfo.driverPhone)}
           ${infoRow('Vehicle', `${data.rideInfo.vehicleInfo} (${data.rideInfo.plateNumber || 'N/A'})`)}` : '';

      return base(`
        ${alertBox(
          `<strong style="font-size:16px;color:${RED};">🚨 EMERGENCY SOS ALERT</strong>`,
          LIGHT_RED,
          RED,
        )}
        <p style="font-size:15px;margin:0 0 16px;">Hi <strong>${data.contactName}</strong>,</p>
        <p style="font-size:15px;margin:0 0 20px;line-height:1.6;">
          <strong>${data.userName}</strong> has triggered an SOS emergency alert on the PSRide app.
          Please contact them immediately.
        </p>
        ${infoBox(`
          ${infoRow('Name', data.userName)}
          ${infoRow('Phone', data.userPhone)}
          ${infoRow('Time', data.timestamp)}
          ${infoRow('Location', data.location)}
          ${rideInfo}
        `)}
        ${button('View on Map', data.locationUrl, RED)}
        <p style="font-size:13px;color:${MUTED};margin:20px 0 0;">
          If you cannot reach them, please contact emergency services (112) immediately.
        </p>
      `);
    }

    // Generic fallback for template: null (admin sendNotification)
    return base(`
      <p style="font-size:15px;line-height:1.6;">${data.message || ''}</p>
    `);
  }

  /**
   * Build plain-text fallback for email
   * @private
   */
  _buildEmailText(template, data) {
    if (template === EMAIL_TEMPLATES.WELCOME || template === EMAIL_TEMPLATES.EMAIL_VERIFICATION) {
      return `Hi ${data.firstName},\n\nVerify your email: ${data.verificationUrl}\n\nThis link expires in ${data.expiresIn || '24 hours'}.\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.PASSWORD_RESET) {
      return `Hi ${data.firstName},\n\nReset your password: ${data.resetUrl}\n\nExpires in ${data.expiresIn || '1 hour'}.\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.BOOKING_CONFIRMATION) {
      return `Hi ${data.firstName},\n\nBooking confirmed!\nRef: ${data.bookingReference}\nDate: ${data.rideDate} at ${data.rideTime}\nPickup: ${data.pickupLocation}\nDestination: ${data.destination}\nDriver: ${data.driverName}\nFare: ₦${data.totalAmount}\nVerification Code: ${data.verificationCode}\n\nPay cash to driver on boarding.\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.BOOKING_CANCELLED) {
      return `Hi ${data.firstName},\n\nYour booking (${data.bookingReference}) for ${data.rideDate} at ${data.rideTime} has been cancelled by ${data.cancelledBy}.\nReason: ${data.reason}\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.RIDE_REMINDER) {
      return `Hi ${data.firstName},\n\nYour ride is in 1 hour!\nTime: ${data.rideTime}\nPickup: ${data.pickupLocation}\nDriver: ${data.driverName} (${data.driverPhone})\nCode: ${data.verificationCode}\n${data.paymentReminder}\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.RIDE_COMPLETED) {
      return `Hi ${data.firstName},\n\nYour trip to ${data.destination} is complete. You paid ₦${data.amountPaid}.\nRate your driver: ${data.ratingUrl}\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.DRIVER_APPROVED) {
      return `Hi ${data.firstName},\n\nCongratulations! You are now a verified PSRide driver.\nCreate your first ride: ${data.createRideUrl}\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.DOCUMENT_REJECTED) {
      return `Hi ${data.firstName},\n\nYour ${data.documentType} was rejected.\nReason: ${data.reason}\nUpload a new document: ${data.uploadUrl}\n\n— PSRide`;
    }
    if (template === EMAIL_TEMPLATES.SOS_ALERT) {
      return `EMERGENCY: ${data.userName} triggered an SOS alert.\nPhone: ${data.userPhone}\nLocation: ${data.locationUrl}\nTime: ${data.timestamp}\n\nContact emergency services (112) if unreachable.`;
    }
    return data.message || '';
  }

  /**
   * Send Web Push notification via web-push (VAPID)
   * Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_MAILTO
   * @private
   */
  async _sendPushViaProvider(subscription, notification) {
    const webpush = require('web-push');

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const mailto = process.env.VAPID_MAILTO || 'mailto:admin@psride.ng';

    if (!publicKey || !privateKey) {
      logger.warn('VAPID keys not set — skipping push send');
      return { messageId: `skipped_${randomUUID()}` };
    }

    webpush.setVapidDetails(mailto, publicKey, privateKey);

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: notification.data || {},
    });

    await webpush.sendNotification(subscription, payload);
    return { messageId: `webpush_${randomUUID()}` };
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
