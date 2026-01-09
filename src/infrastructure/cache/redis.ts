import Redis from 'ioredis';
import { config } from '../../shared/config/index.js';
import logger from '../../shared/utils/logger.js';

type RedisClient = InstanceType<typeof Redis.default>;

let redis: RedisClient | null = null;

export function getRedis(): RedisClient {
  if (!redis) {
    redis = new Redis.default({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err: Error) => logger.error('Redis error:', err));
    redis.on('close', () => logger.warn('Redis connection closed'));
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
}

// Cache key prefixes
export const CacheKeys = {
  player: (id: string) => `player:${id}`,
  playerByDiscord: (discordId: string) => `player:discord:${discordId}`,
  hero: (id: string) => `hero:${id}`,
  playerHeroes: (playerId: string) => `player:${playerId}:heroes`,
  guild: (id: string) => `guild:${id}`,
  mapTile: (x: number, y: number) => `map:${x}:${y}`,
  mapRegion: (x: number, y: number, size: number) => `map:region:${x}:${y}:${size}`,
  arenaLeaderboard: () => 'arena:leaderboard',
  arenaOpponents: (playerId: string) => `arena:opponents:${playerId}`,
  march: (id: string) => `march:${id}`,
  activeMarchesPlayer: (playerId: string) => `marches:player:${playerId}`,
  conquest: () => 'conquest:current',
  session: (discordId: string) => `session:${discordId}`,
};

// Default TTL values in seconds
export const CacheTTL = {
  player: 300, // 5 minutes
  hero: 300,
  guild: 600, // 10 minutes
  mapTile: 3600, // 1 hour
  mapRegion: 60, // 1 minute
  arenaLeaderboard: 60,
  arenaOpponents: 120, // 2 minutes
  march: 1800, // 30 minutes
  conquest: 30,
  session: 86400, // 24 hours
};
