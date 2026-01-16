/**
 * Booking Entity - With Offline Payment Support
 * Path: src/core/domain/entities/Booking.js
 *
 * Phase 1: Offline payment (cash to driver)
 * Phase 2: Online payment integration
 */

const { nanoid } = require('nanoid');
const dayjs = require('dayjs');

/**
 * Booking Status Enum
 */
const BookingStatus = {
  PENDING: 'pending', // Booking created, awaiting confirmation
  CONFIRMED: 'confirmed', // Driver confirmed the booking
  CANCELLED: 'cancelled', // Booking cancelled
  COMPLETED: 'completed', // Ride completed
  NO_SHOW: 'no_show', // Passenger didn't show up
  IN_PROGRESS: 'in_progress', // Ride is ongoing
};

/**
 * Payment Status Enum (for offline payments)
 */
const PaymentStatus = {
  PENDING: 'pending', // Payment not yet made
  CASH_RECEIVED: 'cash_received', // Driver confirmed cash payment
  CASH_PENDING: 'cash_pending', // Waiting for cash payment
  DISPUTED: 'disputed', // Payment dispute
  WAIVED: 'waived', // Free ride (promotional/special case)
  ONLINE_PENDING: 'online_pending', // Phase 2: Online payment initiated
  ONLINE_COMPLETED: 'online_completed', // Phase 2: Online payment successful
};

/**
 * Payment Method Enum
 */
const PaymentMethod = {
  CASH: 'cash', // Phase 1: Default
  BANK_TRANSFER: 'bank_transfer', // Phase 1: Alternative offline
  PAYSTACK: 'paystack', // Phase 2: Online payment
  WALLET: 'wallet', // Phase 2: In-app wallet
  FREE: 'free', // Special cases
};

class Booking {
  constructor(data = {}) {
    // Core identifiers
    this.id = data.id || `BOOKING#${nanoid()}`;
    this.rideId = data.rideId;
    this.passengerId = data.passengerId;
    this.driverId = data.driverId;

    // Booking details
    this.pickupPointId = data.pickupPointId;
    this.pickupLocation = data.pickupLocation; // { address, coordinates, landmark }
    this.dropoffLocation = data.dropoffLocation; // { address, coordinates, landmark }
    this.seats = data.seats || 1;

    // Status tracking
    this.status = data.status || BookingStatus.PENDING;
    this.paymentStatus = data.paymentStatus || PaymentStatus.PENDING;
    this.paymentMethod = data.paymentMethod || PaymentMethod.CASH;

    // Pricing (fixed for Phase 1)
    this.fare = data.fare || this.calculateFare(data);
    this.platformFee = data.platformFee || 0; // Phase 2
    this.totalAmount = data.totalAmount || this.fare;
    this.amountPaid = data.amountPaid || 0;
    this.currency = data.currency || 'NGN';

    // Timing
    this.scheduledPickupTime = data.scheduledPickupTime;
    this.actualPickupTime = data.actualPickupTime;
    this.estimatedArrivalTime = data.estimatedArrivalTime;
    this.actualArrivalTime = data.actualArrivalTime;

    // Verification & Tracking
    this.bookingCode = data.bookingCode || this.generateBookingCode();
    this.verificationCode = data.verificationCode || this.generateVerificationCode();
    this.qrCode = data.qrCode; // For easy verification

    // Payment tracking for offline payments
    this.paymentConfirmedBy = data.paymentConfirmedBy; // Driver ID who confirmed payment
    this.paymentConfirmedAt = data.paymentConfirmedAt;
    this.paymentNotes = data.paymentNotes; // Any payment-related notes
    this.paymentProof = data.paymentProof; // Phase 1: Photo of transfer receipt, etc.

    // Cancellation details
    this.cancelledBy = data.cancelledBy;
    this.cancelledAt = data.cancelledAt;
    this.cancellationReason = data.cancellationReason;
    this.cancellationFee = data.cancellationFee || 0;

    // Ratings (post-ride)
    this.passengerRating = data.passengerRating;
    this.driverRating = data.driverRating;
    this.ratingComments = data.ratingComments;

    // Metadata
    this.notes = data.notes;
    this.tags = data.tags || [];
    this.isRecurring = data.isRecurring || false;
    this.recurringId = data.recurringId; // Link to recurring booking series

    // Timestamps
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.completedAt = data.completedAt;
  }

