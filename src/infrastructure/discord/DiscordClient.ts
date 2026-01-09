import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { config } from '../../shared/config/index.js';
import logger from '../../shared/utils/logger.js';
import type { Command } from './types.js';

export class DiscordClient extends Client {
  public commands: Collection<string, Command> = new Collection();
  private _rest: REST;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this._rest = new REST({ version: '10' }).setToken(config.discordToken);
  }

  async registerCommands(commands: Command[]): Promise<void> {
    const commandData: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

    for (const command of commands) {
      this.commands.set(command.data.name, command);
      commandData.push(command.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody);
      logger.debug(`Registered command: ${command.data.name}`);
    }

    try {
      logger.info(`Refreshing ${commandData.length} application (/) commands...`);

      // Register commands globally or to a specific guild
      if (config.discordGuildId) {
        await this._rest.put(
          Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
          { body: commandData }
        );
        logger.info(`Successfully registered commands to guild ${config.discordGuildId}`);
      } else {
        await this._rest.put(Routes.applicationCommands(config.discordClientId), {
          body: commandData,
        });
        logger.info('Successfully registered global commands');
      }
    } catch (error) {
      logger.error('Failed to register commands:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      await this.login(config.discordToken);
      logger.info('Discord client logged in successfully');
    } catch (error) {
      logger.error('Failed to login to Discord:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Discord client...');
    this.destroy();
  }
}

// Singleton instance
let discordClient: DiscordClient | null = null;

export function getDiscordClient(): DiscordClient {
  if (!discordClient) {
    discordClient = new DiscordClient();
  }
  return discordClient;
}
