import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import axios from 'axios';

export interface MessageProviderConfig {
  name: string;
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  provider: string;
  apiUrl: string;
  credentials: Record<string, any>;
  config?: Record<string, any>;
  isDefault?: boolean;
}

export interface SendMessageDto {
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  providerId?: string;
  to: string | string[];
  subject?: string;
  body: string;
  template?: string;
  templateData?: Record<string, any>;
  metadata?: Record<string, any>;
  scheduledFor?: string;
  priority?: number;
}

export interface BulkMessageDto {
  type: 'sms' | 'email' | 'push' | 'whatsapp';
  providerId?: string;
  recipients: Array<{
    to: string;
    data?: Record<string, any>;
  }>;
  subject?: string;
  template: string;
  defaultData?: Record<string, any>;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  // ==================== Provider Management ====================

  async createProvider(data: MessageProviderConfig) {
    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      await this.prisma.devMessageProvider.updateMany({
        where: { type: data.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await this.prisma.devMessageProvider.create({
      data: {
        name: data.name,
        type: data.type,
        provider: data.provider,
        apiUrl: data.apiUrl,
        credentials: data.credentials,
        config: data.config || {},
        isDefault: data.isDefault || false,
        isActive: true,
      },
    });

    return this.sanitizeProvider(provider);
  }

  async findAllProviders(query: { type?: string; isActive?: boolean }) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const providers = await this.prisma.devMessageProvider.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return providers.map(p => this.sanitizeProvider(p));
  }

  async findOneProvider(id: string) {
    const provider = await this.prisma.devMessageProvider.findUnique({ where: { id } });
    
    if (!provider) {
      throw new NotFoundException(`مزود الرسائل غير موجود: ${id}`);
    }

    return this.sanitizeProvider(provider);
  }

  async updateProvider(id: string, data: Partial<MessageProviderConfig>) {
    const existing = await this.prisma.devMessageProvider.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`مزود الرسائل غير موجود: ${id}`);
    }

    if (data.isDefault) {
      await this.prisma.devMessageProvider.updateMany({
        where: { type: existing.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.devMessageProvider.update({
      where: { id },
      data: {
        name: data.name,
        apiUrl: data.apiUrl,
        credentials: data.credentials,
        config: data.config,
        isDefault: data.isDefault,
      },
    });

    return this.sanitizeProvider(updated);
  }

  async deleteProvider(id: string) {
    const existing = await this.prisma.devMessageProvider.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`مزود الرسائل غير موجود: ${id}`);
    }

    await this.prisma.devMessageProvider.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'تم تعطيل مزود الرسائل بنجاح', id };
  }

  // ==================== Message Sending ====================

  async sendMessage(dto: SendMessageDto) {
    // Get provider
    let provider;
    if (dto.providerId) {
      provider = await this.prisma.devMessageProvider.findUnique({
        where: { id: dto.providerId },
      });
    } else {
      provider = await this.prisma.devMessageProvider.findFirst({
        where: { type: dto.type, isDefault: true, isActive: true },
      });
    }

    if (!provider) {
      throw new BadRequestException(`لا يوجد مزود رسائل متاح للنوع: ${dto.type}`);
    }

    // Prepare recipients
    const recipients = Array.isArray(dto.to) ? dto.to : [dto.to];

    // Process template if provided
    let body = dto.body;
    if (dto.template) {
      body = await this.processTemplate(dto.template, dto.templateData || {});
    }

    // Create message records
    const messages = await Promise.all(
      recipients.map(async (recipient) => {
        return this.prisma.devMessage.create({
          data: {
            providerId: provider.id,
            type: dto.type,
            recipient,
            subject: dto.subject,
            body,
            template: dto.template,
            templateData: dto.templateData || {},
            metadata: dto.metadata || {},
            status: dto.scheduledFor ? 'scheduled' : 'pending',
            scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
            priority: dto.priority || 5,
          },
        });
      }),
    );

    // Send immediately if not scheduled
    if (!dto.scheduledFor) {
      for (const message of messages) {
        await this.processMessage(message.id);
      }
    }

    return {
      messageIds: messages.map(m => m.id),
      status: dto.scheduledFor ? 'scheduled' : 'processing',
      recipientCount: recipients.length,
    };
  }

  async sendBulkMessages(dto: BulkMessageDto) {
    // Get provider
    let provider;
    if (dto.providerId) {
      provider = await this.prisma.devMessageProvider.findUnique({
        where: { id: dto.providerId },
      });
    } else {
      provider = await this.prisma.devMessageProvider.findFirst({
        where: { type: dto.type, isDefault: true, isActive: true },
      });
    }

    if (!provider) {
      throw new BadRequestException(`لا يوجد مزود رسائل متاح للنوع: ${dto.type}`);
    }

    // Create message records for each recipient
    const messages = await Promise.all(
      dto.recipients.map(async (recipient) => {
        const templateData = { ...dto.defaultData, ...recipient.data };
        const body = await this.processTemplate(dto.template, templateData);

        return this.prisma.devMessage.create({
          data: {
            providerId: provider.id,
            type: dto.type,
            recipient: recipient.to,
            subject: dto.subject,
            body,
            template: dto.template,
            templateData,
            status: 'pending',
            priority: 5,
          },
        });
      }),
    );

    // Process messages in batches
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      await Promise.all(batch.map(m => this.processMessage(m.id)));
    }

    return {
      totalMessages: messages.length,
      status: 'processing',
    };
  }

