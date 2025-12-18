import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios, { AxiosRequestConfig } from 'axios';

export enum InternalSystem {
  CORE = 'core',
  ASSETS = 'assets',
  CUSTOMERS = 'customers',
  BILLING = 'billing',
  METERS = 'meters',
  SUPPORT = 'support',
  REPORTS = 'reports',
  EMPLOYEES = 'employees',
  MOBILE = 'mobile',
  // الأنظمة المضافة حديثاً
  FIELD = 'field',           // العمليات الميدانية
  MAINTENANCE = 'maintenance', // الصيانة
  SCADA = 'scada',           // المراقبة والتحكم
  INVENTORY = 'inventory',   // المخزون
  HR = 'hr',                 // الموارد البشرية
  FINANCE = 'finance',       // المالية
}

const SYSTEM_ENDPOINTS: Record<InternalSystem, string> = {
  [InternalSystem.CORE]: process.env.CORE_API_URL || 'http://localhost:3001/api/v1',
  [InternalSystem.ASSETS]: process.env.ASSETS_API_URL || 'http://localhost:3003/api/v1',
  [InternalSystem.CUSTOMERS]: process.env.CUSTOMERS_API_URL || 'http://localhost:3004/api/v1',
  [InternalSystem.BILLING]: process.env.BILLING_API_URL || 'http://localhost:3005/api/v1',
  [InternalSystem.METERS]: process.env.METERS_API_URL || 'http://localhost:3006/api/v1',
  [InternalSystem.SUPPORT]: process.env.SUPPORT_API_URL || 'http://localhost:3007/api/v1',
  [InternalSystem.REPORTS]: process.env.REPORTS_API_URL || 'http://localhost:3008/api/v1',
  [InternalSystem.EMPLOYEES]: process.env.EMPLOYEES_API_URL || 'http://localhost:3009/api/v1',
  [InternalSystem.MOBILE]: process.env.MOBILE_API_URL || 'http://localhost:3010/api/v1',
  // الأنظمة المضافة حديثاً
  [InternalSystem.FIELD]: process.env.FIELD_API_URL || 'http://localhost:3011/api/v1',
  [InternalSystem.MAINTENANCE]: process.env.MAINTENANCE_API_URL || 'http://localhost:3012/api/v1',
  [InternalSystem.SCADA]: process.env.SCADA_API_URL || 'http://localhost:3013/api/v1',
  [InternalSystem.INVENTORY]: process.env.INVENTORY_API_URL || 'http://localhost:3014/api/v1',
  [InternalSystem.HR]: process.env.HR_API_URL || 'http://localhost:3015/api/v1',
  [InternalSystem.FINANCE]: process.env.FINANCE_API_URL || 'http://localhost:3016/api/v1',
};

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  duration: number;
}

@Injectable()
export class InternalApiService {
  private readonly logger = new Logger(InternalApiService.name);

  constructor(private prisma: PrismaService) {}

  async get<T = any>(system: InternalSystem, path: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    return this.request<T>('GET', system, path, undefined, options);
  }

  async post<T = any>(system: InternalSystem, path: string, data?: any, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    return this.request<T>('POST', system, path, data, options);
  }

  async put<T = any>(system: InternalSystem, path: string, data?: any, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', system, path, data, options);
  }

  async delete<T = any>(system: InternalSystem, path: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', system, path, undefined, options);
  }

  async patch<T = any>(system: InternalSystem, path: string, data?: any, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', system, path, data, options);
  }

