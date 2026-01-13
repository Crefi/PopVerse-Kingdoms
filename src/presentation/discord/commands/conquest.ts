import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { conquestService, ControlPoint } from '../../../domain/services/ConquestService.js';
import { combatService, type CombatContext } from '../../../domain/services/CombatService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { getRedis } from '../../../infrastructure/cache/redis.js';
import { logger } from '../../../shared/utils/logger.js';
import type { Faction, TroopTier } from '../../../shared/types/index.js';

const FACTION_EMOJIS: Record<Faction, string> = {
  cinema: '🔥',
  otaku: '🌀',
  arcade: '💧',
};

// Conquest rally constants
const CONQUEST_RALLY_JOIN_WINDOW_SECONDS = 60; // 1 minute join window
const CONQUEST_RALLY_MAX_PARTICIPANTS = 10;

interface ConquestRally {
  id: string;
  leaderId: string;
  leaderName: string;
  guildId: string;
  guildName: string;
  controlPointId: number;
  createdAt: number;
  expiresAt: number;
  participants: ConquestRallyParticipant[];
  launched: boolean;
}

interface ConquestRallyParticipant {
  playerId: string;
  username: string;
  faction: Faction;
  joinedAt: number;
  troops: { tier: number; count: number }[];
  power: number;
}

/**
 * Check if user has admin permissions
 */
