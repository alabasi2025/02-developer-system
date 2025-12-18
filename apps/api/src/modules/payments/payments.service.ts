import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import axios from 'axios';
// Decimal type is handled by Prisma automatically

export interface PaymentGatewayConfig {
  name: string;
  provider: string;
  apiUrl: string;
  credentials: {
    apiKey?: string;
    secretKey?: string;
    merchantId?: string;
  };
  config?: Record<string, any>;
  supportedCurrencies: string[];
  fees?: {
    percentage?: number;
    fixed?: number;
  };
}

export interface ProcessPaymentDto {
  gatewayId: string;
  amount: number;
  currency: string;
  customerId?: string;
  invoiceId?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  callbackUrl?: string;
}

export interface RefundPaymentDto {
  transactionId: string;
  amount?: number;
  reason?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  // ==================== Gateway Management ====================

  async createGateway(data: PaymentGatewayConfig) {
    const gateway = await this.prisma.devPaymentGateway.create({
      data: {
        name: data.name,
        provider: data.provider,
        apiUrl: data.apiUrl,
        credentials: data.credentials,
        config: data.config || {},
        supportedCurrencies: data.supportedCurrencies,
        fees: data.fees || {},
        isActive: true,
      },
    });

    return this.sanitizeGateway(gateway);
  }

  async findAllGateways(query: { isActive?: boolean; provider?: string }) {
    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.provider) where.provider = query.provider;

