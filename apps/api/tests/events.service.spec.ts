import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsService } from '../src/modules/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';
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
      update: jest.fn(),
      count: jest.fn(),
    },
    devEventSubscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
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

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish an event successfully', async () => {
      const publishDto = {
        eventType: 'customer.created',
        sourceSystem: 'core',
        payload: { customerId: '123', name: 'Test Customer' },
      };

      const mockEvent = {
        id: 'event-123',
        eventType: 'customer.created',
        sourceSystem: 'core',
        status: 'processing',
        payload: publishDto.payload,
        createdAt: new Date(),
      };

      mockPrismaService.devEvent.create.mockResolvedValue(mockEvent);
      mockPrismaService.devEvent.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.devEventSubscription.findMany.mockResolvedValue([]);
      mockPrismaService.devEventDelivery.findMany.mockResolvedValue([]);
      mockPrismaService.devEvent.update.mockResolvedValue({ ...mockEvent, status: 'processed' });

      const result = await service.publish(publishDto);

      expect(result.id).toBe('event-123');
      expect(result.eventType).toBe('customer.created');
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });

    it('should create scheduled event', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const publishDto = {
        eventType: 'reminder.send',
        sourceSystem: 'scheduler',
        payload: { message: 'Test reminder' },
        scheduledFor: futureDate,
      };

      const mockEvent = {
        id: 'event-456',
        eventType: 'reminder.send',
        status: 'pending',
        scheduledFor: new Date(futureDate),
      };

      mockPrismaService.devEvent.create.mockResolvedValue(mockEvent);

      const result = await service.publish(publishDto);

      expect(result.status).toBe('pending');
    });
  });

  describe('findAll', () => {
    it('should return paginated events', async () => {
      const mockEvents = [
        { id: 'event-1', eventType: 'customer.created', status: 'processed' },
        { id: 'event-2', eventType: 'invoice.paid', status: 'processed' },
      ];

      mockPrismaService.devEvent.findMany.mockResolvedValue(mockEvents);
      mockPrismaService.devEvent.count.mockResolvedValue(2);

      const result = await service.findAllEvents({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter events by type', async () => {
      mockPrismaService.devEvent.findMany.mockResolvedValue([]);
      mockPrismaService.devEvent.count.mockResolvedValue(0);

      await service.findAllEvents({ eventType: 'customer.created', page: 1, limit: 10 });

      expect(mockPrismaService.devEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: { contains: 'customer.created' } }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a single event', async () => {
      const mockEvent = {
        id: 'event-123',
        eventType: 'customer.created',
        status: 'processed',
        payload: { customerId: '123' },
        deliveries: [],
      };

      mockPrismaService.devEvent.findUnique.mockResolvedValue(mockEvent);

      const result = await service.findOneEvent('event-123');

      expect(result.id).toBe('event-123');
      expect(result.eventType).toBe('customer.created');
    });

    it('should throw error for non-existent event', async () => {
      mockPrismaService.devEvent.findUnique.mockResolvedValue(null);

      await expect(service.findOneEvent('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSubscription', () => {
    it('should create a subscription', async () => {
      const subscriptionDto = {
        eventType: 'customer.created',
        targetSystem: 'billing',
        webhookUrl: 'https://example.com/webhook',
      };

      const mockSubscription = {
        id: 'sub-123',
        ...subscriptionDto,
        httpMethod: 'POST',
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.devEventSubscription.findFirst.mockResolvedValue(null);
      mockPrismaService.devEventSubscription.create.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(subscriptionDto);

      expect(result.id).toBe('sub-123');
      expect(result.eventType).toBe('customer.created');
    });

    it('should throw error for duplicate subscription', async () => {
      const subscriptionDto = {
        eventType: 'customer.created',
        targetSystem: 'billing',
      };

      mockPrismaService.devEventSubscription.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.createSubscription(subscriptionDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllSubscriptions', () => {
    it('should return all subscriptions', async () => {
      const mockSubscriptions = [
        { id: 'sub-1', eventType: 'customer.*', targetSystem: 'billing', isActive: true, secret: 'secret1' },
        { id: 'sub-2', eventType: 'invoice.*', targetSystem: 'core', isActive: true, secret: 'secret2' },
      ];

      mockPrismaService.devEventSubscription.findMany.mockResolvedValue(mockSubscriptions);
      mockPrismaService.devEventSubscription.count.mockResolvedValue(2);

      const result = await service.findAllSubscriptions({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('updateSubscription', () => {
    it('should update a subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        eventType: 'customer.updated',
        targetSystem: 'billing',
        isActive: true,
        secret: 'secret',
      };

      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue({ id: 'sub-123' });
      mockPrismaService.devEventSubscription.update.mockResolvedValue(mockSubscription);

      const result = await service.updateSubscription('sub-123', { eventType: 'customer.updated' });

      expect(result.eventType).toBe('customer.updated');
    });

    it('should throw error for non-existent subscription', async () => {
      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.updateSubscription('non-existent', { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneSubscription', () => {
    it('should return a single subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        eventType: 'customer.created',
        targetSystem: 'billing',
        isActive: true,
        secret: 'secret',
      };

      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.findOneSubscription('sub-123');

      expect(result.id).toBe('sub-123');
    });

    it('should throw error for non-existent subscription', async () => {
      mockPrismaService.devEventSubscription.findUnique.mockResolvedValue(null);

      await expect(service.findOneSubscription('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
