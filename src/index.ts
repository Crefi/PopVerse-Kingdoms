import { config } from './shared/config/index.js';
import logger from './shared/utils/logger.js';
import { testConnection, closeDatabase } from './infrastructure/database/connection.js';
import { closeRedis, getRedis } from './infrastructure/cache/redis.js';
import { getDiscordClient, InteractionHandler } from './infrastructure/discord/index.js';
import { loadCommands } from './presentation/discord/commands/index.js';
import { npcService } from './domain/services/NpcService.js';
import { getWebServer } from './infrastructure/web/index.js';

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

  // Respawn any NPCs that are ready
  try {
    const respawned = await npcService.respawnReadyNpcs();
    if (respawned > 0) {
      logger.info(`Respawned ${respawned} NPCs on startup`);
    }
    
    // Check NPC stats
    const stats = await npcService.getNpcStats();
    logger.info(`NPC Status: ${stats.active} active, ${stats.respawning} respawning, ${stats.total} total`);
    
    // If no NPCs exist, spawn initial ones
    if (stats.total === 0) {
      logger.info('No NPCs found, spawning initial NPCs...');
      const spawned = await npcService.spawnInitialNpcs(50);
      logger.info(`Spawned ${spawned} initial NPCs`);
    }
  } catch (error) {
    logger.warn('Failed to check/respawn NPCs:', error);
  }

  // Set up periodic NPC respawn check (every 5 minutes)
  setInterval(async () => {
    try {
      const respawned = await npcService.respawnReadyNpcs();
      if (respawned > 0) {
        logger.debug(`Respawned ${respawned} NPCs`);
      }
    } catch (error) {
      logger.warn('Failed to respawn NPCs:', error);
    }
  }, 5 * 60 * 1000);

  // Start web dashboard if enabled
  if (config.web.enabled) {
    try {
      const webServer = getWebServer();
      await webServer.start();
      logger.info('Web dashboard enabled and running');
    } catch (error) {
      logger.warn('Failed to start web dashboard:', error);
    }
  }

  logger.info('PopVerse Kingdoms started successfully!');
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('Shutting down PopVerse Kingdoms...');
  
  // Stop web server if running
  if (config.web.enabled) {
    try {
      const webServer = getWebServer();
      await webServer.stop();
    } catch (error) {
      logger.warn('Error stopping web server:', error);
    }
  }
  
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
