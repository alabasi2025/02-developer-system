import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PublishEventDto,
  EventQueryDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionQueryDto,
} from './dto/event.dto';
import axios from 'axios';
import { createHmac } from 'crypto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== Event Publishing ====================

  async publish(publishDto: PublishEventDto) {
    this.logger.log(`Publishing event: ${publishDto.eventType} from ${publishDto.sourceSystem}`);

    // Create the event record
    const event = await this.prisma.devEvent.create({
      data: {
        eventType: publishDto.eventType,
        sourceSystem: publishDto.sourceSystem,
        targetSystem: publishDto.targetSystem,
        aggregateId: publishDto.aggregateId,
        aggregateType: publishDto.aggregateType,
        payload: publishDto.payload,
        metadata: publishDto.metadata || {},
        priority: publishDto.priority || 5,
        scheduledFor: publishDto.scheduledFor ? new Date(publishDto.scheduledFor) : null,
        status: publishDto.scheduledFor ? 'pending' : 'processing',
      },
    });

    // If not scheduled, process immediately
    if (!publishDto.scheduledFor) {
      await this.processEvent(event.id);
    }

    // Emit internal event for local listeners
    this.eventEmitter.emit(publishDto.eventType, {
      eventId: event.id,
      ...publishDto,
    });

    return {
      id: event.id,
      eventType: event.eventType,
      status: event.status,
      message: 'تم نشر الحدث بنجاح',
    };
  }

  async processEvent(eventId: string) {
    const event = await this.prisma.devEvent.findUnique({ where: { id: eventId } });
    
    if (!event) {
      throw new NotFoundException(`الحدث غير موجود: ${eventId}`);
    }

    // Find matching subscriptions
    const subscriptions = await this.findMatchingSubscriptions(event.eventType);

    // Create delivery records for each subscription
    for (const subscription of subscriptions) {
      await this.prisma.devEventDelivery.create({
        data: {
          eventId: event.id,
          subscriptionId: subscription.id,
          status: 'pending',
        },
      });
    }

    // Process deliveries
    await this.processDeliveries(eventId);

    // Update event status
    await this.prisma.devEvent.update({
      where: { id: eventId },
      data: {
        status: 'completed',
        processedAt: new Date(),
      },
    });
  }

  private async findMatchingSubscriptions(eventType: string) {
    // Find exact matches and wildcard matches
    const subscriptions = await this.prisma.devEventSubscription.findMany({
      where: {
        isActive: true,
        OR: [
          { eventType: eventType },
          { eventType: '*' },
          // Match patterns like "customer.*"
          { eventType: { endsWith: '.*' } },
        ],
      },
    });

    // Filter wildcard matches
    return subscriptions.filter(sub => {
      if (sub.eventType === eventType || sub.eventType === '*') {
        return true;
      }
      if (sub.eventType.endsWith('.*')) {
        const prefix = sub.eventType.slice(0, -2);
        return eventType.startsWith(prefix);
      }
      return false;
    });
  }

  private async processDeliveries(eventId: string) {
    const deliveries = await this.prisma.devEventDelivery.findMany({
      where: { eventId, status: 'pending' },
      include: {
        event: true,
        subscription: true,
      },
    });

    for (const delivery of deliveries) {
      await this.deliverEvent(delivery);
    }
  }

  private async deliverEvent(delivery: any) {
    const { subscription, event } = delivery;

    if (!subscription.webhookUrl) {
      // No webhook, mark as delivered (internal only)
      await this.prisma.devEventDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          attempts: 1,
        },
      });
      return;
    }

    try {
      // Prepare payload
      let payload = {
        eventId: event.id,
        eventType: event.eventType,
        sourceSystem: event.sourceSystem,
        timestamp: event.createdAt,
        payload: event.payload,
        metadata: event.metadata,
      };

      // Apply transform rules if any
      if (subscription.transformRules) {
        payload = this.applyTransformRules(payload, subscription.transformRules);
      }

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(subscription.headers || {}),
      };

      // Add HMAC signature if secret is configured
      if (subscription.secret) {
        const signature = this.generateSignature(JSON.stringify(payload), subscription.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Send webhook
      const response = await axios({
        method: subscription.httpMethod || 'POST',
        url: subscription.webhookUrl,
        data: payload,
        headers,
        timeout: 30000,
        validateStatus: () => true,
      });

      // Update delivery record
      await this.prisma.devEventDelivery.update({
        where: { id: delivery.id },
        data: {
          status: response.status < 400 ? 'delivered' : 'failed',
          deliveredAt: response.status < 400 ? new Date() : null,
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          responseCode: response.status,
          responseBody: JSON.stringify(response.data).substring(0, 1000),
          errorMessage: response.status >= 400 ? `HTTP ${response.status}` : null,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to deliver event ${event.id} to ${subscription.webhookUrl}: ${error.message}`);

      await this.prisma.devEventDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage: error.message,
          nextRetryAt: this.calculateNextRetry(delivery.attempts + 1),
        },
      });
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private applyTransformRules(payload: any, rules: any): any {
    // Simple transform implementation
    // Can be extended for more complex transformations
    return payload;
  }

  private calculateNextRetry(attempts: number): Date | null {
    if (attempts >= 5) return null; // Max retries reached
    
    // Exponential backoff: 1min, 5min, 15min, 1hour
    const delays = [60, 300, 900, 3600];
    const delay = delays[Math.min(attempts - 1, delays.length - 1)];
    
    return new Date(Date.now() + delay * 1000);
  }

  // ==================== Event Queries ====================

  async findAllEvents(query: EventQueryDto) {
    const { eventType, sourceSystem, status, aggregateId, fromDate, toDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (eventType) where.eventType = { contains: eventType };
    if (sourceSystem) where.sourceSystem = sourceSystem;
    if (status) where.status = status;
    if (aggregateId) where.aggregateId = aggregateId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [events, total] = await Promise.all([
      this.prisma.devEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devEvent.count({ where }),
    ]);

    return {
      data: events,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneEvent(id: string) {
    const event = await this.prisma.devEvent.findUnique({
      where: { id },
      include: {
        deliveries: {
          include: {
            subscription: {
              select: { id: true, targetSystem: true, webhookUrl: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`الحدث غير موجود: ${id}`);
    }

    return event;
  }

  // ==================== Subscriptions ====================

  async createSubscription(createDto: CreateSubscriptionDto, userId?: string) {
    // Check for duplicate subscription
    const existing = await this.prisma.devEventSubscription.findFirst({
      where: {
        eventType: createDto.eventType,
        targetSystem: createDto.targetSystem,
      },
    });

    if (existing) {
      throw new BadRequestException('اشتراك موجود مسبقاً لهذا النوع من الأحداث والنظام');
    }

    const subscription = await this.prisma.devEventSubscription.create({
      data: {
        eventType: createDto.eventType,
        targetSystem: createDto.targetSystem,
        webhookUrl: createDto.webhookUrl,
        httpMethod: createDto.httpMethod || 'POST',
        headers: createDto.headers || {},
        secret: createDto.secret,
        filterRules: createDto.filterRules || {},
        transformRules: createDto.transformRules || {},
        createdBy: userId,
      },
    });

    return subscription;
  }

  async findAllSubscriptions(query: SubscriptionQueryDto) {
    const { eventType, targetSystem, isActive, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (eventType) where.eventType = { contains: eventType };
    if (targetSystem) where.targetSystem = targetSystem;
    if (isActive !== undefined) where.isActive = isActive;

    const [subscriptions, total] = await Promise.all([
      this.prisma.devEventSubscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devEventSubscription.count({ where }),
    ]);

    return {
      data: subscriptions.map(s => this.sanitizeSubscription(s)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneSubscription(id: string) {
    const subscription = await this.prisma.devEventSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException(`الاشتراك غير موجود: ${id}`);
    }

    return this.sanitizeSubscription(subscription);
  }

  async updateSubscription(id: string, updateDto: UpdateSubscriptionDto) {
    const existing = await this.prisma.devEventSubscription.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`الاشتراك غير موجود: ${id}`);
    }

    const updated = await this.prisma.devEventSubscription.update({
      where: { id },
      data: updateDto,
    });

    return this.sanitizeSubscription(updated);
  }

  async removeSubscription(id: string) {
    const existing = await this.prisma.devEventSubscription.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`الاشتراك غير موجود: ${id}`);
    }

    await this.prisma.devEventSubscription.delete({ where: { id } });

    return { message: 'تم حذف الاشتراك بنجاح', id };
  }

  private sanitizeSubscription(subscription: any) {
    const { secret, ...safe } = subscription;
    return {
      ...safe,
      hasSecret: !!secret,
    };
  }

  // ==================== Retry Failed Deliveries ====================

  async retryFailedDeliveries() {
    const failedDeliveries = await this.prisma.devEventDelivery.findMany({
      where: {
        status: 'failed',
        nextRetryAt: { lte: new Date() },
        attempts: { lt: 5 },
      },
      include: {
        event: true,
        subscription: true,
      },
      take: 100,
    });

    this.logger.log(`Retrying ${failedDeliveries.length} failed deliveries`);

    for (const delivery of failedDeliveries) {
      await this.deliverEvent(delivery);
    }

    return { retried: failedDeliveries.length };
  }
}
