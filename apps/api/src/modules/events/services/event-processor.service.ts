import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SystemEvent {
  id?: string;
  eventType: string;
  sourceSystem: string;
  targetSystem?: string;
  aggregateId?: string;
  aggregateType?: string;
  payload: any;
  metadata?: any;
  priority?: number;
  correlationId?: string;
}

export interface ProcessedEvent extends SystemEvent {
  id: string;
  processedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

@Injectable()
export class EventProcessorService implements OnModuleInit {
  private readonly logger = new Logger(EventProcessorService.name);
  private readonly eventHandlers: Map<string, ((event: SystemEvent) => Promise<void>)[]> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.logger.log('Event Processor initialized');
    this.registerDefaultHandlers();
  }

  /**
   * تسجيل معالجات الأحداث الافتراضية
   */
  private registerDefaultHandlers() {
    // Subscriber events
    this.registerHandler('subscriber.*', this.handleSubscriberEvent.bind(this));
    
    // Invoice events
    this.registerHandler('invoice.*', this.handleInvoiceEvent.bind(this));
    
    // Asset events
    this.registerHandler('asset.*', this.handleAssetEvent.bind(this));
    
    // Network events
    this.registerHandler('network.*', this.handleNetworkEvent.bind(this));
    
    // Finance events
    this.registerHandler('finance.*', this.handleFinanceEvent.bind(this));
    
    // Payment events
    this.registerHandler('payment.*', this.handlePaymentEvent.bind(this));
    
    // System events
    this.registerHandler('system.*', this.handleSystemEvent.bind(this));
  }

  /**
   * تسجيل معالج حدث
   */
  registerHandler(eventPattern: string, handler: (event: SystemEvent) => Promise<void>) {
    const handlers = this.eventHandlers.get(eventPattern) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventPattern, handlers);
    this.logger.debug(`Registered handler for pattern: ${eventPattern}`);
  }

  /**
   * نشر حدث
   */
  async publish(event: SystemEvent): Promise<ProcessedEvent> {
    const eventId = this.generateEventId();
    const timestamp = new Date();

    const processedEvent: ProcessedEvent = {
      ...event,
      id: eventId,
      processedAt: timestamp,
      status: 'pending',
      retryCount: 0,
    };

    try {
      // حفظ الحدث في قاعدة البيانات
      await this.storeEvent(processedEvent);

      // تحديث الحالة إلى processing
      processedEvent.status = 'processing';
      await this.updateEventStatus(processedEvent);

      // معالجة الحدث
      await this.processEvent(processedEvent);

      // تحديث حالة الحدث
      processedEvent.status = 'completed';
      processedEvent.processedAt = new Date();
      await this.updateEventStatus(processedEvent);

      // نشر الحدث للمستمعين الداخليين
      this.eventEmitter.emit(event.eventType, processedEvent);

      this.logger.log(`Event processed: ${event.eventType} (${eventId})`);
      return processedEvent;
    } catch (error: any) {
      processedEvent.status = 'failed';
      processedEvent.error = error.message;
      await this.updateEventStatus(processedEvent);
      
      this.logger.error(`Event processing failed: ${event.eventType} (${eventId})`, error.stack);
      throw error;
    }
  }

  /**
   * معالجة الحدث
   */
  private async processEvent(event: ProcessedEvent): Promise<void> {
    const eventType = event.eventType;
    
    // البحث عن المعالجات المطابقة
    for (const [pattern, handlers] of this.eventHandlers.entries()) {
      if (this.matchesPattern(eventType, pattern)) {
        for (const handler of handlers) {
          await handler(event);
        }
      }
    }

    // البحث عن الاشتراكات وإنشاء deliveries
    await this.createDeliveries(event);
  }

  /**
   * إنشاء deliveries للاشتراكات
   */
  private async createDeliveries(event: ProcessedEvent): Promise<void> {
    const subscriptions = await this.prisma.devEventSubscription.findMany({
      where: {
        isActive: true,
        OR: [
          { eventType: event.eventType },
          { eventType: event.eventType.split('.')[0] + '.*' },
          { eventType: '*' },
        ],
      },
    });

    for (const subscription of subscriptions) {
      await this.prisma.devEventDelivery.create({
        data: {
          eventId: event.id,
          subscriptionId: subscription.id,
          status: 'pending',
          attempts: 0,
        },
      });
    }
  }

  /**
   * التحقق من تطابق النمط
   */
  private matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix);
    }
    return eventType === pattern;
  }

  /**
   * حفظ الحدث
   */
  private async storeEvent(event: ProcessedEvent): Promise<void> {
    await this.prisma.devEvent.create({
      data: {
        id: event.id,
        eventType: event.eventType,
        sourceSystem: event.sourceSystem,
        targetSystem: event.targetSystem,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        payload: event.payload as any,
        metadata: event.metadata as any,
        status: event.status,
        priority: event.priority || 5,
        retryCount: event.retryCount,
      },
    });
  }

  /**
   * تحديث حالة الحدث
   */
  private async updateEventStatus(event: ProcessedEvent): Promise<void> {
    await this.prisma.devEvent.update({
      where: { id: event.id },
      data: {
        status: event.status,
        processedAt: event.processedAt,
        retryCount: event.retryCount,
        errorMessage: event.error,
      },
    });
  }

  /**
   * إنشاء معرف حدث
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * إعادة معالجة حدث فاشل
   */
  async retryEvent(eventId: string): Promise<ProcessedEvent> {
    const event = await this.prisma.devEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    if (event.retryCount >= event.maxRetries) {
      throw new Error(`Max retries exceeded for event: ${eventId}`);
    }

    const processedEvent: ProcessedEvent = {
      id: event.id,
      eventType: event.eventType,
      sourceSystem: event.sourceSystem,
      targetSystem: event.targetSystem || undefined,
      aggregateId: event.aggregateId || undefined,
      aggregateType: event.aggregateType || undefined,
      payload: event.payload,
      metadata: event.metadata as any,
      status: 'pending',
      retryCount: event.retryCount + 1,
      processedAt: new Date(),
    };

    return this.publish(processedEvent);
  }

  /**
   * الحصول على الأحداث الفاشلة
   */
  async getFailedEvents(limit = 100): Promise<any[]> {
    return this.prisma.devEvent.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ==================== Event Handlers ====================

  private async handleSubscriberEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling subscriber event: ${event.eventType}`);
  }

  private async handleInvoiceEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling invoice event: ${event.eventType}`);
  }

  private async handleAssetEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling asset event: ${event.eventType}`);
  }

  private async handleNetworkEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling network event: ${event.eventType}`);
  }

  private async handleFinanceEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling finance event: ${event.eventType}`);
  }

  private async handlePaymentEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling payment event: ${event.eventType}`);
  }

  private async handleSystemEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling system event: ${event.eventType}`);
  }
}
