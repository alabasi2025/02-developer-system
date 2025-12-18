import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditLogEntry {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  systemId?: string;
  metadata?: any;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Skip GET requests (read operations)
    if (request.method === 'GET') {
      return next.handle();
    }

    const entityType = this.getEntityType(controller.name);
    const action = this.getAction(request.method, handler.name);

    return next.handle().pipe(
      tap(async (response) => {
        try {
          await this.createAuditLog({
            action,
            entityType,
            entityId: this.extractEntityId(request, response),
            userId: (request as any).user?.id,
            userName: (request as any).user?.name || (request as any).user?.email,
            newValues: this.sanitizeData(request.body),
            ipAddress: this.getClientIp(request),
            userAgent: request.headers['user-agent'],
            systemId: (request as any).user?.systemId,
            metadata: {
              path: request.url,
              method: request.method,
            },
          });
        } catch (error) {
          // Log error but don't fail the request
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            context: 'AUDIT',
            message: 'Failed to create audit log',
            error: error.message,
          }));
        }
      }),
    );
  }

  private async createAuditLog(entry: AuditLogEntry): Promise<void> {
    await this.prisma.devAuditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
        userName: entry.userName,
        oldValues: entry.oldValues as any,
        newValues: entry.newValues as any,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        systemId: entry.systemId,
        metadata: entry.metadata as any,
      },
    });

    // Also log to console in JSON format
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      context: 'AUDIT',
      message: `${entry.action} on ${entry.entityType}`,
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId,
      },
    }));
  }

  private getEntityType(controllerName: string): string {
    // Remove 'Controller' suffix and convert to snake_case
    return controllerName
      .replace('Controller', '')
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  private getAction(method: string, handlerName: string): string {
    const methodActions: Record<string, string> = {
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };

    // Check for specific handler names
    if (handlerName.includes('acknowledge')) return 'acknowledge';
    if (handlerName.includes('resolve')) return 'resolve';
    if (handlerName.includes('revoke')) return 'revoke';
    if (handlerName.includes('activate')) return 'activate';
    if (handlerName.includes('deactivate')) return 'deactivate';

    return methodActions[method] || 'unknown';
  }

  private extractEntityId(request: Request, response: any): string | undefined {
    // Try to get from params
    if (request.params.id) {
      return request.params.id;
    }

    // Try to get from response
    if (response?.id) {
      return response.id;
    }

    return undefined;
  }

  private sanitizeData(data: any): any {
    if (!data) return null;

    const sensitiveFields = [
      'password',
      'secret',
      'apiKey',
      'token',
      'credentials',
      'keyHash',
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
