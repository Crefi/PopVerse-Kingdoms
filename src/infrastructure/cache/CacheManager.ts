import { getRedis } from './redis.js';
import logger from '../../shared/utils/logger.js';

export class CacheManager {
  private redis = getRedis();
  private localCache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly LOCAL_TTL_MS = 10000; // 10 seconds local cache

  async get<T>(key: string): Promise<T | null> {
    // Check local cache first
    const local = this.localCache.get(key);
    if (local && local.expiresAt > Date.now()) {
      return local.value as T;
    }

    // Check Redis
    try {
      const value = await this.redis.get(key);
      if (value) {
        const parsed = JSON.parse(value) as T;
        this.setLocal(key, parsed);
        return parsed;
      }
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      this.setLocal(key, value);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.localCache.delete(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        keys.forEach((key: string) => this.localCache.delete(key));
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  async getOrSet<T>(key: string, fallback: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fallback();
    await this.set(key, value, ttl);
    return value;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    if (keys.length === 0) return result;

    try {
      const values = await this.redis.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          result.set(key, JSON.parse(value) as T);
        }
      });
    } catch (error) {
      logger.error('Cache mget error:', error);
    }

    return result;
  }

  async mset(entries: Map<string, unknown>, ttl?: number): Promise<void> {
    if (entries.size === 0) return;

    try {
      const pipeline = this.redis.pipeline();
      entries.forEach((value, key) => {
        const serialized = JSON.stringify(value);
        if (ttl) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
        this.setLocal(key, value);
      });
      await pipeline.exec();
    } catch (error) {
      logger.error('Cache mset error:', error);
    }
  }

  // Distributed locking
  async acquireLock(resource: string, ttlMs: number): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const lockValue = `${Date.now()}-${Math.random()}`;

    try {
      const result = await this.redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
      return result === 'OK' ? lockValue : null;
    } catch (error) {
      logger.error(`Lock acquire error for ${resource}:`, error);
      return null;
    }
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.redis.eval(script, 1, lockKey, lockValue);
      return result === 1;
    } catch (error) {
      logger.error(`Lock release error for ${resource}:`, error);
      return false;
    }
  }

  private setLocal(key: string, value: unknown): void {
    this.localCache.set(key, {
      value,
      expiresAt: Date.now() + this.LOCAL_TTL_MS,
    });

    // Cleanup old entries periodically
    if (this.localCache.size > 1000) {
      const now = Date.now();
      for (const [k, v] of this.localCache) {
        if (v.expiresAt < now) {
          this.localCache.delete(k);
        }
      }
    }
  }
}

export const cacheManager = new CacheManager();
