import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  MeterReadingDto,
  AlertDto,
  StatusChangeDto,
  DisconnectConfirmDto,
  ReconnectConfirmDto,
} from '../dto/acrel-webhook.dto';

@Injectable()
export class AcrelWebhookService {
  private readonly logger = new Logger(AcrelWebhookService.name);
  
  // Cache للأحداث المعالجة (Idempotency)
  private processedEvents: Map<string, Date> = new Map();
  private readonly eventCacheTtl = 24 * 60 * 60 * 1000; // 24 ساعة

  constructor(private readonly prisma: PrismaService) {
    // تنظيف الأحداث القديمة كل ساعة
    setInterval(() => this.cleanupProcessedEvents(), 60 * 60 * 1000);
  }

  /**
   * التحقق من أن الحدث تمت معالجته مسبقاً
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    // التحقق من الذاكرة المؤقتة أولاً
    if (this.processedEvents.has(eventId)) {
      return true;
    }

    // التحقق من قاعدة البيانات
    const existingEvent = await this.prisma.devEvent.findFirst({
      where: { 
        metadata: {
          path: ['acrelEventId'],
          equals: eventId,
        },
      },
    });

    if (existingEvent) {
      this.processedEvents.set(eventId, new Date());
      return true;
    }

    return false;
  }

  /**
   * تسجيل الحدث كمعالج
   */
  private markEventAsProcessed(eventId: string): void {
    this.processedEvents.set(eventId, new Date());
  }

  /**
   * تنظيف الأحداث القديمة من الذاكرة المؤقتة
   */
  private cleanupProcessedEvents(): void {
    const now = Date.now();
    for (const [eventId, timestamp] of this.processedEvents.entries()) {
      if (now - timestamp.getTime() > this.eventCacheTtl) {
        this.processedEvents.delete(eventId);
      }
    }
    this.logger.log(`Cleaned up processed events cache, remaining: ${this.processedEvents.size}`);
  }

  /**
   * معالجة قراءة العداد
   */
  async processMeterReading(data: MeterReadingDto, eventId: string): Promise<any> {
    this.logger.log(`Processing meter reading for device ${data.deviceId}`);

    // تحديث بيانات الجهاز
    const device = await this.prisma.devIotDevice.upsert({
      where: { deviceId: data.deviceId },
      update: {
        isOnline: true,
        lastSeenAt: new Date(data.timestamp),
        metadata: {
          voltage: data.voltage,
          current: data.current,
          activePower: data.activePower,
          reactivePower: data.reactivePower,
          powerFactor: data.powerFactor,
          frequency: data.frequency,
          lastReading: data.reading,
        },
      },
      create: {
        deviceId: data.deviceId,
        name: `Meter ${data.meterNumber}`,
        deviceType: 'meter',
        manufacturer: 'acrel',
        status: 'active',
        isOnline: true,
        lastSeenAt: new Date(data.timestamp),
        metadata: {
          meterNumber: data.meterNumber,
          voltage: data.voltage,
          current: data.current,
          activePower: data.activePower,
          lastReading: data.reading,
        },
      },
    });

    // تسجيل القراءة
    await this.prisma.devIotReading.create({
      data: {
        deviceId: device.id,
        readingType: 'energy',
        value: data.reading,
        unit: 'kWh',
        quality: 'good',
        timestamp: new Date(data.timestamp),
        rawData: data as any,
      },
    });

    // تسجيل الحدث
    await this.prisma.devEvent.create({
      data: {
        eventType: 'iot.meter_reading',
        sourceSystem: 'acrel',
        payload: data as any,
        status: 'processed',
        metadata: { acrelEventId: eventId },
      },
    });

    this.markEventAsProcessed(eventId);

    return { deviceId: device.id, reading: data.reading };
  }

