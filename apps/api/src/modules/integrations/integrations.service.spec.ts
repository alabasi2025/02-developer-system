import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IntegrationType, IntegrationStatus } from './dto/integration.dto';

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an integration', async () => {
      const integrationData = {
        name: 'Test Integration',
        type: IntegrationType.EXTERNAL,
        baseUrl: 'https://api.example.com',
      };

      const createdIntegration = {
        id: 'integration-123',
        ...integrationData,
        status: IntegrationStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockPrismaService.devIntegration.create.mockResolvedValue(createdIntegration);
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.create(integrationData);

      expect(result.id).toBe('integration-123');
      expect(result.name).toBe('Test Integration');
      expect(mockPrismaService.devIntegration.create).toHaveBeenCalled();
    });

    it('should create integration with config', async () => {
      const integrationData = {
        name: 'Payment Gateway',
        type: IntegrationType.PAYMENT,
        baseUrl: 'https://pay.example.com',
        config: { apiVersion: 'v2', timeout: 30000 },
      };

      const createdIntegration = {
        id: 'integration-456',
        ...integrationData,
        status: IntegrationStatus.ACTIVE,
        createdAt: new Date(),
      };

      mockPrismaService.devIntegration.create.mockResolvedValue(createdIntegration);
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.create(integrationData);

      expect(result.config).toEqual({ apiVersion: 'v2', timeout: 30000 });
    });
  });

  describe('findAll', () => {
    it('should return paginated integrations', async () => {
      const integrations = [
        { id: 'int-1', name: 'Integration 1', type: IntegrationType.EXTERNAL },
        { id: 'int-2', name: 'Integration 2', type: IntegrationType.INTERNAL },
      ];

      mockPrismaService.devIntegration.findMany.mockResolvedValue(integrations);
      mockPrismaService.devIntegration.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by type', async () => {
      const integrations = [
        { id: 'int-1', name: 'Integration 1', type: IntegrationType.PAYMENT },
      ];

      mockPrismaService.devIntegration.findMany.mockResolvedValue(integrations);
      mockPrismaService.devIntegration.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10, type: IntegrationType.PAYMENT });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.devIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: IntegrationType.PAYMENT }),
        }),
      );
    });

    it('should filter by status', async () => {
      mockPrismaService.devIntegration.findMany.mockResolvedValue([]);
      mockPrismaService.devIntegration.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: IntegrationStatus.ACTIVE });

      expect(mockPrismaService.devIntegration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: IntegrationStatus.ACTIVE }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return integration by id', async () => {
      const integration = {
        id: 'integration-123',
        name: 'Test Integration',
        type: IntegrationType.EXTERNAL,
        apiKeys: [],
        webhooks: [],
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(integration);

      const result = await service.findOne('integration-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('integration-123');
    });

    it('should throw NotFoundException for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an integration', async () => {
      const updateData = {
        name: 'Updated Integration',
        status: IntegrationStatus.INACTIVE,
      };

      const existingIntegration = {
        id: 'integration-123',
        name: 'Old Name',
        type: IntegrationType.EXTERNAL,
      };

      const updatedIntegration = {
        id: 'integration-123',
        ...updateData,
        type: IntegrationType.EXTERNAL,
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(existingIntegration);
      mockPrismaService.devIntegration.update.mockResolvedValue(updatedIntegration);
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.update('integration-123', updateData);

      expect(result.name).toBe('Updated Integration');
      expect(result.status).toBe(IntegrationStatus.INACTIVE);
    });

    it('should throw NotFoundException for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete an integration', async () => {
      const existingIntegration = {
        id: 'integration-123',
        name: 'Test Integration',
        status: IntegrationStatus.ACTIVE,
      };

      mockPrismaService.devIntegration.findUnique.mockResolvedValue(existingIntegration);
      mockPrismaService.devIntegration.update.mockResolvedValue({
        ...existingIntegration,
        status: IntegrationStatus.INACTIVE,
      });
      mockPrismaService.devAuditLog.create.mockResolvedValue({});

      const result = await service.remove('integration-123');

      expect(result.message).toBe('تم حذف التكامل بنجاح');
      expect(mockPrismaService.devIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'integration-123' },
          data: expect.objectContaining({ status: 'inactive' }),
        }),
      );
    });

    it('should throw NotFoundException for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('testConnection', () => {
    it('should throw NotFoundException for non-existent integration', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue(null);

      await expect(service.testConnection('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when baseUrl is not set', async () => {
      mockPrismaService.devIntegration.findUnique.mockResolvedValue({
        id: 'integration-123',
        name: 'Test',
        baseUrl: null,
      });

      await expect(service.testConnection('integration-123')).rejects.toThrow(BadRequestException);
    });
  });
});
