import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsObject,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsUrl,
  IsBoolean,
  IsArray,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ==================== Event DTOs ====================

export class PublishEventDto {
  @ApiProperty({ description: 'نوع الحدث', example: 'customer.created' })
  @IsString()
  @MaxLength(100)
  eventType: string;

  @ApiProperty({ description: 'النظام المصدر', example: 'billing' })
  @IsString()
  @MaxLength(50)
  sourceSystem: string;

  @ApiPropertyOptional({ description: 'النظام الهدف' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetSystem?: string;

  @ApiPropertyOptional({ description: 'معرف الكيان المرتبط' })
  @IsOptional()
  @IsUUID()
  aggregateId?: string;

  @ApiPropertyOptional({ description: 'نوع الكيان', example: 'customer' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  aggregateType?: string;

  @ApiProperty({ description: 'بيانات الحدث' })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: 'بيانات إضافية' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'الأولوية (1-10، 1 الأعلى)', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'جدولة الحدث لوقت محدد' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class EventResponseDto {
  @ApiProperty({ description: 'معرف الحدث' })
  id: string;

  @ApiProperty({ description: 'نوع الحدث' })
  eventType: string;

  @ApiProperty({ description: 'النظام المصدر' })
  sourceSystem: string;

  @ApiPropertyOptional({ description: 'النظام الهدف' })
  targetSystem?: string;

  @ApiPropertyOptional({ description: 'معرف الكيان المرتبط' })
  aggregateId?: string;

  @ApiPropertyOptional({ description: 'نوع الكيان' })
  aggregateType?: string;

  @ApiProperty({ description: 'بيانات الحدث' })
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: 'بيانات إضافية' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'حالة الحدث', enum: EventStatus })
  status: string;

  @ApiProperty({ description: 'الأولوية' })
  priority: number;

  @ApiPropertyOptional({ description: 'تاريخ المعالجة' })
  processedAt?: Date;

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;
}

export class EventQueryDto {
  @ApiPropertyOptional({ description: 'نوع الحدث' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'النظام المصدر' })
  @IsOptional()
  @IsString()
  sourceSystem?: string;

  @ApiPropertyOptional({ description: 'حالة الحدث', enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'معرف الكيان' })
  @IsOptional()
  @IsUUID()
  aggregateId?: string;

  @ApiPropertyOptional({ description: 'من تاريخ' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'رقم الصفحة', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

// ==================== Subscription DTOs ====================

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'نوع الحدث للاشتراك (يدعم * للكل)', example: 'customer.*' })
  @IsString()
  @MaxLength(100)
  eventType: string;

  @ApiProperty({ description: 'النظام المستهدف', example: 'billing' })
  @IsString()
  @MaxLength(50)
  targetSystem: string;

  @ApiPropertyOptional({ description: 'رابط Webhook للإشعار' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  webhookUrl?: string;

  @ApiPropertyOptional({ description: 'طريقة HTTP', default: 'POST' })
  @IsOptional()
  @IsString()
  httpMethod?: string;

  @ApiPropertyOptional({ description: 'Headers مخصصة' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'مفتاح سري للتوقيع' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  secret?: string;

  @ApiPropertyOptional({ description: 'قواعد الفلترة' })
  @IsOptional()
  @IsObject()
  filterRules?: Record<string, any>;

  @ApiPropertyOptional({ description: 'قواعد التحويل' })
  @IsOptional()
  @IsObject()
  transformRules?: Record<string, any>;
}

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {
  @ApiPropertyOptional({ description: 'حالة التفعيل' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubscriptionResponseDto {
  @ApiProperty({ description: 'معرف الاشتراك' })
  id: string;

  @ApiProperty({ description: 'نوع الحدث' })
  eventType: string;

  @ApiProperty({ description: 'النظام المستهدف' })
  targetSystem: string;

  @ApiPropertyOptional({ description: 'رابط Webhook' })
  webhookUrl?: string;

  @ApiProperty({ description: 'طريقة HTTP' })
  httpMethod: string;

  @ApiProperty({ description: 'حالة التفعيل' })
  isActive: boolean;

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;

  @ApiProperty({ description: 'تاريخ التحديث' })
  updatedAt: Date;
}

export class SubscriptionQueryDto {
  @ApiPropertyOptional({ description: 'نوع الحدث' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: 'النظام المستهدف' })
  @IsOptional()
  @IsString()
  targetSystem?: string;

  @ApiPropertyOptional({ description: 'حالة التفعيل' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'رقم الصفحة', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

// ==================== Event Delivery DTOs ====================

export class EventDeliveryResponseDto {
  @ApiProperty({ description: 'معرف التسليم' })
  id: string;

  @ApiProperty({ description: 'معرف الحدث' })
  eventId: string;

  @ApiProperty({ description: 'معرف الاشتراك' })
  subscriptionId: string;

  @ApiProperty({ description: 'حالة التسليم' })
  status: string;

  @ApiProperty({ description: 'عدد المحاولات' })
  attempts: number;

  @ApiPropertyOptional({ description: 'كود الاستجابة' })
  responseCode?: number;

  @ApiPropertyOptional({ description: 'رسالة الخطأ' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'تاريخ التسليم' })
  deliveredAt?: Date;

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;
}
