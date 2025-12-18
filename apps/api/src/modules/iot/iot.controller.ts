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
import { IotService, RegisterDeviceDto, DeviceDataDto, DeviceCommandDto } from './iot.service';

@ApiTags('إنترنت الأشياء - IoT')
@ApiBearerAuth()
@Controller('iot')
export class IotController {
  constructor(private readonly iotService: IotService) {}

  // ==================== Device Management ====================

  @Post('devices')
  @ApiOperation({ summary: 'تسجيل جهاز', description: 'تسجيل جهاز IoT جديد' })
  @ApiResponse({ status: 201, description: 'تم التسجيل بنجاح' })
  async registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.iotService.registerDevice(dto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'جلب الأجهزة', description: 'جلب قائمة أجهزة IoT' })
  @ApiResponse({ status: 200, description: 'قائمة الأجهزة' })
  async findAllDevices(
    @Query('deviceType') deviceType?: string,
    @Query('status') status?: string,
    @Query('isOnline') isOnline?: string,
    @Query('zone') zone?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.iotService.findAllDevices({
      deviceType,
      status,
      isOnline: isOnline !== undefined ? isOnline === 'true' : undefined,
      zone,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get('devices/:id')
  @ApiOperation({ summary: 'جلب جهاز', description: 'جلب تفاصيل جهاز IoT' })
  @ApiParam({ name: 'id', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'تفاصيل الجهاز' })
  async findOneDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.findOneDevice(id);
  }

  @Put('devices/:id')
  @ApiOperation({ summary: 'تحديث جهاز', description: 'تحديث بيانات جهاز IoT' })
  @ApiParam({ name: 'id', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: Partial<RegisterDeviceDto>,
  ) {
    return this.iotService.updateDevice(id, data);
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إلغاء تسجيل جهاز', description: 'إلغاء تسجيل جهاز IoT' })
  @ApiParam({ name: 'id', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'تم الإلغاء بنجاح' })
  async deleteDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.iotService.deleteDevice(id);
  }

  // ==================== Device Data ====================

  @Post('data')
  @ApiOperation({ summary: 'إرسال بيانات', description: 'إرسال بيانات من جهاز IoT' })
  @ApiResponse({ status: 201, description: 'تم الاستلام بنجاح' })
  async ingestData(@Body() dto: DeviceDataDto) {
    return this.iotService.ingestData(dto);
  }

  @Post('data/bulk')
  @ApiOperation({ summary: 'إرسال بيانات جماعية', description: 'إرسال بيانات من عدة أجهزة' })
  @ApiResponse({ status: 201, description: 'تم الاستلام' })
  async ingestBulkData(@Body() data: DeviceDataDto[]) {
    return this.iotService.ingestBulkData(data);
  }

  @Get('devices/:deviceId/data')
  @ApiOperation({ summary: 'جلب بيانات جهاز', description: 'جلب بيانات جهاز IoT' })
  @ApiParam({ name: 'deviceId', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'بيانات الجهاز' })
  async getDeviceData(
    @Param('deviceId') deviceId: string,
    @Query('dataType') dataType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.iotService.getDeviceData(deviceId, {
      dataType,
      fromDate,
      toDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Get('devices/:deviceId/data/latest')
  @ApiOperation({ summary: 'آخر بيانات جهاز', description: 'جلب آخر بيانات جهاز IoT' })
  @ApiParam({ name: 'deviceId', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'آخر البيانات' })
  async getLatestData(
    @Param('deviceId') deviceId: string,
    @Query('dataTypes') dataTypes?: string,
  ) {
    const types = dataTypes ? dataTypes.split(',') : undefined;
    return this.iotService.getLatestData(deviceId, types);
  }

  // ==================== Device Commands ====================

  @Post('commands')
  @ApiOperation({ summary: 'إرسال أمر', description: 'إرسال أمر إلى جهاز IoT' })
  @ApiResponse({ status: 201, description: 'تم الإرسال' })
  async sendCommand(@Body() dto: DeviceCommandDto) {
    return this.iotService.sendCommand(dto);
  }

  @Get('devices/:deviceId/commands')
  @ApiOperation({ summary: 'جلب أوامر جهاز', description: 'جلب أوامر جهاز IoT' })
  @ApiParam({ name: 'deviceId', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'قائمة الأوامر' })
  async getDeviceCommands(
    @Param('deviceId') deviceId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.iotService.getDeviceCommands(deviceId, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Post('commands/:id/acknowledge')
  @ApiOperation({ summary: 'تأكيد تنفيذ أمر', description: 'تأكيد تنفيذ أمر من الجهاز' })
  @ApiParam({ name: 'id', description: 'معرف الأمر' })
  @ApiResponse({ status: 200, description: 'تم التأكيد' })
  async acknowledgeCommand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('response') response?: any,
  ) {
    return this.iotService.acknowledgeCommand(id, response);
  }

  // ==================== Alert Rules ====================

  @Post('alert-rules')
  @ApiOperation({ summary: 'إنشاء قاعدة تنبيه', description: 'إنشاء قاعدة تنبيه IoT' })
  @ApiResponse({ status: 201, description: 'تم الإنشاء' })
  async createAlertRule(@Body() data: {
    deviceId?: string;
    deviceType?: string;
    dataType: string;
    operator: string;
    threshold: number;
    alertType: string;
    severity: number;
    title?: string;
    message?: string;
  }) {
    return this.iotService.createAlertRule(data);
  }

  @Get('alert-rules')
  @ApiOperation({ summary: 'جلب قواعد التنبيه', description: 'جلب قواعد تنبيه IoT' })
  @ApiResponse({ status: 200, description: 'قائمة القواعد' })
  async findAllAlertRules(
    @Query('deviceType') deviceType?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.iotService.findAllAlertRules({
      deviceType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('devices/:deviceId/alerts')
  @ApiOperation({ summary: 'جلب تنبيهات جهاز', description: 'جلب تنبيهات جهاز IoT' })
  @ApiParam({ name: 'deviceId', description: 'معرف الجهاز' })
  @ApiResponse({ status: 200, description: 'قائمة التنبيهات' })
  async getDeviceAlerts(
    @Param('deviceId') deviceId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.iotService.getDeviceAlerts(deviceId, {
      status,
      severity: severity ? parseInt(severity) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }
}
