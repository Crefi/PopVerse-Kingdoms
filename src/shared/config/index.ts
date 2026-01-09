import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment-specific config
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
dotenv.config({ path: envFile });

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Discord
  discordToken: z.string().min(1),
  discordClientId: z.string().min(1),
  discordGuildId: z.string().optional(),

  // Database
  db: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    name: z.string().default('popverse_kingdoms'),
    user: z.string().default('postgres'),
    password: z.string().default('postgres'),
    poolMin: z.coerce.number().default(2),
    poolMax: z.coerce.number().default(10),
  }),

  // Redis
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),

  // Web
  web: z.object({
    port: z.coerce.number().default(3000),
    jwtSecret: z.string().min(1),
    jwtExpiresIn: z.string().default('7d'),
  }),

  // Game
  game: z.object({
    mapSize: z.coerce.number().default(100),
    seasonDurationDays: z.coerce.number().default(90),
    conquestDay: z.string().default('saturday'),
    conquestHour: z.coerce.number().default(20),
  }),

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function loadConfig() {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    discordToken: process.env.DISCORD_TOKEN,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordGuildId: process.env.DISCORD_GUILD_ID,
    db: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      poolMin: process.env.DB_POOL_MIN,
      poolMax: process.env.DB_POOL_MAX,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
    },
    web: {
      port: process.env.WEB_PORT,
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    },
    game: {
      mapSize: process.env.MAP_SIZE,
      seasonDurationDays: process.env.SEASON_DURATION_DAYS,
      conquestDay: process.env.CONQUEST_DAY,
      conquestHour: process.env.CONQUEST_HOUR,
    },
    logLevel: process.env.LOG_LEVEL,
  });

  if (!result.success) {
    console.error('Configuration validation failed:', result.error.format());
    throw new Error('Invalid configuration');
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
