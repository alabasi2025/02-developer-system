import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InternalApiService, InternalSystem } from './internal-api.service';

@ApiTags('Internal APIs - واجهات الأنظمة الداخلية')
@Controller('internal')
export class InternalApiController {
  constructor(private readonly internalApiService: InternalApiService) {}

  @Get('systems')
  @ApiOperation({ summary: 'الحصول على قائمة الأنظمة الداخلية المتاحة' })
  @ApiResponse({ status: 200, description: 'قائمة الأنظمة' })
  getAvailableSystems() {
    return this.internalApiService.getAvailableSystems();
  }

  @Get('health')
  @ApiOperation({ summary: 'فحص صحة جميع الأنظمة الداخلية' })
  @ApiResponse({ status: 200, description: 'حالة صحة الأنظمة' })
  async checkAllSystemsHealth() {
    return this.internalApiService.checkAllSystemsHealth();
  }

  @Get('health/:system')
  @ApiOperation({ summary: 'فحص صحة نظام داخلي محدد' })
  @ApiParam({ name: 'system', enum: InternalSystem, description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'حالة صحة النظام' })
  async checkSystemHealth(@Param('system') system: InternalSystem) {
    return this.internalApiService.checkSystemHealth(system);
  }

  @Get(':system/*')
  @ApiOperation({ summary: 'إرسال طلب GET لنظام داخلي' })
  @ApiParam({ name: 'system', enum: InternalSystem, description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'استجابة النظام' })
  async proxyGet(
    @Param('system') system: InternalSystem,
    @Param('0') path: string,
  ) {
    return this.internalApiService.get(system, path);
  }

  @Post(':system/*')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إرسال طلب POST لنظام داخلي' })
  @ApiParam({ name: 'system', enum: InternalSystem, description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'استجابة النظام' })
  async proxyPost(
    @Param('system') system: InternalSystem,
    @Param('0') path: string,
    @Body() body: any,
  ) {
    return this.internalApiService.post(system, path, body);
  }

  @Put(':system/*')
  @ApiOperation({ summary: 'إرسال طلب PUT لنظام داخلي' })
  @ApiParam({ name: 'system', enum: InternalSystem, description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'استجابة النظام' })
  async proxyPut(
    @Param('system') system: InternalSystem,
    @Param('0') path: string,
    @Body() body: any,
  ) {
    return this.internalApiService.put(system, path, body);
  }

  @Delete(':system/*')
  @ApiOperation({ summary: 'إرسال طلب DELETE لنظام داخلي' })
  @ApiParam({ name: 'system', enum: InternalSystem, description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'استجابة النظام' })
  async proxyDelete(
    @Param('system') system: InternalSystem,
    @Param('0') path: string,
  ) {
    return this.internalApiService.delete(system, path);
  }

  @Patch(':system/*')
  @ApiOperation({ summary: 'إرسال طلب PATCH لنظام داخلي' })
  @ApiParam({ name: 'system', enum: InternalSystem, description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'استجابة النظام' })
  async proxyPatch(
    @Param('system') system: InternalSystem,
    @Param('0') path: string,
    @Body() body: any,
  ) {
    return this.internalApiService.patch(system, path, body);
  }
}