  private async request<T = any>(method: string, system: InternalSystem, path: string, data?: any, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const baseUrl = SYSTEM_ENDPOINTS[system];
    const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
    const timeoutMs = options?.timeout || 30000;

    try {
      const apiKey = await this.getSystemApiKey(system);
      const config: AxiosRequestConfig = {
        method: method as any,
        url,
        data,
        headers: {
          'Content-Type': 'application/json',
          'X-Source-System': 'developer',
          'X-Request-Id': this.generateRequestId(),
          ...(apiKey && { 'X-API-Key': apiKey }),
          ...options?.headers,
        },
        timeout: timeoutMs,
        validateStatus: () => true,
      };

      const response = await axios(config);
      const duration = Date.now() - startTime;
      await this.logRequest(system, method, path, response.status, duration, response.status < 400 ? 'success' : 'failed');

      return { success: response.status < 400, data: response.data, statusCode: response.status, duration };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message;
      await this.logRequest(system, method, path, 500, duration, 'failed', errorMessage);
      this.logger.error(`Request to ${system}${path} failed: ${errorMessage}`);
      return { success: false, error: errorMessage, statusCode: 500, duration };
    }
  }

  private async getSystemApiKey(system: InternalSystem): Promise<string | null> {
    try {
      const apiKey = await this.prisma.devApiKey.findFirst({
        where: { systemId: system, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { keyPrefix: true },
      });
      return apiKey?.keyPrefix || null;
    } catch { return null; }
  }

  private async logRequest(system: InternalSystem, method: string, path: string, statusCode: number, duration: number, status: string, errorMessage?: string): Promise<void> {
    try {
      const integrationId = await this.getIntegrationId(system);
      if (integrationId) {
        await this.prisma.devIntegrationLog.create({
          data: { integrationId, direction: 'outgoing', method, endpoint: path, responseStatus: statusCode, durationMs: duration, status, errorMessage },
        });
      }
    } catch (error) { this.logger.warn('Failed to log request', error); }
  }

  private async getIntegrationId(system: InternalSystem): Promise<string | undefined> {
    try {
      const integration = await this.prisma.devIntegration.findFirst({ where: { name: system, type: 'internal' }, select: { id: true } });
      return integration?.id;
    } catch { return undefined; }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async checkSystemHealth(system: InternalSystem): Promise<{ system: string; status: 'healthy' | 'unhealthy' | 'unknown'; responseTime?: number; error?: string }> {
    const response = await this.get(system, '/health', { timeout: 5000 });
    return { system, status: response.success ? 'healthy' : 'unhealthy', responseTime: response.duration, error: response.error };
  }

  async checkAllSystemsHealth(): Promise<{ system: string; status: 'healthy' | 'unhealthy' | 'unknown'; responseTime?: number; error?: string }[]> {
    const systems = Object.values(InternalSystem);
    return Promise.all(systems.map((system) => this.checkSystemHealth(system)));
  }

  getAvailableSystems(): { id: string; name: string; endpoint: string }[] {
    return Object.entries(SYSTEM_ENDPOINTS).map(([id, endpoint]) => ({
      id, name: this.getSystemName(id as InternalSystem), endpoint,
    }));
  }

  private getSystemName(system: InternalSystem): string {
    const names: Record<InternalSystem, string> = {
      [InternalSystem.CORE]: 'النظام الأم',
      [InternalSystem.ASSETS]: 'نظام الأصول',
      [InternalSystem.CUSTOMERS]: 'نظام العملاء',
      [InternalSystem.BILLING]: 'نظام الفوترة',
      [InternalSystem.METERS]: 'نظام العدادات',
      [InternalSystem.SUPPORT]: 'نظام الدعم',
      [InternalSystem.REPORTS]: 'نظام التقارير',
      [InternalSystem.EMPLOYEES]: 'نظام الموظفين',
      [InternalSystem.MOBILE]: 'تطبيق الجوال',
      // الأنظمة المضافة حديثاً
      [InternalSystem.FIELD]: 'العمليات الميدانية',
      [InternalSystem.MAINTENANCE]: 'نظام الصيانة',
      [InternalSystem.SCADA]: 'المراقبة والتحكم',
      [InternalSystem.INVENTORY]: 'نظام المخزون',
      [InternalSystem.HR]: 'الموارد البشرية',
      [InternalSystem.FINANCE]: 'النظام المالي',
    };
    return names[system] || system;
  }
}
