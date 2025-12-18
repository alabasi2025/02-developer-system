import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    devIntegration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an integration', async () => {
      const integrationData = {
        name: 'Test Integration',
        type: 'external',
        baseUrl: 'https://api.example.com',
      };

      const createdIntegration = {
        id: 'integration-123',
        ...integrationData,
        status: 'active',
        createdAt: new Date(),
      };

      mockPrismaService.devIntegration.create.mockResolvedValue(createdIntegration);

      const result = await service.create(integrationData);

      expect(result.id).toBe('integration-123');
      expect(result.name).toBe('Test Integration');
      expect(mockPrismaService.devIntegration.create).toHaveBeenCalled();
    });

    it('should create integration with config', async () => {
      const integrationData = {
        name: 'Payment Gateway',
        type: 'payment',
        baseUrl: 'https://pay.example.com',
        config: { apiVersion: 'v2', timeout: 30000 },
      };

      const createdIntegration = {
        id: 'integration-456',
        ...integrationData,
        status: 'active',
        createdAt: new Date(),
      };

      mockPrismaService.devIntegration.create.mockResolvedValue(createdIntegration);

      const result = await service.create(integrationData);

      expect(result.config).toEqual({ apiVersion: 'v2', timeout: 30000 });
    });
  });

  describe('findAll', () => {
    it('should return paginated integrations', async () => {
      const integrations = [
        { id: 'int-1', name: 'Integration 1', type: 'external' },
        { id: 'int-2', name: 'Integration 2', type: 'internal' },
      ];

      mockPrismaService.devIntegration.findMany.mockResolvedValue(integrations);
      mockPrismaService.devIntegration.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by type', async () => {
      const integrations = [
        { id: 'int-1', name: 'Integration 1', type: 'payment' },
      ];

      mockPrismaService.devIntegration.findMany.mockResolvedValue(integrations);
      mockPrismaService.devIntegration.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10, type: 'payment' });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.devIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'payment' }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.devIntegration.findMany.mockResolvedValue([]);
      mockPrismaService.devIntegration.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: 'active' });

      expect(mockPrismaService.devIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return integration by id', async () => {
      const integration = {
        id: 'integration-123',
        name: 'Test Integration',
        type: 'external',
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(integration);

      const result = await service.findOne('integration-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('integration-123');
    });

    it('should return null for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an integration', async () => {
      const updateData = {
        name: 'Updated Integration',
        status: 'inactive',
      };

      const updatedIntegration = {
        id: 'integration-123',
        ...updateData,
        type: 'external',
      };

      mockPrismaService.devIntegration.update.mockResolvedValue(updatedIntegration);

      const result = await service.update('integration-123', updateData);

      expect(result.name).toBe('Updated Integration');
      expect(result.status).toBe('inactive');
    });
  });

  describe('remove', () => {
    it('should delete an integration', async () => {
      mockPrismaService.devIntegration.delete.mockResolvedValue({ id: 'integration-123' });

      await service.remove('integration-123');

      expect(mockPrismaService.devIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'integration-123' },
      });
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status for valid integration', async () => {
      const integration = {
        id: 'integration-123',
        name: 'Test Integration',
        baseUrl: 'https://api.example.com',
        healthEndpoint: '/health',
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(integration);
      mockPrismaService.devIntegration.update.mockResolvedValue({
        ...integration,
        lastHealthStatus: 'healthy',
        lastHealthCheck: new Date(),
      });

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.checkHealth('integration-123');

      expect(result.status).toBe('healthy');
    });

    it('should return unhealthy status when health check fails', async () => {
      const integration = {
        id: 'integration-123',
        name: 'Test Integration',
        baseUrl: 'https://api.example.com',
        healthEndpoint: '/health',
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(integration);
      mockPrismaService.devIntegration.update.mockResolvedValue({
        ...integration,
        lastHealthStatus: 'unhealthy',
        lastHealthCheck: new Date(),
      });

      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await service.checkHealth('integration-123');

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('getStats', () => {
    it('should return integration statistics', async () => {
      mockPrismaService.devIntegration.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8)  // active
        .mockResolvedValueOnce(2); // inactive

      const result = await service.getStats();

      expect(result.total).toBe(10);
      expect(result.active).toBe(8);
      expect(result.inactive).toBe(2);
    });
  });
});
