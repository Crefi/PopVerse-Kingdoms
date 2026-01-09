import {
  SlashCommandBuilder,
  EmbedBuilder,
  type SlashCommandIntegerOption,
  type SlashCommandStringOption,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { combatService, type CombatContext } from '../../../domain/services/CombatService.js';
import { Hero } from '../../../domain/entities/Hero.js';
import type { Faction, TroopTier, Resources } from '../../../shared/types/index.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';
import type { Knex } from 'knex';

interface TroopRow {
  tier: number;
  count: number;
  wounded: number;
}

export const attackCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('attack')
    .setDescription('Attack a location on the map')
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('x').setDescription('X coordinate').setRequired(true).setMinValue(0).setMaxValue(MAP_SIZE - 1)
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('y').setDescription('Y coordinate').setRequired(true).setMinValue(0).setMaxValue(MAP_SIZE - 1)
    )
    .addStringOption((option: SlashCommandStringOption) =>
      option.setName('hero').setDescription('Hero to lead the attack').setRequired(true)
    )
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('troops').setDescription('Number of troops to send (uses highest tier available)').setRequired(true).setMinValue(1).setMaxValue(500)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const targetX = context.interaction.options.getInteger('x', true);
    const targetY = context.interaction.options.getInteger('y', true);
    const heroName = context.interaction.options.getString('hero', true);
    const troopCount = context.interaction.options.getInteger('troops', true);

    await context.interaction.deferReply();

    // Get attacker data
    const attacker = await db('players').select('*').where('discord_id', discordId).first();
    if (!attacker) {
      await context.interaction.editReply({ content: '❌ You haven\'t started yet! Use `/begin`' });
      return;
    }

    // Check protection
    if (attacker.protection_until && new Date(attacker.protection_until) > new Date()) {
      await context.interaction.editReply({
        content: '❌ You cannot attack while under protection! Your shield expires <t:' +
          Math.floor(new Date(attacker.protection_until).getTime() / 1000) + ':R>',
      });
      return;
    }

    // Check if attacking own location
    if (attacker.coord_x === targetX && attacker.coord_y === targetY) {
      await context.interaction.editReply({ content: '❌ You cannot attack your own city!' });
      return;
    }

    // Get hero
    const heroRow = await db('heroes')
      .select('*')
      .where('player_id', attacker.id)
      .whereRaw('LOWER(name) LIKE ?', [`%${heroName.toLowerCase()}%`])
      .first();

    if (!heroRow) {
      await context.interaction.editReply({ content: `❌ Hero "${heroName}" not found in your roster.` });
      return;
    }

    const hero = new Hero({
      ...heroRow,
      id: BigInt(heroRow.id),
      playerId: BigInt(heroRow.player_id),
      skills: typeof heroRow.skills === 'string' ? JSON.parse(heroRow.skills) : heroRow.skills,
      gear: typeof heroRow.gear === 'string' ? JSON.parse(heroRow.gear) : heroRow.gear,
      createdAt: new Date(heroRow.created_at),
    });

    // Get troops
    const troops: TroopRow[] = await db('troops')
      .select('tier', 'count', 'wounded')
      .where('player_id', attacker.id)
      .orderBy('tier', 'desc');

    // Select troops (highest tier first)
    let remainingToSend = troopCount;
    const troopsToSend: { tier: TroopTier; count: number }[] = [];

    for (const troop of troops) {
      if (remainingToSend <= 0) break;
      const available = troop.count;
      const toSend = Math.min(available, remainingToSend);
      if (toSend > 0) {
        troopsToSend.push({ tier: troop.tier as TroopTier, count: toSend });
        remainingToSend -= toSend;
      }
    }

    if (remainingToSend > 0) {
      const totalAvailable = troops.reduce((sum, t) => sum + t.count, 0);
      await context.interaction.editReply({
        content: `❌ Not enough troops! You have ${totalAvailable} available, tried to send ${troopCount}.`,
      });
      return;
    }

    // Get target tile
    const targetTile = await db('map_tiles')
      .select('*')
      .where({ x: targetX, y: targetY })
      .first();

    // Check what's at the target
    let defender: {
      playerId: bigint | null;
      npcId: bigint | null;
      faction: Faction | null;
      hero: Hero | null;
      troops: { tier: TroopTier; count: number }[];
      resources: Resources;
      name: string;
    } | null = null;

    if (targetTile?.occupant_id) {
      // Player target
      const defenderPlayer = await db('players').select('*').where('id', targetTile.occupant_id).first();
      if (!defenderPlayer) {
        await context.interaction.editReply({ content: '❌ Target location is empty.' });
        return;
      }

      // Check defender protection
      if (defenderPlayer.protection_until && new Date(defenderPlayer.protection_until) > new Date()) {
        await context.interaction.editReply({
          content: `❌ **${defenderPlayer.username}** is under protection until <t:${Math.floor(new Date(defenderPlayer.protection_until).getTime() / 1000)}:R>`,
        });
        return;
      }

      // Get defender's troops and hero
      const defenderTroops: TroopRow[] = await db('troops')
        .select('tier', 'count')
        .where('player_id', defenderPlayer.id);

      const defenderHeroRow = await db('heroes')
        .select('*')
        .where('player_id', defenderPlayer.id)
        .orderBy('level', 'desc')
        .first();

      let defenderHero: Hero | null = null;
      if (defenderHeroRow) {
        defenderHero = new Hero({
          ...defenderHeroRow,
          id: BigInt(defenderHeroRow.id),
          playerId: BigInt(defenderHeroRow.player_id),
          skills: typeof defenderHeroRow.skills === 'string' ? JSON.parse(defenderHeroRow.skills) : defenderHeroRow.skills,
          gear: typeof defenderHeroRow.gear === 'string' ? JSON.parse(defenderHeroRow.gear) : defenderHeroRow.gear,
          createdAt: new Date(defenderHeroRow.created_at),
        });
      }

      const defResources = typeof defenderPlayer.resources === 'string'
        ? JSON.parse(defenderPlayer.resources)
        : defenderPlayer.resources;

      defender = {
        playerId: BigInt(defenderPlayer.id),
        npcId: null,
        faction: defenderPlayer.faction as Faction,
        hero: defenderHero,
        troops: defenderTroops.map(t => ({ tier: t.tier as TroopTier, count: t.count })),
        resources: defResources,
        name: defenderPlayer.username,
      };
    } else if (targetTile?.npc_id) {
      // NPC target
      const npc = await db('npcs').select('*').where('id', targetTile.npc_id).first();
      if (!npc) {
        await context.interaction.editReply({ content: '❌ Target NPC not found.' });
        return;
      }

      const npcTroops = typeof npc.troops === 'string' ? JSON.parse(npc.troops) : npc.troops;
      const npcRewards = typeof npc.rewards === 'string' ? JSON.parse(npc.rewards) : npc.rewards;

      defender = {
        playerId: null,
        npcId: BigInt(npc.id),
        faction: null,
        hero: null,
        troops: npcTroops,
        resources: npcRewards,
        name: npc.name,
      };
    } else {
      await context.interaction.editReply({ content: '❌ Nothing to attack at that location!' });
      return;
    }

    // Calculate march time based on distance (for future use with BullMQ)
    // const _distance = Math.sqrt(
    //   Math.pow(targetX - attacker.coord_x, 2) + Math.pow(targetY - attacker.coord_y, 2)
    // );

    // For MVP, resolve battle immediately (skip march time)
    const combatContext: CombatContext = {
      battleType: defender.npcId ? 'pve' : 'pvp',
      location: { x: targetX, y: targetY },
      attacker: {
        playerId: BigInt(attacker.id),
        faction: attacker.faction as Faction,
        hero,
        troops: troopsToSend,
      },
      defender: {
        playerId: defender.playerId,
        npcId: defender.npcId,
        faction: defender.faction,
        hero: defender.hero,
        troops: defender.troops,
        resources: defender.resources,
      },
      terrainBonus: 1.0,
      seed: Date.now(),
    };

    const result = combatService.resolveBattle(combatContext);

    // Apply results to database
    await db.transaction(async (trx: Knex.Transaction) => {
      // Update attacker troops
      for (const sent of troopsToSend) {
        const dead = result.attackerCasualties.dead.find(d => d.tier === sent.tier)?.count ?? 0;
        const wounded = result.attackerCasualties.wounded.find(w => w.tier === sent.tier)?.count ?? 0;
        // remaining = sent.count - dead - wounded (for future use)

        await trx('troops')
          .where('player_id', attacker.id)
          .where('tier', sent.tier)
          .update({
            count: trx.raw('count - ?', [dead + wounded]),
            wounded: trx.raw('wounded + ?', [wounded]),
          });
      }

      // Update attacker resources (add loot)
      if (result.winner === 'attacker') {
        const attackerResources = typeof attacker.resources === 'string'
          ? JSON.parse(attacker.resources)
          : attacker.resources;

        await trx('players')
          .where('id', attacker.id)
          .update({
            resources: JSON.stringify({
              food: attackerResources.food + result.loot.food,
              iron: attackerResources.iron + result.loot.iron,
              gold: attackerResources.gold + result.loot.gold,
            }),
          });
      }

      // Update defender (if player)
      if (defender.playerId) {
        for (const troop of defender.troops) {
          const dead = result.defenderCasualties.dead.find(d => d.tier === troop.tier)?.count ?? 0;
          const wounded = result.defenderCasualties.wounded.find(w => w.tier === troop.tier)?.count ?? 0;

          await trx('troops')
            .where('player_id', defender.playerId.toString())
            .where('tier', troop.tier)
            .update({
              count: trx.raw('count - ?', [dead + wounded]),
              wounded: trx.raw('wounded + ?', [wounded]),
            });
        }

        // Deduct loot from defender
        if (result.winner === 'attacker') {
          await trx('players')
            .where('id', defender.playerId.toString())
            .update({
              resources: JSON.stringify({
                food: Math.max(0, defender.resources.food - result.loot.food),
                iron: Math.max(0, defender.resources.iron - result.loot.iron),
                gold: Math.max(0, defender.resources.gold - result.loot.gold),
              }),
            });
        }
      }

      // Update hero XP
      if (result.heroXpGained > 0) {
        await trx('heroes')
          .where('id', heroRow.id)
          .update({ experience: trx.raw('experience + ?', [result.heroXpGained]) });
      }

      // Record battle
      await trx('battles').insert({
        type: combatContext.battleType,
        attacker_id: attacker.id,
        defender_id: defender.playerId?.toString() ?? null,
        npc_id: defender.npcId?.toString() ?? null,
        location_x: targetX,
        location_y: targetY,
        attacker_army: JSON.stringify(combatContext.attacker),
        defender_army: JSON.stringify(combatContext.defender),
        result: JSON.stringify(result),
      });
    });

    // Build battle report embed
    const isVictory = result.winner === 'attacker';
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Battle Report: ${isVictory ? '✅ VICTORY!' : '❌ DEFEAT'}`)
      .setColor(isVictory ? '#00FF00' : '#FF0000')
      .setDescription(
        `**${attacker.username}** vs **${defender.name}**\n` +
        `Location: (${targetX}, ${targetY})`
      )
      .addFields(
        {
          name: '⚔️ Your Army',
          value: `Power: ${result.attackerInitialPower.toLocaleString()} → ${result.attackerFinalPower.toLocaleString()}\n` +
            `Hero: ${hero.name} (Lv.${hero.level})\n` +
            `Troops: ${troopsToSend.map(t => `T${t.tier}×${t.count}`).join(', ')}`,
          inline: true,
        },
        {
          name: '🛡️ Enemy Army',
          value: `Power: ${result.defenderInitialPower.toLocaleString()} → ${result.defenderFinalPower.toLocaleString()}\n` +
            `Hero: ${defender.hero?.name ?? 'None'}\n` +
            `Troops: ${defender.troops.map(t => `T${t.tier}×${t.count}`).join(', ')}`,
          inline: true,
        }
      );

    // Add elemental advantage
    if (result.elementalAdvantage !== 'none') {
      embed.addFields({
        name: '🔥 Elemental Advantage',
        value: result.elementalAdvantage === 'attacker' ? '✅ You had the advantage (+25% damage)' : '❌ Enemy had the advantage (+25% damage)',
        inline: false,
      });
    }

    // Add casualties
    const attackerDeadStr = result.attackerCasualties.dead.map(d => `T${d.tier}×${d.count}`).join(', ') || 'None';
    const attackerWoundedStr = result.attackerCasualties.wounded.map(w => `T${w.tier}×${w.count}`).join(', ') || 'None';
    const defenderDeadStr = result.defenderCasualties.dead.map(d => `T${d.tier}×${d.count}`).join(', ') || 'None';

    embed.addFields(
      {
        name: '💀 Your Casualties',
        value: `Dead: ${attackerDeadStr}\nWounded: ${attackerWoundedStr}`,
        inline: true,
      },
      {
        name: '💀 Enemy Casualties',
        value: `Dead: ${defenderDeadStr}`,
        inline: true,
      }
    );

    // Add loot if victory
    if (isVictory && (result.loot.food > 0 || result.loot.iron > 0 || result.loot.gold > 0)) {
      embed.addFields({
        name: '💰 Loot Captured',
        value: `🌾 ${result.loot.food.toLocaleString()} Food\n⚒️ ${result.loot.iron.toLocaleString()} Iron\n💰 ${result.loot.gold.toLocaleString()} Gold`,
        inline: false,
      });
    }

    // Add hero XP
    if (result.heroXpGained > 0) {
      embed.addFields({
        name: '⭐ Hero XP',
        value: `${hero.name} gained **${result.heroXpGained}** XP`,
        inline: false,
      });
    }

    // Add skills activated
    if (result.skillsActivated.length > 0) {
      embed.addFields({
        name: '✨ Skills Activated',
        value: result.skillsActivated.map(s => `**${s.hero}**: ${s.skill} - ${s.effect}`).join('\n'),
        inline: false,
      });
    }

    embed.setTimestamp();
    await context.interaction.editReply({ embeds: [embed] });
  },
};
