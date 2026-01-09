import type {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  PermissionResolvable,
} from 'discord.js';

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  playerId?: bigint;
  guildId?: bigint;
}

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (context: CommandContext) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  cooldown?: number; // Cooldown in seconds
  permissions?: PermissionResolvable[];
  requiresPlayer?: boolean; // Whether the command requires a registered player
  requiresGuild?: boolean; // Whether the command requires the player to be in a guild
}

export interface CommandMiddleware {
  name: string;
  execute: (context: CommandContext) => Promise<boolean>; // Return false to stop execution
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  error?: Error;
}
