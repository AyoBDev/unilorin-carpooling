/**
 * Route Entity - Represents a travel route with waypoints
 * Domain Entity following DDD principles
 * University of Ilorin Carpooling Platform
 */

const { parseDate, generateToken, calculateDistance } = require('./utils/entityHelpers');

class Route {
  constructor({
    routeId,
    createdBy, // User ID who created the route

    // Route Endpoints
    startPoint, // { name, address, coordinates: { lat, lng }, placeId }
    endPoint, // { name, address, coordinates: { lat, lng }, placeId }

    // Waypoints & Stops
    waypoints = [], // Intermediate points along the route
    pickupPoints = [], // Designated pickup locations
    dropoffPoints = [], // Designated dropoff locations

    // Route Details
    routeName = null,
    routeDescription = null,
    routeType = 'direct', // 'direct' | 'multi-stop' | 'circular'
    isReturnRoute = false, // If true, includes return journey

    // Distance & Time
    totalDistance = 0, // in kilometers
    totalDuration = 0, // in minutes
    drivingDistance = 0, // Actual driving distance
    walkingDistance = 0, // Distance passengers may need to walk

    // Traffic Information
    trafficCondition = 'normal', // 'light' | 'normal' | 'moderate' | 'heavy'
    estimatedDelay = 0, // Traffic delay in minutes
    bestDepartureTime = null, // Optimal time to start journey
    worstDepartureTime = null, // Time to avoid

    // Route Optimization
    isOptimized = false,
    optimizationMethod = null, // 'shortest' | 'fastest' | 'economical'
    alternativeRoutes = [],
    avoidances = [], // ['tolls', 'highways', 'ferries', 'unpaved']

    // Polyline & Visualization
    encodedPolyline = null, // Google encoded polyline
    decodedPath = [], // Array of coordinates
    bounds = null, // Map bounds { northeast, southwest }
    zoomLevel = 12,

    // Cost Estimation
    fuelCost = 0, // Estimated fuel cost in Naira
    tollCost = 0, // Toll charges if any
    totalCost = 0, // Total estimated cost
    costPerPassenger = 0, // Cost when shared
    fuelConsumption = 0, // Estimated liters

    // University Specific
    includesUniversity = false,
    universityGate = null, // Which gate: 'main' | 'west' | 'east' | 'south'
    campusRoute = false, // If route is within campus

    // Popular Locations
    landmarks = [], // Notable landmarks along the route
    busStops = [], // Public transport stops nearby
    popularPickupPoints = [], // Frequently used pickup points

    // Safety & Restrictions
    safetyScore = 0, // 0-100 safety rating
    restrictedAreas = [], // Areas to avoid
    dangerZones = [], // Known dangerous spots
    policeCheckpoints = [], // Known checkpoint locations
    speedBumps = [], // Speed bump locations

    // Time-based Variations
    morningRoute = null, // Route variation for morning
    eveningRoute = null, // Route variation for evening
    weekendRoute = null, // Route variation for weekends

    // Weather Considerations
    weatherSensitive = false,
    floodProneAreas = [], // Areas that flood during rain
    alternativeRainyRoute = null,

    // Validation & Verification
    isVerified = false,
    verifiedBy = null,
    verifiedAt = null,
    verificationMethod = null, // 'auto' | 'manual' | 'crowd-sourced'

    // Usage Statistics
    usageCount = 0,
    totalPassengers = 0,
    averageRating = 0,
    totalRatings = 0,
    lastUsedAt = null,

    // Sharing & Privacy
    isPublic = true,
    isShared = false,
    sharedWith = [], // User IDs who can see this route
    shareToken = null,

    // Status
    status = 'active', // 'draft' | 'active' | 'inactive' | 'archived'
    isDeleted = false,
    deletedAt = null,

    // Metadata
    tags = [], // ['daily-commute', 'scenic', 'fastest', 'economical']
    notes = null,
    customData = {},

    // Timestamps
    createdAt = new Date(),
    updatedAt = new Date(),
    lastModifiedBy = null,
    lastCalculatedAt = null,
  }) {
    this.routeId = routeId;
    this.createdBy = createdBy;

    // Route Endpoints
    this.startPoint = startPoint;
    this.endPoint = endPoint;

    // Waypoints & Stops
    this.waypoints = waypoints;
    this.pickupPoints = pickupPoints;
    this.dropoffPoints = dropoffPoints;

    // Route Details
    this.routeName = routeName || this.generateRouteName();
    this.routeDescription = routeDescription;
    this.routeType = routeType;
    this.isReturnRoute = isReturnRoute;

    // Distance & Time
    this.totalDistance = totalDistance;
    this.totalDuration = totalDuration;
    this.drivingDistance = drivingDistance || totalDistance;
    this.walkingDistance = walkingDistance;

    // Traffic Information
    this.trafficCondition = trafficCondition;
    this.estimatedDelay = estimatedDelay;
    this.bestDepartureTime = bestDepartureTime;
    this.worstDepartureTime = worstDepartureTime;

    // Route Optimization
    this.isOptimized = isOptimized;
    this.optimizationMethod = optimizationMethod;
    this.alternativeRoutes = alternativeRoutes;
    this.avoidances = avoidances;

    // Polyline & Visualization
    this.encodedPolyline = encodedPolyline;
    this.decodedPath = decodedPath;
    this.bounds = bounds;
    this.zoomLevel = zoomLevel;

    // Cost Estimation
    this.fuelCost = fuelCost;
    this.tollCost = tollCost;
    this.totalCost = totalCost || this.calculateTotalCost();
    this.costPerPassenger = costPerPassenger || this.calculateCostPerPassenger();
    this.fuelConsumption = fuelConsumption || this.estimateFuelConsumption();

    // University Specific
    this.includesUniversity = includesUniversity || this.checkUniversityInclusion();
    this.universityGate = universityGate;
    this.campusRoute = campusRoute;

    // Popular Locations
    this.landmarks = landmarks;
    this.busStops = busStops;
    this.popularPickupPoints = popularPickupPoints;

    // Safety & Restrictions
    this.safetyScore = safetyScore || this.calculateSafetyScore();
    this.restrictedAreas = restrictedAreas;
    this.dangerZones = dangerZones;
    this.policeCheckpoints = policeCheckpoints;
    this.speedBumps = speedBumps;

    // Time-based Variations
    this.morningRoute = morningRoute;
    this.eveningRoute = eveningRoute;
    this.weekendRoute = weekendRoute;

    // Weather Considerations
    this.weatherSensitive = weatherSensitive;
    this.floodProneAreas = floodProneAreas;
    this.alternativeRainyRoute = alternativeRainyRoute;

    // Validation & Verification
    this.isVerified = isVerified;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = parseDate(verifiedAt);
    this.verificationMethod = verificationMethod;

    // Usage Statistics
    this.usageCount = usageCount;
    this.totalPassengers = totalPassengers;
    this.averageRating = averageRating;
    this.totalRatings = totalRatings;
    this.lastUsedAt = parseDate(lastUsedAt);

    // Sharing & Privacy
    this.isPublic = isPublic;
    this.isShared = isShared;
    this.sharedWith = sharedWith;
    this.shareToken = shareToken || this.generateShareToken();

    // Status
    this.status = status;
    this.isDeleted = isDeleted;
    this.deletedAt = parseDate(deletedAt);

    // Metadata
    this.tags = tags;
    this.notes = notes;
    this.customData = customData;

    // Timestamps
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
    this.updatedAt = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
    this.lastModifiedBy = lastModifiedBy;
    this.lastCalculatedAt = parseDate(lastCalculatedAt);

    // Validate on creation
    this.validate();
  }

