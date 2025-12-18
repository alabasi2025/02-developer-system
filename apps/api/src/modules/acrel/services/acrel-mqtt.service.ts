import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { PrismaService } from '../../../prisma/prisma.service';

interface MqttConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  clientId: string;
}

@Injectable()
export class AcrelMqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AcrelMqttService.name);
  private client: mqtt.MqttClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  // Topics
  private readonly topics = {
    meterReading: 'acrel/meters/+/reading',
    alerts: 'acrel/meters/+/alert',
    status: 'acrel/meters/+/status',
    commands: 'acrel/commands/+',
    commandResponse: 'acrel/commands/+/response',
  };

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // الاتصال فقط إذا كانت إعدادات MQTT متوفرة
    if (process.env.ACREL_MQTT_HOST) {
      await this.connect();
    } else {
      this.logger.warn('MQTT configuration not found, skipping connection');
    }
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * الاتصال بـ MQTT Broker
   */
  async connect(): Promise<void> {
    const config: MqttConfig = {
      host: process.env.ACREL_MQTT_HOST || 'localhost',
      port: parseInt(process.env.ACREL_MQTT_PORT || '1883'),
      username: process.env.ACREL_MQTT_USERNAME || '',
      password: process.env.ACREL_MQTT_PASSWORD || '',
      clientId: `developer-system-${Date.now()}`,
    };

    this.logger.log(`Connecting to MQTT broker at ${config.host}:${config.port}`);

    try {
      this.client = mqtt.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        clientId: config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      this.setupEventHandlers();
    } catch (error) {
      this.logger.error(`Failed to connect to MQTT: ${error.message}`);
    }
  }

  /**
   * إعداد معالجات الأحداث
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.logger.log('Connected to MQTT broker');
      this.subscribeToTopics();
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      this.logger.warn('Disconnected from MQTT broker');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });

    this.client.on('reconnect', () => {
      this.reconnectAttempts++;
      this.logger.log(`Reconnecting to MQTT broker (attempt ${this.reconnectAttempts})`);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.logger.error('Max reconnect attempts reached, stopping reconnection');
        this.client?.end();
      }
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message.toString());
    });
  }

  /**
   * الاشتراك في المواضيع
   */
  private subscribeToTopics(): void {
    if (!this.client) return;

    const topicsToSubscribe = [
      this.topics.meterReading,
      this.topics.alerts,
      this.topics.status,
      this.topics.commandResponse,
    ];

    topicsToSubscribe.forEach((topic) => {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to ${topic}: ${err.message}`);
        } else {
          this.logger.log(`Subscribed to ${topic}`);
        }
      });
    });
  }

  /**
   * معالجة الرسائل الواردة
   */
  private async handleMessage(topic: string, message: string): Promise<void> {
    this.logger.debug(`Received message on ${topic}: ${message}`);

    try {
      const data = JSON.parse(message);
      const topicParts = topic.split('/');

      if (topic.includes('/reading')) {
        await this.handleMeterReading(topicParts[2], data);
      } else if (topic.includes('/alert')) {
        await this.handleAlert(topicParts[2], data);
      } else if (topic.includes('/status')) {
        await this.handleStatusChange(topicParts[2], data);
      } else if (topic.includes('/response')) {
        await this.handleCommandResponse(topicParts[2], data);
      }
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`);
    }
  }

  /**
   * معالجة قراءة العداد
   */
  private async handleMeterReading(deviceId: string, data: any): Promise<void> {
    this.logger.log(`Processing MQTT meter reading for device ${deviceId}`);

    // تحديث أو إنشاء الجهاز
    const device = await this.prisma.devIotDevice.upsert({
      where: { deviceId },
      update: {
        isOnline: true,
        lastSeenAt: new Date(),
        metadata: data,
      },
      create: {
        deviceId,
        name: `Meter ${deviceId}`,
        deviceType: 'meter',
        manufacturer: 'acrel',
        status: 'active',
        isOnline: true,
        lastSeenAt: new Date(),
        metadata: data,
      },
    });

    // تسجيل القراءة
    await this.prisma.devIotReading.create({
      data: {
        deviceId: device.id,
        readingType: 'energy',
        value: data.reading || 0,
        unit: 'kWh',
        quality: 'good',
        timestamp: new Date(),
        rawData: data,
      },
    });

    // تسجيل الحدث
    await this.prisma.devEvent.create({
      data: {
        eventType: 'iot.mqtt_reading',
        sourceSystem: 'acrel_mqtt',
        payload: { deviceId, ...data },
        status: 'processed',
      },
    });
  }

  /**
   * معالجة التنبيه
   */
  private async handleAlert(deviceId: string, data: any): Promise<void> {
    this.logger.warn(`Processing MQTT alert for device ${deviceId}`);

    // البحث عن الجهاز
    const device = await this.prisma.devIotDevice.findUnique({
      where: { deviceId },
    });

    // البحث عن قاعدة التنبيه أو إنشاء واحدة
    const alertType = data.alertType || 'mqtt_alert';
    let alertRule = await this.prisma.devIotAlertRule.findFirst({
      where: { alertType },
    });

    if (!alertRule) {
      alertRule = await this.prisma.devIotAlertRule.create({
        data: {
          dataType: 'mqtt_alert',
          operator: 'eq',
          threshold: data.threshold || 0,
          alertType,
          severity: data.severity || 3,
          title: `MQTT Alert Rule - ${alertType}`,
          message: data.message || 'Alert from MQTT',
          isActive: true,
        },
      });
    }

    await this.prisma.devIotAlert.create({
      data: {
        ruleId: alertRule.id,
        deviceId: device?.id || deviceId,
        alertType,
        severity: data.severity || 3,
        title: `MQTT Alert: ${alertType}`,
        message: data.message || 'Alert from MQTT',
        value: data,
        threshold: data.threshold || 0,
        status: 'active',
      },
    });
  }

  /**
   * معالجة تغيير الحالة
   */
  private async handleStatusChange(deviceId: string, data: any): Promise<void> {
    this.logger.log(`Processing MQTT status change for device ${deviceId}`);

    await this.prisma.devIotDevice.updateMany({
      where: { deviceId },
      data: {
        status: data.status || 'registered',
        isOnline: data.status === 'online' || data.status === 'active',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * معالجة استجابة الأمر
   */
  private async handleCommandResponse(commandId: string, data: any): Promise<void> {
    this.logger.log(`Processing MQTT command response for command ${commandId}`);

    await this.prisma.devIotCommand.updateMany({
      where: { id: commandId },
      data: {
        status: data.success ? 'executed' : 'failed',
        response: data,
        executedAt: new Date(),
      },
    });
  }

  /**
   * نشر أمر
   */
  async publishCommand(deviceId: string, command: any): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const topic = `acrel/commands/${deviceId}`;
    const payload = JSON.stringify({ commandId, ...command });

    return new Promise((resolve, reject) => {
      this.client?.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Failed to publish command: ${err.message}`);
          reject(err);
        } else {
          this.logger.log(`Published command ${commandId} to ${topic}`);
          resolve(commandId);
        }
      });
    });
  }

  /**
   * قطع الاتصال
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      this.logger.log('Disconnected from MQTT broker');
    }
  }

  /**
   * الحصول على حالة الاتصال
   */
  getConnectionStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
