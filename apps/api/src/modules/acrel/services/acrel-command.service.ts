import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../../prisma/prisma.service';
import { AcrelMqttService } from './acrel-mqtt.service';
import { AcrelSecurityService } from './acrel-security.service';
import {
  DisconnectCommandDto,
  ReconnectCommandDto,
  ReadMeterCommandDto,
  SetParameterCommandDto,
  CommandPriority,
} from '../dto/acrel-command.dto';
import { firstValueFrom } from 'rxjs';

interface CommandResult {
  commandId: string;
  status: string;
}

@Injectable()
export class AcrelCommandService {
  private readonly logger = new Logger(AcrelCommandService.name);
  private readonly acrelApiUrl = process.env.ACREL_API_URL || 'https://api.acrel.com/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly mqttService: AcrelMqttService,
    private readonly securityService: AcrelSecurityService,
  ) {}

  /**
   * إرسال أمر فصل العداد
   */
  async sendDisconnectCommand(data: DisconnectCommandDto): Promise<CommandResult> {
    this.logger.log(`Sending disconnect command to device ${data.deviceId}`);

    const command = await this.createCommand('disconnect', data.deviceId, data);
    
    try {
      // محاولة إرسال عبر MQTT أولاً
      const mqttStatus = this.mqttService.getConnectionStatus();
      if (mqttStatus.connected) {
        await this.mqttService.publishCommand(data.deviceId, {
          type: 'disconnect',
          reason: data.reason,
          priority: data.priority || CommandPriority.NORMAL,
        });
      } else {
        // إرسال عبر HTTP API
        await this.sendHttpCommand('disconnect', data.deviceId, data);
      }

      await this.updateCommandStatus(command.id, 'sent');
      return { commandId: command.id, status: 'sent' };
    } catch (error) {
      await this.updateCommandStatus(command.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * إرسال أمر وصل العداد
   */
  async sendReconnectCommand(data: ReconnectCommandDto): Promise<CommandResult> {
    this.logger.log(`Sending reconnect command to device ${data.deviceId}`);

    const command = await this.createCommand('reconnect', data.deviceId, data);
    
    try {
      const mqttStatus = this.mqttService.getConnectionStatus();
      if (mqttStatus.connected) {
        await this.mqttService.publishCommand(data.deviceId, {
          type: 'reconnect',
          reason: data.reason,
          priority: data.priority || CommandPriority.NORMAL,
        });
      } else {
        await this.sendHttpCommand('reconnect', data.deviceId, data);
      }

      await this.updateCommandStatus(command.id, 'sent');
      return { commandId: command.id, status: 'sent' };
    } catch (error) {
      await this.updateCommandStatus(command.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * إرسال أمر قراءة العداد
   */
  async sendReadMeterCommand(data: ReadMeterCommandDto): Promise<CommandResult> {
    this.logger.log(`Sending read meter command to device ${data.deviceId}`);

    const command = await this.createCommand('read_meter', data.deviceId, data);
    
    try {
      const mqttStatus = this.mqttService.getConnectionStatus();
      if (mqttStatus.connected) {
        await this.mqttService.publishCommand(data.deviceId, {
          type: 'read_meter',
          readingType: data.readingType || 'instant',
        });
      } else {
        await this.sendHttpCommand('read', data.deviceId, data);
      }

      await this.updateCommandStatus(command.id, 'sent');
      return { commandId: command.id, status: 'sent' };
    } catch (error) {
      await this.updateCommandStatus(command.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * إرسال أمر تعديل إعدادات العداد
   */
  async sendSetParameterCommand(data: SetParameterCommandDto): Promise<CommandResult> {
    this.logger.log(`Sending set parameter command to device ${data.deviceId}`);

    const command = await this.createCommand('set_parameter', data.deviceId, data);
    
    try {
      const mqttStatus = this.mqttService.getConnectionStatus();
      if (mqttStatus.connected) {
        await this.mqttService.publishCommand(data.deviceId, {
          type: 'set_parameter',
          parameterName: data.parameterName,
          parameterValue: data.parameterValue,
        });
      } else {
        await this.sendHttpCommand('configure', data.deviceId, data);
      }

      await this.updateCommandStatus(command.id, 'sent');
      return { commandId: command.id, status: 'sent' };
    } catch (error) {
      await this.updateCommandStatus(command.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * الحصول على حالة أمر
   */
  async getCommandStatus(commandId: string): Promise<any> {
    const command = await this.prisma.devIotCommand.findUnique({
      where: { id: commandId },
    });

    if (!command) {
      return { status: 'not_found' };
    }

    return {
      status: command.status,
      command: command.command,
      deviceId: command.deviceId,
      createdAt: command.createdAt,
      executedAt: command.executedAt,
      response: command.response,
    };
  }

  /**
   * الحصول على قائمة الأوامر المعلقة
   */
  async getPendingCommands(): Promise<any[]> {
    const commands = await this.prisma.devIotCommand.findMany({
      where: {
        status: { in: ['pending', 'sent'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return commands;
  }

  /**
   * إنشاء سجل أمر في قاعدة البيانات
   */
  private async createCommand(commandType: string, deviceId: string, data: any): Promise<any> {
    // البحث عن الجهاز في قاعدة البيانات
    const device = await this.prisma.devIotDevice.findUnique({
      where: { deviceId },
    });

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    return this.prisma.devIotCommand.create({
      data: {
        deviceId: device.id,
        command: commandType,
        parameters: data,
        status: 'pending',
        priority: this.mapPriority(data.priority),
      },
    });
  }

  /**
   * تحويل الأولوية إلى رقم
   */
  private mapPriority(priority?: string): number {
    const priorityMap: Record<string, number> = {
      [CommandPriority.LOW]: 7,
      [CommandPriority.NORMAL]: 5,
      [CommandPriority.HIGH]: 3,
      [CommandPriority.CRITICAL]: 1,
    };
    return priorityMap[priority || CommandPriority.NORMAL] || 5;
  }

  /**
   * تحديث حالة الأمر
   */
  private async updateCommandStatus(commandId: string, status: string, error?: string): Promise<void> {
    await this.prisma.devIotCommand.update({
      where: { id: commandId },
      data: {
        status,
        ...(error && { response: { error } }),
        ...(status === 'executed' || status === 'failed' ? { executedAt: new Date() } : {}),
      },
    });
  }

  /**
   * إرسال أمر عبر HTTP API
   */
  private async sendHttpCommand(action: string, deviceId: string, data: any): Promise<void> {
    const { signature, timestamp } = this.securityService.signOutgoingRequest(data);

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.acrelApiUrl}/devices/${deviceId}/${action}`,
          data,
          {
            headers: {
              'X-Developer-Signature': signature,
              'X-Developer-Timestamp': timestamp,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        ),
      );
    } catch (error) {
      this.logger.error(`HTTP command failed: ${error.message}`);
      throw error;
    }
  }
}
