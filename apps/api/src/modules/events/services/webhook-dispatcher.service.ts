import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProcessedEvent } from './event-processor.service';
import * as crypto from 'crypto';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  url: string;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  response?: string;
  error?: string;
  attemptCount: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [60, 300, 900, 3600, 86400]; // seconds

  constructor(private readonly prisma: PrismaService) {}

  /**
   * إرسال Webhook لحدث
   */
  @OnEvent('**')
  async dispatchWebhooks(event: ProcessedEvent) {
    if (!event.id) return;

    try {
      // جلب جميع الـ Webhooks المشتركة في هذا النوع من الأحداث
      const webhooks = await this.getSubscribedWebhooks(event.eventType);

      for (const webhook of webhooks) {
        await this.sendWebhook(webhook, event);
      }
    } catch (error: any) {
      this.logger.error(`Failed to dispatch webhooks for event ${event.id}`, error.stack);
    }
  }

  /**
   * جلب الـ Webhooks المشتركة
   */
  private async getSubscribedWebhooks(eventType: string): Promise<any[]> {
    return this.prisma.devWebhook.findMany({
      where: {
        isActive: true,
        OR: [
          { events: { has: eventType } },
          { events: { has: '*' } },
          { events: { has: eventType.split('.')[0] + '.*' } },
        ],
      },
    });
  }

  /**
   * إرسال Webhook
   */
  private async sendWebhook(webhook: any, event: ProcessedEvent): Promise<void> {
    const deliveryId = this.generateDeliveryId();
    const payload = this.buildPayload(event, webhook);
    const signature = this.generateSignature(payload, webhook.secret);

    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: webhook.id,
      eventId: event.id,
      url: webhook.url,
      payload,
      status: 'pending',
      attemptCount: 0,
    };

    try {
      // حفظ محاولة التسليم
      await this.saveDelivery(delivery);

      // إرسال الطلب
      const response = await this.sendRequest(webhook.url, payload, signature, webhook.headers);

      // تحديث حالة التسليم
      delivery.status = 'success';
      delivery.statusCode = response.status;
      delivery.response = response.body;
      delivery.deliveredAt = new Date();
      delivery.attemptCount = 1;

      await this.updateDelivery(delivery);

      // تسجيل في سجل Webhooks
      await this.logWebhookDelivery(webhook.id, event.eventType, payload, response.status, response.body, 'success');

      this.logger.log(`Webhook delivered: ${webhook.url} for event ${event.eventType}`);
    } catch (error: any) {
      delivery.status = 'failed';
      delivery.error = error.message;
      delivery.attemptCount = 1;
      delivery.nextRetryAt = this.calculateNextRetry(1);

      await this.updateDelivery(delivery);

      // تسجيل الفشل
      await this.logWebhookDelivery(webhook.id, event.eventType, payload, null, null, 'failed', error.message);

      this.logger.warn(`Webhook delivery failed: ${webhook.url} - ${error.message}`);

      // جدولة إعادة المحاولة
      await this.scheduleRetry(delivery);
    }
  }

  /**
   * تسجيل تسليم Webhook
   */
  private async logWebhookDelivery(
    webhookId: string,
    eventType: string,
    payload: any,
    responseCode: number | null,
    responseBody: string | null,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.devWebhookLog.create({
      data: {
        webhookId,
        eventType,
        payload,
        responseCode,
        responseBody,
        status,
        errorMessage,
        attempts: 1,
      },
    });
  }

  /**
   * إرسال طلب HTTP
   */
  private async sendRequest(
    url: string,
    payload: any,
    signature: string,
    customHeaders?: Record<string, string>,
  ): Promise<{ status: number; body: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString(),
      'User-Agent': 'DeveloperSystem-Webhook/1.0',
      ...customHeaders,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      return { status: response.status, body };
    } catch (error: any) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * بناء الـ Payload
   */
  private buildPayload(event: ProcessedEvent, webhook: any): any {
    return {
      id: event.id,
      type: event.eventType,
      source: event.sourceSystem,
      timestamp: event.processedAt?.toISOString(),
      data: event.payload,
      metadata: {
        webhookId: webhook.id,
      },
    };
  }

  /**
   * إنشاء توقيع HMAC
   */
  private generateSignature(payload: any, secret: string): string {
    const timestamp = Date.now();
    const data = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac('sha256', secret || 'default-secret')
      .update(data)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * حساب وقت إعادة المحاولة التالية
   */
  private calculateNextRetry(attemptCount: number): Date {
    const delayIndex = Math.min(attemptCount - 1, this.RETRY_DELAYS.length - 1);
    const delaySeconds = this.RETRY_DELAYS[delayIndex];
    return new Date(Date.now() + delaySeconds * 1000);
  }

  /**
   * جدولة إعادة المحاولة
   */
  private async scheduleRetry(delivery: WebhookDelivery): Promise<void> {
    if (delivery.attemptCount >= this.MAX_RETRIES) {
      this.logger.error(`Max retries reached for webhook delivery ${delivery.id}`);
      return;
    }

    this.logger.debug(`Retry scheduled for ${delivery.id} at ${delivery.nextRetryAt}`);
  }

  /**
   * إعادة محاولة التسليم
   */
  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.devWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true },
    });

    if (!delivery || delivery.status === 'success') {
      return;
    }

    if (delivery.attemptCount >= this.MAX_RETRIES) {
      this.logger.error(`Max retries reached for delivery ${deliveryId}`);
      return;
    }

    const signature = this.generateSignature(delivery.payload, delivery.webhook.secret || '');

    try {
      const response = await this.sendRequest(
        delivery.url,
        delivery.payload,
        signature,
        delivery.webhook.headers as Record<string, string>,
      );

      await this.prisma.devWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'success',
          statusCode: response.status,
          response: response.body,
          deliveredAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });

      this.logger.log(`Webhook retry successful: ${deliveryId}`);
    } catch (error: any) {
      const newAttemptCount = delivery.attemptCount + 1;
      
      await this.prisma.devWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          error: error.message,
          attemptCount: newAttemptCount,
          nextRetryAt: this.calculateNextRetry(newAttemptCount),
        },
      });

      this.logger.warn(`Webhook retry failed: ${deliveryId} - attempt ${newAttemptCount}`);
    }
  }

  /**
   * الحصول على التسليمات الفاشلة
   */
  async getFailedDeliveries(limit = 100): Promise<any[]> {
    return this.prisma.devWebhookDelivery.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { webhook: true },
    });
  }

  /**
   * حفظ محاولة التسليم
   */
  private async saveDelivery(delivery: WebhookDelivery): Promise<void> {
    await this.prisma.devWebhookDelivery.create({
      data: {
        id: delivery.id,
        webhookId: delivery.webhookId,
        eventId: delivery.eventId,
        url: delivery.url,
        payload: delivery.payload as any,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
      },
    });
  }

  /**
   * تحديث محاولة التسليم
   */
  private async updateDelivery(delivery: WebhookDelivery): Promise<void> {
    await this.prisma.devWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: delivery.status,
        statusCode: delivery.statusCode,
        response: delivery.response,
        error: delivery.error,
        attemptCount: delivery.attemptCount,
        nextRetryAt: delivery.nextRetryAt,
        deliveredAt: delivery.deliveredAt,
      },
    });
  }

  /**
   * إنشاء معرف تسليم
   */
  private generateDeliveryId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
