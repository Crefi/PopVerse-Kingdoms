import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import {
  researchService,
  RESEARCH_CATEGORIES,
  type ResearchCategory,
} from '../../../domain/services/ResearchService.js';

export const researchCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('research')
    .setDescription('Research technologies to improve your empire')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View all research categories and progress')
    )
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start researching a technology')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Research category to start')
            .setRequired(true)
            .addChoices(
              { name: '⚔️ Troop Training', value: 'troop_training' },
              { name: '📦 Resource Boost', value: 'resource_boost' },
              { name: '🏃 March Speed', value: 'march_speed' },
              { name: '💪 Combat Power', value: 'combat_power' },
              { name: '⭐ Hero XP Boost', value: 'hero_xp' },
              { name: '🎖️ Army Capacity', value: 'army_capacity' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel current research (no refund)')
    )
    .addSubcommand(sub =>
      sub.setName('bonuses')
        .setDescription('View your current research bonuses')
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View detailed info about a research category')
        .addStringOption(option =>
          option.setName('category')
            .setDescription('Research category to view')
            .setRequired(true)
            .addChoices(
              { name: '⚔️ Troop Training', value: 'troop_training' },
              { name: '📦 Resource Boost', value: 'resource_boost' },
              { name: '🏃 March Speed', value: 'march_speed' },
              { name: '💪 Combat Power', value: 'combat_power' },
              { name: '⭐ Hero XP Boost', value: 'hero_xp' },
              { name: '🎖️ Army Capacity', value: 'army_capacity' }
            )
        )
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const subcommand = context.interaction.options.getSubcommand();
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players')
      .select('id', 'username', 'resources')
      .where('discord_id', discordId)
      .first();

    if (!player) {
      await context.interaction.reply({ content: '❌ Use `/begin` to start!', ephemeral: true });
      return;
    }

    // Complete any finished research first
    const { completed } = await researchService.completeResearch(player.id);

    switch (subcommand) {
      case 'view':
        await handleView(context, player, completed);
        break;
      case 'start':
        await handleStart(context, player);
        break;
      case 'cancel':
        await handleCancel(context, player);
        break;
      case 'bonuses':
        await handleBonuses(context, player);
        break;
      case 'info':
        await handleInfo(context, player);
        break;
    }
  },
};

async function handleView(
  context: CommandContext,
  player: { id: string; username: string; resources: string | object },
  justCompleted: ResearchCategory[]
): Promise<void> {
  const research = await researchService.getPlayerResearch(player.id);
  const progress = await researchService.getTotalProgress(player.id);
  const resources = typeof player.resources === 'string'
    ? JSON.parse(player.resources)
    : player.resources;

  const embed = new EmbedBuilder()
    .setTitle('🔬 Research Lab')
    .setColor('#9B59B6')
    .setDescription(
      `**Progress:** ${progress.completed}/${progress.total} (${progress.percentage}%)\n` +
      `**Gold Available:** 💰 ${resources.gold.toLocaleString()}`
    );

  // Show completion notification
  if (justCompleted.length > 0) {
    const completedNames = justCompleted.map(c => RESEARCH_CATEGORIES[c].name).join(', ');
    embed.addFields({
      name: '🎉 Research Completed!',
      value: completedNames,
      inline: false,
    });
  }

  // Group research by status
  let activeResearch = '';
  let availableResearch = '';
  let maxedResearch = '';

  for (const r of research) {
    const config = RESEARCH_CATEGORIES[r.category];
    const levelStr = `${r.level}/${config.maxLevel}`;
    const progressBar = createProgressBar(r.level, config.maxLevel);

    if (r.researchCompletesAt && new Date(r.researchCompletesAt) > new Date()) {
      // Currently researching
      const timeLeft = researchService.formatTimeRemaining(new Date(r.researchCompletesAt));
      activeResearch += `${config.emoji} **${config.name}** [${levelStr}]\n`;
      activeResearch += `⏳ Completes in: ${timeLeft}\n\n`;
    } else if (r.level >= config.maxLevel) {
      // Maxed out
      maxedResearch += `${config.emoji} **${config.name}** ✅ MAX\n`;
    } else {
      // Available to research
      const nextCost = config.costs[r.level];
      const nextTime = config.times[r.level];
      const canAfford = resources.gold >= nextCost;
      const affordEmoji = canAfford ? '✅' : '❌';
      
      availableResearch += `${config.emoji} **${config.name}** [${levelStr}] ${progressBar}\n`;
      availableResearch += `   ${affordEmoji} Next: ${nextCost.toLocaleString()} Gold, ${nextTime}h\n`;
    }
  }

  if (activeResearch) {
    embed.addFields({ name: '🔄 In Progress', value: activeResearch, inline: false });
  }
  if (availableResearch) {
    embed.addFields({ name: '📚 Available', value: availableResearch, inline: false });
  }
  if (maxedResearch) {
    embed.addFields({ name: '🏆 Completed', value: maxedResearch, inline: false });
  }

  embed.setFooter({ text: 'Use /research start <category> to begin researching' });
  embed.setTimestamp();

  await context.interaction.reply({ embeds: [embed] });
}

