import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import type { DiscordClient } from './DiscordClient.js';
import type { CommandContext, CommandMiddleware } from './types.js';
import { PlayerAuth, RequirePlayer, RequireGuild } from './middleware/PlayerAuth.js';
import { RateLimiter } from './middleware/RateLimiter.js';
import logger from '../../shared/utils/logger.js';

export class CommandRouter {
  private client: DiscordClient;
  private globalMiddleware: CommandMiddleware[] = [];
  private rateLimiter: RateLimiter;
  private playerAuth: PlayerAuth;

  constructor(client: DiscordClient) {
    this.client = client;
    this.rateLimiter = new RateLimiter(10, 60000); // 10 commands per minute
    this.playerAuth = new PlayerAuth();

    // Add global middleware
    this.globalMiddleware.push(this.rateLimiter);
    this.globalMiddleware.push(this.playerAuth);
  }

  async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      await interaction.reply({
        content: '❌ Unknown command.',
        ephemeral: true,
      });
      return;
    }

    // Create command context
    const context: CommandContext = {
      interaction,
    };

    try {
      // Run global middleware
      for (const middleware of this.globalMiddleware) {
        const shouldContinue = await middleware.execute(context);
        if (!shouldContinue) {
          logger.debug(`Middleware ${middleware.name} stopped execution for ${interaction.commandName}`);
          return;
        }
      }

      // Check if command requires a registered player
      if (command.requiresPlayer) {
        const requirePlayer = new RequirePlayer();
        const shouldContinue = await requirePlayer.execute(context);
        if (!shouldContinue) return;
      }

      // Check if command requires guild membership
      if (command.requiresGuild) {
        const requireGuild = new RequireGuild();
        const shouldContinue = await requireGuild.execute(context);
        if (!shouldContinue) return;
      }

      // Execute the command
      logger.debug(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
      await command.execute(context);

      logger.info(`Command ${interaction.commandName} executed successfully by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);
      await this.handleError(interaction, error as Error);
    }
  }

  async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = this.client.commands.get(interaction.commandName);

    if (!command?.autocomplete) {
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (_error) {
      logger.error(`Error in autocomplete for ${interaction.commandName}:`, _error);
      await interaction.respond([]);
    }
  }

  private async handleError(interaction: ChatInputCommandInteraction, _error: Error): Promise<void> {
    const errorMessage = '❌ An error occurred while executing this command. Please try again later.';

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      }
    } catch (replyError) {
      logger.error('Failed to send error message:', replyError);
    }
  }
}
