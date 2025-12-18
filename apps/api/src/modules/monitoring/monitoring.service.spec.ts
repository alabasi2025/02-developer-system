import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    devRequestLog: {
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    devAuditLog: {
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
    devSystemMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    devIntegration: {
      count: jest.fn(),
    },
    devApiKey: {
      count: jest.fn(),
    },
    devEvent: {
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return healthy status when database is connected', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.services).toBeDefined();
      expect(result.services.database.status).toBe('healthy');
    });

    it('should return degraded status when database is disconnected', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('unhealthy');
    });
  });

  describe('getMetrics', () => {
    it('should return system metrics', async () => {
      mockPrismaService.devRequestLog.count.mockResolvedValue(100);
      mockPrismaService.devRequestLog.aggregate.mockResolvedValue({ _avg: { responseTime: 150 } });
      mockPrismaService.devRequestLog.groupBy.mockResolvedValue([]);
      mockPrismaService.devIntegration.count.mockResolvedValue(10);
      mockPrismaService.devApiKey.count.mockResolvedValue(5);
      mockPrismaService.devEvent.count.mockResolvedValue(50);

      const result = await service.getMetrics();

      expect(result).toBeDefined();
      expect(result.requests).toBeDefined();
      expect(result.integrations).toBeDefined();
      expect(result.system).toBeDefined();
    });

    it('should include memory usage', async () => {
      mockPrismaService.devRequestLog.count.mockResolvedValue(0);
      mockPrismaService.devRequestLog.aggregate.mockResolvedValue({ _avg: { responseTime: null } });
      mockPrismaService.devRequestLog.groupBy.mockResolvedValue([]);
      mockPrismaService.devIntegration.count.mockResolvedValue(0);
      mockPrismaService.devApiKey.count.mockResolvedValue(0);
      mockPrismaService.devEvent.count.mockResolvedValue(0);

      const result = await service.getMetrics();

      expect(result.system.memory).toBeDefined();
    });
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      const logs = [
        { id: 'log-1', action: 'create', entityType: 'integration' },
        { id: 'log-2', action: 'update', entityType: 'integration' },
      ];

      mockPrismaService.devAuditLog.findMany.mockResolvedValue(logs);
      mockPrismaService.devAuditLog.count.mockResolvedValue(2);

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by source', async () => {
      mockPrismaService.devAuditLog.findMany.mockResolvedValue([]);
      mockPrismaService.devAuditLog.count.mockResolvedValue(0);

      await service.getLogs({ page: 1, limit: 10, source: 'PaymentService' });

      expect(mockPrismaService.devAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ systemId: 'PaymentService' }),
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
      expect(result.meta.total).toBe(2);
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
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      const alertId = 'alert-123';
      const userId = 'user-456';

      mockPrismaService.devAlert.findUnique.mockResolvedValue({ id: alertId });
      mockPrismaService.devAlert.update.mockResolvedValue({
        id: alertId,
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      });

      const result = await service.acknowledgeAlert(alertId, userId);

      expect(result.status).toBe('acknowledged');
    });

    it('should throw NotFoundException for non-existent alert', async () => {
      mockPrismaService.devAlert.findUnique.mockResolvedValue(null);

      await expect(service.acknowledgeAlert('non-existent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const alertId = 'alert-123';
      const userId = 'user-456';
      const resolution = 'Fixed the payment gateway configuration';

      mockPrismaService.devAlert.findUnique.mockResolvedValue({ id: alertId });
      mockPrismaService.devAlert.update.mockResolvedValue({
        id: alertId,
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      });

      const result = await service.resolveAlert(alertId, userId, resolution);

      expect(result.status).toBe('resolved');
      expect(result.resolution).toBe(resolution);
    });

    it('should throw NotFoundException for non-existent alert', async () => {
      mockPrismaService.devAlert.findUnique.mockResolvedValue(null);

      await expect(service.resolveAlert('non-existent', 'user-1', 'resolution')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMetricHistory', () => {
    it('should return metric history', async () => {
      const metrics = [
        { timestamp: new Date(), value: 100 },
        { timestamp: new Date(), value: 150 },
        { timestamp: new Date(), value: 120 },
      ];

      mockPrismaService.devSystemMetric.findMany.mockResolvedValue(metrics);

      const result = await service.getMetricHistory('cpu_usage', 24);

      expect(result).toHaveLength(3);
    });

    it('should filter by time range', async () => {
      mockPrismaService.devSystemMetric.findMany.mockResolvedValue([]);

      await service.getMetricHistory('memory_usage', 12);

      expect(mockPrismaService.devSystemMetric.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            metricName: 'memory_usage',
            timestamp: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('recordMetric', () => {
    it('should record a metric', async () => {
      const metricData = {
        metricName: 'api_response_time',
        metricType: 'gauge',
        value: 150,
      };

      mockPrismaService.devSystemMetric.create.mockResolvedValue({
        id: 'metric-123',
        ...metricData,
        timestamp: new Date(),
      });

      const result = await service.recordMetric(metricData);

      expect(result.metricName).toBe('api_response_time');
      expect(result.value).toBe(150);
    });
  });
});
