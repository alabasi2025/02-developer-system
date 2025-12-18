import { Test, TestingModule } from '@nestjs/testing';
import { AcrelWebhookService } from '../src/modules/acrel/services/acrel-webhook.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AlertType, DeviceStatus } from '../src/modules/acrel/dto/acrel-webhook.dto';

describe('AcrelWebhookService', () => {
  let service: AcrelWebhookService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    devEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    devIotDevice: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    devIotReading: {
      create: jest.fn(),
    },
    devIotAlertRule: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    devIotAlert: {
      create: jest.fn(),
    },
    devIotCommand: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcrelWebhookService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AcrelWebhookService>(AcrelWebhookService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isEventProcessed', () => {
    it('should return false for new event', async () => {
      mockPrismaService.devEvent.findFirst.mockResolvedValue(null);

      const result = await service.isEventProcessed('new-event-id');

      expect(result).toBe(false);
    });

    it('should return true for already processed event', async () => {
      mockPrismaService.devEvent.findFirst.mockResolvedValue({ id: 'existing-event' });

      const result = await service.isEventProcessed('existing-event-id');

      expect(result).toBe(true);
    });
  });

  describe('processMeterReading', () => {
    it('should process meter reading successfully', async () => {
      const meterData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        timestamp: new Date().toISOString(),
        reading: 1234.56,
        voltage: 220,
        current: 5.5,
        activePower: 1100,
        reactivePower: 200,
        powerFactor: 0.95,
        frequency: 50,
      };

      const mockDevice = {
        id: 'device-uuid-123',
        deviceId: 'meter-001',
        name: 'Meter M12345',
        deviceType: 'meter',
      };

      mockPrismaService.devIotDevice.upsert.mockResolvedValue(mockDevice);
      mockPrismaService.devIotReading.create.mockResolvedValue({ id: 'reading-123' });
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processMeterReading(meterData, 'event-001');

      expect(result.deviceId).toBe('device-uuid-123');
      expect(result.reading).toBe(1234.56);
      expect(mockPrismaService.devIotDevice.upsert).toHaveBeenCalled();
      expect(mockPrismaService.devIotReading.create).toHaveBeenCalled();
      expect(mockPrismaService.devEvent.create).toHaveBeenCalled();
    });
  });

  describe('processAlert', () => {
    it('should process alert and create new rule if not exists', async () => {
      const alertData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        alertType: AlertType.OVER_VOLTAGE,
        severity: 4,
        message: 'Voltage exceeded threshold',
        value: 250,
        threshold: 240,
        timestamp: new Date().toISOString(),
        metadata: { phase: 'A' },
      };

      const mockDevice = { id: 'device-uuid-123', deviceId: 'meter-001' };
      const mockAlertRule = { id: 'rule-123', alertType: AlertType.OVER_VOLTAGE };
      const mockAlert = { id: 'alert-123' };

      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.devIotAlertRule.findFirst.mockResolvedValue(null);
      mockPrismaService.devIotAlertRule.create.mockResolvedValue(mockAlertRule);
      mockPrismaService.devIotAlert.create.mockResolvedValue(mockAlert);
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processAlert(alertData, 'event-002');

      expect(result.alertId).toBe('alert-123');
      expect(result.type).toBe(AlertType.OVER_VOLTAGE);
      expect(mockPrismaService.devIotAlertRule.create).toHaveBeenCalled();
    });

    it('should use existing alert rule', async () => {
      const alertData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        alertType: AlertType.OVER_VOLTAGE,
        severity: 4,
        message: 'Voltage exceeded threshold',
        value: 250,
        threshold: 240,
        timestamp: new Date().toISOString(),
      };

      const mockDevice = { id: 'device-uuid-123', deviceId: 'meter-001' };
      const mockAlertRule = { id: 'existing-rule', alertType: AlertType.OVER_VOLTAGE };
      const mockAlert = { id: 'alert-456' };

      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.devIotAlertRule.findFirst.mockResolvedValue(mockAlertRule);
      mockPrismaService.devIotAlert.create.mockResolvedValue(mockAlert);
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processAlert(alertData, 'event-003');

      expect(result.alertId).toBe('alert-456');
      expect(mockPrismaService.devIotAlertRule.create).not.toHaveBeenCalled();
    });
  });

  describe('processStatusChange', () => {
    it('should update device status', async () => {
      const statusData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        previousStatus: DeviceStatus.OFFLINE,
        newStatus: DeviceStatus.ONLINE,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.devIotDevice.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processStatusChange(statusData, 'event-004');

      expect(result.deviceId).toBe('meter-001');
      expect(result.newStatus).toBe(DeviceStatus.ONLINE);
      expect(mockPrismaService.devIotDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceId: 'meter-001' },
          data: expect.objectContaining({
            status: 'active',
            isOnline: true,
          }),
        }),
      );
    });

    it('should set offline status correctly', async () => {
      const statusData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        previousStatus: DeviceStatus.ONLINE,
        newStatus: DeviceStatus.DISCONNECTED,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.devIotDevice.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processStatusChange(statusData, 'event-005');

      expect(mockPrismaService.devIotDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'offline',
            isOnline: false,
          }),
        }),
      );
    });
  });

  describe('processDisconnectConfirm', () => {
    it('should update command status on success', async () => {
      const disconnectData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        commandId: 'cmd-123',
        status: 'success' as const,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.devIotCommand.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devIotDevice.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processDisconnectConfirm(disconnectData, 'event-006');

      expect(result.commandId).toBe('cmd-123');
      expect(result.status).toBe('success');
      expect(mockPrismaService.devIotCommand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'executed',
          }),
        }),
      );
    });

    it('should update command status on failure', async () => {
      const disconnectData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        commandId: 'cmd-123',
        status: 'failed' as const,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.devIotCommand.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processDisconnectConfirm(disconnectData, 'event-007');

      expect(mockPrismaService.devIotCommand.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        }),
      );
      // Device status should not be updated on failure
      expect(mockPrismaService.devIotDevice.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('processReconnectConfirm', () => {
    it('should update command and device status on success', async () => {
      const reconnectData = {
        deviceId: 'meter-001',
        meterNumber: 'M12345',
        commandId: 'cmd-456',
        status: 'success' as const,
        timestamp: new Date().toISOString(),
      };

      mockPrismaService.devIotCommand.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devIotDevice.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.devEvent.create.mockResolvedValue({ id: 'event-123' });

      const result = await service.processReconnectConfirm(reconnectData, 'event-008');

      expect(result.commandId).toBe('cmd-456');
      expect(result.status).toBe('success');
      expect(mockPrismaService.devIotDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            isOnline: true,
          }),
        }),
      );
    });
  });
});