  private async processMessage(messageId: string) {
    const message = await this.prisma.devMessage.findUnique({
      where: { id: messageId },
      include: { provider: true },
    });

    if (!message) return;

    try {
      // Send based on provider type
      const result = await this.sendWithProvider(message.provider, message);

      await this.prisma.devMessage.update({
        where: { id: messageId },
        data: {
          status: result.success ? 'sent' : 'failed',
          externalId: result.externalId,
          sentAt: result.success ? new Date() : null,
          attempts: { increment: 1 },
          errorMessage: result.error,
        },
      });

      // Update provider stats
      await this.prisma.devMessageProvider.update({
        where: { id: message.providerId },
        data: {
          sentCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Publish event
      await this.eventsService.publish({
        eventType: `message.${result.success ? 'sent' : 'failed'}`,
        sourceSystem: 'developer',
        aggregateId: messageId,
        aggregateType: 'message',
        payload: {
          messageId,
          type: message.type,
          recipient: message.recipient,
          status: result.success ? 'sent' : 'failed',
        },
      });
    } catch (error: any) {
      await this.prisma.devMessage.update({
        where: { id: messageId },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          errorMessage: error.message,
        },
      });
    }
  }

  private async sendWithProvider(provider: any, message: any): Promise<{
    success: boolean;
    externalId?: string;
    error?: string;
  }> {
    const credentials = provider.credentials as any;

    switch (provider.provider) {
      case 'unifonic':
        return this.sendViaUnifonic(provider, message, credentials);
      case 'twilio':
        return this.sendViaTwilio(provider, message, credentials);
      case 'sendgrid':
        return this.sendViaSendGrid(provider, message, credentials);
      case 'smtp':
        return this.sendViaSMTP(provider, message, credentials);
      default:
        return this.sendViaGeneric(provider, message, credentials);
    }
  }

  private async sendViaUnifonic(provider: any, message: any, credentials: any) {
    // Unifonic SMS integration (simulated)
    this.logger.log(`Sending SMS via Unifonic to ${message.recipient}`);
    
    return {
      success: true,
      externalId: `unifonic_${Date.now()}`,
    };
  }

  private async sendViaTwilio(provider: any, message: any, credentials: any) {
    // Twilio integration (simulated)
    this.logger.log(`Sending ${message.type} via Twilio to ${message.recipient}`);
    
    return {
      success: true,
      externalId: `twilio_${Date.now()}`,
    };
  }

  private async sendViaSendGrid(provider: any, message: any, credentials: any) {
    // SendGrid email integration (simulated)
    this.logger.log(`Sending email via SendGrid to ${message.recipient}`);
    
    return {
      success: true,
      externalId: `sg_${Date.now()}`,
    };
  }

  private async sendViaSMTP(provider: any, message: any, credentials: any) {
    // SMTP email integration (simulated)
    this.logger.log(`Sending email via SMTP to ${message.recipient}`);
    
    return {
      success: true,
      externalId: `smtp_${Date.now()}`,
    };
  }

  private async sendViaGeneric(provider: any, message: any, credentials: any) {
    // Generic provider
    this.logger.log(`Sending ${message.type} via ${provider.provider} to ${message.recipient}`);
    
    return {
      success: true,
      externalId: `msg_${Date.now()}`,
    };
  }

  private async processTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    // Get template from database
    const template = await this.prisma.devMessageTemplate.findFirst({
      where: { name: templateName, isActive: true },
    });

    if (!template) {
      throw new BadRequestException(`القالب غير موجود: ${templateName}`);
    }

    // Replace placeholders
    let content = template.content;
    for (const [key, value] of Object.entries(data)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return content;
  }

  // ==================== Template Management ====================

  async createTemplate(data: {
    name: string;
    type: string;
    subject?: string;
    content: string;
    variables?: string[];
  }) {
    return this.prisma.devMessageTemplate.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject,
        content: data.content,
        variables: data.variables || [],
        isActive: true,
      },
    });
  }

  async findAllTemplates(query: { type?: string }) {
    const where: any = { isActive: true };
    if (query.type) where.type = query.type;

    return this.prisma.devMessageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTemplate(id: string, data: Partial<{
    name: string;
    subject: string;
    content: string;
    variables: string[];
    isActive: boolean;
  }>) {
    return this.prisma.devMessageTemplate.update({
      where: { id },
      data,
    });
  }

  // ==================== Message Queries ====================

  async findAllMessages(query: {
    type?: string;
    status?: string;
    recipient?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, status, recipient, fromDate, toDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (recipient) where.recipient = { contains: recipient };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [messages, total] = await Promise.all([
      this.prisma.devMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.devMessage.count({ where }),
    ]);

    return {
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneMessage(id: string) {
    const message = await this.prisma.devMessage.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, type: true, provider: true } },
      },
    });

    if (!message) {
      throw new NotFoundException(`الرسالة غير موجودة: ${id}`);
    }

    return message;
  }

  private sanitizeProvider(provider: any) {
    const { credentials, ...safe } = provider;
    return {
      ...safe,
      hasCredentials: !!credentials,
    };
  }
}
