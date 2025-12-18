import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email?: string;
  systemId?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  iat?: number;
  exp?: number;
}

export interface ValidatedUser {
  id: string;
  email?: string;
  systemId?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * تشفير كلمة المرور باستخدام bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * التحقق من كلمة المرور
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * تشفير API Key
   */
  async hashApiKey(apiKey: string): Promise<string> {
    return bcrypt.hash(apiKey, this.SALT_ROUNDS);
  }

  /**
   * التحقق من API Key
   */
  async validateApiKey(apiKey: string): Promise<ValidatedUser | null> {
    try {
      // استخراج البادئة من المفتاح
      const keyPrefix = apiKey.substring(0, 8);
      
      const apiKeyRecord = await this.prisma.devApiKey.findFirst({
        where: {
          keyPrefix,
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      if (!apiKeyRecord) {
        return null;
      }

      // التحقق من صحة المفتاح الكامل
      const isValid = await bcrypt.compare(apiKey, apiKeyRecord.keyHash);
      if (!isValid) {
        return null;
      }

      // تحديث آخر استخدام
      await this.prisma.devApiKey.update({
        where: { id: apiKeyRecord.id },
        data: {
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      });

      // استخراج الصلاحيات
      const permissions = apiKeyRecord.permissions as string[] || [];

      return {
        id: apiKeyRecord.id,
        systemId: apiKeyRecord.systemId,
        roles: ['api_user'],
        permissions,
      };
    } catch (error) {
      this.logger.error('Error validating API key', error);
      return null;
    }
  }

  /**
   * التحقق من JWT Token
   */
  async validateJwtPayload(payload: JwtPayload): Promise<ValidatedUser | null> {
    try {
      // التحقق من صلاحية الـ Token
      if (!payload.sub) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        systemId: payload.systemId,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
        tenantId: payload.tenantId,
      };
    } catch (error) {
      this.logger.error('Error validating JWT payload', error);
      return null;
    }
  }

  /**
   * إنشاء JWT Token للنظام الداخلي
   */
  async generateSystemToken(systemId: string, permissions: string[]): Promise<string> {
    const payload: JwtPayload = {
      sub: systemId,
      systemId,
      roles: ['system'],
      permissions,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * إنشاء API Key جديد
   */
  async generateApiKey(systemId: string, name: string, permissions: string[]): Promise<{ apiKey: string; keyPrefix: string }> {
    // إنشاء مفتاح عشوائي
    const randomPart = this.generateRandomString(32);
    const keyPrefix = this.generateRandomString(8);
    const apiKey = `${keyPrefix}${randomPart}`;

    // تشفير المفتاح
    const keyHash = await this.hashApiKey(apiKey);

    // حفظ في قاعدة البيانات
    await this.prisma.devApiKey.create({
      data: {
        systemId,
        name,
        keyHash,
        keyPrefix,
        permissions: permissions as any,
        isActive: true,
      },
    });

    return { apiKey, keyPrefix };
  }

  /**
   * إلغاء API Key
   */
  async revokeApiKey(keyId: string, revokedBy?: string): Promise<void> {
    await this.prisma.devApiKey.update({
      where: { id: keyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
      },
    });
  }

  /**
   * التحقق من الصلاحية
   */
  hasPermission(user: ValidatedUser, requiredPermission: string): boolean {
    // المسؤولون لديهم جميع الصلاحيات
    if (user.roles.includes('admin') || user.roles.includes('super_admin')) {
      return true;
    }

    // التحقق من الصلاحية المحددة
    return user.permissions.includes(requiredPermission) || user.permissions.includes('*');
  }

  /**
   * التحقق من الدور
   */
  hasRole(user: ValidatedUser, requiredRole: string): boolean {
    return user.roles.includes(requiredRole);
  }

  /**
   * التحقق من أي من الأدوار
   */
  hasAnyRole(user: ValidatedUser, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => user.roles.includes(role));
  }

  /**
   * إنشاء سلسلة عشوائية
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
