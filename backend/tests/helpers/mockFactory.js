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
    role: 'student',
    ...overrides,
  });

const createMockAdmin = (overrides = {}) =>
  createMockUser({
    role: 'admin',
    ...overrides,
  });

const createMockRide = (overrides = {}) => ({
  rideId: randomUUID(),
  driverId: randomUUID(),
  origin: { name: 'Main Gate', latitude: 8.4799, longitude: 4.5418 },
  destination: { name: 'Tanke', latitude: 8.4866, longitude: 4.5591 },
  departureTime: new Date(Date.now() + 3600000).toISOString(),
  availableSeats: 3,
  totalSeats: 4,
  pricePerSeat: 500,
  status: 'scheduled',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockBooking = (overrides = {}) => ({
  bookingId: randomUUID(),
  rideId: randomUUID(),
  passengerId: randomUUID(),
  seatsBooked: 1,
  totalPrice: 500,
  status: 'confirmed',
  verificationCode: '123456',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockRating = (overrides = {}) => ({
  ratingId: randomUUID(),
  bookingId: randomUUID(),
  raterId: randomUUID(),
  rateeId: randomUUID(),
  score: 4,
  comment: 'Great ride!',
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
  createMockRide,
  createMockBooking,
  createMockRating,
  createMockReq,
  createMockRes,
  createMockNext,
};
