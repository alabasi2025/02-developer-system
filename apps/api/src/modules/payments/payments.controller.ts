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
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PaymentsService, PaymentGatewayConfig, ProcessPaymentDto, RefundPaymentDto } from './payments.service';

@ApiTags('المدفوعات - Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ==================== Gateway Management ====================

  @Post('gateways')
  @ApiOperation({ summary: 'إنشاء بوابة دفع', description: 'إنشاء بوابة دفع جديدة' })
  @ApiResponse({ status: 201, description: 'تم إنشاء البوابة بنجاح' })
  async createGateway(@Body() data: PaymentGatewayConfig) {
    return this.paymentsService.createGateway(data);
  }

  @Get('gateways')
  @ApiOperation({ summary: 'جلب بوابات الدفع', description: 'جلب قائمة بوابات الدفع' })
  @ApiResponse({ status: 200, description: 'قائمة البوابات' })
  async findAllGateways(
    @Query('isActive') isActive?: string,
    @Query('provider') provider?: string,
  ) {
    return this.paymentsService.findAllGateways({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      provider,
    });
  }

  @Get('gateways/:id')
  @ApiOperation({ summary: 'جلب بوابة دفع', description: 'جلب تفاصيل بوابة دفع محددة' })
  @ApiParam({ name: 'id', description: 'معرف البوابة' })
  @ApiResponse({ status: 200, description: 'تفاصيل البوابة' })
  async findOneGateway(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOneGateway(id);
  }

  @Put('gateways/:id')
  @ApiOperation({ summary: 'تحديث بوابة دفع', description: 'تحديث بيانات بوابة دفع' })
  @ApiParam({ name: 'id', description: 'معرف البوابة' })
  @ApiResponse({ status: 200, description: 'تم التحديث بنجاح' })
  async updateGateway(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: Partial<PaymentGatewayConfig>,
  ) {
    return this.paymentsService.updateGateway(id, data);
  }

  @Delete('gateways/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف بوابة دفع', description: 'تعطيل بوابة دفع' })
  @ApiParam({ name: 'id', description: 'معرف البوابة' })
  @ApiResponse({ status: 200, description: 'تم التعطيل بنجاح' })
  async deleteGateway(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.deleteGateway(id);
  }

  // ==================== Payment Processing ====================

  @Post('process')
  @ApiOperation({ summary: 'معالجة دفعة', description: 'معالجة دفعة جديدة' })
  @ApiResponse({ status: 201, description: 'تم بدء المعالجة' })
  async processPayment(@Body() dto: ProcessPaymentDto) {
    return this.paymentsService.processPayment(dto);
  }

  @Post('refund')
  @ApiOperation({ summary: 'استرداد دفعة', description: 'استرداد دفعة سابقة' })
  @ApiResponse({ status: 200, description: 'تم الاسترداد بنجاح' })
  async refundPayment(@Body() dto: RefundPaymentDto) {
    return this.paymentsService.refundPayment(dto);
  }

  // ==================== Transaction Queries ====================

  @Get('transactions')
  @ApiOperation({ summary: 'جلب المعاملات', description: 'جلب قائمة المعاملات المالية' })
  @ApiResponse({ status: 200, description: 'قائمة المعاملات' })
  async findAllTransactions(
    @Query('gatewayId') gatewayId?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAllTransactions({
      gatewayId,
      status,
      customerId,
      fromDate,
      toDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'جلب معاملة', description: 'جلب تفاصيل معاملة محددة' })
  @ApiParam({ name: 'id', description: 'معرف المعاملة' })
  @ApiResponse({ status: 200, description: 'تفاصيل المعاملة' })
  async findOneTransaction(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOneTransaction(id);
  }

  // ==================== Webhooks ====================

  @Post('webhooks/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استقبال Webhook', description: 'استقبال إشعارات من بوابات الدفع' })
  @ApiParam({ name: 'provider', description: 'مزود الدفع' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
  ) {
    return this.paymentsService.handleWebhook(provider, payload, signature);
  }
}
