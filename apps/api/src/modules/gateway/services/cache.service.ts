import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface CacheEntry<T = any> {
  data: T;
  expiresAt: Date;
  createdAt: Date;
  hitCount: number;
}

interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of entries
  enabled: boolean;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultConfig: CacheConfig = {
    ttl: 300, // 5 minutes default
    maxSize: 1000,
    enabled: true,
  };

  constructor(private readonly prisma: PrismaService) {
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000); // Clean up every minute
  }

  /**
   * الحصول على قيمة من الكاش
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.defaultConfig.enabled) return null;

    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hitCount++;
    
    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.data as T;
  }

  /**
   * تخزين قيمة في الكاش
   */
  async set<T = any>(key: string, data: T, ttl?: number): Promise<void> {
    if (!this.defaultConfig.enabled) return;

    // Check max size
    if (this.cache.size >= this.defaultConfig.maxSize) {
      this.evictOldest();
    }

    const effectiveTtl = ttl || this.defaultConfig.ttl;
    const now = new Date();

    this.cache.set(key, {
      data,
      expiresAt: new Date(now.getTime() + effectiveTtl * 1000),
      createdAt: now,
      hitCount: 0,
    });

    this.logger.debug(`Cache set for key: ${key}, TTL: ${effectiveTtl}s`);
  }

  /**
   * حذف قيمة من الكاش
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * حذف جميع القيم المطابقة لنمط معين
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.logger.debug(`Deleted ${count} cache entries matching pattern: ${pattern}`);
    return count;
  }

  /**
   * مسح الكاش بالكامل
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * الحصول على إحصائيات الكاش
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    enabled: boolean;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.defaultConfig.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      enabled: this.defaultConfig.enabled,
    };
  }

  /**
   * تنظيف القيم المنتهية الصلاحية
   */
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * إزالة أقدم القيم عند الوصول للحد الأقصى
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`Evicted oldest cache entry: ${oldestKey}`);
    }
  }

  /**
   * توليد مفتاح كاش للطلب
   */
  generateCacheKey(system: string, path: string, query?: Record<string, any>): string {
    const queryString = query ? JSON.stringify(query) : '';
    return `gateway:${system}:${path}:${queryString}`;
  }

  /**
   * التحقق مما إذا كان الطلب قابل للتخزين المؤقت
   */
  isCacheable(method: string, path: string): boolean {
    // Only cache GET requests
    if (method.toUpperCase() !== 'GET') return false;

    // Don't cache certain paths
    const nonCacheablePaths = ['/health', '/auth', '/login', '/logout'];
    return !nonCacheablePaths.some(p => path.includes(p));
  }
}
