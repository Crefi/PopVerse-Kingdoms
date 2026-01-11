import {
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { landService, LAND_TYPES, LandParcel, LandType } from '../../../domain/services/LandService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { Faction } from '../../../shared/types/index.js';

const FACTION_COLORS: Record<string, number> = {
  cinema: 0xe74c3c,
  otaku: 0x9b59b6,
  arcade: 0x3498db,
};

export const landCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('land')
    .setDescription('Manage land parcels')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View available land parcels for purchase')
    )
    .addSubcommand(sub =>
      sub.setName('owned')
        .setDescription('View your owned land parcels')
    )
    .addSubcommand(sub =>
      sub.setName('buy')
        .setDescription('Purchase a land parcel')
        .addStringOption(opt =>
          opt.setName('land_id')
            .setDescription('ID of the land to purchase')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('sell')
        .setDescription('Sell a land parcel (50% refund)')
        .addStringOption(opt =>
          opt.setName('land_id')
            .setDescription('ID of the land to sell')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View details about a specific land')
        .addStringOption(opt =>
          opt.setName('land_id')
            .setDescription('ID of the land to view')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('bonuses')
        .setDescription('View your total land bonuses')
    )
    .addSubcommand(sub =>
      sub.setName('stats')
        .setDescription('View server-wide land ownership statistics')
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

    switch (subcommand) {
      case 'list':
        await handleList(context, player);
        break;
      case 'owned':
        await handleOwned(context, player);
        break;
      case 'buy':
        await handleBuy(context, player);
        break;
      case 'sell':
        await handleSell(context, player);
        break;
      case 'info':
        await handleInfo(context, player);
        break;
      case 'bonuses':
        await handleBonuses(context, player);
        break;
      case 'stats':
        await handleStats(context, player);
        break;
    }
  },
};

async function handleList(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const availableLands = await landService.getAvailableLands();

  if (availableLands.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('🗺️ Land Market')
      .setDescription('No land parcels are currently available for purchase.')
      .setColor(FACTION_COLORS[player.faction] || 0x808080)
      .setFooter({ text: 'New lands spawn when ownership exceeds 70%' });

    await context.interaction.reply({ embeds: [embed] });
    return;
  }

  // Group by type
  const byType: Record<LandType, LandParcel[]> = {
    farm: [],
    mine: [],
    goldmine: [],
    fort: [],
  };

  for (const land of availableLands) {
    if (byType[land.type]) {
      byType[land.type].push(land);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🗺️ Land Market')
    .setDescription('Available land parcels for purchase:')
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  for (const [type, lands] of Object.entries(byType)) {
    if (lands.length === 0) continue;
    
    const typeInfo = LAND_TYPES[type as LandType];
    const landList = lands.slice(0, 5).map(l => {
      const size = `${l.maxX - l.minX + 1}x${l.maxY - l.minY + 1}`;
      return `• **${l.name}** (${size}) - 💰 ${l.purchaseCost} gold\n  ID: \`${l.id}\``;
    }).join('\n');

    embed.addFields({
      name: `${typeInfo.emoji} ${typeInfo.name} (${lands.length} available)`,
      value: landList + (lands.length > 5 ? `\n...and ${lands.length - 5} more` : ''),
      inline: false,
    });
  }

  embed.setFooter({ text: 'Use /land buy <land_id> to purchase • Max 3 lands per player' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleOwned(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const ownedLands = await landService.getPlayerLands(player.id);

  const embed = new EmbedBuilder()
    .setTitle('🏠 Your Land Holdings')
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  if (ownedLands.length === 0) {
    embed.setDescription('You don\'t own any land parcels yet.\nUse `/land list` to see available lands.');
  } else {
    embed.setDescription(`You own **${ownedLands.length}/3** land parcels:`);

    for (const land of ownedLands) {
      const typeInfo = LAND_TYPES[land.type];
      const size = `${land.maxX - land.minX + 1}x${land.maxY - land.minY + 1}`;
      const coords = `(${land.minX},${land.minY}) to (${land.maxX},${land.maxY})`;
      const sellValue = Math.floor(land.purchaseCost * 0.5);

      embed.addFields({
        name: `${typeInfo.emoji} ${land.name}`,
        value: [
          `**Type:** ${typeInfo.name}`,
          `**Size:** ${size}`,
          `**Location:** ${coords}`,
          `**Bonus:** ${typeInfo.description}`,
          `**Sell Value:** 💰 ${sellValue} gold`,
          `**ID:** \`${land.id}\``,
        ].join('\n'),
        inline: true,
      });
    }
  }

  // Show total bonuses
  const bonuses = await landService.calculatePlayerBonuses(player.id);
  if (Object.keys(bonuses).length > 0) {
    const bonusText = Object.entries(bonuses)
      .map(([key, value]) => `+${Math.round(value * 100)}% ${key}`)
      .join(', ');
    embed.addFields({
      name: '📊 Total Bonuses',
      value: bonusText,
      inline: false,
    });
  }

  await context.interaction.reply({ embeds: [embed] });
}

async function handleBuy(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const landId = context.interaction.options.getString('land_id', true);

  const result = await landService.purchaseLand(player.id, landId);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const land = result.land!;
  const typeInfo = LAND_TYPES[land.type];

  const embed = new EmbedBuilder()
    .setTitle('🎉 Land Purchased!')
    .setDescription(`You are now the proud owner of **${land.name}**!`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Type', value: `${typeInfo.emoji} ${typeInfo.name}`, inline: true },
      { name: 'Cost', value: `💰 ${result.costPaid?.gold} gold`, inline: true },
      { name: 'Bonus', value: typeInfo.description, inline: true },
    )
    .setFooter({ text: 'Your bonus is now active!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleSell(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const landId = context.interaction.options.getString('land_id', true);

  // Get land info first for confirmation
  const land = await landService.getLandById(landId);
  if (!land) {
    await context.interaction.reply({
      content: '❌ Land parcel not found.',
      ephemeral: true,
    });
    return;
  }

  if (land.ownerPlayerId !== player.id) {
    await context.interaction.reply({
      content: '❌ You do not own this land.',
      ephemeral: true,
    });
    return;
  }

  const result = await landService.sellLand(player.id, landId);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const typeInfo = LAND_TYPES[land.type];

  const embed = new EmbedBuilder()
    .setTitle('💰 Land Sold!')
    .setDescription(`You sold **${land.name}** and received **${result.goldReceived} gold**.`)
    .setColor(0xf39c12)
    .addFields(
      { name: 'Type', value: `${typeInfo.emoji} ${typeInfo.name}`, inline: true },
      { name: 'Refund', value: `💰 ${result.goldReceived} gold (50%)`, inline: true },
    );

  await context.interaction.reply({ embeds: [embed] });
}

async function handleInfo(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const landId = context.interaction.options.getString('land_id', true);

  const land = await landService.getLandById(landId);
  if (!land) {
    await context.interaction.reply({
      content: '❌ Land parcel not found.',
      ephemeral: true,
    });
    return;
  }

  const typeInfo = LAND_TYPES[land.type];
  const size = `${land.maxX - land.minX + 1}x${land.maxY - land.minY + 1}`;
  const coords = `(${land.minX},${land.minY}) to (${land.maxX},${land.maxY})`;

  let ownerText = '🏷️ **Available for purchase**';
  if (land.ownerPlayerId) {
    const db = getDatabase();
    const owner = await db('players')
      .select('username')
      .where('id', land.ownerPlayerId)
      .first() as { username: string } | undefined;
    ownerText = `👤 **${owner?.username || 'Unknown'}**`;
  } else if (land.ownerGuildId) {
    const db = getDatabase();
    const guild = await db('guilds')
      .select('name')
      .where('id', land.ownerGuildId)
      .first() as { name: string } | undefined;
    ownerText = `🏰 **[${guild?.name || 'Unknown Guild'}]**`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${typeInfo.emoji} ${land.name}`)
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .addFields(
      { name: 'Type', value: typeInfo.name, inline: true },
      { name: 'Size', value: size, inline: true },
      { name: 'Location', value: coords, inline: true },
      { name: 'Owner', value: ownerText, inline: true },
      { name: 'Purchase Cost', value: `💰 ${land.purchaseCost} gold`, inline: true },
      { name: 'Sell Value', value: `💰 ${Math.floor(land.purchaseCost * 0.5)} gold`, inline: true },
      { name: 'Bonus', value: typeInfo.description, inline: false },
    )
    .setFooter({ text: `ID: ${land.id}` });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleBonuses(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const playerBonuses = await landService.calculatePlayerBonuses(player.id);

  // Check if player is in a guild
  const db = getDatabase();
  const guildMember = await db('guild_members')
    .select('guild_id')
    .where('player_id', player.id)
    .first() as { guild_id: string } | undefined;

  let guildBonuses: Record<string, number> = {};
  let guildName = '';
  if (guildMember) {
    guildBonuses = await landService.calculateGuildBonuses(guildMember.guild_id);
    const guild = await db('guilds')
      .select('name')
      .where('id', guildMember.guild_id)
      .first() as { name: string } | undefined;
    guildName = guild?.name || '';
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Your Land Bonuses')
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  // Personal bonuses
  if (Object.keys(playerBonuses).length > 0) {
    const personalText = Object.entries(playerBonuses)
      .map(([key, value]) => `• **+${Math.round(value * 100)}%** ${key}`)
      .join('\n');
    embed.addFields({
      name: '👤 Personal Land Bonuses',
      value: personalText,
      inline: false,
    });
  } else {
    embed.addFields({
      name: '👤 Personal Land Bonuses',
      value: '_No personal lands owned_',
      inline: false,
    });
  }

  // Guild bonuses
  if (guildMember && Object.keys(guildBonuses).length > 0) {
    const guildText = Object.entries(guildBonuses)
      .map(([key, value]) => `• **+${Math.round(value * 100)}%** ${key}`)
      .join('\n');
    embed.addFields({
      name: `🏰 Guild Bonuses (${guildName})`,
      value: guildText,
      inline: false,
    });
  }

  // Combined totals
  const combined: Record<string, number> = { ...playerBonuses };
  for (const [key, value] of Object.entries(guildBonuses)) {
    combined[key] = (combined[key] || 0) + value;
  }

  if (Object.keys(combined).length > 0) {
    const totalText = Object.entries(combined)
      .map(([key, value]) => `• **+${Math.round(value * 100)}%** ${key}`)
      .join('\n');
    embed.addFields({
      name: '✨ Total Active Bonuses',
      value: totalText,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Bonuses apply to resource production and combat' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleStats(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const stats = await landService.getOwnershipStats();

  const embed = new EmbedBuilder()
    .setTitle('🌍 Land Ownership Statistics')
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .addFields(
      { name: 'Total Lands', value: stats.total.toString(), inline: true },
      { name: 'Owned', value: stats.owned.toString(), inline: true },
      { name: 'Available', value: stats.available.toString(), inline: true },
      { name: 'Ownership Rate', value: `${Math.round(stats.ownershipRate * 100)}%`, inline: true },
    );

  // By type breakdown
  const typeBreakdown = Object.entries(stats.byType)
    .map(([type, data]) => {
      const typeInfo = LAND_TYPES[type as LandType];
      return `${typeInfo.emoji} **${typeInfo.name}:** ${data.owned}/${data.total}`;
    })
    .join('\n');

  embed.addFields({
    name: '📊 By Type',
    value: typeBreakdown || 'No data',
    inline: false,
  });

  if (stats.ownershipRate > 0.7) {
    embed.setFooter({ text: '⚠️ High ownership! New lands may spawn soon.' });
  } else {
    embed.setFooter({ text: 'New lands spawn when ownership exceeds 70%' });
  }

  await context.interaction.reply({ embeds: [embed] });
}