async function handleStart(
  context: CommandContext,
  player: { id: string; username: string; resources: string | object }
): Promise<void> {
  const category = context.interaction.options.getString('category', true) as ResearchCategory;
  const config = RESEARCH_CATEGORIES[category];

  const result = await researchService.startResearch(player.id, category);

  if (!result.success) {
    await context.interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
    return;
  }

  const current = await researchService.getResearchCategory(player.id, category);
  const newLevel = current.level + 1;
  const effect = config.effects[current.level];

  let effectStr = '';
  switch (category) {
    case 'troop_training':
      effectStr = `-${Math.round(effect * 100)}% training time`;
      break;
    case 'resource_boost':
      effectStr = `+${Math.round(effect * 100)}% production`;
      break;
    case 'march_speed':
      effectStr = `+${Math.round(effect * 100)}% march speed`;
      break;
    case 'combat_power':
      effectStr = `+${Math.round(effect * 100)}% attack/defense`;
      break;
    case 'hero_xp':
      effectStr = `+${Math.round(effect * 100)}% hero XP`;
      break;
    case 'army_capacity':
      effectStr = `+${effect} troop capacity`;
      break;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} Research Started!`)
    .setColor('#00FF00')
    .setDescription(`**${config.name} ${newLevel}**`)
    .addFields(
      { name: '📊 Effect', value: effectStr, inline: true },
      { name: '⏰ Completes', value: `<t:${Math.floor(result.completesAt!.getTime() / 1000)}:R>`, inline: true }
    )
    .setTimestamp();

  await context.interaction.reply({ embeds: [embed] });
}

async function handleCancel(
  context: CommandContext,
  player: { id: string; username: string; resources: string | object }
): Promise<void> {
  const result = await researchService.cancelResearch(player.id);

  if (!result.success) {
    await context.interaction.reply({
      content: '❌ No active research to cancel!',
      ephemeral: true,
    });
    return;
  }

  const config = RESEARCH_CATEGORIES[result.cancelled!];

  await context.interaction.reply({
    content: `⚠️ Cancelled **${config.name}** research. No refund provided.`,
    ephemeral: true,
  });
}

async function handleBonuses(
  context: CommandContext,
  player: { id: string; username: string; resources: string | object }
): Promise<void> {
  const bonuses = await researchService.calculateBonuses(player.id);

  const embed = new EmbedBuilder()
    .setTitle('📊 Your Research Bonuses')
    .setColor('#3498DB')
    .addFields(
      {
        name: '⚔️ Troop Training',
        value: bonuses.troopTrainingSpeed < 1
          ? `-${Math.round((1 - bonuses.troopTrainingSpeed) * 100)}% training time`
          : 'No bonus',
        inline: true,
      },
      {
        name: '📦 Resource Production',
        value: bonuses.resourceProduction > 1
          ? `+${Math.round((bonuses.resourceProduction - 1) * 100)}% production`
          : 'No bonus',
        inline: true,
      },
      {
        name: '🏃 March Speed',
        value: bonuses.marchSpeed > 1
          ? `+${Math.round((bonuses.marchSpeed - 1) * 100)}% speed`
          : 'No bonus',
        inline: true,
      },
      {
        name: '💪 Combat Power',
        value: bonuses.combatPower > 1
          ? `+${Math.round((bonuses.combatPower - 1) * 100)}% attack/defense`
          : 'No bonus',
        inline: true,
      },
      {
        name: '⭐ Hero XP',
        value: bonuses.heroXpGain > 1
          ? `+${Math.round((bonuses.heroXpGain - 1) * 100)}% XP gain`
          : 'No bonus',
        inline: true,
      },
      {
        name: '🎖️ Army Capacity',
        value: bonuses.armyCapacity > 0
          ? `+${bonuses.armyCapacity} troops`
          : 'No bonus',
        inline: true,
      }
    )
    .setTimestamp();

  await context.interaction.reply({ embeds: [embed] });
}

async function handleInfo(
  context: CommandContext,
  player: { id: string; username: string; resources: string | object }
): Promise<void> {
  const category = context.interaction.options.getString('category', true) as ResearchCategory;
  const config = RESEARCH_CATEGORIES[category];
  const current = await researchService.getResearchCategory(player.id, category);
  const resources = typeof player.resources === 'string'
    ? JSON.parse(player.resources)
    : player.resources;

  const embed = new EmbedBuilder()
    .setTitle(`${config.emoji} ${config.name}`)
    .setColor('#9B59B6')
    .setDescription(config.description);

  // Show all levels
  let levelsStr = '';
  for (let i = 0; i < config.maxLevel; i++) {
    const level = i + 1;
    const effect = config.effects[i];
    const cost = config.costs[i];
    const time = config.times[i];

    let effectStr = '';
    switch (category) {
      case 'troop_training':
        effectStr = `-${Math.round(effect * 100)}%`;
        break;
      case 'resource_boost':
      case 'march_speed':
        effectStr = `+${Math.round(effect * 100)}%`;
        break;
      case 'combat_power':
        effectStr = `+${Math.round(effect * 100)}%`;
        break;
      case 'hero_xp':
        effectStr = `+${Math.round(effect * 100)}%`;
        break;
      case 'army_capacity':
        effectStr = `+${effect}`;
        break;
    }

    const isCompleted = current.level >= level;
    const isCurrent = current.level === i;
    const canAfford = resources.gold >= cost;

    let statusEmoji = '';
    if (isCompleted) {
      statusEmoji = '✅';
    } else if (isCurrent) {
      statusEmoji = canAfford ? '🔓' : '🔒';
    } else {
      statusEmoji = '⬜';
    }

    levelsStr += `${statusEmoji} **Level ${level}:** ${effectStr} | ${cost.toLocaleString()} Gold | ${time}h\n`;
  }

  embed.addFields(
    { name: '📈 Levels', value: levelsStr, inline: false },
    { name: '📊 Your Progress', value: `Level ${current.level}/${config.maxLevel}`, inline: true },
    { name: '💰 Your Gold', value: resources.gold.toLocaleString(), inline: true }
  );

  // Show current research status
  if (current.researchCompletesAt && new Date(current.researchCompletesAt) > new Date()) {
    embed.addFields({
      name: '⏳ In Progress',
      value: `Completes <t:${Math.floor(new Date(current.researchCompletesAt).getTime() / 1000)}:R>`,
      inline: false,
    });
  } else if (current.level < config.maxLevel) {
    const nextCost = config.costs[current.level];
    const canAfford = resources.gold >= nextCost;
    embed.addFields({
      name: '🔬 Next Level',
      value: canAfford
        ? `Ready to research! Use \`/research start ${category}\``
        : `Need ${(nextCost - resources.gold).toLocaleString()} more Gold`,
      inline: false,
    });
  }

  embed.setTimestamp();
  await context.interaction.reply({ embeds: [embed] });
}

function createProgressBar(current: number, max: number): string {
  const filled = '█';
  const empty = '░';
  const bar = filled.repeat(current) + empty.repeat(max - current);
  return `[${bar}]`;
}
