import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SystemEvent {
  id?: string;
  eventType: string;
  source: string;
  sourceId?: string;
  payload: any;
  metadata?: any;
  timestamp?: Date;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
}

export interface ProcessedEvent extends SystemEvent {
  id: string;
  processedAt: Date;
  status: 'pending' | 'processed' | 'failed';
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
      timestamp,
      processedAt: timestamp,
      status: 'pending',
      retryCount: 0,
    };

    try {
      // حفظ الحدث في قاعدة البيانات
      await this.storeEvent(processedEvent);

      // معالجة الحدث
      await this.processEvent(processedEvent);

      // تحديث حالة الحدث
      processedEvent.status = 'processed';
      processedEvent.processedAt = new Date();
      await this.updateEventStatus(processedEvent);

      // نشر الحدث للمستمعين الداخليين
      this.eventEmitter.emit(event.eventType, processedEvent);

      this.logger.log(`Event processed: ${event.eventType} (${eventId})`);
      return processedEvent;
    } catch (error) {
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
        source: event.source,
        sourceId: event.sourceId,
        payload: event.payload as any,
        metadata: event.metadata as any,
        status: event.status,
        retryCount: event.retryCount,
        correlationId: event.correlationId,
        createdAt: event.timestamp,
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
        error: event.error,
      },
    });
  }

  /**
   * إنشاء معرف حدث
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Event Handlers ====================

  private async handleSubscriberEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling subscriber event: ${event.eventType}`);
    // معالجة أحداث المشتركين
  }

  private async handleInvoiceEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling invoice event: ${event.eventType}`);
    // معالجة أحداث الفواتير
  }

  private async handleAssetEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling asset event: ${event.eventType}`);
    // معالجة أحداث الأصول
  }

  private async handleNetworkEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling network event: ${event.eventType}`);
    // معالجة أحداث الشبكة
  }

  private async handleFinanceEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling finance event: ${event.eventType}`);
    // معالجة أحداث المالية
  }

  private async handleSystemEvent(event: SystemEvent): Promise<void> {
    this.logger.debug(`Handling system event: ${event.eventType}`);
    // معالجة أحداث النظام
  }
}
