import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { rallyService, RALLY_JOIN_WINDOW_MINUTES, RALLY_MAX_PARTICIPANTS } from '../../../domain/services/RallyService.js';
import { guildService } from '../../../domain/services/GuildService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { Faction, TroopTier } from '../../../shared/types/index.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';

const FACTION_COLORS: Record<string, number> = {
  cinema: 0xe74c3c,
  otaku: 0x9b59b6,
  arcade: 0x3498db,
};

export const rallyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('rally')
    .setDescription('Guild rally commands - coordinate attacks with your guild')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a rally attack (Leader/Officer only)')
        .addIntegerOption(opt =>
          opt.setName('x')
            .setDescription('Target X coordinate')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(MAP_SIZE - 1)
        )
        .addIntegerOption(opt =>
          opt.setName('y')
            .setDescription('Target Y coordinate')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(MAP_SIZE - 1)
        )
        .addStringOption(opt =>
          opt.setName('hero')
            .setDescription('Hero to lead the rally')
        )
        .addIntegerOption(opt =>
          opt.setName('t1')
            .setDescription('T1 troops to send')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('t2')
            .setDescription('T2 troops to send')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('t3')
            .setDescription('T3 troops to send')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('t4')
            .setDescription('T4 troops to send')
            .setMinValue(0)
        )
    )
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Join your guild\'s active rally')
        .addStringOption(opt =>
          opt.setName('hero')
            .setDescription('Hero to send')
        )
        .addIntegerOption(opt =>
          opt.setName('t1')
            .setDescription('T1 troops to send')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('t2')
            .setDescription('T2 troops to send')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('t3')
            .setDescription('T3 troops to send')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('t4')
            .setDescription('T4 troops to send')
            .setMinValue(0)
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View your guild\'s active rally')
    )
    .addSubcommand(sub =>
      sub.setName('cancel')
        .setDescription('Cancel the active rally (Rally leader only)')
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
        content: '❌ You must be in a guild to use rally commands.',
        ephemeral: true,
      });
      return;
    }

    switch (subcommand) {
      case 'start':
        await handleStart(context, player, guild.id.toString());
        break;
      case 'join':
        await handleJoin(context, player, guild.id.toString());
        break;
      case 'status':
        await handleStatus(context, player, guild.id.toString());
        break;
      case 'cancel':
        await handleCancel(context, player);
        break;
    }
  },
};