  // Getters
  get isActive() {
    return this.status === 'active' && !this.isDeleted;
  }

  get isDraft() {
    return this.status === 'draft';
  }

  get isArchived() {
    return this.status === 'archived';
  }

  get hasWaypoints() {
    return this.waypoints.length > 0;
  }

  get hasPickupPoints() {
    return this.pickupPoints.length > 0;
  }

  get isDirectRoute() {
    return this.routeType === 'direct' && !this.hasWaypoints;
  }

  get isCircularRoute() {
    return this.routeType === 'circular';
  }

  get isMultiStop() {
    return this.routeType === 'multi-stop' || this.hasWaypoints;
  }

  get totalStops() {
    return 2 + this.waypoints.length + this.pickupPoints.length + this.dropoffPoints.length;
  }

  get estimatedArrivalTime() {
    if (!this.bestDepartureTime) return null;

    const [hours, minutes] = this.bestDepartureTime.split(':').map(Number);
    const departure = new Date();
    departure.setHours(hours, minutes, 0, 0);

    const arrival = new Date(
      departure.getTime() + (this.totalDuration + this.estimatedDelay) * 60 * 1000,
    );
    return `${arrival.getHours().toString().padStart(2, '0')}:${arrival.getMinutes().toString().padStart(2, '0')}`;
  }

