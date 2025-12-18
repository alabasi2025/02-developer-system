import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios, { AxiosRequestConfig } from 'axios';
import * as crypto from 'crypto';

export enum ExternalIntegrationType {
  PAYMENT = 'payment',
  SMS = 'sms',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  IOT = 'iot',
  GOVERNMENT = 'government',
  MAPS = 'maps',
  ANALYTICS = 'analytics',
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
  duration: number;
  requestId: string;
}

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);

  constructor(private prisma: PrismaService) {}

  async request<T = any>(integrationId: string, method: string, path: string, data?: any, options?: { headers?: Record<string, string>; timeout?: number }): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const integration = await this.getIntegration(integrationId);
      if (!integration) throw new HttpException('التكامل غير موجود', HttpStatus.NOT_FOUND);
      if (integration.status !== 'active') throw new HttpException('التكامل غير نشط', HttpStatus.BAD_REQUEST);

      const credentials = integration.credentials as Record<string, string> || {};
      const url = `${integration.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
      const timeoutMs = options?.timeout || integration.timeout || 30000;

      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Request-Id': requestId, ...options?.headers };
      this.addAuthentication(headers, integration.type, credentials);

      const config: AxiosRequestConfig = { method: method as any, url, data, headers, timeout: timeoutMs, validateStatus: () => true };
      const response = await axios(config);
      const duration = Date.now() - startTime;

      await this.logRequest(integrationId, requestId, method, path, headers, data, response.status, response.data, duration, response.status < 400 ? 'success' : 'failed');
      await this.updateHealthStatus(integrationId, response.status < 400 ? 'healthy' : 'error');

      return { success: response.status < 400, data: response.data, statusCode: response.status, duration, requestId };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message;
      await this.logRequest(integrationId, requestId, method, path, {}, data, 500, null, duration, 'failed', errorMessage);
      await this.updateHealthStatus(integrationId, 'error');
      this.logger.error(`External API request failed: ${errorMessage}`);
      return { success: false, error: errorMessage, statusCode: 500, duration, requestId };
    }
  }

  private addAuthentication(headers: Record<string, string>, type: string, credentials: Record<string, string>): void {
    if (credentials.apiKey) headers['Authorization'] = `Bearer ${credentials.apiKey}`;
    if (credentials.basicAuth) {
      const [username, password] = credentials.basicAuth.split(':');
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    if (credentials.customHeader && credentials.customValue) headers[credentials.customHeader] = credentials.customValue;
  }

  private async getIntegration(integrationId: string) {
    return this.prisma.devIntegration.findUnique({ where: { id: integrationId } });
  }

  private async logRequest(integrationId: string, requestId: string, method: string, endpoint: string, requestHeaders: Record<string, string>, requestBody: any, responseStatus: number, responseBody: any, durationMs: number, status: string, errorMessage?: string): Promise<void> {
    try {
      await this.prisma.devIntegrationLog.create({
        data: { integrationId, requestId, direction: 'outgoing', method, endpoint, requestHeaders, requestBody, responseStatus, responseBody, durationMs, status, errorMessage },
      });
    } catch (error) { this.logger.warn('Failed to log request', error); }
  }

  private async updateHealthStatus(integrationId: string, status: string): Promise<void> {
    try {
      await this.prisma.devIntegration.update({ where: { id: integrationId }, data: { lastHealthCheck: new Date(), lastHealthStatus: status } });
    } catch (error) { this.logger.warn('Failed to update health status', error); }
  }

  private generateRequestId(): string {
    return `ext_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async createIntegration(data: { name: string; nameAr?: string; type: ExternalIntegrationType; baseUrl: string; config?: Record<string, any>; credentials?: Record<string, any>; healthEndpoint?: string; timeout?: number; retryCount?: number; description?: string }) {
    return this.prisma.devIntegration.create({
      data: { name: data.name, nameAr: data.nameAr, type: data.type, baseUrl: data.baseUrl, config: data.config || {}, credentials: data.credentials || {}, healthEndpoint: data.healthEndpoint, timeout: data.timeout || 30000, retryCount: data.retryCount || 3, description: data.description, status: 'active' },
    });
  }

  async getExternalIntegrations(type?: ExternalIntegrationType) {
    return this.prisma.devIntegration.findMany({ where: { type: type ? type : { not: 'internal' } }, orderBy: { createdAt: 'desc' } });
  }

  async checkIntegrationHealth(integrationId: string): Promise<{ status: 'healthy' | 'unhealthy' | 'unknown'; responseTime?: number; error?: string }> {
    const integration = await this.getIntegration(integrationId);
    if (!integration) return { status: 'unknown', error: 'التكامل غير موجود' };
    if (!integration.healthEndpoint) return { status: 'unknown', error: 'لا يوجد endpoint للفحص' };
    const response = await this.request(integrationId, 'GET', integration.healthEndpoint, undefined, { timeout: 5000 });
    return { status: response.success ? 'healthy' : 'unhealthy', responseTime: response.duration, error: response.error };
  }

  async checkAllIntegrationsHealth() {
    const integrations = await this.getExternalIntegrations();
    return Promise.all(integrations.map(async (integration) => ({ id: integration.id, name: integration.name, type: integration.type, ...(await this.checkIntegrationHealth(integration.id)) })));
  }

  async updateIntegration(integrationId: string, data: Partial<{ name: string; nameAr: string; baseUrl: string; config: Record<string, any>; credentials: Record<string, any>; healthEndpoint: string; timeout: number; retryCount: number; description: string; status: string }>) {
    return this.prisma.devIntegration.update({ where: { id: integrationId }, data });
  }

  async deleteIntegration(integrationId: string) {
    return this.prisma.devIntegration.delete({ where: { id: integrationId } });
  }

  async getIntegrationLogs(integrationId: string, options?: { limit?: number; offset?: number; status?: string }) {
    return this.prisma.devIntegrationLog.findMany({
      where: { integrationId, ...(options?.status && { status: options.status }) },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }
}
