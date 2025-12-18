import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsIP,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateApiKeyDto {
  @ApiPropertyOptional({ description: 'معرف التكامل المرتبط' })
  @IsOptional()
  @IsUUID()
  integrationId?: string;

  @ApiProperty({ description: 'معرف النظام', example: 'core' })
  @IsString()
  @MaxLength(50)
  systemId: string;

  @ApiProperty({ description: 'اسم المفتاح', example: 'Core System API Key' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    description: 'الصلاحيات المسموحة', 
    example: ['read:integrations', 'write:events'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  permissions: string[];

  @ApiPropertyOptional({ description: 'حد الطلبات في الساعة', default: 1000 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  rateLimit?: number;

  @ApiPropertyOptional({ description: 'تاريخ انتهاء الصلاحية' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ 
    description: 'قائمة عناوين IP المسموح بها',
    example: ['192.168.1.1', '10.0.0.0/24'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  ipWhitelist?: string[];
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ description: 'اسم المفتاح' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'الصلاحيات المسموحة', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  permissions?: string[];

  @ApiPropertyOptional({ description: 'حد الطلبات في الساعة' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100000)
  rateLimit?: number;

  @ApiPropertyOptional({ description: 'تاريخ انتهاء الصلاحية' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'قائمة عناوين IP المسموح بها', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  ipWhitelist?: string[];

  @ApiPropertyOptional({ description: 'حالة التفعيل' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ApiKeyResponseDto {
  @ApiProperty({ description: 'معرف المفتاح' })
  id: string;

  @ApiPropertyOptional({ description: 'معرف التكامل المرتبط' })
  integrationId?: string;

  @ApiProperty({ description: 'معرف النظام' })
  systemId: string;

  @ApiProperty({ description: 'اسم المفتاح' })
  name: string;

  @ApiProperty({ description: 'بادئة المفتاح (للتعريف)' })
  keyPrefix: string;

  @ApiProperty({ description: 'الصلاحيات المسموحة', type: [String] })
  permissions: string[];

  @ApiProperty({ description: 'حد الطلبات في الساعة' })
  rateLimit: number;

  @ApiPropertyOptional({ description: 'تاريخ انتهاء الصلاحية' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'آخر استخدام' })
  lastUsedAt?: Date;

  @ApiProperty({ description: 'عدد مرات الاستخدام' })
  usageCount: number;

  @ApiProperty({ description: 'حالة التفعيل' })
  isActive: boolean;

  @ApiProperty({ description: 'قائمة عناوين IP المسموح بها', type: [String] })
  ipWhitelist: string[];

  @ApiProperty({ description: 'تاريخ الإنشاء' })
  createdAt: Date;
}

export class ApiKeyCreatedResponseDto extends ApiKeyResponseDto {
  @ApiProperty({ description: 'المفتاح الكامل (يظهر مرة واحدة فقط)' })
  key: string;
}

export class RotateApiKeyResponseDto {
  @ApiProperty({ description: 'معرف المفتاح' })
  id: string;

  @ApiProperty({ description: 'المفتاح الجديد' })
  newKey: string;

  @ApiProperty({ description: 'بادئة المفتاح الجديدة' })
  keyPrefix: string;

  @ApiProperty({ description: 'رسالة' })
  message: string;
}

export class ApiKeyQueryDto {
  @ApiPropertyOptional({ description: 'معرف النظام' })
  @IsOptional()
  @IsString()
  systemId?: string;

  @ApiPropertyOptional({ description: 'معرف التكامل' })
  @IsOptional()
  @IsUUID()
  integrationId?: string;

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

  @ApiPropertyOptional({ description: 'عدد العناصر في الصفحة', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class ValidateApiKeyDto {
  @ApiProperty({ description: 'مفتاح API للتحقق' })
  @IsString()
  apiKey: string;

  @ApiPropertyOptional({ description: 'الصلاحية المطلوبة' })
  @IsOptional()
  @IsString()
  requiredPermission?: string;
}

export class ValidateApiKeyResponseDto {
  @ApiProperty({ description: 'هل المفتاح صالح' })
  valid: boolean;

  @ApiPropertyOptional({ description: 'معرف النظام' })
  systemId?: string;

  @ApiPropertyOptional({ description: 'الصلاحيات', type: [String] })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'رسالة الخطأ' })
  error?: string;
}
