import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AcrelCommandService } from '../src/modules/acrel/services/acrel-command.service';
import { AcrelMqttService } from '../src/modules/acrel/services/acrel-mqtt.service';
import { AcrelSecurityService } from '../src/modules/acrel/services/acrel-security.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CommandPriority } from '../src/modules/acrel/dto/acrel-command.dto';

describe('AcrelCommandService', () => {
  let service: AcrelCommandService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    devIotDevice: {
      findUnique: jest.fn(),
    },
    devIotCommand: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockMqttService = {
    getConnectionStatus: jest.fn(),
    publishCommand: jest.fn(),
  };

  const mockSecurityService = {
    signOutgoingRequest: jest.fn().mockReturnValue({ signature: 'test-sig', timestamp: '123' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcrelCommandService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: AcrelMqttService, useValue: mockMqttService },
        { provide: AcrelSecurityService, useValue: mockSecurityService },
      ],
    }).compile();

    service = module.get<AcrelCommandService>(AcrelCommandService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendDisconnectCommand', () => {
    it('should send disconnect command via MQTT when connected', async () => {
      const mockDevice = {
        id: 'device-uuid-123',
        deviceId: 'meter-001',
        name: 'Test Meter',
      };

      const mockCommand = {
        id: 'cmd-123',
        deviceId: 'device-uuid-123',
        command: 'disconnect',
        status: 'pending',
      };

      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.devIotCommand.create.mockResolvedValue(mockCommand);
      mockPrismaService.devIotCommand.update.mockResolvedValue({ ...mockCommand, status: 'sent' });
      mockMqttService.getConnectionStatus.mockReturnValue({ connected: true });
      mockMqttService.publishCommand.mockResolvedValue(undefined);

      const result = await service.sendDisconnectCommand({
        deviceId: 'meter-001',
        reason: 'Test disconnect',
        priority: CommandPriority.NORMAL,
      });

      expect(result.commandId).toBe('cmd-123');
      expect(result.status).toBe('sent');
      expect(mockMqttService.publishCommand).toHaveBeenCalled();
    });

    it('should throw error for non-existent device', async () => {
      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(null);

      await expect(
        service.sendDisconnectCommand({
          deviceId: 'non-existent',
          reason: 'Test',
        }),
      ).rejects.toThrow('Device non-existent not found');
    });
  });

  describe('sendReconnectCommand', () => {
    it('should send reconnect command successfully', async () => {
      const mockDevice = {
        id: 'device-uuid-123',
        deviceId: 'meter-001',
        name: 'Test Meter',
      };

      const mockCommand = {
        id: 'cmd-456',
        deviceId: 'device-uuid-123',
        command: 'reconnect',
        status: 'pending',
      };

      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.devIotCommand.create.mockResolvedValue(mockCommand);
      mockPrismaService.devIotCommand.update.mockResolvedValue({ ...mockCommand, status: 'sent' });
      mockMqttService.getConnectionStatus.mockReturnValue({ connected: true });
      mockMqttService.publishCommand.mockResolvedValue(undefined);

      const result = await service.sendReconnectCommand({
        deviceId: 'meter-001',
        reason: 'Test reconnect',
      });

      expect(result.commandId).toBe('cmd-456');
      expect(result.status).toBe('sent');
    });
  });

  describe('sendReadMeterCommand', () => {
    it('should send read meter command successfully', async () => {
      const mockDevice = {
        id: 'device-uuid-123',
        deviceId: 'meter-001',
        name: 'Test Meter',
      };

      const mockCommand = {
        id: 'cmd-789',
        deviceId: 'device-uuid-123',
        command: 'read_meter',
        status: 'pending',
      };

      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.devIotCommand.create.mockResolvedValue(mockCommand);
      mockPrismaService.devIotCommand.update.mockResolvedValue({ ...mockCommand, status: 'sent' });
      mockMqttService.getConnectionStatus.mockReturnValue({ connected: true });
      mockMqttService.publishCommand.mockResolvedValue(undefined);

      const result = await service.sendReadMeterCommand({
        deviceId: 'meter-001',
        readingType: 'instant',
      });

      expect(result.commandId).toBe('cmd-789');
      expect(result.status).toBe('sent');
    });
  });

  describe('sendSetParameterCommand', () => {
    it('should send set parameter command successfully', async () => {
      const mockDevice = {
        id: 'device-uuid-123',
        deviceId: 'meter-001',
        name: 'Test Meter',
      };

      const mockCommand = {
        id: 'cmd-101',
        deviceId: 'device-uuid-123',
        command: 'set_parameter',
        status: 'pending',
      };

      mockPrismaService.devIotDevice.findUnique.mockResolvedValue(mockDevice);
      mockPrismaService.devIotCommand.create.mockResolvedValue(mockCommand);
      mockPrismaService.devIotCommand.update.mockResolvedValue({ ...mockCommand, status: 'sent' });
      mockMqttService.getConnectionStatus.mockReturnValue({ connected: true });
      mockMqttService.publishCommand.mockResolvedValue(undefined);

      const result = await service.sendSetParameterCommand({
        deviceId: 'meter-001',
        parameterName: 'voltage_threshold',
        parameterValue: '240',
      });

      expect(result.commandId).toBe('cmd-101');
      expect(result.status).toBe('sent');
    });
  });

  describe('getCommandStatus', () => {
    it('should return command status', async () => {
      const mockCommand = {
        id: 'cmd-123',
        deviceId: 'device-uuid-123',
        command: 'disconnect',
        status: 'executed',
        response: { success: true },
        createdAt: new Date(),
        executedAt: new Date(),
      };

      mockPrismaService.devIotCommand.findUnique.mockResolvedValue(mockCommand);

      const result = await service.getCommandStatus('cmd-123');

      expect(result.status).toBe('executed');
      expect(result.command).toBe('disconnect');
    });

    it('should return not_found for non-existent command', async () => {
      mockPrismaService.devIotCommand.findUnique.mockResolvedValue(null);

      const result = await service.getCommandStatus('non-existent');

      expect(result.status).toBe('not_found');
    });
  });

  describe('getPendingCommands', () => {
    it('should return pending commands', async () => {
      const mockCommands = [
        { id: 'cmd-1', command: 'disconnect', status: 'pending' },
        { id: 'cmd-2', command: 'reconnect', status: 'sent' },
      ];

      mockPrismaService.devIotCommand.findMany.mockResolvedValue(mockCommands);

      const result = await service.getPendingCommands();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.devIotCommand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['pending', 'sent'] },
          },
        }),
      );
    });
  });
});
