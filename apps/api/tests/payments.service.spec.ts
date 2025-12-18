import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService, ProcessPaymentDto, RefundPaymentDto } from '../src/modules/payments/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventsService } from '../src/modules/events/events.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: PrismaService;
  let eventsService: EventsService;

  const mockPrismaService = {
    devPaymentGateway: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    devPaymentTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockEventsService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventsService = module.get<EventsService>(EventsService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGateway', () => {
    it('should create a payment gateway', async () => {
      const gatewayData = {
        name: 'Test Gateway',
        provider: 'stripe',
        apiUrl: 'https://api.stripe.com',
        credentials: { apiKey: 'sk_test_xxx' },
        supportedCurrencies: ['SAR', 'USD'],
      };

      const mockGateway = {
        id: 'gateway-123',
        ...gatewayData,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.devPaymentGateway.create.mockResolvedValue(mockGateway);

      const result = await service.createGateway(gatewayData);

      expect(result.id).toBe('gateway-123');
      expect(result.name).toBe('Test Gateway');
      expect(result.hasCredentials).toBe(true);
      expect(result.credentials).toBeUndefined(); // Should be sanitized
    });
  });

  describe('findAllGateways', () => {
    it('should return all active gateways', async () => {
      const mockGateways = [
        { id: 'gw-1', name: 'Gateway 1', provider: 'stripe', credentials: {}, isActive: true },
        { id: 'gw-2', name: 'Gateway 2', provider: 'mada', credentials: {}, isActive: true },
      ];

      mockPrismaService.devPaymentGateway.findMany.mockResolvedValue(mockGateways);

      const result = await service.findAllGateways({ isActive: true });

      expect(result).toHaveLength(2);
      expect(mockPrismaService.devPaymentGateway.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
      const paymentData: ProcessPaymentDto = {
        gatewayId: 'gateway-123',
        amount: 100,
        currency: 'SAR',
        customerId: 'customer-123',
      };

      const mockGateway = {
        id: 'gateway-123',
        name: 'Test Gateway',
        provider: 'stripe',
        apiUrl: 'https://api.stripe.com',
        credentials: { apiKey: 'sk_test_xxx' },
        supportedCurrencies: ['SAR', 'USD'],
        isActive: true,
      };

      const mockTransaction = {
        id: 'txn-123',
        gatewayId: 'gateway-123',
        amount: 100,
        currency: 'SAR',
        status: 'pending',
        type: 'payment',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(mockGateway);
      mockPrismaService.devPaymentTransaction.create.mockResolvedValue(mockTransaction);
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        ...mockTransaction,
        status: 'pending',
      });
      mockEventsService.publish.mockResolvedValue(undefined);

      const result = await service.processPayment(paymentData);

      expect(result.transactionId).toBe('txn-123');
      expect(result.status).toBe('pending');
    });

    it('should throw error for inactive gateway', async () => {
      const paymentData: ProcessPaymentDto = {
        gatewayId: 'gateway-123',
        amount: 100,
        currency: 'SAR',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue({
        id: 'gateway-123',
        isActive: false,
        supportedCurrencies: ['SAR'],
      });

      await expect(service.processPayment(paymentData)).rejects.toThrow(BadRequestException);
    });

    it('should throw error for unsupported currency', async () => {
      const paymentData: ProcessPaymentDto = {
        gatewayId: 'gateway-123',
        amount: 100,
        currency: 'EUR',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue({
        id: 'gateway-123',
        isActive: true,
        supportedCurrencies: ['SAR', 'USD'],
      });

      await expect(service.processPayment(paymentData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment successfully', async () => {
      const refundData: RefundPaymentDto = {
        transactionId: 'txn-123',
        amount: 100,
        reason: 'Customer request',
      };

      const mockTransaction = {
        id: 'txn-123',
        gatewayId: 'gateway-123',
        amount: 100,
        currency: 'SAR',
        status: 'completed',
        gateway: { id: 'gateway-123', name: 'Test Gateway' },
      };

      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(mockTransaction);
      mockPrismaService.devPaymentTransaction.create.mockResolvedValue({
        id: 'refund-123',
        type: 'refund',
        status: 'pending',
      });
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        id: 'refund-123',
        status: 'completed',
      });
      mockEventsService.publish.mockResolvedValue(undefined);

      const result = await service.refundPayment(refundData);

      expect(result.refundId).toBe('refund-123');
      expect(result.originalTransactionId).toBe('txn-123');
      expect(result.status).toBe('completed');
    });

    it('should throw error for non-existent transaction', async () => {
      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(null);

      await expect(service.refundPayment({ transactionId: 'non-existent' })).rejects.toThrow(NotFoundException);
    });

    it('should throw error for non-completed transaction', async () => {
      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue({
        id: 'txn-123',
        status: 'pending',
      });

      await expect(service.refundPayment({ transactionId: 'txn-123' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllTransactions', () => {
    it('should return paginated transactions', async () => {
      const mockTransactions = [
        { id: 'txn-1', amount: 100, status: 'completed', gateway: { id: 'gw-1', name: 'Gateway 1' } },
        { id: 'txn-2', amount: 200, status: 'pending', gateway: { id: 'gw-1', name: 'Gateway 1' } },
      ];

      mockPrismaService.devPaymentTransaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(2);

      const result = await service.findAllTransactions({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter transactions by status', async () => {
      mockPrismaService.devPaymentTransaction.findMany.mockResolvedValue([]);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(0);

      await service.findAllTransactions({ status: 'completed', page: 1, limit: 10 });

      expect(mockPrismaService.devPaymentTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });
  });

  describe('findOneTransaction', () => {
    it('should return a single transaction', async () => {
      const mockTransaction = {
        id: 'txn-123',
        amount: 100,
        status: 'completed',
        gateway: { id: 'gw-1', name: 'Gateway 1', provider: 'stripe' },
      };

      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.findOneTransaction('txn-123');

      expect(result.id).toBe('txn-123');
      expect(result.gateway.name).toBe('Gateway 1');
    });

    it('should throw error for non-existent transaction', async () => {
      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(null);

      await expect(service.findOneTransaction('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
