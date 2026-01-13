import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { PrestigeService, type CosmeticType } from '../../../domain/services/PrestigeService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { logger } from '../../../shared/utils/logger.js';

const prestigeService = new PrestigeService();

const RARITY_EMOJIS: Record<string, string> = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡',
};

const TYPE_EMOJIS: Record<string, string> = {
  city_skin: '🏰',
  profile_badge: '🎖️',
  title: '👑',
  guild_banner: '🚩',
};

export const prestigeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('prestige')
    .setDescription('View and manage your prestige, achievements, and cosmetics')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('profile')
        .setDescription('View your prestige profile')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('shop')
        .setDescription('Browse the prestige shop')
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Filter by category')
            .setRequired(false)
            .addChoices(
              { name: 'City Skins', value: 'city_skin' },
              { name: 'Profile Badges', value: 'profile_badge' },
              { name: 'Titles', value: 'title' },
              { name: 'Guild Banners', value: 'guild_banner' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('buy')
        .setDescription('Purchase a cosmetic')
        .addStringOption((option) =>
          option
            .setName('item')
            .setDescription('Item ID to purchase')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('equip')
        .setDescription('Equip a cosmetic')
        .addStringOption((option) =>
          option
            .setName('item')
            .setDescription('Item ID to equip')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('achievements')
        .setDescription('View your achievements')
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Filter by category')
            .setRequired(false)
            .addChoices(
              { name: 'Combat', value: 'combat' },
              { name: 'Building', value: 'building' },
              { name: 'Arena', value: 'arena' },
              { name: 'Conquest', value: 'conquest' },
              { name: 'Collection', value: 'collection' },
              { name: 'Social', value: 'social' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('claim')
        .setDescription('Claim achievement rewards')
        .addStringOption((option) =>
          option
            .setName('achievement')
            .setDescription('Achievement ID to claim (or "all" for all)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('leaderboard')
        .setDescription('View the prestige leaderboard')
    ),

  requiresPlayer: true,

  async execute(context: CommandContext) {
    const { interaction, playerId } = context;
    const subcommand = interaction.options.getSubcommand();

    if (!playerId) {
      await interaction.reply({
        content: '❌ You need to start playing first! Use `/begin` to create your empire.',
        ephemeral: true,
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'profile':
          await handleProfile(context);
          break;
        case 'shop':
          await handleShop(context);
          break;
        case 'buy':
          await handleBuy(context);
          break;
        case 'equip':
          await handleEquip(context);
          break;
        case 'achievements':
          await handleAchievements(context);
          break;
        case 'claim':
          await handleClaim(context);
          break;
        case 'leaderboard':
          await handleLeaderboard(context);
          break;
        default:
          await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
      }
    } catch (error) {
      logger.error('Prestige command error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true });
      } else {
        await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true });
      }
    }
  },
};

async function handleProfile(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply();

  const db = getDatabase();
  const player = await db('players').where('id', String(playerId)).first();
  const cosmetics = await prestigeService.getPlayerCosmetics(String(playerId));
  const rank = await prestigeService.getPlayerPrestigeRank(String(playerId));
  const achievements = await prestigeService.getPlayerAchievements(String(playerId));

  const completedCount = achievements.filter(a => a.completed).length;
  const totalAchievements = prestigeService.getAchievements().length;
  const unclaimedCount = achievements.filter(a => a.completed && !a.claimed).length;

  // Get equipped cosmetic names
  const allCosmetics = prestigeService.getShopItems();
  const equippedTitle = cosmetics.equippedTitle 
    ? allCosmetics.find(c => c.id === cosmetics.equippedTitle)?.name 
    : 'None';
  const equippedBadge = cosmetics.equippedBadge
    ? allCosmetics.find(c => c.id === cosmetics.equippedBadge)?.name
    : 'None';
  const equippedSkin = cosmetics.equippedCitySkin
    ? allCosmetics.find(c => c.id === cosmetics.equippedCitySkin)?.name
    : 'Default';

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`⭐ ${player.username}'s Prestige Profile`)
    .addFields(
      {
        name: '💫 Prestige Points',
        value: `${player.prestige_points.toLocaleString()}`,
        inline: true,
      },
      {
        name: '🏆 Rank',
        value: `#${rank}`,
        inline: true,
      },
      {
        name: '🎖️ Achievements',
        value: `${completedCount}/${totalAchievements}${unclaimedCount > 0 ? ` (${unclaimedCount} unclaimed!)` : ''}`,
        inline: true,
      },
      {
        name: '👑 Title',
        value: equippedTitle || 'None',
        inline: true,
      },
      {
        name: '🎖️ Badge',
        value: equippedBadge || 'None',
        inline: true,
      },
      {
        name: '🏰 City Skin',
        value: equippedSkin || 'Default',
        inline: true,
      },
      {
        name: '📦 Owned Cosmetics',
        value: `${cosmetics.unlockedCosmetics.length} items`,
        inline: true,
      }
    )
    .setFooter({ text: 'Use /prestige shop to browse cosmetics • /prestige achievements to view progress' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}


async function handleShop(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply();

  const category = interaction.options.getString('category') as CosmeticType | null;
  const items = prestigeService.getShopItems(category || undefined);
  const cosmetics = await prestigeService.getPlayerCosmetics(String(playerId));

  const db = getDatabase();
  const player = await db('players').where('id', String(playerId)).first();

  // Group by type if no category filter
  const grouped = category ? { [category]: items } : items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, typeof items>);

  const embed = new EmbedBuilder()
    .setColor(0x9C27B0)
    .setTitle('🛒 Prestige Shop')
    .setDescription(`Your Prestige Points: **${player.prestige_points.toLocaleString()}** ⭐`)
    .setFooter({ text: 'Use /prestige buy <item_id> to purchase' })
    .setTimestamp();

  for (const [type, typeItems] of Object.entries(grouped)) {
    const typeEmoji = TYPE_EMOJIS[type] || '📦';
    const typeName = type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    const itemList = typeItems.slice(0, 5).map(item => {
      const owned = cosmetics.unlockedCosmetics.includes(item.id);
      const rarityEmoji = RARITY_EMOJIS[item.rarity];
      const status = owned ? '✅' : `${item.prestigeCost}⭐`;
      return `${rarityEmoji} **${item.name}** - ${status}\n  └ ${item.description} \`${item.id}\``;
    }).join('\n');

    embed.addFields({
      name: `${typeEmoji} ${typeName}`,
      value: itemList || 'No items',
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleBuy(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply({ ephemeral: true });

  const itemId = interaction.options.getString('item', true);
  const result = await prestigeService.purchaseCosmetic(String(playerId), itemId);

  if (result.success) {
    const item = prestigeService.getShopItems().find(c => c.id === itemId);
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ Purchase Successful!')
      .setDescription(`You purchased **${item?.name}**!`)
      .addFields({
        name: '💡 Tip',
        value: `Use \`/prestige equip ${itemId}\` to equip it!`,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply({ content: `❌ ${result.message}` });
  }
}

async function handleEquip(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply({ ephemeral: true });

  const itemId = interaction.options.getString('item', true);
  const result = await prestigeService.equipCosmetic(String(playerId), itemId);

  if (result.success) {
    await interaction.editReply({ content: `✅ ${result.message}` });
  } else {
    await interaction.editReply({ content: `❌ ${result.message}` });
  }
}

async function handleAchievements(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply();

  const category = interaction.options.getString('category');
  
  // First, check and update all achievements
  await prestigeService.checkAllAchievements(String(playerId));
  
  const allAchievements = prestigeService.getAchievements(category || undefined);
  const playerProgress = await prestigeService.getPlayerAchievements(String(playerId));

  const progressMap = new Map(playerProgress.map(p => [p.achievementId, p]));

  // Group by category if no filter
  const grouped = category 
    ? { [category]: allAchievements }
    : allAchievements.reduce((acc, ach) => {
        if (!acc[ach.category]) acc[ach.category] = [];
        acc[ach.category].push(ach);
        return acc;
      }, {} as Record<string, typeof allAchievements>);

  const embed = new EmbedBuilder()
    .setColor(0xE91E63)
    .setTitle('🏆 Achievements')
    .setFooter({ text: 'Use /prestige claim <achievement_id> to claim rewards' })
    .setTimestamp();

  for (const [cat, achievements] of Object.entries(grouped)) {
    const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
    
    const achievementList = achievements.map(ach => {
      const progress = progressMap.get(ach.id);
      const current = progress?.progress || 0;
      const target = ach.requirement.target;
      const completed = progress?.completed || false;
      const claimed = progress?.claimed || false;

      let status = '';
      if (claimed) {
        status = '✅';
      } else if (completed) {
        status = '🎁'; // Ready to claim
      } else {
        status = `${current}/${target}`;
      }

      return `${ach.icon} **${ach.name}** - ${status}\n  └ ${ach.description} (+${ach.prestigeReward}⭐) \`${ach.id}\``;
    }).join('\n');

    embed.addFields({
      name: `📂 ${catName}`,
      value: achievementList || 'No achievements',
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleClaim(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply({ ephemeral: true });

  const achievementId = interaction.options.getString('achievement', true);

  if (achievementId.toLowerCase() === 'all') {
    // Claim all unclaimed achievements
    const playerProgress = await prestigeService.getPlayerAchievements(String(playerId));
    const unclaimed = playerProgress.filter(p => p.completed && !p.claimed);

    if (unclaimed.length === 0) {
      await interaction.editReply({ content: '❌ No achievements to claim!' });
      return;
    }

    let totalPrestige = 0;
    const claimed: string[] = [];

    for (const progress of unclaimed) {
      const result = await prestigeService.claimAchievementReward(String(playerId), progress.achievementId);
      if (result.success && result.prestigeAwarded) {
        totalPrestige += result.prestigeAwarded;
        claimed.push(progress.achievementId);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🎁 Rewards Claimed!')
      .setDescription(`Claimed **${claimed.length}** achievement rewards!`)
      .addFields({
        name: '⭐ Total Prestige Earned',
        value: `+${totalPrestige.toLocaleString()} Prestige Points`,
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } else {
    const result = await prestigeService.claimAchievementReward(String(playerId), achievementId);

    if (result.success) {
      const achievement = prestigeService.getAchievements().find(a => a.id === achievementId);
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎁 Reward Claimed!')
        .setDescription(`**${achievement?.name}** reward claimed!`)
        .addFields({
          name: '⭐ Prestige Earned',
          value: `+${result.prestigeAwarded?.toLocaleString()} Prestige Points`,
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({ content: `❌ ${result.message}` });
    }
  }
}

async function handleLeaderboard(context: CommandContext) {
  const { interaction, playerId } = context;
  await interaction.deferReply();

  const leaderboard = await prestigeService.getPrestigeLeaderboard(20);
  const playerRank = await prestigeService.getPlayerPrestigeRank(String(playerId));

  const factionEmojis: Record<string, string> = {
    cinema: '🎬',
    otaku: '🎌',
    arcade: '🎮',
  };

  const leaderboardText = leaderboard.slice(0, 15).map((entry, i) => {
    const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
    const factionEmoji = factionEmojis[entry.faction] || '❓';
    const isPlayer = entry.playerId === String(playerId);
    const highlight = isPlayer ? '**' : '';
    return `${medal} ${highlight}${factionEmoji} ${entry.username}${highlight} - ${entry.prestigePoints.toLocaleString()}⭐`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🏆 Prestige Leaderboard')
    .setDescription(leaderboardText || 'No players yet')
    .addFields({
      name: '📍 Your Rank',
      value: `#${playerRank}`,
      inline: false,
    })
    .setFooter({ text: 'Prestige points persist across seasons!' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
