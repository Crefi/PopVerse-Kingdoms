import {
  SlashCommandBuilder,
  EmbedBuilder,
  type SlashCommandIntegerOption,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { combatService } from '../../../domain/services/CombatService.js';
import { Hero } from '../../../domain/entities/Hero.js';
import { DailyQuestService } from '../../../domain/services/DailyQuestService.js';
import { ActivityLogService } from '../../../domain/services/ActivityLogService.js';
import type { Faction, TroopTier } from '../../../shared/types/index.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';

interface TroopRow {
  tier: number;
  count: number;
}

export const scoutCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('scout')
    .setDescription('Scout a location to see enemy strength without attacking')
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('x').setDescription('X coordinate').setRequired(true).setMinValue(0).setMaxValue(MAP_SIZE - 1)
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('y').setDescription('Y coordinate').setRequired(true).setMinValue(0).setMaxValue(MAP_SIZE - 1)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const targetX = context.interaction.options.getInteger('x', true);
    const targetY = context.interaction.options.getInteger('y', true);

    // Get player
    const player = await db('players').select('id', 'coord_x', 'coord_y').where('discord_id', discordId).first();
    if (!player) {
      await context.interaction.reply({ content: '❌ Use `/begin` to start!', ephemeral: true });
      return;
    }

    // Get target tile
    const tile = await db('map_tiles').select('*').where({ x: targetX, y: targetY }).first();

    let embed: EmbedBuilder;

    if (tile?.occupant_id) {
      // Player at location
      const targetPlayer = await db('players').select('*').where('id', tile.occupant_id).first();
      if (!targetPlayer) {
        await context.interaction.reply({ content: '❌ Location is empty.', ephemeral: true });
        return;
      }

      const troops: TroopRow[] = await db('troops').select('tier', 'count').where('player_id', targetPlayer.id);
      const heroRow = await db('heroes').select('*').where('player_id', targetPlayer.id).orderBy('level', 'desc').first();

      let hero: Hero | null = null;
      if (heroRow) {
        hero = new Hero({
          ...heroRow,
          id: BigInt(heroRow.id),
          playerId: BigInt(heroRow.player_id),
          skills: typeof heroRow.skills === 'string' ? JSON.parse(heroRow.skills) : heroRow.skills,
          gear: typeof heroRow.gear === 'string' ? JSON.parse(heroRow.gear) : heroRow.gear,
          createdAt: new Date(heroRow.created_at),
        });
      }

      const scoutResult = combatService.scoutLocation(
        troops.map(t => ({ tier: t.tier as TroopTier, count: t.count })),
        hero,
        targetPlayer.faction as Faction
      );

      const isProtected = targetPlayer.protection_until && new Date(targetPlayer.protection_until) > new Date();

      embed = new EmbedBuilder()
        .setTitle(`🔭 Scout Report: ${targetPlayer.username}`)
        .setColor(isProtected ? '#FFD700' : '#FF6600')
        .addFields(
          { name: '📍 Location', value: `(${targetX}, ${targetY})`, inline: true },
          { name: '🏴 Faction', value: targetPlayer.faction.charAt(0).toUpperCase() + targetPlayer.faction.slice(1), inline: true },
          { name: '💪 Power', value: scoutResult.power.toLocaleString(), inline: true },
          { name: '🦸 Hero', value: scoutResult.hero ?? 'Unknown', inline: true },
          { name: '⚔️ Troops', value: scoutResult.troops.map(t => `T${t.tier}: ${t.count}`).join('\n') || 'Unknown', inline: true }
        );

      if (isProtected) {
        embed.addFields({
          name: '🛡️ Protection',
          value: `Protected until <t:${Math.floor(new Date(targetPlayer.protection_until).getTime() / 1000)}:R>`,
          inline: false,
        });
      }
    } else if (tile?.npc_id) {
      // NPC at location
      const npc = await db('npcs').select('*').where('id', tile.npc_id).first();
      if (!npc) {
        await context.interaction.reply({ content: '❌ NPC not found.', ephemeral: true });
        return;
      }

      const npcTroops = typeof npc.troops === 'string' ? JSON.parse(npc.troops) : npc.troops;
      const npcRewards = typeof npc.rewards === 'string' ? JSON.parse(npc.rewards) : npc.rewards;

      const scoutResult = combatService.scoutLocation(npcTroops, null, null);

      embed = new EmbedBuilder()
        .setTitle(`🔭 Scout Report: ${npc.name}`)
        .setColor('#8B0000')
        .addFields(
          { name: '📍 Location', value: `(${targetX}, ${targetY})`, inline: true },
          { name: '👹 Type', value: npc.type.replace('_', ' ').toUpperCase(), inline: true },
          { name: '💪 Power', value: scoutResult.power.toLocaleString(), inline: true },
          { name: '⚔️ Troops', value: scoutResult.troops.map(t => `T${t.tier}: ${t.count}`).join('\n'), inline: true },
          {
            name: '💰 Potential Rewards',
            value: `🌾 ~${npcRewards.food} Food\n⚒️ ~${npcRewards.iron} Iron\n💰 ~${npcRewards.gold} Gold`,
            inline: true,
          }
        );
    } else {
      // Empty tile
      const terrain = tile?.terrain ?? 'plains';
      embed = new EmbedBuilder()
        .setTitle('🔭 Scout Report: Empty Location')
        .setColor('#228B22')
        .addFields(
          { name: '📍 Location', value: `(${targetX}, ${targetY})`, inline: true },
          { name: '🏞️ Terrain', value: terrain.charAt(0).toUpperCase() + terrain.slice(1), inline: true }
        )
        .setDescription('This location is unoccupied.');
    }

    embed.setTimestamp().setFooter({ text: 'Scout reports show approximate enemy strength' });

    // Update daily quest progress for scouting
    await DailyQuestService.updateProgress(player.id, 'scout_location', 1);

    // Log activity
    await ActivityLogService.log(
      player.id,
      'scout',
      `Scouted location (${targetX}, ${targetY})`,
      undefined,
      { targetLocation: { x: targetX, y: targetY } }
    );

    await context.interaction.reply({ embeds: [embed] });
  },
};
