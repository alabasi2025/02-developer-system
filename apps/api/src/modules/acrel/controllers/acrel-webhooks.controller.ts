import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { AcrelWebhookService } from '../services/acrel-webhook.service';
import { AcrelSecurityService } from '../services/acrel-security.service';
import {
  MeterReadingDto,
  AlertDto,
  StatusChangeDto,
  DisconnectConfirmDto,
  ReconnectConfirmDto,
} from '../dto/acrel-webhook.dto';

@ApiTags('Acrel IoT Webhooks')
@Controller('api/v1/acrel/webhooks')
export class AcrelWebhooksController {
  private readonly logger = new Logger(AcrelWebhooksController.name);

  constructor(
    private readonly webhookService: AcrelWebhookService,
    private readonly securityService: AcrelSecurityService,
  ) {}

  /**
   * التحقق من أمان الطلب
   */
  private async validateRequest(
    signature: string,
    timestamp: string,
    body: any,
    clientIp: string,
  ): Promise<void> {
    // التحقق من IP Whitelist
    if (!this.securityService.isIpAllowed(clientIp)) {
      this.logger.warn(`Rejected request from unauthorized IP: ${clientIp}`);
      throw new UnauthorizedException('IP not allowed');
    }

    // التحقق من Timestamp (رفض الطلبات القديمة > 5 دقائق)
    if (!this.securityService.isTimestampValid(timestamp)) {
      this.logger.warn(`Rejected request with invalid timestamp: ${timestamp}`);
      throw new BadRequestException('Request timestamp expired');
    }

    // التحقق من HMAC Signature
    if (!this.securityService.verifySignature(signature, timestamp, body)) {
      this.logger.warn('Rejected request with invalid signature');
      throw new UnauthorizedException('Invalid signature');
    }
  }

  /**
   * Webhook 1: استقبال قراءة عداد جديدة
   */
  @Post('meter-reading')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استقبال قراءة عداد جديدة من Acrel' })
  @ApiHeader({ name: 'X-Acrel-Signature', description: 'HMAC Signature', required: true })
  @ApiHeader({ name: 'X-Acrel-Timestamp', description: 'Request Timestamp', required: true })
  @ApiHeader({ name: 'X-Acrel-Event-Id', description: 'Unique Event ID', required: true })
  @ApiResponse({ status: 200, description: 'تم استقبال القراءة بنجاح' })
  @ApiResponse({ status: 400, description: 'بيانات غير صالحة' })
  @ApiResponse({ status: 401, description: 'غير مصرح' })
  async handleMeterReading(
    @Body() data: MeterReadingDto,
    @Headers('x-acrel-signature') signature: string,
    @Headers('x-acrel-timestamp') timestamp: string,
    @Headers('x-acrel-event-id') eventId: string,
    @Headers('x-forwarded-for') clientIp: string,
  ) {
    await this.validateRequest(signature, timestamp, data, clientIp || '127.0.0.1');

    // التحقق من Idempotency
    if (await this.webhookService.isEventProcessed(eventId)) {
      this.logger.log(`Event ${eventId} already processed, skipping`);
      return { status: 'already_processed', eventId };
    }

    this.logger.log(`Processing meter reading from device: ${data.deviceId}`);
    const result = await this.webhookService.processMeterReading(data, eventId);
    
    return { status: 'success', eventId, result };
  }

  /**
   * Webhook 2: استقبال تنبيه من العداد
   */
  @Post('alert')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استقبال تنبيه من عداد Acrel' })
  @ApiHeader({ name: 'X-Acrel-Signature', description: 'HMAC Signature', required: true })
  @ApiHeader({ name: 'X-Acrel-Timestamp', description: 'Request Timestamp', required: true })
  @ApiHeader({ name: 'X-Acrel-Event-Id', description: 'Unique Event ID', required: true })
  @ApiResponse({ status: 200, description: 'تم استقبال التنبيه بنجاح' })
  async handleAlert(
    @Body() data: AlertDto,
    @Headers('x-acrel-signature') signature: string,
    @Headers('x-acrel-timestamp') timestamp: string,
    @Headers('x-acrel-event-id') eventId: string,
    @Headers('x-forwarded-for') clientIp: string,
  ) {
    await this.validateRequest(signature, timestamp, data, clientIp || '127.0.0.1');

    if (await this.webhookService.isEventProcessed(eventId)) {
      return { status: 'already_processed', eventId };
    }

    this.logger.warn(`Processing alert from device: ${data.deviceId}, type: ${data.alertType}`);
    const result = await this.webhookService.processAlert(data, eventId);
    
    return { status: 'success', eventId, result };
  }

