import { SlashCommandBuilder, EmbedBuilder, type SlashCommandIntegerOption } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { Resources, TroopTier } from '../../../shared/types/index.js';
import { DailyQuestService } from '../../../domain/services/DailyQuestService.js';
import { ActivityLogService } from '../../../domain/services/ActivityLogService.js';
import type { Knex } from 'knex';

// Troop configuration per tier
const TROOP_CONFIG: Record<TroopTier, {
  name: string;
  cost: { food: number; iron: number };
  trainTime: number; // seconds per troop
  power: number;
  hqRequired: number;
}> = {
  1: {
    name: 'Militia',
    cost: { food: 50, iron: 20 },
    trainTime: 30,
    power: 10,
    hqRequired: 1,
  },
  2: {
    name: 'Soldiers',
    cost: { food: 150, iron: 80 },
    trainTime: 120,
    power: 30,
    hqRequired: 10,
  },
  3: {
    name: 'Veterans',
    cost: { food: 400, iron: 200 },
    trainTime: 300,
    power: 100,
    hqRequired: 18,
  },
  4: {
    name: 'Elite Guards',
    cost: { food: 1000, iron: 500 },
    trainTime: 900,
    power: 300,
    hqRequired: 25,
  },
};

export const trainCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('train')
    .setDescription('Train troops in your barracks')
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option
        .setName('tier')
        .setDescription('Troop tier to train (1-4)')
        .setRequired(true)
        .addChoices(
          { name: 'T1 - Militia (10 power)', value: 1 },
          { name: 'T2 - Soldiers (30 power)', value: 2 },
          { name: 'T3 - Veterans (100 power)', value: 3 },
          { name: 'T4 - Elite Guards (300 power)', value: 4 }
        )
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option
        .setName('amount')
        .setDescription('Number of troops to train')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const tier = context.interaction.options.getInteger('tier', true) as TroopTier;
    const amount = context.interaction.options.getInteger('amount', true);

    // Get player data
    const player = await db('players')
      .select('id', 'resources')
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

    // Get HQ level
    const hq = await db('buildings')
      .select('level')
      .where('player_id', player.id)
      .where('type', 'hq')
      .first();

    const hqLevel = hq?.level ?? 1;

    // Get barracks level
    const barracks = await db('buildings')
      .select('level')
      .where('player_id', player.id)
      .where('type', 'barracks')
      .first();

    if (!barracks) {
      await context.interaction.reply({
        content: '❌ You need to build a **Barracks** first! Use `/build building:barracks`',
        ephemeral: true,
      });
      return;
    }

    const config = TROOP_CONFIG[tier];

    // Check HQ requirement
    if (hqLevel < config.hqRequired) {
      await context.interaction.reply({
        content: `❌ You need **HQ Level ${config.hqRequired}** to train **T${tier} ${config.name}**.\nYour HQ is currently level ${hqLevel}.`,
        ephemeral: true,
      });
      return;
    }

    // Calculate total cost
    const totalCost = {
      food: config.cost.food * amount,
      iron: config.cost.iron * amount,
    };

    // Check resources
    if (resources.food < totalCost.food || resources.iron < totalCost.iron) {
      const maxAffordable = Math.min(
        Math.floor(resources.food / config.cost.food),
        Math.floor(resources.iron / config.cost.iron)
      );

      await context.interaction.reply({
        content: `❌ Not enough resources to train **${amount} T${tier} ${config.name}**!\n\n` +
          `**Required:**\n🌾 ${totalCost.food.toLocaleString()} Food\n⚒️ ${totalCost.iron.toLocaleString()} Iron\n\n` +
          `**You have:**\n🌾 ${resources.food.toLocaleString()} Food\n⚒️ ${resources.iron.toLocaleString()} Iron\n\n` +
          `💡 You can afford up to **${maxAffordable}** troops.`,
        ephemeral: true,
      });
      return;
    }

    // Calculate training time (for display purposes)
    const totalTime = config.trainTime * amount;

    // Deduct resources and add troops
    const newResources = {
      food: resources.food - totalCost.food,
      iron: resources.iron - totalCost.iron,
      gold: resources.gold,
    };

    await db.transaction(async (trx: Knex.Transaction) => {
      // Update player resources
      await trx('players')
        .where('id', player.id)
        .update({ resources: JSON.stringify(newResources) });

      // Add or update troops
      const existingTroops = await trx('troops')
        .select('count')
        .where('player_id', player.id)
        .where('tier', tier)
        .first();

      if (existingTroops) {
        await trx('troops')
          .where('player_id', player.id)
          .where('tier', tier)
          .update({ count: existingTroops.count + amount });
      } else {
        await trx('troops').insert({
          player_id: player.id,
          tier,
          count: amount,
          wounded: 0,
        });
      }
    });

    // Update daily quest progress for training troops
    await DailyQuestService.updateProgress(player.id, 'train_troops', amount);

    // Log activity
    await ActivityLogService.log(
      player.id,
      'train_troops',
      `Trained ${amount} T${tier} ${config.name}`,
      { food: -totalCost.food, iron: -totalCost.iron },
      { troopTier: tier, troopCount: amount }
    );

    // Format time display
    const hours = Math.floor(totalTime / 3600);
    const minutes = Math.floor((totalTime % 3600) / 60);
    const seconds = totalTime % 60;
    const timeStr = hours > 0 
      ? `${hours}h ${minutes}m ${seconds}s`
      : minutes > 0 
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

    // Create success embed
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Training ${config.name}`)
      .setDescription(`You are training **${amount.toLocaleString()} T${tier} ${config.name}**!`)
      .setColor('#00FF00')
      .addFields(
        { name: '💪 Power Added', value: `+${(config.power * amount).toLocaleString()}`, inline: true },
        { name: '⏱️ Training Time', value: timeStr, inline: true },
        { name: '💰 Cost', value: `🌾 ${totalCost.food.toLocaleString()}\n⚒️ ${totalCost.iron.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: `Troops are ready immediately for this MVP version` })
      .setTimestamp();

    await context.interaction.reply({ embeds: [embed] });
  },
};
