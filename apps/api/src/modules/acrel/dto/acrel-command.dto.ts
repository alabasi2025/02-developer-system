import { IsString, IsNumber, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CommandPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class DisconnectCommandDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'سبب الفصل' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'أولوية الأمر', enum: CommandPriority, default: CommandPriority.NORMAL })
  @IsEnum(CommandPriority)
  @IsOptional()
  priority?: CommandPriority;

  @ApiProperty({ description: 'معرف المستخدم المنفذ' })
  @IsString()
  @IsOptional()
  executedBy?: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ReconnectCommandDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'سبب الوصل' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'أولوية الأمر', enum: CommandPriority, default: CommandPriority.NORMAL })
  @IsEnum(CommandPriority)
  @IsOptional()
  priority?: CommandPriority;

  @ApiProperty({ description: 'معرف المستخدم المنفذ' })
  @IsString()
  @IsOptional()
  executedBy?: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ReadMeterCommandDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'نوع القراءة المطلوبة' })
  @IsString()
  @IsOptional()
  readingType?: 'instant' | 'daily' | 'monthly';

  @ApiProperty({ description: 'أولوية الأمر', enum: CommandPriority, default: CommandPriority.NORMAL })
  @IsEnum(CommandPriority)
  @IsOptional()
  priority?: CommandPriority;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class SetParameterCommandDto {
  @ApiProperty({ description: 'معرف الجهاز' })
  @IsString()
  deviceId: string;

  @ApiProperty({ description: 'اسم الإعداد' })
  @IsString()
  parameterName: string;

  @ApiProperty({ description: 'القيمة الجديدة' })
  @IsString()
  parameterValue: string;

  @ApiProperty({ description: 'أولوية الأمر', enum: CommandPriority, default: CommandPriority.NORMAL })
  @IsEnum(CommandPriority)
  @IsOptional()
  priority?: CommandPriority;

  @ApiProperty({ description: 'معرف المستخدم المنفذ' })
  @IsString()
  @IsOptional()
  executedBy?: string;

  @ApiProperty({ description: 'بيانات إضافية' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
