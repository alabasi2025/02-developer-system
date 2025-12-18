import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { Public } from '../auth/decorators/public.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '../auth/decorators/permissions.decorator';

@ApiTags('المراقبة - Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'فحص صحة النظام', description: 'فحص صحة النظام وخدماته' })
  @ApiResponse({ status: 200, description: 'حالة صحة النظام' })
  async getHealth() {
    return this.monitoringService.getHealth();
  }

  @Get('metrics')
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_READ)
  @ApiOperation({ summary: 'مقاييس النظام', description: 'جلب مقاييس أداء النظام' })
  @ApiResponse({ status: 200, description: 'مقاييس النظام' })
  async getMetrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('logs')
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_READ)
  @ApiOperation({ summary: 'سجلات النظام', description: 'جلب سجلات النظام' })
  @ApiQuery({ name: 'level', required: false, description: 'مستوى السجل' })
  @ApiQuery({ name: 'source', required: false, description: 'مصدر السجل' })
  @ApiQuery({ name: 'fromDate', required: false, description: 'من تاريخ' })
  @ApiQuery({ name: 'toDate', required: false, description: 'إلى تاريخ' })
  @ApiQuery({ name: 'page', required: false, description: 'رقم الصفحة' })
  @ApiQuery({ name: 'limit', required: false, description: 'عدد العناصر' })
  @ApiResponse({ status: 200, description: 'قائمة السجلات' })
  async getLogs(
    @Query('level') level?: string,
    @Query('source') source?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitoringService.getLogs({
      level,
      source,
      fromDate,
      toDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get('alerts')
  @Public()
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_READ)
  @ApiOperation({ summary: 'التنبيهات', description: 'جلب تنبيهات النظام' })
  @ApiQuery({ name: 'status', required: false, description: 'حالة التنبيه' })
  @ApiQuery({ name: 'severity', required: false, description: 'شدة التنبيه' })
  @ApiQuery({ name: 'source', required: false, description: 'مصدر التنبيه' })
  @ApiResponse({ status: 200, description: 'قائمة التنبيهات' })
  async getAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.monitoringService.getAlerts({
      status,
      severity: severity ? parseInt(severity) : undefined,
      source,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Post('alerts')
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_WRITE)
  @ApiOperation({ summary: 'إنشاء تنبيه', description: 'إنشاء تنبيه جديد' })
  @ApiResponse({ status: 201, description: 'تم إنشاء التنبيه' })
  async createAlert(
    @Body() data: {
      alertType: string;
      source: string;
      title: string;
      message: string;
      severity?: number;
      metadata?: any;
    },
  ) {
    return this.monitoringService.createAlert(data);
  }

  @Put('alerts/:id/acknowledge')
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_WRITE)
  @ApiOperation({ summary: 'تأكيد استلام تنبيه', description: 'تأكيد استلام تنبيه' })
  @ApiParam({ name: 'id', description: 'معرف التنبيه' })
  @ApiResponse({ status: 200, description: 'تم تأكيد الاستلام' })
  async acknowledgeAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { userId: string },
  ) {
    return this.monitoringService.acknowledgeAlert(id, data.userId);
  }

  @Put('alerts/:id/resolve')
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_WRITE)
  @ApiOperation({ summary: 'حل تنبيه', description: 'تحديد تنبيه كمحلول' })
  @ApiParam({ name: 'id', description: 'معرف التنبيه' })
  @ApiResponse({ status: 200, description: 'تم حل التنبيه' })
  async resolveAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { userId: string; resolution: string },
  ) {
    return this.monitoringService.resolveAlert(id, data.userId, data.resolution);
  }

  @Get('systems')
  @Public()
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_READ)
  @ApiOperation({ summary: 'حالة الأنظمة', description: 'جلب حالة جميع الأنظمة المتكاملة' })
  @ApiResponse({ status: 200, description: 'قائمة حالات الأنظمة' })
  async getSystemsStatus() {
    return this.monitoringService.getSystemsStatus();
  }

  @Get('metrics/:name/history')
  @ApiBearerAuth()
  @Permissions(Permission.MONITORING_READ)
  @ApiOperation({ summary: 'تاريخ مقياس', description: 'جلب تاريخ مقياس محدد' })
  @ApiParam({ name: 'name', description: 'اسم المقياس' })
  @ApiQuery({ name: 'hours', required: false, description: 'عدد الساعات' })
  @ApiResponse({ status: 200, description: 'تاريخ المقياس' })
  async getMetricHistory(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    return this.monitoringService.getMetricHistory(name, hours ? parseInt(hours) : 24);
  }
}
