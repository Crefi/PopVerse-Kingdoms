import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { GameEmbeds } from '../../../infrastructure/discord/embeds/GameEmbeds.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { cacheManager } from '../../../infrastructure/cache/CacheManager.js';
import { CacheKeys, CacheTTL } from '../../../infrastructure/cache/redis.js';
import { Player } from '../../../domain/entities/Player.js';
import { Hero } from '../../../domain/entities/Hero.js';
import { STARTER_HEROES, type Faction } from '../../../shared/types/index.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';
import logger from '../../../shared/utils/logger.js';

export const beginCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('begin')
    .setDescription('Start your journey in PopVerse Kingdoms!'),

  async execute(context: CommandContext): Promise<void> {
    const discordId = context.interaction.user.id;
    const username = context.interaction.user.username;

    // Check if player already exists
    const db = getDatabase();
    const existingPlayer = await db('players')
      .select('id', 'faction')
      .where('discord_id', discordId)
      .first();

    if (existingPlayer) {
      await context.interaction.reply({
        content: `❌ You've already started your journey as a **${existingPlayer.faction.toUpperCase()}** captain!\n\nUse \`/city\` to view your city or \`/help\` for available commands.`,
        ephemeral: true,
      });
      return;
    }

    // Show faction selection
    const welcomeEmbed = GameEmbeds.welcome();

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('faction:cinema')
        .setLabel('🔥 Cinema')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('faction:otaku')
        .setLabel('💨 Otaku')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('faction:arcade')
        .setLabel('💧 Arcade')
        .setStyle(ButtonStyle.Success)
    );

    const response = await context.interaction.reply({
      embeds: [welcomeEmbed],
      components: [buttons],
      fetchReply: true,
    });

    // Wait for faction selection
    try {
      const buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i: ButtonInteraction) => i.user.id === discordId,
        time: 60000, // 1 minute timeout
      });

      const faction = buttonInteraction.customId.split(':')[1] as Faction;

      // Create the player
      await buttonInteraction.deferUpdate();

      const coordinates = await findSpawnLocation(db);
      const player = Player.create(BigInt(discordId), username, faction, coordinates);
      const playerData = player.toData();

      // Insert player into database
      const [insertedPlayer] = await db('players')
        .insert({
          discord_id: discordId,
          username: playerData.username,
          faction: playerData.faction,
          coord_x: playerData.coordX,
          coord_y: playerData.coordY,
          resources: JSON.stringify(playerData.resources),
          diamonds: playerData.diamonds,
          arena_rating: playerData.arenaRating,
          arena_tokens: playerData.arenaTokens,
          prestige_points: playerData.prestigePoints,
          protection_until: playerData.protectionUntil,
          last_active: playerData.lastActive,
          last_arena_token_regen: playerData.lastArenaTokenRegen,
        })
        .returning('id');

      const playerId = BigInt(insertedPlayer.id);

      // Create starter hero
      const starterHeroName = STARTER_HEROES[faction];
      const starterHero = Hero.create(playerId, starterHeroName, faction, 'common');
      const heroData = starterHero.toData();

      await db('heroes').insert({
        player_id: playerId.toString(),
        name: heroData.name,
        faction: heroData.faction,
        element: heroData.element,
        rarity: heroData.rarity,
        level: heroData.level,
        experience: heroData.experience,
        attack: heroData.attack,
        defense: heroData.defense,
        speed: heroData.speed,
        hp: heroData.hp,
        skills: JSON.stringify(heroData.skills),
        gear: JSON.stringify(heroData.gear),
      });

      // Create starter buildings (HQ level 1)
      await db('buildings').insert({
        player_id: playerId.toString(),
        type: 'hq',
        level: 1,
      });

      // Mark the map tile as occupied
      await db('map_tiles')
        .where({ x: coordinates.x, y: coordinates.y })
        .update({ occupant_id: playerId.toString() });

      // Cache the player
      await cacheManager.set(
        CacheKeys.playerByDiscord(discordId),
        { id: playerId.toString() },
        CacheTTL.player
      );

      // Show success message with tutorial prompt
      const successEmbed = GameEmbeds.factionSelected(faction, starterHeroName, coordinates);
      
      // Add tutorial prompt
      successEmbed.addFields({
        name: '📚 Tutorial Available',
        value: 'Use `/tutorial` to learn the game basics and earn bonus rewards!\nOr use `/help` to see all commands.',
        inline: false,
      });

      const tutorialButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('begin:tutorial')
          .setLabel('📚 Start Tutorial')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('begin:skip')
          .setLabel('Skip for now')
          .setStyle(ButtonStyle.Secondary)
      );

      await context.interaction.editReply({
        embeds: [successEmbed],
        components: [tutorialButtons],
      });

      logger.info(`New player created: ${username} (${discordId}) - Faction: ${faction} at (${coordinates.x}, ${coordinates.y})`);
    } catch (error) {
      if ((error as Error).message.includes('time')) {
        await context.interaction.editReply({
          content: '⏰ Faction selection timed out. Use `/begin` again to start.',
          embeds: [],
          components: [],
        });
      } else {
        logger.error('Error in begin command:', error);
        throw error;
      }
    }
  },
};

async function findSpawnLocation(db: ReturnType<typeof getDatabase>): Promise<{ x: number; y: number }> {
  // Find a random unoccupied plains tile in the spawn zone (outer 70% of map)
  const centerX = MAP_SIZE / 2;
  const centerY = MAP_SIZE / 2;
  const spawnRadius = MAP_SIZE * 0.35; // 35% from center = 70% spawn zone

  // Try to find an unoccupied tile
  for (let attempts = 0; attempts < 100; attempts++) {
    // Generate random coordinates in spawn zone
    const angle = Math.random() * 2 * Math.PI;
    const distance = spawnRadius + Math.random() * (MAP_SIZE / 2 - spawnRadius);
    const x = Math.floor(centerX + Math.cos(angle) * distance);
    const y = Math.floor(centerY + Math.sin(angle) * distance);

    // Clamp to map bounds
    const clampedX = Math.max(0, Math.min(MAP_SIZE - 1, x));
    const clampedY = Math.max(0, Math.min(MAP_SIZE - 1, y));

    // Check if tile exists and is unoccupied
    const tile = await db('map_tiles')
      .select('terrain', 'occupant_id')
      .where({ x: clampedX, y: clampedY })
      .first();

    if (!tile) {
      // Tile doesn't exist yet, create it
      await db('map_tiles').insert({
        x: clampedX,
        y: clampedY,
        terrain: 'plains',
      });
      return { x: clampedX, y: clampedY };
    }

    if (tile.terrain === 'plains' && !tile.occupant_id) {
      return { x: clampedX, y: clampedY };
    }
  }

  // Fallback: find any unoccupied plains tile
  const fallbackTile = await db('map_tiles')
    .select('x', 'y')
    .where('terrain', 'plains')
    .whereNull('occupant_id')
    .first();

  if (fallbackTile) {
    return { x: fallbackTile.x, y: fallbackTile.y };
  }

  // Last resort: create a new tile
  const newX = Math.floor(Math.random() * MAP_SIZE);
  const newY = Math.floor(Math.random() * MAP_SIZE);

  await db('map_tiles')
    .insert({ x: newX, y: newY, terrain: 'plains' })
    .onConflict(['x', 'y'])
    .ignore();

  return { x: newX, y: newY };
}
