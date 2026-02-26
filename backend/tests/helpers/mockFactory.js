/**
 * Mock Factory
 * Creates mock objects for testing
 */

const { randomUUID } = require('crypto');

const createMockUser = (overrides = {}) => ({
  userId: randomUUID(),
  email: `test-${Date.now()}@unilorin.edu.ng`,
  firstName: 'Test',
  lastName: 'User',
  phone: '+2348012345678',
  role: 'student',
  isDriver: false,
  isVerified: true,
  isActive: true,
  status: 'active',
  driverStatus: null,
  matricNumber: '19/52HP029',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockDriver = (overrides = {}) =>
  createMockUser({
    isDriver: true,
    driverStatus: 'verified',
    driverVerificationStatus: 'verified',
    role: 'student',
    ...overrides,
  });

const createMockAdmin = (overrides = {}) =>
  createMockUser({
    role: 'admin',
    ...overrides,
  });

const createMockVehicle = (overrides = {}) => ({
  vehicleId: randomUUID(),
  userId: randomUUID(),
  make: 'Toyota',
  model: 'Camry',
  color: 'Silver',
  plateNumber: 'KWL-123-AB',
  capacity: 4,
  year: 2020,
  isActive: true,
  isPrimary: true,
  verificationStatus: 'approved',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockRide = (overrides = {}) => {
  const driverId = overrides.driverId || randomUUID();
  const departureDateTime = new Date(Date.now() + 3600000).toISOString();
  return {
    rideId: randomUUID(),
    driverId,
    vehicleId: randomUUID(),
    departureDate: '2026-03-01',
    departureTime: '08:00',
    departureDateTime,
    startLocation: {
      address: 'University of Ilorin Main Gate',
      coordinates: [8.4799, 4.5418],
      name: 'Main Gate',
    },
    endLocation: {
      address: 'Tanke Roundabout',
      coordinates: [8.4866, 4.5591],
      name: 'Tanke',
    },
    pickupPoints: [],
    availableSeats: 3,
    totalSeats: 4,
    bookedSeats: 1,
    pricePerSeat: 500,
    waitTime: 5,
    status: 'active',
    driver: {
      userId: driverId,
      firstName: 'Driver',
      lastName: 'Test',
      phone: '+2348012345679',
      averageRating: 4.5,
      profilePhoto: null,
    },
    vehicle: {
      vehicleId: randomUUID(),
      make: 'Toyota',
      model: 'Camry',
      color: 'Silver',
      plateNumber: 'KWL-123-AB',
      capacity: 4,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

const createMockBooking = (overrides = {}) => {
  const passengerId = overrides.passengerId || randomUUID();
  const driverId = overrides.driverId || randomUUID();
  return {
    bookingId: randomUUID(),
    bookingReference: 'BK-ABC123',
    rideId: randomUUID(),
    passengerId,
    driverId,
    pickupPointId: null,
    pickupPointName: 'Main Gate',
    seats: 1,
    pricePerSeat: 500,
    totalAmount: 500,
    status: 'confirmed',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    verificationCode: '123456',
    verificationExpiry: new Date(Date.now() + 86400000).toISOString(),
    notes: null,
    rideDate: '2026-03-01',
    rideTime: '08:00',
    rideDepartureDateTime: new Date(Date.now() + 3600000).toISOString(),
    startLocation: {
      address: 'University of Ilorin Main Gate',
      coordinates: [8.4799, 4.5418],
      name: 'Main Gate',
    },
    endLocation: {
      address: 'Tanke Roundabout',
      coordinates: [8.4866, 4.5591],
      name: 'Tanke',
    },
    passenger: {
      userId: passengerId,
      firstName: 'Passenger',
      lastName: 'Test',
      phone: '+2348012345678',
      profilePhoto: null,
    },
    driver: {
      userId: driverId,
      firstName: 'Driver',
      lastName: 'Test',
      phone: '+2348012345679',
    },
    vehicle: {
      vehicleId: randomUUID(),
      make: 'Toyota',
      model: 'Camry',
      color: 'Silver',
      plateNumber: 'KWL-123-AB',
      capacity: 4,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

const createMockRating = (overrides = {}) => ({
  ratingId: randomUUID(),
  bookingId: randomUUID(),
  rideId: randomUUID(),
  raterId: randomUUID(),
  ratedUserId: randomUUID(),
  ratingType: 'driver_rating',
  score: 4,
  comment: 'Great ride!',
  tags: ['Punctual', 'Safe Driver'],
  isAnonymous: false,
  isHidden: false,
  isReported: false,
  reportCount: 0,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const createMockReq = (overrides = {}) => ({
  method: 'GET',
  path: '/api/v1/test',
  originalUrl: '/api/v1/test',
  url: '/api/v1/test',
  headers: {},
  params: {},
  query: {},
  body: {},
  user: null,
  token: null,
  correlationId: randomUUID(),
  ip: '127.0.0.1',
  ...overrides,
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    _headers: {},
    _body: null,
    headersSent: false,
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res._body = body;
    res.headersSent = true;
    return res;
  });
  res.send = jest.fn((body) => {
    res._body = body;
    res.headersSent = true;
    return res;
  });
  res.end = jest.fn(() => {
    res.headersSent = true;
    return res;
  });
  res.setHeader = jest.fn((key, value) => {
    res._headers[key] = value;
    return res;
  });

  return res;
};

const createMockNext = () => jest.fn();

module.exports = {
  createMockUser,
  createMockDriver,
  createMockAdmin,
  createMockVehicle,
  createMockRide,
  createMockBooking,
  createMockRating,
  createMockReq,
  createMockRes,
  createMockNext,
};