  /**
   * معالجة التنبيه
   */
  async processAlert(data: AlertDto, eventId: string): Promise<any> {
    this.logger.warn(`Processing alert for device ${data.deviceId}: ${data.alertType}`);

    // البحث عن الجهاز
    const device = await this.prisma.devIotDevice.findUnique({
      where: { deviceId: data.deviceId },
    });

    // البحث عن قاعدة التنبيه أو إنشاء واحدة
    let alertRule = await this.prisma.devIotAlertRule.findFirst({
      where: { alertType: data.alertType },
    });

    if (!alertRule) {
      alertRule = await this.prisma.devIotAlertRule.create({
        data: {
          dataType: 'acrel_alert',
          operator: 'eq',
          threshold: data.threshold || 0,
          alertType: data.alertType,
          severity: data.severity,
          title: `Auto-created rule for ${data.alertType}`,
          message: data.message,
          isActive: true,
        },
      });
    }

    // تسجيل التنبيه
    const alert = await this.prisma.devIotAlert.create({
      data: {
        ruleId: alertRule.id,
        deviceId: device?.id || data.deviceId,
        alertType: data.alertType,
        severity: data.severity,
        title: `Alert: ${data.alertType}`,
        message: data.message,
        value: { value: data.value, metadata: data.metadata },
        threshold: data.threshold || 0,
        status: 'active',
      },
    });

    // تسجيل الحدث
    await this.prisma.devEvent.create({
      data: {
        eventType: 'iot.alert',
        sourceSystem: 'acrel',
        payload: data as any,
        status: 'processed',
        metadata: { acrelEventId: eventId, alertId: alert.id },
      },
    });

    this.markEventAsProcessed(eventId);

    return { alertId: alert.id, type: data.alertType };
  }

  /**
   * معالجة تغيير الحالة
   */
  async processStatusChange(data: StatusChangeDto, eventId: string): Promise<any> {
    this.logger.log(`Processing status change for device ${data.deviceId}: ${data.previousStatus} -> ${data.newStatus}`);

    // تحديث حالة الجهاز
    await this.prisma.devIotDevice.updateMany({
      where: { deviceId: data.deviceId },
      data: {
        status: this.mapDeviceStatus(data.newStatus),
        isOnline: data.newStatus === 'online' || data.newStatus === 'connected',
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // تسجيل الحدث
    await this.prisma.devEvent.create({
      data: {
        eventType: 'iot.status_change',
        sourceSystem: 'acrel',
        payload: data as any,
        status: 'processed',
        metadata: { acrelEventId: eventId },
      },
    });

    this.markEventAsProcessed(eventId);

    return { deviceId: data.deviceId, newStatus: data.newStatus };
  }

  /**
   * معالجة تأكيد الفصل
   */
  async processDisconnectConfirm(data: DisconnectConfirmDto, eventId: string): Promise<any> {
    this.logger.log(`Processing disconnect confirmation for device ${data.deviceId}`);

    // تحديث حالة الأمر
    await this.prisma.devIotCommand.updateMany({
      where: { id: data.commandId },
      data: {
        status: data.status === 'success' ? 'executed' : 'failed',
        response: data as any,
        executedAt: new Date(),
      },
    });

    // تحديث حالة الجهاز
    if (data.status === 'success') {
      await this.prisma.devIotDevice.updateMany({
        where: { deviceId: data.deviceId },
        data: { status: 'offline', isOnline: false },
      });
    }

    // تسجيل الحدث
    await this.prisma.devEvent.create({
      data: {
        eventType: 'iot.disconnect_confirm',
        sourceSystem: 'acrel',
        payload: data as any,
        status: 'processed',
        metadata: { acrelEventId: eventId },
      },
    });

    this.markEventAsProcessed(eventId);

    return { commandId: data.commandId, status: data.status };
  }

  /**
   * معالجة تأكيد الوصل
   */
  async processReconnectConfirm(data: ReconnectConfirmDto, eventId: string): Promise<any> {
    this.logger.log(`Processing reconnect confirmation for device ${data.deviceId}`);

    // تحديث حالة الأمر
    await this.prisma.devIotCommand.updateMany({
      where: { id: data.commandId },
      data: {
        status: data.status === 'success' ? 'executed' : 'failed',
        response: data as any,
        executedAt: new Date(),
      },
    });

    // تحديث حالة الجهاز
    if (data.status === 'success') {
      await this.prisma.devIotDevice.updateMany({
        where: { deviceId: data.deviceId },
        data: { status: 'active', isOnline: true },
      });
    }

    // تسجيل الحدث
    await this.prisma.devEvent.create({
      data: {
        eventType: 'iot.reconnect_confirm',
        sourceSystem: 'acrel',
        payload: data as any,
        status: 'processed',
        metadata: { acrelEventId: eventId },
      },
    });

    this.markEventAsProcessed(eventId);

    return { commandId: data.commandId, status: data.status };
  }

  /**
   * تحويل مستوى الخطورة إلى رقم (1-5)
   */
  private mapSeverity(severity: number): number {
    // التأكد من أن القيمة بين 1 و 5
    return Math.max(1, Math.min(5, severity));
  }

  /**
   * تحويل حالة الجهاز
   */
  private mapDeviceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      online: 'active',
      offline: 'offline',
      connected: 'active',
      disconnected: 'offline',
      fault: 'error',
      maintenance: 'decommissioned',
    };
    return statusMap[status] || 'registered';
  }
}
