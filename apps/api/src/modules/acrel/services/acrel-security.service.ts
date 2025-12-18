import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AcrelSecurityService {
  private readonly logger = new Logger(AcrelSecurityService.name);
  
  // المفتاح السري للتوقيع (يجب أن يكون في متغيرات البيئة)
  private readonly secretKey = process.env.ACREL_WEBHOOK_SECRET || 'acrel-webhook-secret-key';
  
  // قائمة IPs المسموح بها (يجب أن تكون في متغيرات البيئة)
  private readonly allowedIps: string[] = (process.env.ACREL_ALLOWED_IPS || '127.0.0.1,::1,localhost').split(',');
  
  // الحد الأقصى لعمر الطلب (5 دقائق)
  private readonly maxTimestampAge = 5 * 60 * 1000;

  /**
   * التحقق من أن IP مسموح به
   */
  isIpAllowed(ip: string): boolean {
    // في بيئة التطوير، السماح بجميع IPs
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    const normalizedIp = this.normalizeIp(ip);
    const isAllowed = this.allowedIps.some(allowedIp => 
      this.normalizeIp(allowedIp) === normalizedIp
    );

    if (!isAllowed) {
      this.logger.warn(`IP ${ip} not in whitelist`);
    }

    return isAllowed;
  }

  /**
   * تطبيع عنوان IP
   */
  private normalizeIp(ip: string): string {
    // إزالة البادئة IPv6 إذا كانت موجودة
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    return ip.trim();
  }

  /**
   * التحقق من صلاحية الـ Timestamp
   */
  isTimestampValid(timestamp: string): boolean {
    try {
      const requestTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const age = currentTime - requestTime;

      if (age > this.maxTimestampAge) {
        this.logger.warn(`Timestamp ${timestamp} is too old (${age}ms)`);
        return false;
      }

      // رفض الطلبات من المستقبل (أكثر من دقيقة)
      if (age < -60000) {
        this.logger.warn(`Timestamp ${timestamp} is in the future`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Invalid timestamp format: ${timestamp}`);
      return false;
    }
  }

  /**
   * التحقق من توقيع HMAC
   */
  verifySignature(signature: string, timestamp: string, body: any): boolean {
    try {
      const payload = `${timestamp}.${JSON.stringify(body)}`;
      const expectedSignature = this.generateSignature(payload);

      // مقارنة آمنة ضد timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        this.logger.warn('Signature verification failed');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * إنشاء توقيع HMAC
   */
  generateSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');
  }

  /**
   * إنشاء توقيع لطلب صادر
   */
  signOutgoingRequest(body: any): { signature: string; timestamp: string } {
    const timestamp = new Date().toISOString();
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const signature = this.generateSignature(payload);

    return { signature, timestamp };
  }
}
