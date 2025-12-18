import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    devSystemLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    devAlert: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    devMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    devIntegration: {
      count: jest.fn(),
    },
    devEvent: {
      count: jest.fn(),
    },
    devPaymentTransaction: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy status', async () => {
      const result = await service.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.services).toBeDefined();
    });

    it('should include service statuses', async () => {
      const result = await service.getHealth();

      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('redis');
    });
  });

  describe('getMetrics', () => {
    it('should return system metrics', async () => {
      mockPrismaService.devIntegration.count.mockResolvedValue(10);
      mockPrismaService.devEvent.count.mockResolvedValue(1000);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(500);

      const result = await service.getMetrics();

      expect(result).toBeDefined();
      expect(result.integrations).toBe(10);
      expect(result.events).toBe(1000);
      expect(result.transactions).toBe(500);
    });

    it('should include memory usage', async () => {
      mockPrismaService.devIntegration.count.mockResolvedValue(0);
      mockPrismaService.devEvent.count.mockResolvedValue(0);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(0);

      const result = await service.getMetrics();

      expect(result.memory).toBeDefined();
      expect(result.memory.heapUsed).toBeDefined();
      expect(result.memory.heapTotal).toBeDefined();
    });
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      const logs = [
        { id: 'log-1', level: 'info', message: 'Test log 1' },
        { id: 'log-2', level: 'error', message: 'Test log 2' },
      ];

      mockPrismaService.devSystemLog.findMany.mockResolvedValue(logs);
      mockPrismaService.devSystemLog.count.mockResolvedValue(2);

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by level', async () => {
      const logs = [
        { id: 'log-1', level: 'error', message: 'Error log' },
      ];

      mockPrismaService.devSystemLog.findMany.mockResolvedValue(logs);
      mockPrismaService.devSystemLog.count.mockResolvedValue(1);

      const result = await service.getLogs({ page: 1, limit: 10, level: 'error' });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.devSystemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ level: 'error' }),
        }),
      );
    });

    it('should filter by source', async () => {
      mockPrismaService.devSystemLog.findMany.mockResolvedValue([]);
      mockPrismaService.devSystemLog.count.mockResolvedValue(0);

      await service.getLogs({ page: 1, limit: 10, source: 'PaymentService' });

      expect(mockPrismaService.devSystemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'PaymentService' }),
        }),
      );
    });
  });

  describe('getAlerts', () => {
    it('should return paginated alerts', async () => {
      const alerts = [
        { id: 'alert-1', alertType: 'error', severity: 3, status: 'active' },
        { id: 'alert-2', alertType: 'warning', severity: 2, status: 'active' },
      ];

      mockPrismaService.devAlert.findMany.mockResolvedValue(alerts);
      mockPrismaService.devAlert.count.mockResolvedValue(2);

      const result = await service.getAlerts({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      const alerts = [
        { id: 'alert-1', status: 'resolved' },
      ];

      mockPrismaService.devAlert.findMany.mockResolvedValue(alerts);
      mockPrismaService.devAlert.count.mockResolvedValue(1);

      const result = await service.getAlerts({ page: 1, limit: 10, status: 'resolved' });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by severity', async () => {
      mockPrismaService.devAlert.findMany.mockResolvedValue([]);
      mockPrismaService.devAlert.count.mockResolvedValue(0);

      await service.getAlerts({ page: 1, limit: 10, severity: 5 });

      expect(mockPrismaService.devAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: 5 }),
        }),
      );
    });
  });

  describe('createAlert', () => {
    it('should create an alert', async () => {
      const alertData = {
        alertType: 'error',
        source: 'PaymentService',
        title: 'Payment Failed',
        message: 'Payment processing failed for order 123',
        severity: 4,
      };

      const createdAlert = {
        id: 'alert-123',
        ...alertData,
        status: 'active',
        createdAt: new Date(),
      };

      mockPrismaService.devAlert.create.mockResolvedValue(createdAlert);

      const result = await service.createAlert(alertData);

      expect(result.id).toBe('alert-123');
      expect(result.alertType).toBe('error');
      expect(result.status).toBe('active');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      const alertId = 'alert-123';
      const userId = 'user-456';

      const updatedAlert = {
        id: alertId,
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      };

      mockPrismaService.devAlert.update.mockResolvedValue(updatedAlert);

      const result = await service.acknowledgeAlert(alertId, userId);

      expect(result.status).toBe('acknowledged');
      expect(result.acknowledgedBy).toBe(userId);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const alertId = 'alert-123';
      const userId = 'user-456';
      const resolution = 'Fixed the payment gateway configuration';

      const updatedAlert = {
        id: alertId,
        status: 'resolved',
        resolvedBy: userId,
        resolution,
        resolvedAt: new Date(),
      };

      mockPrismaService.devAlert.update.mockResolvedValue(updatedAlert);

      const result = await service.resolveAlert(alertId, userId, resolution);

      expect(result.status).toBe('resolved');
      expect(result.resolution).toBe(resolution);
    });
  });

  describe('getMetricHistory', () => {
    it('should return metric history', async () => {
      const metrics = [
        { timestamp: new Date(), value: 100 },
        { timestamp: new Date(), value: 150 },
        { timestamp: new Date(), value: 120 },
      ];

      mockPrismaService.devMetric.findMany.mockResolvedValue(metrics);

      const result = await service.getMetricHistory('cpu_usage', 24);

      expect(result).toHaveLength(3);
    });

    it('should filter by time range', async () => {
      mockPrismaService.devMetric.findMany.mockResolvedValue([]);

      await service.getMetricHistory('memory_usage', 12);

      expect(mockPrismaService.devMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: 'memory_usage',
            timestamp: expect.any(Object),
          }),
        }),
      );
    });
  });
});