    const gateways = await this.prisma.devPaymentGateway.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return gateways.map(g => this.sanitizeGateway(g));
  }

  async findOneGateway(id: string) {
    const gateway = await this.prisma.devPaymentGateway.findUnique({ where: { id } });
    
    if (!gateway) {
      throw new NotFoundException(`بوابة الدفع غير موجودة: ${id}`);
    }

    return this.sanitizeGateway(gateway);
  }

  async updateGateway(id: string, data: Partial<PaymentGatewayConfig>) {
    const existing = await this.prisma.devPaymentGateway.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`بوابة الدفع غير موجودة: ${id}`);
    }

    const updated = await this.prisma.devPaymentGateway.update({
      where: { id },
      data: {
        name: data.name,
        apiUrl: data.apiUrl,
        credentials: data.credentials,
        config: data.config,
        supportedCurrencies: data.supportedCurrencies,
        fees: data.fees,
      },
    });

    return this.sanitizeGateway(updated);
  }

  async deleteGateway(id: string) {
    const existing = await this.prisma.devPaymentGateway.findUnique({ where: { id } });
    
    if (!existing) {
      throw new NotFoundException(`بوابة الدفع غير موجودة: ${id}`);
    }

    await this.prisma.devPaymentGateway.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'تم تعطيل بوابة الدفع بنجاح', id };
  }

  // ==================== Payment Processing ====================

  async processPayment(dto: ProcessPaymentDto) {
    const gateway = await this.prisma.devPaymentGateway.findUnique({
      where: { id: dto.gatewayId },
    });

    if (!gateway) {
      throw new NotFoundException(`بوابة الدفع غير موجودة: ${dto.gatewayId}`);
    }

    if (!gateway.isActive) {
      throw new BadRequestException('بوابة الدفع غير نشطة');
    }

    if (!gateway.supportedCurrencies.includes(dto.currency)) {
      throw new BadRequestException(`العملة غير مدعومة: ${dto.currency}`);
    }

    // Create transaction record
    const transaction = await this.prisma.devPaymentTransaction.create({
      data: {
        gatewayId: gateway.id,
        amount: dto.amount,
        currency: dto.currency,
        status: 'pending',
        type: 'payment',
        customerId: dto.customerId,
        invoiceId: dto.invoiceId,
        metadata: dto.metadata || {},
      },
    });

    try {
      // Process based on provider
      const result = await this.processWithProvider(gateway, transaction, dto);

      // Update transaction
      await this.prisma.devPaymentTransaction.update({
        where: { id: transaction.id },
        data: {
          externalId: result.externalId,
          status: result.status,
          gatewayResponse: result.response,
          processedAt: result.status === 'completed' ? new Date() : null,
        },
      });

      // Publish event
      await this.eventsService.publish({
        eventType: `payment.${result.status}`,
        sourceSystem: 'developer',
        aggregateId: transaction.id,
        aggregateType: 'payment',
        payload: {
          transactionId: transaction.id,
          amount: dto.amount,
          currency: dto.currency,
          status: result.status,
          customerId: dto.customerId,
          invoiceId: dto.invoiceId,
        },
      });

      return {
        transactionId: transaction.id,
        externalId: result.externalId,
        status: result.status,
        redirectUrl: result.redirectUrl,
      };
    } catch (error: any) {
      await this.prisma.devPaymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'failed',
          errorCode: error.code || 'UNKNOWN',
          errorMessage: error.message,
        },
      });

      throw error;
    }
  }

  private async processWithProvider(
    gateway: any,
    transaction: any,
    dto: ProcessPaymentDto,
  ): Promise<{
    externalId?: string;
    status: string;
    redirectUrl?: string;
    response?: any;
  }> {
    const credentials = gateway.credentials as any;

    switch (gateway.provider) {
      case 'stc_pay':
        return this.processStcPay(gateway, transaction, dto, credentials);
      case 'mada':
        return this.processMada(gateway, transaction, dto, credentials);
      case 'stripe':
        return this.processStripe(gateway, transaction, dto, credentials);
      default:
        return this.processGeneric(gateway, transaction, dto, credentials);
    }
  }

  private async processStcPay(gateway: any, transaction: any, dto: ProcessPaymentDto, credentials: any) {
    // STC Pay integration (simulated)
    this.logger.log(`Processing STC Pay payment: ${transaction.id}`);
    
    // In production, this would call the actual STC Pay API
    return {
      externalId: `stc_${Date.now()}`,
      status: 'pending',
      redirectUrl: `${gateway.apiUrl}/checkout?ref=${transaction.id}`,
      response: { provider: 'stc_pay', simulated: true },
    };
  }

  private async processMada(gateway: any, transaction: any, dto: ProcessPaymentDto, credentials: any) {
    // Mada integration (simulated)
    this.logger.log(`Processing Mada payment: ${transaction.id}`);
    
    return {
      externalId: `mada_${Date.now()}`,
      status: 'pending',
      redirectUrl: `${gateway.apiUrl}/pay?ref=${transaction.id}`,
      response: { provider: 'mada', simulated: true },
    };
  }

  private async processStripe(gateway: any, transaction: any, dto: ProcessPaymentDto, credentials: any) {
    // Stripe integration (simulated)
    this.logger.log(`Processing Stripe payment: ${transaction.id}`);
    
    return {
      externalId: `pi_${Date.now()}`,
      status: 'pending',
      redirectUrl: `https://checkout.stripe.com/pay/${transaction.id}`,
      response: { provider: 'stripe', simulated: true },
    };
  }

  private async processGeneric(gateway: any, transaction: any, dto: ProcessPaymentDto, credentials: any) {
    // Generic payment gateway
    this.logger.log(`Processing generic payment: ${transaction.id}`);
    
    return {
      externalId: `pay_${Date.now()}`,
      status: 'pending',
      response: { provider: gateway.provider, simulated: true },
    };
  }

  // ==================== Refunds ====================

  async refundPayment(dto: RefundPaymentDto) {
    const transaction = await this.prisma.devPaymentTransaction.findUnique({
      where: { id: dto.transactionId },
      include: { gateway: true },
    });

    if (!transaction) {
      throw new NotFoundException(`المعاملة غير موجودة: ${dto.transactionId}`);
    }

    if (transaction.status !== 'completed') {
      throw new BadRequestException('لا يمكن استرداد معاملة غير مكتملة');
    }

    const refundAmount = dto.amount || Number(transaction.amount);

    // Create refund transaction
    const refund = await this.prisma.devPaymentTransaction.create({
      data: {
        gatewayId: transaction.gatewayId,
        amount: refundAmount,
        currency: transaction.currency,
        status: 'pending',
        type: 'refund',
        customerId: transaction.customerId,
        invoiceId: transaction.invoiceId,
        metadata: {
          originalTransactionId: transaction.id,
          reason: dto.reason,
        },
      },
    });

    // Process refund (simulated)
    await this.prisma.devPaymentTransaction.update({
      where: { id: refund.id },
      data: {
        status: 'completed',
        processedAt: new Date(),
      },
    });

    // Publish event
    await this.eventsService.publish({
      eventType: 'payment.refunded',
      sourceSystem: 'developer',
      aggregateId: refund.id,
      aggregateType: 'payment',
      payload: {
        refundId: refund.id,
        originalTransactionId: transaction.id,
        amount: refundAmount,
        currency: transaction.currency,
      },
    });

    return {
      refundId: refund.id,
      originalTransactionId: transaction.id,
      amount: refundAmount,
      status: 'completed',
    };
  }

  // ==================== Transaction Queries ====================

  async findAllTransactions(query: {
    gatewayId?: string;
    status?: string;
    customerId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { gatewayId, status, customerId, fromDate, toDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (gatewayId) where.gatewayId = gatewayId;
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.devPaymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          gateway: { select: { id: true, name: true, provider: true } },
        },
      }),
      this.prisma.devPaymentTransaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneTransaction(id: string) {
    const transaction = await this.prisma.devPaymentTransaction.findUnique({
      where: { id },
      include: {
        gateway: { select: { id: true, name: true, provider: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`المعاملة غير موجودة: ${id}`);
    }

    return transaction;
  }

  // ==================== Webhook Handling ====================

  async handleWebhook(provider: string, payload: any, signature?: string) {
    this.logger.log(`Received webhook from ${provider}`);

    // Verify signature if provided
    // Process webhook based on provider
    // Update transaction status
    // Publish events

    return { received: true };
  }

  private sanitizeGateway(gateway: any) {
    const { credentials, ...safe } = gateway;
    return {
      ...safe,
      hasCredentials: !!credentials,
    };
  }
}
