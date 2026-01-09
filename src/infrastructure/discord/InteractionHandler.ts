import { Events, type Interaction } from 'discord.js';
import type { DiscordClient } from './DiscordClient.js';
import { CommandRouter } from './CommandRouter.js';
import { handleMapButton, handleMapSelectMenu } from '../../presentation/discord/commands/map.js';
import logger from '../../shared/utils/logger.js';

export class InteractionHandler {
  private client: DiscordClient;
  private commandRouter: CommandRouter;

  constructor(client: DiscordClient) {
    this.client = client;
    this.commandRouter = new CommandRouter(client);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Ready event
    this.client.once(Events.ClientReady, (readyClient) => {
      logger.info(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
      logger.info(`Serving ${readyClient.guilds.cache.size} guilds`);
    });

    // Interaction event
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.commandRouter.handleInteraction(interaction);
        } else if (interaction.isAutocomplete()) {
          await this.commandRouter.handleAutocomplete(interaction);
        } else if (interaction.isButton()) {
          await this.handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
          await this.handleSelectMenu(interaction);
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
      }
    });

    // Guild join event
    this.client.on(Events.GuildCreate, (guild) => {
      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
    });

    // Guild leave event
    this.client.on(Events.GuildDelete, (guild) => {
      logger.info(`Left guild: ${guild.name} (${guild.id})`);
    });

    // Error event
    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error:', error);
    });

    // Warning event
    this.client.on(Events.Warn, (warning) => {
      logger.warn('Discord client warning:', warning);
    });
  }

  private async handleButton(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;

    const [action, ...params] = interaction.customId.split(':');

    logger.debug(`Button interaction: ${action} with params: ${params.join(', ')}`);

    // Button handlers will be implemented as needed
    switch (action) {
      case 'faction':
        // Faction selection is handled by awaitMessageComponent in begin.ts
        // Don't respond here - let the collector handle it
        return;
      case 'begin':
        // Tutorial prompt buttons after faction selection
        if (params[0] === 'tutorial') {
          await interaction.reply({
            content: '📚 Starting tutorial... Use `/tutorial` to begin!',
            ephemeral: true,
          });
        } else if (params[0] === 'skip') {
          await interaction.reply({
            content: '✅ No problem! Use `/help` to see available commands or `/tutorial` anytime to learn the basics.',
            ephemeral: true,
          });
        }
        return;
      case 'map':
        // Map navigation buttons
        if (params.length >= 1 && !params[0].startsWith('empty')) {
          await handleMapButton(interaction, params[0], params.slice(1));
        }
        return;
      case 'tutorial':
        // Tutorial navigation buttons are handled by awaitMessageComponent in tutorial.ts
        return;
      case 'guild_help':
        // Handle guild help button
        await interaction.reply({
          content: '🔨 Guild help feature coming soon!',
          ephemeral: true,
        });
        break;
      case 'rally_join':
        // Handle rally join button
        await interaction.reply({
          content: '⚔️ Rally join feature coming soon!',
          ephemeral: true,
        });
        break;
      default:
        // Don't respond to unknown buttons - they might be handled by collectors
        logger.debug(`Unhandled button action: ${action}`);
        return;
    }
  }

  private async handleSelectMenu(interaction: Interaction): Promise<void> {
    if (!interaction.isStringSelectMenu()) return;

    const [action, ...params] = interaction.customId.split(':');

    logger.debug(`Select menu interaction: ${action} with params: ${params.join(', ')}`);

    switch (action) {
      case 'map':
        // Map NPC selection
        await handleMapSelectMenu(interaction);
        return;
      case 'faction_select':
        await interaction.reply({
          content: '🎮 Faction selection feature coming soon!',
          ephemeral: true,
        });
        break;
      default:
        logger.debug(`Unhandled select menu action: ${action}`);
        return;
    }
  }
}
