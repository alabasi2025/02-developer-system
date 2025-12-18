import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsService } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('EventsService', () => {
  let service: EventsService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    devEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    devEventSubscription: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    devEventDelivery: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish an event successfully', async () => {
      const eventData = {
        eventType: 'customer.created',
        sourceSystem: 'core',
        payload: { customerId: '123', name: 'Test Customer' },
      };

      const mockEvent = {
        id: 'event-123',
        ...eventData,
        status: 'processing',
        createdAt: new Date(),
      };

      mockPrismaService.devEvent.create.mockResolvedValue(mockEvent);
      mockPrismaService.devEvent.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.devEventSubscription.findMany.mockResolvedValue([]);
      mockPrismaService.devEventDelivery.findMany.mockResolvedValue([]);
      mockPrismaService.devEvent.update.mockResolvedValue({ ...mockEvent, status: 'completed' });

      const result = await service.publish(eventData);

      expect(result).toBeDefined();
      expect(result.id).toBe('event-123');
      expect(result.eventType).toBe('customer.created');
      expect(mockPrismaService.devEvent.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('customer.created', expect.any(Object));
    });

    it('should create scheduled event without immediate processing', async () => {
      const eventData = {
        eventType: 'report.generate',
        sourceSystem: 'core',
        payload: { reportId: '456' },
        scheduledFor: new Date(Date.now() + 3600000).toISOString(),
      };

      const mockEvent = {
        id: 'event-456',
        ...eventData,
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrismaService.devEvent.create.mockResolvedValue(mockEvent);

      const result = await service.publish(eventData);

      expect(result.status).toBe('pending');
    });
  });

  describe('findAllEvents', () => {
    it('should return paginated events', async () => {
      const mockEvents = [
        { id: '1', eventType: 'test.event', status: 'completed' },
        { id: '2', eventType: 'test.event', status: 'completed' },
      ];

      mockPrismaService.devEvent.findMany.mockResolvedValue(mockEvents);
      mockPrismaService.devEvent.count.mockResolvedValue(2);

      const result = await service.findAllEvents({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter events by eventType', async () => {
      mockPrismaService.devEvent.findMany.mockResolvedValue([]);
      mockPrismaService.devEvent.count.mockResolvedValue(0);

      await service.findAllEvents({ eventType: 'customer.created', page: 1, limit: 10 });

      expect(mockPrismaService.devEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: { contains: 'customer.created' },
          }),
        })
      );
    });
  });

  describe('findOneEvent', () => {
    it('should return event by id', async () => {
      const mockEvent = {
        id: 'event-123',
        eventType: 'test.event',
        deliveries: [],
      };

      mockPrismaService.devEvent.findUnique.mockResolvedValue(mockEvent);

      const result = await service.findOneEvent('event-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('event-123');
    });

    it('should throw NotFoundException for non-existent event', async () => {
      mockPrismaService.devEvent.findUnique.mockResolvedValue(null);

      await expect(service.findOneEvent('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSubscription', () => {
    it('should create a subscription successfully', async () => {
      const subscriptionData = {
        eventType: 'customer.created',
        targetSystem: 'billing',
        webhookUrl: 'https://billing.example.com/webhook',
      };

      const mockSubscription = {
        id: 'sub-123',
        ...subscriptionData,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.devEventSubscription.findFirst.mockResolvedValue(null);
      mockPrismaService.devEventSubscription.create.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(subscriptionData);

      expect(result).toBeDefined();
      expect(result.id).toBe('sub-123');
      expect(mockPrismaService.devEventSubscription.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for duplicate subscription', async () => {
      const subscriptionData = {
        eventType: 'customer.created',
        targetSystem: 'billing',
      };

      mockPrismaService.devEventSubscription.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.createSubscription(subscriptionData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const mockSubscriptions = [
        { id: '1', eventType: 'test.*', targetSystem: 'billing', isActive: true },
        { id: '2', eventType: 'customer.*', targetSystem: 'crm', isActive: true },
      ];

      mockPrismaService.devEventSubscription.findMany.mockResolvedValue(mockSubscriptions);
      mockPrismaService.devEventSubscription.count.mockResolvedValue(2);

      const result = await service.findAllSubscriptions({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const updateData = { isActive: false };

      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue({ id: 'sub-123' });
      mockPrismaService.devEventSubscription.update.mockResolvedValue({
        id: 'sub-123',
        isActive: false,
      });

      const result = await service.updateSubscription('sub-123', updateData);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue(null);

      await expect(service.updateSubscription('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeSubscription', () => {
    it('should delete subscription successfully', async () => {
      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue({ id: 'sub-123' });
      mockPrismaService.devEventSubscription.delete.mockResolvedValue({ id: 'sub-123' });

      const result = await service.removeSubscription('sub-123');

      expect(result.message).toBe('تم حذف الاشتراك بنجاح');
      expect(mockPrismaService.devEventSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
      });
    });

    it('should throw NotFoundException for non-existent subscription', async () => {
      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue(null);

      await expect(service.removeSubscription('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryFailedDeliveries', () => {
    it('should retry failed deliveries', async () => {
      mockPrismaService.devEventDelivery.findMany.mockResolvedValue([]);

      const result = await service.retryFailedDeliveries();

      expect(result.retried).toBe(0);
    });
  });
});
