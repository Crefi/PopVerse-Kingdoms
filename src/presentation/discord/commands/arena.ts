import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { arenaService, ArenaOpponent } from '../../../domain/services/ArenaService.js';
import { Hero } from '../../../domain/entities/Hero.js';
import type { Faction, Element, HeroRarity } from '../../../shared/types/index.js';
import { ARENA_DAILY_FREE_ATTACKS, ARENA_MAX_TOKENS } from '../../../shared/constants/game.js';

interface HeroRow {
  id: string;
  player_id: string;
  name: string;
  faction: Faction;
  element: Element;
  rarity: HeroRarity;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  skills: string | object;
  gear: string | object;
  created_at: Date;
}

// Cache for pending arena attacks (opponent selection)
const pendingAttacks = new Map<string, ArenaOpponent[]>();

export const arenaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('arena')
    .setDescription('Arena PvP battles - fight other players for glory!')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View your arena status, rating, and tier')
    )
    .addSubcommand(sub =>
      sub.setName('defense')
        .setDescription('Set up your 3-hero defense team')
    )
    .addSubcommand(sub =>
      sub.setName('attack')
        .setDescription('Find opponents and battle in the arena')
    )
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('View the arena leaderboard')
    )
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('View recent attacks on your defense team')
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View detailed arena statistics')
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const subcommand = context.interaction.options.getSubcommand();
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players')
      .select('id', 'username', 'faction', 'arena_rating', 'arena_tokens')
      .where('discord_id', discordId)
      .first();

    if (!player) {
      await context.interaction.reply({
        content: '❌ Use `/begin` to start your journey first!',
        ephemeral: true,
      });
      return;
    }

    switch (subcommand) {
      case 'status':
        await handleStatus(context, player);
        break;
      case 'defense':
        await handleDefense(context, player);
        break;
      case 'attack':
        await handleAttack(context, player);
        break;
      case 'leaderboard':
        await handleLeaderboard(context);
        break;
      case 'log':
        await handleDefenseLog(context, player);
        break;
      case 'stats':
        await handleDetailedStats(context, player);
        break;
    }
  },
};

