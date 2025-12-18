import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export enum CircuitState {
  CLOSED = 'closed',     // النظام يعمل بشكل طبيعي
  OPEN = 'open',         // النظام معطل - رفض الطلبات
  HALF_OPEN = 'half_open', // اختبار إذا كان النظام تعافى
}

interface CircuitConfig {
  failureThreshold: number;     // عدد الفشل قبل فتح الدائرة
  successThreshold: number;     // عدد النجاح لإغلاق الدائرة
  timeout: number;              // وقت الانتظار قبل المحاولة (ms)
  monitoringWindow: number;     // نافذة المراقبة (ms)
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  state: CircuitState;
  stateChangedAt: Date;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitStats>();
  
  private readonly defaultConfig: CircuitConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000, // 30 seconds
    monitoringWindow: 60000, // 1 minute
  };

  constructor(private readonly prisma: PrismaService) {
    // Start monitoring interval
    setInterval(() => this.monitorCircuits(), 10000); // Check every 10 seconds
  }

  /**
   * التحقق مما إذا كان يمكن تنفيذ الطلب
   */
  canExecute(systemId: string): boolean {
    const circuit = this.getOrCreateCircuit(systemId);
    
    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN: {
        // Check if timeout has passed
        const timeSinceOpen = Date.now() - circuit.stateChangedAt.getTime();
        if (timeSinceOpen >= this.defaultConfig.timeout) {
          this.transitionTo(systemId, CircuitState.HALF_OPEN);
          return true;
        }
        return false;
      }
      
      case CircuitState.HALF_OPEN:
        return true;
      
      default:
        return true;
    }
  }

  /**
   * تسجيل نجاح الطلب
   */
  recordSuccess(systemId: string): void {
    const circuit = this.getOrCreateCircuit(systemId);
    circuit.successes++;
    circuit.lastSuccess = new Date();

    // Reset failures on success
    circuit.failures = 0;

    // If in half-open state, check if we can close
    if (circuit.state === CircuitState.HALF_OPEN) {
      if (circuit.successes >= this.defaultConfig.successThreshold) {
        this.transitionTo(systemId, CircuitState.CLOSED);
      }
    }

    this.logger.debug(`Circuit ${systemId}: Success recorded, state: ${circuit.state}`);
  }

  /**
   * تسجيل فشل الطلب
   */
  recordFailure(systemId: string, error?: string): void {
    const circuit = this.getOrCreateCircuit(systemId);
    circuit.failures++;
    circuit.lastFailure = new Date();

    // If in half-open state, go back to open
    if (circuit.state === CircuitState.HALF_OPEN) {
      this.transitionTo(systemId, CircuitState.OPEN);
      return;
    }

    // Check if we should open the circuit
    if (circuit.state === CircuitState.CLOSED) {
      if (circuit.failures >= this.defaultConfig.failureThreshold) {
        this.transitionTo(systemId, CircuitState.OPEN);
        this.logger.warn(`Circuit ${systemId}: Opened due to ${circuit.failures} failures`);
        
        // Log to database
        this.logCircuitEvent(systemId, 'opened', error);
      }
    }
  }

  /**
   * الحصول على حالة الدائرة
   */
  getState(systemId: string): CircuitState {
    const circuit = this.circuits.get(systemId);
    return circuit?.state || CircuitState.CLOSED;
  }

  /**
   * الحصول على إحصائيات الدائرة
   */
  getStats(systemId: string): CircuitStats | null {
    return this.circuits.get(systemId) || null;
  }

  /**
   * الحصول على جميع الدوائر
   */
  getAllCircuits(): { systemId: string; stats: CircuitStats }[] {
    const result: { systemId: string; stats: CircuitStats }[] = [];
    
    for (const [systemId, stats] of this.circuits.entries()) {
      result.push({ systemId, stats });
    }
    
    return result;
  }

  /**
   * إعادة تعيين الدائرة يدوياً
   */
  reset(systemId: string): void {
    const circuit = this.getOrCreateCircuit(systemId);
    circuit.failures = 0;
    circuit.successes = 0;
    this.transitionTo(systemId, CircuitState.CLOSED);
    
    this.logger.log(`Circuit ${systemId}: Manually reset`);
    this.logCircuitEvent(systemId, 'reset');
  }

  /**
   * إنشاء أو الحصول على دائرة
   */
  private getOrCreateCircuit(systemId: string): CircuitStats {
    let circuit = this.circuits.get(systemId);
    
    if (!circuit) {
      circuit = {
        failures: 0,
        successes: 0,
        lastFailure: null,
        lastSuccess: null,
        state: CircuitState.CLOSED,
        stateChangedAt: new Date(),
      };
      this.circuits.set(systemId, circuit);
    }
    
    return circuit;
  }

  /**
   * تغيير حالة الدائرة
   */
  private transitionTo(systemId: string, newState: CircuitState): void {
    const circuit = this.getOrCreateCircuit(systemId);
    const oldState = circuit.state;
    
    circuit.state = newState;
    circuit.stateChangedAt = new Date();
    
    if (newState === CircuitState.CLOSED) {
      circuit.failures = 0;
      circuit.successes = 0;
    }
    
    this.logger.log(`Circuit ${systemId}: ${oldState} -> ${newState}`);
  }

  /**
   * مراقبة الدوائر
   */
  private monitorCircuits(): void {
    const now = Date.now();
    
    for (const [systemId, circuit] of this.circuits.entries()) {
      // Reset old failures outside monitoring window
      if (circuit.lastFailure) {
        const timeSinceLastFailure = now - circuit.lastFailure.getTime();
        if (timeSinceLastFailure > this.defaultConfig.monitoringWindow) {
          if (circuit.state === CircuitState.CLOSED && circuit.failures > 0) {
            circuit.failures = 0;
            this.logger.debug(`Circuit ${systemId}: Failures reset due to monitoring window`);
          }
        }
      }
    }
  }

  /**
   * تسجيل حدث الدائرة في قاعدة البيانات
   */
  private async logCircuitEvent(systemId: string, event: string, error?: string): Promise<void> {
    try {
      await this.prisma.devSystemHealth.create({
        data: {
          systemId,
          status: event === 'opened' ? 'unhealthy' : 'healthy',
          responseTime: 0,
          checkedAt: new Date(),
          details: {
            circuitEvent: event,
            error,
          },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log circuit event: ${err}`);
    }
  }

  /**
   * تنفيذ دالة مع حماية Circuit Breaker
   */
  async execute<T>(
    systemId: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (!this.canExecute(systemId)) {
      if (fallback) {
        this.logger.warn(`Circuit ${systemId} is open, using fallback`);
        return fallback();
      }
      throw new Error(`Circuit breaker is open for system: ${systemId}`);
    }

    try {
      const result = await fn();
      this.recordSuccess(systemId);
      return result;
    } catch (error: any) {
      this.recordFailure(systemId, error.message);
      
      if (fallback) {
        this.logger.warn(`Request to ${systemId} failed, using fallback`);
        return fallback();
      }
      
      throw error;
    }
  }
}
