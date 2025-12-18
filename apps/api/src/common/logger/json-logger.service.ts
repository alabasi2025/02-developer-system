import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

interface LogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
  data?: any;
  trace?: string;
  requestId?: string;
  userId?: string;
  duration?: number;
}

@Injectable()
export class JsonLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    this.writeLog('info', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeLog('error', message, context, { trace });
  }

  warn(message: any, context?: string) {
    this.writeLog('warn', message, context);
  }

  debug(message: any, context?: string) {
    this.writeLog('debug', message, context);
  }

  verbose(message: any, context?: string) {
    this.writeLog('verbose', message, context);
  }

  fatal(message: any, context?: string) {
    this.writeLog('fatal', message, context);
  }

  private writeLog(level: string, message: any, context?: string, extra?: { trace?: string }) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context || this.context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };

    if (extra?.trace) {
      logEntry.trace = extra.trace;
    }

    // Extract additional data if message is an object
    if (typeof message === 'object' && message !== null) {
      const { message: msg, ...data } = message;
      if (msg) {
        logEntry.message = msg;
        logEntry.data = data;
      } else {
        logEntry.data = message;
      }
    }

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log with request context
   */
  logRequest(data: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    userId?: string;
    requestId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: data.statusCode >= 400 ? 'error' : 'info',
      context: 'HTTP',
      message: `${data.method} ${data.path} ${data.statusCode}`,
      data: {
        method: data.method,
        path: data.path,
        statusCode: data.statusCode,
        ip: data.ip,
        userAgent: data.userAgent,
      },
      requestId: data.requestId,
      userId: data.userId,
      duration: data.duration,
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log audit event
   */
  logAudit(data: {
    action: string;
    entityType: string;
    entityId?: string;
    userId?: string;
    oldValue?: any;
    newValue?: any;
    metadata?: any;
  }) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      context: 'AUDIT',
      message: `${data.action} on ${data.entityType}`,
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValue: data.oldValue,
        newValue: data.newValue,
        metadata: data.metadata,
      },
      userId: data.userId,
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log security event
   */
  logSecurity(data: {
    event: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    userId?: string;
    ip?: string;
    details?: any;
  }) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: data.severity === 'critical' || data.severity === 'high' ? 'error' : 'warn',
      context: 'SECURITY',
      message: data.event,
      data: {
        severity: data.severity,
        ip: data.ip,
        details: data.details,
      },
      userId: data.userId,
    };

    console.log(JSON.stringify(logEntry));
  }
}
