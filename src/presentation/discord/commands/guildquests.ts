import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { guildQuestService, type GuildQuestType } from '../../../domain/services/GuildQuestService.js';
import { guildService } from '../../../domain/services/GuildService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { Faction } from '../../../shared/types/index.js';

const FACTION_COLORS: Record<string, number> = {
  cinema: 0xe74c3c,
  otaku: 0x9b59b6,
  arcade: 0x3498db,
};

const QUEST_EMOJIS: Record<GuildQuestType, string> = {
  defeat_npcs: '⚔️',
  train_troops: '🎖️',
  win_arena: '🏟️',
  upgrade_buildings: '🏗️',
  gather_resources: '📦',
};

export const guildquestsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('guildquests')
    .setDescription('View and manage guild daily quests')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View today\'s guild quests')
    )
    .addSubcommand(sub =>
      sub.setName('claim')
        .setDescription('Claim rewards for a completed quest')
        .addIntegerOption(opt =>
          opt.setName('quest')
            .setDescription('Quest number to claim (1-3)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)
        )
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const subcommand = context.interaction.options.getSubcommand();
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players')
      .select('id', 'username', 'faction')
      .where('discord_id', discordId)
      .first() as { id: string; username: string; faction: Faction } | undefined;

    if (!player) {
      await context.interaction.reply({
        content: '❌ Use `/begin` to start your journey first!',
        ephemeral: true,
      });
      return;
    }

    // Check if player is in a guild
    const guild = await guildService.getPlayerGuild(player.id);
    if (!guild) {
      await context.interaction.reply({
        content: '❌ You must be in a guild to view guild quests.',
        ephemeral: true,
      });
      return;
    }

    switch (subcommand) {
      case 'view':
        await handleView(context, player, guild.id.toString());
        break;
      case 'claim':
        await handleClaim(context, player, guild.id.toString());
        break;
    }
  },
};

async function handleView(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction },
  guildId: string
): Promise<void> {
  const quests = await guildQuestService.getGuildQuests(guildId);

  const embed = new EmbedBuilder()
    .setTitle('📜 Guild Daily Quests')
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .setDescription('Complete quests together to earn guild rewards!');

  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    const emoji = QUEST_EMOJIS[quest.questType];
    const progressBar = createProgressBar(quest.progress, quest.target);
    const statusEmoji = quest.completed ? (quest.rewardsClaimed ? '✅' : '🎁') : '⏳';

    let rewardText = `💰 ${quest.rewards.gold} Gold | ⭐ ${quest.rewards.heroShards} Shards | 💎 ${quest.rewards.diamonds} Diamonds`;
    if (quest.rewardsClaimed) {
      rewardText = '~~' + rewardText + '~~ (Claimed)';
    }

    embed.addFields({
      name: `${statusEmoji} ${i + 1}. ${emoji} ${quest.name}`,
      value: [
        quest.description,
        `${progressBar} ${quest.progress}/${quest.target}`,
        rewardText,
        quest.topContributors.length > 0 
          ? `🏆 Top: ${quest.topContributors.slice(0, 3).map(c => `${c.username} (${c.contribution})`).join(', ')}`
          : '',
      ].filter(Boolean).join('\n'),
      inline: false,
    });
  }

  // Add claim buttons for completed but unclaimed quests
  const claimableQuests = quests.filter(q => q.completed && !q.rewardsClaimed);
  
  if (claimableQuests.length > 0) {
    const buttons = claimableQuests.map((quest) => {
      const questIndex = quests.indexOf(quest) + 1;
      return new ButtonBuilder()
        .setCustomId(`guildquest:claim:${quest.id}`)
        .setLabel(`Claim Quest ${questIndex}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎁');
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5));
    await context.interaction.reply({ embeds: [embed], components: [row] });
  } else {
    embed.setFooter({ text: 'Quests reset daily at midnight UTC' });
    await context.interaction.reply({ embeds: [embed] });
  }
}

async function handleClaim(
  context: CommandContext,
  _player: { id: string; username: string; faction: Faction },
  guildId: string
): Promise<void> {
  const questNumber = context.interaction.options.getInteger('quest', true);
  const quests = await guildQuestService.getGuildQuests(guildId);

  if (questNumber < 1 || questNumber > quests.length) {
    await context.interaction.reply({
      content: '❌ Invalid quest number.',
      ephemeral: true,
    });
    return;
  }

  const quest = quests[questNumber - 1];

  const result = await guildQuestService.claimRewards(guildId, quest.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎁 Quest Rewards Claimed!')
    .setColor(0x2ecc71)
    .setDescription(`**${quest.name}** completed!`)
    .addFields(
      {
        name: '💰 Guild Treasury',
        value: `+${quest.rewards.gold} Gold`,
        inline: true,
      },
      {
        name: '👥 Distributed to Contributors',
        value: `⭐ ${quest.rewards.heroShards} Hero Shards\n💎 ${quest.rewards.diamonds} Diamonds`,
        inline: true,
      }
    )
    .setFooter({ text: 'Rewards distributed proportionally based on contribution!' });

  await context.interaction.reply({ embeds: [embed] });
}

function createProgressBar(current: number, max: number): string {
  const percentage = Math.min(current / max, 1);
  const filled = Math.round(percentage * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Button handler for guild quest actions
export async function handleGuildQuestButton(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
): Promise<void> {
  if (action === 'claim') {
    const questId = params[0];
    const db = getDatabase();

    const player = await db('players')
      .select('id')
      .where('discord_id', interaction.user.id)
      .first();

    if (!player) {
      await interaction.reply({ content: '❌ Player not found.', ephemeral: true });
      return;
    }

    const guild = await guildService.getPlayerGuild(player.id);
    if (!guild) {
      await interaction.reply({ content: '❌ You are not in a guild.', ephemeral: true });
      return;
    }

    const result = await guildQuestService.claimRewards(guild.id.toString(), questId);

    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      return;
    }

    await interaction.reply({
      content: '🎁 Quest rewards claimed! Gold added to treasury, shards and diamonds distributed to contributors.',
      ephemeral: true,
    });

    // Update the original message to reflect claimed status
    try {
      await interaction.message.edit({ components: [] });
    } catch {
      // Ignore if we can't edit
    }
  }
}
