/**
 * Scheduled Lambda Handler Unit Tests
 *
 * The scheduled handler exports a single `handler` function that dispatches
 * to internal task functions based on event.detail.task or event.task.
 * Tasks use repositories directly (not services).
 */

// Mock repositories used by the scheduled tasks
const mockRideRepo = {
  findActiveRidesBefore: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn().mockResolvedValue({}),
  findRidesDepartingAround: jest.fn().mockResolvedValue([]),
  findCompletedAfter: jest.fn().mockResolvedValue([]),
};

const mockBookingRepo = {
  findByRideId: jest.fn().mockResolvedValue([]),
  findByRideIdAndStatus: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
};

const mockNotificationRepo = {
  create: jest.fn().mockResolvedValue({}),
  deleteReadBefore: jest.fn().mockResolvedValue(0),
};

// Mock ReportingService used by generateDailyReport (imported directly, not via barrel)
const mockReportingService = {
  generateDailySummary: jest.fn().mockResolvedValue({ date: '2026-02-27', totalRides: 0, totalBookings: 0, totalRevenue: 0 }),
};

jest.mock('../../../../src/core/services/ReportingService', () =>
  jest.fn().mockImplementation(() => mockReportingService)
);

jest.mock('../../../../src/infrastructure/database/repositories/RideRepository', () =>
  jest.fn().mockImplementation(() => mockRideRepo)
);
jest.mock('../../../../src/infrastructure/database/repositories/BookingRepository', () =>
  jest.fn().mockImplementation(() => mockBookingRepo)
);
jest.mock('../../../../src/infrastructure/database/repositories/NotificationRepository', () =>
  jest.fn().mockImplementation(() => mockNotificationRepo)
);

jest.mock('../../../../src/lambda/middleware/lambdaMiddleware', () => ({
  withMiddleware: jest.fn((name, fn) => async (event, context) => fn(event, context)),
}));

jest.mock('../../../../src/shared/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock the cache module — cleanupSessions uses `CacheService` (the class export)
const mockCacheServiceInstance = {
  isAvailable: jest.fn().mockReturnValue(false), // Skip Redis scan in tests
  scanKeys: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(true),
};

jest.mock('../../../../src/infrastructure/cache', () => ({
  RedisClient: {
    getClient: jest.fn().mockResolvedValue({
      scan: jest.fn().mockResolvedValue(['0', []]),
      del: jest.fn().mockResolvedValue(0),
      keys: jest.fn().mockResolvedValue([]),
    }),
    isConnected: jest.fn().mockReturnValue(true),
  },
  // CacheService is accessed as a property — expose the mock instance directly
  CacheService: {
    isAvailable: jest.fn().mockReturnValue(false),
    scanKeys: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(true),
  },
}));

const scheduledHandler = require('../../../../src/lambda/handlers/scheduled.handler');

describe('Scheduled Lambda Handler', () => {
  const mockContext = {
    callbackWaitsForEmptyEventLoop: true,
    awsRequestId: 'test-aws-req',
    functionName: 'scheduled-handler',
    getRemainingTimeInMillis: jest.fn().mockReturnValue(120000),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Task dispatcher ───────────────────────────────────
  describe('handler — task dispatcher', () => {
    it('should return 400 for unknown task name', async () => {
      const event = { task: 'nonExistentTask' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should dispatch to expireRides task', async () => {
      const event = { task: 'expireRides' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('expireRides');
    });

    it('should dispatch using EventBridge detail.task format', async () => {
      const event = { detail: { task: 'expireRides' } };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should run all tasks when no taskName is given', async () => {
      const event = {};

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('All scheduled tasks executed');
      // All 6 task results should be present in data
      expect(body.data).toHaveProperty('expireRides');
      expect(body.data).toHaveProperty('sendRideReminders');
      expect(body.data).toHaveProperty('cleanupSessions');
      expect(body.data).toHaveProperty('markNoShows');
      expect(body.data).toHaveProperty('generateDailyReport');
      expect(body.data).toHaveProperty('cleanupOldData');
    });

    it('should handle task errors gracefully when running all tasks', async () => {
      mockRideRepo.findActiveRidesBefore.mockRejectedValueOnce(new Error('DB error'));
      const event = {};

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // expireRides failed but all tasks still run
      expect(body.data.expireRides).toHaveProperty('error');
    });

    it('should dispatch to sendRideReminders task', async () => {
      const event = { task: 'sendRideReminders' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('sendRideReminders');
    });

    it('should dispatch to markNoShows task', async () => {
      const event = { task: 'markNoShows' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should dispatch to generateDailyReport task', async () => {
      const event = { task: 'generateDailyReport' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should dispatch to cleanupOldData task', async () => {
      const event = { task: 'cleanupOldData' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should dispatch to cleanupSessions task', async () => {
      const event = { task: 'cleanupSessions' };

      const result = await scheduledHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });
  });

  // ─── expireRides task logic ────────────────────────────
  describe('expireRides task', () => {
    it('should mark rides with confirmed bookings as completed', async () => {
      mockRideRepo.findActiveRidesBefore.mockResolvedValue([{ rideId: 'r1' }]);
      mockBookingRepo.findByRideId.mockResolvedValue([{ status: 'confirmed' }]);
      mockRideRepo.updateStatus.mockResolvedValue({});

      const result = await scheduledHandler.handler({ task: 'expireRides' }, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockRideRepo.updateStatus).toHaveBeenCalledWith('r1', 'completed');
    });

    it('should mark rides with no bookings as expired', async () => {
      mockRideRepo.findActiveRidesBefore.mockResolvedValue([{ rideId: 'r2' }]);
      mockBookingRepo.findByRideId.mockResolvedValue([]);

      const result = await scheduledHandler.handler({ task: 'expireRides' }, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockRideRepo.updateStatus).toHaveBeenCalledWith('r2', 'expired');
    });

    it('should handle empty active rides list', async () => {
      mockRideRepo.findActiveRidesBefore.mockResolvedValue([]);

      const result = await scheduledHandler.handler({ task: 'expireRides' }, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.total).toBe(0);
    });
  });
});