  get isSafe() {
    return this.safetyScore >= 70;
  }

  get isEconomical() {
    return this.optimizationMethod === 'economical' || this.tags.includes('economical');
  }

  get isPopular() {
    return this.usageCount > 50 || this.averageRating >= 4;
  }

  get distanceInMiles() {
    return (this.totalDistance * 0.621371).toFixed(2);
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.routeId) errors.push('Route ID is required');
    if (!this.createdBy) errors.push('Creator ID is required');

    // Endpoint validation
    if (!this.startPoint || !this.startPoint.coordinates) {
      errors.push('Valid start point with coordinates is required');
    }
    if (!this.endPoint || !this.endPoint.coordinates) {
      errors.push('Valid end point with coordinates is required');
    }

    // Validate coordinates
    if (this.startPoint && this.startPoint.coordinates) {
      if (!this.isValidCoordinate(this.startPoint.coordinates)) {
        errors.push('Invalid start point coordinates');
      }
    }

    if (this.endPoint && this.endPoint.coordinates) {
      if (!this.isValidCoordinate(this.endPoint.coordinates)) {
        errors.push('Invalid end point coordinates');
      }
    }

    // Route type validation
    const validRouteTypes = ['direct', 'multi-stop', 'circular'];
    if (!validRouteTypes.includes(this.routeType)) {
      errors.push('Invalid route type');
    }

    // Distance validation
    if (this.totalDistance < 0) {
      errors.push('Total distance cannot be negative');
    }
    if (this.totalDistance > 200) {
      errors.push('Route distance exceeds maximum allowed (200km)');
    }

    // Duration validation
    if (this.totalDuration < 0) {
      errors.push('Total duration cannot be negative');
    }

    // Cost validation
    if (this.fuelCost < 0) errors.push('Fuel cost cannot be negative');
    if (this.tollCost < 0) errors.push('Toll cost cannot be negative');

    // Safety score validation
    if (this.safetyScore < 0 || this.safetyScore > 100) {
      errors.push('Safety score must be between 0 and 100');
    }

    // Status validation
    const validStatuses = ['draft', 'active', 'inactive', 'archived'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Invalid route status');
    }

    // University route validation
    if (!this.includesUniversity) {
      errors.push('Route must include University of Ilorin as start or end point');
    }

