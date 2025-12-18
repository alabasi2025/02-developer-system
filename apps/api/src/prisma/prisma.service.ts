import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { softDeleteMiddleware, softDeleteFilterMiddleware } from './soft-delete.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? [
            { level: 'query', emit: 'event' },
            { level: 'info', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ] 
        : [
            { level: 'error', emit: 'stdout' },
          ],
    });

    // Apply soft delete middlewares
    this.$use(softDeleteFilterMiddleware());
    this.$use(softDeleteMiddleware());

    // Log queries in development (JSON format)
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: Prisma.QueryEvent) => {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'debug',
          context: 'Prisma',
          message: 'Query executed',
          data: {
            query: e.query,
            params: e.params,
            duration: `${e.duration}ms`,
          },
        }));
      });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
      
      // Log in JSON format for production
      if (process.env.NODE_ENV === 'production') {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          context: 'Prisma',
          message: 'Database connection established',
        }));
      }
    } catch (error) {
      this.logger.error('Failed to connect to database', error.stack);
      
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        context: 'Prisma',
        message: 'Failed to connect to database',
        error: error.message,
        stack: error.stack,
      }));
      
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Clean database for testing purposes
   * Only available in non-production environments
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    
    // Delete in order to respect foreign key constraints
    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'dev_%'`;

    for (const { tablename } of tablenames) {
      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      } catch (error) {
        this.logger.warn(`Failed to truncate table ${tablename}: ${error.message}`);
      }
    }
  }

  /**
   * Hard delete a record (bypass soft delete)
   * Use with caution - this permanently deletes the record
   */
  async hardDelete<T>(
    model: string,
    where: Prisma.Args<T, 'delete'>['where'],
  ): Promise<void> {
    await (this as any)[model].delete({
      where: {
        ...where,
        deletedAt: undefined, // Bypass soft delete filter
      },
    });
  }

  /**
   * Restore a soft-deleted record
   */
  async restore<T>(
    model: string,
    where: Prisma.Args<T, 'update'>['where'],
  ): Promise<T> {
    return (this as any)[model].update({
      where: {
        ...where,
        deletedAt: { not: null }, // Only restore deleted records
      },
      data: {
        deletedAt: null,
      },
    });
  }

  /**
   * Get database health status
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.$queryRaw`SELECT 1`;
      const latency = Date.now() - startTime;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }
}
