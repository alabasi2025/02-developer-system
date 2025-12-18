import {
  Controller,
  All,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Headers,
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
import { Request } from 'express';
import { GatewayService } from './gateway.service';
import {
  ProxyResponseDto,
  RateLimitConfigDto,
  RateLimitStatusDto,
  RequestLogQueryDto,
  RequestLogResponseDto,
  SystemHealthDto,
} from './dto/gateway.dto';

@ApiTags('بوابة API - Gateway')
@ApiBearerAuth()
@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  // ==================== Proxy Endpoints ====================

  @All(':system/*')
  @ApiOperation({ summary: 'توجيه الطلب إلى نظام آخر', description: 'توجيه أي طلب إلى النظام المحدد' })
  @ApiParam({ name: 'system', description: 'معرف النظام المستهدف', example: 'billing' })
  @ApiResponse({ status: 200, description: 'استجابة النظام المستهدف', type: ProxyResponseDto })
  async proxyRequest(
    @Param('system') system: string,
    @Req() req: Request,
    @Headers('x-api-key') apiKey?: string,
    @Headers('x-source-system') sourceSystem?: string,
  ): Promise<ProxyResponseDto> {
    // Extract the path after the system parameter
    const fullPath = req.url;
    const systemPrefix = `/api/v1/gateway/${system}`;
    const path = fullPath.replace(systemPrefix, '') || '/';

    // Get source IP
    const sourceIp = req.ip || req.socket.remoteAddress;

    // Check rate limit
    const identifier = apiKey || sourceIp || 'anonymous';
    const rateLimitStatus = await this.gatewayService.checkRateLimit(
      identifier,
      apiKey ? 'api_key' : 'ip',
    );

    if (rateLimitStatus.exceeded) {
      return {
        success: false,
        statusCode: 429,
        error: 'تم تجاوز حد الطلبات المسموح به',
        responseTime: 0,
      };
    }

    // Increment rate limit
    await this.gatewayService.incrementRateLimit(
      identifier,
      apiKey ? 'api_key' : 'ip',
    );

    // Forward headers (excluding sensitive ones)
    const forwardHeaders: Record<string, string> = {};
    const excludeHeaders = ['host', 'content-length', 'x-api-key'];
    
    for (const [key, value] of Object.entries(req.headers)) {
      if (!excludeHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        forwardHeaders[key] = value;
      }
    }

    return this.gatewayService.proxy(
      system,
      path,
      req.method,
      req.body,
      forwardHeaders,
      req.query as Record<string, any>,
      sourceSystem,
      sourceIp,
    );
  }

  // ==================== Rate Limiting ====================

  @Get('rate-limit/status/:identifier')
  @ApiOperation({ summary: 'حالة Rate Limit', description: 'جلب حالة Rate Limit لمعرف محدد' })
  @ApiParam({ name: 'identifier', description: 'المعرف (API key أو IP)' })
  @ApiResponse({ status: 200, description: 'حالة Rate Limit', type: RateLimitStatusDto })
  async getRateLimitStatus(
    @Param('identifier') identifier: string,
    @Query('type') type: string = 'api_key',
  ): Promise<RateLimitStatusDto> {
    return this.gatewayService.checkRateLimit(identifier, type);
  }

  @Post('rate-limit/configure')
  @ApiOperation({ summary: 'تكوين Rate Limit', description: 'تكوين إعدادات Rate Limit لمعرف محدد' })
  @ApiResponse({ status: 200, description: 'تم التكوين بنجاح' })
  async configureRateLimit(@Body() config: RateLimitConfigDto) {
    await this.gatewayService.configureRateLimit(config);
    return { message: 'تم تكوين Rate Limit بنجاح' };
  }

  // ==================== Request Logs ====================

  @Get('logs')
  @ApiOperation({ summary: 'سجلات الطلبات', description: 'جلب سجلات طلبات API' })
  @ApiResponse({ status: 200, description: 'قائمة السجلات' })
  async getRequestLogs(@Query() query: RequestLogQueryDto) {
    return this.gatewayService.getRequestLogs(query);
  }

  // ==================== System Health ====================

  @Get('health')
  @ApiOperation({ summary: 'صحة جميع الأنظمة', description: 'فحص صحة جميع الأنظمة المتصلة' })
  @ApiResponse({ status: 200, description: 'حالة صحة الأنظمة', type: [SystemHealthDto] })
  async checkAllHealth() {
    return this.gatewayService.checkAllSystemsHealth();
  }

  @Get('health/:system')
  @ApiOperation({ summary: 'صحة نظام محدد', description: 'فحص صحة نظام محدد' })
  @ApiParam({ name: 'system', description: 'معرف النظام' })
  @ApiResponse({ status: 200, description: 'حالة صحة النظام', type: SystemHealthDto })
  async checkSystemHealth(@Param('system') system: string) {
    return this.gatewayService.checkSystemHealth(system);
  }

  // ==================== System Info ====================

  @Get('systems')
  @ApiOperation({ summary: 'قائمة الأنظمة', description: 'جلب قائمة بجميع الأنظمة المتاحة' })
  @ApiResponse({ status: 200, description: 'قائمة الأنظمة' })
  async getSystemsList() {
    return this.gatewayService.getAllSystemConfigs();
  }
}
