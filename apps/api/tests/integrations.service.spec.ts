import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from '../src/modules/integrations/integrations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { IntegrationType } from '../src/modules/integrations/dto/integration.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    devIntegration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    devAuditLog: {
      create: jest.fn(),
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

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an integration', async () => {
      const createDto = {
        name: 'Test Integration',
        type: IntegrationType.INTERNAL,
        baseUrl: 'https://api.example.com',
      };

      const mockIntegration = {
        id: 'int-123',
        ...createDto,
        status: 'active',
        credentials: {},
        config: {},
        createdAt: new Date(),
      };

      mockPrismaService.devIntegration.create.mockResolvedValue(mockIntegration);
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.create(createDto);

      expect(result.id).toBe('int-123');
      expect(result.name).toBe('Test Integration');
      expect(result.credentials).toBeUndefined(); // Should be sanitized
    });
  });

  describe('findAll', () => {
    it('should return paginated integrations', async () => {
      const mockIntegrations = [
        { id: 'int-1', name: 'Integration 1', type: 'internal', credentials: {} },
        { id: 'int-2', name: 'Integration 2', type: 'external', credentials: {} },
      ];

      mockPrismaService.devIntegration.findMany.mockResolvedValue(mockIntegrations);
      mockPrismaService.devIntegration.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by type', async () => {
      mockPrismaService.devIntegration.findMany.mockResolvedValue([]);
      mockPrismaService.devIntegration.count.mockResolvedValue(0);

      await service.findAll({ type: IntegrationType.INTERNAL, page: 1, limit: 10 });

      expect(mockPrismaService.devIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'internal' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single integration', async () => {
      const mockIntegration = {
        id: 'int-123',
        name: 'Test Integration',
        type: 'internal',
        credentials: {},
        apiKeys: [],
        webhooks: [],
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(mockIntegration);

      const result = await service.findOne('int-123');

      expect(result.id).toBe('int-123');
      expect(result.name).toBe('Test Integration');
    });

    it('should throw error for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an integration', async () => {
      const mockIntegration = {
        id: 'int-123',
        name: 'Updated Integration',
        type: 'internal',
        credentials: {},
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue({ id: 'int-123' });
      mockPrismaService.devIntegration.update.mockResolvedValue(mockIntegration);
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.update('int-123', { name: 'Updated Integration' });

      expect(result.name).toBe('Updated Integration');
    });

    it('should throw error for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete an integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue({ id: 'int-123' });
      mockPrismaService.devIntegration.update.mockResolvedValue({
        id: 'int-123',
        status: 'inactive',
      });
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.remove('int-123');

      expect(result.message).toContain('تم حذف');
    });

    it('should throw error for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('testConnection', () => {
    it('should throw error for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.testConnection('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw error for integration without baseUrl', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        name: 'Test',
        baseUrl: null,
      });

      await expect(service.testConnection('int-123')).rejects.toThrow(BadRequestException);
    });

    it('should return test result for valid integration', async () => {
      const mockIntegration = {
        id: 'int-123',
        name: 'Test Integration',
        baseUrl: 'https://api.example.com',
        healthEndpoint: '/health',
        timeout: 5000,
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockPrismaService.devIntegration.update.mockResolvedValue(mockIntegration);

      // Note: In real tests, you'd mock axios
      const result = await service.testConnection('int-123');

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });
});
