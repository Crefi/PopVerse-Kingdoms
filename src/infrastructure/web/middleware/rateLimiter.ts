import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../../cache/redis.js';
import logger from '../../../shared/utils/logger.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
};

const endpointLimits: Record<string, RateLimitConfig> = {
  '/api/auth': { windowMs: 60 * 1000, maxRequests: 10 },
  '/api/map': { windowMs: 60 * 1000, maxRequests: 60 },
  '/api/player': { windowMs: 60 * 1000, maxRequests: 30 },
  '/api/marches': { windowMs: 60 * 1000, maxRequests: 30 },
};

function getConfigForPath(path: string): RateLimitConfig {
  for (const [prefix, config] of Object.entries(endpointLimits)) {
    if (path.startsWith(prefix)) {
      return config;
    }
  }
  return defaultConfig;
}

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const redis = getRedis();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const config = getConfigForPath(req.path);
    
    const key = `ratelimit:${ip}:${req.path.split('/').slice(0, 3).join('/')}`;
    
    const multi = redis.multi();
    multi.incr(key);
    multi.pttl(key);
    
    const results = await multi.exec();
    
    if (!results) {
      next();
      return;
    }

    const [[, count], [, ttl]] = results as [[null, number], [null, number]];
    
    // Set expiry if this is a new key
    if (ttl === -1) {
      await redis.pexpire(key, config.windowMs);
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count));
    res.setHeader('X-RateLimit-Reset', Date.now() + (ttl > 0 ? ttl : config.windowMs));

    if (count > config.maxRequests) {
      logger.warn(`Rate limit exceeded for ${ip} on ${req.path}`);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((ttl > 0 ? ttl : config.windowMs) / 1000),
      });
      return;
    }

    next();
  } catch (error) {
    // If Redis fails, allow the request but log the error
    logger.error('Rate limiter error:', error);
    next();
  }
}
