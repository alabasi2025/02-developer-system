import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ExternalApiService, ExternalIntegrationType } from './external-api.service';
import { IsString, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CreateExternalIntegrationDto {
  @ApiProperty({ description: 'اسم التكامل' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'اسم التكامل بالعربية' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiProperty({ enum: ExternalIntegrationType, description: 'نوع التكامل' })
  @IsEnum(ExternalIntegrationType)
  type: ExternalIntegrationType;

  @ApiProperty({ description: 'عنوان API الأساسي' })
  @IsString()
  baseUrl: string;

  @ApiPropertyOptional({ description: 'إعدادات التكامل' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'بيانات الاعتماد' })
  @IsObject()
  @IsOptional()
  credentials?: Record<string, any>;

  @ApiPropertyOptional({ description: 'مسار فحص الصحة' })
  @IsString()
  @IsOptional()
  healthEndpoint?: string;

  @ApiPropertyOptional({ description: 'مهلة الطلب بالمللي ثانية' })
  @IsNumber()
  @IsOptional()
  timeout?: number;

  @ApiPropertyOptional({ description: 'عدد محاولات إعادة الطلب' })
  @IsNumber()
  @IsOptional()
  retryCount?: number;

  @ApiPropertyOptional({ description: 'وصف التكامل' })
  @IsString()
  @IsOptional()
  description?: string;
}

class ExternalApiRequestDto {
  @ApiProperty({ description: 'طريقة HTTP', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] })
  @IsString()
  method: string;

  @ApiProperty({ description: 'مسار الطلب' })
  @IsString()
  path: string;

  @ApiPropertyOptional({ description: 'بيانات الطلب' })
  @IsObject()
  @IsOptional()
  data?: any;

  @ApiPropertyOptional({ description: 'رؤوس إضافية' })
  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'مهلة الطلب' })
  @IsNumber()
  @IsOptional()
  timeout?: number;
}

@ApiTags('External APIs - واجهات التكاملات الخارجية')
@Controller('external')
export class ExternalApiController {
  constructor(private readonly externalApiService: ExternalApiService) {}

  @Post('integrations')
  @ApiOperation({ summary: 'إنشاء تكامل خارجي جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء التكامل بنجاح' })
  async createIntegration(@Body() dto: CreateExternalIntegrationDto) {
    return this.externalApiService.createIntegration(dto);
  }

  @Get('integrations')
  @ApiOperation({ summary: 'الحصول على جميع التكاملات الخارجية' })
  @ApiQuery({ name: 'type', enum: ExternalIntegrationType, required: false })
  @ApiResponse({ status: 200, description: 'قائمة التكاملات' })
  async getIntegrations(@Query('type') type?: ExternalIntegrationType) {
    return this.externalApiService.getExternalIntegrations(type);
  }

  @Get('integrations/health')
  @ApiOperation({ summary: 'فحص صحة جميع التكاملات الخارجية' })
  @ApiResponse({ status: 200, description: 'حالة صحة التكاملات' })
  async checkAllHealth() {
    return this.externalApiService.checkAllIntegrationsHealth();
  }

  @Get('integrations/:id/health')
  @ApiOperation({ summary: 'فحص صحة تكامل محدد' })
  @ApiParam({ name: 'id', description: 'معرف التكامل' })
  @ApiResponse({ status: 200, description: 'حالة صحة التكامل' })
  async checkHealth(@Param('id') id: string) {
    return this.externalApiService.checkIntegrationHealth(id);
  }

  @Get('integrations/:id/logs')
  @ApiOperation({ summary: 'الحصول على سجلات تكامل' })
  @ApiParam({ name: 'id', description: 'معرف التكامل' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'سجلات التكامل' })
  async getLogs(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
  ) {
    return this.externalApiService.getIntegrationLogs(id, { limit, offset, status });
  }

  @Put('integrations/:id')
  @ApiOperation({ summary: 'تحديث تكامل خارجي' })
  @ApiParam({ name: 'id', description: 'معرف التكامل' })
  @ApiResponse({ status: 200, description: 'تم تحديث التكامل' })
  async updateIntegration(
    @Param('id') id: string,
    @Body() dto: Partial<CreateExternalIntegrationDto>,
  ) {
    return this.externalApiService.updateIntegration(id, dto);
  }

  @Delete('integrations/:id')
  @ApiOperation({ summary: 'حذف تكامل خارجي' })
  @ApiParam({ name: 'id', description: 'معرف التكامل' })
  @ApiResponse({ status: 200, description: 'تم حذف التكامل' })
  async deleteIntegration(@Param('id') id: string) {
    return this.externalApiService.deleteIntegration(id);
  }

  @Post('integrations/:id/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إرسال طلب لتكامل خارجي' })
  @ApiParam({ name: 'id', description: 'معرف التكامل' })
  @ApiResponse({ status: 200, description: 'استجابة التكامل' })
  async sendRequest(@Param('id') id: string, @Body() dto: ExternalApiRequestDto) {
    return this.externalApiService.request(
      id,
      dto.method,
      dto.path,
      dto.data,
      { headers: dto.headers, timeout: dto.timeout },
    );
  }
}
