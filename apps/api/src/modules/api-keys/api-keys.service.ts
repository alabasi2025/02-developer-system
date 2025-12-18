import { Injectable, NotFoundException, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyQueryDto, ValidateApiKeyResponseDto } from './dto/api-key.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateApiKey(): { key: string; prefix: string; hash: string } {
    // Generate a secure random API key
    const key = `dev_${randomBytes(32).toString('hex')}`;
    const prefix = key.substring(0, 12);
    const hash = createHash('sha256').update(key).digest('hex');
    return { key, prefix, hash };
  }

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async create(createDto: CreateApiKeyDto, userId?: string) {
    this.logger.log(`Creating API key for system: ${createDto.systemId}`);

    const { key, prefix, hash } = this.generateApiKey();

    const apiKey = await this.prisma.devApiKey.create({
      data: {
        integrationId: createDto.integrationId,
        systemId: createDto.systemId,
        name: createDto.name,
        keyHash: hash,
        keyPrefix: prefix,
        permissions: createDto.permissions,
        rateLimit: createDto.rateLimit || 1000,
        expiresAt: createDto.expiresAt ? new Date(createDto.expiresAt) : null,
        ipWhitelist: createDto.ipWhitelist || [],
        createdBy: userId,
      },
    });

    // Log the action
    await this.logAction('create', 'api_key', apiKey.id, userId);

    // Return the key only once
    return {
      ...this.sanitizeApiKey(apiKey),
      key, // Only returned on creation
    };
  }

  async findAll(query: ApiKeyQueryDto) {
    const { systemId, integrationId, isActive, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (systemId) where.systemId = systemId;
    if (integrationId) where.integrationId = integrationId;
    if (isActive !== undefined) where.isActive = isActive;

    const [apiKeys, total] = await Promise.all([
      this.prisma.devApiKey.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          integration: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      this.prisma.devApiKey.count({ where }),
    ]);

    return {
      data: apiKeys.map(k => this.sanitizeApiKey(k)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const apiKey = await this.prisma.devApiKey.findUnique({
      where: { id },
      include: {
        integration: {
          select: { id: true, name: true, type: true, baseUrl: true },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException(`مفتاح API غير موجود: ${id}`);
    }

    return this.sanitizeApiKey(apiKey);
  }

  async update(id: string, updateDto: UpdateApiKeyDto, userId?: string) {
    const existing = await this.prisma.devApiKey.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`مفتاح API غير موجود: ${id}`);
    }

    const updated = await this.prisma.devApiKey.update({
      where: { id },
      data: {
        name: updateDto.name,
        permissions: updateDto.permissions,
        rateLimit: updateDto.rateLimit,
        expiresAt: updateDto.expiresAt ? new Date(updateDto.expiresAt) : undefined,
        ipWhitelist: updateDto.ipWhitelist,
        isActive: updateDto.isActive,
      },
    });

    await this.logAction('update', 'api_key', id, userId);

    return this.sanitizeApiKey(updated);
  }

  async remove(id: string, userId?: string) {
    const existing = await this.prisma.devApiKey.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`مفتاح API غير موجود: ${id}`);
    }

    // Soft delete by revoking
    await this.prisma.devApiKey.update({
      where: { id },
      data: {
        isActive: false,
        revokedBy: userId,
        revokedAt: new Date(),
      },
    });

    await this.logAction('delete', 'api_key', id, userId);

    return { message: 'تم إلغاء مفتاح API بنجاح', id };
  }

  async rotate(id: string, userId?: string) {
    const existing = await this.prisma.devApiKey.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`مفتاح API غير موجود: ${id}`);
    }

    if (!existing.isActive) {
      throw new BadRequestException('لا يمكن تدوير مفتاح غير نشط');
    }

    const { key, prefix, hash } = this.generateApiKey();

    await this.prisma.devApiKey.update({
      where: { id },
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        usageCount: 0,
        lastUsedAt: null,
      },
    });

    await this.logAction('rotate', 'api_key', id, userId);

    return {
      id,
      newKey: key,
      keyPrefix: prefix,
      message: 'تم تدوير مفتاح API بنجاح',
    };
  }

  async validate(apiKey: string, requiredPermission?: string): Promise<ValidateApiKeyResponseDto> {
    const hash = this.hashApiKey(apiKey);

    const key = await this.prisma.devApiKey.findFirst({
      where: {
        keyHash: hash,
        isActive: true,
      },
    });

    if (!key) {
      return { valid: false, error: 'مفتاح API غير صالح' };
    }

    // Check expiration
    if (key.expiresAt && new Date() > key.expiresAt) {
      return { valid: false, error: 'مفتاح API منتهي الصلاحية' };
    }

    // Check permission
    const permissions = key.permissions as string[];
    if (requiredPermission && !permissions.includes(requiredPermission) && !permissions.includes('*')) {
      return { valid: false, error: 'صلاحية غير كافية' };
    }

    // Update usage stats
    await this.prisma.devApiKey.update({
      where: { id: key.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return {
      valid: true,
      systemId: key.systemId,
      permissions,
    };
  }

  async validateByKey(apiKey: string, sourceIp?: string): Promise<{ valid: boolean; apiKeyId?: string; systemId?: string; error?: string }> {
    const hash = this.hashApiKey(apiKey);

    const key = await this.prisma.devApiKey.findFirst({
      where: {
        keyHash: hash,
        isActive: true,
      },
    });

    if (!key) {
      return { valid: false, error: 'مفتاح API غير صالح' };
    }

    // Check expiration
    if (key.expiresAt && new Date() > key.expiresAt) {
      return { valid: false, error: 'مفتاح API منتهي الصلاحية' };
    }

    // Check IP whitelist
    if (key.ipWhitelist.length > 0 && sourceIp && !key.ipWhitelist.includes(sourceIp)) {
      return { valid: false, error: 'عنوان IP غير مسموح به' };
    }

    // Update usage stats
    await this.prisma.devApiKey.update({
      where: { id: key.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });

    return {
      valid: true,
      apiKeyId: key.id,
      systemId: key.systemId,
    };
  }

  private sanitizeApiKey(apiKey: any) {
    const { keyHash, ...safe } = apiKey;
    return safe;
  }

  private async logAction(action: string, entityType: string, entityId: string, userId?: string) {
    try {
      await this.prisma.devAuditLog.create({
        data: {
          action,
          entityType,
          entityId,
          userId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log action: ${error}`);
    }
  }
}