function isAdmin(ctx: CommandContext): boolean {
  if (!ctx.interaction.guild) return false;
  
  const member = ctx.interaction.guild.members.cache.get(ctx.interaction.user.id);
  if (!member) return false;

  // Check if user is server owner or has Administrator permission
  return (
    ctx.interaction.guild.ownerId === ctx.interaction.user.id ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export const conquestCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('conquest')
    .setDescription('Manage Conquest events')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Start a new Conquest event (Admin only)')
        .addIntegerOption((option) =>
          option
            .setName('duration')
            .setDescription('Event duration in minutes (30-120, default: 60)')
            .setMinValue(30)
            .setMaxValue(120)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stop')
        .setDescription('Stop the current Conquest event early (Admin only)')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('View current Conquest event status and leaderboard')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('attack')
        .setDescription('Attack a Control Point')
        .addIntegerOption((option) =>
          option
            .setName('point')
            .setDescription('Control Point ID (1-5)')
            .setMinValue(1)
            .setMaxValue(5)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('rally')
        .setDescription('Start a guild rally to capture a Control Point together')
    ) as SlashCommandBuilder,

  async execute(ctx: CommandContext) {
    const subcommand = ctx.interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'start':
          await handleStart(ctx);
          break;
        case 'stop':
          await handleStop(ctx);
          break;
        case 'status':
          await handleStatus(ctx);
          break;
        case 'attack':
          await handleAttack(ctx);
          break;
        case 'rally':
          await handleRally(ctx);
          break;
        default:
          await ctx.interaction.reply({
            content: '❌ Unknown subcommand',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Conquest command error', { error, subcommand });
      
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      if (ctx.interaction.replied || ctx.interaction.deferred) {
        await ctx.interaction.followUp({
          content: `❌ ${errorMessage}`,
          ephemeral: true,
        });
      } else {
        await ctx.interaction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  },
};

async function handleStart(ctx: CommandContext): Promise<void> {
  // Check admin permissions
  if (!isAdmin(ctx)) {
    await ctx.interaction.reply({
      content: '❌ Only server administrators can start Conquest events!',
      ephemeral: true,
    });
    return;
  }

  await ctx.interaction.deferReply();

  const duration = ctx.interaction.options.getInteger('duration') || 60;

  const event = await conquestService.startEvent(duration);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ CONQUEST EVENT STARTED!')
    .setColor(0xff4444)
    .setDescription(
      `A new Conquest event has begun!\n\n` +
      `**Duration:** ${duration} minutes\n` +
      `**Ends:** <t:${Math.floor(event.endsAt.getTime() / 1000)}:R>\n\n` +
      `**Control Points:**`
    )
    .addFields(
      event.controlPoints.map((cp: ControlPoint) => ({
        name: `🏰 Point ${cp.id}`,
        value: `Location: (${cp.x}, ${cp.y})\nStatus: Uncaptured`,
        inline: true,
      }))
    )
    .setFooter({ text: 'Use /conquest attack <point> to capture Control Points!' })
    .setTimestamp();

  await ctx.interaction.editReply({ embeds: [embed] });

  // Announce in the channel
  if (ctx.interaction.channel && 'send' in ctx.interaction.channel) {
    const announcementEmbed = new EmbedBuilder()
      .setTitle('🚨 CONQUEST EVENT ALERT!')
      .setColor(0xff0000)
      .setDescription(
        `**A Conquest event has started!**\n\n` +
        `⏱️ Duration: ${duration} minutes\n` +
        `🏰 Control Points: ${event.controlPoints.length}\n\n` +
        `Capture and hold Control Points to earn points!\n` +
        `Top 10 players and Top 3 guilds will receive rewards!\n\n` +
        `Use \`/conquest status\` to view the leaderboard\n` +
        `Use \`/conquest attack <point>\` to capture a point`
      )
      .setTimestamp();

    await ctx.interaction.channel.send({ embeds: [announcementEmbed] });
  }
}

async function handleStop(ctx: CommandContext): Promise<void> {
  // Check admin permissions
  if (!isAdmin(ctx)) {
    await ctx.interaction.reply({
      content: '❌ Only server administrators can stop Conquest events!',
      ephemeral: true,
    });
    return;
  }

  await ctx.interaction.deferReply();

  const event = await conquestService.stopEvent();

  if (!event) {
    await ctx.interaction.editReply({
      content: '❌ No active Conquest event to stop',
    });
    return;
  }

  const status = await conquestService.getEventStatus();

  const embed = new EmbedBuilder()
    .setTitle('🏁 CONQUEST EVENT ENDED!')
    .setColor(0x00ff00)
    .setDescription(
      `The Conquest event has been stopped by an administrator.\n` +
      `Rewards have been distributed to the top players and guilds!`
    )
    .addFields(
      {
        name: '🏆 Top Players',
        value: status.leaderboard.players.length > 0
          ? status.leaderboard.players
              .slice(0, 5)
              .map((p: { username: string; score: number }, i: number) => 
                `${i + 1}. ${p.username} - ${p.score} pts`)
              .join('\n')
          : 'No participants',
        inline: true,
      },
      {
        name: '🛡️ Top Guilds',
        value: status.leaderboard.guilds.length > 0
          ? status.leaderboard.guilds
              .map((g: { name: string; score: number }, i: number) => 
                `${i + 1}. ${g.name} - ${g.score} pts`)
              .join('\n')
          : 'No guild participation',
        inline: true,
      }
    )
    .setTimestamp();

  await ctx.interaction.editReply({ embeds: [embed] });
}


async function handleStatus(ctx: CommandContext): Promise<void> {
  await ctx.interaction.deferReply();

  const status = await conquestService.getEventStatus();

  if (!status.active || !status.event) {
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Conquest Status')
      .setColor(0x888888)
      .setDescription(
        '**No active Conquest event**\n\n' +
        'Wait for a server administrator to start a new event!'
      )
      .setTimestamp();

    await ctx.interaction.editReply({ embeds: [embed] });
    return;
  }

  const timeRemainingMinutes = Math.ceil(status.timeRemaining / 60000);
  const timeRemainingSeconds = Math.ceil((status.timeRemaining % 60000) / 1000);

  // Ensure endsAt is a Date object (may be string from JSON cache)
  const endsAtDate = status.event.endsAt instanceof Date 
    ? status.event.endsAt 
    : new Date(status.event.endsAt);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ CONQUEST EVENT IN PROGRESS')
    .setColor(0xff4444)
    .setDescription(
      `**Time Remaining:** ${timeRemainingMinutes}m ${timeRemainingSeconds}s\n` +
      `**Ends:** <t:${Math.floor(endsAtDate.getTime() / 1000)}:R>`
    )
    .addFields(
      {
        name: '🏰 Control Points',
        value: status.event.controlPoints
          .map((cp: ControlPoint) => {
            const owner = cp.currentOwner || 'Uncaptured';
            const factionEmoji = cp.ownerFaction
              ? FACTION_EMOJIS[cp.ownerFaction as Faction] || '⚪'
              : '⚪';
            return `**Point ${cp.id}** (${cp.x}, ${cp.y}): ${factionEmoji} ${owner}`;
          })
          .join('\n'),
        inline: false,
      },
      {
        name: '🏆 Top Players',
        value: status.leaderboard.players.length > 0
          ? status.leaderboard.players
              .slice(0, 5)
              .map((p: { username: string; score: number }, i: number) => {
                const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
                return `${medal} ${p.username} - ${p.score} pts`;
              })
              .join('\n')
          : 'No scores yet',
        inline: true,
      },
      {
        name: '🛡️ Top Guilds',
        value: status.leaderboard.guilds.length > 0
          ? status.leaderboard.guilds
              .map((g: { name: string; score: number }, i: number) => {
                const medal = ['🥇', '🥈', '🥉'][i];
                return `${medal} ${g.name} - ${g.score} pts`;
              })
              .join('\n')
          : 'No guild scores yet',
        inline: true,
      }
    )
    .setFooter({ text: 'Use /conquest attack <point> to capture a Control Point!' })
    .setTimestamp();

  await ctx.interaction.editReply({ embeds: [embed] });
}

async function handleAttack(ctx: CommandContext): Promise<void> {
  await ctx.interaction.deferReply();

  const pointId = ctx.interaction.options.getInteger('point', true);

  // Get player from database
  const db = getDatabase();
  const player = await db('players')
    .where('discord_id', ctx.interaction.user.id)
    .first();

  if (!player) {
    await ctx.interaction.editReply({
      content: '❌ You need to register first! Use `/begin` to start playing.',
    });
    return;
  }

  const result = await conquestService.captureControlPoint(
    player.id.toString(),
    pointId
  );

  if (!result.success) {
    await ctx.interaction.editReply({
      content: `❌ ${result.message}`,
    });
    return;
  }

  const factionEmoji = FACTION_EMOJIS[player.faction as Faction] || '⚪';

  const embed = new EmbedBuilder()
    .setTitle('🏰 Control Point Captured!')
    .setColor(0x00ff00)
    .setDescription(
      `${factionEmoji} **${player.username}** has captured **Control Point ${pointId}**!\n\n` +
      `📍 Location: (${result.controlPoint?.x}, ${result.controlPoint?.y})\n` +
      `⏱️ Cooldown: 5 minutes before you can attack this point again\n\n` +
      `Hold the point to earn **1 point per minute**!`
    )
    .setTimestamp();

  await ctx.interaction.editReply({ embeds: [embed] });

  // Announce capture in channel
  if (ctx.interaction.channel && 'send' in ctx.interaction.channel) {
    const announceEmbed = new EmbedBuilder()
      .setTitle('⚔️ Control Point Captured!')
      .setColor(
        player.faction === 'cinema' ? 0xff4444 :
        player.faction === 'otaku' ? 0x44ff44 :
        0x4444ff
      )
      .setDescription(
        `${factionEmoji} **${player.username}** (${(player.faction as string).toUpperCase()}) ` +
        `has captured **Control Point ${pointId}**!`
      )
      .setTimestamp();

    await ctx.interaction.channel.send({ embeds: [announceEmbed] });
  }
}

// ==================== CONQUEST RALLY SYSTEM ====================

/**
 * Get rally cache key
 */
function getRallyCacheKey(guildId: string): string {
  return `conquest:rally:${guildId}`;
}

/**
 * Get or create a conquest rally from cache
 */
async function getConquestRally(guildId: string): Promise<ConquestRally | null> {
  const redis = getRedis();
  const cached = await redis.get(getRallyCacheKey(guildId));
  if (!cached) return null;
  
  const rally = JSON.parse(cached) as ConquestRally;
  
  // Check if rally has expired
  if (Date.now() > rally.expiresAt) {
    await redis.del(getRallyCacheKey(guildId));
    return null;
  }
  
  return rally;
}

/**
 * Save conquest rally to cache
 */
async function saveConquestRally(rally: ConquestRally): Promise<void> {
  const redis = getRedis();
  const ttl = Math.ceil((rally.expiresAt - Date.now()) / 1000);
  if (ttl > 0) {
    await redis.setex(getRallyCacheKey(rally.guildId), ttl + 10, JSON.stringify(rally));
  }
}

/**
 * Handle /conquest rally command - Show control point selection
 */
async function handleRally(ctx: CommandContext): Promise<void> {
  await ctx.interaction.deferReply();

  const db = getDatabase();

  // Get player
  const player = await db('players')
    .where('discord_id', ctx.interaction.user.id)
    .first();

  if (!player) {
    await ctx.interaction.editReply({
      content: '❌ You need to register first! Use `/begin` to start playing.',
    });
    return;
  }

  // Check if player is in a guild
  const membership = await db('guild_members')
    .select('guild_members.guild_id', 'guild_members.role', 'guilds.name as guild_name')
    .join('guilds', 'guild_members.guild_id', 'guilds.id')
    .where('guild_members.player_id', player.id)
    .first();

  if (!membership) {
    await ctx.interaction.editReply({
      content: '❌ You must be in a guild to start a conquest rally!\n\n' +
        '🛡️ **Conquest is a guild-focused event!** Join or create a guild to participate in rallies.',
    });
    return;
  }

  // Check if there's an active conquest event
  const event = await conquestService.getActiveEvent();
  if (!event) {
    await ctx.interaction.editReply({
      content: '❌ No active Conquest event. Wait for an admin to start one!',
    });
    return;
  }

  // Check if guild already has an active rally
  const existingRally = await getConquestRally(membership.guild_id.toString());
  if (existingRally && !existingRally.launched) {
    await ctx.interaction.editReply({
      content: '❌ Your guild already has an active rally! Wait for it to launch or expire.',
    });
    return;
  }

  // Build control point select menu
  const selectOptions = event.controlPoints.map((cp: ControlPoint) => {
    const ownerInfo = cp.currentOwner 
      ? `Owner: ${cp.currentOwner}` 
      : 'Uncaptured';
    const factionEmoji = cp.ownerFaction 
      ? FACTION_EMOJIS[cp.ownerFaction as Faction] || '⚪' 
      : '⚪';
    
    return {
      label: `Control Point ${cp.id}`,
      description: `(${cp.x}, ${cp.y}) - ${ownerInfo}`,
      value: cp.id.toString(),
      emoji: factionEmoji,
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`conquest_rally_select:${ctx.interaction.user.id}`)
    .setPlaceholder('Select a Control Point to rally')
    .addOptions(selectOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`conquest_rally_cancel:${ctx.interaction.user.id}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

  // Build preview embed
  const embed = new EmbedBuilder()
    .setTitle('🛡️ Start Guild Conquest Rally')
    .setColor(0xff8800)
    .setDescription(
      `**${membership.guild_name}** is preparing a rally!\n\n` +
      `Select a Control Point to rally your guild members for a coordinated attack.\n\n` +
      `⚔️ **Troops required!** You and your guild members will commit troops to battle for the control point.`
    )
    .addFields({
      name: '🏰 Control Points',
      value: event.controlPoints.map((cp: ControlPoint) => {
        const factionEmoji = cp.ownerFaction 
          ? FACTION_EMOJIS[cp.ownerFaction as Faction] || '⚪' 
          : '⚪';
        const owner = cp.currentOwner || 'Uncaptured';
        return `**Point ${cp.id}** (${cp.x}, ${cp.y}) - ${factionEmoji} ${owner}`;
      }).join('\n'),
      inline: false,
    })
    .setFooter({ text: 'Select a control point below to start the rally' })
    .setTimestamp();

  const response = await ctx.interaction.editReply({
    embeds: [embed],
    components: [row, buttonRow],
  });

  // Set up collector for the select menu
  const collector = response.createMessageComponentCollector({
    time: 60000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== ctx.interaction.user.id) {
      await i.reply({ content: '❌ This is not your rally!', flags: 64 });
      return;
    }

    if (i.isButton() && i.customId === `conquest_rally_cancel:${ctx.interaction.user.id}`) {
      await i.update({
        content: '❌ Rally cancelled.',
        embeds: [],
        components: [],
      });
      collector.stop();
      return;
    }

    if (i.isStringSelectMenu() && i.customId === `conquest_rally_select:${ctx.interaction.user.id}`) {
      const pointId = parseInt(i.values[0]);
      await createRally(i, player, membership, event, pointId);
      collector.stop();
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      ctx.interaction.editReply({
        content: '❌ Rally selection timed out. Please try again.',
        embeds: [],
        components: [],
      }).catch(() => {});
    }
  });
}

/**
 * Create the actual rally after control point selection
 */
async function createRally(
  interaction: StringSelectMenuInteraction,
  player: { id: string; username: string; faction: Faction },
  membership: { guild_id: string; guild_name: string; role: string },
  event: { controlPoints: ControlPoint[] },
  pointId: number
): Promise<void> {
  await interaction.deferUpdate();

  // Find the control point
  const controlPoint = event.controlPoints.find((cp: ControlPoint) => cp.id === pointId);
  if (!controlPoint) {
    await interaction.editReply({
      content: `❌ Control Point ${pointId} not found!`,
      embeds: [],
      components: [],
    });
    return;
  }

  // Get player's troops
  const db = getDatabase();
  const playerTroops = await db('troops')
    .select('tier', 'count')
    .where('player_id', player.id);

  const totalTroops = playerTroops.reduce((sum: number, t: { count: number }) => sum + t.count, 0);
  if (totalTroops === 0) {
    await interaction.editReply({
      content: '❌ You have no troops! Train some troops first with `/train`.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Create new rally (leader will add troops in next step)
  const now = Date.now();
  const rally: ConquestRally = {
    id: `${membership.guild_id}-${now}`,
    leaderId: player.id.toString(),
    leaderName: player.username,
    guildId: membership.guild_id.toString(),
    guildName: membership.guild_name,
    controlPointId: pointId,
    createdAt: now,
    expiresAt: now + CONQUEST_RALLY_JOIN_WINDOW_SECONDS * 1000,
    participants: [], // Leader will be added after troop selection
    launched: false,
  };

  await saveConquestRally(rally);

  // Show troop selection for the leader
  await showTroopSelection(interaction, rally, player, controlPoint, playerTroops, true);
}

/**
 * Build rally embed with current state
 */
function buildRallyEmbed(rally: ConquestRally, controlPoint: ControlPoint): EmbedBuilder {
  const expiresTimestamp = Math.floor(rally.expiresAt / 1000);
  const leaderEmoji = FACTION_EMOJIS[rally.participants[0]?.faction as Faction] || '⚪';
  const totalPower = rally.participants.reduce((sum, p) => sum + (p.power || 0), 0);

  return new EmbedBuilder()
    .setTitle('🛡️ GUILD CONQUEST RALLY')
    .setColor(rally.launched ? 0x00ff00 : 0xff8800)
    .setDescription(
      rally.launched
        ? `**Rally has been launched!** 🚀\n\nAll participants are attacking **Control Point ${rally.controlPointId}**!`
        : `**${leaderEmoji} ${rally.leaderName}** is rallying **${rally.guildName}** to capture **Control Point ${rally.controlPointId}**!\n\n` +
          `📍 **Target:** Point ${rally.controlPointId} (${controlPoint.x}, ${controlPoint.y})\n` +
          `👥 **Current Owner:** ${controlPoint.currentOwner || 'Uncaptured'}\n` +
          `⚔️ **Total Rally Power:** ${totalPower.toLocaleString()}\n\n` +
          `⏱️ **Rally expires:** <t:${expiresTimestamp}:R>\n\n` +
          `**Guild members, join the rally with your troops!**`
    )
    .addFields({
      name: `⚔️ Participants (${rally.participants.length}/${CONQUEST_RALLY_MAX_PARTICIPANTS})`,
      value: rally.participants.length > 0 
        ? rally.participants.map(p => {
            const emoji = FACTION_EMOJIS[p.faction] || '⚪';
            const isLeader = p.playerId === rally.leaderId ? ' 👑' : '';
            const troopInfo = p.troops?.length > 0 
              ? ` (${p.troops.map(t => `T${t.tier}:${t.count}`).join(', ')})`
              : '';
            return `${emoji} ${p.username}${isLeader} - ⚔️ ${p.power?.toLocaleString() || 0}${troopInfo}`;
          }).join('\n')
        : 'Waiting for leader to select troops...',
      inline: false,
    })
    .setFooter({ text: rally.launched ? 'Rally launched!' : 'Rally leader can click "Send Rally" to launch!' })
    .setTimestamp();
}

/**
 * Calculate troop power
 */
function calculateTroopPower(troops: { tier: number; count: number }[]): number {
  const tierPower: Record<number, number> = { 1: 10, 2: 25, 3: 50, 4: 100 };
  return troops.reduce((sum, t) => sum + (tierPower[t.tier] ?? 10) * t.count, 0);
}

/**
 * Show troop selection UI for joining rally
 */
async function showTroopSelection(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  rally: ConquestRally,
  player: { id: string; username: string; faction: Faction },
  controlPoint: ControlPoint,
  playerTroops: { tier: number; count: number }[],
  isLeader: boolean
): Promise<void> {
  // Build troop selection buttons (quick select options)
  const availableTroops = playerTroops.filter(t => t.count > 0);
  
  if (availableTroops.length === 0) {
    await interaction.editReply({
      content: '❌ You have no troops available! Train some with `/train`.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Create preset buttons for quick troop selection
  const presetButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`conquest_rally_troops:${rally.id}:25:${player.id}`)
      .setLabel('Send 25%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_troops:${rally.id}:50:${player.id}`)
      .setLabel('Send 50%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_troops:${rally.id}:100:${player.id}`)
      .setLabel('Send All')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_cancel:${rally.id}:${player.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  // Calculate power for each preset
  const totalPower = calculateTroopPower(availableTroops);
  
  const embed = new EmbedBuilder()
    .setTitle(isLeader ? '🛡️ Start Conquest Rally - Select Troops' : '⚔️ Join Conquest Rally - Select Troops')
    .setColor(0xff8800)
    .setDescription(
      `**Target:** Control Point ${rally.controlPointId} (${controlPoint.x}, ${controlPoint.y})\n` +
      `**Owner:** ${controlPoint.currentOwner || 'Uncaptured'}\n\n` +
      `Select how many troops to send to the rally:`
    )
    .addFields(
      {
        name: '🪖 Your Available Troops',
        value: availableTroops.map(t => `**T${t.tier}:** ${t.count.toLocaleString()}`).join('\n'),
        inline: true,
      },
      {
        name: '⚔️ Total Power',
        value: totalPower.toLocaleString(),
        inline: true,
      }
    )
    .setFooter({ text: 'Choose a preset or your troops will be committed to the rally' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [presetButtons] });
}

/**
 * Handle conquest rally button interactions
 */
export async function handleConquestRallyButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const actionPart = parts[0].replace('conquest_rally_', '');
  const rallyId = parts[1];
  const extraParam = parts[2]; // percentage or playerId depending on action
  const targetPlayerId = parts[3]; // for troop selection
  
  const db = getDatabase();

  // Get player
  const player = await db('players')
    .where('discord_id', interaction.user.id)
    .first();

  if (!player) {
    await interaction.reply({
      content: '❌ You need to register first! Use `/begin` to start playing.',
      ephemeral: true,
    });
    return;
  }

  // Handle cancel during troop selection (before rally is fully created)
  if (actionPart === 'cancel' && extraParam) {
    // This is cancel during troop selection
    if (extraParam !== player.id.toString()) {
      await interaction.reply({
        content: '❌ This is not your selection!',
        ephemeral: true,
      });
      return;
    }
    
    // Delete the rally if it exists and has no participants
    const guildId = rallyId.split('-')[0];
    const rally = await getConquestRally(guildId);
    if (rally && rally.participants.length === 0 && rally.leaderId === player.id.toString()) {
      const redis = getRedis();
      await redis.del(getRallyCacheKey(guildId));
    }
    
    await interaction.update({
      content: '❌ Rally cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Handle troop percentage selection
  if (actionPart === 'troops') {
    const percentage = parseInt(extraParam);
    const forPlayerId = targetPlayerId;
    
    if (forPlayerId !== player.id.toString()) {
      await interaction.reply({
        content: '❌ This is not your troop selection!',
        ephemeral: true,
      });
      return;
    }
    
    await handleTroopSelection(interaction, rallyId, player, percentage);
    return;
  }

  // Extract guild ID from rally ID for other actions
  const guildId = rallyId.split('-')[0];
  const rally = await getConquestRally(guildId);

  if (!rally) {
    await interaction.reply({
      content: '❌ This rally has expired or been completed.',
      ephemeral: true,
    });
    return;
  }

  // Get active event and control point
  const event = await conquestService.getActiveEvent();
  if (!event) {
    await interaction.reply({
      content: '❌ The Conquest event has ended.',
      ephemeral: true,
    });
    return;
  }

  const controlPoint = event.controlPoints.find((cp: ControlPoint) => cp.id === rally.controlPointId);
  if (!controlPoint) {
    await interaction.reply({
      content: '❌ Control point not found.',
      ephemeral: true,
    });
    return;
  }

  switch (actionPart) {
    case 'join':
      await handleRallyJoin(interaction, rally, player, controlPoint);
      break;
    case 'send':
      await handleRallySend(interaction, rally, player, controlPoint);
      break;
    case 'refresh':
      await handleRallyRefresh(interaction, rally, controlPoint);
      break;
    default:
      await interaction.reply({
        content: '❌ Unknown action.',
        ephemeral: true,
      });
  }
}

/**
 * Handle troop percentage selection
 */
async function handleTroopSelection(
  interaction: ButtonInteraction,
  rallyId: string,
  player: { id: string; username: string; faction: Faction },
  percentage: number
): Promise<void> {
  const db = getDatabase();
  const guildId = rallyId.split('-')[0];
  const rally = await getConquestRally(guildId);

  if (!rally) {
    await interaction.reply({
      content: '❌ This rally has expired.',
      ephemeral: true,
    });
    return;
  }

  // Get player's troops
  const playerTroops = await db('troops')
    .select('tier', 'count')
    .where('player_id', player.id);

  // Calculate troops to send based on percentage
  const troopsToSend: { tier: number; count: number }[] = [];
  for (const troop of playerTroops) {
    const count = Math.floor(troop.count * (percentage / 100));
    if (count > 0) {
      troopsToSend.push({ tier: troop.tier, count });
    }
  }

  if (troopsToSend.length === 0) {
    await interaction.reply({
      content: '❌ No troops to send!',
      ephemeral: true,
    });
    return;
  }

  const power = calculateTroopPower(troopsToSend);

  // Deduct troops from player
  for (const troop of troopsToSend) {
    await db('troops')
      .where('player_id', player.id)
      .where('tier', troop.tier)
      .decrement('count', troop.count);
  }

  // Add participant to rally
  rally.participants.push({
    playerId: player.id.toString(),
    username: player.username,
    faction: player.faction,
    joinedAt: Date.now(),
    troops: troopsToSend,
    power,
  });

  await saveConquestRally(rally);

  // Get control point for embed
  const event = await conquestService.getActiveEvent();
  const controlPoint = event?.controlPoints.find((cp: ControlPoint) => cp.id === rally.controlPointId);

  if (!controlPoint) {
    await interaction.reply({
      content: '❌ Control point not found.',
      ephemeral: true,
    });
    return;
  }

  // Show the rally embed with buttons
  const embed = buildRallyEmbed(rally, controlPoint);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`conquest_rally_join:${rally.id}`)
      .setLabel('Join Rally')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚔️'),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_send:${rally.id}`)
      .setLabel('Send Rally')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_refresh:${rally.id}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
  );

  await interaction.update({ embeds: [embed], components: [row] });

  // Announce if this is the leader starting the rally
  if (player.id.toString() === rally.leaderId && rally.participants.length === 1) {
    if (interaction.channel && 'send' in interaction.channel) {
      const announceEmbed = new EmbedBuilder()
        .setTitle('📢 CONQUEST RALLY STARTED!')
        .setColor(0xff8800)
        .setDescription(
          `**${rally.guildName}** is rallying to capture **Control Point ${rally.controlPointId}**!\n\n` +
          `🎯 Target: (${controlPoint.x}, ${controlPoint.y})\n` +
          `⚔️ Rally Power: ${power.toLocaleString()}\n\n` +
          `Guild members: Click "Join Rally" to add your troops!`
        )
        .setTimestamp();

      await interaction.channel.send({ embeds: [announceEmbed] });
    }
  }
}

/**
 * Handle Join Rally button
 */
async function handleRallyJoin(
  interaction: ButtonInteraction,
  rally: ConquestRally,
  player: { id: string; username: string; faction: Faction; guild_id?: string },
  controlPoint: ControlPoint
): Promise<void> {
  const db = getDatabase();

  // Check if rally is already launched
  if (rally.launched) {
    await interaction.reply({
      content: '❌ This rally has already been launched!',
      ephemeral: true,
    });
    return;
  }

  // Check if player is in the same guild
  const membership = await db('guild_members')
    .where('player_id', player.id)
    .first();

  if (!membership || membership.guild_id.toString() !== rally.guildId) {
    await interaction.reply({
      content: '❌ You must be in the same guild to join this rally!',
      ephemeral: true,
    });
    return;
  }

  // Check if already participating
  if (rally.participants.some(p => p.playerId === player.id.toString())) {
    await interaction.reply({
      content: '✅ You are already in this rally!',
      ephemeral: true,
    });
    return;
  }

  // Check participant limit
  if (rally.participants.length >= CONQUEST_RALLY_MAX_PARTICIPANTS) {
    await interaction.reply({
      content: `❌ Rally is full! (${CONQUEST_RALLY_MAX_PARTICIPANTS} max participants)`,
      ephemeral: true,
    });
    return;
  }

  // Get player's troops
  const playerTroops = await db('troops')
    .select('tier', 'count')
    .where('player_id', player.id);

  const totalTroops = playerTroops.reduce((sum: number, t: { count: number }) => sum + t.count, 0);
  if (totalTroops === 0) {
    await interaction.reply({
      content: '❌ You have no troops! Train some troops first with `/train`.',
      ephemeral: true,
    });
    return;
  }

  // Show troop selection UI
  await interaction.deferUpdate();
  await showTroopSelection(interaction, rally, player, controlPoint, playerTroops, false);
}

/**
 * Handle Send Rally button (launch the rally)
 */
async function handleRallySend(
  interaction: ButtonInteraction,
  rally: ConquestRally,
  player: { id: string; username: string; faction: Faction },
  controlPoint: ControlPoint
): Promise<void> {
  // Only leader can send
  if (player.id.toString() !== rally.leaderId) {
    await interaction.reply({
      content: '❌ Only the rally leader can send the rally!',
      ephemeral: true,
    });
    return;
  }

  if (rally.launched) {
    await interaction.reply({
      content: '❌ This rally has already been launched!',
      ephemeral: true,
    });
    return;
  }

  if (rally.participants.length === 0) {
    await interaction.reply({
      content: '❌ No participants in the rally yet!',
      ephemeral: true,
    });
    return;
  }

  // Mark as launched
  rally.launched = true;
  await saveConquestRally(rally);

  const db = getDatabase();

  // Combine all troops from participants
  const combinedTroops: Map<TroopTier, number> = new Map();
  for (const participant of rally.participants) {
    for (const troop of participant.troops || []) {
      const current = combinedTroops.get(troop.tier as TroopTier) || 0;
      combinedTroops.set(troop.tier as TroopTier, current + troop.count);
    }
  }

  const attackerTroops = Array.from(combinedTroops.entries()).map(([tier, count]) => ({ tier, count }));
  const totalAttackerPower = calculateTroopPower(attackerTroops);

  // Determine defender
  let defenderTroops: { tier: TroopTier; count: number }[] = [];
  let defenderPower = 0;
  let defenderName = 'Uncaptured';
  let battleResult: { winner: 'attacker' | 'defender'; attackerCasualties: { dead: { tier: TroopTier; count: number }[]; wounded: { tier: TroopTier; count: number }[] } } | null = null;

  if (controlPoint.ownerId) {
    // Control point is owned by another player - battle their garrison
    defenderName = controlPoint.currentOwner || 'Unknown';
    
    // Get defender's troops (use 50% of their troops as garrison)
    const defenderTroopRows = await db('troops')
      .select('tier', 'count')
      .where('player_id', controlPoint.ownerId);
    
    defenderTroops = defenderTroopRows.map((t: { tier: number; count: number }) => ({
      tier: t.tier as TroopTier,
      count: Math.floor(t.count * 0.5), // 50% garrison
    })).filter((t: { count: number }) => t.count > 0);
    
    defenderPower = calculateTroopPower(defenderTroops);

    // Execute combat if there are defenders
    if (defenderTroops.length > 0) {
      const combatContext: CombatContext = {
        battleType: 'conquest',
        location: { x: controlPoint.x, y: controlPoint.y },
        attacker: {
          playerId: BigInt(rally.leaderId),
          faction: rally.participants[0]?.faction || 'cinema',
          hero: null,
          troops: attackerTroops,
        },
        defender: {
          playerId: BigInt(controlPoint.ownerId),
          npcId: null,
          faction: controlPoint.ownerFaction as Faction || null,
          hero: null,
          troops: defenderTroops,
          resources: { food: 0, iron: 0, gold: 0 },
        },
        terrainBonus: 1.0,
        seed: Date.now(),
      };

      battleResult = combatService.resolveBattle(combatContext);
    }
  } else {
    // Uncaptured point - NPC garrison
    defenderName = 'NPC Garrison';
    defenderTroops = [
      { tier: 1 as TroopTier, count: 50 },
      { tier: 2 as TroopTier, count: 25 },
    ];
    defenderPower = calculateTroopPower(defenderTroops);

    const combatContext: CombatContext = {
      battleType: 'conquest',
      location: { x: controlPoint.x, y: controlPoint.y },
      attacker: {
        playerId: BigInt(rally.leaderId),
        faction: rally.participants[0]?.faction || 'cinema',
        hero: null,
        troops: attackerTroops,
      },
      defender: {
        playerId: null,
        npcId: BigInt(controlPoint.id),
        faction: null,
        hero: null,
        troops: defenderTroops,
        resources: { food: 0, iron: 0, gold: 0 },
      },
      terrainBonus: 1.0,
      seed: Date.now(),
    };

    battleResult = combatService.resolveBattle(combatContext);
  }

  // Process battle results
  const attackerWon = !battleResult || battleResult.winner === 'attacker';
  const results: string[] = [];

  // Distribute casualties proportionally among participants
  const totalTroopsSent = attackerTroops.reduce((sum, t) => sum + t.count, 0);

  for (const participant of rally.participants) {
    const pTroops = participant.troops || [];
    const pTotalTroops = pTroops.reduce((sum, t) => sum + t.count, 0);
    const proportion = totalTroopsSent > 0 ? pTotalTroops / totalTroopsSent : 0;

    const emoji = FACTION_EMOJIS[participant.faction] || '⚪';

    if (battleResult) {
      // Calculate this participant's casualties
      let deadCount = 0;
      let woundedCount = 0;

      for (const troop of pTroops) {
        const deadForTier = battleResult.attackerCasualties.dead.find(d => d.tier === troop.tier)?.count || 0;
        const woundedForTier = battleResult.attackerCasualties.wounded.find(w => w.tier === troop.tier)?.count || 0;
        
        const pDeadShare = Math.floor(deadForTier * proportion);
        const pWoundedShare = Math.floor(woundedForTier * proportion);
        
        deadCount += pDeadShare;
        woundedCount += pWoundedShare;

        // Return surviving troops
        const surviving = Math.max(0, troop.count - pDeadShare - pWoundedShare);
        if (surviving > 0) {
          await db('troops')
            .where('player_id', participant.playerId)
            .where('tier', troop.tier)
            .increment('count', surviving);
        }

        // Add wounded to hospital
        if (pWoundedShare > 0) {
          await db('troops')
            .where('player_id', participant.playerId)
            .where('tier', troop.tier)
            .increment('wounded', pWoundedShare);
        }
      }

      if (attackerWon) {
        results.push(`${emoji} **${participant.username}** - ✅ Victory! (💀 ${deadCount} dead, 🏥 ${woundedCount} wounded)`);
      } else {
        results.push(`${emoji} **${participant.username}** - ❌ Defeated (💀 ${deadCount} dead, 🏥 ${woundedCount} wounded)`);
      }
    } else {
      // No battle (undefended point) - return all troops
      for (const troop of pTroops) {
        await db('troops')
          .where('player_id', participant.playerId)
          .where('tier', troop.tier)
          .increment('count', troop.count);
      }
      results.push(`${emoji} **${participant.username}** - ✅ Captured! (No resistance)`);
    }
  }

  // If attackers won, capture the point
  if (attackerWon) {
    await conquestService.captureControlPoint(rally.leaderId, rally.controlPointId);
  }

  // Update embed to show results
  const embed = new EmbedBuilder()
    .setTitle(attackerWon ? '🚀 RALLY VICTORY!' : '💀 RALLY DEFEATED!')
    .setColor(attackerWon ? 0x00ff00 : 0xff0000)
    .setDescription(
      `**${rally.guildName}** ${attackerWon ? 'captured' : 'failed to capture'} **Control Point ${rally.controlPointId}**!\n\n` +
      `📍 Location: (${controlPoint.x}, ${controlPoint.y})\n` +
      `⚔️ Rally Power: ${totalAttackerPower.toLocaleString()} vs ${defenderPower.toLocaleString()} (${defenderName})`
    )
    .addFields(
      {
        name: '⚔️ Battle Results',
        value: results.join('\n') || 'No participants',
        inline: false,
      }
    )
    .setTimestamp();

  // Disable buttons
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`conquest_rally_done:${rally.id}`)
      .setLabel(attackerWon ? 'Victory!' : 'Defeated')
      .setStyle(attackerWon ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true),
  );

  await interaction.update({ embeds: [embed], components: [row] });

  // Announce in channel
  if (interaction.channel && 'send' in interaction.channel) {
    const announceEmbed = new EmbedBuilder()
      .setTitle(attackerWon ? '⚔️ CONQUEST RALLY VICTORY!' : '💀 CONQUEST RALLY DEFEATED!')
      .setColor(attackerWon ? 0x00ff00 : 0xff0000)
      .setDescription(
        `**${rally.guildName}** (${rally.participants.length} members) ${attackerWon ? 'captured' : 'failed to capture'} **Control Point ${rally.controlPointId}**!\n\n` +
        `⚔️ ${totalAttackerPower.toLocaleString()} vs ${defenderPower.toLocaleString()}`
      )
      .setTimestamp();

    await interaction.channel.send({ embeds: [announceEmbed] });
  }
}

/**
 * Handle Refresh button
 */
async function handleRallyRefresh(
  interaction: ButtonInteraction,
  rally: ConquestRally,
  controlPoint: ControlPoint
): Promise<void> {
  if (rally.launched) {
    await interaction.reply({
      content: 'This rally has already been launched.',
      ephemeral: true,
    });
    return;
  }

  const embed = buildRallyEmbed(rally, controlPoint);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`conquest_rally_join:${rally.id}`)
      .setLabel('Join Rally')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚔️'),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_send:${rally.id}`)
      .setLabel('Send Rally')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚀'),
    new ButtonBuilder()
      .setCustomId(`conquest_rally_refresh:${rally.id}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

/**
 * Handle conquest rally select menu interactions
 */
export async function handleConquestRallySelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const [action] = interaction.customId.split(':');
  
  // conquest_rally_select is handled by the collector in handleRally, not here
  // This function only handles other select menus like troop selection if added later
  if (action === 'conquest_rally_troops') {
    // Future: handle troop tier selection if we add a select menu for it
    await interaction.reply({
      content: '❌ This selection has expired. Please use `/conquest rally` again.',
      ephemeral: true,
    });
    return;
  }
  
  // For any other conquest rally select menus
  await interaction.reply({
    content: '❌ This selection has expired. Please use `/conquest rally` again.',
    ephemeral: true,
  });
}
