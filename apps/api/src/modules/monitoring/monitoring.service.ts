import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  // ==================== Health Check ====================

  async getHealth() {
    const dbHealth = await this.checkDatabaseHealth();
    
    return {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: dbHealth,
        api: { status: 'healthy' },
      },
    };
  }

  private async checkDatabaseHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy' };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // ==================== Metrics ====================

  async getMetrics() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get request stats
    const [
      totalRequests24h,
      totalRequestsHour,
      errorRequests24h,
      avgResponseTime,
      requestsBySystem,
      requestsByStatus,
      eventsStats,
      activeIntegrations,
      activeApiKeys,
    ] = await Promise.all([
      this.prisma.devRequestLog.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      this.prisma.devRequestLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      this.prisma.devRequestLog.count({
        where: { createdAt: { gte: oneDayAgo }, statusCode: { gte: 400 } },
      }),
      this.prisma.devRequestLog.aggregate({
        where: { createdAt: { gte: oneDayAgo } },
        _avg: { responseTime: true },
      }),
      this.prisma.devRequestLog.groupBy({
        by: ['sourceSystem'],
        where: { createdAt: { gte: oneDayAgo } },
        _count: true,
      }),
      this.prisma.devRequestLog.groupBy({
        by: ['statusCode'],
        where: { createdAt: { gte: oneDayAgo } },
        _count: true,
      }),
      this.getEventsStats(oneDayAgo),
      this.prisma.devIntegration.count({ where: { status: 'active' } }),
      this.prisma.devApiKey.count({ where: { isActive: true } }),
    ]);

    const errorRate = totalRequests24h > 0 
      ? ((errorRequests24h / totalRequests24h) * 100).toFixed(2) 
      : '0.00';

    return {
      timestamp: now.toISOString(),
      requests: {
        last24Hours: totalRequests24h,
        lastHour: totalRequestsHour,
        errors24Hours: errorRequests24h,
        errorRate: `${errorRate}%`,
        avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
        bySystem: requestsBySystem.map(r => ({
          system: r.sourceSystem,
          count: r._count,
        })),
        byStatus: requestsByStatus.map(r => ({
          status: r.statusCode,
          count: r._count,
        })),
      },
      events: eventsStats,
      integrations: {
        active: activeIntegrations,
      },
      apiKeys: {
        active: activeApiKeys,
      },
      system: {
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        memory: process.memoryUsage(),
      },
    };
  }

  private async getEventsStats(since: Date) {
    const [total, pending, completed, failed] = await Promise.all([
      this.prisma.devEvent.count({ where: { createdAt: { gte: since } } }),
      this.prisma.devEvent.count({ where: { createdAt: { gte: since }, status: 'pending' } }),
      this.prisma.devEvent.count({ where: { createdAt: { gte: since }, status: 'completed' } }),
      this.prisma.devEvent.count({ where: { createdAt: { gte: since }, status: 'failed' } }),
    ]);

    return { total, pending, completed, failed };
  }

  // ==================== Logs ====================

  async getLogs(query: {
    level?: string;
    source?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { level, source, fromDate, toDate, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    // For now, return audit logs as system logs
    const where: any = {};
    if (source) where.systemId = source;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.devAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.devAuditLog.count({ where }),
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

  // ==================== Alerts ====================

  async getAlerts(query: {
    status?: string;
    severity?: number;
    source?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, severity, source, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (source) where.source = source;

    const [alerts, total] = await Promise.all([
      this.prisma.devAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.devAlert.count({ where }),
    ]);

    return {
      data: alerts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createAlert(data: {
    alertType: string;
    source: string;
    title: string;
    message: string;
    severity?: number;
    metadata?: any;
  }) {
    return this.prisma.devAlert.create({
      data: {
        alertType: data.alertType,
        source: data.source,
        title: data.title,
        message: data.message,
        severity: data.severity || 3,
        metadata: data.metadata || {},
      },
    });
  }

  async acknowledgeAlert(id: string, userId: string) {
    const alert = await this.prisma.devAlert.findUnique({ where: { id } });
    
    if (!alert) {
      throw new NotFoundException(`التنبيه غير موجود: ${id}`);
    }

    return this.prisma.devAlert.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
      },
    });
  }

  async resolveAlert(id: string, userId: string, resolution: string) {
    const alert = await this.prisma.devAlert.findUnique({ where: { id } });
    
    if (!alert) {
      throw new NotFoundException(`التنبيه غير موجود: ${id}`);
    }

    return this.prisma.devAlert.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolution,
      },
    });
  }

  // ==================== System Metrics Recording ====================

  async recordMetric(data: {
    metricName: string;
    metricType: string;
    value: number;
    labels?: any;
    systemId?: string;
  }) {
    return this.prisma.devSystemMetric.create({
      data: {
        metricName: data.metricName,
        metricType: data.metricType,
        value: data.value,
        labels: data.labels || {},
        systemId: data.systemId,
      },
    });
  }

  async getMetricHistory(metricName: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.prisma.devSystemMetric.findMany({
      where: {
        metricName,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
    });
  }
}
