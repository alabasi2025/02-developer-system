import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { IntegrationsService } from './integrations.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  IntegrationResponseDto,
  IntegrationQueryDto,
  TestIntegrationResponseDto,
} from './dto/integration.dto';

@ApiTags('التكاملات - Integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @RequirePermissions('integrations:create')
  @ApiOperation({ summary: 'إنشاء تكامل جديد', description: 'إنشاء تكامل جديد مع نظام داخلي أو خارجي' })
  @ApiResponse({ status: 201, description: 'تم إنشاء التكامل بنجاح', type: IntegrationResponseDto })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  async create(@Body() createDto: CreateIntegrationDto) {
    return this.integrationsService.create(createDto);
  }

  @Get()
  @Public()
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'جلب جميع التكاملات', description: 'جلب قائمة بجميع التكاملات مع إمكانية الفلترة والتصفح' })
  @ApiResponse({ status: 200, description: 'قائمة التكاملات' })
  async findAll(@Query() query: IntegrationQueryDto) {
    return this.integrationsService.findAll(query);
  }

  @Get(':id')
  @Public()
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: 'جلب تكامل محدد', description: 'جلب تفاصيل تكامل محدد بواسطة المعرف' })
  @ApiParam({ name: 'id', description: 'معرف التكامل', type: 'string' })
  @ApiResponse({ status: 200, description: 'تفاصيل التكامل', type: IntegrationResponseDto })
  @ApiResponse({ status: 404, description: 'التكامل غير موجود' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.integrationsService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions('integrations:update')
  @ApiOperation({ summary: 'تحديث تكامل', description: 'تحديث بيانات تكامل موجود' })
  @ApiParam({ name: 'id', description: 'معرف التكامل', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم تحديث التكامل بنجاح', type: IntegrationResponseDto })
  @ApiResponse({ status: 404, description: 'التكامل غير موجود' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, updateDto);
  }

  @Delete(':id')
  @RequirePermissions('integrations:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف تكامل', description: 'حذف تكامل (soft delete)' })
  @ApiParam({ name: 'id', description: 'معرف التكامل', type: 'string' })
  @ApiResponse({ status: 200, description: 'تم حذف التكامل بنجاح' })
  @ApiResponse({ status: 404, description: 'التكامل غير موجود' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.integrationsService.remove(id);
  }

  @Post(':id/test')
  @RequirePermissions('integrations:execute')
  @ApiOperation({ summary: 'اختبار اتصال التكامل', description: 'اختبار الاتصال بالنظام المتكامل' })
  @ApiParam({ name: 'id', description: 'معرف التكامل', type: 'string' })
  @ApiResponse({ status: 200, description: 'نتيجة الاختبار', type: TestIntegrationResponseDto })
  @ApiResponse({ status: 404, description: 'التكامل غير موجود' })
  async testConnection(@Param('id', ParseUUIDPipe) id: string) {
    return this.integrationsService.testConnection(id);
  }
}
