import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AlertType {
  OVER_VOLTAGE = 'over_voltage',
  UNDER_VOLTAGE = 'under_voltage',
  OVER_CURRENT = 'over_current',
  POWER_FAILURE = 'power_failure',
  TAMPER = 'tamper',
  COMMUNICATION_FAILURE = 'communication_failure',
  METER_FAULT = 'meter_fault',
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAULT = 'fault',
  MAINTENANCE = 'maintenance',
}

export class MeterReadingDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'رقم العداد' })
  @IsString()
  meterNumber: string;

  @ApiProperty({ description: 'القراءة الحالية (kWh)' })
  @IsNumber()
  reading: number;

  @ApiProperty({ description: 'الطاقة الفعالة (kW)' })
  @IsNumber()
  activePower: number;

  @ApiProperty({ description: 'الطاقة غير الفعالة (kVAR)' })
  @IsNumber()
  @IsOptional()
  reactivePower?: number;

  @ApiProperty({ description: 'الجهد (V)' })
  @IsNumber()
  voltage: number;

  @ApiProperty({ description: 'التيار (A)' })
  @IsNumber()
  current: number;

  @ApiProperty({ description: 'معامل القدرة' })
  @IsNumber()
  @IsOptional()
  powerFactor?: number;

  @ApiProperty({ description: 'التردد (Hz)' })
  @IsNumber()
  @IsOptional()
  frequency?: number;

  @ApiProperty({ description: 'وقت القراءة' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class AlertDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'رقم العداد' })
  @IsString()
  meterNumber: string;

  @ApiProperty({ description: 'نوع التنبيه', enum: AlertType })
  @IsEnum(AlertType)
  alertType: AlertType;

  @ApiProperty({ description: 'مستوى الخطورة (1-5)' })
  @IsNumber()
  severity: number;

  @ApiProperty({ description: 'رسالة التنبيه' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'القيمة المسببة للتنبيه' })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiProperty({ description: 'الحد الأقصى/الأدنى المسموح' })
  @IsNumber()
  @IsOptional()
  threshold?: number;

  @ApiProperty({ description: 'وقت التنبيه' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class StatusChangeDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'رقم العداد' })
  @IsString()
  meterNumber: string;

  @ApiProperty({ description: 'الحالة السابقة', enum: DeviceStatus })
  @IsEnum(DeviceStatus)
  previousStatus: DeviceStatus;

  @ApiProperty({ description: 'الحالة الجديدة', enum: DeviceStatus })
  @IsEnum(DeviceStatus)
  newStatus: DeviceStatus;

  @ApiProperty({ description: 'سبب التغيير' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ description: 'وقت التغيير' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class DisconnectConfirmDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'رقم العداد' })
  @IsString()
  meterNumber: string;

  @ApiProperty({ description: 'معرف الأمر الأصلي' })
  @IsString()
  commandId: string;

  @ApiProperty({ description: 'نجاح العملية' })
  @IsString()
  status: 'success' | 'failed';

  @ApiProperty({ description: 'سبب الفشل (إن وجد)' })
  @IsString()
  @IsOptional()
  failureReason?: string;

  @ApiProperty({ description: 'القراءة النهائية قبل الفصل' })
  @IsNumber()
  @IsOptional()
  finalReading?: number;

  @ApiProperty({ description: 'وقت التنفيذ' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ReconnectConfirmDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'رقم العداد' })
  @IsString()
  meterNumber: string;

  @ApiProperty({ description: 'معرف الأمر الأصلي' })
  @IsString()
  commandId: string;

  @ApiProperty({ description: 'نجاح العملية' })
  @IsString()
  status: 'success' | 'failed';

  @ApiProperty({ description: 'سبب الفشل (إن وجد)' })
  @IsString()
  @IsOptional()
  failureReason?: string;

  @ApiProperty({ description: 'القراءة الأولى بعد الوصل' })
  @IsNumber()
  @IsOptional()
  initialReading?: number;

  @ApiProperty({ description: 'وقت التنفيذ' })
  @IsDateString()
  timestamp: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