    if (errors.length > 0) {
      throw new Error(`Route validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  isValidCoordinate(coordinate) {
    if (!coordinate.lat || !coordinate.lng) return false;

    const lat = parseFloat(coordinate.lat);
    const lng = parseFloat(coordinate.lng);

    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  generateRouteName() {
    if (!this.startPoint || !this.endPoint) return 'Unnamed Route';

    const startName = this.startPoint.name || this.startPoint.address || 'Start';
    const endName = this.endPoint.name || this.endPoint.address || 'End';

    return `${startName} to ${endName}`;
  }

  generateShareToken() {
    return generateToken('route', this.routeId);
  }

  checkUniversityInclusion() {
    const unilorinCoordinates = { lat: 4.6696, lng: 8.4789 };
    const tolerance = 0.01; // About 1km

    const isStartUnilorin =
      this.startPoint &&
      Math.abs(this.startPoint.coordinates.lat - unilorinCoordinates.lat) < tolerance &&
      Math.abs(this.startPoint.coordinates.lng - unilorinCoordinates.lng) < tolerance;

    const isEndUnilorin =
      this.endPoint &&
      Math.abs(this.endPoint.coordinates.lat - unilorinCoordinates.lat) < tolerance &&
      Math.abs(this.endPoint.coordinates.lng - unilorinCoordinates.lng) < tolerance;

    return isStartUnilorin || isEndUnilorin;
  }

  // Cost Calculations
  calculateTotalCost() {
    return this.fuelCost + this.tollCost;
  }

  calculateCostPerPassenger(numberOfPassengers = 4) {
    return Math.ceil(this.totalCost / numberOfPassengers);
  }

  estimateFuelConsumption() {
    // Assume average fuel consumption of 10km/liter
    const kmPerLiter = 10;
    return parseFloat((this.totalDistance / kmPerLiter).toFixed(2));
  }

  calculateFuelCost(fuelPricePerLiter = 700) {
    // Nigerian fuel price (Naira per liter)
    this.fuelConsumption = this.estimateFuelConsumption();
    this.fuelCost = Math.ceil(this.fuelConsumption * fuelPricePerLiter);
    this.totalCost = this.calculateTotalCost();
    this.updatedAt = new Date();

    return this.fuelCost;
  }

  calculateSafetyScore() {
    let score = 100; // Start with perfect score

    // Deduct points for danger zones
    score -= this.dangerZones.length * 10;

    // Deduct points for restricted areas
    score -= this.restrictedAreas.length * 5;

    // Add points for police checkpoints (increased security)
    score += Math.min(this.policeCheckpoints.length * 5, 15);

    // Deduct points for flood-prone areas
    score -= this.floodProneAreas.length * 8;

    // Time-based adjustments
    if (this.worstDepartureTime) {
      score -= 5; // Has known dangerous times
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  // Waypoint Management
  addWaypoint(waypoint) {
    if (!waypoint.coordinates || !this.isValidCoordinate(waypoint.coordinates)) {
      throw new Error('Valid waypoint coordinates are required');
    }

    this.waypoints.push({
      ...waypoint,
      order: this.waypoints.length,
      addedAt: new Date(),
    });

    this.routeType = 'multi-stop';
    this.isOptimized = false; // Needs re-optimization
    this.updatedAt = new Date();

    return this.waypoints;
  }

  removeWaypoint(index) {
    if (index < 0 || index >= this.waypoints.length) {
      throw new Error('Invalid waypoint index');
    }

    this.waypoints.splice(index, 1);

    // Reorder remaining waypoints
    this.waypoints.forEach((wp, i) => {
      wp.order = i;
    });

    if (this.waypoints.length === 0 && this.pickupPoints.length === 0) {
      this.routeType = 'direct';
    }

    this.isOptimized = false;
    this.updatedAt = new Date();

    return this.waypoints;
  }

  optimizeWaypoints() {
    if (this.waypoints.length < 2) {
      return this.waypoints;
    }

    // Simple nearest neighbor optimization
    // In production, use Google's Directions API for optimization
    const optimized = [];
    const remaining = [...this.waypoints];
    let current = this.startPoint.coordinates;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      const currentCoords = current;

      remaining.forEach((waypoint, index) => {
        const distance = this.calculateDistance(currentCoords, waypoint.coordinates);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);
      current = nearest.coordinates;
    }

    this.waypoints = optimized.map((wp, i) => ({ ...wp, order: i }));
    this.isOptimized = true;
    this.optimizationMethod = 'shortest';
    this.updatedAt = new Date();

    return this.waypoints;
  }

  // Pickup/Dropoff Point Management
  addPickupPoint(pickupPoint) {
    if (!pickupPoint.coordinates || !this.isValidCoordinate(pickupPoint.coordinates)) {
      throw new Error('Valid pickup point coordinates are required');
    }

    // Check if pickup point is within reasonable distance from route
    const maxDeviation = 2; // 2km max deviation
    if (!this.isPointNearRoute(pickupPoint.coordinates, maxDeviation)) {
      throw new Error('Pickup point is too far from the route');
    }

    this.pickupPoints.push({
      ...pickupPoint,
      id: `PP_${Date.now()}`,
      estimatedTime: this.estimateArrivalTime(pickupPoint.coordinates),
      addedAt: new Date(),
    });

    this.updatedAt = new Date();

    return this.pickupPoints;
  }

  removePickupPoint(id) {
    const index = this.pickupPoints.findIndex((pp) => pp.id === id);

    if (index === -1) {
      throw new Error('Pickup point not found');
    }

    this.pickupPoints.splice(index, 1);
    this.updatedAt = new Date();

    return this.pickupPoints;
  }

  // Distance Calculations
  calculateDistance(coord1, coord2) {
    return calculateDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng);
  }

  isPointNearRoute(coordinates, maxDistance = 2) {
    // Simplified check - in production, use actual route polyline
    // Check if point is within maxDistance km from start or end
    const distanceFromStart = this.calculateDistance(this.startPoint.coordinates, coordinates);
    const distanceFromEnd = this.calculateDistance(this.endPoint.coordinates, coordinates);

    // Check if point is between start and end (roughly)
    const totalRouteDistance =
      this.totalDistance ||
      this.calculateDistance(this.startPoint.coordinates, this.endPoint.coordinates);

    return distanceFromStart + distanceFromEnd <= totalRouteDistance + maxDistance;
  }

  estimateArrivalTime(coordinates) {
    // Estimate based on distance from start
    const distanceFromStart = this.calculateDistance(this.startPoint.coordinates, coordinates);
    const averageSpeed = 40; // km/h in city
    const estimatedMinutes = (distanceFromStart / averageSpeed) * 60;

    return Math.ceil(estimatedMinutes);
  }

  // Traffic Management
  updateTrafficCondition(condition, delay = 0) {
    const validConditions = ['light', 'normal', 'moderate', 'heavy'];

    if (!validConditions.includes(condition)) {
      throw new Error('Invalid traffic condition');
    }

    this.trafficCondition = condition;
    this.estimatedDelay = delay;

    // Adjust total duration
    this.totalDuration += delay;

    this.updatedAt = new Date();

    return {
      condition: this.trafficCondition,
      delay: this.estimatedDelay,
      adjustedDuration: this.totalDuration,
    };
  }

  // Weather Considerations
  addFloodProneArea(area) {
    this.floodProneAreas.push({
      ...area,
      severity: area.severity || 'moderate',
      addedAt: new Date(),
    });

    this.weatherSensitive = true;
    this.safetyScore = this.calculateSafetyScore();
    this.updatedAt = new Date();

    return this.floodProneAreas;
  }

  setAlternativeRainyRoute(route) {
    this.alternativeRainyRoute = route;
    this.weatherSensitive = true;
    this.updatedAt = new Date();

    return this.alternativeRainyRoute;
  }

  // Verification
  verify(verifiedBy, method = 'manual') {
    if (this.isVerified) {
      throw new Error('Route is already verified');
    }

    this.isVerified = true;
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
    this.verificationMethod = method;
    this.updatedAt = new Date();

    return true;
  }

  // Usage Tracking
  recordUsage(numberOfPassengers = 1) {
    this.usageCount += 1;
    this.totalPassengers += numberOfPassengers;
    this.lastUsedAt = new Date();
    this.updatedAt = new Date();

    return {
      usageCount: this.usageCount,
      totalPassengers: this.totalPassengers,
    };
  }

  updateRating(rating) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const totalScore = this.averageRating * this.totalRatings + rating;
    this.totalRatings += 1;
    this.averageRating = parseFloat((totalScore / this.totalRatings).toFixed(2));
    this.updatedAt = new Date();

    return this.averageRating;
  }

  // Sharing
  share(userIds = []) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('User IDs array is required for sharing');
    }

    this.isShared = true;
    this.sharedWith = [...new Set([...this.sharedWith, ...userIds])];
    this.updatedAt = new Date();

    return {
      sharedWith: this.sharedWith,
      shareToken: this.shareToken,
    };
  }

  unshare(userId = null) {
    if (userId) {
      this.sharedWith = this.sharedWith.filter((id) => id !== userId);
    } else {
      this.sharedWith = [];
      this.isShared = false;
    }

    this.updatedAt = new Date();

    return this.sharedWith;
  }

  // Status Management
  activate() {
    if (this.isDeleted) {
      throw new Error('Cannot activate deleted route');
    }

    this.status = 'active';
    this.updatedAt = new Date();

    return true;
  }

  deactivate() {
    this.status = 'inactive';
    this.updatedAt = new Date();

    return true;
  }

  archive() {
    this.status = 'archived';
    this.updatedAt = new Date();

    return true;
  }

  softDelete() {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.status = 'inactive';
    this.updatedAt = new Date();

    return true;
  }

  restore() {
    if (!this.isDeleted) {
      throw new Error('Route is not deleted');
    }

    this.isDeleted = false;
    this.deletedAt = null;
    this.status = 'active';
    this.updatedAt = new Date();

    return true;
  }

  // Cloning
  clone(newRouteId, createdBy) {
    return new Route({
      ...this.toJSON(),
      routeId: newRouteId,
      createdBy,
      routeName: `${this.routeName} (Copy)`,
      usageCount: 0,
      totalPassengers: 0,
      averageRating: 0,
      totalRatings: 0,
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Export/Import
  exportToGPX() {
    // Generate GPX format for GPS devices
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <metadata>
    <name>${this.routeName}</name>
    <desc>${this.routeDescription || ''}</desc>
    <time>${this.createdAt.toISOString()}</time>
  </metadata>
  <rte>
    <name>${this.routeName}</name>
    <rtept lat="${this.startPoint.coordinates.lat}" lon="${this.startPoint.coordinates.lng}">
      <name>${this.startPoint.name}</name>
    </rtept>
    ${this.waypoints
      .map(
        (wp) => `
    <rtept lat="${wp.coordinates.lat}" lon="${wp.coordinates.lng}">
      <name>${wp.name || 'Waypoint'}</name>
    </rtept>`,
      )
      .join('')}
    <rtept lat="${this.endPoint.coordinates.lat}" lon="${this.endPoint.coordinates.lng}">
      <name>${this.endPoint.name}</name>
    </rtept>
  </rte>
</gpx>`;

    return gpx;
  }

  // Serialization
  toJSON() {
    return {
      routeId: this.routeId,
      createdBy: this.createdBy,

      // Route Details
      routeName: this.routeName,
      routeDescription: this.routeDescription,
      routeType: this.routeType,
      isReturnRoute: this.isReturnRoute,

      // Endpoints
      startPoint: this.startPoint,
      endPoint: this.endPoint,

      // Waypoints
      waypoints: this.waypoints,
      pickupPoints: this.pickupPoints,
      dropoffPoints: this.dropoffPoints,
      totalStops: this.totalStops,

      // Distance & Time
      totalDistance: this.totalDistance,
      totalDuration: this.totalDuration,
      drivingDistance: this.drivingDistance,
      walkingDistance: this.walkingDistance,
      estimatedArrivalTime: this.estimatedArrivalTime,

      // Traffic
      trafficCondition: this.trafficCondition,
      estimatedDelay: this.estimatedDelay,
      bestDepartureTime: this.bestDepartureTime,
      worstDepartureTime: this.worstDepartureTime,

      // Cost
      fuelCost: this.fuelCost,
      tollCost: this.tollCost,
      totalCost: this.totalCost,
      costPerPassenger: this.costPerPassenger,
      fuelConsumption: this.fuelConsumption,

      // University
      includesUniversity: this.includesUniversity,
      universityGate: this.universityGate,
      campusRoute: this.campusRoute,

      // Safety
      safetyScore: this.safetyScore,
      isSafe: this.isSafe,
      restrictedAreas: this.restrictedAreas,
      dangerZones: this.dangerZones,

      // Weather
      weatherSensitive: this.weatherSensitive,
      floodProneAreas: this.floodProneAreas,

      // Optimization
      isOptimized: this.isOptimized,
      optimizationMethod: this.optimizationMethod,

      // Verification
      isVerified: this.isVerified,
      verifiedAt: this.verifiedAt ? this.verifiedAt.toISOString() : null,

      // Usage
      usageCount: this.usageCount,
      totalPassengers: this.totalPassengers,
      averageRating: this.averageRating,
      isPopular: this.isPopular,
      lastUsedAt: this.lastUsedAt ? this.lastUsedAt.toISOString() : null,

      // Status
      status: this.status,
      isActive: this.isActive,
      isDeleted: this.isDeleted,

      // Sharing
      isPublic: this.isPublic,
      isShared: this.isShared,
      shareToken: this.shareToken,

      // Metadata
      tags: this.tags,
      notes: this.notes,

      // Timestamps
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastCalculatedAt: this.lastCalculatedAt ? this.lastCalculatedAt.toISOString() : null,
    };
  }

  // Factory method
  static fromDatabase(data) {
    return new Route({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : null,
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : null,
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      lastCalculatedAt: data.lastCalculatedAt ? new Date(data.lastCalculatedAt) : null,
    });
  }
}

module.exports = Route;
