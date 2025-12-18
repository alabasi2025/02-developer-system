import { Test, TestingModule } from '@nestjs/testing';
import { MonitoringService } from '../src/modules/monitoring/monitoring.service';
import { PrismaService } from '../src/prisma/prisma.service';
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
      findMany: jest.fn(),
      create: jest.fn(),
    },
    devAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    devEvent: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    devIntegration: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    devApiKey: {
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

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return healthy status when database is connected', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getHealth();

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('healthy');
      expect(result.services.api.status).toBe('healthy');
    });

    it('should return degraded status when database is down', async () => {
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
      mockPrismaService.devEvent.count.mockResolvedValue(50);
      mockPrismaService.devIntegration.count.mockResolvedValue(5);
      mockPrismaService.devApiKey.count.mockResolvedValue(10);

      const result = await service.getMetrics();

      expect(result).toBeDefined();
      expect(result.requests).toBeDefined();
      expect(result.events).toBeDefined();
    });
  });

  describe('getLogs', () => {
    it('should return paginated logs', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'create', systemId: 'api', createdAt: new Date() },
        { id: 'log-2', action: 'update', systemId: 'api', createdAt: new Date() },
      ];

      mockPrismaService.devAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.devAuditLog.count.mockResolvedValue(2);

      const result = await service.getLogs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter logs by source', async () => {
      mockPrismaService.devAuditLog.findMany.mockResolvedValue([]);
      mockPrismaService.devAuditLog.count.mockResolvedValue(0);

      await service.getLogs({ source: 'api', page: 1, limit: 10 });

      expect(mockPrismaService.devAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ systemId: 'api' }),
        }),
      );
    });
  });

  describe('getAlerts', () => {
    it('should return paginated alerts', async () => {
      const mockAlerts = [
        { id: 'alert-1', alertType: 'error', severity: 1, status: 'active' },
        { id: 'alert-2', alertType: 'warning', severity: 2, status: 'active' },
      ];

      mockPrismaService.devAlert.findMany.mockResolvedValue(mockAlerts);
      mockPrismaService.devAlert.count.mockResolvedValue(2);

      const result = await service.getAlerts({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter alerts by status', async () => {
      mockPrismaService.devAlert.findMany.mockResolvedValue([]);
      mockPrismaService.devAlert.count.mockResolvedValue(0);

      await service.getAlerts({ status: 'active', page: 1, limit: 10 });

      expect(mockPrismaService.devAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });
  });

  describe('createAlert', () => {
    it('should create an alert', async () => {
      const alertData = {
        alertType: 'error',
        source: 'api',
        title: 'Test Alert',
        message: 'This is a test alert',
        severity: 2,
      };

      const mockAlert = {
        id: 'alert-123',
        ...alertData,
        status: 'active',
        createdAt: new Date(),
      };

      mockPrismaService.devAlert.create.mockResolvedValue(mockAlert);

      const result = await service.createAlert(alertData);

      expect(result.id).toBe('alert-123');
      expect(result.alertType).toBe('error');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      const mockAlert = {
        id: 'alert-123',
        status: 'active',
      };

      mockPrismaService.devAlert.findUnique.mockResolvedValue(mockAlert);
      mockPrismaService.devAlert.update.mockResolvedValue({
        ...mockAlert,
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      });

      const result = await service.acknowledgeAlert('alert-123', 'user-123');

      expect(result.status).toBe('acknowledged');
    });

    it('should throw error for non-existent alert', async () => {
      mockPrismaService.devAlert.findUnique.mockResolvedValue(null);

      await expect(service.acknowledgeAlert('non-existent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert', async () => {
      const mockAlert = {
        id: 'alert-123',
        status: 'acknowledged',
      };

      mockPrismaService.devAlert.findUnique.mockResolvedValue(mockAlert);
      mockPrismaService.devAlert.update.mockResolvedValue({
        ...mockAlert,
        status: 'resolved',
        resolvedAt: new Date(),
        resolution: 'Fixed the issue',
      });

      const result = await service.resolveAlert('alert-123', 'user-123', 'Fixed the issue');

      expect(result.status).toBe('resolved');
    });

    it('should throw error for non-existent alert', async () => {
      mockPrismaService.devAlert.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveAlert('non-existent', 'user-123', 'Resolution'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordMetric', () => {
    it('should record a system metric', async () => {
      const metricData = {
        metricName: 'cpu_usage',
        metricType: 'gauge',
        value: 45.5,
        systemId: 'api',
      };

      const mockMetric = {
        id: 'metric-123',
        ...metricData,
        createdAt: new Date(),
      };

      mockPrismaService.devSystemMetric.create.mockResolvedValue(mockMetric);

      const result = await service.recordMetric(metricData);

      expect(result.id).toBe('metric-123');
      expect(result.metricName).toBe('cpu_usage');
    });
  });
});
