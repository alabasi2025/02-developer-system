import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { 
  IsString, 
  IsOptional, 
  IsEnum, 
  IsUrl, 
  IsObject, 
  IsInt, 
  Min, 
  Max,
  IsUUID,
  MaxLength
} from 'class-validator';
import { Type } from 'class-transformer';

export enum IntegrationType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  IOT = 'iot',
  PAYMENT = 'payment',
  SMS = 'sms',
  EMAIL = 'email',
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
}

export class CreateIntegrationDto {
  @ApiProperty({ description: 'اسم التكامل بالإنجليزية', example: 'Core System' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'اسم التكامل بالعربية', example: 'النظام الأم' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameAr?: string;

  @ApiProperty({ description: 'نوع التكامل', enum: IntegrationType, example: IntegrationType.INTERNAL })
  @IsEnum(IntegrationType)
  type: IntegrationType;

  @ApiPropertyOptional({ description: 'رابط API الأساسي', example: 'http://localhost:3001/api/v1' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'حالة التكامل', enum: IntegrationStatus, default: IntegrationStatus.ACTIVE })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @ApiPropertyOptional({ description: 'إعدادات إضافية' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'بيانات الاعتماد (مشفرة)' })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @ApiPropertyOptional({ description: 'نقطة فحص الصحة', example: '/health' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  healthEndpoint?: string;

  @ApiPropertyOptional({ description: 'عدد محاولات إعادة الاتصال', default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ description: 'مهلة الاتصال بالميلي ثانية', default: 30000, minimum: 1000, maximum: 120000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(120000)
  timeout?: number;

  @ApiPropertyOptional({ description: 'وصف التكامل' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {}

export class IntegrationResponseDto {
  @ApiProperty({ description: 'معرف التكامل' })
  id: string;

  @ApiProperty({ description: 'اسم التكامل' })
  name: string;

  @ApiPropertyOptional({ description: 'اسم التكامل بالعربية' })
  nameAr?: string;

  @ApiProperty({ description: 'نوع التكامل', enum: IntegrationType })
  type: string;

  @ApiPropertyOptional({ description: 'رابط API الأساسي' })
  baseUrl?: string;

  @ApiProperty({ description: 'حالة التكامل', enum: IntegrationStatus })
  status: string;

  @ApiPropertyOptional({ description: 'إعدادات إضافية' })
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'نقطة فحص الصحة' })
  healthEndpoint?: string;

  @ApiPropertyOptional({ description: 'آخر فحص صحة' })
  lastHealthCheck?: Date;

  @ApiPropertyOptional({ description: 'حالة آخر فحص صحة' })
  lastHealthStatus?: string;

  @ApiProperty({ description: 'عدد محاولات إعادة الاتصال' })
  retryCount: number;

  @ApiProperty({ description: 'مهلة الاتصال بالميلي ثانية' })
  timeout: number;

  @ApiPropertyOptional({ description: 'وصف التكامل' })
  description?: string;

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;

  @ApiProperty({ description: 'تاريخ التحديث' })
  updatedAt: Date;
}

export class TestIntegrationDto {
  @ApiPropertyOptional({ description: 'نقطة الاختبار المخصصة' })
  @IsOptional()
  @IsString()
  endpoint?: string;
}

export class TestIntegrationResponseDto {
  @ApiProperty({ description: 'حالة الاختبار' })
  success: boolean;

  @ApiProperty({ description: 'وقت الاستجابة بالميلي ثانية' })
  responseTime: number;

  @ApiPropertyOptional({ description: 'رسالة الخطأ' })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'تفاصيل الاستجابة' })
  details?: Record<string, any>;
}

export class IntegrationQueryDto {
  @ApiPropertyOptional({ description: 'نوع التكامل', enum: IntegrationType })
  @IsOptional()
  @IsEnum(IntegrationType)
  type?: IntegrationType;

  @ApiPropertyOptional({ description: 'حالة التكامل', enum: IntegrationStatus })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @ApiPropertyOptional({ description: 'رقم الصفحة', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'عدد العناصر في الصفحة', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
