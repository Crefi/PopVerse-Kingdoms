import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  type SlashCommandStringOption,
  type SlashCommandIntegerOption,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';
import { imageCacheService } from '../../../infrastructure/cache/ImageCacheService.js';
import type { Faction } from '../../../shared/types/index.js';

interface MapTileRow {
  x: number;
  y: number;
  terrain: string;
  occupant_id: string | null;
  npc_id: string | null;
}

interface PlayerRow {
  id: string;
  faction: Faction;
  username: string;
}

interface NPCRow {
  id: string;
  name: string;
  power: number;
  coord_x: number;
  coord_y: number;
  type: string;
}

export const mapCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('View the world map around your city')
    .addStringOption((option: SlashCommandStringOption) =>
      option
        .setName('direction')
        .setDescription('Pan the map in a direction')
        .setRequired(false)
        .addChoices(
          { name: 'North', value: 'north' },
          { name: 'South', value: 'south' },
          { name: 'West', value: 'west' },
          { name: 'East', value: 'east' }
        )
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option
        .setName('x')
        .setDescription('X coordinate to center on')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(MAP_SIZE - 1)
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option
        .setName('y')
        .setDescription('Y coordinate to center on')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(MAP_SIZE - 1)
    )
    .addStringOption((option: SlashCommandStringOption) =>
      option
        .setName('player')
        .setDescription('Search for a player by name')
        .setRequired(false)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    // Defer reply for heavy canvas rendering
    await context.interaction.deferReply();
    
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players')
      .select('id', 'coord_x', 'coord_y', 'faction')
      .where('discord_id', discordId)
      .first();

    if (!player) {
      await context.interaction.editReply({
        content: '❌ Use `/begin` to start your journey first!',
      });
      return;
    }

    let centerX = player.coord_x;
    let centerY = player.coord_y;

    const direction = context.interaction.options.getString('direction');
    const targetX = context.interaction.options.getInteger('x');
    const targetY = context.interaction.options.getInteger('y');
    const playerSearch = context.interaction.options.getString('player');

    if (playerSearch) {
      const targetPlayer = await db('players')
        .select('coord_x', 'coord_y', 'username')
        .whereRaw('LOWER(username) LIKE ?', [`%${playerSearch.toLowerCase()}%`])
        .first();

      if (targetPlayer) {
        centerX = targetPlayer.coord_x;
        centerY = targetPlayer.coord_y;
      } else {
        await context.interaction.editReply({
          content: `❌ Player "${playerSearch}" not found.`,
        });
        return;
      }
    } else if (targetX !== null && targetY !== null) {
      centerX = targetX;
      centerY = targetY;
    } else if (direction) {
      const panDistance = 5;
      switch (direction) {
        case 'north': centerY = Math.max(0, centerY - panDistance); break;
        case 'south': centerY = Math.min(MAP_SIZE - 1, centerY + panDistance); break;
        case 'west': centerX = Math.max(0, centerX - panDistance); break;
        case 'east': centerX = Math.min(MAP_SIZE - 1, centerX + panDistance); break;
      }
    }

    const { embed, components, attachment } = await generateMapEmbed(db, player, centerX, centerY);
    await context.interaction.editReply({ embeds: [embed], components, files: attachment ? [attachment] : [] });
  },
};

