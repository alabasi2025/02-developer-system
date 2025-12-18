import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService, JwtPayload, ValidatedUser } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockPrismaService = {
    devApiKey: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123';
      const hashedPassword = await service.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 12);

      const result = await service.comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = await bcrypt.hash(password, 12);

      const result = await service.comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });
  });

  describe('validateJwtPayload', () => {
    it('should return validated user for valid payload', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['read', 'write'],
        tenantId: 'tenant-1',
      };

      const result = await service.validateJwtPayload(payload);

      expect(result).toBeDefined();
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
      expect(result?.roles).toEqual(['admin']);
      expect(result?.permissions).toEqual(['read', 'write']);
    });

    it('should return null for payload without sub', async () => {
      const payload: JwtPayload = {
        sub: '',
        roles: [],
        permissions: [],
      };

      const result = await service.validateJwtPayload(payload);

      expect(result).toBeNull();
    });
  });

  describe('validateApiKey', () => {
    it('should return null for non-existent API key', async () => {
      mockPrismaService.devApiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid-key');

      expect(result).toBeNull();
    });

    it('should validate and return user for valid API key', async () => {
      const apiKey = 'test1234abcdefghijklmnopqrstuvwxyz12345678';
      const keyHash = await bcrypt.hash(apiKey, 12);

      mockPrismaService.devApiKey.findFirst.mockResolvedValue({
        id: 'key-123',
        systemId: 'core',
        keyHash,
        permissions: ['read', 'write'],
        isActive: true,
      });

      mockPrismaService.devApiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey(apiKey);

      expect(result).toBeDefined();
      expect(result?.id).toBe('key-123');
      expect(result?.systemId).toBe('core');
      expect(result?.permissions).toEqual(['read', 'write']);
    });
  });

  describe('generateSystemToken', () => {
    it('should generate a JWT token for system', async () => {
      const systemId = 'core';
      const permissions = ['read', 'write'];
      const expectedToken = 'jwt-token';

      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = await service.generateSystemToken(systemId, permissions);

      expect(result).toBe(expectedToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: systemId,
        systemId,
        roles: ['system'],
        permissions,
      });
    });
  });

  describe('hasPermission', () => {
    it('should return true for admin user', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['admin'],
        permissions: [],
      };

      const result = service.hasPermission(user, 'any:permission');

      expect(result).toBe(true);
    });

    it('should return true for super_admin user', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['super_admin'],
        permissions: [],
      };

      const result = service.hasPermission(user, 'any:permission');

      expect(result).toBe(true);
    });

    it('should return true for user with wildcard permission', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['user'],
        permissions: ['*'],
      };

      const result = service.hasPermission(user, 'any:permission');

      expect(result).toBe(true);
    });

    it('should return true for user with specific permission', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['user'],
        permissions: ['integrations:read'],
      };

      const result = service.hasPermission(user, 'integrations:read');

      expect(result).toBe(true);
    });

    it('should return false for user without permission', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['user'],
        permissions: ['integrations:read'],
      };

      const result = service.hasPermission(user, 'integrations:write');

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the role', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['admin', 'manager'],
        permissions: [],
      };

      expect(service.hasRole(user, 'admin')).toBe(true);
      expect(service.hasRole(user, 'manager')).toBe(true);
    });

    it('should return false when user does not have the role', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['user'],
        permissions: [],
      };

      expect(service.hasRole(user, 'admin')).toBe(false);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true when user has any of the roles', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['manager'],
        permissions: [],
      };

      const result = service.hasAnyRole(user, ['admin', 'manager', 'operator']);

      expect(result).toBe(true);
    });

    it('should return false when user has none of the roles', () => {
      const user: ValidatedUser = {
        id: 'user-1',
        roles: ['user'],
        permissions: [],
      };

      const result = service.hasAnyRole(user, ['admin', 'manager']);

      expect(result).toBe(false);
    });
  });
});
