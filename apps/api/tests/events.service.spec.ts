import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventsService } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EventsService', () => {
  let service: EventsService;
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;

  const mockPrismaService = {
    devEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    devWebhook: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    devEventSubscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
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

  describe('publishEvent', () => {
    it('should create and publish an event', async () => {
      const eventData = {
        eventType: 'customer.created',
        sourceSystem: 'billing',
        payload: { customerId: '123', name: 'Test Customer' },
      };

      const createdEvent = {
        id: 'event-123',
        ...eventData,
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrismaService.devEvent.create.mockResolvedValue(createdEvent);

      const result = await service.publishEvent(eventData);

      expect(result).toBeDefined();
      expect(result.id).toBe('event-123');
      expect(mockPrismaService.devEvent.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        eventData.eventType,
        expect.any(Object),
      );
    });

    it('should handle event with metadata', async () => {
      const eventData = {
        eventType: 'invoice.paid',
        sourceSystem: 'billing',
        payload: { invoiceId: '456', amount: 1000 },
        metadata: { userId: 'user-1', ip: '192.168.1.1' },
      };

      const createdEvent = {
        id: 'event-456',
        ...eventData,
        status: 'pending',
        createdAt: new Date(),
      };

      mockPrismaService.devEvent.create.mockResolvedValue(createdEvent);

      const result = await service.publishEvent(eventData);

      expect(result.id).toBe('event-456');
      expect(mockPrismaService.devEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'invoice.paid',
          metadata: eventData.metadata,
        }),
      });
    });
  });

  describe('getEvents', () => {
    it('should return paginated events', async () => {
      const events = [
        { id: 'event-1', eventType: 'customer.created', status: 'completed' },
        { id: 'event-2', eventType: 'invoice.paid', status: 'completed' },
      ];

      mockPrismaService.devEvent.findMany.mockResolvedValue(events);
      mockPrismaService.devEvent.count.mockResolvedValue(2);

      const result = await service.getEvents({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrismaService.devEvent.findMany).toHaveBeenCalled();
    });

    it('should filter events by type', async () => {
      const events = [
        { id: 'event-1', eventType: 'customer.created', status: 'completed' },
      ];

      mockPrismaService.devEvent.findMany.mockResolvedValue(events);
      mockPrismaService.devEvent.count.mockResolvedValue(1);

      const result = await service.getEvents({
        page: 1,
        limit: 10,
        eventType: 'customer.created',
      });

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.devEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'customer.created',
          }),
        }),
      );
    });

    it('should filter events by status', async () => {
      mockPrismaService.devEvent.findMany.mockResolvedValue([]);
      mockPrismaService.devEvent.count.mockResolvedValue(0);

      await service.getEvents({
        page: 1,
        limit: 10,
        status: 'failed',
      });

      expect(mockPrismaService.devEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'failed',
          }),
        }),
      );
    });
  });

  describe('getEventById', () => {
    it('should return event by id', async () => {
      const event = {
        id: 'event-123',
        eventType: 'customer.created',
        status: 'completed',
      };

      mockPrismaService.devEvent.findUnique.mockResolvedValue(event);

      const result = await service.getEventById('event-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('event-123');
    });

    it('should return null for non-existent event', async () => {
      mockPrismaService.devEvent.findUnique.mockResolvedValue(null);

      const result = await service.getEventById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createWebhook', () => {
    it('should create a webhook', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['customer.created', 'invoice.paid'],
      };

      const createdWebhook = {
        id: 'webhook-123',
        ...webhookData,
        isActive: true,
        createdAt: new Date(),
      };

      mockPrismaService.devWebhook.create.mockResolvedValue(createdWebhook);

      const result = await service.createWebhook(webhookData);

      expect(result.id).toBe('webhook-123');
      expect(result.url).toBe(webhookData.url);
      expect(mockPrismaService.devWebhook.create).toHaveBeenCalled();
    });
  });

  describe('getWebhooks', () => {
    it('should return all webhooks', async () => {
      const webhooks = [
        { id: 'webhook-1', name: 'Webhook 1', isActive: true },
        { id: 'webhook-2', name: 'Webhook 2', isActive: false },
      ];

      mockPrismaService.devWebhook.findMany.mockResolvedValue(webhooks);
      mockPrismaService.devWebhook.count.mockResolvedValue(2);

      const result = await service.getWebhooks({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter active webhooks', async () => {
      const webhooks = [
        { id: 'webhook-1', name: 'Webhook 1', isActive: true },
      ];

      mockPrismaService.devWebhook.findMany.mockResolvedValue(webhooks);
      mockPrismaService.devWebhook.count.mockResolvedValue(1);

      const result = await service.getWebhooks({
        page: 1,
        limit: 10,
        isActive: true,
      });

      expect(result.data).toHaveLength(1);
    });
  });

  describe('updateWebhook', () => {
    it('should update a webhook', async () => {
      const updateData = {
        name: 'Updated Webhook',
        url: 'https://new-url.com/webhook',
      };

      const updatedWebhook = {
        id: 'webhook-123',
        ...updateData,
        isActive: true,
      };

      mockPrismaService.devWebhook.update.mockResolvedValue(updatedWebhook);

      const result = await service.updateWebhook('webhook-123', updateData);

      expect(result.name).toBe('Updated Webhook');
      expect(mockPrismaService.devWebhook.update).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
        data: updateData,
      });
    });
  });

  describe('deleteWebhook', () => {
    it('should delete a webhook', async () => {
      mockPrismaService.devWebhook.delete.mockResolvedValue({ id: 'webhook-123' });

      await service.deleteWebhook('webhook-123');

      expect(mockPrismaService.devWebhook.delete).toHaveBeenCalledWith({
        where: { id: 'webhook-123' },
      });
    });
  });

  describe('getEventTypes', () => {
    it('should return all event types', () => {
      const eventTypes = service.getEventTypes();

      expect(Array.isArray(eventTypes)).toBe(true);
      expect(eventTypes.length).toBeGreaterThan(0);
      expect(eventTypes).toContain('customer.created');
      expect(eventTypes).toContain('invoice.paid');
    });
  });
});
