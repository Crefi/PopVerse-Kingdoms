import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { ActivityLogService } from '../../../domain/services/ActivityLogService.js';

const ACTION_EMOJIS: Record<string, string> = {
  train_troops: '⚔️',
  build_upgrade: '🏗️',
  attack_player: '⚔️',
  attack_npc: '👹',
  scout: '🔭',
  daily_reward: '🎁',
  quest_reward: '📋',
  arena_battle: '🏟️',
  research: '📚',
  teleport: '🌀',
  shop_purchase: '🛒',
};

export const activityCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('View your activity log and resource summary for today'),

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players').select('id', 'username').where('discord_id', discordId).first();
    if (!player) {
      await context.interaction.reply({ content: '❌ Use `/begin` to start!', ephemeral: true });
      return;
    }

    await context.interaction.deferReply();

    const { activities, summary } = await ActivityLogService.getTodayActivity(player.id);

    // Build summary embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 Today's Activity - ${player.username}`)
      .setColor('#4169E1')
      .setTimestamp();

    // Resource summary
    const resourceSummary = [
      `🌾 **Food:** +${summary.foodEarned.toLocaleString()} / -${summary.foodSpent.toLocaleString()}`,
      `⚒️ **Iron:** +${summary.ironEarned.toLocaleString()} / -${summary.ironSpent.toLocaleString()}`,
      `💰 **Gold:** +${summary.goldEarned.toLocaleString()} / -${summary.goldSpent.toLocaleString()}`,
      `💎 **Diamonds:** +${summary.diamondsEarned.toLocaleString()} / -${summary.diamondsSpent.toLocaleString()}`,
    ].join('\n');

    embed.addFields({
      name: '💰 Resource Summary',
      value: resourceSummary,
      inline: false,
    });

    // Activity summary
    const activitySummary = [
      `🪖 Troops Trained: **${summary.troopsTrained.toLocaleString()}**`,
      `🏗️ Buildings Upgraded: **${summary.buildingsUpgraded}**`,
      `⚔️ Battles Won: **${summary.battlesWon}**`,
      `🔭 Scouts Made: **${summary.scoutsMade}**`,
    ].join('\n');

    embed.addFields({
      name: '📈 Activity Summary',
      value: activitySummary,
      inline: false,
    });

    // Recent activities (last 10)
    if (activities.length > 0) {
      const recentActivities = activities.slice(0, 10).map(a => {
        const emoji = ACTION_EMOJIS[a.actionType] || '📝';
        const time = `<t:${Math.floor(a.createdAt.getTime() / 1000)}:t>`;
        return `${emoji} ${time} - ${a.description}`;
      }).join('\n');

      embed.addFields({
        name: '📜 Recent Activity',
        value: recentActivities,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '📜 Recent Activity',
        value: 'No activity recorded today. Start playing to see your progress!',
        inline: false,
      });
    }

    // Net resource change
    const netFood = summary.foodEarned - summary.foodSpent;
    const netIron = summary.ironEarned - summary.ironSpent;
    const netGold = summary.goldEarned - summary.goldSpent;
    const netDiamonds = summary.diamondsEarned - summary.diamondsSpent;

    const formatNet = (value: number) => {
      if (value > 0) return `+${value.toLocaleString()}`;
      if (value < 0) return value.toLocaleString();
      return '0';
    };

    embed.addFields({
      name: '📊 Net Change',
      value: `🌾 ${formatNet(netFood)} | ⚒️ ${formatNet(netIron)} | 💰 ${formatNet(netGold)} | 💎 ${formatNet(netDiamonds)}`,
      inline: false,
    });

    embed.setFooter({ text: 'Activity resets daily at midnight UTC' });

    // Add refresh button
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('activity:refresh')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await context.interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Handle refresh button
    try {
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === discordId,
        time: 120000,
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'activity:refresh') {
          await i.deferUpdate();

          const { activities: newActivities, summary: newSummary } = await ActivityLogService.getTodayActivity(player.id);

          // Rebuild embed with new data
          const newEmbed = new EmbedBuilder()
            .setTitle(`📊 Today's Activity - ${player.username}`)
            .setColor('#4169E1')
            .setTimestamp();

          const newResourceSummary = [
            `🌾 **Food:** +${newSummary.foodEarned.toLocaleString()} / -${newSummary.foodSpent.toLocaleString()}`,
            `⚒️ **Iron:** +${newSummary.ironEarned.toLocaleString()} / -${newSummary.ironSpent.toLocaleString()}`,
            `💰 **Gold:** +${newSummary.goldEarned.toLocaleString()} / -${newSummary.goldSpent.toLocaleString()}`,
            `💎 **Diamonds:** +${newSummary.diamondsEarned.toLocaleString()} / -${newSummary.diamondsSpent.toLocaleString()}`,
          ].join('\n');

          newEmbed.addFields({
            name: '💰 Resource Summary',
            value: newResourceSummary,
            inline: false,
          });

          const newActivitySummary = [
            `🪖 Troops Trained: **${newSummary.troopsTrained.toLocaleString()}**`,
            `🏗️ Buildings Upgraded: **${newSummary.buildingsUpgraded}**`,
            `⚔️ Battles Won: **${newSummary.battlesWon}**`,
            `🔭 Scouts Made: **${newSummary.scoutsMade}**`,
          ].join('\n');

          newEmbed.addFields({
            name: '📈 Activity Summary',
            value: newActivitySummary,
            inline: false,
          });

          if (newActivities.length > 0) {
            const recentActivities = newActivities.slice(0, 10).map(a => {
              const emoji = ACTION_EMOJIS[a.actionType] || '📝';
              const time = `<t:${Math.floor(a.createdAt.getTime() / 1000)}:t>`;
              return `${emoji} ${time} - ${a.description}`;
            }).join('\n');

            newEmbed.addFields({
              name: '📜 Recent Activity',
              value: recentActivities,
              inline: false,
            });
          } else {
            newEmbed.addFields({
              name: '📜 Recent Activity',
              value: 'No activity recorded today.',
              inline: false,
            });
          }

          const newNetFood = newSummary.foodEarned - newSummary.foodSpent;
          const newNetIron = newSummary.ironEarned - newSummary.ironSpent;
          const newNetGold = newSummary.goldEarned - newSummary.goldSpent;
          const newNetDiamonds = newSummary.diamondsEarned - newSummary.diamondsSpent;

          newEmbed.addFields({
            name: '📊 Net Change',
            value: `🌾 ${formatNet(newNetFood)} | ⚒️ ${formatNet(newNetIron)} | 💰 ${formatNet(newNetGold)} | 💎 ${formatNet(newNetDiamonds)}`,
            inline: false,
          });

          newEmbed.setFooter({ text: 'Activity resets daily at midnight UTC' });

          await i.editReply({ embeds: [newEmbed], components: [row] });
        }
      });

      collector.on('end', () => {
        context.interaction.editReply({ components: [] }).catch(() => {});
      });
    } catch {
      // Ignore errors
    }
  },
};
