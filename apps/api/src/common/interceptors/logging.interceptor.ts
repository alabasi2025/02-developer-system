import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  requestId: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  ip?: string;
  userAgent?: string;
  error?: string;
  stack?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const startTime = Date.now();
    
    // Add request ID to request and response
    request['requestId'] = requestId;
    response.setHeader('X-Request-ID', requestId);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logRequest(request, response.statusCode, duration, requestId);
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logError(request, error, duration, requestId);
        throw error;
      }),
    );
  }

  private logRequest(
    request: Request,
    statusCode: number,
    duration: number,
    requestId: string,
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 400 ? 'error' : 'info',
      context: 'HTTP',
      requestId,
      method: request.method,
      path: request.url,
      statusCode,
      duration,
      userId: (request as any).user?.id,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
    };

    console.log(JSON.stringify(logEntry));
  }

  private logError(
    request: Request,
    error: any,
    duration: number,
    requestId: string,
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      context: 'HTTP',
      requestId,
      method: request.method,
      path: request.url,
      statusCode: error.status || 500,
      duration,
      userId: (request as any).user?.id,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      error: error.message,
      stack: error.stack,
    };

    console.log(JSON.stringify(logEntry));
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    }
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
