import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaService: PrismaService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createGateway', () => {
    it('should create a payment gateway', async () => {
      const gatewayData = {
        name: 'STC Pay',
        code: 'stc_pay',
        type: 'local',
        config: { merchantId: '12345' },
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
      expect(result.code).toBe('stc_pay');
    });
  });

  describe('getGateways', () => {
    it('should return all payment gateways', async () => {
      const gateways = [
        { id: 'gw-1', name: 'STC Pay', code: 'stc_pay', isActive: true },
        { id: 'gw-2', name: 'Mada', code: 'mada', isActive: true },
      ];

      mockPrismaService.devPaymentGateway.findMany.mockResolvedValue(gateways);
      mockPrismaService.devPaymentGateway.count.mockResolvedValue(2);

      const result = await service.getGateways({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter active gateways', async () => {
      const gateways = [
        { id: 'gw-1', name: 'STC Pay', code: 'stc_pay', isActive: true },
      ];

      mockPrismaService.devPaymentGateway.findMany.mockResolvedValue(gateways);
      mockPrismaService.devPaymentGateway.count.mockResolvedValue(1);

      const result = await service.getGateways({ page: 1, limit: 10, isActive: true });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
      const paymentData = {
        gatewayCode: 'stc_pay',
        amount: 100.00,
        currency: 'SAR',
        customerId: 'customer-123',
        orderId: 'order-456',
      };

      const gateway = {
        id: 'gateway-123',
        code: 'stc_pay',
        isActive: true,
        config: { apiKey: 'test-key' },
      };

      const transaction = {
        id: 'txn-123',
        gatewayId: 'gateway-123',
        amount: 100.00,
        currency: 'SAR',
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrismaService.devPaymentGateway.findFirst.mockResolvedValue(gateway);
      mockPrismaService.devPaymentTransaction.create.mockResolvedValue(transaction);
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        ...transaction,
        status: 'completed',
      });

      const result = await service.processPayment(paymentData);

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });

    it('should throw error for inactive gateway', async () => {
      const paymentData = {
        gatewayCode: 'inactive_gateway',
        amount: 100.00,
        currency: 'SAR',
      };

      mockPrismaService.devPaymentGateway.findFirst.mockResolvedValue(null);

      await expect(service.processPayment(paymentData)).rejects.toThrow();
    });

    it('should handle payment failure', async () => {
      const paymentData = {
        gatewayCode: 'stc_pay',
        amount: 100.00,
        currency: 'SAR',
      };

      const gateway = {
        id: 'gateway-123',
        code: 'stc_pay',
        isActive: true,
      };

      const transaction = {
        id: 'txn-123',
        status: 'pending',
      };

      mockPrismaService.devPaymentGateway.findFirst.mockResolvedValue(gateway);
      mockPrismaService.devPaymentTransaction.create.mockResolvedValue(transaction);
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        ...transaction,
        status: 'failed',
        errorMessage: 'Insufficient funds',
      });

      const result = await service.processPayment(paymentData);

      expect(result.status).toBe('failed');
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      const transactions = [
        { id: 'txn-1', amount: 100, status: 'completed' },
        { id: 'txn-2', amount: 200, status: 'pending' },
      ];

      mockPrismaService.devPaymentTransaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(2);

      const result = await service.getTransactions({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      const transactions = [
        { id: 'txn-1', amount: 100, status: 'completed' },
      ];

      mockPrismaService.devPaymentTransaction.findMany.mockResolvedValue(transactions);
      mockPrismaService.devPaymentTransaction.count.mockResolvedValue(1);

      const result = await service.getTransactions({ 
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
        status: 'completed',
        gatewayId: 'gateway-123',
      };

      const gateway = {
        id: 'gateway-123',
        code: 'stc_pay',
        isActive: true,
      };

      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(originalTransaction);
      mockPrismaService.devPaymentGateway.findUnique.mockResolvedValue(gateway);
      mockPrismaService.devPaymentTransaction.update.mockResolvedValue({
        ...originalTransaction,
        status: 'refunded',
      });

      const result = await service.refundPayment(transactionId, { amount: 100 });

      expect(result.status).toBe('refunded');
    });

    it('should throw error for non-existent transaction', async () => {
      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(null);

      await expect(service.refundPayment('non-existent', { amount: 100 }))
        .rejects.toThrow();
    });

    it('should throw error for already refunded transaction', async () => {
      const transaction = {
        id: 'txn-123',
        status: 'refunded',
      };

      mockPrismaService.devPaymentTransaction.findUnique.mockResolvedValue(transaction);

      await expect(service.refundPayment('txn-123', { amount: 100 }))
        .rejects.toThrow();
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      mockPrismaService.devPaymentTransaction.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80)  // completed
        .mockResolvedValueOnce(15)  // pending
        .mockResolvedValueOnce(5);  // failed

      const result = await service.getPaymentStats();

      expect(result.total).toBe(100);
      expect(result.completed).toBe(80);
      expect(result.pending).toBe(15);
      expect(result.failed).toBe(5);
    });
  });
});