  /**
   * Calculate fare based on ride details (Phase 1: Fixed pricing)
   */
  calculateFare(data) {
    // Phase 1: Fixed pricing based on route
    // // ₦200 base fare
    const perSeatFare = data.seats > 1 ? (data.seats - 1) * 50 : 0; // Extra seats

    // You can add distance-based calculation when available
    // For now, using fixed rates for common routes
    const routeFares = {
      'campus-tanke': 200,
      'campus-fate': 250,
      'campus-basin': 300,
      'campus-gaa': 300,
      default: 250,
    };

    const routeKey = data.routeKey || 'default';
    const routeFare = routeFares[routeKey] || routeFares.default;

    return routeFare + perSeatFare;
  }

  /**
   * Generate unique booking code for reference
   */
  generateBookingCode() {
    // Format: UIL-YYMMDD-XXXX (e.g., UIL-240115-A7K9)
    const date = dayjs().format('YYMMDD');
    const random = nanoid(4).toUpperCase();
    return `UIL-${date}-${random}`;
  }

  /**
   * Generate verification code for driver-passenger verification
   */
  generateVerificationCode() {
    // 4-digit code for easy verification
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Confirm booking
   */
  confirm() {
    if (this.status !== BookingStatus.PENDING) {
      throw new Error('Only pending bookings can be confirmed');
    }

    this.status = BookingStatus.CONFIRMED;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Cancel booking
   */
  cancel(cancelledBy, reason) {
    if ([BookingStatus.COMPLETED, BookingStatus.IN_PROGRESS].includes(this.status)) {
      throw new Error('Cannot cancel completed or in-progress bookings');
    }

    this.status = BookingStatus.CANCELLED;
    this.cancelledBy = cancelledBy;
    this.cancelledAt = new Date().toISOString();
    this.cancellationReason = reason;
    this.updatedAt = new Date().toISOString();

    // Calculate cancellation fee if applicable
    const hoursUntilRide = dayjs(this.scheduledPickupTime).diff(dayjs(), 'hours');
    if (hoursUntilRide < 1) {
      this.cancellationFee = this.fare * 0.5; // 50% fee for last-minute cancellation
    }

    return this;
  }

  /**
   * Start ride
   */
  startRide() {
    if (this.status !== BookingStatus.CONFIRMED) {
      throw new Error('Only confirmed bookings can be started');
    }

    this.status = BookingStatus.IN_PROGRESS;
    this.actualPickupTime = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Complete booking
   */
  complete() {
    if (this.status !== BookingStatus.IN_PROGRESS) {
      throw new Error('Only in-progress bookings can be completed');
    }

    this.status = BookingStatus.COMPLETED;
    this.completedAt = new Date().toISOString();
    this.actualArrivalTime = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Confirm cash payment received (Phase 1)
   */
  confirmCashPayment(driverId, amount, notes) {
    if (this.paymentMethod !== PaymentMethod.CASH) {
      throw new Error('This method is only for cash payments');
    }

    this.paymentStatus = PaymentStatus.CASH_RECEIVED;
    this.paymentConfirmedBy = driverId;
    this.paymentConfirmedAt = new Date().toISOString();
    this.amountPaid = amount || this.totalAmount;
    this.paymentNotes = notes;
    this.updatedAt = new Date().toISOString();

    return this;
  }

  /**
   * Mark passenger as no-show
   */
  markNoShow() {
    if (this.status !== BookingStatus.CONFIRMED) {
      throw new Error('Only confirmed bookings can be marked as no-show');
    }

    const waitTimeExpired = dayjs().isAfter(dayjs(this.scheduledPickupTime).add(15, 'minutes'));

    if (!waitTimeExpired) {
      throw new Error('Cannot mark as no-show before wait time expires');
    }

    this.status = BookingStatus.NO_SHOW;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Add passenger rating
   */
  addPassengerRating(rating, comments) {
    if (this.status !== BookingStatus.COMPLETED) {
      throw new Error('Can only rate completed bookings');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    this.passengerRating = rating;
    if (comments) {
      this.ratingComments = { ...this.ratingComments, passenger: comments };
    }
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Add driver rating
   */
  addDriverRating(rating, comments) {
    if (this.status !== BookingStatus.COMPLETED) {
      throw new Error('Can only rate completed bookings');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    this.driverRating = rating;
    if (comments) {
      this.ratingComments = { ...this.ratingComments, driver: comments };
    }
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Check if booking can be cancelled without fee
   */
  canCancelWithoutFee() {
    const hoursUntilRide = dayjs(this.scheduledPickupTime).diff(dayjs(), 'hours');
    return hoursUntilRide >= 1;
  }

  /**
   * Check if booking is editable
   */
  isEditable() {
    return this.status === BookingStatus.PENDING || this.status === BookingStatus.CONFIRMED;
  }

  /**
   * Get booking summary for notifications
   */
  getSummary() {
    return {
      bookingCode: this.bookingCode,
      status: this.status,
      fare: this.fare,
      pickupTime: this.scheduledPickupTime,
      pickupLocation: this.pickupLocation.address,
      dropoffLocation: this.dropoffLocation.address,
      verificationCode: this.verificationCode,
      paymentMethod: this.paymentMethod,
      paymentStatus: this.paymentStatus,
    };
  }

  /**
   * Validate booking data
   */
  validate() {
    const errors = [];

    if (!this.rideId) errors.push('Ride ID is required');
    if (!this.passengerId) errors.push('Passenger ID is required');
    if (!this.driverId) errors.push('Driver ID is required');
    if (!this.pickupLocation) errors.push('Pickup location is required');
    if (!this.dropoffLocation) errors.push('Dropoff location is required');
    if (this.seats < 1 || this.seats > 7) errors.push('Seats must be between 1 and 7');
    if (!this.scheduledPickupTime) errors.push('Scheduled pickup time is required');
    if (this.fare < 0) errors.push('Fare cannot be negative');

    // Check if pickup time is in the future
    if (dayjs(this.scheduledPickupTime).isBefore(dayjs())) {
      errors.push('Pickup time must be in the future');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      rideId: this.rideId,
      passengerId: this.passengerId,
      driverId: this.driverId,
      pickupLocation: this.pickupLocation,
      dropoffLocation: this.dropoffLocation,
      seats: this.seats,
      status: this.status,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      fare: this.fare,
      totalAmount: this.totalAmount,
      bookingCode: this.bookingCode,
      verificationCode: this.verificationCode,
      scheduledPickupTime: this.scheduledPickupTime,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from database record
   */
  static fromDatabase(record) {
    return new Booking(record);
  }

  /**
   * Check if payment is pending
   */
  isPaymentPending() {
    return (
      this.paymentStatus === PaymentStatus.PENDING ||
      this.paymentStatus === PaymentStatus.CASH_PENDING
    );
  }

  /**
   * Get status display text
   */
  getStatusDisplay() {
    const statusMap = {
      [BookingStatus.PENDING]: 'Awaiting Confirmation',
      [BookingStatus.CONFIRMED]: 'Confirmed',
      [BookingStatus.IN_PROGRESS]: 'Ride in Progress',
      [BookingStatus.COMPLETED]: 'Completed',
      [BookingStatus.CANCELLED]: 'Cancelled',
      [BookingStatus.NO_SHOW]: 'No Show',
    };

    return statusMap[this.status] || this.status;
  }

  /**
   * Get payment status display text
   */
  getPaymentStatusDisplay() {
    const statusMap = {
      [PaymentStatus.PENDING]: 'Payment Pending',
      [PaymentStatus.CASH_RECEIVED]: 'Cash Received',
      [PaymentStatus.CASH_PENDING]: 'Pay Driver in Cash',
      [PaymentStatus.DISPUTED]: 'Payment Disputed',
      [PaymentStatus.WAIVED]: 'Free Ride',
    };

    return statusMap[this.paymentStatus] || this.paymentStatus;
  }
}

// Export the class and enums
module.exports = {
  Booking,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
};
