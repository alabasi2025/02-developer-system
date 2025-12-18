import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from '../modules/auth/decorators/public.decorator';

@ApiTags('النظام - System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'معلومات النظام' })
  @ApiResponse({ status: 200, description: 'معلومات نظام المطور' })
  getData() {
    return this.appService.getData();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'فحص صحة النظام' })
  @ApiResponse({ status: 200, description: 'النظام يعمل بشكل صحيح' })
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'developer-system',
      version: '1.0.0',
    };
  }

  @Public()
  @Get('api/v1/health')
  @ApiOperation({ summary: 'فحص صحة API' })
  @ApiResponse({ status: 200, description: 'API يعمل بشكل صحيح' })
  apiHealthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'developer-system-api',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
