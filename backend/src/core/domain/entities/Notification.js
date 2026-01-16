/**
 * Notification Entity - Represents notifications in the system
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate, generateToken } = require('./utils/entityHelpers');

class Notification {
  constructor({
    notificationId,
    recipientId, // User ID of the recipient
    recipientType = 'user', // 'user' | 'driver' | 'admin'

    // Notification Type & Category
    type, // 'booking_confirmation' | 'ride_reminder' | 'payment_success' | etc.
    category = 'general', // 'booking' | 'ride' | 'payment' | 'safety' | 'system' | 'marketing'
    priority = 'normal', // 'low' | 'normal' | 'high' | 'urgent'

    // Content
    title,
    message,
    shortMessage = null, // For SMS or push notifications
    data = {}, // Additional data payload
    actionUrl = null, // Deep link or URL for action
    actionText = null, // Text for action button
    imageUrl = null, // Notification image
    iconType = null, // Icon to display

    // Delivery Channels
    channels = ['in-app'], // ['in-app', 'email', 'sms', 'push']
    _deliveryStatus = {}, // Status per channel

    // Timing
    scheduledFor = null, // For scheduled notifications
    expiresAt = null, // When notification becomes irrelevant

    // User Interaction
    isRead = false,
    readAt = null,
    isClicked = false,
    clickedAt = null,
    isDismissed = false,
    dismissedAt = null,
    actionTaken = null,
    actionTakenAt = null,

    // Delivery Tracking
    sentAt = null,
    deliveredAt = null,
    failedAt = null,
    failureReason = null,
    retryCount = 0,
    maxRetries = 3,

    // Email Specific
    emailSubject = null,
    emailTemplate = null,
    emailFrom = 'noreply@unilorin-carpool.ng',
    emailReplyTo = null,
    emailBounced = false,
    emailOpened = false,
    emailOpenedAt = null,

    // SMS Specific
    smsProvider = 'default', // Provider used for SMS
    smsMessageId = null,
    smsSentAt = null,
    smsDeliveredAt = null,
    smsStatus = null,
    _smsSegments = 1, // Number of SMS segments

    // Push Notification Specific
    pushProvider = 'fcm', // 'fcm' | 'apns'
    pushToken = null,
    pushMessageId = null,
    pushSentAt = null,
    pushDeliveredAt = null,
    pushStatus = null,

    // Context Information
    relatedEntityType = null, // 'booking' | 'ride' | 'payment' | etc.
    relatedEntityId = null,
    contextData = {}, // Additional context

    // Localization
    language = 'en', // Language code
    timezone = 'Africa/Lagos',
    localizedContent = {}, // Translations

    // Preferences
    respectQuietHours = true,
    quietHoursStart = '22:00',
    quietHoursEnd = '07:00',

    // Grouping
    groupId = null, // For grouped notifications
    groupKey = null,
    groupSummary = false,
    batchId = null, // For batch sending

    // Templates
    templateId = null,
    templateVersion = null,
    templateVariables = {},

    // Compliance
    hasOptedIn = true,
    consentType = null, // 'marketing' | 'transactional' | 'system'
    unsubscribeToken = null,

    // Analytics
    source = 'system', // What triggered the notification
    campaign = null, // Marketing campaign ID
    impressions = 0,
    interactions = 0,
    conversionTracked = false,

    // Status
    status = 'pending', // 'pending' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'expired'
    isActive = true,

    // Metadata
    tags = [],
    metadata = {},

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    processedAt = null,
    lastRetryAt = null,
  }) {
    this.notificationId = notificationId;
    this.recipientId = recipientId;
    this.recipientType = recipientType;

    // Type & Category
    this.type = type;
    this.category = category;
    this.priority = priority;

    // Content
    this.title = title;
    this.message = message;
    this.shortMessage = shortMessage || this.truncateMessage(message, 160);
    this.data = data;
    this.actionUrl = actionUrl;
    this.actionText = actionText;
    this.imageUrl = imageUrl;
    this.iconType = iconType || this.getDefaultIcon();

    // Delivery Channels
    this.channels = channels;
    this.deliveryStatus = this.initializeDeliveryStatus(channels);

    // Timing
    this.scheduledFor = parseDate(scheduledFor);
    if (expiresAt) {
      this.expiresAt = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    } else {
      this.expiresAt = this.calculateExpiry();
    }

    // User Interaction
    this.isRead = isRead;
    this.readAt = parseDate(readAt);
    this.isClicked = isClicked;
    this.clickedAt = parseDate(clickedAt);
    this.isDismissed = isDismissed;
    this.dismissedAt = parseDate(dismissedAt);
    this.actionTaken = actionTaken;
    this.actionTakenAt = parseDate(actionTakenAt);

    // Delivery Tracking
    this.sentAt = parseDate(sentAt);
    this.deliveredAt = parseDate(deliveredAt);
    this.failedAt = parseDate(failedAt);
    this.failureReason = failureReason;
    this.retryCount = retryCount;
    this.maxRetries = maxRetries;

    // Email Specific
    this.emailSubject = emailSubject || title;
    this.emailTemplate = emailTemplate || this.getDefaultEmailTemplate();
    this.emailFrom = emailFrom;
    this.emailReplyTo = emailReplyTo;
    this.emailBounced = emailBounced;
    this.emailOpened = emailOpened;
    this.emailOpenedAt = parseDate(emailOpenedAt);

    // SMS Specific
    this.smsProvider = smsProvider;
    this.smsMessageId = smsMessageId;
    this.smsSentAt = parseDate(smsSentAt);
    this.smsDeliveredAt = parseDate(smsDeliveredAt);
    this.smsStatus = smsStatus;
    this.smsSegments = this.calculateSmsSegments(this.shortMessage);

    // Push Notification Specific
    this.pushProvider = pushProvider;
    this.pushToken = pushToken;
    this.pushMessageId = pushMessageId;
    this.pushSentAt = parseDate(pushSentAt);
    this.pushDeliveredAt = parseDate(pushDeliveredAt);
    this.pushStatus = pushStatus;

    // Context
    this.relatedEntityType = relatedEntityType;
    this.relatedEntityId = relatedEntityId;
    this.contextData = contextData;

    // Localization
    this.language = language;
    this.timezone = timezone;
    this.localizedContent = localizedContent;

    // Preferences
    this.respectQuietHours = respectQuietHours;
    this.quietHoursStart = quietHoursStart;
    this.quietHoursEnd = quietHoursEnd;

    // Grouping
    this.groupId = groupId;
    this.groupKey = groupKey;
    this.groupSummary = groupSummary;
    this.batchId = batchId;

    // Templates
    this.templateId = templateId;
    this.templateVersion = templateVersion;
    this.templateVariables = templateVariables;

    // Compliance
    this.hasOptedIn = hasOptedIn;
    this.consentType = consentType || this.determineConsentType();
    this.unsubscribeToken = unsubscribeToken || this.generateUnsubscribeToken();

    // Analytics
    this.source = source;
    this.campaign = campaign;
    this.impressions = impressions;
    this.interactions = interactions;
    this.conversionTracked = conversionTracked;

    // Status
    this.status = status;
    this.isActive = isActive;

    // Metadata
    this.tags = tags;
    this.metadata = metadata;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.processedAt = parseDate(processedAt);
    this.lastRetryAt = parseDate(lastRetryAt);

    // Validate on creation
    this.validate();
  }

  // Getters
  get isPending() {
    return this.status === 'pending';
  }

  get isScheduled() {
    return this.status === 'scheduled';
  }

  get isSent() {
    return this.status === 'sent';
  }

  get isDelivered() {
    return this.status === 'delivered';
  }

  get isFailed() {
    return this.status === 'failed';
  }

  get isExpired() {
    return this.status === 'expired' || (this.expiresAt && new Date() > this.expiresAt);
  }

  get canBeRetried() {
    return this.isFailed && this.retryCount < this.maxRetries && !this.isExpired;
  }

  get isUrgent() {
    return this.priority === 'urgent';
  }

  get isTransactional() {
    return this.consentType === 'transactional';
  }

  get isMarketing() {
    return this.consentType === 'marketing';
  }

  get requiresImmediateDelivery() {
    return this.isUrgent || ['safety', 'payment'].includes(this.category);
  }

  get shouldRespectQuietHours() {
    return this.respectQuietHours && !this.requiresImmediateDelivery;
  }

  get isInQuietHours() {
    if (!this.shouldRespectQuietHours) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (this.quietHoursStart <= this.quietHoursEnd) {
      return currentTime >= this.quietHoursStart && currentTime <= this.quietHoursEnd;
    }
    // Quiet hours span midnight
    return currentTime >= this.quietHoursStart || currentTime <= this.quietHoursEnd;
  }

  get deliveryRate() {
    const totalChannels = this.channels.length;
    const deliveredChannels = Object.values(this.deliveryStatus).filter(
      (status) => status.status === 'delivered',
    ).length;

    return totalChannels > 0 ? deliveredChannels / totalChannels : 0;
  }

  get engagementRate() {
    return this.impressions > 0 ? this.interactions / this.impressions : 0;
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.notificationId) errors.push('Notification ID is required');
    if (!this.recipientId) errors.push('Recipient ID is required');

    // Type validation
    if (!this.type) errors.push('Notification type is required');

    const validTypes = [
      'booking_confirmation',
      'booking_cancellation',
      'booking_reminder',
      'ride_created',
      'ride_cancelled',
      'ride_started',
      'ride_completed',
      'payment_success',
      'payment_failed',
      'refund_processed',
      'driver_arrived',
      'passenger_no_show',
      'rating_received',
      'verification_required',
      'documents_expiring',
      'account_suspended',
      'emergency_alert',
      'system_maintenance',
      'promotional_offer',
    ];

    if (!validTypes.includes(this.type)) {
      errors.push('Invalid notification type');
    }

    // Category validation
    const validCategories = [
      'booking',
      'ride',
      'payment',
      'safety',
      'system',
      'marketing',
      'general',
    ];
    if (!validCategories.includes(this.category)) {
      errors.push('Invalid notification category');
    }

    // Priority validation
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (!validPriorities.includes(this.priority)) {
      errors.push('Invalid priority level');
    }

    // Content validation
    if (!this.title || this.title.length < 3) {
      errors.push('Title must be at least 3 characters');
    }
    if (this.title && this.title.length > 100) {
      errors.push('Title cannot exceed 100 characters');
    }

    if (!this.message || this.message.length < 10) {
      errors.push('Message must be at least 10 characters');
    }
    if (this.message && this.message.length > 1000) {
      errors.push('Message cannot exceed 1000 characters');
    }

    // Channel validation
    const validChannels = ['in-app', 'email', 'sms', 'push'];
    const invalidChannel = this.channels.find((channel) => !validChannels.includes(channel));
    if (invalidChannel) {
      errors.push(`Invalid channel: ${invalidChannel}`);
    }

    // Status validation
    const validStatuses = ['pending', 'scheduled', 'sent', 'delivered', 'failed', 'expired'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid notification status');
    }

    // Scheduled notification validation
    if (this.scheduledFor && this.scheduledFor < new Date()) {
      errors.push('Scheduled time cannot be in the past');
    }

    if (errors.length > 0) {
      throw new Error(`Notification validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  // Content Management
  truncateMessage(message, maxLength = 160) {
    if (!message || message.length <= maxLength) {
      return message;
    }

    return `${message.substring(0, maxLength - 3)}...`;
  }

  getDefaultIcon() {
    const iconMap = {
      booking: 'calendar',
      ride: 'car',
      payment: 'credit-card',
      safety: 'shield',
      system: 'settings',
      marketing: 'tag',
      general: 'bell',
    };

    return iconMap[this.category] || 'bell';
  }

  getDefaultEmailTemplate() {
    const templateMap = {
      bookingConfirmation: 'booking-confirmed',
      paymentSuccess: 'payment-received',
      rideReminder: 'ride-reminder',
      verificationRequired: 'verify-account',
    };

    return templateMap[this.type] || 'default';
  }

  determineConsentType() {
    if (['marketing', 'promotional_offer'].includes(this.type)) {
      return 'marketing';
    }

    if (['system', 'safety'].includes(this.category)) {
      return 'system';
    }

    return 'transactional';
  }

  generateUnsubscribeToken() {
    return generateToken('unsub', this.notificationId);
  }

  calculateExpiry() {
    // Different expiry times based on type
    const expiryHours = {
      urgent: 1,
      high: 24,
      normal: 72,
      low: 168, // 1 week
    };

    const hours = expiryHours[this.priority] || 72;
    const expiryDate = new Date(this.createdAt);
    expiryDate.setHours(expiryDate.getHours() + hours);

    return expiryDate;
  }

  calculateSmsSegments(message) {
    if (!message) return 0;

    // Standard SMS is 160 chars, but with unicode it's 70
    // eslint-disable-next-line no-control-regex
    const hasUnicode = /[^\u0000-\u007F]/.test(message);
    const singleSegmentLength = hasUnicode ? 70 : 160;
    const multiSegmentLength = hasUnicode ? 67 : 153; // Account for concatenation headers

    if (message.length <= singleSegmentLength) {
      return 1;
    }

    return Math.ceil(message.length / multiSegmentLength);
  }

  initializeDeliveryStatus(channels) {
    const status = {};

    channels.forEach((channel) => {
      status[channel] = {
        status: 'pending',
        attempts: 0,
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        failureReason: null,
      };
    });

    return status;
  }

  // Delivery Management
  markAsSent(channel = null) {
    if (channel) {
      if (!this.deliveryStatus[channel]) {
        throw new Error(`Channel ${channel} not configured for this notification`);
      }

      this.deliveryStatus[channel].status = 'sent';
      this.deliveryStatus[channel].sentAt = new Date();
      this.deliveryStatus[channel].attempts += 1;
    } else {
      this.status = 'sent';
      this.sentAt = new Date();

      // Mark all channels as sent
      Object.keys(this.deliveryStatus).forEach((ch) => {
        this.deliveryStatus[ch].status = 'sent';
        this.deliveryStatus[ch].sentAt = new Date();
      });
    }

    this.processedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  markAsDelivered(channel = null) {
    if (channel) {
      if (!this.deliveryStatus[channel]) {
        throw new Error(`Channel ${channel} not configured for this notification`);
      }

      this.deliveryStatus[channel].status = 'delivered';
      this.deliveryStatus[channel].deliveredAt = new Date();
    } else {
      this.status = 'delivered';
      this.deliveredAt = new Date();

      // Mark all channels as delivered
      Object.keys(this.deliveryStatus).forEach((ch) => {
        this.deliveryStatus[ch].status = 'delivered';
        this.deliveryStatus[ch].deliveredAt = new Date();
      });
    }

    this.updatedAt = new Date();

    return true;
  }

  markAsFailed(reason, channel = null) {
    if (channel) {
      if (!this.deliveryStatus[channel]) {
        throw new Error(`Channel ${channel} not configured for this notification`);
      }

      this.deliveryStatus[channel].status = 'failed';
      this.deliveryStatus[channel].failedAt = new Date();
      this.deliveryStatus[channel].failureReason = reason;
    } else {
      this.status = 'failed';
      this.failedAt = new Date();
      this.failureReason = reason;

      // Mark all channels as failed
      Object.keys(this.deliveryStatus).forEach((ch) => {
        this.deliveryStatus[ch].status = 'failed';
        this.deliveryStatus[ch].failedAt = new Date();
        this.deliveryStatus[ch].failureReason = reason;
      });
    }

    this.updatedAt = new Date();

    return true;
  }

  retry() {
    if (!this.canBeRetried) {
      throw new Error('Notification cannot be retried');
    }

    this.status = 'pending';
    this.retryCount += 1;
    this.lastRetryAt = new Date();
    this.failureReason = null;
    this.failedAt = null;

    // Reset delivery status for failed channels
    Object.keys(this.deliveryStatus).forEach((channel) => {
      if (this.deliveryStatus[channel].status === 'failed') {
        this.deliveryStatus[channel].status = 'pending';
        this.deliveryStatus[channel].attempts += 1;
      }
    });

    this.updatedAt = new Date();

    return {
      retryCount: this.retryCount,
      remainingRetries: this.maxRetries - this.retryCount,
    };
  }

  // User Interaction
  markAsRead() {
    if (this.isRead) {
      return false;
    }

    this.isRead = true;
    this.readAt = new Date();
    this.impressions += 1;
    this.updatedAt = new Date();

    return true;
  }

  markAsClicked() {
    if (this.isClicked) {
      return false;
    }

    // Auto-mark as read if clicking
    if (!this.isRead) {
      this.markAsRead();
    }

    this.isClicked = true;
    this.clickedAt = new Date();
    this.interactions += 1;
    this.updatedAt = new Date();

    return true;
  }

  dismiss() {
    if (this.isDismissed) {
      return false;
    }

    this.isDismissed = true;
    this.dismissedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  recordAction(action) {
    this.actionTaken = action;
    this.actionTakenAt = new Date();
    this.interactions += 1;
    this.conversionTracked = true;
    this.updatedAt = new Date();

    return true;
  }

  // Email Tracking
  trackEmailOpen() {
    if (this.emailOpened) {
      return false;
    }

    this.emailOpened = true;
    this.emailOpenedAt = new Date();
    this.impressions += 1;
    this.updatedAt = new Date();

    return true;
  }

  trackEmailBounce(bounceType = 'hard') {
    this.emailBounced = true;
    this.emailBounceType = bounceType;
    this.emailBouncedAt = new Date();
    this.markAsFailed(`Email bounced: ${bounceType}`, 'email');

    return true;
  }

  // SMS Tracking
  updateSmsStatus(status, messageId = null) {
    const validStatuses = ['queued', 'sent', 'delivered', 'failed', 'undelivered'];

    if (!validStatuses.includes(status)) {
      throw new Error('Invalid SMS status');
    }

    this.smsStatus = status;
    if (messageId) {
      this.smsMessageId = messageId;
    }

    switch (status) {
      case 'sent':
        this.smsSentAt = new Date();
        this.markAsSent('sms');
        break;
      case 'delivered':
        this.smsDeliveredAt = new Date();
        this.markAsDelivered('sms');
        break;
      case 'failed':
      case 'undelivered':
        this.markAsFailed(`SMS ${status}`, 'sms');
        break;
      default:
        throw new Error('None');
    }

    this.updatedAt = new Date();

    return true;
  }

  // Push Notification Tracking
  updatePushStatus(status, messageId = null) {
    const validStatuses = ['sent', 'delivered', 'failed', 'expired'];

    if (!validStatuses.includes(status)) {
      throw new Error('Invalid push notification status');
    }

    this.pushStatus = status;
    if (messageId) {
      this.pushMessageId = messageId;
    }

    switch (status) {
      case 'sent':
        this.pushSentAt = new Date();
        this.markAsSent('push');
        break;
      case 'delivered':
        this.pushDeliveredAt = new Date();
        this.markAsDelivered('push');
        break;
      case 'failed':
      case 'expired':
        this.markAsFailed(`Push notification ${status}`, 'push');
        break;
      default:
        throw new Error('None');
    }

    this.updatedAt = new Date();

    return true;
  }

  // Scheduling
  schedule(scheduledTime) {
    if (this.status !== 'pending') {
      throw new Error('Only pending notifications can be scheduled');
    }

    const scheduleDate = scheduledTime instanceof Date ? scheduledTime : new Date(scheduledTime);

    if (scheduleDate <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    this.scheduledFor = scheduleDate;
    this.status = 'scheduled';
    this.updatedAt = new Date();

    return this.scheduledFor;
  }

  cancelSchedule() {
    if (this.status !== 'scheduled') {
      throw new Error('Only scheduled notifications can be cancelled');
    }

    this.status = 'pending';
    this.scheduledFor = null;
    this.updatedAt = new Date();

    return true;
  }

  // Expiry Management
  checkExpiry() {
    if (this.isExpired && this.status === 'pending') {
      this.status = 'expired';
      this.updatedAt = new Date();
      return true;
    }

    return false;
  }

  extendExpiry(hours) {
    if (this.isExpired) {
      throw new Error('Cannot extend expired notification');
    }

    const newExpiry = new Date(this.expiresAt);
    newExpiry.setHours(newExpiry.getHours() + hours);

    this.expiresAt = newExpiry;
    this.updatedAt = new Date();

    return this.expiresAt;
  }

  // Localization
  localize(language) {
    if (this.localizedContent[language]) {
      return {
        title: this.localizedContent[language].title || this.title,
        message: this.localizedContent[language].message || this.message,
        actionText: this.localizedContent[language].actionText || this.actionText,
      };
    }

    return {
      title: this.title,
      message: this.message,
      actionText: this.actionText,
    };
  }

  addTranslation(language, content) {
    this.localizedContent[language] = content;
    this.updatedAt = new Date();

    return this.localizedContent;
  }

  // Template Processing
  processTemplate(variables = {}) {
    const allVariables = {
      ...this.templateVariables,
      ...variables,
    };

    let processedTitle = this.title;
    let processedMessage = this.message;

    // Replace variables in format {{variable}}
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedTitle = processedTitle.replace(regex, value);
      processedMessage = processedMessage.replace(regex, value);
    });

    return {
      title: processedTitle,
      message: processedMessage,
    };
  }

  // Analytics
  trackImpression() {
    this.impressions += 1;
    this.updatedAt = new Date();

    return this.impressions;
  }

  trackInteraction(interactionType = 'click') {
    this.interactions += 1;
    this.lastInteractionType = interactionType;
    this.lastInteractionAt = new Date();
    this.updatedAt = new Date();

    return this.interactions;
  }

  // Helper Methods
  getSummary() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      channels: this.channels,
      deliveryRate: this.deliveryRate,
      isRead: this.isRead,
      isClicked: this.isClicked,
      sentAt: this.sentAt,
      deliveredAt: this.deliveredAt,
    };
  }

  getDeliveryReport() {
    const report = {
      overallStatus: this.status,
      channels: {},
    };

    this.channels.forEach((channel) => {
      report.channels[channel] = {
        ...this.deliveryStatus[channel],
        success: this.deliveryStatus[channel].status === 'delivered',
      };
    });

    return report;
  }

  // Serialization
  toJSON() {
    return {
      notificationId: this.notificationId,
      recipientId: this.recipientId,

      // Type & Content
      type: this.type,
      category: this.category,
      priority: this.priority,
      title: this.title,
      message: this.message,
      shortMessage: this.shortMessage,
      actionUrl: this.actionUrl,
      actionText: this.actionText,
      iconType: this.iconType,

      // Delivery
      channels: this.channels,
      deliveryStatus: this.deliveryStatus,
      deliveryRate: this.deliveryRate,

      // Status
      status: this.status,
      isActive: this.isActive,
      isPending: this.isPending,
      isSent: this.isSent,
      isDelivered: this.isDelivered,
      isFailed: this.isFailed,
      isExpired: this.isExpired,
      canBeRetried: this.canBeRetried,

      // User Interaction
      isRead: this.isRead,
      readAt: this.readAt ? this.readAt.toISOString() : null,
      isClicked: this.isClicked,
      clickedAt: this.clickedAt ? this.clickedAt.toISOString() : null,
      isDismissed: this.isDismissed,
      actionTaken: this.actionTaken,

      // Analytics
      impressions: this.impressions,
      interactions: this.interactions,
      engagementRate: this.engagementRate,

      // Context
      relatedEntityType: this.relatedEntityType,
      relatedEntityId: this.relatedEntityId,

      // Timing
      scheduledFor: this.scheduledFor ? this.scheduledFor.toISOString() : null,
      expiresAt: this.expiresAt ? this.expiresAt.toISOString() : null,

      // Metadata
      tags: this.tags,

      // Summary
      summary: this.getSummary(),
      deliveryReport: this.getDeliveryReport(),

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      sentAt: this.sentAt ? this.sentAt.toISOString() : null,
      deliveredAt: this.deliveredAt ? this.deliveredAt.toISOString() : null,
      failedAt: this.failedAt ? this.failedAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Notification({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      sentAt: data.sentAt ? new Date(data.sentAt) : null,
      deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
      failedAt: data.failedAt ? new Date(data.failedAt) : null,
      readAt: data.readAt ? new Date(data.readAt) : null,
      clickedAt: data.clickedAt ? new Date(data.clickedAt) : null,
      dismissedAt: data.dismissedAt ? new Date(data.dismissedAt) : null,
      actionTakenAt: data.actionTakenAt ? new Date(data.actionTakenAt) : null,
      processedAt: data.processedAt ? new Date(data.processedAt) : null,
      lastRetryAt: data.lastRetryAt ? new Date(data.lastRetryAt) : null,
      emailOpenedAt: data.emailOpenedAt ? new Date(data.emailOpenedAt) : null,
      smsSentAt: data.smsSentAt ? new Date(data.smsSentAt) : null,
      smsDeliveredAt: data.smsDeliveredAt ? new Date(data.smsDeliveredAt) : null,
      pushSentAt: data.pushSentAt ? new Date(data.pushSentAt) : null,
      pushDeliveredAt: data.pushDeliveredAt ? new Date(data.pushDeliveredAt) : null,
    });
  }
}

module.exports = Notification;