export async function generateMapEmbed(
  db: ReturnType<typeof getDatabase>,
  player: { id: string; coord_x: number; coord_y: number; faction: Faction },
  centerX: number,
  centerY: number
): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[]; attachment: AttachmentBuilder | null }> {
  const viewSize = 9;
  const halfView = Math.floor(viewSize / 2);
  
  const minX = Math.max(0, centerX - halfView);
  const maxX = Math.min(MAP_SIZE - 1, centerX + halfView);
  const minY = Math.max(0, centerY - halfView);
  const maxY = Math.min(MAP_SIZE - 1, centerY + halfView);

  // Single query to get tiles
  const tiles = await db('map_tiles')
    .select('x', 'y', 'terrain', 'occupant_id', 'npc_id')
    .whereBetween('x', [minX, maxX])
    .whereBetween('y', [minY, maxY]) as MapTileRow[];

  // Collect IDs for batch queries
  const occupantIds = tiles.filter((t) => t.occupant_id).map((t) => t.occupant_id as string);
  const npcIds = tiles.filter((t) => t.npc_id).map((t) => t.npc_id as string);

  // Batch fetch occupants and NPCs in parallel
  const [occupants, npcsInView] = await Promise.all([
    occupantIds.length > 0
      ? db('players').select('id', 'faction', 'username').whereIn('id', occupantIds) as Promise<PlayerRow[]>
      : Promise.resolve([] as PlayerRow[]),
    npcIds.length > 0
      ? db('npcs').select('id', 'name', 'power', 'coord_x', 'coord_y', 'type').whereIn('id', npcIds).orderBy('power', 'asc').limit(6) as Promise<NPCRow[]>
      : Promise.resolve([] as NPCRow[]),
  ]);

  const occupantMap = new Map(occupants.map((o) => [o.id.toString(), o]));

  const tileData = tiles.map((t) => ({
    x: t.x,
    y: t.y,
    terrain: t.terrain,
    occupant_id: t.occupant_id,
    occupant_faction: t.occupant_id ? occupantMap.get(t.occupant_id.toString())?.faction : undefined,
    npc_id: t.npc_id,
  }));

  let attachment: AttachmentBuilder | null = null;
  try {
    const imageBuffer = await imageCacheService.getMapImage(player.id.toString(), {
      tiles: tileData,
      playerX: player.coord_x,
      playerY: player.coord_y,
      centerX,
      centerY,
      viewSize,
    });
    attachment = new AttachmentBuilder(imageBuffer, { name: 'map.png' });
  } catch (error) {
    console.error('Failed to render map image:', error);
  }

  const getDistance = (x: number, y: number) => {
    return Math.abs(x - player.coord_x) + Math.abs(y - player.coord_y);
  };

  // Get nearby players (excluding self) - limit to 2
  const nearbyPlayers = occupants
    .filter((o) => o.id.toString() !== player.id.toString())
    .slice(0, 2);

  // Get resource tiles in view - limit to 2
  const resourceTiles = tiles
    .filter((t) => t.terrain === 'resource' && !t.occupant_id && !t.npc_id)
    .slice(0, 2);

  // Limit NPCs to 2
  const limitedNpcs = npcsInView.slice(0, 2);

  // Build scout recommendations text
  const recommendations: string[] = [];

  // Add NPCs (monsters)
  if (limitedNpcs.length > 0) {
    for (const npc of limitedNpcs) {
      const dist = getDistance(npc.coord_x, npc.coord_y);
      const diff = npc.power < 1000 ? '🟢' : npc.power < 3000 ? '🟡' : '🔴';
      recommendations.push(`👹 **${npc.name}** \`(${npc.coord_x},${npc.coord_y})\` ${diff} ${npc.power.toLocaleString()} pwr • ${dist} tiles`);
    }
  }

  // Add players
  if (nearbyPlayers.length > 0) {
    for (const p of nearbyPlayers) {
      const tile = tiles.find((t) => t.occupant_id === p.id.toString());
      if (tile) {
        const dist = getDistance(tile.x, tile.y);
        const factionEmoji = p.faction === 'cinema' ? '🔴' : p.faction === 'otaku' ? '🟢' : '🔵';
        recommendations.push(`${factionEmoji} **${p.username}** \`(${tile.x},${tile.y})\` Player • ${dist} tiles`);
      }
    }
  }

  // Add resources
  if (resourceTiles.length > 0) {
    for (const tile of resourceTiles) {
      const dist = getDistance(tile.x, tile.y);
      recommendations.push(`💎 **Gold Mine** \`(${tile.x},${tile.y})\` Resource • ${dist} tiles`);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🗺️ World Map')
    .setColor('#5D7052')
    .addFields(
      {
        name: '📍 Position',
        value: `🏰 Home: \`(${player.coord_x}, ${player.coord_y})\`\n🔭 View: \`(${centerX}, ${centerY})\``,
        inline: true,
      },
      {
        name: '📖 Legend',
        value: '🏰 Your HQ\n👹 Monster\n🔴🟢🔵 Players',
        inline: true,
      }
    );

  if (attachment) {
    embed.setImage('attachment://map.png');
  }

  // Add scout recommendations if any
  if (recommendations.length > 0) {
    embed.addFields({
      name: '🔍 Scout Recommendations',
      value: recommendations.join('\n'),
      inline: false,
    });
  }

  embed.setFooter({ text: '💡 Use /scout X Y to check before attacking' });

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`map:west:${centerX}:${centerY}`)
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(centerX <= halfView),
    new ButtonBuilder()
      .setCustomId(`map:north:${centerX}:${centerY}`)
      .setEmoji('⬆️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(centerY <= halfView),
    new ButtonBuilder()
      .setCustomId(`map:home:${player.coord_x}:${player.coord_y}`)
      .setEmoji('🏠')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`map:south:${centerX}:${centerY}`)
      .setEmoji('⬇️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(centerY >= MAP_SIZE - 1 - halfView),
    new ButtonBuilder()
      .setCustomId(`map:east:${centerX}:${centerY}`)
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(centerX >= MAP_SIZE - 1 - halfView),
  );

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [navRow];

  // Build select menu options from all recommendations
  const selectOptions: { label: string; description: string; value: string; emoji: string }[] = [];

  // Add NPCs
  for (const npc of limitedNpcs) {
    selectOptions.push({
      label: `${npc.name} (${npc.coord_x},${npc.coord_y})`,
      description: `${npc.power.toLocaleString()} power • ${getDistance(npc.coord_x, npc.coord_y)} tiles`,
      value: `${npc.coord_x}:${npc.coord_y}`,
      emoji: '👹',
    });
  }

  // Add players
  for (const p of nearbyPlayers) {
    const tile = tiles.find((t) => t.occupant_id === p.id.toString());
    if (tile) {
      selectOptions.push({
        label: `${p.username} (${tile.x},${tile.y})`,
        description: `${p.faction} player • ${getDistance(tile.x, tile.y)} tiles`,
        value: `${tile.x}:${tile.y}`,
        emoji: p.faction === 'cinema' ? '🔴' : p.faction === 'otaku' ? '🟢' : '🔵',
      });
    }
  }

  // Add resources
  for (const tile of resourceTiles) {
    selectOptions.push({
      label: `Gold Mine (${tile.x},${tile.y})`,
      description: `Resource tile • ${getDistance(tile.x, tile.y)} tiles`,
      value: `${tile.x}:${tile.y}`,
      emoji: '💎',
    });
  }

  if (selectOptions.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('map:scout_target')
      .setPlaceholder('🔍 Select a target to scout...')
      .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    components.push(selectRow);
  }

  return { embed, components, attachment };
}

export async function handleMapButton(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
): Promise<void> {
  // Check if interaction message is too old (14 minutes = close to 15 min timeout)
  if (Date.now() - interaction.message.createdTimestamp > 14 * 60 * 1000) {
    await interaction.reply({
      content: '⏰ This map has expired. Use `/map` to get a fresh one!',
      ephemeral: true,
    });
    return;
  }

  // Defer update for heavy rendering
  await interaction.deferUpdate();

  const db = getDatabase();
  const discordId = interaction.user.id;

  const player = await db('players')
    .select('id', 'coord_x', 'coord_y', 'faction')
    .where('discord_id', discordId)
    .first();

  if (!player) {
    await interaction.followUp({
      content: '❌ Use `/begin` to start first!',
      ephemeral: true,
    });
    return;
  }

  let centerX = parseInt(params[0]) || player.coord_x;
  let centerY = parseInt(params[1]) || player.coord_y;
  const panDistance = 5;

  switch (action) {
    case 'north': centerY = Math.max(0, centerY - panDistance); break;
    case 'south': centerY = Math.min(MAP_SIZE - 1, centerY + panDistance); break;
    case 'west': centerX = Math.max(0, centerX - panDistance); break;
    case 'east': centerX = Math.min(MAP_SIZE - 1, centerX + panDistance); break;
    case 'home':
      centerX = player.coord_x;
      centerY = player.coord_y;
      break;
  }

  const { embed, components, attachment } = await generateMapEmbed(db, player, centerX, centerY);
  await interaction.editReply({ embeds: [embed], components, files: attachment ? [attachment] : [] });
}

export async function handleMapSelectMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const [x, y] = interaction.values[0].split(':').map(Number);
  
  await interaction.reply({
    content: `🔍 **Scout Target Selected!**\n\nTo scout this location, use:\n\`/scout x:${x} y:${y}\`\n\nTo attack directly:\n\`/attack x:${x} y:${y}\``,
    ephemeral: true,
  });
}
