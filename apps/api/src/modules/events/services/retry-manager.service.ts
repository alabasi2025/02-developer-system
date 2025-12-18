import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

interface RetryJob {
  id: string;
  type: 'webhook' | 'event';
  targetId: string;
  attemptCount: number;
  nextRetryAt: Date;
  maxRetries: number;
}

@Injectable()
export class RetryManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetryManagerService.name);
  private retryInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 60000; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  onModuleInit() {
    this.startRetryPolling();
    this.logger.log('Retry Manager started');
  }

  onModuleDestroy() {
    this.stopRetryPolling();
    this.logger.log('Retry Manager stopped');
  }

  /**
   * بدء استطلاع إعادة المحاولة
   */
  private startRetryPolling() {
    this.retryInterval = setInterval(async () => {
      await this.processRetries();
    }, this.POLL_INTERVAL);
  }

  /**
   * إيقاف استطلاع إعادة المحاولة
   */
  private stopRetryPolling() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * معالجة إعادة المحاولات المعلقة
   */
  async processRetries(): Promise<void> {
    try {
      // جلب Webhook deliveries التي تحتاج إعادة محاولة
      const pendingDeliveries = await this.getPendingWebhookRetries();

      for (const delivery of pendingDeliveries) {
        try {
          await this.webhookDispatcher.retryDelivery(delivery.id);
        } catch (error) {
          this.logger.error(`Failed to retry delivery ${delivery.id}`, error.stack);
        }
      }

      // جلب الأحداث الفاشلة التي تحتاج إعادة معالجة
      const failedEvents = await this.getFailedEvents();

      for (const event of failedEvents) {
        try {
          await this.retryEvent(event.id);
        } catch (error) {
          this.logger.error(`Failed to retry event ${event.id}`, error.stack);
        }
      }

      if (pendingDeliveries.length > 0 || failedEvents.length > 0) {
        this.logger.log(`Processed ${pendingDeliveries.length} webhook retries and ${failedEvents.length} event retries`);
      }
    } catch (error) {
      this.logger.error('Error processing retries', error.stack);
    }
  }

  /**
   * جلب Webhook deliveries المعلقة
   */
  private async getPendingWebhookRetries(): Promise<any[]> {
    return this.prisma.devWebhookDelivery.findMany({
      where: {
        status: 'failed',
        attemptCount: { lt: 5 },
        nextRetryAt: { lte: new Date() },
      },
      take: 100,
      orderBy: { nextRetryAt: 'asc' },
    });
  }

  /**
   * جلب الأحداث الفاشلة
   */
  private async getFailedEvents(): Promise<any[]> {
    return this.prisma.devEvent.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 },
      },
      take: 50,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * إعادة محاولة حدث
   */
  private async retryEvent(eventId: string): Promise<void> {
    const event = await this.prisma.devEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) return;

    try {
      // تحديث عدد المحاولات
      await this.prisma.devEvent.update({
        where: { id: eventId },
        data: {
          retryCount: { increment: 1 },
          status: 'pending',
        },
      });

      // إعادة نشر الحدث
      // يمكن إضافة منطق إعادة المعالجة هنا

      await this.prisma.devEvent.update({
        where: { id: eventId },
        data: {
          status: 'processed',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Event ${eventId} retried successfully`);
    } catch (error) {
      await this.prisma.devEvent.update({
        where: { id: eventId },
        data: {
          status: 'failed',
          error: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * إضافة عنصر لقائمة الانتظار الميتة (Dead Letter Queue)
   */
  async moveToDeadLetterQueue(type: 'webhook' | 'event', id: string, reason: string): Promise<void> {
    await this.prisma.devDeadLetterQueue.create({
      data: {
        type,
        originalId: id,
        reason,
        createdAt: new Date(),
      },
    });

    this.logger.warn(`Moved ${type} ${id} to dead letter queue: ${reason}`);
  }

  /**
   * إحصائيات إعادة المحاولة
   */
  async getRetryStats(): Promise<{
    pendingWebhooks: number;
    failedEvents: number;
    deadLetterCount: number;
  }> {
    const [pendingWebhooks, failedEvents, deadLetterCount] = await Promise.all([
      this.prisma.devWebhookDelivery.count({
        where: { status: 'failed', attemptCount: { lt: 5 } },
      }),
      this.prisma.devEvent.count({
        where: { status: 'failed', retryCount: { lt: 3 } },
      }),
      this.prisma.devDeadLetterQueue.count(),
    ]);

    return { pendingWebhooks, failedEvents, deadLetterCount };
  }
}
