import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { SeasonService } from '../../../domain/services/SeasonService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { logger } from '../../../shared/utils/logger.js';

const seasonService = new SeasonService();

export const seasonCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('season')
    .setDescription('View and manage game seasons')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('View current season information')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('stats')
        .setDescription('View season statistics')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('history')
        .setDescription('View past seasons and Hall of Fame')
        .addIntegerOption((option) =>
          option
            .setName('season')
            .setDescription('Season number to view')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('summary')
        .setDescription('View your personal season summary')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('halloffame')
        .setDescription('View the Hall of Fame for a season')
        .addIntegerOption((option) =>
          option
            .setName('season')
            .setDescription('Season number (defaults to current)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('bonuses')
        .setDescription('View active season bonuses')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('wrapup')
        .setDescription('View your detailed season wrap-up')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('preview')
        .setDescription('Preview what\'s coming next season')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('celebration')
        .setDescription('View end-of-season celebration and awards')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Start a new season (Admin only)')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('end')
        .setDescription('End the current season (Admin only)')
    ),

  async execute(context: CommandContext) {
    const { interaction } = context;
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'info':
          await handleSeasonInfo(context);
          break;
        case 'stats':
          await handleSeasonStats(context);
          break;
        case 'history':
          await handleSeasonHistory(context);
          break;
        case 'summary':
          await handlePlayerSummary(context);
          break;
        case 'halloffame':
          await handleHallOfFame(context);
          break;
        case 'bonuses':
          await handleBonuses(context);
          break;
        case 'wrapup':
          await handleWrapUp(context);
          break;
        case 'preview':
          await handlePreview(context);
          break;
        case 'celebration':
          await handleCelebration(context);
          break;
        case 'start':
          await handleStartSeason(context);
          break;
        case 'end':
          await handleEndSeason(context);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
      }
    } catch (error) {
      logger.error('Season command error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
      }
    }
  },
};

