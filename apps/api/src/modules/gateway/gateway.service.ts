import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { CacheService } from './services/cache.service';
import { CircuitBreakerService, CircuitState } from './services/circuit-breaker.service';
import {
  ProxyRequestDto,
  ProxyResponseDto,
  RateLimitConfigDto,
  RateLimitStatusDto,
  RequestLogQueryDto,
  SystemType,
} from './dto/gateway.dto';
import axios, { AxiosRequestConfig } from 'axios';

// System configurations
const SYSTEM_CONFIGS: Record<string, { baseUrl: string; name: string; nameAr: string }> = {
  core: { baseUrl: 'http://localhost:3001/api/v1', name: 'Core System', nameAr: 'النظام الأم' },
  assets: { baseUrl: 'http://localhost:3002/api/v1', name: 'Assets System', nameAr: 'نظام الأصول' },
  field: { baseUrl: 'http://localhost:3003/api/v1', name: 'Field Operations', nameAr: 'العمليات الميدانية' },
  scada: { baseUrl: 'http://localhost:3004/api/v1', name: 'SCADA System', nameAr: 'نظام المراقبة' },
  inventory: { baseUrl: 'http://localhost:3005/api/v1', name: 'Inventory System', nameAr: 'نظام المخزون' },
  billing: { baseUrl: 'http://localhost:3006/api/v1', name: 'Billing System', nameAr: 'نظام الفوترة' },
  hr: { baseUrl: 'http://localhost:3007/api/v1', name: 'HR System', nameAr: 'الموارد البشرية' },
  reports: { baseUrl: 'http://localhost:3008/api/v1', name: 'Reports System', nameAr: 'نظام التقارير' },
  projects: { baseUrl: 'http://localhost:3009/api/v1', name: 'Projects System', nameAr: 'نظام المشاريع' },
};

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeysService: ApiKeysService,
    private readonly cacheService: CacheService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  // ==================== Proxy ====================

  async proxy(
    system: string,
    path: string,
    method: string,
    body?: any,
    headers?: Record<string, string>,
    query?: Record<string, any>,
    sourceSystem?: string,
    sourceIp?: string,
    apiKeyId?: string,
    userId?: string,
  ): Promise<ProxyResponseDto> {
    const startTime = Date.now();
    const systemConfig = SYSTEM_CONFIGS[system];

    if (!systemConfig) {
      throw new BadRequestException(`نظام غير معروف: ${system}`);
    }

    const url = `${systemConfig.baseUrl}${path}`;

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute(system)) {
      this.logger.warn(`Circuit breaker open for system: ${system}`);
      return {
        success: false,
        statusCode: 503,
        error: `النظام ${systemConfig.nameAr} غير متاح مؤقتاً`,
        responseTime: 0,
      };
    }

    // Check cache for GET requests
    if (method.toUpperCase() === 'GET' && this.cacheService.isCacheable(method, path)) {
      const cacheKey = this.cacheService.generateCacheKey(system, path, query);
      const cachedResponse = await this.cacheService.get<ProxyResponseDto>(cacheKey);
      
      if (cachedResponse) {
        this.logger.debug(`Cache hit for ${system}${path}`);
        return { ...cachedResponse, fromCache: true };
      }
    }
    
    try {
      const config: AxiosRequestConfig = {
        method: method as any,
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Source-System': sourceSystem || 'developer',
          'X-Request-Id': this.generateRequestId(),
          ...headers,
        },
        params: query,
        data: body,
        timeout: 30000,
        validateStatus: () => true,
      };

      const response = await axios(config);
      const responseTime = Date.now() - startTime;

      // Log the request
      await this.logRequest({
        method,
        path: `/${system}${path}`,
        sourceSystem: sourceSystem || 'developer',
        sourceIp,
        apiKeyId,
        userId,
        statusCode: response.status,
        responseTime,
        requestBody: body,
        responseBody: response.data,
      });

      // Record success in circuit breaker
      if (response.status < 400) {
        this.circuitBreaker.recordSuccess(system);
      } else if (response.status >= 500) {
        this.circuitBreaker.recordFailure(system, `HTTP ${response.status}`);
      }

      const result: ProxyResponseDto = {
        success: response.status < 400,
        statusCode: response.status,
        data: response.data,
        responseTime,
      };

      // Cache successful GET responses
      if (method.toUpperCase() === 'GET' && response.status < 400 && this.cacheService.isCacheable(method, path)) {
        const cacheKey = this.cacheService.generateCacheKey(system, path, query);
        await this.cacheService.set(cacheKey, result);
      }

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Log the failed request
      await this.logRequest({
        method,
        path: `/${system}${path}`,
        sourceSystem: sourceSystem || 'developer',
        sourceIp,
        apiKeyId,
        userId,
        statusCode: 500,
        responseTime,
        requestBody: body,
        errorMessage: error.message,
      });

      // Record failure in circuit breaker
      this.circuitBreaker.recordFailure(system, error.message);

      return {
        success: false,
        statusCode: 500,
        error: error.message,
        responseTime,
      };
    }
  }

  // ==================== Rate Limiting ====================

  async checkRateLimit(
    identifier: string,
    identifierType: string,
    endpoint?: string,
  ): Promise<RateLimitStatusDto> {
    const windowSize = 3600; // 1 hour default
    const windowStart = new Date(Math.floor(Date.now() / (windowSize * 1000)) * windowSize * 1000);

    // Get or create rate limit record
    let rateLimit = await this.prisma.devRateLimit.findFirst({
      where: {
        identifier,
        identifierType,
        endpoint: endpoint || null,
        windowStart,
      },
    });

    if (!rateLimit) {
      // Get max requests from API key or use default
      let maxRequests = 1000;
      if (identifierType === 'api_key') {
        const apiKey = await this.prisma.devApiKey.findFirst({
          where: { keyPrefix: identifier.substring(0, 12) },
        });
        if (apiKey) {
          maxRequests = apiKey.rateLimit;
        }
      }

      rateLimit = await this.prisma.devRateLimit.create({
        data: {
          identifier,
          identifierType,
          endpoint,
          windowStart,
          windowSize,
          maxRequests,
          requestCount: 0,
        },
      });
    }

    const remaining = Math.max(0, rateLimit.maxRequests - rateLimit.requestCount);
    const resetAt = new Date(windowStart.getTime() + windowSize * 1000);

    return {
      identifier,
      remaining,
      limit: rateLimit.maxRequests,
      resetAt,
      exceeded: remaining === 0,
    };
  }

  async incrementRateLimit(
    identifier: string,
    identifierType: string,
    endpoint?: string,
  ): Promise<void> {
    const windowSize = 3600;
    const windowStart = new Date(Math.floor(Date.now() / (windowSize * 1000)) * windowSize * 1000);

    await this.prisma.devRateLimit.updateMany({
      where: {
        identifier,
        identifierType,
        endpoint: endpoint || null,
        windowStart,
      },
      data: {
        requestCount: { increment: 1 },
      },
    });
  }

  async configureRateLimit(config: RateLimitConfigDto): Promise<void> {
    const windowStart = new Date(Math.floor(Date.now() / (config.windowSize * 1000)) * config.windowSize * 1000);

    await this.prisma.devRateLimit.upsert({
      where: {
        identifier_identifierType_endpoint_windowStart: {
          identifier: config.identifier,
          identifierType: config.identifierType,
          endpoint: config.endpoint || '',
          windowStart,
        },
      },
      create: {
        identifier: config.identifier,
        identifierType: config.identifierType,
        endpoint: config.endpoint,
        windowStart,
        windowSize: config.windowSize,
        maxRequests: config.maxRequests,
        requestCount: 0,
      },
      update: {
        windowSize: config.windowSize,
        maxRequests: config.maxRequests,
      },
    });
  }

  // ==================== Request Logging ====================

  private async logRequest(data: {
    method: string;
    path: string;
    sourceSystem: string;
    sourceIp?: string;
    apiKeyId?: string;
    userId?: string;
    statusCode: number;
    responseTime: number;
    requestBody?: any;
    responseBody?: any;
    errorMessage?: string;
  }) {
    try {
      await this.prisma.devRequestLog.create({
        data: {
          method: data.method,
          path: data.path,
          sourceSystem: data.sourceSystem,
          sourceIp: data.sourceIp,
          apiKeyId: data.apiKeyId,
          userId: data.userId,
          statusCode: data.statusCode,
          responseTime: data.responseTime,
          requestBody: data.requestBody,
          responseBody: data.responseBody,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log request: ${error}`);
    }
  }

  async getRequestLogs(query: RequestLogQueryDto) {
    const { sourceSystem, path, statusCode, fromDate, toDate, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (sourceSystem) where.sourceSystem = sourceSystem;
    if (path) where.path = { contains: path };
    if (statusCode) where.statusCode = statusCode;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.devRequestLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          method: true,
          path: true,
          sourceSystem: true,
          sourceIp: true,
          statusCode: true,
          responseTime: true,
          createdAt: true,
        },
      }),
      this.prisma.devRequestLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== System Health ====================

  async checkAllSystemsHealth() {
    const results = [];

    for (const [systemId, config] of Object.entries(SYSTEM_CONFIGS)) {
      const health = await this.checkSystemHealth(systemId);
      results.push(health);
    }

    return results;
  }

  async checkSystemHealth(systemId: string) {
    const config = SYSTEM_CONFIGS[systemId];
    
    if (!config) {
      return {
        systemId,
        name: 'Unknown',
        status: 'error',
        error: 'نظام غير معروف',
      };
    }

    const startTime = Date.now();

    try {
      const response = await axios.get(`${config.baseUrl}/health`, {
        timeout: 5000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;

      // Save health check result
      await this.prisma.devSystemHealth.create({
        data: {
          systemId,
          status: response.status < 400 ? 'healthy' : 'unhealthy',
          responseTime,
          checkedAt: new Date(),
          details: response.data,
        },
      });

      return {
        systemId,
        name: config.name,
        nameAr: config.nameAr,
        status: response.status < 400 ? 'healthy' : 'unhealthy',
        responseTime,
        lastCheck: new Date(),
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      await this.prisma.devSystemHealth.create({
        data: {
          systemId,
          status: 'error',
          responseTime,
          checkedAt: new Date(),
          details: { error: error.message },
        },
      });

      return {
        systemId,
        name: config.name,
        nameAr: config.nameAr,
        status: 'error',
        responseTime,
        lastCheck: new Date(),
        error: error.message,
      };
    }
  }

  // ==================== Helpers ====================

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  getSystemConfig(systemId: string) {
    return SYSTEM_CONFIGS[systemId];
  }

  getAllSystemConfigs() {
    return Object.entries(SYSTEM_CONFIGS).map(([id, config]) => ({
      id,
      ...config,
    }));
  }
}