async function handleStart(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction },
  _guildId: string
): Promise<void> {
  const db = getDatabase();
  const targetX = context.interaction.options.getInteger('x', true);
  const targetY = context.interaction.options.getInteger('y', true);
  const heroName = context.interaction.options.getString('hero');

  // Get troops
  const t1 = context.interaction.options.getInteger('t1') || 0;
  const t2 = context.interaction.options.getInteger('t2') || 0;
  const t3 = context.interaction.options.getInteger('t3') || 0;
  const t4 = context.interaction.options.getInteger('t4') || 0;

  const troops: { tier: TroopTier; count: number }[] = [];
  if (t1 > 0) troops.push({ tier: 1, count: t1 });
  if (t2 > 0) troops.push({ tier: 2, count: t2 });
  if (t3 > 0) troops.push({ tier: 3, count: t3 });
  if (t4 > 0) troops.push({ tier: 4, count: t4 });

  if (troops.length === 0) {
    await context.interaction.reply({
      content: '❌ You must send at least some troops! Use t1, t2, t3, or t4 options.',
      ephemeral: true,
    });
    return;
  }

  // Get hero ID if specified
  let heroId: string | null = null;
  if (heroName) {
    const hero = await db('heroes')
      .select('id')
      .where('player_id', player.id)
      .whereRaw('LOWER(name) LIKE ?', [`%${heroName.toLowerCase()}%`])
      .first();

    if (!hero) {
      await context.interaction.reply({
        content: `❌ Hero "${heroName}" not found in your roster.`,
        ephemeral: true,
      });
      return;
    }
    heroId = hero.id.toString();
  }

  const result = await rallyService.startRally(player.id, targetX, targetY, heroId, troops);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const rally = result.rally!;
  const launchTime = Math.floor(new Date(rally.launchesAt).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Rally Started!')
    .setColor(FACTION_COLORS[player.faction] || 0xe74c3c)
    .setDescription(`**${player.username}** has started a rally attack!`)
    .addFields(
      {
        name: '🎯 Target',
        value: `**${rally.targetName}** at (${rally.targetX}, ${rally.targetY})\n⚡ Power: ${rally.targetPower.toLocaleString()}`,
        inline: true,
      },
      {
        name: '⏰ Launches',
        value: `<t:${launchTime}:R>`,
        inline: true,
      },
      {
        name: '👥 Participants',
        value: `${rally.participants.length}/${RALLY_MAX_PARTICIPANTS}`,
        inline: true,
      }
    )
    .addFields({
      name: '📋 Your Contribution',
      value: troops.map(t => `T${t.tier}: ${t.count}`).join(' | '),
      inline: false,
    })
    .setFooter({ text: `Guild members have ${RALLY_JOIN_WINDOW_MINUTES} minutes to join!` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rally:join:${rally.id}`)
      .setLabel('Join Rally')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚔️')
  );

  await context.interaction.reply({ embeds: [embed], components: [row] });
}

async function handleJoin(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction },
  guildId: string
): Promise<void> {
  const db = getDatabase();
  const heroName = context.interaction.options.getString('hero');

  // Get troops
  const t1 = context.interaction.options.getInteger('t1') || 0;
  const t2 = context.interaction.options.getInteger('t2') || 0;
  const t3 = context.interaction.options.getInteger('t3') || 0;
  const t4 = context.interaction.options.getInteger('t4') || 0;

  const troops: { tier: TroopTier; count: number }[] = [];
  if (t1 > 0) troops.push({ tier: 1, count: t1 });
  if (t2 > 0) troops.push({ tier: 2, count: t2 });
  if (t3 > 0) troops.push({ tier: 3, count: t3 });
  if (t4 > 0) troops.push({ tier: 4, count: t4 });

  if (troops.length === 0) {
    await context.interaction.reply({
      content: '❌ You must send at least some troops! Use t1, t2, t3, or t4 options.',
      ephemeral: true,
    });
    return;
  }

  // Get active rally
  const rally = await rallyService.getActiveRally(guildId);
  if (!rally) {
    await context.interaction.reply({
      content: '❌ Your guild has no active rally. Ask a leader or officer to start one!',
      ephemeral: true,
    });
    return;
  }

  // Get hero ID if specified
  let heroId: string | null = null;
  if (heroName) {
    const hero = await db('heroes')
      .select('id')
      .where('player_id', player.id)
      .whereRaw('LOWER(name) LIKE ?', [`%${heroName.toLowerCase()}%`])
      .first();

    if (!hero) {
      await context.interaction.reply({
        content: `❌ Hero "${heroName}" not found in your roster.`,
        ephemeral: true,
      });
      return;
    }
    heroId = hero.id.toString();
  }

  const result = await rallyService.joinRally(player.id, rally.id, heroId, troops);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const updatedRally = result.rally!;
  const launchTime = Math.floor(new Date(updatedRally.launchesAt).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setTitle('✅ Joined Rally!')
    .setColor(0x2ecc71)
    .setDescription(`You have joined the rally against **${updatedRally.targetName}**!`)
    .addFields(
      {
        name: '📋 Your Contribution',
        value: troops.map(t => `T${t.tier}: ${t.count}`).join(' | '),
        inline: true,
      },
      {
        name: '⏰ Launches',
        value: `<t:${launchTime}:R>`,
        inline: true,
      },
      {
        name: '⚡ Total Power',
        value: updatedRally.totalPower.toLocaleString(),
        inline: true,
      }
    )
    .addFields({
      name: '👥 Participants',
      value: updatedRally.participants.map(p => 
        `${p.username}: ${p.troops.map(t => `T${t.tier}×${t.count}`).join(', ')}`
      ).join('\n'),
      inline: false,
    });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleStatus(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction },
  guildId: string
): Promise<void> {
  const rally = await rallyService.getActiveRally(guildId);

  if (!rally) {
    await context.interaction.reply({
      content: '❌ Your guild has no active rally.',
      ephemeral: true,
    });
    return;
  }

  const launchTime = Math.floor(new Date(rally.launchesAt).getTime() / 1000);
  const powerRatio = rally.totalPower / rally.targetPower;
  const powerEmoji = powerRatio >= 1.5 ? '🟢' : powerRatio >= 1.0 ? '🟡' : '🔴';

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Active Rally')
    .setColor(FACTION_COLORS[player.faction] || 0xe74c3c)
    .setDescription(`Rally led by **${rally.leaderName}**`)
    .addFields(
      {
        name: '🎯 Target',
        value: `**${rally.targetName}** at (${rally.targetX}, ${rally.targetY})\n⚡ Power: ${rally.targetPower.toLocaleString()}`,
        inline: true,
      },
      {
        name: '⏰ Launches',
        value: `<t:${launchTime}:R>`,
        inline: true,
      },
      {
        name: `${powerEmoji} Rally Power`,
        value: `${rally.totalPower.toLocaleString()} (${Math.round(powerRatio * 100)}% of target)`,
        inline: true,
      }
    )
    .addFields({
      name: `👥 Participants (${rally.participants.length}/${RALLY_MAX_PARTICIPANTS})`,
      value: rally.participants.map(p => {
        const heroText = p.heroName ? ` [${p.heroName}]` : '';
        return `**${p.username}**${heroText}: ${p.troops.map(t => `T${t.tier}×${t.count}`).join(', ')} (⚡${p.power})`;
      }).join('\n') || 'No participants yet',
      inline: false,
    });

  const isParticipating = rally.participants.some(p => p.playerId === player.id);

  const buttons: ButtonBuilder[] = [];
  if (!isParticipating) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rally:join:${rally.id}`)
        .setLabel('Join Rally')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️')
    );
  }

  if (rally.leaderId === player.id) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rally:cancel:${rally.id}`)
        .setLabel('Cancel Rally')
        .setStyle(ButtonStyle.Danger)
    );
  }

  const components = buttons.length > 0 
    ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)]
    : [];

  await context.interaction.reply({ embeds: [embed], components });
}

async function handleCancel(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction }
): Promise<void> {
  const guild = await guildService.getPlayerGuild(player.id);
  if (!guild) {
    await context.interaction.reply({
      content: '❌ You are not in a guild.',
      ephemeral: true,
    });
    return;
  }

  const rally = await rallyService.getActiveRally(guild.id.toString());
  if (!rally) {
    await context.interaction.reply({
      content: '❌ Your guild has no active rally.',
      ephemeral: true,
    });
    return;
  }

  const result = await rallyService.cancelRally(player.id, rally.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🚫 Rally Cancelled')
    .setColor(0xf39c12)
    .setDescription('The rally has been cancelled. All troops have been returned to participants.');

  await context.interaction.reply({ embeds: [embed] });
}

// Button handler for rally actions
export async function handleRallyButton(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
): Promise<void> {
  if (action === 'join') {
    await interaction.reply({
      content: '⚔️ Use `/rally join` with your troop counts to join the rally!',
      ephemeral: true,
    });
  } else if (action === 'cancel') {
    const db = getDatabase();
    const player = await db('players')
      .select('id')
      .where('discord_id', interaction.user.id)
      .first();

    if (!player) {
      await interaction.reply({ content: '❌ Player not found.', ephemeral: true });
      return;
    }

    const rallyId = params[0];
    const result = await rallyService.cancelRally(player.id, rallyId);

    if (!result.success) {
      await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      return;
    }

    await interaction.update({
      content: '🚫 Rally has been cancelled. All troops returned.',
      embeds: [],
      components: [],
    });
  }
}
