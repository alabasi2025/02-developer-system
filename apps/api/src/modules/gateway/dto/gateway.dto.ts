import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SystemType {
  CORE = 'core',
  ASSETS = 'assets',
  FIELD = 'field',
  SCADA = 'scada',
  INVENTORY = 'inventory',
  BILLING = 'billing',
  HR = 'hr',
  REPORTS = 'reports',
  PROJECTS = 'projects',
}

export class ProxyRequestDto {
  @ApiProperty({ description: 'النظام المستهدف', enum: SystemType })
  @IsEnum(SystemType)
  system: SystemType;

  @ApiProperty({ description: 'المسار في النظام المستهدف', example: '/customers' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ description: 'طريقة HTTP', default: 'GET' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ description: 'بيانات الطلب' })
  @IsOptional()
  @IsObject()
  body?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Headers إضافية' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Query parameters' })
  @IsOptional()
  @IsObject()
  query?: Record<string, any>;
}

export class ProxyResponseDto {
  @ApiProperty({ description: 'حالة الطلب' })
  success: boolean;

  @ApiProperty({ description: 'كود الاستجابة' })
  statusCode: number;

  @ApiPropertyOptional({ description: 'بيانات الاستجابة' })
  data?: any;

  @ApiPropertyOptional({ description: 'رسالة الخطأ' })
  error?: string;

  @ApiProperty({ description: 'وقت الاستجابة بالميلي ثانية' })
  responseTime: number;

  @ApiPropertyOptional({ description: 'هل الاستجابة من الكاش' })
  fromCache?: boolean;
}

export class RateLimitConfigDto {
  @ApiProperty({ description: 'المعرف (API key, IP, user)', example: 'dev_abc123' })
  @IsString()
  identifier: string;

  @ApiProperty({ description: 'نوع المعرف', example: 'api_key' })
  @IsString()
  identifierType: string;

  @ApiPropertyOptional({ description: 'نقطة النهاية المحددة' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiProperty({ description: 'حجم النافذة بالثواني', example: 3600 })
  @IsInt()
  @Min(60)
  @Max(86400)
  windowSize: number;

  @ApiProperty({ description: 'الحد الأقصى للطلبات', example: 1000 })
  @IsInt()
  @Min(1)
  @Max(100000)
  maxRequests: number;
}

export class RateLimitStatusDto {
  @ApiProperty({ description: 'المعرف' })
  identifier: string;

  @ApiProperty({ description: 'الطلبات المتبقية' })
  remaining: number;

  @ApiProperty({ description: 'الحد الأقصى' })
  limit: number;

  @ApiProperty({ description: 'وقت إعادة التعيين' })
  resetAt: Date;

  @ApiProperty({ description: 'هل تم تجاوز الحد' })
  exceeded: boolean;
}

export class RequestLogQueryDto {
  @ApiPropertyOptional({ description: 'النظام المصدر' })
  @IsOptional()
  @IsString()
  sourceSystem?: string;

  @ApiPropertyOptional({ description: 'المسار' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: 'كود الاستجابة' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ description: 'من تاريخ' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'إلى تاريخ' })
  @IsOptional()
  @IsString()
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

export class RequestLogResponseDto {
  @ApiProperty({ description: 'معرف السجل' })
  id: string;

  @ApiProperty({ description: 'طريقة HTTP' })
  method: string;

  @ApiProperty({ description: 'المسار' })
  path: string;

  @ApiProperty({ description: 'النظام المصدر' })
  sourceSystem: string;

  @ApiPropertyOptional({ description: 'عنوان IP' })
  sourceIp?: string;

  @ApiProperty({ description: 'كود الاستجابة' })
  statusCode: number;

  @ApiProperty({ description: 'وقت الاستجابة' })
  responseTime: number;

  @ApiProperty({ description: 'تاريخ الطلب' })
  createdAt: Date;
}

export class SystemHealthDto {
  @ApiProperty({ description: 'معرف النظام' })
  systemId: string;

  @ApiProperty({ description: 'اسم النظام' })
  name: string;

  @ApiProperty({ description: 'حالة النظام' })
  status: string;

  @ApiPropertyOptional({ description: 'وقت الاستجابة' })
  responseTime?: number;

  @ApiPropertyOptional({ description: 'آخر فحص' })
  lastCheck?: Date;

  @ApiPropertyOptional({ description: 'رسالة الخطأ' })
  error?: string;
}
