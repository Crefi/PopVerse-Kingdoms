import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
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

const LANDS_PER_PAGE = 4;

// Type colors for visual distinction
const TYPE_COLORS: Record<LandType, number> = {
  farm: 0x27ae60,    // Green
  mine: 0x7f8c8d,    // Grey
  goldmine: 0xf1c40f, // Gold
  fort: 0x9b59b6,    // Purple
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
  player: { id: string; faction: Faction; coord_x?: number; coord_y?: number }
): Promise<void> {
  const db = getDatabase();

  // Get player coordinates
  const playerData = await db('players')
    .select('coord_x', 'coord_y')
    .where('id', player.id)
    .first() as { coord_x: number; coord_y: number } | undefined;
  
  const playerX = playerData?.coord_x ?? 50;
  const playerY = playerData?.coord_y ?? 50;

  const { embed, components } = await generateLandListEmbed(player.id, player.faction, playerX, playerY, 0, null);
  await context.interaction.reply({ embeds: [embed], components });
}

/**
 * Generate the land list embed with pagination
 */
export async function generateLandListEmbed(
  _playerId: string,
  faction: Faction,
  playerX: number,
  playerY: number,
  page: number,
  filterType: LandType | null
): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] }> {
  const availableLands = await landService.getAvailableLands();

  // Calculate distance from player to land center
  const getDistance = (land: LandParcel): number => {
    const centerX = Math.floor((land.minX + land.maxX) / 2);
    const centerY = Math.floor((land.minY + land.maxY) / 2);
    return Math.abs(centerX - playerX) + Math.abs(centerY - playerY);
  };

  // Filter by type if specified
  let filteredLands = filterType 
    ? availableLands.filter(l => l.type === filterType)
    : availableLands;

  // Sort by distance
  filteredLands.sort((a, b) => getDistance(a) - getDistance(b));

  const totalLands = filteredLands.length;
  const totalPages = Math.ceil(totalLands / LANDS_PER_PAGE) || 1;
  const currentPage = Math.min(Math.max(0, page), totalPages - 1);
  const startIdx = currentPage * LANDS_PER_PAGE;
  const pageLands = filteredLands.slice(startIdx, startIdx + LANDS_PER_PAGE);

  // Count by type for header
  const typeCounts: Record<LandType, number> = { farm: 0, mine: 0, goldmine: 0, fort: 0 };
  for (const land of availableLands) {
    if (typeCounts[land.type] !== undefined) {
      typeCounts[land.type]++;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🗺️ Land Market')
    .setColor(filterType ? TYPE_COLORS[filterType] : FACTION_COLORS[faction] || 0x808080);

  if (totalLands === 0) {
    embed.setDescription(filterType 
      ? `No **${LAND_TYPES[filterType].name}** parcels available.`
      : 'No land parcels are currently available for purchase.');
    embed.setFooter({ text: 'New lands spawn when ownership exceeds 70%' });
    
    // Still show filter buttons
    const filterRow = createFilterRow(filterType);
    return { embed, components: [filterRow] };
  }

  // Header with counts and player location
  const typeCountsText = Object.entries(typeCounts)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${LAND_TYPES[type as LandType].emoji} ${count}`)
    .join('  ');

  embed.setDescription(
    `📍 Your location: \`(${playerX}, ${playerY})\`\n` +
    `📦 Available: ${typeCountsText}\n` +
    (filterType ? `\n🔍 Showing: **${LAND_TYPES[filterType].name}** only` : '')
  );

  // Add land cards
  for (const land of pageLands) {
    const typeInfo = LAND_TYPES[land.type];
    const size = `${land.maxX - land.minX + 1}×${land.maxY - land.minY + 1}`;
    const centerX = Math.floor((land.minX + land.maxX) / 2);
    const centerY = Math.floor((land.minY + land.maxY) / 2);
    const distance = getDistance(land);

    // Compact card format
    const cardValue = [
      `${typeInfo.emoji} **${typeInfo.name}** • ${size} tiles`,
      `┣ 📍 Center: \`(${centerX}, ${centerY})\` • **${distance}** tiles away`,
      `┣ 💰 Price: **${land.purchaseCost.toLocaleString()}** gold`,
      `┗ 🎁 Bonus: ${typeInfo.description}`,
      `\`ID: ${land.id}\``,
    ].join('\n');

    embed.addFields({
      name: `${land.name}`,
      value: cardValue,
      inline: false,
    });
  }

  embed.setFooter({ 
    text: `Page ${currentPage + 1}/${totalPages} • ${totalLands} lands available • /land buy <id> to purchase` 
  });

  // Build components
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  // Filter row (type selection)
  const filterRow = createFilterRow(filterType);
  components.push(filterRow);

  // Pagination row
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`land:list:first:${playerX}:${playerY}:${filterType || 'all'}`)
        .setEmoji('⏮️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`land:list:prev:${currentPage}:${playerX}:${playerY}:${filterType || 'all'}`)
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`land:list:page`)
        .setLabel(`${currentPage + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`land:list:next:${currentPage}:${playerX}:${playerY}:${filterType || 'all'}`)
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`land:list:last:${totalPages - 1}:${playerX}:${playerY}:${filterType || 'all'}`)
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1),
    );
    components.push(navRow);
  }

  return { embed, components };
}

function createFilterRow(currentFilter: LandType | null): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('land:filter:all')
      .setLabel('All')
      .setStyle(currentFilter === null ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('land:filter:farm')
      .setEmoji('🌾')
      .setStyle(currentFilter === 'farm' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('land:filter:mine')
      .setEmoji('⛏️')
      .setStyle(currentFilter === 'mine' ? ButtonStyle.Secondary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('land:filter:goldmine')
      .setEmoji('💰')
      .setStyle(currentFilter === 'goldmine' ? ButtonStyle.Secondary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('land:filter:fort')
      .setEmoji('🏰')
      .setStyle(currentFilter === 'fort' ? ButtonStyle.Secondary : ButtonStyle.Secondary),
  );
}

/**
 * Handle land list button interactions (pagination and filtering)
 */
export async function handleLandButton(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
): Promise<void> {
  const db = getDatabase();
  const discordId = interaction.user.id;

  const player = await db('players')
    .select('id', 'faction', 'coord_x', 'coord_y')
    .where('discord_id', discordId)
    .first() as { id: string; faction: Faction; coord_x: number; coord_y: number } | undefined;

  if (!player) {
    await interaction.reply({
      content: '❌ Use `/begin` to start first!',
      ephemeral: true,
    });
    return;
  }

  // Handle view on map button
  if (action === 'view') {
    const x = parseInt(params[0]) || 50;
    const y = parseInt(params[1]) || 50;
    await interaction.reply({
      content: `🗺️ To view this land on the map, use:\n\`/map x:${x} y:${y}\``,
      ephemeral: true,
    });
    return;
  }

  // Handle quick buy button
  if (action === 'quickbuy') {
    const landId = params[0];
    const result = await landService.purchaseLand(player.id, landId);

    if (!result.success) {
      await interaction.reply({
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

    await interaction.reply({ embeds: [embed] });
    return;
  }

  await interaction.deferUpdate();

  let page = 0;
  let filterType: LandType | null = null;
  let playerX = player.coord_x;
  let playerY = player.coord_y;

  if (action === 'filter') {
    // Filter button clicked
    const type = params[0];
    filterType = type === 'all' ? null : type as LandType;
    page = 0;
  } else if (action === 'list') {
    // Pagination button clicked
    const navAction = params[0];
    const currentPage = parseInt(params[1]) || 0;
    playerX = parseInt(params[2]) || player.coord_x;
    playerY = parseInt(params[3]) || player.coord_y;
    filterType = params[4] === 'all' ? null : params[4] as LandType;

    switch (navAction) {
      case 'first':
        page = 0;
        break;
      case 'prev':
        page = Math.max(0, currentPage - 1);
        break;
      case 'next':
        page = currentPage + 1;
        break;
      case 'last':
        page = currentPage; // params[1] is already the last page
        break;
    }
  }

  const { embed, components } = await generateLandListEmbed(
    player.id,
    player.faction,
    playerX,
    playerY,
    page,
    filterType
  );

  await interaction.editReply({ embeds: [embed], components });
}

async function handleOwned(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const ownedLands = await landService.getPlayerLands(player.id);
  const db = getDatabase();

  // Get player coordinates for distance
  const playerData = await db('players')
    .select('coord_x', 'coord_y')
    .where('id', player.id)
    .first() as { coord_x: number; coord_y: number } | undefined;
  
  const playerX = playerData?.coord_x ?? 50;
  const playerY = playerData?.coord_y ?? 50;

  const embed = new EmbedBuilder()
    .setTitle('🏠 Your Land Holdings')
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  if (ownedLands.length === 0) {
    embed.setDescription(
      '```\n' +
      '  You don\'t own any land parcels yet.\n' +
      '```\n' +
      '💡 Use `/land list` to browse available lands!'
    );
    await context.interaction.reply({ embeds: [embed] });
    return;
  }

  // Calculate total bonuses
  const bonuses = await landService.calculatePlayerBonuses(player.id);
  const bonusText = Object.entries(bonuses)
    .map(([key, value]) => `+${Math.round(value * 100)}% ${key}`)
    .join(' • ') || 'None';

  embed.setDescription(
    `**${ownedLands.length}/3** land parcels owned\n` +
    `📊 **Active Bonuses:** ${bonusText}`
  );

  for (const land of ownedLands) {
    const typeInfo = LAND_TYPES[land.type];
    const sizeX = land.maxX - land.minX + 1;
    const sizeY = land.maxY - land.minY + 1;
    const centerX = Math.floor((land.minX + land.maxX) / 2);
    const centerY = Math.floor((land.minY + land.maxY) / 2);
    const distance = Math.abs(centerX - playerX) + Math.abs(centerY - playerY);
    const sellValue = Math.floor(land.purchaseCost * 0.5);

    const cardValue = [
      `${typeInfo.emoji} **${typeInfo.name}** • ${sizeX}×${sizeY} tiles`,
      `┣ 📍 \`(${centerX}, ${centerY})\` • ${distance} tiles away`,
      `┣ 🎁 ${typeInfo.description}`,
      `┗ 💰 Sell value: **${sellValue.toLocaleString()}** gold`,
      `\`ID: ${land.id}\``,
    ].join('\n');

    embed.addFields({
      name: land.name,
      value: cardValue,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Use /land sell <id> to sell • /land info <id> for details' });

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
  const sizeX = land.maxX - land.minX + 1;
  const sizeY = land.maxY - land.minY + 1;
  const centerX = Math.floor((land.minX + land.maxX) / 2);
  const centerY = Math.floor((land.minY + land.maxY) / 2);

  // Get player coordinates for distance calculation
  const db = getDatabase();
  const playerData = await db('players')
    .select('coord_x', 'coord_y')
    .where('id', player.id)
    .first() as { coord_x: number; coord_y: number } | undefined;
  
  const distance = playerData 
    ? Math.abs(centerX - playerData.coord_x) + Math.abs(centerY - playerData.coord_y)
    : 0;

  let ownerText = '🏷️ Available for purchase';
  let isAvailable = true;
  if (land.ownerPlayerId) {
    const owner = await db('players')
      .select('username')
      .where('id', land.ownerPlayerId)
      .first() as { username: string } | undefined;
    ownerText = `👤 ${owner?.username || 'Unknown'}`;
    isAvailable = false;
  } else if (land.ownerGuildId) {
    const guild = await db('guilds')
      .select('name')
      .where('id', land.ownerGuildId)
      .first() as { name: string } | undefined;
    ownerText = `🏰 [${guild?.name || 'Unknown Guild'}]`;
    isAvailable = false;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${typeInfo.emoji} ${land.name}`)
    .setColor(TYPE_COLORS[land.type])
    .setDescription(
      `**${typeInfo.name}** • ${sizeX}×${sizeY} tiles (${sizeX * sizeY} total)\n\n` +
      `${typeInfo.description}`
    );

  // Location section
  embed.addFields({
    name: '📍 Location',
    value: [
      `**Center:** \`(${centerX}, ${centerY})\``,
      `**Bounds:** \`(${land.minX}, ${land.minY})\` → \`(${land.maxX}, ${land.maxY})\``,
      `**Distance:** ${distance} tiles from you`,
    ].join('\n'),
    inline: true,
  });

  // Pricing section
  embed.addFields({
    name: '💰 Pricing',
    value: [
      `**Buy:** ${land.purchaseCost.toLocaleString()} gold`,
      `**Sell:** ${Math.floor(land.purchaseCost * 0.5).toLocaleString()} gold`,
      `**Per tile:** ${Math.floor(land.purchaseCost / (sizeX * sizeY))} gold`,
    ].join('\n'),
    inline: true,
  });

  // Status section
  embed.addFields({
    name: '📋 Status',
    value: [
      `**Owner:** ${ownerText}`,
      isAvailable ? '✅ **Available to buy**' : '🔒 **Already owned**',
    ].join('\n'),
    inline: true,
  });

  // Action buttons
  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`land:view:${centerX}:${centerY}`)
      .setLabel('View on Map')
      .setEmoji('🗺️')
      .setStyle(ButtonStyle.Secondary),
  );

  if (isAvailable) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`land:quickbuy:${land.id}`)
        .setLabel(`Buy for ${land.purchaseCost.toLocaleString()}g`)
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
    );
  }

  components.push(actionRow);

  embed.setFooter({ text: `ID: ${land.id}` });

  await context.interaction.reply({ embeds: [embed], components });
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