async function handleStatus(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction; arena_rating: number }
): Promise<void> {
  const stats = await arenaService.getPlayerStats(player.id);
  const tierInfo = arenaService.getTierInfo(stats.tier);
  const rewards = arenaService.getWeeklyRewards(stats.tier);
  const attackStatus = await arenaService.canAttack(player.id);

  const freeAttacksRemaining = ARENA_DAILY_FREE_ATTACKS - attackStatus.freeAttacksUsed;

  const embed = new EmbedBuilder()
    .setTitle('🏟️ Arena Status')
    .setColor(tierInfo.color)
    .setDescription(`**${player.username}**'s Arena Profile`)
    .addFields(
      {
        name: '🏆 Rank',
        value: `${tierInfo.emoji} **${tierInfo.name}**\n${stats.rating.toLocaleString()} points`,
        inline: true,
      },
      {
        name: '⚔️ Record',
        value: `**${stats.wins}**W / **${stats.losses}**L\n${stats.winRate}% win rate`,
        inline: true,
      },
      {
        name: '🎫 Attacks',
        value: `**${freeAttacksRemaining}** free today\n**${stats.tokens}**/${ARENA_MAX_TOKENS} tokens`,
        inline: true,
      },
      {
        name: '🎁 Weekly Rewards',
        value: `💎 ${rewards.diamonds} Diamonds\n⭐ ${rewards.heroShards} Hero Shards`,
        inline: true,
      }
    )
    .setFooter({ text: 'Use /arena attack to battle • /arena defense to set your team' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleDefense(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction }
): Promise<void> {
  const db = getDatabase();

  // Get player's heroes
  const heroes = await db('heroes')
    .select('*')
    .where('player_id', player.id)
    .orderBy('level', 'desc')
    .limit(25) as HeroRow[];

  if (heroes.length === 0) {
    await context.interaction.reply({
      content: '❌ You need at least one hero to set up a defense team! Use `/heroes` to see your collection.',
      ephemeral: true,
    });
    return;
  }

  // Get current defense team
  const currentDefense = await arenaService.getDefenseTeam(player.id);
  const currentHeroIds = [
    currentDefense.hero1?.id.toString(),
    currentDefense.hero2?.id.toString(),
    currentDefense.hero3?.id.toString(),
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Arena Defense Setup')
    .setColor(0x5865f2)
    .setDescription('Select up to 3 heroes for your defense team.\nThis team will fight automatically when others attack you.');

  if (currentDefense.hero1 || currentDefense.hero2 || currentDefense.hero3) {
    const currentTeam = [currentDefense.hero1, currentDefense.hero2, currentDefense.hero3]
      .filter((h): h is Hero => h !== null)
      .map(h => `${getRarityEmoji(h.rarity)} **${h.name}** (Lv.${h.level})`)
      .join('\n');
    
    embed.addFields({
      name: '📋 Current Defense Team',
      value: currentTeam || 'No team set',
      inline: false,
    });
  }

  // Create hero selection menu
  const heroOptions = heroes.slice(0, 25).map(h => ({
    label: `${h.name} (Lv.${h.level})`,
    description: `${h.rarity} • Power: ${calculateHeroPower(h)}`,
    value: h.id.toString(),
    emoji: getRarityEmoji(h.rarity as HeroRarity),
    default: currentHeroIds.includes(h.id.toString()),
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('arena:defense_select')
    .setPlaceholder('Select heroes for your defense team...')
    .setMinValues(1)
    .setMaxValues(Math.min(3, heroes.length))
    .addOptions(heroOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await context.interaction.reply({ embeds: [embed], components: [row] });
}

async function handleAttack(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction; arena_rating: number }
): Promise<void> {
  // Check if player can attack
  const attackStatus = await arenaService.canAttack(player.id);
  
  if (!attackStatus.canAttack) {
    await context.interaction.reply({
      content: '❌ You have no arena attacks remaining!\n\n🎫 Tokens regenerate 1 every 2 hours.\n⏰ Free attacks reset daily at midnight UTC.',
      ephemeral: true,
    });
    return;
  }

  // Check if player has heroes
  const db = getDatabase();
  const heroCount = await db('heroes')
    .where('player_id', player.id)
    .count('id as count')
    .first() as { count: string };

  if (parseInt(heroCount.count, 10) === 0) {
    await context.interaction.reply({
      content: '❌ You need at least one hero to battle in the arena!',
      ephemeral: true,
    });
    return;
  }

  await context.interaction.deferReply();

  // Find opponents
  const opponents = await arenaService.findOpponents(player.id, player.arena_rating);
  
  // Cache opponents for this user
  pendingAttacks.set(context.interaction.user.id, opponents);

  const freeRemaining = ARENA_DAILY_FREE_ATTACKS - attackStatus.freeAttacksUsed;

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Arena Opponents')
    .setColor(0xe74c3c)
    .setDescription(`Select an opponent to battle!\n\n🎫 **${freeRemaining}** free attacks | **${attackStatus.tokensRemaining}** tokens`);

  // Add opponent fields
  opponents.forEach((opp, idx) => {
    const tierInfo = arenaService.getTierInfo(arenaService.getTier(opp.rating));
    const heroList = opp.heroes.map(h => `${getRarityEmoji(h.rarity)} ${h.name} Lv.${h.level}`).join('\n');
    const botTag = opp.isBot ? ' [BOT]' : '';
    
    embed.addFields({
      name: `${idx + 1}. ${opp.username}${botTag}`,
      value: `${tierInfo.emoji} ${opp.rating} pts • ⚡ ${opp.power.toLocaleString()} power\n${heroList}`,
      inline: true,
    });
  });

  if (opponents.some(o => o.isBot)) {
    embed.setFooter({ text: '⚠️ Bot opponents give 50% reduced rewards' });
  }

  // Create opponent selection buttons
  const buttons = opponents.map((opp, idx) => 
    new ButtonBuilder()
      .setCustomId(`arena:fight:${idx}`)
      .setLabel(`${idx + 1}. ${opp.username.slice(0, 15)}`)
      .setStyle(opp.isBot ? ButtonStyle.Secondary : ButtonStyle.Primary)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  await context.interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleLeaderboard(context: CommandContext): Promise<void> {
  const leaderboard = await arenaService.getLeaderboard(10);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Arena Leaderboard')
    .setColor(0xffd700)
    .setDescription('Top 10 Arena Champions');

  const leaderboardText = leaderboard.map((entry, idx) => {
    const tierInfo = arenaService.getTierInfo(entry.tier);
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
    const factionEmoji = entry.faction === 'cinema' ? '🔴' : entry.faction === 'otaku' ? '🟢' : '🔵';
    
    return `${medal} ${factionEmoji} **${entry.username}** - ${tierInfo.emoji} ${entry.rating.toLocaleString()} pts`;
  }).join('\n');

  embed.addFields({
    name: 'Rankings',
    value: leaderboardText || 'No players ranked yet',
    inline: false,
  });

  embed.setFooter({ text: 'Weekly rewards distributed every Sunday at midnight UTC' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleDefenseLog(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction }
): Promise<void> {
  const defenseLog = await arenaService.getDefenseLog(player.id);

  const embed = new EmbedBuilder()
    .setTitle('📜 Defense Log')
    .setColor(0x9b59b6)
    .setDescription(`Recent attacks on **${player.username}**'s defense team`);

  if (defenseLog.length === 0) {
    embed.addFields({
      name: 'No Attacks Yet',
      value: 'Your defense team hasn\'t been attacked recently.\nSet up a strong defense with `/arena defense`!',
      inline: false,
    });
  } else {
    const logText = defenseLog.map(entry => {
      const resultEmoji = entry.result === 'win' ? '✅' : '❌';
      const factionEmoji = entry.attackerFaction === 'cinema' ? '🔴' : entry.attackerFaction === 'otaku' ? '🟢' : '🔵';
      const timeAgo = getTimeAgo(entry.timestamp);
      const ratingText = entry.result === 'win' ? `+${entry.ratingChange}` : '';
      
      return `${resultEmoji} ${factionEmoji} **${entry.attacker}** ${entry.result === 'win' ? 'failed' : 'won'} ${ratingText} • ${timeAgo}`;
    }).join('\n');

    embed.addFields({
      name: 'Recent Attacks (Last 10)',
      value: logText,
      inline: false,
    });

    // Calculate defense stats
    const wins = defenseLog.filter(e => e.result === 'win').length;
    const losses = defenseLog.filter(e => e.result === 'loss').length;
    
    embed.addFields({
      name: '📊 Recent Defense Record',
      value: `**${wins}** successful defenses | **${losses}** breaches`,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Tip: A strong defense team earns you rating even while offline!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleDetailedStats(
  context: CommandContext,
  player: { id: string; username: string; faction: Faction }
): Promise<void> {
  const stats = await arenaService.getDetailedStats(player.id);
  const tierInfo = arenaService.getTierInfo(stats.tier);

  const embed = new EmbedBuilder()
    .setTitle('📊 Detailed Arena Statistics')
    .setColor(tierInfo.color)
    .setDescription(`**${player.username}**'s complete arena profile`);

  embed.addFields(
    {
      name: '🏆 Current Rank',
      value: `${tierInfo.emoji} **${tierInfo.name}**\n${stats.rating.toLocaleString()} points`,
      inline: true,
    },
    {
      name: '⚔️ Offensive Record',
      value: `**${stats.wins}**W / **${stats.losses}**L\n${stats.winRate}% win rate`,
      inline: true,
    },
    {
      name: '🛡️ Defensive Record',
      value: `**${stats.defenseWins}**W / **${stats.defenseLosses}**L\n${stats.defenseWinRate}% defense rate`,
      inline: true,
    },
    {
      name: '🔥 Win Streaks',
      value: `Current: **${stats.currentStreak}**\nBest: **${stats.bestStreak}**`,
      inline: true,
    },
    {
      name: '📈 Total Battles',
      value: `**${stats.totalBattles}** arena battles`,
      inline: true,
    },
    {
      name: '🎫 Tokens',
      value: `**${stats.tokens}**/${ARENA_MAX_TOKENS}`,
      inline: true,
    }
  );

  // Add tier progression info
  const nextTier = getNextTier(stats.tier);
  if (nextTier) {
    const nextTierInfo = arenaService.getTierInfo(nextTier.tier);
    const pointsNeeded = nextTier.threshold - stats.rating;
    embed.addFields({
      name: '📍 Next Tier',
      value: `${nextTierInfo.emoji} **${nextTierInfo.name}** in **${pointsNeeded}** points`,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Keep battling to climb the ranks!' });

  await context.interaction.reply({ embeds: [embed] });
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

function getNextTier(currentTier: string): { tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend'; threshold: number } | null {
  const tiers: { tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend'; threshold: number }[] = [
    { tier: 'bronze', threshold: 0 },
    { tier: 'silver', threshold: 1000 },
    { tier: 'gold', threshold: 1500 },
    { tier: 'platinum', threshold: 2000 },
    { tier: 'diamond', threshold: 2500 },
    { tier: 'legend', threshold: 3000 },
  ];
  
  const currentIndex = tiers.findIndex(t => t.tier === currentTier);
  if (currentIndex === -1 || currentIndex === tiers.length - 1) return null;
  return tiers[currentIndex + 1];
}

// Button handler for arena fights
export async function handleArenaButton(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
): Promise<void> {
  if (action === 'fight') {
    await handleFightButton(interaction, params);
  } else if (action === 'confirm') {
    await handleConfirmBattle(interaction, params);
  } else if (action === 'new_battle') {
    await handleNewBattle(interaction);
  }
}

async function handleNewBattle(interaction: ButtonInteraction): Promise<void> {
  const db = getDatabase();
  
  const player = await db('players')
    .select('id', 'username', 'faction', 'arena_rating')
    .where('discord_id', interaction.user.id)
    .first();

  if (!player) {
    await interaction.reply({ content: '❌ Player not found.', ephemeral: true });
    return;
  }

  // Check if player can attack
  const attackStatus = await arenaService.canAttack(player.id);
  
  if (!attackStatus.canAttack) {
    await interaction.reply({
      content: '❌ You have no arena attacks remaining!\n\n🎫 Tokens regenerate 1 every 2 hours.\n⏰ Free attacks reset daily at midnight UTC.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  // Find opponents
  const opponents = await arenaService.findOpponents(player.id, player.arena_rating);
  
  // Cache opponents for this user
  pendingAttacks.set(interaction.user.id, opponents);

  const freeRemaining = ARENA_DAILY_FREE_ATTACKS - attackStatus.freeAttacksUsed;

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Arena Opponents')
    .setColor(0xe74c3c)
    .setDescription(`Select an opponent to battle!\n\n🎫 **${freeRemaining}** free attacks | **${attackStatus.tokensRemaining}** tokens`);

  // Add opponent fields
  opponents.forEach((opp, idx) => {
    const tierInfo = arenaService.getTierInfo(arenaService.getTier(opp.rating));
    const heroList = opp.heroes.map(h => `${getRarityEmoji(h.rarity)} ${h.name} Lv.${h.level}`).join('\n');
    const botTag = opp.isBot ? ' [BOT]' : '';
    
    embed.addFields({
      name: `${idx + 1}. ${opp.username}${botTag}`,
      value: `${tierInfo.emoji} ${opp.rating} pts • ⚡ ${opp.power.toLocaleString()} power\n${heroList}`,
      inline: true,
    });
  });

  if (opponents.some(o => o.isBot)) {
    embed.setFooter({ text: '⚠️ Bot opponents give 50% reduced rewards' });
  }

  // Create opponent selection buttons
  const buttons = opponents.map((opp, idx) => 
    new ButtonBuilder()
      .setCustomId(`arena:fight:${idx}`)
      .setLabel(`${idx + 1}. ${opp.username.slice(0, 15)}`)
      .setStyle(opp.isBot ? ButtonStyle.Secondary : ButtonStyle.Primary)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleFightButton(interaction: ButtonInteraction, params: string[]): Promise<void> {
  const opponentIndex = parseInt(params[0], 10);
  const opponents = pendingAttacks.get(interaction.user.id);

  if (!opponents || !opponents[opponentIndex]) {
    await interaction.reply({
      content: '❌ This battle session has expired. Use `/arena attack` to find new opponents.',
      ephemeral: true,
    });
    return;
  }

  const opponent = opponents[opponentIndex];
  const db = getDatabase();

  // Get player's heroes for team selection
  const player = await db('players')
    .select('id', 'faction')
    .where('discord_id', interaction.user.id)
    .first();

  if (!player) {
    await interaction.reply({ content: '❌ Player not found.', ephemeral: true });
    return;
  }

  const heroes = await db('heroes')
    .select('*')
    .where('player_id', player.id)
    .orderBy('level', 'desc')
    .limit(25) as HeroRow[];

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Select Your Attack Team')
    .setColor(0xe74c3c)
    .setDescription(`Battling **${opponent.username}**\n\nSelect up to 3 heroes for your attack team.`);

  const tierInfo = arenaService.getTierInfo(arenaService.getTier(opponent.rating));
  const heroList = opponent.heroes.map(h => `${getRarityEmoji(h.rarity)} ${h.name} Lv.${h.level}`).join('\n');

  embed.addFields({
    name: '🎯 Opponent',
    value: `${tierInfo.emoji} ${opponent.rating} pts • ⚡ ${opponent.power.toLocaleString()} power\n${heroList}`,
    inline: false,
  });

  // Create hero selection menu
  const heroOptions = heroes.slice(0, 25).map(h => ({
    label: `${h.name} (Lv.${h.level})`,
    description: `${h.rarity} • Power: ${calculateHeroPower(h)}`,
    value: h.id.toString(),
    emoji: getRarityEmoji(h.rarity as HeroRarity),
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`arena:team_select:${opponentIndex}`)
    .setPlaceholder('Select heroes for your attack team...')
    .setMinValues(1)
    .setMaxValues(Math.min(3, heroes.length))
    .addOptions(heroOptions);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleConfirmBattle(interaction: ButtonInteraction, _params: string[]): Promise<void> {
  // This is handled by the select menu now
  await interaction.reply({ content: 'Use the dropdown to select your team.', ephemeral: true });
}

// Select menu handler for arena
export async function handleArenaSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, action, ...params] = interaction.customId.split(':');

  if (action === 'defense_select') {
    await handleDefenseSelect(interaction);
  } else if (action === 'team_select') {
    await handleTeamSelect(interaction, params);
  }
}

async function handleDefenseSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectedHeroIds = interaction.values;
  const db = getDatabase();

  const player = await db('players')
    .select('id')
    .where('discord_id', interaction.user.id)
    .first();

  if (!player) {
    await interaction.reply({ content: '❌ Player not found.', ephemeral: true });
    return;
  }

  // Pad with nulls if less than 3 heroes selected
  const heroIds = [...selectedHeroIds, null, null, null].slice(0, 3);

  const result = await arenaService.setDefenseTeam(player.id, heroIds);

  if (!result.success) {
    await interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
    return;
  }

  // Get hero names for confirmation
  const heroes = await db('heroes')
    .select('name', 'level', 'rarity')
    .whereIn('id', selectedHeroIds) as { name: string; level: number; rarity: HeroRarity }[];

  const teamList = heroes.map(h => `${getRarityEmoji(h.rarity)} **${h.name}** (Lv.${h.level})`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('✅ Defense Team Updated!')
    .setColor(0x2ecc71)
    .setDescription('Your new defense team has been set.')
    .addFields({
      name: '🛡️ Defense Team',
      value: teamList,
      inline: false,
    })
    .setFooter({ text: 'This team will automatically defend when others attack you' });

  await interaction.update({ embeds: [embed], components: [] });
}

async function handleTeamSelect(interaction: StringSelectMenuInteraction, params: string[]): Promise<void> {
  const opponentIndex = parseInt(params[0], 10);
  const selectedHeroIds = interaction.values;
  const opponents = pendingAttacks.get(interaction.user.id);

  if (!opponents || !opponents[opponentIndex]) {
    await interaction.reply({
      content: '❌ This battle session has expired. Use `/arena attack` to find new opponents.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  const opponent = opponents[opponentIndex];
  const db = getDatabase();

  const player = await db('players')
    .select('id', 'faction')
    .where('discord_id', interaction.user.id)
    .first() as { id: string; faction: Faction };

  // Get selected heroes
  const heroRows = await db('heroes')
    .select('*')
    .whereIn('id', selectedHeroIds) as HeroRow[];

  const attackerHeroes = heroRows.map(h => rowToHero(h));

  try {
    // Execute the battle
    const result = await arenaService.executeBattle(
      player.id,
      player.faction,
      attackerHeroes,
      opponent
    );

    // Build result embed
    const isWin = result.winner === 'attacker';
    const embed = new EmbedBuilder()
      .setTitle(isWin ? '🎉 Victory!' : '💀 Defeat!')
      .setColor(isWin ? 0x2ecc71 : 0xe74c3c)
      .setDescription(`Battle against **${result.opponentName}**`);

    // Rating change
    const ratingEmoji = result.ratingChange >= 0 ? '📈' : '📉';
    const ratingText = result.ratingChange >= 0 ? `+${result.ratingChange}` : `${result.ratingChange}`;

    embed.addFields(
      {
        name: '🏆 Result',
        value: isWin ? 'You won the battle!' : 'You lost the battle.',
        inline: true,
      },
      {
        name: `${ratingEmoji} Rating`,
        value: `**${ratingText}** points`,
        inline: true,
      }
    );

    if (isWin) {
      embed.addFields(
        {
          name: '💎 Diamonds',
          value: `+${result.diamondsEarned}`,
          inline: true,
        },
        {
          name: '⭐ Hero XP',
          value: `+${result.heroXpGained}`,
          inline: true,
        }
      );
    }

    // Battle details
    const battleDetails = result.battleDetails;
    if (battleDetails.elementalAdvantage !== 'none') {
      const advText = battleDetails.elementalAdvantage === 'attacker' ? 'You had elemental advantage! (+25% damage)' : 'Enemy had elemental advantage! (+25% damage)';
      embed.addFields({
        name: '🔥 Elemental',
        value: advText,
        inline: false,
      });
    }

    if (battleDetails.skillsActivated.length > 0) {
      const skillText = battleDetails.skillsActivated
        .slice(0, 3)
        .map(s => `**${s.hero}**: ${s.skill}`)
        .join('\n');
      embed.addFields({
        name: '✨ Skills Activated',
        value: skillText,
        inline: false,
      });
    }

    // Clean up pending attacks
    pendingAttacks.delete(interaction.user.id);

    // Add button to battle again
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('arena:new_battle')
        .setLabel('Find New Opponents')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Arena battle error:', error);
    await interaction.editReply({
      content: '❌ An error occurred during the battle. Please try again.',
      embeds: [],
      components: [],
    });
  }
}

// Helper functions
function getRarityEmoji(rarity: HeroRarity): string {
  const emojis: Record<HeroRarity, string> = {
    common: '⚪',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟡',
  };
  return emojis[rarity];
}

function calculateHeroPower(hero: HeroRow): number {
  const levelBonus = (hero.level - 1) * 5;
  return Math.floor(hero.attack + hero.defense + hero.speed + hero.hp / 10 + levelBonus);
}

function rowToHero(row: HeroRow): Hero {
  return new Hero({
    id: BigInt(row.id),
    playerId: BigInt(row.player_id),
    name: row.name,
    faction: row.faction,
    element: row.element,
    rarity: row.rarity,
    level: row.level,
    experience: row.experience,
    attack: row.attack,
    defense: row.defense,
    speed: row.speed,
    hp: row.hp,
    skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills,
    gear: typeof row.gear === 'string' ? JSON.parse(row.gear) : row.gear,
    createdAt: row.created_at,
  });
}
