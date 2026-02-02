import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type SlashCommandStringOption } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { BuildingType, Resources } from '../../../shared/types/index.js';
import { MAX_HQ_LEVEL, getBuildingSlots } from '../../../shared/constants/game.js';
import { DailyQuestService } from '../../../domain/services/DailyQuestService.js';
import { ActivityLogService } from '../../../domain/services/ActivityLogService.js';
import { guildService } from '../../../domain/services/GuildService.js';
import { guildDiscordService } from '../../../infrastructure/discord/GuildDiscordService.js';
import type { Knex } from 'knex';

interface BuildingRow {
  type: string;
  level: number;
  upgrade_completes_at: Date | null;
}

// Building costs and times per level
const BUILDING_CONFIG: Record<string, {
  maxLevel: number;
  baseCost: { food: number; iron: number; gold: number };
  baseTime: number; // seconds
  costMultiplier: number;
  timeMultiplier: number;
  hqRequired: number[];
  description: string;
}> = {
  hq: {
    maxLevel: MAX_HQ_LEVEL,
    baseCost: { food: 500, iron: 300, gold: 100 },
    baseTime: 60,
    costMultiplier: 1.8,
    timeMultiplier: 1.5,
    hqRequired: Array.from({ length: MAX_HQ_LEVEL }, (_, i) => i),
    description: 'Headquarters - Unlocks features and buildings',
  },
  farm: {
    maxLevel: 20,
    baseCost: { food: 200, iron: 100, gold: 0 },
    baseTime: 30,
    costMultiplier: 1.5,
    timeMultiplier: 1.4,
    hqRequired: [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    description: 'Farm - Produces Food hourly',
  },
  mine: {
    maxLevel: 20,
    baseCost: { food: 100, iron: 200, gold: 0 },
    baseTime: 30,
    costMultiplier: 1.5,
    timeMultiplier: 1.4,
    hqRequired: [1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    description: 'Mine - Produces Iron hourly',
  },
  barracks: {
    maxLevel: 20,
    baseCost: { food: 300, iron: 300, gold: 50 },
    baseTime: 45,
    costMultiplier: 1.6,
    timeMultiplier: 1.5,
    hqRequired: [2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    description: 'Barracks - Train troops and increase army capacity',
  },
  vault: {
    maxLevel: 20,
    baseCost: { food: 200, iron: 200, gold: 100 },
    baseTime: 40,
    costMultiplier: 1.5,
    timeMultiplier: 1.4,
    hqRequired: [3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    description: 'Vault - Protects resources from raids (50% protection)',
  },
  hospital: {
    maxLevel: 20,
    baseCost: { food: 250, iron: 150, gold: 50 },
    baseTime: 35,
    costMultiplier: 1.5,
    timeMultiplier: 1.4,
    hqRequired: [4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    description: 'Hospital - Heal wounded troops',
  },
  academy: {
    maxLevel: 20,
    baseCost: { food: 300, iron: 200, gold: 200 },
    baseTime: 60,
    costMultiplier: 1.7,
    timeMultiplier: 1.6,
    hqRequired: [5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
    description: 'Academy - Research upgrades',
  },
  forge: {
    maxLevel: 10,
    baseCost: { food: 0, iron: 2000, gold: 5000 },
    baseTime: 120,
    costMultiplier: 1.8,
    timeMultiplier: 1.7,
    hqRequired: [10, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    description: 'Forge - Craft equipment and salvage items',
  },
};

export const buildCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('build')
    .setDescription('Build or upgrade a building in your city')
    .addStringOption((option: SlashCommandStringOption) =>
      option
        .setName('building')
        .setDescription('The building to construct or upgrade')
        .setRequired(true)
        .addChoices(
          { name: '🏛️ HQ (Headquarters)', value: 'hq' },
          { name: '🌾 Farm', value: 'farm' },
          { name: '⚒️ Mine', value: 'mine' },
          { name: '⚔️ Barracks', value: 'barracks' },
          { name: '🏦 Vault', value: 'vault' },
          { name: '🏥 Hospital', value: 'hospital' },
          { name: '📚 Academy', value: 'academy' },
          { name: '🔨 Forge', value: 'forge' }
        )
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const buildingType = context.interaction.options.getString('building', true) as BuildingType;

    // Get player data (include username for guild notification)
    const player = await db('players')
      .select('id', 'resources', 'username')
      .where('discord_id', discordId)
      .first();

    if (!player) {
      await context.interaction.reply({
        content: '❌ You haven\'t started your journey yet! Use `/begin` to get started.',
        ephemeral: true,
      });
      return;
    }

    const resources: Resources = typeof player.resources === 'string'
      ? JSON.parse(player.resources)
      : player.resources;

    // Get current buildings
    const buildings: BuildingRow[] = await db('buildings')
      .select('type', 'level', 'upgrade_completes_at')
      .where('player_id', player.id);

    const buildingMap = new Map(buildings.map((b) => [b.type, b]));
    const hq = buildingMap.get('hq');
    const hqLevel = hq?.level ?? 1;

    // Get available building slots based on HQ level
    const maxSlots = getBuildingSlots(hqLevel);
    
    // Count currently upgrading buildings
    const upgradingBuildings = buildings.filter((b) => 
      b.upgrade_completes_at && new Date(b.upgrade_completes_at) > new Date()
    );

    if (upgradingBuildings.length >= maxSlots) {
      const nextSlotHq = hqLevel < 5 ? 5 : hqLevel < 10 ? 10 : hqLevel < 15 ? 15 : hqLevel < 20 ? 20 : null;
      const slotHint = nextSlotHq ? `\n💡 Upgrade HQ to level ${nextSlotHq} for an extra slot!` : '';
      
      const upgradingList = upgradingBuildings.map(b => {
        const completeTime = new Date(b.upgrade_completes_at!);
        return `• **${formatBuildingName(b.type)}** - <t:${Math.floor(completeTime.getTime() / 1000)}:R>`;
      }).join('\n');

      await context.interaction.reply({
        content: `⏳ All ${maxSlots} building slot${maxSlots > 1 ? 's' : ''} are in use!\n\n**Currently upgrading:**\n${upgradingList}${slotHint}`,
        ephemeral: true,
      });
      return;
    }

    const config = BUILDING_CONFIG[buildingType];
    if (!config) {
      await context.interaction.reply({
        content: '❌ Invalid building type.',
        ephemeral: true,
      });
      return;
    }

    const currentBuilding = buildingMap.get(buildingType);
    const currentLevel = currentBuilding?.level ?? 0;
    const nextLevel = currentLevel + 1;

    // Check max level
    if (nextLevel > config.maxLevel) {
      await context.interaction.reply({
        content: `❌ **${formatBuildingName(buildingType)}** is already at max level (${config.maxLevel})!`,
        ephemeral: true,
      });
      return;
    }

    // Check HQ requirement
    const requiredHq = config.hqRequired[currentLevel] ?? 1;
    if (buildingType !== 'hq' && hqLevel < requiredHq) {
      await context.interaction.reply({
        content: `❌ You need **HQ Level ${requiredHq}** to upgrade ${formatBuildingName(buildingType)} to level ${nextLevel}.\nYour HQ is currently level ${hqLevel}.`,
        ephemeral: true,
      });
      return;
    }

    // Calculate costs
    const cost = calculateCost(config, currentLevel);
    const buildTime = calculateBuildTime(config, currentLevel);

    // Check resources
    if (resources.food < cost.food || resources.iron < cost.iron || resources.gold < cost.gold) {
      await context.interaction.reply({
        content: `❌ Not enough resources to upgrade **${formatBuildingName(buildingType)}** to level ${nextLevel}!\n\n` +
          `**Required:**\n🌾 ${cost.food.toLocaleString()} Food\n⚒️ ${cost.iron.toLocaleString()} Iron\n💰 ${cost.gold.toLocaleString()} Gold\n\n` +
          `**You have:**\n🌾 ${resources.food.toLocaleString()} Food\n⚒️ ${resources.iron.toLocaleString()} Iron\n💰 ${resources.gold.toLocaleString()} Gold`,
        ephemeral: true,
      });
      return;
    }

    // Deduct resources
    const newResources = {
      food: resources.food - cost.food,
      iron: resources.iron - cost.iron,
      gold: resources.gold - cost.gold,
    };

    const completesAt = new Date(Date.now() + buildTime * 1000);

    await db.transaction(async (trx: Knex.Transaction) => {
      // Update player resources
      await trx('players')
        .where('id', player.id)
        .update({ resources: JSON.stringify(newResources) });

      // Create or update building
      if (currentBuilding) {
        await trx('buildings')
          .where('player_id', player.id)
          .where('type', buildingType)
          .update({
            level: nextLevel,
            upgrade_completes_at: completesAt,
          });
      } else {
        await trx('buildings').insert({
          player_id: player.id,
          type: buildingType,
          level: nextLevel,
          upgrade_completes_at: completesAt,
        });
      }
    });

    // Update daily quest progress for building upgrade
    await DailyQuestService.updateProgress(player.id, 'build_upgrade', 1);

    // Log activity
    await ActivityLogService.log(
      player.id,
      'build_upgrade',
      `Upgraded ${formatBuildingName(buildingType)} to level ${nextLevel}`,
      { food: -cost.food, iron: -cost.iron, gold: -cost.gold },
      { buildingType, buildingLevel: nextLevel }
    );

    // Create success embed
    const slotsUsed = upgradingBuildings.length + 1;
    const embed = new EmbedBuilder()
      .setTitle(`🏗️ ${currentLevel === 0 ? 'Building' : 'Upgrading'} ${formatBuildingName(buildingType)}`)
      .setDescription(config.description)
      .setColor('#00FF00')
      .addFields(
        { name: '📊 Level', value: `${currentLevel} → **${nextLevel}**`, inline: true },
        { name: '⏱️ Completes', value: `<t:${Math.floor(completesAt.getTime() / 1000)}:R>`, inline: true },
        { name: '🔧 Slots', value: `${slotsUsed}/${maxSlots} in use`, inline: true },
        { name: '💰 Cost', value: `🌾 ${cost.food.toLocaleString()}\n⚒️ ${cost.iron.toLocaleString()}\n💰 ${cost.gold.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: 'Guild members can help speed up construction!' })
      .setTimestamp();

    await context.interaction.reply({ embeds: [embed] });

    // Guild build support: post notification in guild channel with Help Build button
    const guild = await guildService.getPlayerGuild(player.id);
    if (guild?.discordChannelId) {
      const buildingRow = await db('buildings')
        .select('id', 'upgrade_completes_at')
        .where('player_id', player.id)
        .where('type', buildingType)
        .first();
      if (buildingRow?.id && buildingRow.upgrade_completes_at) {
        const completesAtSec = Math.floor(new Date(buildingRow.upgrade_completes_at).getTime() / 1000);
        const supportEmbed = new EmbedBuilder()
          .setTitle('🔨 Guild Build Support')
          .setDescription(`**${player.username}** started building and could use your help!`)
          .setColor(0xf39c12)
          .addFields(
            { name: '🏗️ Building', value: formatBuildingName(buildingType), inline: true },
            { name: '📊 Level', value: `${currentLevel} → **${nextLevel}**`, inline: true },
            { name: '⏱️ Completes', value: `<t:${completesAtSec}:R>`, inline: true }
          )
          .setFooter({ text: 'Each guild member can help once (saves 10 min)!' })
          .setTimestamp();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`guild_build_help:${buildingRow.id}:${completesAtSec}`)
            .setLabel('Help Build')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔨')
        );
        await guildDiscordService.sendGuildMessage(
          guild.discordChannelId,
          { embeds: [supportEmbed], components: [row] }
        );
      }
    }
  },
};

function calculateCost(config: typeof BUILDING_CONFIG[string], currentLevel: number): Resources {
  const multiplier = Math.pow(config.costMultiplier, currentLevel);
  return {
    food: Math.floor(config.baseCost.food * multiplier),
    iron: Math.floor(config.baseCost.iron * multiplier),
    gold: Math.floor(config.baseCost.gold * multiplier),
  };
}

function calculateBuildTime(config: typeof BUILDING_CONFIG[string], currentLevel: number): number {
  return Math.floor(config.baseTime * Math.pow(config.timeMultiplier, currentLevel));
}

function formatBuildingName(type: string): string {
  const names: Record<string, string> = {
    hq: '🏛️ HQ',
    farm: '🌾 Farm',
    mine: '⚒️ Mine',
    barracks: '⚔️ Barracks',
    vault: '🏦 Vault',
    hospital: '🏥 Hospital',
    academy: '📚 Academy',
    forge: '🔨 Forge',
  };
  return names[type] || type;
}
