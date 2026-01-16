/**
 * Ride Entity - Represents a carpooling ride offer
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate } = require('./utils/entityHelpers');

class Ride {
  constructor({
    rideId,
    driverId,
    vehicleId,

    // Route Information
    startLocation, // { address, coordinates: { lat, lng }, name }
    endLocation, // { address, coordinates: { lat, lng }, name }
    pickupPoints = [], // Array of pickup points along the route
    estimatedDistance = 0, // in kilometers
    estimatedDuration = 0, // in minutes
    routePolyline = null, // Encoded polyline for map display

    // Schedule
    departureDate,
    departureTime, // HH:MM format
    estimatedArrivalTime = null,
    flexibleTime = false, // If true, time can be adjusted ±30 mins

    // Capacity
    totalSeats,
    availableSeats,
    bookedSeats = 0,

    // Pricing
    pricePerSeat = 300, // Default price in Naira
    totalPrice = null, // Total potential earnings
    currency = 'NGN',
    paymentMethods = ['cash', 'transfer'],

    // Preferences
    maxWaitTime = 5, // minutes at each stop
    allowedLuggage = 'small', // 'none' | 'small' | 'medium' | 'large'
    smokingAllowed = false,
    petsAllowed = false,
    musicAllowed = true,
    airConditioned = false,

    // Passenger Preferences
    genderPreference = 'any', // 'any' | 'male' | 'female'
    minPassengerRating = 3.0,
    studentOnly = false,
    staffOnly = false,

    // Recurring
    isRecurring = false,
    recurringDays = [], // ['monday', 'tuesday', ...]
    recurringEndDate = null,
    parentRideId = null, // For recurring ride instances

    // Status
    status = 'active', // 'draft' | 'active' | 'full' | 'in-progress' | 'completed' | 'cancelled'
    cancellationReason = null,

    // Statistics
    viewCount = 0,
    bookingCount = 0,
    completedBookings = 0,
    cancelledBookings = 0,

    // Tracking
    currentLocation = null, // Real-time location during ride
    hasStarted = false,
    startedAt = null,
    completedAt = null,

    // Ratings
    averageRating = 0,
    totalRatings = 0,

    // Metadata
    notes = null, // Additional notes from driver
    tags = [], // ['daily-commute', 'one-time', 'flexible']

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    publishedAt = null,
    lastBookingAt = null,
  }) {
    this.rideId = rideId;
    this.driverId = driverId;
    this.vehicleId = vehicleId;

    // Route
    this.startLocation = startLocation;
    this.endLocation = endLocation;
    this.pickupPoints = pickupPoints;
    this.estimatedDistance = estimatedDistance;
    this.estimatedDuration = estimatedDuration;
    this.routePolyline = routePolyline;

    // Schedule
    this.departureDate = departureDate instanceof Date ? departureDate : new Date(departureDate);
    this.departureTime = departureTime;
    this.estimatedArrivalTime = estimatedArrivalTime || this.calculateArrivalTime();
    this.flexibleTime = flexibleTime;

    // Capacity
    this.totalSeats = totalSeats;
    this.availableSeats = availableSeats;
    this.bookedSeats = bookedSeats;

    // Pricing
    this.pricePerSeat = pricePerSeat;
    this.totalPrice = totalPrice || pricePerSeat * totalSeats;
    this.currency = currency;
    this.paymentMethods = paymentMethods;

    // Preferences
    this.maxWaitTime = maxWaitTime;
    this.allowedLuggage = allowedLuggage;
    this.smokingAllowed = smokingAllowed;
    this.petsAllowed = petsAllowed;
    this.musicAllowed = musicAllowed;
    this.airConditioned = airConditioned;

    // Passenger Preferences
    this.genderPreference = genderPreference;
    this.minPassengerRating = minPassengerRating;
    this.studentOnly = studentOnly;
    this.staffOnly = staffOnly;

    // Recurring
    this.isRecurring = isRecurring;
    this.recurringDays = recurringDays;
    this.recurringEndDate = parseDate(recurringEndDate);
    this.parentRideId = parentRideId;

    // Status
    this.status = status;
    this.cancellationReason = cancellationReason;

    // Statistics
    this.viewCount = viewCount;
    this.bookingCount = bookingCount;
    this.completedBookings = completedBookings;
    this.cancelledBookings = cancelledBookings;

    // Tracking
    this.currentLocation = currentLocation;
    this.hasStarted = hasStarted;
    this.startedAt = parseDate(startedAt);
    this.completedAt = parseDate(completedAt);

    // Ratings
    this.averageRating = averageRating;
    this.totalRatings = totalRatings;

    // Metadata
    this.notes = notes;
    this.tags = tags;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.publishedAt = parseDate(publishedAt);
    this.lastBookingAt = parseDate(lastBookingAt);

    // Validate on creation
    this.validate();
  }

  // Getters
  get isActive() {
    return this.status === 'active';
  }

  get isFull() {
    return this.availableSeats === 0 || this.status === 'full';
  }

  get isBookable() {
    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    return (
      this.isActive && !this.isFull && departureDateTime > thirtyMinutesFromNow && !this.hasStarted
    );
  }

  get occupancyRate() {
    return this.totalSeats > 0 ? Math.round((this.bookedSeats / this.totalSeats) * 100) : 0;
  }

  get completionRate() {
    const totalAttempted = this.completedBookings + this.cancelledBookings;
    return totalAttempted > 0 ? Math.round((this.completedBookings / totalAttempted) * 100) : 0;
  }

  get departureDateTime() {
    return this.getDepartureDateTime();
  }

  get isPastDeparture() {
    return this.getDepartureDateTime() < new Date();
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

  // Validation
  validate() {
    const errors = [];

    if (!this.rideId) errors.push('Ride ID is required');
    if (!this.driverId) errors.push('Driver ID is required');
    if (!this.vehicleId) errors.push('Vehicle ID is required');

    // Route validation
    if (!this.startLocation || !this.startLocation.coordinates) {
      errors.push('Valid start location with coordinates is required');
    }
    if (!this.endLocation || !this.endLocation.coordinates) {
      errors.push('Valid end location with coordinates is required');
    }

    // Validate University of Ilorin as either start or end
    if (!this.isUniversityRoute()) {
      errors.push('Route must include University of Ilorin as start or end point');
    }

    // Schedule validation
    if (!this.departureDate) errors.push('Departure date is required');
    if (!this.departureTime || !this.isValidTime(this.departureTime)) {
      errors.push('Valid departure time is required (HH:MM format)');
    }

    // Check if departure is at least 30 minutes in future (for new rides)
    if (this.status === 'draft' || this.status === 'active') {
      const departureDateTime = this.getDepartureDateTime();
      const thirtyMinutesFromNow = new Date(new Date().getTime() + 30 * 60 * 1000);

      if (departureDateTime < thirtyMinutesFromNow) {
        errors.push('Departure must be at least 30 minutes in the future');
      }
    }

    // Capacity validation
    if (!this.totalSeats || this.totalSeats < 1 || this.totalSeats > 7) {
      errors.push('Total seats must be between 1 and 7');
    }
    if (this.availableSeats < 0 || this.availableSeats > this.totalSeats) {
      errors.push('Invalid available seats count');
    }
    if (this.bookedSeats < 0 || this.bookedSeats > this.totalSeats) {
      errors.push('Invalid booked seats count');
    }

    // Pricing validation
    if (this.pricePerSeat < 200 || this.pricePerSeat > 500) {
      errors.push('Price per seat must be between ₦200 and ₦500');
    }

    // Preferences validation
    if (this.maxWaitTime < 1 || this.maxWaitTime > 30) {
      errors.push('Wait time must be between 1 and 30 minutes');
    }
    if (!['none', 'small', 'medium', 'large'].includes(this.allowedLuggage)) {
      errors.push('Invalid luggage size');
    }
    if (!['any', 'male', 'female'].includes(this.genderPreference)) {
      errors.push('Invalid gender preference');
    }
    if (this.minPassengerRating < 1 || this.minPassengerRating > 5) {
      errors.push('Minimum passenger rating must be between 1 and 5');
    }

    // Recurring validation
    if (this.isRecurring) {
      if (!this.recurringDays || this.recurringDays.length === 0) {
        errors.push('Recurring days are required for recurring rides');
      }
      if (!this.recurringEndDate) {
        errors.push('End date is required for recurring rides');
      }
      if (this.recurringEndDate && this.recurringEndDate < this.departureDate) {
        errors.push('Recurring end date must be after departure date');
      }
    }

    // Status validation
    const validStatuses = ['draft', 'active', 'full', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid ride status');
    }

    if (errors.length > 0) {
      throw new Error(`Ride validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  isValidTime(time) {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  isUniversityRoute() {
    // Check if University of Ilorin is either start or end point
    const unilorinCoordinates = { lat: 4.6696, lng: 8.4789 };
    const tolerance = 0.01; // About 1km tolerance

    const isStartUnilorin =
      Math.abs(this.startLocation.coordinates.lat - unilorinCoordinates.lat) < tolerance &&
      Math.abs(this.startLocation.coordinates.lng - unilorinCoordinates.lng) < tolerance;

    const isEndUnilorin =
      Math.abs(this.endLocation.coordinates.lat - unilorinCoordinates.lat) < tolerance &&
      Math.abs(this.endLocation.coordinates.lng - unilorinCoordinates.lng) < tolerance;

    return isStartUnilorin || isEndUnilorin;
  }

  getDepartureDateTime() {
    const [hours, minutes] = this.departureTime.split(':').map(Number);
    const dateTime = new Date(this.departureDate);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }

  calculateArrivalTime() {
    if (!this.estimatedDuration) return null;

    const departureDateTime = this.getDepartureDateTime();
    const arrivalDateTime = new Date(
      departureDateTime.getTime() + this.estimatedDuration * 60 * 1000,
    );

    return `${arrivalDateTime.getHours().toString().padStart(2, '0')}:${arrivalDateTime.getMinutes().toString().padStart(2, '0')}`;
  }

  // Pickup Points Management
  addPickupPoint(pickupPoint) {
    if (!pickupPoint.name || !pickupPoint.coordinates) {
      throw new Error('Pickup point must have name and coordinates');
    }

    if (this.pickupPoints.length >= 5) {
      throw new Error('Maximum 5 pickup points allowed');
    }

    // Validate coordinates
    if (!pickupPoint.coordinates.lat || !pickupPoint.coordinates.lng) {
      throw new Error('Invalid pickup point coordinates');
    }

    // Add estimated time if not provided
    if (!pickupPoint.estimatedTime) {
      const index = this.pickupPoints.length;
      const timePerStop = Math.floor(this.estimatedDuration / (this.pickupPoints.length + 2));
      const departureDateTime = this.getDepartureDateTime();
      const pickupDateTime = new Date(
        departureDateTime.getTime() + (index + 1) * timePerStop * 60 * 1000,
      );

      pickupPoint.estimatedTime = `${pickupDateTime.getHours().toString().padStart(2, '0')}:${pickupDateTime.getMinutes().toString().padStart(2, '0')}`;
    }

    this.pickupPoints.push({
      ...pickupPoint,
      id: `PP${Date.now()}`,
      order: this.pickupPoints.length,
      waitTime: this.maxWaitTime,
    });

    this.updatedAt = new Date();
    return this.pickupPoints;
  }

  removePickupPoint(index) {
    if (index < 0 || index >= this.pickupPoints.length) {
      throw new Error('Invalid pickup point index');
    }

    this.pickupPoints.splice(index, 1);

    // Reorder remaining points
    this.pickupPoints.forEach((point, i) => {
      point.order = i;
    });

    this.updatedAt = new Date();
    return this.pickupPoints;
  }

  reorderPickupPoints(newOrder) {
    if (newOrder.length !== this.pickupPoints.length) {
      throw new Error('Invalid pickup points order');
    }

    const reordered = newOrder.map((index) => this.pickupPoints[index]);
    this.pickupPoints = reordered;

    // Update order property
    this.pickupPoints.forEach((point, i) => {
      point.order = i;
    });

    this.updatedAt = new Date();
    return this.pickupPoints;
  }

  // Status Management
  publish() {
    if (this.status !== 'draft') {
      throw new Error('Only draft rides can be published');
    }

    this.validate(); // Ensure ride is valid before publishing

    this.status = 'active';
    this.publishedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  activate() {
    if (!['draft', 'full'].includes(this.status)) {
      throw new Error('Cannot activate ride with current status');
    }

    if (this.isPastDeparture) {
      throw new Error('Cannot activate ride after departure time');
    }

    this.status = 'active';
    this.updatedAt = new Date();

    return true;
  }

  markAsFull() {
    if (this.status !== 'active') {
      throw new Error('Only active rides can be marked as full');
    }

    this.status = 'full';
    this.updatedAt = new Date();

    return true;
  }

  startRide() {
    if (this.status !== 'active' && this.status !== 'full') {
      throw new Error('Cannot start ride with current status');
    }

    if (this.hasStarted) {
      throw new Error('Ride has already started');
    }

    // Check if it's close to departure time (within 15 minutes)
    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const fifteenMinutesBeforeDeparture = new Date(departureDateTime.getTime() - 15 * 60 * 1000);

    if (now < fifteenMinutesBeforeDeparture) {
      throw new Error('Cannot start ride more than 15 minutes before departure');
    }

    this.status = 'in-progress';
    this.hasStarted = true;
    this.startedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  completeRide() {
    if (this.status !== 'in-progress') {
      throw new Error('Only in-progress rides can be completed');
    }

    this.status = 'completed';
    this.completedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  cancelRide(reason) {
    if (['completed', 'cancelled'].includes(this.status)) {
      throw new Error('Cannot cancel ride with current status');
    }

    if (!reason) {
      throw new Error('Cancellation reason is required');
    }

    // Check cancellation time constraints
    if (this.status === 'in-progress') {
      throw new Error('Cannot cancel ride that has already started');
    }

    const now = new Date();
    const departureDateTime = this.getDepartureDateTime();
    const oneHourBeforeDeparture = new Date(departureDateTime.getTime() - 60 * 60 * 1000);

    if (now > oneHourBeforeDeparture && this.bookedSeats > 0) {
      throw new Error('Cannot cancel ride with bookings less than 1 hour before departure');
    }

    this.status = 'cancelled';
    this.cancellationReason = reason;
    this.updatedAt = new Date();

    return true;
  }

  // Booking Management
  bookSeat(numberOfSeats = 1) {
    if (!this.isBookable) {
      throw new Error('Ride is not bookable');
    }

    if (numberOfSeats > this.availableSeats) {
      throw new Error('Not enough available seats');
    }

    this.availableSeats -= numberOfSeats;
    this.bookedSeats += numberOfSeats;
    this.bookingCount += 1;
    this.lastBookingAt = new Date();

    // Auto mark as full if no seats left
    if (this.availableSeats === 0) {
      this.status = 'full';
    }

    this.updatedAt = new Date();

    return {
      bookedSeats: numberOfSeats,
      remainingSeats: this.availableSeats,
      isFull: this.isFull,
    };
  }

  cancelBooking(numberOfSeats = 1) {
    if (this.bookedSeats < numberOfSeats) {
      throw new Error('Cannot cancel more seats than booked');
    }

    this.availableSeats += numberOfSeats;
    this.bookedSeats -= numberOfSeats;
    this.cancelledBookings += 1;

    // Reactivate if was full
    if (this.status === 'full' && this.availableSeats > 0 && !this.isPastDeparture) {
      this.status = 'active';
    }

    this.updatedAt = new Date();

    return {
      cancelledSeats: numberOfSeats,
      availableSeats: this.availableSeats,
    };
  }

  // Location Tracking
  updateLocation(coordinates) {
    if (this.status !== 'in-progress') {
      throw new Error('Can only update location for in-progress rides');
    }

    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      throw new Error('Valid coordinates are required');
    }

    this.currentLocation = {
      coordinates,
      timestamp: new Date(),
    };

    this.updatedAt = new Date();

    return this.currentLocation;
  }

  // Rating Management
  addRating(rating) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    if (this.status !== 'completed') {
      throw new Error('Can only rate completed rides');
    }

    const totalScore = this.averageRating * this.totalRatings + rating;
    this.totalRatings += 1;
    this.averageRating = parseFloat((totalScore / this.totalRatings).toFixed(2));
    this.updatedAt = new Date();

    return this.averageRating;
  }

  // Statistics
  incrementViewCount() {
    this.viewCount += 1;
    this.updatedAt = new Date();
    return this.viewCount;
  }

  // Recurring Rides
  createRecurringInstances(weeks = 4) {
    if (!this.isRecurring) {
      throw new Error('This is not a recurring ride');
    }

    const instances = [];
    const currentDate = new Date(this.departureDate);
    const endDate =
      this.recurringEndDate || new Date(currentDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

    while (currentDate <= endDate) {
      this.recurringDays.forEach((day) => {
        const dayIndex = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ].indexOf(day.toLowerCase());
        const instanceDate = new Date(currentDate);
        instanceDate.setDate(currentDate.getDate() + ((dayIndex - currentDate.getDay() + 7) % 7));

        if (instanceDate >= this.departureDate && instanceDate <= endDate) {
          instances.push({
            ...this.toJSON(),
            rideId: `${this.rideId}_${instanceDate.toISOString().split('T')[0]}`,
            parentRideId: this.rideId,
            departureDate: instanceDate,
            isRecurring: false,
            recurringDays: [],
            recurringEndDate: null,
          });
        }
      });

      currentDate.setDate(currentDate.getDate() + 7);
    }

    return instances;
  }

  // Search & Filter Helpers
  matchesSearchCriteria(criteria) {
    // Date match
    if (criteria.date) {
      const searchDate = new Date(criteria.date);
      if (this.departureDate.toDateString() !== searchDate.toDateString()) {
        return false;
      }
    }

    // Time range match
    if (criteria.timeFrom && criteria.timeTo) {
      if (this.departureTime < criteria.timeFrom || this.departureTime > criteria.timeTo) {
        return false;
      }
    }

    // Available seats
    if (criteria.seats && this.availableSeats < criteria.seats) {
      return false;
    }

    // Price range
    if (criteria.maxPrice && this.pricePerSeat > criteria.maxPrice) {
      return false;
    }

    // Gender preference
    if (
      criteria.gender &&
      this.genderPreference !== 'any' &&
      this.genderPreference !== criteria.gender
    ) {
      return false;
    }

    // User type preference
    if (criteria.userType === 'student' && this.staffOnly) {
      return false;
    }
    if (criteria.userType === 'staff' && this.studentOnly) {
      return false;
    }

    return true;
  }

  // Serialization
  toJSON() {
    return {
      rideId: this.rideId,
      driverId: this.driverId,
      vehicleId: this.vehicleId,

      // Route
      startLocation: this.startLocation,
      endLocation: this.endLocation,
      pickupPoints: this.pickupPoints,
      estimatedDistance: this.estimatedDistance,
      estimatedDuration: this.estimatedDuration,
      routePolyline: this.routePolyline,

      // Schedule
      departureDate: this.departureDate.toISOString(),
      departureTime: this.departureTime,
      estimatedArrivalTime: this.estimatedArrivalTime,
      departureDateTime: this.departureDateTime.toISOString(),
      flexibleTime: this.flexibleTime,
      timeUntilDeparture: this.timeUntilDeparture,

      // Capacity
      totalSeats: this.totalSeats,
      availableSeats: this.availableSeats,
      bookedSeats: this.bookedSeats,
      occupancyRate: this.occupancyRate,

      // Pricing
      pricePerSeat: this.pricePerSeat,
      totalPrice: this.totalPrice,
      currency: this.currency,
      paymentMethods: this.paymentMethods,

      // Preferences
      maxWaitTime: this.maxWaitTime,
      allowedLuggage: this.allowedLuggage,
      smokingAllowed: this.smokingAllowed,
      petsAllowed: this.petsAllowed,
      musicAllowed: this.musicAllowed,
      airConditioned: this.airConditioned,
      genderPreference: this.genderPreference,
      minPassengerRating: this.minPassengerRating,
      studentOnly: this.studentOnly,
      staffOnly: this.staffOnly,

      // Recurring
      isRecurring: this.isRecurring,
      recurringDays: this.recurringDays,
      recurringEndDate: this.recurringEndDate ? this.recurringEndDate.toISOString() : null,
      parentRideId: this.parentRideId,

      // Status
      status: this.status,
      isActive: this.isActive,
      isFull: this.isFull,
      isBookable: this.isBookable,
      hasStarted: this.hasStarted,
      cancellationReason: this.cancellationReason,

      // Statistics
      viewCount: this.viewCount,
      bookingCount: this.bookingCount,
      completedBookings: this.completedBookings,
      cancelledBookings: this.cancelledBookings,
      completionRate: this.completionRate,

      // Ratings
      averageRating: this.averageRating,
      totalRatings: this.totalRatings,

      // Metadata
      notes: this.notes,
      tags: this.tags,

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      publishedAt: this.publishedAt ? this.publishedAt.toISOString() : null,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      completedAt: this.completedAt ? this.completedAt.toISOString() : null,
      lastBookingAt: this.lastBookingAt ? this.lastBookingAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Ride({
      ...data,
      departureDate: new Date(data.departureDate),
      recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      lastBookingAt: data.lastBookingAt ? new Date(data.lastBookingAt) : null,
    });
  }
}

module.exports = Ride;