  /**
   * Webhook 3: استقبال تغيير حالة العداد
   */
  @Post('status-change')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استقبال تغيير حالة عداد Acrel' })
  @ApiHeader({ name: 'X-Acrel-Signature', description: 'HMAC Signature', required: true })
  @ApiHeader({ name: 'X-Acrel-Timestamp', description: 'Request Timestamp', required: true })
  @ApiHeader({ name: 'X-Acrel-Event-Id', description: 'Unique Event ID', required: true })
  @ApiResponse({ status: 200, description: 'تم استقبال تغيير الحالة بنجاح' })
  async handleStatusChange(
    @Body() data: StatusChangeDto,
    @Headers('x-acrel-signature') signature: string,
    @Headers('x-acrel-timestamp') timestamp: string,
    @Headers('x-acrel-event-id') eventId: string,
    @Headers('x-forwarded-for') clientIp: string,
  ) {
    await this.validateRequest(signature, timestamp, data, clientIp || '127.0.0.1');

    if (await this.webhookService.isEventProcessed(eventId)) {
      return { status: 'already_processed', eventId };
    }

    this.logger.log(`Processing status change for device: ${data.deviceId}, new status: ${data.newStatus}`);
    const result = await this.webhookService.processStatusChange(data, eventId);
    
    return { status: 'success', eventId, result };
  }

  /**
   * Webhook 4: تأكيد تنفيذ أمر الفصل
   */
  @Post('disconnect-confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأكيد تنفيذ أمر فصل العداد' })
  @ApiHeader({ name: 'X-Acrel-Signature', description: 'HMAC Signature', required: true })
  @ApiHeader({ name: 'X-Acrel-Timestamp', description: 'Request Timestamp', required: true })
  @ApiHeader({ name: 'X-Acrel-Event-Id', description: 'Unique Event ID', required: true })
  @ApiResponse({ status: 200, description: 'تم تأكيد الفصل بنجاح' })
  async handleDisconnectConfirm(
    @Body() data: DisconnectConfirmDto,
    @Headers('x-acrel-signature') signature: string,
    @Headers('x-acrel-timestamp') timestamp: string,
    @Headers('x-acrel-event-id') eventId: string,
    @Headers('x-forwarded-for') clientIp: string,
  ) {
    await this.validateRequest(signature, timestamp, data, clientIp || '127.0.0.1');

    if (await this.webhookService.isEventProcessed(eventId)) {
      return { status: 'already_processed', eventId };
    }

    this.logger.log(`Processing disconnect confirmation for device: ${data.deviceId}`);
    const result = await this.webhookService.processDisconnectConfirm(data, eventId);
    
    return { status: 'success', eventId, result };
  }

  /**
   * Webhook 5: تأكيد تنفيذ أمر الوصل
   */
  @Post('reconnect-confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأكيد تنفيذ أمر وصل العداد' })
  @ApiHeader({ name: 'X-Acrel-Signature', description: 'HMAC Signature', required: true })
  @ApiHeader({ name: 'X-Acrel-Timestamp', description: 'Request Timestamp', required: true })
  @ApiHeader({ name: 'X-Acrel-Event-Id', description: 'Unique Event ID', required: true })
  @ApiResponse({ status: 200, description: 'تم تأكيد الوصل بنجاح' })
  async handleReconnectConfirm(
    @Body() data: ReconnectConfirmDto,
    @Headers('x-acrel-signature') signature: string,
    @Headers('x-acrel-timestamp') timestamp: string,
    @Headers('x-acrel-event-id') eventId: string,
    @Headers('x-forwarded-for') clientIp: string,
  ) {
    await this.validateRequest(signature, timestamp, data, clientIp || '127.0.0.1');

    if (await this.webhookService.isEventProcessed(eventId)) {
      return { status: 'already_processed', eventId };
    }

    this.logger.log(`Processing reconnect confirmation for device: ${data.deviceId}`);
    const result = await this.webhookService.processReconnectConfirm(data, eventId);
    
    return { status: 'success', eventId, result };
  }
}
