import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';

export interface RegisterDeviceDto {
  deviceId: string;
  deviceType: string;
  name: string;
  nameAr?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
    zone?: string;
  };
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DeviceDataDto {
  deviceId: string;
  dataType: string;
  value: number | string | boolean | Record<string, any>;
  unit?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface DeviceCommandDto {
  deviceId: string;
  command: string;
  parameters?: Record<string, any>;
  priority?: number;
  expiresAt?: string;
}

@Injectable()
export class IotService {
  private readonly logger = new Logger(IotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  // ==================== Device Management ====================

  async registerDevice(dto: RegisterDeviceDto) {
    // Check if device already exists
    const existing = await this.prisma.devIotDevice.findUnique({
      where: { deviceId: dto.deviceId },
    });

    if (existing) {
      throw new BadRequestException(`الجهاز مسجل مسبقاً: ${dto.deviceId}`);
    }

    const device = await this.prisma.devIotDevice.create({
      data: {
        deviceId: dto.deviceId,
        deviceType: dto.deviceType,
        name: dto.name,
        nameAr: dto.nameAr,
        manufacturer: dto.manufacturer,
        model: dto.model,
        firmwareVersion: dto.firmwareVersion,
        location: dto.location || {},
        config: dto.config || {},
        metadata: dto.metadata || {},
        status: 'registered',
        isOnline: false,
      },
    });

    // Publish event
    await this.eventsService.publish({
      eventType: 'iot.device.registered',
      sourceSystem: 'developer',
      aggregateId: device.id,
      aggregateType: 'device',
      payload: {
        deviceId: dto.deviceId,
        deviceType: dto.deviceType,
        name: dto.name,
      },
    });

    return device;
  }

  async findAllDevices(query: {
    deviceType?: string;
    status?: string;
    isOnline?: boolean;
    zone?: string;
    page?: number;
    limit?: number;
  }) {
    const { deviceType, status, isOnline, zone, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (deviceType) where.deviceType = deviceType;
    if (status) where.status = status;
    if (isOnline !== undefined) where.isOnline = isOnline;
    if (zone) where.location = { path: ['zone'], equals: zone };

    const [devices, total] = await Promise.all([
      this.prisma.devIotDevice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devIotDevice.count({ where }),
    ]);

    return {
      data: devices,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneDevice(id: string) {
    const device = await this.prisma.devIotDevice.findUnique({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException(`الجهاز غير موجود: ${id}`);
    }

    return device;
  }

  async findDeviceByDeviceId(deviceId: string) {
    const device = await this.prisma.devIotDevice.findUnique({
      where: { deviceId },
    });

    if (!device) {
      throw new NotFoundException(`الجهاز غير موجود: ${deviceId}`);
    }

    return device;
  }

  async updateDevice(id: string, data: Partial<RegisterDeviceDto>) {
    const existing = await this.prisma.devIotDevice.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`الجهاز غير موجود: ${id}`);
    }

    const updated = await this.prisma.devIotDevice.update({
      where: { id },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        manufacturer: data.manufacturer,
        model: data.model,
        firmwareVersion: data.firmwareVersion,
        location: data.location,
        config: data.config,
        metadata: data.metadata,
      },
    });

    return updated;
  }

  async deleteDevice(id: string) {
    const existing = await this.prisma.devIotDevice.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`الجهاز غير موجود: ${id}`);
    }

    await this.prisma.devIotDevice.update({
      where: { id },
      data: { status: 'decommissioned' },
    });

    // Publish event
    await this.eventsService.publish({
      eventType: 'iot.device.decommissioned',
      sourceSystem: 'developer',
      aggregateId: id,
      aggregateType: 'device',
      payload: { deviceId: existing.deviceId },
    });

    return { message: 'تم إلغاء تسجيل الجهاز بنجاح', id };
  }

  // ==================== Device Data ====================

  async ingestData(dto: DeviceDataDto) {
    // Find device
    const device = await this.prisma.devIotDevice.findUnique({
      where: { deviceId: dto.deviceId },
    });

    if (!device) {
      throw new NotFoundException(`الجهاز غير موجود: ${dto.deviceId}`);
    }

    // Store data
    const data = await this.prisma.devIotData.create({
      data: {
        deviceId: device.id,
        dataType: dto.dataType,
        value: dto.value as any,
        unit: dto.unit,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
        metadata: dto.metadata || {},
      },
    });

    // Update device status
    await this.prisma.devIotDevice.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
        status: 'active',
      },
    });

    // Check for alerts
    await this.checkDataAlerts(device, dto);

    // Publish event for real-time processing
    await this.eventsService.publish({
      eventType: 'iot.data.received',
      sourceSystem: 'developer',
      aggregateId: device.id,
      aggregateType: 'device',
      payload: {
        deviceId: dto.deviceId,
        dataType: dto.dataType,
        value: dto.value,
        unit: dto.unit,
        timestamp: data.timestamp,
      },
      priority: 3, // High priority for real-time data
    });

    return { id: data.id, received: true };
  }

  async ingestBulkData(data: DeviceDataDto[]) {
    const results = await Promise.all(
      data.map(d => this.ingestData(d).catch(e => ({ error: e.message, deviceId: d.deviceId }))),
    );

    const successful = results.filter(r => !('error' in r)).length;
    const failed = results.filter(r => 'error' in r);

    return {
      total: data.length,
      successful,
      failed: failed.length,
      errors: failed,
    };
  }

  async getDeviceData(deviceId: string, query: {
    dataType?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const device = await this.findDeviceByDeviceId(deviceId);
    const { dataType, fromDate, toDate, page = 1, limit = 100 } = query;
    const skip = (page - 1) * limit;

    const where: any = { deviceId: device.id };
    if (dataType) where.dataType = dataType;
    if (fromDate || toDate) {
      where.timestamp = {};
      if (fromDate) where.timestamp.gte = new Date(fromDate);
      if (toDate) where.timestamp.lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.devIotData.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.devIotData.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLatestData(deviceId: string, dataTypes?: string[]) {
    const device = await this.findDeviceByDeviceId(deviceId);

    const where: any = { deviceId: device.id };
    if (dataTypes && dataTypes.length > 0) {
      where.dataType = { in: dataTypes };
    }

    // Get latest data for each data type
    const latestData = await this.prisma.devIotData.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      distinct: ['dataType'],
    });

    return latestData;
  }

  // ==================== Device Commands ====================

  async sendCommand(dto: DeviceCommandDto) {
    const device = await this.findDeviceByDeviceId(dto.deviceId);

    if (!device.isOnline) {
      this.logger.warn(`Device ${dto.deviceId} is offline, command will be queued`);
    }

    const command = await this.prisma.devIotCommand.create({
      data: {
        deviceId: device.id,
        command: dto.command,
        parameters: dto.parameters || {},
        priority: dto.priority || 5,
        status: 'pending',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    // Publish event for command delivery
    await this.eventsService.publish({
      eventType: 'iot.command.sent',
      sourceSystem: 'developer',
      aggregateId: command.id,
      aggregateType: 'command',
      payload: {
        commandId: command.id,
        deviceId: dto.deviceId,
        command: dto.command,
        parameters: dto.parameters,
      },
      priority: dto.priority || 5,
    });

    return {
      commandId: command.id,
      status: device.isOnline ? 'sent' : 'queued',
      deviceOnline: device.isOnline,
    };
  }

  async getDeviceCommands(deviceId: string, query: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const device = await this.findDeviceByDeviceId(deviceId);
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { deviceId: device.id };
    if (status) where.status = status;

    const [commands, total] = await Promise.all([
      this.prisma.devIotCommand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devIotCommand.count({ where }),
    ]);

    return {
      data: commands,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async acknowledgeCommand(commandId: string, response?: any) {
    const command = await this.prisma.devIotCommand.findUnique({
      where: { id: commandId },
    });

    if (!command) {
      throw new NotFoundException(`الأمر غير موجود: ${commandId}`);
    }

    const updated = await this.prisma.devIotCommand.update({
      where: { id: commandId },
      data: {
        status: 'executed',
        executedAt: new Date(),
        response,
      },
    });

    // Publish event
    await this.eventsService.publish({
      eventType: 'iot.command.executed',
      sourceSystem: 'developer',
      aggregateId: commandId,
      aggregateType: 'command',
      payload: {
        commandId,
        status: 'executed',
        response,
      },
    });

    return updated;
  }

  // ==================== Alerts ====================

  private async checkDataAlerts(device: any, data: DeviceDataDto) {
    // Get alert rules for this device type
    const rules = await this.prisma.devIotAlertRule.findMany({
      where: {
        OR: [
          { deviceId: device.id },
          { deviceType: device.deviceType },
        ],
        dataType: data.dataType,
        isActive: true,
      },
    });

    for (const rule of rules) {
      const triggered = this.evaluateAlertRule(rule, data.value);
      
      if (triggered) {
        await this.createIotAlert(device, data, rule);
      }
    }
  }

  private evaluateAlertRule(rule: any, value: any): boolean {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    const threshold = rule.threshold;

    switch (rule.operator) {
      case 'gt': return numValue > threshold;
      case 'gte': return numValue >= threshold;
      case 'lt': return numValue < threshold;
      case 'lte': return numValue <= threshold;
      case 'eq': return numValue === threshold;
      case 'neq': return numValue !== threshold;
      default: return false;
    }
  }

  private async createIotAlert(device: any, data: DeviceDataDto, rule: any) {
    const alert = await this.prisma.devIotAlert.create({
      data: {
        deviceId: device.id,
        ruleId: rule.id,
        alertType: rule.alertType,
        severity: rule.severity,
        title: rule.title || `تنبيه: ${data.dataType}`,
        message: rule.message || `القيمة ${data.value} تجاوزت الحد ${rule.threshold}`,
        value: data.value as any,
        threshold: rule.threshold,
        status: 'active',
      },
    });

    // Publish event
    await this.eventsService.publish({
      eventType: 'iot.alert.triggered',
      sourceSystem: 'developer',
      aggregateId: alert.id,
      aggregateType: 'alert',
      payload: {
        alertId: alert.id,
        deviceId: device.deviceId,
        alertType: rule.alertType,
        severity: rule.severity,
        value: data.value,
        threshold: rule.threshold,
      },
      priority: rule.severity <= 2 ? 1 : 3, // High priority for critical alerts
    });

    return alert;
  }

  // ==================== Alert Rules ====================

  async createAlertRule(data: {
    deviceId?: string;
    deviceType?: string;
    dataType: string;
    operator: string;
    threshold: number;
    alertType: string;
    severity: number;
    title?: string;
    message?: string;
  }) {
    return this.prisma.devIotAlertRule.create({
      data: {
        deviceId: data.deviceId,
        deviceType: data.deviceType,
        dataType: data.dataType,
        operator: data.operator,
        threshold: data.threshold,
        alertType: data.alertType,
        severity: data.severity,
        title: data.title,
        message: data.message,
        isActive: true,
      },
    });
  }

  async findAllAlertRules(query: { deviceType?: string; isActive?: boolean }) {
    const where: any = {};
    if (query.deviceType) where.deviceType = query.deviceType;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.prisma.devIotAlertRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeviceAlerts(deviceId: string, query: {
    status?: string;
    severity?: number;
    page?: number;
    limit?: number;
  }) {
    const device = await this.findDeviceByDeviceId(deviceId);
    const { status, severity, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { deviceId: device.id };
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [alerts, total] = await Promise.all([
      this.prisma.devIotAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.devIotAlert.count({ where }),
    ]);

    return {
      data: alerts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
