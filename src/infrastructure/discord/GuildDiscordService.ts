import { ChannelType, PermissionFlagsBits, type Guild as DiscordGuild } from 'discord.js';
import { getDiscordClient } from './DiscordClient.js';
import { config } from '../../shared/config/index.js';
import logger from '../../shared/utils/logger.js';

export class GuildDiscordService {
  /**
   * Create a Discord role and channel for a game guild
   */
  async createGuildDiscordIntegration(
    guildName: string,
    guildTag: string
  ): Promise<{ roleId: string | null; channelId: string | null }> {
    try {
      const client = getDiscordClient();
      
      // Get the Discord server (guild)
      if (!config.discordGuildId) {
        logger.warn('No Discord guild ID configured, skipping guild integration');
        return { roleId: null, channelId: null };
      }

      const discordGuild = await client.guilds.fetch(config.discordGuildId);
      if (!discordGuild) {
        logger.error('Discord guild not found');
        return { roleId: null, channelId: null };
      }

      // Create role for the guild
      const role = await this.createGuildRole(discordGuild, guildName, guildTag);
      
      // Create private channel for the guild
      const channel = await this.createGuildChannel(discordGuild, guildName, guildTag, role?.id);

      return {
        roleId: role?.id || null,
        channelId: channel?.id || null,
      };
    } catch (error) {
      logger.error('Failed to create guild Discord integration:', error);
      return { roleId: null, channelId: null };
    }
  }

  /**
   * Create a Discord role for a guild
   */
  private async createGuildRole(
    discordGuild: DiscordGuild,
    guildName: string,
    guildTag: string
  ) {
    try {
      const roleName = `[${guildTag}] ${guildName}`;
      
      const role = await discordGuild.roles.create({
        name: roleName,
        color: this.getRandomColor(),
        hoist: true, // Display role members separately
        mentionable: true, // Allow @mentions
        reason: `Game guild created: ${guildName}`,
      });

      logger.info(`Created Discord role for guild: ${roleName} (${role.id})`);
      return role;
    } catch (error) {
      logger.error('Failed to create guild role:', error);
      return null;
    }
  }

  /**
   * Create a private Discord channel for a guild
   */
  private async createGuildChannel(
    discordGuild: DiscordGuild,
    guildName: string,
    guildTag: string,
    roleId?: string
  ) {
    try {
      const channelName = `${guildTag.toLowerCase()}-${guildName.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Create permission overwrites
      const permissionOverwrites: any[] = [
        {
          id: discordGuild.id, // @everyone role
          deny: [PermissionFlagsBits.ViewChannel], // Hide from everyone
        },
      ];

      // If role was created, allow role members to view
      if (roleId) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }

      const channel = await discordGuild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Private channel for [${guildTag}] ${guildName} guild members`,
        permissionOverwrites,
        reason: `Game guild created: ${guildName}`,
      });

      logger.info(`Created Discord channel for guild: ${channelName} (${channel.id})`);
      
      // Send welcome message
      await channel.send({
        content: `🏰 Welcome to **[${guildTag}] ${guildName}**!\n\nThis is your guild's private channel. Use it to coordinate with your guild members!`,
      });

      return channel;
    } catch (error) {
      logger.error('Failed to create guild channel:', error);
      return null;
    }
  }

  /**
   * Delete Discord role and channel for a guild
   */
  async deleteGuildDiscordIntegration(
    roleId: string | null,
    channelId: string | null
  ): Promise<void> {
    try {
      const client = getDiscordClient();
      
      if (!config.discordGuildId) {
        return;
      }

      const discordGuild = await client.guilds.fetch(config.discordGuildId);
      if (!discordGuild) {
        return;
      }

      // Delete role
      if (roleId) {
        try {
          const role = await discordGuild.roles.fetch(roleId);
          if (role) {
            await role.delete('Guild disbanded');
            logger.info(`Deleted Discord role: ${roleId}`);
          }
        } catch (error) {
          logger.warn(`Failed to delete role ${roleId}:`, error);
        }
      }

      // Delete channel
      if (channelId) {
        try {
          const channel = await discordGuild.channels.fetch(channelId);
          if (channel) {
            await channel.delete('Guild disbanded');
            logger.info(`Deleted Discord channel: ${channelId}`);
          }
        } catch (error) {
          logger.warn(`Failed to delete channel ${channelId}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to delete guild Discord integration:', error);
    }
  }

  /**
   * Add a player to the guild role
   */
  async addPlayerToGuildRole(discordId: string, roleId: string): Promise<boolean> {
    try {
      const client = getDiscordClient();
      
      if (!config.discordGuildId) {
        return false;
      }

      const discordGuild = await client.guilds.fetch(config.discordGuildId);
      if (!discordGuild) {
        return false;
      }

      const member = await discordGuild.members.fetch(discordId);
      if (!member) {
        logger.warn(`Discord member not found: ${discordId}`);
        return false;
      }

      await member.roles.add(roleId);
      logger.info(`Added role ${roleId} to member ${discordId}`);
      return true;
    } catch (error) {
      logger.error('Failed to add player to guild role:', error);
      return false;
    }
  }

  /**
   * Remove a player from the guild role
   */
  async removePlayerFromGuildRole(discordId: string, roleId: string): Promise<boolean> {
    try {
      const client = getDiscordClient();
      
      if (!config.discordGuildId) {
        return false;
      }

      const discordGuild = await client.guilds.fetch(config.discordGuildId);
      if (!discordGuild) {
        return false;
      }

      const member = await discordGuild.members.fetch(discordId);
      if (!member) {
        return false;
      }

      await member.roles.remove(roleId);
      logger.info(`Removed role ${roleId} from member ${discordId}`);
      return true;
    } catch (error) {
      logger.error('Failed to remove player from guild role:', error);
      return false;
    }
  }

  /**
   * Send announcement to guild channel
   */
  async sendGuildAnnouncement(
    channelId: string,
    message: string,
    mentionRole?: string
  ): Promise<boolean> {
    return this.sendGuildMessage(channelId, { content: message }, mentionRole);
  }

  /**
   * Send message with optional embeds and components (e.g. build support notification with Help button)
   */
  async sendGuildMessage(
    channelId: string,
    options: { content?: string; embeds?: any[]; components?: any[] },
    mentionRole?: string
  ): Promise<boolean> {
    try {
      const client = getDiscordClient();

      if (!config.discordGuildId) {
        return false;
      }

      const discordGuild = await client.guilds.fetch(config.discordGuildId);
      if (!discordGuild) {
        return false;
      }

      const channel = await discordGuild.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return false;
      }

      const content = options.content
        ? (mentionRole ? `<@&${mentionRole}> ${options.content}` : options.content)
        : mentionRole
          ? `<@&${mentionRole}>`
          : undefined;

      await (channel as any).send({
        content: content ?? undefined,
        embeds: options.embeds ?? [],
        components: options.components ?? [],
      });

      logger.info(`Sent guild message to channel ${channelId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send guild message:', error);
      return false;
    }
  }

  /**
   * Get a random color for guild role
   */
  private getRandomColor(): number {
    const colors = [
      0xe74c3c, // Red
      0x9b59b6, // Purple
      0x3498db, // Blue
      0x2ecc71, // Green
      0xf39c12, // Orange
      0x1abc9c, // Turquoise
      0xe91e63, // Pink
      0x00bcd4, // Cyan
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const guildDiscordService = new GuildDiscordService();
