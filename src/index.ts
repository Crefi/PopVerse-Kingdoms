import { config } from './shared/config/index.js';
import logger from './shared/utils/logger.js';
import { testConnection, closeDatabase } from './infrastructure/database/connection.js';
import { closeRedis, getRedis } from './infrastructure/cache/redis.js';
import { getDiscordClient, InteractionHandler } from './infrastructure/discord/index.js';
import { loadCommands } from './presentation/discord/commands/index.js';

async function bootstrap(): Promise<void> {
  logger.info('Starting PopVerse Kingdoms...');
  logger.info(`Environment: ${config.nodeEnv}`);

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Test Redis connection
  try {
    const redis = getRedis();
    await redis.ping();
    logger.info('Redis connection successful');
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    process.exit(1);
  }

  // Initialize Discord client
  const discordClient = getDiscordClient();

  // Load and register commands
  const commands = loadCommands();
  await discordClient.registerCommands(commands);

  // Set up interaction handler
  new InteractionHandler(discordClient);

  // Start the Discord client
  await discordClient.start();

  logger.info('PopVerse Kingdoms started successfully!');
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down PopVerse Kingdoms...');
  
  const discordClient = getDiscordClient();
  await discordClient.shutdown();
  
  await closeDatabase();
  await closeRedis();
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap().catch((error) => {
  logger.error('Failed to start PopVerse Kingdoms:', error);
  process.exit(1);
});
