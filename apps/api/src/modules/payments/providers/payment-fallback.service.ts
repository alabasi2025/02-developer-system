import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface FallbackConfig {
  primaryGatewayId: string;
  fallbackGatewayIds: string[];
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface FallbackResult {
  success: boolean;
  gatewayId: string;
  gatewayName: string;
  attemptNumber: number;
  totalAttempts: number;
  result?: any;
  errors: { gatewayId: string; error: string }[];
}

@Injectable()
export class PaymentFallbackService {
  private readonly logger = new Logger(PaymentFallbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * تنفيذ الدفع مع دعم Fallback
   */
  async executeWithFallback(
    config: FallbackConfig,
    paymentFn: (gatewayId: string) => Promise<any>,
  ): Promise<FallbackResult> {
    const allGateways = [config.primaryGatewayId, ...config.fallbackGatewayIds];
    const errors: { gatewayId: string; error: string }[] = [];
    let attemptNumber = 0;

    for (const gatewayId of allGateways) {
      attemptNumber++;

      // Check if gateway is active and healthy
      const gateway = await this.prisma.devPaymentGateway.findUnique({
        where: { id: gatewayId },
      });

      if (!gateway || !gateway.isActive) {
        this.logger.warn(`Gateway ${gatewayId} is not active, skipping`);
        errors.push({ gatewayId, error: 'Gateway not active' });
        continue;
      }

      // Check gateway health
      const isHealthy = await this.checkGatewayHealth(gatewayId);
      if (!isHealthy) {
        this.logger.warn(`Gateway ${gatewayId} is unhealthy, skipping`);
        errors.push({ gatewayId, error: 'Gateway unhealthy' });
        continue;
      }

      try {
        this.logger.log(`Attempting payment with gateway: ${gateway.name} (attempt ${attemptNumber})`);
        
        const result = await this.retryWithBackoff(
          () => paymentFn(gatewayId),
          config.maxRetries,
          config.retryDelay,
        );

        // Log successful attempt
        await this.logFallbackAttempt(gatewayId, true, attemptNumber, null);

        return {
          success: true,
          gatewayId,
          gatewayName: gateway.name,
          attemptNumber,
          totalAttempts: allGateways.length,
          result,
          errors,
        };
      } catch (error: any) {
        this.logger.error(`Payment failed with gateway ${gateway.name}: ${error.message}`);
        errors.push({ gatewayId, error: error.message });

        // Log failed attempt
        await this.logFallbackAttempt(gatewayId, false, attemptNumber, error.message);

        // Mark gateway as potentially unhealthy
        await this.recordGatewayFailure(gatewayId);
      }
    }

    // All gateways failed
    return {
      success: false,
      gatewayId: config.primaryGatewayId,
      gatewayName: 'None',
      attemptNumber,
      totalAttempts: allGateways.length,
      errors,
    };
  }

  /**
   * إعادة المحاولة مع تأخير متزايد
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          this.logger.debug(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * التحقق من صحة البوابة
   */
  private async checkGatewayHealth(gatewayId: string): Promise<boolean> {
    // Check recent failure rate
    const recentFailures = await this.prisma.devPaymentTransaction.count({
      where: {
        gatewayId,
        status: 'failed',
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    const recentTotal = await this.prisma.devPaymentTransaction.count({
      where: {
        gatewayId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
    });

    // If more than 50% failure rate, consider unhealthy
    if (recentTotal > 5 && recentFailures / recentTotal > 0.5) {
      return false;
    }

    return true;
  }

  /**
   * تسجيل فشل البوابة
   */
  private async recordGatewayFailure(gatewayId: string): Promise<void> {
    try {
      // Update gateway health status
      await this.prisma.devPaymentGateway.update({
        where: { id: gatewayId },
        data: {
          config: {
            lastFailure: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record gateway failure: ${error}`);
    }
  }

  /**
   * تسجيل محاولة Fallback
   */
  private async logFallbackAttempt(
    gatewayId: string,
    success: boolean,
    attemptNumber: number,
    errorMessage: string | null,
  ): Promise<void> {
    try {
      await this.prisma.devAuditLog.create({
        data: {
          action: 'payment_fallback',
          entityType: 'payment_gateway',
          entityId: gatewayId,
          newValues: {
            success,
            attemptNumber,
            errorMessage,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log fallback attempt: ${error}`);
    }
  }

  /**
   * الحصول على ترتيب البوابات حسب الأداء
   */
  async getGatewaysByPerformance(): Promise<{ gatewayId: string; successRate: number; avgResponseTime: number }[]> {
    const gateways = await this.prisma.devPaymentGateway.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const results = await Promise.all(
      gateways.map(async (gateway) => {
        const stats = await this.getGatewayStats(gateway.id);
        return {
          gatewayId: gateway.id,
          successRate: stats.successRate,
          avgResponseTime: stats.avgResponseTime,
        };
      }),
    );

    // Sort by success rate (descending), then by response time (ascending)
    return results.sort((a, b) => {
      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate;
      }
      return a.avgResponseTime - b.avgResponseTime;
    });
  }

  /**
   * الحصول على إحصائيات البوابة
   */
  private async getGatewayStats(gatewayId: string): Promise<{ successRate: number; avgResponseTime: number }> {
    const transactions = await this.prisma.devPaymentTransaction.findMany({
      where: {
        gatewayId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      select: {
        status: true,
        createdAt: true,
        processedAt: true,
      },
    });

    if (transactions.length === 0) {
      return { successRate: 1, avgResponseTime: 0 };
    }

    const successful = transactions.filter(t => t.status === 'completed').length;
    const successRate = successful / transactions.length;

    const responseTimes = transactions
      .filter(t => t.processedAt)
      .map(t => t.processedAt!.getTime() - t.createdAt.getTime());

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return { successRate, avgResponseTime };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