async function handleSeasonInfo(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const season = await seasonService.getCurrentSeason();
  
  if (!season) {
    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🌙 No Active Season')
      .setDescription('There is currently no active season. An admin can start a new season with `/season start`.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const timeRemaining = await seasonService.getTimeRemaining();
  const isGracePeriod = await seasonService.isInGracePeriod();

  const embed = new EmbedBuilder()
    .setColor(isGracePeriod ? 0xFFD93D : 0x4ECDC4)
    .setTitle(`🏆 Season ${season.seasonNumber}`)
    .setDescription(
      isGracePeriod
        ? '⚠️ **Grace Period Active** - Season ending soon! Claim your rewards!'
        : 'The battle for supremacy continues...'
    )
    .addFields(
      {
        name: '📅 Started',
        value: `<t:${Math.floor(season.startsAt.getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: '🏁 Ends',
        value: `<t:${Math.floor(season.endsAt.getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: '⏰ Time Remaining',
        value: timeRemaining
          ? `${timeRemaining.days}d ${timeRemaining.hours}h ${timeRemaining.minutes}m`
          : 'Season ended',
        inline: true,
      }
    )
    .setFooter({ text: 'Use /season summary to see your progress' })
    .setTimestamp();

  if (isGracePeriod) {
    embed.addFields({
      name: '🎁 Grace Period Benefits',
      value: '• Claim any unclaimed rewards\n• Prepare for the new season\n• Your Diamonds and Prestige Points will be preserved!',
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleSeasonStats(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const season = await seasonService.getCurrentSeason();
  const stats = await seasonService.getSeasonStatistics();

  const factionEmojis: Record<string, string> = {
    cinema: '🎬',
    otaku: '🎌',
    arcade: '🎮',
  };

  const factionDistribution = Object.entries(stats.factionDistribution)
    .map(([faction, count]) => `${factionEmojis[faction] || '❓'} ${faction}: ${count}`)
    .join('\n');

  const topHeroesList = stats.topHeroes
    .slice(0, 5)
    .map((h, i) => `${i + 1}. ${h.name} (${h.count})`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x6C5CE7)
    .setTitle(`📊 Season ${season?.seasonNumber || '?'} Statistics`)
    .addFields(
      {
        name: '👥 Total Players',
        value: stats.totalPlayers.toLocaleString(),
        inline: true,
      },
      {
        name: '⚔️ Total Battles',
        value: stats.totalBattles.toLocaleString(),
        inline: true,
      },
      {
        name: '🏰 Conquest Events',
        value: stats.totalConquestEvents.toLocaleString(),
        inline: true,
      },
      {
        name: '🏠 Average HQ Level',
        value: stats.averageHqLevel.toFixed(1),
        inline: true,
      },
      {
        name: '⚔️ Faction Distribution',
        value: factionDistribution || 'No data',
        inline: false,
      },
      {
        name: '🦸 Most Popular Heroes',
        value: topHeroesList || 'No data',
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSeasonHistory(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const seasonNumber = interaction.options.getInteger('season');

  if (seasonNumber) {
    const season = await seasonService.getSeasonByNumber(seasonNumber);
    
    if (!season) {
      await interaction.editReply({ content: `❌ Season ${seasonNumber} not found.` });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(season.active ? 0x4ECDC4 : 0x95A5A6)
      .setTitle(`📜 Season ${season.seasonNumber}`)
      .addFields(
        {
          name: '📅 Duration',
          value: `${season.startsAt.toLocaleDateString()} - ${season.endsAt.toLocaleDateString()}`,
          inline: false,
        },
        {
          name: '🏆 Status',
          value: season.active ? '🟢 Active' : '⚫ Completed',
          inline: true,
        }
      )
      .setTimestamp();

    if (!season.active && season.hallOfFame.topPower.length > 0) {
      const topPower = season.hallOfFame.topPower
        .slice(0, 3)
        .map((p, i) => `${['🥇', '🥈', '🥉'][i]} ${p.username} (${p.score.toLocaleString()})`)
        .join('\n');

      embed.addFields({
        name: '💪 Top Power',
        value: topPower,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Show history list
  const seasons = await seasonService.getSeasonHistory(10);

  if (seasons.length === 0) {
    await interaction.editReply({ content: 'No season history available.' });
    return;
  }

  const seasonList = seasons
    .map((s) => {
      const status = s.active ? '🟢' : '⚫';
      return `${status} **Season ${s.seasonNumber}** - ${s.startsAt.toLocaleDateString()} to ${s.endsAt.toLocaleDateString()}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📜 Season History')
    .setDescription(seasonList)
    .setFooter({ text: 'Use /season history [number] to view details' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}


async function handlePlayerSummary(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply({ ephemeral: true });

  if (!playerId) {
    await interaction.editReply({
      content: '❌ You need to start playing first! Use `/begin` to create your empire.',
    });
    return;
  }

  const db = getDatabase();
  const player = await db('players').where('id', String(playerId)).first();

  if (!player) {
    await interaction.editReply({
      content: '❌ Player not found.',
    });
    return;
  }

  const summary = await seasonService.getPlayerSeasonSummary(String(playerId));
  const season = await seasonService.getCurrentSeason();

  const embed = new EmbedBuilder()
    .setColor(0xE17055)
    .setTitle(`📋 Your Season ${season?.seasonNumber || '?'} Summary`)
    .setDescription(`Here's how you're doing this season, **${player.username}**!`)
    .addFields(
      {
        name: '⭐ Prestige Points',
        value: summary.prestigePoints.toLocaleString(),
        inline: true,
      },
      {
        name: '💎 Estimated Diamond Reward',
        value: summary.estimatedRewards.diamonds.toLocaleString(),
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: '💪 Power Rank',
        value: summary.rank.power > 0 ? `#${summary.rank.power}` : 'Unranked',
        inline: true,
      },
      {
        name: '🏟️ Arena Rank',
        value: summary.rank.arena > 0 ? `#${summary.rank.arena}` : 'Unranked',
        inline: true,
      },
      {
        name: '🏰 Conquest Rank',
        value: summary.rank.conquest > 0 ? `#${summary.rank.conquest}` : 'Unranked',
        inline: true,
      }
    )
    .setTimestamp();

  if (summary.achievements.length > 0) {
    const achievementEmojis: Record<string, string> = {
      arena_legend: '🏆',
      arena_diamond: '💎',
      master_builder: '🏗️',
      city_architect: '🏛️',
      conquest_champion: '👑',
      conquest_veteran: '⚔️',
    };

    const achievementList = summary.achievements
      .map((a) => `${achievementEmojis[a] || '🎖️'} ${a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`)
      .join('\n');

    embed.addFields({
      name: '🎖️ Achievements',
      value: achievementList,
      inline: false,
    });
  }

  embed.addFields({
    name: '💡 Tip',
    value: 'Increase your prestige by leveling up your HQ, climbing Arena ranks, and participating in Conquest events!',
    inline: false,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleHallOfFame(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const seasonNumber = interaction.options.getInteger('season');
  let season;

  if (seasonNumber) {
    season = await seasonService.getSeasonByNumber(seasonNumber);
  } else {
    season = await seasonService.getCurrentSeason();
  }

  if (!season) {
    await interaction.editReply({ content: '❌ Season not found.' });
    return;
  }

  // For current season, build live Hall of Fame
  const hallOfFame = season.active
    ? await seasonService.buildHallOfFame()
    : season.hallOfFame;

  const formatLeaderboard = (entries: typeof hallOfFame.topPower) => {
    if (entries.length === 0) return 'No entries yet';
    return entries
      .slice(0, 5)
      .map((e, i) => {
        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
        return `${medal} **${e.username}** - ${e.score.toLocaleString()}`;
      })
      .join('\n');
  };

  const formatGuildLeaderboard = (entries: typeof hallOfFame.topGuilds) => {
    if (entries.length === 0) return 'No entries yet';
    return entries
      .slice(0, 5)
      .map((e, i) => {
        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
        return `${medal} **[${e.tag}] ${e.name}** - ${e.score.toLocaleString()}`;
      })
      .join('\n');
  };

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`🏆 Hall of Fame - Season ${season.seasonNumber}`)
    .setDescription(season.active ? '📊 Live standings' : '📜 Final standings')
    .addFields(
      {
        name: '💪 Top Power',
        value: formatLeaderboard(hallOfFame.topPower),
        inline: true,
      },
      {
        name: '🏟️ Top Arena',
        value: formatLeaderboard(hallOfFame.topArena),
        inline: true,
      },
      {
        name: '\u200B',
        value: '\u200B',
        inline: true,
      },
      {
        name: '🏰 Top Conquest',
        value: formatLeaderboard(hallOfFame.topConquest),
        inline: true,
      },
      {
        name: '⚔️ Top Guilds',
        value: formatGuildLeaderboard(hallOfFame.topGuilds),
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleBonuses(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const bonuses = await seasonService.getActiveBonuses();
  const season = await seasonService.getCurrentSeason();
  const inFinalWeek = await seasonService.isInFinalWeek();

  const embed = new EmbedBuilder()
    .setColor(inFinalWeek ? 0xFFD700 : 0x3498DB)
    .setTitle(inFinalWeek ? '🎉 Final Week Bonuses Active!' : '📊 Season Bonuses')
    .setDescription(
      inFinalWeek
        ? `Season ${season?.seasonNumber} is ending soon! Enjoy these special bonuses:`
        : 'Current active bonuses for this season:'
    )
    .setTimestamp();

  if (bonuses.description.length > 0) {
    embed.addFields({
      name: '✨ Active Bonuses',
      value: bonuses.description.join('\n'),
      inline: false,
    });

    embed.addFields(
      {
        name: '💎 Diamond Multiplier',
        value: bonuses.doubleDiamonds ? '2x' : '1x',
        inline: true,
      },
      {
        name: '⚡ XP Boost',
        value: `${bonuses.xpBoost}x`,
        inline: true,
      },
      {
        name: '🏠 Land Discount',
        value: bonuses.landSaleDiscount > 0 ? `${bonuses.landSaleDiscount * 100}% off` : 'None',
        inline: true,
      }
    );
  } else {
    embed.setDescription('No special bonuses are currently active. Check back during the final week of the season!');
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleWrapUp(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply({ ephemeral: true });

  if (!playerId) {
    await interaction.editReply({
      content: '❌ You need to start playing first! Use `/begin` to create your empire.',
    });
    return;
  }

  const wrapUp = await seasonService.getPlayerSeasonWrapUp(String(playerId));

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`📋 Season ${wrapUp.seasonNumber} Wrap-Up`)
    .setDescription('Your complete season journey at a glance!')
    .addFields(
      {
        name: '⚔️ Combat Stats',
        value: `Battles: ${wrapUp.totalBattles}\nWins: ${wrapUp.battlesWon}\nWin Rate: ${wrapUp.winRate}%`,
        inline: true,
      },
      {
        name: '🏟️ Arena',
        value: `Highest Rating: ${wrapUp.arenaHighestRating}\nRank: #${wrapUp.finalRanks.arena || 'Unranked'}`,
        inline: true,
      },
      {
        name: '🏰 Conquest',
        value: `Battles: ${wrapUp.conquestParticipation}\nRank: #${wrapUp.finalRanks.conquest || 'Unranked'}`,
        inline: true,
      },
      {
        name: '🦸 Heroes',
        value: `Recruited: ${wrapUp.heroesRecruited}${wrapUp.topHero ? `\nTop: ${wrapUp.topHero.name} (Lv.${wrapUp.topHero.level})` : ''}`,
        inline: true,
      },
      {
        name: '🏗️ Buildings',
        value: `Total Upgrades: ${wrapUp.buildingsUpgraded}`,
        inline: true,
      },
      {
        name: '🏠 Land',
        value: `Owned: ${wrapUp.landsOwned}`,
        inline: true,
      },
      {
        name: '💪 Power Rank',
        value: `#${wrapUp.finalRanks.power || 'Unranked'}`,
        inline: true,
      },
      {
        name: '🎖️ Achievements',
        value: `${wrapUp.achievements.length} earned`,
        inline: true,
      },
      {
        name: '💎 Estimated Rewards',
        value: `${wrapUp.estimatedRewards.diamonds} Diamonds\n${wrapUp.estimatedRewards.prestigePoints} Prestige`,
        inline: true,
      }
    )
    .setFooter({ text: 'Thanks for playing this season!' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handlePreview(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const preview = await seasonService.getSeasonPreview();

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`🔮 Season ${preview.nextSeasonNumber} Preview`)
    .setDescription('Get ready for the next season!')
    .addFields(
      {
        name: '📅 Estimated Start',
        value: `<t:${Math.floor(preview.estimatedStartDate.getTime() / 1000)}:F>`,
        inline: false,
      },
      {
        name: '✨ What\'s Coming',
        value: preview.newFeatures.join('\n'),
        inline: false,
      },
      {
        name: '💡 Preparation Tips',
        value: preview.tips.join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: 'Make the most of the remaining time!' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleCelebration(context: CommandContext) {
  const { interaction } = context;
  await interaction.deferReply();

  const celebration = await seasonService.getCelebrationData();
  const season = await seasonService.getCurrentSeason();

  const factionEmojis: Record<string, string> = {
    cinema: '🎬',
    otaku: '🎌',
    arcade: '🎮',
  };

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`🎊 Season ${season?.seasonNumber || '?'} Celebration!`)
    .setDescription('Celebrating the achievements of this season!')
    .addFields(
      {
        name: '📊 Season Highlights',
        value: [
          `👥 Total Players: ${celebration.seasonHighlights.totalPlayers.toLocaleString()}`,
          `⚔️ Total Battles: ${celebration.seasonHighlights.totalBattles.toLocaleString()}`,
          `${factionEmojis[celebration.seasonHighlights.mostPopularFaction] || '❓'} Most Popular Faction: ${celebration.seasonHighlights.mostPopularFaction}`,
          `🦸 Most Used Hero: ${celebration.seasonHighlights.mostUsedHero}`,
        ].join('\n'),
        inline: false,
      }
    )
    .setTimestamp();

  // Top Players
  if (celebration.topPlayers.length > 0) {
    const topPlayersList = celebration.topPlayers
      .map((p, i) => `${['🥇', '🥈', '🥉'][i]} ${factionEmojis[p.faction] || '❓'} **${p.username}** - ${p.score.toLocaleString()}`)
      .join('\n');

    embed.addFields({
      name: '👑 Top Players',
      value: topPlayersList,
      inline: true,
    });
  }

  // Top Guilds
  if (celebration.topGuilds.length > 0) {
    const topGuildsList = celebration.topGuilds
      .map((g, i) => `${['🥇', '🥈', '🥉'][i]} **[${g.tag}] ${g.name}** - ${g.score.toLocaleString()}`)
      .join('\n');

    embed.addFields({
      name: '⚔️ Top Guilds',
      value: topGuildsList,
      inline: true,
    });
  }

  // Special Awards
  if (celebration.specialAwards.length > 0) {
    const awardsList = celebration.specialAwards
      .map(a => `${a.title}\n└ **${a.username}**: ${a.description}`)
      .join('\n\n');

    embed.addFields({
      name: '🏆 Special Awards',
      value: awardsList,
      inline: false,
    });
  }

  embed.addFields({
    name: '🎉 Thank You!',
    value: 'Thanks to everyone who participated this season. See you in the next one!',
    inline: false,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleStartSeason(context: CommandContext) {
  const { interaction } = context;
  
  // Check admin permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions to start a new season.',
      ephemeral: true,
    });
    return;
  }

  const currentSeason = await seasonService.getCurrentSeason();

  if (currentSeason) {
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('⚠️ Active Season Detected')
      .setDescription(
        `Season ${currentSeason.seasonNumber} is currently active.\n\n` +
        '**Starting a new season will:**\n' +
        '• End the current season\n' +
        '• Distribute rewards to all players\n' +
        '• Reset all progress (except Diamonds & Prestige)\n' +
        '• Regenerate the map\n' +
        '• Recreate starter guilds\n\n' +
        '**Are you sure you want to proceed?**'
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('season_start_confirm')
        .setLabel('Start New Season')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('season_start_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
    return;
  }

  // No active season, start directly
  await interaction.deferReply();

  try {
    const newSeason = await seasonService.initializeNewSeason();

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🎉 New Season Started!')
      .setDescription(`**Season ${newSeason.seasonNumber}** has begun!`)
      .addFields(
        {
          name: '📅 Duration',
          value: `${newSeason.startsAt.toLocaleDateString()} - ${newSeason.endsAt.toLocaleDateString()}`,
          inline: false,
        },
        {
          name: '🔄 What\'s New',
          value: '• Fresh map generated\n• All progress reset\n• Starter guilds recreated\n• New opportunities await!',
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Announce to the server
    if (interaction.channel && 'send' in interaction.channel) {
      const announcementEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🏆 A New Season Begins!')
        .setDescription(
          `**Season ${newSeason.seasonNumber}** has officially started!\n\n` +
          '🎮 All empires have been reset\n' +
          '🗺️ A new world awaits exploration\n' +
          '⚔️ The battle for supremacy begins anew!\n\n' +
          'Use `/begin` to start your journey!'
        )
        .setTimestamp();

      await interaction.channel.send({ embeds: [announcementEmbed] });
    }
  } catch (error) {
    logger.error('Failed to start new season:', error);
    await interaction.editReply({
      content: '❌ Failed to start new season. Check the logs for details.',
    });
  }
}

async function handleEndSeason(context: CommandContext) {
  const { interaction } = context;
  
  // Check admin permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions to end a season.',
      ephemeral: true,
    });
    return;
  }

  const currentSeason = await seasonService.getCurrentSeason();

  if (!currentSeason) {
    await interaction.reply({
      content: '❌ There is no active season to end.',
      ephemeral: true,
    });
    return;
  }

  const confirmEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('⚠️ End Season Confirmation')
    .setDescription(
      `You are about to end **Season ${currentSeason.seasonNumber}**.\n\n` +
      '**This will:**\n' +
      '• Calculate and distribute rewards to all players\n' +
      '• Archive the Hall of Fame\n' +
      '• Mark the season as completed\n\n' +
      '**Note:** This does NOT reset player progress. Use `/season start` to begin a new season with a full reset.\n\n' +
      '**Are you sure you want to proceed?**'
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('season_end_confirm')
      .setLabel('End Season')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🏁'),
    new ButtonBuilder()
      .setCustomId('season_end_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });
}

// Button interaction handler
export async function handleSeasonButton(interaction: ButtonInteraction) {
  const { customId } = interaction;

  if (customId === 'season_start_confirm') {
    await interaction.deferUpdate();

    try {
      const newSeason = await seasonService.initializeNewSeason();

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎉 New Season Started!')
        .setDescription(`**Season ${newSeason.seasonNumber}** has begun!`)
        .addFields(
          {
            name: '📅 Duration',
            value: `${newSeason.startsAt.toLocaleDateString()} - ${newSeason.endsAt.toLocaleDateString()}`,
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], components: [] });

      // Announce to the server
      if (interaction.channel && 'send' in interaction.channel) {
        const announcementEmbed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('🏆 A New Season Begins!')
          .setDescription(
            `**Season ${newSeason.seasonNumber}** has officially started!\n\n` +
            '🎮 All empires have been reset\n' +
            '🗺️ A new world awaits exploration\n' +
            '⚔️ The battle for supremacy begins anew!\n\n' +
            'Use `/begin` to start your journey!'
          )
          .setTimestamp();

        await interaction.channel.send({ embeds: [announcementEmbed] });
      }
    } catch (error) {
      logger.error('Failed to start new season:', error);
      await interaction.editReply({
        content: '❌ Failed to start new season. Check the logs for details.',
        components: [],
      });
    }
  } else if (customId === 'season_start_cancel') {
    await interaction.update({
      content: '❌ Season start cancelled.',
      embeds: [],
      components: [],
    });
  } else if (customId === 'season_end_confirm') {
    await interaction.deferUpdate();

    try {
      const result = await seasonService.endSeason();

      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🏁 Season Ended!')
        .setDescription('The season has been successfully ended.')
        .addFields(
          {
            name: '🎁 Rewards Distributed',
            value: `${result.rewardsDistributed} players received their rewards`,
            inline: false,
          },
          {
            name: '🏆 Hall of Fame',
            value: 'Top players have been archived. Use `/season halloffame` to view.',
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], components: [] });

      // Announce to the server
      if (interaction.channel && 'send' in interaction.channel) {
        const announcementEmbed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle('🏁 Season Has Ended!')
          .setDescription(
            'The current season has come to a close!\n\n' +
            '🎁 Rewards have been distributed to all players\n' +
            '🏆 Check `/season halloffame` to see the champions\n' +
            '📊 Use `/season summary` to see your final stats\n\n' +
            'Stay tuned for the next season!'
          )
          .setTimestamp();

        await interaction.channel.send({ embeds: [announcementEmbed] });
      }
    } catch (error) {
      logger.error('Failed to end season:', error);
      await interaction.editReply({
        content: '❌ Failed to end season. Check the logs for details.',
        components: [],
      });
    }
  } else if (customId === 'season_end_cancel') {
    await interaction.update({
      content: '❌ Season end cancelled.',
      embeds: [],
      components: [],
    });
  }
}
