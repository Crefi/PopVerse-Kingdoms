import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type SlashCommandIntegerOption,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';
import type { Faction } from '../../../shared/types/index.js';

const FACTION_COLORS: Record<string, number> = {
  cinema: 0xe74c3c,
  otaku: 0x9b59b6,
  arcade: 0x3498db,
};

export const teleportCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('teleport')
    .setDescription('Relocate your city to a new location')
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option
        .setName('x')
        .setDescription('Target X coordinate')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(MAP_SIZE - 1)
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option
        .setName('y')
        .setDescription('Target Y coordinate')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(MAP_SIZE - 1)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const targetX = context.interaction.options.getInteger('x', true);
    const targetY = context.interaction.options.getInteger('y', true);

    const player = await db('players')
      .select('id', 'faction', 'coord_x', 'coord_y', 'username')
      .where('discord_id', discordId)
      .first() as { id: string; faction: Faction; coord_x: number; coord_y: number; username: string } | undefined;

    if (!player) {
      await context.interaction.reply({
        content: '❌ Use `/begin` to start your journey first!',
        ephemeral: true,
      });
      return;
    }

    // Check if player has teleport scrolls
    const inventory = await db('player_inventory')
      .where('player_id', player.id)
      .where('item_id', 'teleport_scroll')
      .first() as { quantity: number } | undefined;

    if (!inventory || inventory.quantity < 1) {
      await context.interaction.reply({
        content: '❌ You don\'t have any **📜 Teleport Scrolls**!\n\nBuy them from `/shop browse` for 💎 100 diamonds.',
        ephemeral: true,
      });
      return;
    }

    // Check if target tile is valid
    const targetTile = await db('map_tiles')
      .select('terrain', 'occupant_id', 'npc_id')
      .where('x', targetX)
      .where('y', targetY)
      .first() as { terrain: string; occupant_id: string | null; npc_id: string | null } | undefined;

    if (!targetTile) {
      await context.interaction.reply({
        content: '❌ Invalid coordinates.',
        ephemeral: true,
      });
      return;
    }

    // Check terrain - can't teleport to mountains or lakes
    if (targetTile.terrain === 'mountain' || targetTile.terrain === 'lake') {
      await context.interaction.reply({
        content: `❌ Cannot teleport to **${targetTile.terrain}** terrain!`,
        ephemeral: true,
      });
      return;
    }

    // Check if tile is occupied
    if (targetTile.occupant_id) {
      await context.interaction.reply({
        content: '❌ That tile is already occupied by another player!',
        ephemeral: true,
      });
      return;
    }

    if (targetTile.npc_id) {
      await context.interaction.reply({
        content: '❌ That tile is occupied by an NPC! Defeat it first with `/attack`.',
        ephemeral: true,
      });
      return;
    }

    // Check if same location
    if (player.coord_x === targetX && player.coord_y === targetY) {
      await context.interaction.reply({
        content: '❌ You\'re already at that location!',
        ephemeral: true,
      });
      return;
    }

    // Calculate distance
    const distance = Math.abs(targetX - player.coord_x) + Math.abs(targetY - player.coord_y);

    // Show confirmation
    const embed = new EmbedBuilder()
      .setTitle('📜 Teleport Confirmation')
      .setDescription(`Are you sure you want to relocate your city?`)
      .setColor(FACTION_COLORS[player.faction] || 0x808080)
      .addFields(
        { name: '📍 Current Location', value: `\`(${player.coord_x}, ${player.coord_y})\``, inline: true },
        { name: '🎯 Target Location', value: `\`(${targetX}, ${targetY})\``, inline: true },
        { name: '📏 Distance', value: `${distance} tiles`, inline: true },
        { name: '🌍 Terrain', value: targetTile.terrain.charAt(0).toUpperCase() + targetTile.terrain.slice(1), inline: true },
        { name: '📜 Scrolls Remaining', value: `${inventory.quantity} → ${inventory.quantity - 1}`, inline: true },
      )
      .setFooter({ text: 'This action cannot be undone!' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`teleport:confirm:${targetX}:${targetY}`)
        .setLabel('✅ Confirm Teleport')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('teleport:cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger),
    );

    await context.interaction.reply({ embeds: [embed], components: [row] });
  },
};

/**
 * Handle teleport button interactions
 */
export async function handleTeleportButton(
  interaction: ButtonInteraction,
  action: string,
  params: string[]
): Promise<void> {
  const db = getDatabase();
  const discordId = interaction.user.id;

  if (action === 'cancel') {
    await interaction.update({
      content: '❌ Teleport cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (action === 'confirm') {
    const targetX = parseInt(params[0], 10);
    const targetY = parseInt(params[1], 10);

    const player = await db('players')
      .select('id', 'faction', 'coord_x', 'coord_y')
      .where('discord_id', discordId)
      .first() as { id: string; faction: Faction; coord_x: number; coord_y: number } | undefined;

    if (!player) {
      await interaction.update({
        content: '❌ Player not found.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Re-verify scroll availability
    const inventory = await db('player_inventory')
      .where('player_id', player.id)
      .where('item_id', 'teleport_scroll')
      .first() as { id: string; quantity: number } | undefined;

    if (!inventory || inventory.quantity < 1) {
      await interaction.update({
        content: '❌ You no longer have any Teleport Scrolls!',
        embeds: [],
        components: [],
      });
      return;
    }

    // Re-verify target tile
    const targetTile = await db('map_tiles')
      .select('terrain', 'occupant_id', 'npc_id')
      .where('x', targetX)
      .where('y', targetY)
      .first();

    if (!targetTile || targetTile.occupant_id || targetTile.npc_id) {
      await interaction.update({
        content: '❌ Target tile is no longer available!',
        embeds: [],
        components: [],
      });
      return;
    }

    // Perform teleport
    await db.transaction(async (trx) => {
      // Clear old tile
      await trx('map_tiles')
        .where('x', player.coord_x)
        .where('y', player.coord_y)
        .update({ occupant_id: null });

      // Set new tile
      await trx('map_tiles')
        .where('x', targetX)
        .where('y', targetY)
        .update({ occupant_id: player.id });

      // Update player coordinates
      await trx('players')
        .where('id', player.id)
        .update({
          coord_x: targetX,
          coord_y: targetY,
          updated_at: new Date(),
        });

      // Consume scroll
      await trx('player_inventory')
        .where('id', inventory.id)
        .update({ quantity: inventory.quantity - 1 });

      // Log teleport
      await trx('teleport_log').insert({
        player_id: player.id,
        from_x: player.coord_x,
        from_y: player.coord_y,
        to_x: targetX,
        to_y: targetY,
      });
    });

    const embed = new EmbedBuilder()
      .setTitle('✨ Teleport Successful!')
      .setDescription(`Your city has been relocated!`)
      .setColor(0x2ecc71)
      .addFields(
        { name: '📍 New Location', value: `\`(${targetX}, ${targetY})\``, inline: true },
        { name: '📜 Scrolls Left', value: `${inventory.quantity - 1}`, inline: true },
      )
      .setFooter({ text: 'Use /map to see your new surroundings!' });

    await interaction.update({ embeds: [embed], components: [] });
  }
}
