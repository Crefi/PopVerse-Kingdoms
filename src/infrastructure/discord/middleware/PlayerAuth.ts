import type { CommandContext, CommandMiddleware } from '../types.js';
import { getDatabase } from '../../database/connection.js';
import { cacheManager } from '../../cache/CacheManager.js';
import { CacheKeys, CacheTTL } from '../../cache/redis.js';
import logger from '../../../shared/utils/logger.js';

export class PlayerAuth implements CommandMiddleware {
  name = 'PlayerAuth';

  async execute(context: CommandContext): Promise<boolean> {
    const discordId = context.interaction.user.id;

    try {
      // Try to get player from cache first
      const cacheKey = CacheKeys.playerByDiscord(discordId);
      const cachedPlayer = await cacheManager.get<{ id: string }>(cacheKey);

      if (cachedPlayer) {
        context.playerId = BigInt(cachedPlayer.id);
        return true;
      }

      // Query database
      const db = getDatabase();
      const player = await db('players')
        .select('id')
        .where('discord_id', discordId)
        .first();

      if (player) {
        context.playerId = BigInt(player.id);
        // Cache the result
        await cacheManager.set(cacheKey, { id: player.id.toString() }, CacheTTL.player);
        return true;
      }

      // Player not found - this is okay for commands that don't require a player
      return true;
    } catch (error) {
      logger.error('Error in PlayerAuth middleware:', error);
      return true; // Don't block on auth errors
    }
  }
}

export class RequirePlayer implements CommandMiddleware {
  name = 'RequirePlayer';

  async execute(context: CommandContext): Promise<boolean> {
    if (!context.playerId) {
      await context.interaction.reply({
        content: '❌ You need to register first! Use `/begin` to start your journey.',
        ephemeral: true,
      });
      return false;
    }
    return true;
  }
}

export class RequireGuild implements CommandMiddleware {
  name = 'RequireGuild';

  async execute(context: CommandContext): Promise<boolean> {
    if (!context.playerId) {
      await context.interaction.reply({
        content: '❌ You need to register first! Use `/begin` to start your journey.',
        ephemeral: true,
      });
      return false;
    }

    try {
      const db = getDatabase();
      const membership = await db('guild_members')
        .select('guild_id')
        .where('player_id', context.playerId.toString())
        .first();

      if (!membership) {
        await context.interaction.reply({
          content: '❌ You need to be in a guild to use this command! Use `/guild join` or `/guild create`.',
          ephemeral: true,
        });
        return false;
      }

      context.guildId = BigInt(membership.guild_id);
      return true;
    } catch (error) {
      logger.error('Error in RequireGuild middleware:', error);
      await context.interaction.reply({
        content: '❌ An error occurred while checking your guild membership.',
        ephemeral: true,
      });
      return false;
    }
  }
}
