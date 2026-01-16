/**
 * Booking Entity - Represents a passenger's booking for a ride
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate } = require('./utils/entityHelpers');

class Booking {
  constructor({
    bookingId,
    rideId,
    passengerId, // User ID of the passenger
    driverId,

    // Booking Details
    numberOfSeats = 1,
    pickupPoint, // { id, name, coordinates, estimatedTime }
    dropoffPoint = null, // Optional specific dropoff if different from ride endpoint

    // Pricing
    pricePerSeat,
    totalPrice,
    currency = 'NGN',
    paymentMethod = 'cash', // 'cash' | 'transfer' | 'wallet'
    paymentStatus = 'pending', // 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

    // Status
    status = 'pending', // 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show'
    confirmationCode = null,
    cancellationReason = null,
    cancelledBy = null, // 'passenger' | 'driver' | 'system'

    // Passenger Information (cached from user)
    passengerName,
    passengerPhone,
    passengerType, // 'student' | 'staff'
    passengerRating = 0,

    // Driver Information (cached from driver)
    driverName,
    driverPhone,
    vehicleInfo = {}, // { make, model, color, plateNumber }

    // Ride Information (cached from ride)
    departureDate,
    departureTime,
    startLocation,
    endLocation,
    estimatedDistance,
    estimatedDuration,

    // Tracking
    passengerCheckedIn = false,
    checkedInAt = null,
    passengerPickedUp = false,
    pickedUpAt = null,
    passengerDroppedOff = false,
    droppedOffAt = null,

    // Communication
    messageThreadId = null,
    lastMessageAt = null,
    unreadMessages = 0,

    // Ratings
    driverRating = null,
    vehicleRating = null,
    experienceRating = null,
    ratingComments = null,
    ratedAt = null,

    // Notifications
    reminderSent = false,
    reminderSentAt = null,
    arrivalNotificationSent = false,

    // Emergency
    emergencyContactNotified = false,
    emergencyTriggeredAt = null,

    // Compliance
    termsAccepted = false,
    termsAcceptedAt = null,
    insuranceAcknowledged = false,

    // Metadata
    bookingSource = 'app', // 'app' | 'web' | 'admin'
    deviceInfo = null,
    ipAddress = null,
    notes = null,

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    confirmedAt = null,
    cancelledAt = null,
    completedAt = null,
    expiresAt = null, // For pending bookings
  }) {
    this.bookingId = bookingId;
    this.rideId = rideId;
    this.passengerId = passengerId;
    this.driverId = driverId;

    // Booking Details
    this.numberOfSeats = numberOfSeats;
    this.pickupPoint = pickupPoint;
    this.dropoffPoint = dropoffPoint;

    // Pricing
    this.pricePerSeat = pricePerSeat;
    this.totalPrice = totalPrice || pricePerSeat * numberOfSeats;
    this.currency = currency;
    this.paymentMethod = paymentMethod;
    this.paymentStatus = paymentStatus;

    // Status
    this.status = status;
    this.confirmationCode = confirmationCode || this.generateConfirmationCode();
    this.cancellationReason = cancellationReason;
    this.cancelledBy = cancelledBy;

    // Passenger Information
    this.passengerName = passengerName;
    this.passengerPhone = passengerPhone;
    this.passengerType = passengerType;
    this.passengerRating = passengerRating;

    // Driver Information
    this.driverName = driverName;
    this.driverPhone = driverPhone;
    this.vehicleInfo = vehicleInfo;

    // Ride Information
    this.departureDate = departureDate instanceof Date ? departureDate : new Date(departureDate);
    this.departureTime = departureTime;
    this.startLocation = startLocation;
    this.endLocation = endLocation;
    this.estimatedDistance = estimatedDistance;
    this.estimatedDuration = estimatedDuration;

    // Tracking
    this.passengerCheckedIn = passengerCheckedIn;
    this.checkedInAt = parseDate(checkedInAt);
    this.passengerPickedUp = passengerPickedUp;
    this.pickedUpAt = parseDate(pickedUpAt);
    this.passengerDroppedOff = passengerDroppedOff;
    this.droppedOffAt = parseDate(droppedOffAt);

    // Communication
    this.messageThreadId = messageThreadId;
    this.lastMessageAt = parseDate(lastMessageAt);
    this.unreadMessages = unreadMessages;

    // Ratings
    this.driverRating = driverRating;
    this.vehicleRating = vehicleRating;
    this.experienceRating = experienceRating;
    this.ratingComments = ratingComments;
    this.ratedAt = parseDate(ratedAt);

    // Notifications
    this.reminderSent = reminderSent;
    this.reminderSentAt = parseDate(reminderSentAt);
    this.arrivalNotificationSent = arrivalNotificationSent;

    // Emergency
    this.emergencyContactNotified = emergencyContactNotified;
    this.emergencyTriggeredAt = parseDate(emergencyTriggeredAt);

    // Compliance
    this.termsAccepted = termsAccepted;
    this.termsAcceptedAt = parseDate(termsAcceptedAt);
    this.insuranceAcknowledged = insuranceAcknowledged;

    // Metadata
    this.bookingSource = bookingSource;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
    this.notes = notes;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.confirmedAt = parseDate(confirmedAt);
    this.cancelledAt = parseDate(cancelledAt);
    this.completedAt = parseDate(completedAt);
    this.expiresAt = expiresAt ? parseDate(expiresAt) : this.calculateExpiryTime();

    // Validate on creation
    this.validate();
  }

  // Getters
  get isPending() {
    return this.status === 'pending';
  }

  get isConfirmed() {
    return this.status === 'confirmed';
  }

  get isCancelled() {
    return this.status === 'cancelled';
  }

  get isCompleted() {
    return this.status === 'completed';
  }

  get isNoShow() {
    return this.status === 'no-show';
  }

  get isActive() {
    return ['pending', 'confirmed'].includes(this.status);
  }

  get isPaid() {
    return this.paymentStatus === 'completed';
  }

  get isExpired() {
    return this.expiresAt && new Date() > this.expiresAt;
  }

  get canBeCancelled() {
    if (!this.isActive) return false;

    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const oneHourBeforeDeparture = new Date(departureDateTime.getTime() - 60 * 60 * 1000);

    return now < oneHourBeforeDeparture;
  }

  get requiresPayment() {
    return this.paymentStatus === 'pending' && this.paymentMethod !== 'cash';
  }

  get canBeRated() {
    return this.isCompleted && !this.driverRating;
  }

  get timeUntilDeparture() {
    const now = new Date();
    const departure = this.getDepartureDateTime();
    const diff = departure - now;

    if (diff < 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, milliseconds: diff };
  }

  get tripProgress() {
    if (!this.passengerCheckedIn) return 'not-started';
    if (this.passengerCheckedIn && !this.passengerPickedUp) return 'checked-in';
    if (this.passengerPickedUp && !this.passengerDroppedOff) return 'in-transit';
    if (this.passengerDroppedOff) return 'completed';
    return 'unknown';
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.bookingId) errors.push('Booking ID is required');
    if (!this.rideId) errors.push('Ride ID is required');
    if (!this.passengerId) errors.push('Passenger ID is required');
    if (!this.driverId) errors.push('Driver ID is required');

    // Seats validation
    if (this.numberOfSeats < 1 || this.numberOfSeats > 7) {
      errors.push('Number of seats must be between 1 and 7');
    }

    // Pickup point validation
    if (!this.pickupPoint || !this.pickupPoint.coordinates) {
      errors.push('Valid pickup point with coordinates is required');
    }

    // Pricing validation
    if (this.pricePerSeat < 0) {
      errors.push('Price per seat cannot be negative');
    }
    if (this.totalPrice < 0) {
      errors.push('Total price cannot be negative');
    }

    // Payment method validation
    const validPaymentMethods = ['cash', 'transfer', 'wallet'];
    if (!validPaymentMethods.includes(this.paymentMethod)) {
      errors.push('Invalid payment method');
    }

    // Payment status validation
    const validPaymentStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(this.paymentStatus)) {
      errors.push('Invalid payment status');
    }

    // Status validation
    const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid booking status');
    }

    // Passenger information validation
    if (!this.passengerName) errors.push('Passenger name is required');
    if (!this.passengerPhone) errors.push('Passenger phone is required');
    if (!['student', 'staff'].includes(this.passengerType)) {
      errors.push('Invalid passenger type');
    }

    // Schedule validation
    if (!this.departureDate) errors.push('Departure date is required');
    if (!this.departureTime) errors.push('Departure time is required');

    // Location validation
    if (!this.startLocation || !this.startLocation.coordinates) {
      errors.push('Valid start location is required');
    }
    if (!this.endLocation || !this.endLocation.coordinates) {
      errors.push('Valid end location is required');
    }

    // Terms acceptance
    if (this.status === 'confirmed' && !this.termsAccepted) {
      errors.push('Terms must be accepted before confirmation');
    }

    if (errors.length > 0) {
      throw new Error(`Booking validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  generateConfirmationCode() {
    // Generate a 6-character alphanumeric code
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    for (let i = 0; i < 6; i += 1) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
  }

  getDepartureDateTime() {
    const [hours, minutes] = this.departureTime.split(':').map(Number);
    const dateTime = new Date(this.departureDate);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }

  calculateExpiryTime() {
    // Pending bookings expire after 10 minutes if not confirmed
    if (this.status === 'pending') {
      const expiryTime = new Date(this.createdAt);
      expiryTime.setMinutes(expiryTime.getMinutes() + 10);
      return expiryTime;
    }
    return null;
  }

  // Status Management
  confirm() {
    if (this.status !== 'pending') {
      throw new Error('Only pending bookings can be confirmed');
    }

    if (this.isExpired) {
      throw new Error('Booking has expired');
    }

    if (!this.termsAccepted) {
      throw new Error('Terms must be accepted before confirmation');
    }

    if (this.requiresPayment && !this.isPaid) {
      throw new Error('Payment must be completed before confirmation');
    }

    this.status = 'confirmed';
    this.confirmedAt = new Date();
    this.expiresAt = null; // Remove expiry for confirmed bookings
    this.updatedAt = new Date();

    return true;
  }

  cancel(reason, cancelledBy) {
    if (!this.canBeCancelled) {
      throw new Error('Booking cannot be cancelled at this time');
    }

    if (!reason) {
      throw new Error('Cancellation reason is required');
    }

    const validCancelledBy = ['passenger', 'driver', 'system'];
    if (!validCancelledBy.includes(cancelledBy)) {
      throw new Error('Invalid cancellation source');
    }

    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.cancelledBy = cancelledBy;
    this.cancelledAt = new Date();
    this.updatedAt = new Date();

    // Initiate refund if payment was made
    if (this.isPaid) {
      this.paymentStatus = 'refunded';
    }

    return true;
  }

  markAsNoShow() {
    if (this.status !== 'confirmed') {
      throw new Error('Only confirmed bookings can be marked as no-show');
    }

    const departureDateTime = this.getDepartureDateTime();
    const fifteenMinutesAfterDeparture = new Date(departureDateTime.getTime() + 15 * 60 * 1000);

    if (new Date() < fifteenMinutesAfterDeparture) {
      throw new Error('Cannot mark as no-show before 15 minutes after departure');
    }

    this.status = 'no-show';
    this.updatedAt = new Date();

    return true;
  }

  complete() {
    if (this.status !== 'confirmed') {
      throw new Error('Only confirmed bookings can be completed');
    }

    if (!this.passengerDroppedOff) {
      throw new Error('Passenger must be dropped off before completing booking');
    }

    this.status = 'completed';
    this.completedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  // Terms Management
  acceptTerms() {
    if (this.termsAccepted) {
      throw new Error('Terms already accepted');
    }

    this.termsAccepted = true;
    this.termsAcceptedAt = new Date();
    this.insuranceAcknowledged = true;
    this.updatedAt = new Date();

    return true;
  }

  // Payment Management
  updatePaymentStatus(status, paymentDetails = {}) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];

    if (!validStatuses.includes(status)) {
      throw new Error('Invalid payment status');
    }

    this.paymentStatus = status;
    this.paymentDetails = {
      ...this.paymentDetails,
      ...paymentDetails,
      updatedAt: new Date(),
    };

    this.updatedAt = new Date();

    // Auto-confirm booking if payment is completed
    if (status === 'completed' && this.isPending && this.termsAccepted) {
      this.confirm();
    }

    return this.paymentStatus;
  }

  // Tracking Management
  checkIn() {
    if (!this.isConfirmed) {
      throw new Error('Only confirmed bookings can be checked in');
    }

    if (this.passengerCheckedIn) {
      throw new Error('Passenger already checked in');
    }

    // Check if within 30 minutes of departure
    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const thirtyMinutesBeforeDeparture = new Date(departureDateTime.getTime() - 30 * 60 * 1000);

    if (now < thirtyMinutesBeforeDeparture) {
      throw new Error('Check-in is only available 30 minutes before departure');
    }

    this.passengerCheckedIn = true;
    this.checkedInAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  recordPickup() {
    if (!this.passengerCheckedIn) {
      throw new Error('Passenger must check in before pickup');
    }

    if (this.passengerPickedUp) {
      throw new Error('Passenger already picked up');
    }

    this.passengerPickedUp = true;
    this.pickedUpAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  recordDropoff() {
    if (!this.passengerPickedUp) {
      throw new Error('Passenger must be picked up before dropoff');
    }

    if (this.passengerDroppedOff) {
      throw new Error('Passenger already dropped off');
    }

    this.passengerDroppedOff = true;
    this.droppedOffAt = new Date();
    this.updatedAt = new Date();

    // Auto-complete booking
    this.complete();

    return true;
  }

  // Rating Management
  rateExperience(driverRating, vehicleRating, experienceRating, comments = null) {
    if (!this.canBeRated) {
      throw new Error('Cannot rate this booking');
    }

    // Validate ratings
    const ratings = { driverRating, vehicleRating, experienceRating };

    Object.entries(ratings).forEach(([key, value]) => {
      if (value < 1 || value > 5) {
        throw new Error(`${key} must be between 1 and 5`);
      }
    });

    this.driverRating = driverRating;
    this.vehicleRating = vehicleRating;
    this.experienceRating = experienceRating;
    this.ratingComments = comments;
    this.ratedAt = new Date();
    this.updatedAt = new Date();

    return {
      driverRating: this.driverRating,
      vehicleRating: this.vehicleRating,
      experienceRating: this.experienceRating,
      averageRating: (driverRating + vehicleRating + experienceRating) / 3,
    };
  }

  // Communication Management
  updateMessageThread(threadId) {
    this.messageThreadId = threadId;
    this.lastMessageAt = new Date();
    this.unreadMessages += 1;
    this.updatedAt = new Date();

    return this.messageThreadId;
  }

  markMessagesAsRead() {
    this.unreadMessages = 0;
    this.updatedAt = new Date();

    return true;
  }

  // Notification Management
  sendReminder() {
    if (this.reminderSent) {
      throw new Error('Reminder already sent');
    }

    if (!this.isActive) {
      throw new Error('Cannot send reminder for inactive booking');
    }

    // Check if within 2 hours of departure
    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const twoHoursBeforeDeparture = new Date(departureDateTime.getTime() - 2 * 60 * 60 * 1000);

    if (now < twoHoursBeforeDeparture) {
      throw new Error('Too early to send reminder');
    }

    this.reminderSent = true;
    this.reminderSentAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  sendArrivalNotification() {
    if (this.arrivalNotificationSent) {
      throw new Error('Arrival notification already sent');
    }

    if (!this.isConfirmed) {
      throw new Error('Cannot send arrival notification for unconfirmed booking');
    }

    this.arrivalNotificationSent = true;
    this.updatedAt = new Date();

    return true;
  }

  // Emergency Management
  triggerEmergency(reason) {
    if (!this.isActive) {
      throw new Error('Emergency can only be triggered for active bookings');
    }

    this.emergencyContactNotified = true;
    this.emergencyTriggeredAt = new Date();
    this.emergencyReason = reason;
    this.updatedAt = new Date();

    return {
      triggered: true,
      timestamp: this.emergencyTriggeredAt,
      reason: this.emergencyReason,
    };
  }

  // Helper Methods
  getEstimatedPickupTime() {
    if (!this.pickupPoint || !this.pickupPoint.estimatedTime) {
      return this.departureTime;
    }

    return this.pickupPoint.estimatedTime;
  }

  getEstimatedDropoffTime() {
    if (this.dropoffPoint && this.dropoffPoint.estimatedTime) {
      return this.dropoffPoint.estimatedTime;
    }

    // Calculate based on departure time and duration
    const departureDateTime = this.getDepartureDateTime();
    const dropoffDateTime = new Date(
      departureDateTime.getTime() + this.estimatedDuration * 60 * 1000,
    );

    return `${dropoffDateTime.getHours().toString().padStart(2, '0')}:${dropoffDateTime.getMinutes().toString().padStart(2, '0')}`;
  }

  calculateRefundAmount() {
    if (!this.isPaid) return 0;

    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const hoursUntilDeparture = (departureDateTime - now) / (1000 * 60 * 60);

    // Refund policy
    if (hoursUntilDeparture > 24) {
      return this.totalPrice; // 100% refund
    }
    if (hoursUntilDeparture > 6) {
      return this.totalPrice * 0.75; // 75% refund
    }
    if (hoursUntilDeparture > 1) {
      return this.totalPrice * 0.5; // 50% refund
    }
    return 0; // No refund within 1 hour
  }

  // Serialization
  toJSON() {
    return {
      bookingId: this.bookingId,
      rideId: this.rideId,
      passengerId: this.passengerId,
      driverId: this.driverId,

      // Booking Details
      numberOfSeats: this.numberOfSeats,
      pickupPoint: this.pickupPoint,
      dropoffPoint: this.dropoffPoint,
      confirmationCode: this.confirmationCode,

      // Pricing
      pricePerSeat: this.pricePerSeat,
      totalPrice: this.totalPrice,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      paymentStatus: this.paymentStatus,

      // Status
      status: this.status,
      isPending: this.isPending,
      isConfirmed: this.isConfirmed,
      isCancelled: this.isCancelled,
      isCompleted: this.isCompleted,
      isActive: this.isActive,
      isPaid: this.isPaid,
      isExpired: this.isExpired,
      canBeCancelled: this.canBeCancelled,
      cancellationReason: this.cancellationReason,
      cancelledBy: this.cancelledBy,

      // Passenger Information
      passengerName: this.passengerName,
      passengerPhone: this.passengerPhone,
      passengerType: this.passengerType,
      passengerRating: this.passengerRating,

      // Driver & Vehicle Information
      driverName: this.driverName,
      driverPhone: this.driverPhone,
      vehicleInfo: this.vehicleInfo,

      // Schedule & Route
      departureDate: this.departureDate.toISOString(),
      departureTime: this.departureTime,
      departureDateTime: this.getDepartureDateTime().toISOString(),
      estimatedPickupTime: this.getEstimatedPickupTime(),
      estimatedDropoffTime: this.getEstimatedDropoffTime(),
      startLocation: this.startLocation,
      endLocation: this.endLocation,
      estimatedDistance: this.estimatedDistance,
      estimatedDuration: this.estimatedDuration,
      timeUntilDeparture: this.timeUntilDeparture,

      // Tracking
      tripProgress: this.tripProgress,
      passengerCheckedIn: this.passengerCheckedIn,
      checkedInAt: this.checkedInAt ? this.checkedInAt.toISOString() : null,
      passengerPickedUp: this.passengerPickedUp,
      pickedUpAt: this.pickedUpAt ? this.pickedUpAt.toISOString() : null,
      passengerDroppedOff: this.passengerDroppedOff,
      droppedOffAt: this.droppedOffAt ? this.droppedOffAt.toISOString() : null,

      // Communication
      messageThreadId: this.messageThreadId,
      unreadMessages: this.unreadMessages,
      lastMessageAt: this.lastMessageAt ? this.lastMessageAt.toISOString() : null,

      // Ratings
      canBeRated: this.canBeRated,
      driverRating: this.driverRating,
      vehicleRating: this.vehicleRating,
      experienceRating: this.experienceRating,
      ratingComments: this.ratingComments,
      ratedAt: this.ratedAt ? this.ratedAt.toISOString() : null,

      // Notifications
      reminderSent: this.reminderSent,
      reminderSentAt: this.reminderSentAt ? this.reminderSentAt.toISOString() : null,
      arrivalNotificationSent: this.arrivalNotificationSent,

      // Compliance
      termsAccepted: this.termsAccepted,
      insuranceAcknowledged: this.insuranceAcknowledged,

      // Metadata
      bookingSource: this.bookingSource,
      notes: this.notes,

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      confirmedAt: this.confirmedAt ? this.confirmedAt.toISOString() : null,
      cancelledAt: this.cancelledAt ? this.cancelledAt.toISOString() : null,
      completedAt: this.completedAt ? this.completedAt.toISOString() : null,
      expiresAt: this.expiresAt ? this.expiresAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Booking({
      ...data,
      departureDate: new Date(data.departureDate),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      confirmedAt: data.confirmedAt ? new Date(data.confirmedAt) : null,
      cancelledAt: data.cancelledAt ? new Date(data.cancelledAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      checkedInAt: data.checkedInAt ? new Date(data.checkedInAt) : null,
      pickedUpAt: data.pickedUpAt ? new Date(data.pickedUpAt) : null,
      droppedOffAt: data.droppedOffAt ? new Date(data.droppedOffAt) : null,
      lastMessageAt: data.lastMessageAt ? new Date(data.lastMessageAt) : null,
      ratedAt: data.ratedAt ? new Date(data.ratedAt) : null,
      reminderSentAt: data.reminderSentAt ? new Date(data.reminderSentAt) : null,
      emergencyTriggeredAt: data.emergencyTriggeredAt ? new Date(data.emergencyTriggeredAt) : null,
      termsAcceptedAt: data.termsAcceptedAt ? new Date(data.termsAcceptedAt) : null,
    });
  }
}

module.exports = Booking;
