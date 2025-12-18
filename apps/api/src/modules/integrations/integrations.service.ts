import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreateIntegrationDto, 
  UpdateIntegrationDto, 
  IntegrationQueryDto,
  TestIntegrationResponseDto 
} from './dto/integration.dto';
import axios from 'axios';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateIntegrationDto, userId?: string) {
    this.logger.log(`Creating integration: ${createDto.name}`);
    
    const integration = await this.prisma.devIntegration.create({
      data: {
        name: createDto.name,
        nameAr: createDto.nameAr,
        type: createDto.type,
        baseUrl: createDto.baseUrl,
        status: createDto.status || 'active',
        config: createDto.config || {},
        credentials: createDto.credentials || {},
        healthEndpoint: createDto.healthEndpoint,
        retryCount: createDto.retryCount || 3,
        timeout: createDto.timeout || 30000,
        description: createDto.description,
        createdBy: userId,
      },
    });

    // Log the action
    await this.logAction('create', 'integration', integration.id, userId, null, integration);

    return this.sanitizeIntegration(integration);
  }

  async findAll(query: IntegrationQueryDto) {
    const { type, status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [integrations, total] = await Promise.all([
      this.prisma.devIntegration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devIntegration.count({ where }),
    ]);

    return {
      data: integrations.map(i => this.sanitizeIntegration(i)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const integration = await this.prisma.devIntegration.findUnique({
      where: { id },
      include: {
        apiKeys: {
          where: { isActive: true },
          select: { id: true, name: true, systemId: true, keyPrefix: true, createdAt: true },
        },
        webhooks: {
          where: { isActive: true },
          select: { id: true, name: true, url: true, events: true },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException(`التكامل غير موجود: ${id}`);
    }

    return this.sanitizeIntegration(integration);
  }

  async update(id: string, updateDto: UpdateIntegrationDto, userId?: string) {
    const existing = await this.prisma.devIntegration.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`التكامل غير موجود: ${id}`);
    }

    const updated = await this.prisma.devIntegration.update({
      where: { id },
      data: {
        ...updateDto,
        updatedBy: userId,
      },
    });

    // Log the action
    await this.logAction('update', 'integration', id, userId, existing, updated);

    return this.sanitizeIntegration(updated);
  }

  async remove(id: string, userId?: string) {
    const existing = await this.prisma.devIntegration.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`التكامل غير موجود: ${id}`);
    }

    // Soft delete by setting status to inactive
    const deleted = await this.prisma.devIntegration.update({
      where: { id },
      data: { 
        status: 'inactive',
        updatedBy: userId,
      },
    });

    // Log the action
    await this.logAction('delete', 'integration', id, userId, existing, deleted);

    return { message: 'تم حذف التكامل بنجاح', id };
  }

  async testConnection(id: string): Promise<TestIntegrationResponseDto> {
    const integration = await this.prisma.devIntegration.findUnique({ where: { id } });
    
    if (!integration) {
      throw new NotFoundException(`التكامل غير موجود: ${id}`);
    }

    if (!integration.baseUrl) {
      throw new BadRequestException('لم يتم تحديد رابط API للتكامل');
    }

    const startTime = Date.now();
    const endpoint = integration.healthEndpoint || '/health';
    const url = `${integration.baseUrl}${endpoint}`;

    try {
      const response = await axios.get(url, {
        timeout: integration.timeout,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;

      // Update health check status
      await this.prisma.devIntegration.update({
        where: { id },
        data: {
          lastHealthCheck: new Date(),
          lastHealthStatus: response.status < 400 ? 'healthy' : 'unhealthy',
        },
      });

      return {
        success: response.status < 400,
        responseTime,
        details: {
          statusCode: response.status,
          url,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Update health check status
      await this.prisma.devIntegration.update({
        where: { id },
        data: {
          lastHealthCheck: new Date(),
          lastHealthStatus: 'error',
        },
      });

      return {
        success: false,
        responseTime,
        errorMessage: error.message,
        details: {
          url,
          error: error.code || 'UNKNOWN_ERROR',
        },
      };
    }
  }

  private sanitizeIntegration(integration: any) {
    // Remove sensitive data
    const { credentials, ...safe } = integration;
    return safe;
  }

  private async logAction(
    action: string,
    entityType: string,
    entityId: string,
    userId?: string,
    oldValues?: any,
    newValues?: any,
  ) {
    try {
      await this.prisma.devAuditLog.create({
        data: {
          action,
          entityType,
          entityId,
          userId,
          oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
          newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log action: ${error}`);
    }
  }
}
