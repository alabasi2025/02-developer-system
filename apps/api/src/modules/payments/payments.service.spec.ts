import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../events/events.service';
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
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGateway', () => {
    it('should create a payment gateway', async () => {
      const gatewayData = {
        name: 'STC Pay',
        provider: 'stc_pay',
        apiUrl: 'https://api.stcpay.com',
        credentials: { merchantId: '12345' },
        supportedCurrencies: ['SAR'],
      };

      const createdGateway = {
        id: 'gateway-123',
        ...gatewayData,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.devPaymentGateway.create.mockResolvedValue(createdGateway);

      const result = await service.createGateway(gatewayData);

      expect(result.id).toBe('gateway-123');
      expect(result.name).toBe('STC Pay');
      expect(result.hasCredentials).toBe(true);
    });
  });

  describe('findAllGateways', () => {
    it('should return all payment gateways', async () => {
      const gateways = [
        { id: 'gw-1', name: 'STC Pay', provider: 'stc_pay', isActive: true },
        { id: 'gw-2', name: 'Mada', provider: 'mada', isActive: true },
      ];

      mockPrismaService.devPaymentGateway.findMany.mockResolvedValue(gateways);

      const result = await service.findAllGateways({});

      expect(result).toHaveLength(2);
    });

    it('should filter active gateways', async () => {
      const gateways = [
        { id: 'gw-1', name: 'STC Pay', provider: 'stc_pay', isActive: true },
      ];

      mockPrismaService.devPaymentGateway.findMany.mockResolvedValue(gateways);

      const result = await service.findAllGateways({ isActive: true });

      expect(result).toHaveLength(1);
    });
  });

  describe('findOneGateway', () => {
    it('should return gateway by id', async () => {
      const gateway = {
        id: 'gateway-123',
        name: 'STC Pay',
        provider: 'stc_pay',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(gateway);

      const result = await service.findOneGateway('gateway-123');

      expect(result.id).toBe('gateway-123');
    });

    it('should throw NotFoundException for non-existent gateway', async () => {
      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(null);

      await expect(service.findOneGateway('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
      const paymentData = {
        gatewayId: 'gateway-123',
        amount: 100.00,
        currency: 'SAR',
        customerId: 'customer-123',
      };

      const gateway = {
        id: 'gateway-123',
        provider: 'stc_pay',
        apiUrl: 'https://api.stcpay.com',
        isActive: true,
        supportedCurrencies: ['SAR'],
        credentials: { apiKey: 'test-key' },
      };

      const transaction = {
        id: 'txn-123',
        gatewayId: 'gateway-123',
        amount: 100.00,
        currency: 'SAR',
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(gateway);
      mockPrismaService.devPaymentTransaction.create.mockResolvedValue(transaction);
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        ...transaction,
        status: 'pending',
      });
      mockEventsService.publish.mockResolvedValue({});

      const result = await service.processPayment(paymentData);

      expect(result).toBeDefined();
      expect(result.transactionId).toBe('txn-123');
    });

    it('should throw NotFoundException for non-existent gateway', async () => {
      const paymentData = {
        gatewayId: 'non-existent',
        amount: 100.00,
        currency: 'SAR',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(null);

      await expect(service.processPayment(paymentData)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive gateway', async () => {
      const paymentData = {
        gatewayId: 'gateway-123',
        amount: 100.00,
        currency: 'SAR',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue({
        id: 'gateway-123',
        isActive: false,
        supportedCurrencies: ['SAR'],
      });

      await expect(service.processPayment(paymentData)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported currency', async () => {
      const paymentData = {
        gatewayId: 'gateway-123',
        amount: 100.00,
        currency: 'USD',
      };

      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue({
        id: 'gateway-123',
        isActive: true,
        supportedCurrencies: ['SAR'],
      });

      await expect(service.processPayment(paymentData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllTransactions', () => {
    it('should return paginated transactions', async () => {
      const transactions = [
        { id: 'txn-1', amount: 100, status: 'completed' },
        { id: 'txn-2', amount: 200, status: 'pending' },
      ];

      mockPrismaService.devPaymentTransaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(2);

      const result = await service.findAllTransactions({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      const transactions = [
        { id: 'txn-1', amount: 100, status: 'completed' },
      ];

      mockPrismaService.devPaymentTransaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(1);

      const result = await service.findAllTransactions({ 
        page: 1, 
        limit: 10, 
        status: 'completed' 
      });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('refundPayment', () => {
    it('should process refund successfully', async () => {
      const transactionId = 'txn-123';
      const originalTransaction = {
        id: transactionId,
        amount: 100,
        currency: 'SAR',
        status: 'completed',
        gatewayId: 'gateway-123',
        gateway: { id: 'gateway-123', provider: 'stc_pay' },
      };

      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(originalTransaction);
      mockPrismaService.devPaymentTransaction.create.mockResolvedValue({
        id: 'refund-123',
        amount: 100,
        status: 'pending',
      });
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        id: 'refund-123',
        status: 'completed',
      });
      mockEventsService.publish.mockResolvedValue({});

      const result = await service.refundPayment({ transactionId, amount: 100 });

      expect(result.status).toBe('completed');
      expect(result.originalTransactionId).toBe(transactionId);
    });

    it('should throw NotFoundException for non-existent transaction', async () => {
      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(null);

      await expect(service.refundPayment({ transactionId: 'non-existent' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-completed transaction', async () => {
      const transaction = {
        id: 'txn-123',
        status: 'pending',
      };

      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(transaction);

      await expect(service.refundPayment({ transactionId: 'txn-123' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteGateway', () => {
    it('should soft delete a gateway', async () => {
      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue({ id: 'gateway-123' });
      mockPrismaService.devPaymentGateway.update.mockResolvedValue({
        id: 'gateway-123',
        isActive: false,
      });

      const result = await service.deleteGateway('gateway-123');

      expect(result.message).toBe('تم تعطيل بوابة الدفع بنجاح');
    });

    it('should throw NotFoundException for non-existent gateway', async () => {
      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(null);

      await expect(service.deleteGateway('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
