import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  type SlashCommandIntegerOption,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { combatService, type CombatContext } from '../../../domain/services/CombatService.js';
import { npcService, type NpcType, NPC_TYPES } from '../../../domain/services/NpcService.js';
import { Hero } from '../../../domain/entities/Hero.js';
import type { Faction, TroopTier, Resources, Element, HeroRarity } from '../../../shared/types/index.js';
import { MAP_SIZE } from '../../../shared/constants/game.js';
import type { Knex } from 'knex';

// Hero shard drop chances by NPC type
const HERO_SHARD_DROP_CHANCE: Record<NpcType, number> = {
  bandit_camp: 0.05,    // 5% chance
  goblin_outpost: 0.10, // 10% chance
  dragon_lair: 0.20,    // 20% chance
};

// Hero shard amounts by NPC type
const HERO_SHARD_AMOUNTS: Record<NpcType, { min: number; max: number }> = {
  bandit_camp: { min: 1, max: 2 },
  goblin_outpost: { min: 2, max: 4 },
  dragon_lair: { min: 3, max: 6 },
};

// Element emojis
const ELEMENT_EMOJI: Record<Element, string> = {
  fire: '🔥',
  water: '💧',
  wind: '🌪️',
};

// Rarity emojis
const RARITY_EMOJI: Record<HeroRarity, string> = {
  common: '⚪',
  rare: '🟢',
  epic: '🟣',
  legendary: '🟡',
};

interface TroopRow {
  tier: number;
  count: number;
  wounded: number;
}

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

// Store pending attacks for select menu flow
const pendingAttacks = new Map<string, {
  attackerId: string;
  targetX: number;
  targetY: number;
  troopCount: number;
  expiresAt: number;
}>();

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
    .addIntegerOption((option: SlashCommandIntegerOption) =>
      option.setName('troops').setDescription('Number of troops to send (uses highest tier available)').setRequired(true).setMinValue(1).setMaxValue(500)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const targetX = context.interaction.options.getInteger('x', true);
    const targetY = context.interaction.options.getInteger('y', true);
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

    // Get target tile to show what we're attacking
    const targetTile = await db('map_tiles')
      .select('*')
      .where({ x: targetX, y: targetY })
      .first();

    let targetName = 'Unknown';
    let targetInfo = '';

    if (targetTile?.occupant_id) {
      const defenderPlayer = await db('players').select('username', 'faction', 'protection_until').where('id', targetTile.occupant_id).first();
      if (defenderPlayer) {
        if (defenderPlayer.protection_until && new Date(defenderPlayer.protection_until) > new Date()) {
          await context.interaction.editReply({
            content: `❌ **${defenderPlayer.username}** is under protection until <t:${Math.floor(new Date(defenderPlayer.protection_until).getTime() / 1000)}:R>`,
          });
          return;
        }
        targetName = defenderPlayer.username;
        targetInfo = `Player (${defenderPlayer.faction})`;
      }
    } else if (targetTile?.npc_id) {
      const npc = await db('npcs').select('name', 'type', 'power').where('id', targetTile.npc_id).first();
      if (npc) {
        targetName = npc.name;
        targetInfo = `${NPC_TYPES[npc.type as NpcType]?.name ?? 'NPC'} (Power: ${npc.power})`;
      }
    } else {
      await context.interaction.editReply({ content: '❌ Nothing to attack at that location!' });
      return;
    }

    // Get troops to verify we have enough
    const troops: TroopRow[] = await db('troops')
      .select('tier', 'count', 'wounded')
      .where('player_id', attacker.id)
      .orderBy('tier', 'desc');

    const totalAvailable = troops.reduce((sum, t) => sum + t.count, 0);
    if (totalAvailable < troopCount) {
      await context.interaction.editReply({
        content: `❌ Not enough troops! You have ${totalAvailable} available, tried to send ${troopCount}.`,
      });
      return;
    }

    // Get player's heroes for selection
    const heroes: HeroRow[] = await db('heroes')
      .select('*')
      .where('player_id', attacker.id)
      .orderBy('level', 'desc')
      .limit(25);

    if (heroes.length === 0) {
      await context.interaction.editReply({ content: '❌ You don\'t have any heroes! Use `/heroes summon` to get one.' });
      return;
    }

    // Store pending attack
    const pendingKey = `${discordId}_attack`;
    pendingAttacks.set(pendingKey, {
      attackerId: attacker.id,
      targetX,
      targetY,
      troopCount,
      expiresAt: Date.now() + 60000, // 1 minute expiry
    });

    // Build hero select menu
    const heroOptions = heroes.map(h => ({
      label: `${h.name} (Lv.${h.level})`,
      description: `${ELEMENT_EMOJI[h.element]} ${h.element} | ATK: ${h.attack} | DEF: ${h.defense}`,
      value: h.id.toString(),
      emoji: RARITY_EMOJI[h.rarity],
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`attack:hero_select:${discordId}`)
      .setPlaceholder('Select a hero to lead the attack')
      .addOptions(heroOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const cancelButton = new ButtonBuilder()
      .setCustomId(`attack:cancel:${discordId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

    // Build preview embed
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Prepare Attack')
      .setColor('#FF6600')
      .setDescription(`**Target:** ${targetName}\n${targetInfo}\n**Location:** (${targetX}, ${targetY})`)
      .addFields(
        { name: '🪖 Troops', value: `${troopCount} troops (highest tier first)`, inline: true },
        { name: '📍 Distance', value: `${Math.round(Math.sqrt(Math.pow(targetX - attacker.coord_x, 2) + Math.pow(targetY - attacker.coord_y, 2)))} tiles`, inline: true }
      )
      .setFooter({ text: 'Select a hero to lead the attack' });

    const response = await context.interaction.editReply({
      embeds: [embed],
      components: [row, buttonRow],
    });

    // Set up collector for the select menu
    const collector = response.createMessageComponentCollector({
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== discordId) {
        await i.reply({ content: '❌ This is not your attack!', flags: 64 });
        return;
      }

      if (i.isButton() && i.customId === `attack:cancel:${discordId}`) {
        pendingAttacks.delete(pendingKey);
        await i.update({
          content: '❌ Attack cancelled.',
          embeds: [],
          components: [],
        });
        collector.stop();
        return;
      }

      if (i.isStringSelectMenu() && i.customId === `attack:hero_select:${discordId}`) {
        const heroId = i.values[0];
        await executeAttack(i, attacker, heroId, targetX, targetY, troopCount);
        pendingAttacks.delete(pendingKey);
        collector.stop();
      }
    });

    collector.on('end', (_collected, reason) => {
      if (reason === 'time') {
        pendingAttacks.delete(pendingKey);
        context.interaction.editReply({
          content: '❌ Attack timed out. Please try again.',
          embeds: [],
          components: [],
        }).catch(() => {});
      }
    });
  },
};

async function executeAttack(
  interaction: StringSelectMenuInteraction,
  attacker: { id: string; username: string; faction: string; coord_x: number; coord_y: number; resources: string | object },
  heroId: string,
  targetX: number,
  targetY: number,
  troopCount: number
): Promise<void> {
  const db = getDatabase();

  await interaction.deferUpdate();

  // Get hero
  const heroRow = await db('heroes')
    .select('*')
    .where('id', heroId)
    .where('player_id', attacker.id)
    .first();

  if (!heroRow) {
    await interaction.editReply({ content: '❌ Hero not found!', embeds: [], components: [] });
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
    await interaction.editReply({
      content: `❌ Not enough troops! You have ${totalAvailable} available, tried to send ${troopCount}.`,
      embeds: [],
      components: [],
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
    npcType: NpcType | null;
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
      await interaction.editReply({ content: '❌ Target location is empty.', embeds: [], components: [] });
      return;
    }

    // Check defender protection
    if (defenderPlayer.protection_until && new Date(defenderPlayer.protection_until) > new Date()) {
      await interaction.editReply({
        content: `❌ **${defenderPlayer.username}** is under protection until <t:${Math.floor(new Date(defenderPlayer.protection_until).getTime() / 1000)}:R>`,
        embeds: [],
        components: [],
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
      npcType: null,
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
      await interaction.editReply({ content: '❌ Target NPC not found.', embeds: [], components: [] });
      return;
    }

    const npcTroops = typeof npc.troops === 'string' ? JSON.parse(npc.troops) : npc.troops;
    const npcRewards = typeof npc.rewards === 'string' ? JSON.parse(npc.rewards) : npc.rewards;

    defender = {
      playerId: null,
      npcId: BigInt(npc.id),
      npcType: npc.type as NpcType,
      faction: null,
      hero: null,
      troops: Array.isArray(npcTroops) ? npcTroops : [],
      resources: npcRewards,
      name: npc.name,
    };
  } else {
    await interaction.editReply({ content: '❌ Nothing to attack at that location!', embeds: [], components: [] });
    return;
  }

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

  // Track hero shard drops for NPC battles
  let heroShardsDropped = 0;
  let heroShardType = '';

  // Apply results to database
  await db.transaction(async (trx: Knex.Transaction) => {
    // Update attacker troops
    for (const sent of troopsToSend) {
      const dead = result.attackerCasualties.dead.find(d => d.tier === sent.tier)?.count ?? 0;
      const wounded = result.attackerCasualties.wounded.find(w => w.tier === sent.tier)?.count ?? 0;

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

    // Handle NPC defeat - mark for respawn and check for hero shard drops
    if (defender.npcId && defender.npcType && result.winner === 'attacker') {
      await npcService.defeatNpc(defender.npcId.toString());

      // Check for hero shard drop
      const dropChance = HERO_SHARD_DROP_CHANCE[defender.npcType];
      if (Math.random() < dropChance) {
        const shardRange = HERO_SHARD_AMOUNTS[defender.npcType];
        heroShardsDropped = Math.floor(Math.random() * (shardRange.max - shardRange.min + 1)) + shardRange.min;
        
        // Determine shard type based on NPC type
        const npcTypeInfo = NPC_TYPES[defender.npcType];
        heroShardType = `${npcTypeInfo.name} Loot`;

        // Add shards to player
        const existingShard = await trx('hero_shards')
          .select('id', 'count')
          .where('player_id', attacker.id)
          .where('hero_name', heroShardType)
          .first();

        if (existingShard) {
          await trx('hero_shards')
            .where('id', existingShard.id)
            .increment('count', heroShardsDropped);
        } else {
          await trx('hero_shards').insert({
            player_id: attacker.id,
            hero_name: heroShardType,
            count: heroShardsDropped,
          });
        }
      }
    }

    // Record battle - convert BigInt to string for JSON serialization
    const attackerData = {
      playerId: attacker.id,
      faction: attacker.faction,
      hero: {
        id: hero.id.toString(),
        name: hero.name,
        level: hero.level,
      },
      troops: troopsToSend,
    };

    const defenderData = {
      playerId: defender.playerId?.toString() ?? null,
      npcId: defender.npcId?.toString() ?? null,
      faction: defender.faction,
      hero: defender.hero ? {
        id: defender.hero.id.toString(),
        name: defender.hero.name,
        level: defender.hero.level,
      } : null,
      troops: defender.troops,
    };

    await trx('battles').insert({
      type: combatContext.battleType,
      attacker_id: attacker.id,
      defender_id: defender.playerId?.toString() ?? null,
      npc_id: defender.npcId?.toString() ?? null,
      location_x: targetX,
      location_y: targetY,
      attacker_army: JSON.stringify(attackerData),
      defender_army: JSON.stringify(defenderData),
      result: JSON.stringify({
        winner: result.winner,
        attackerInitialPower: result.attackerInitialPower,
        defenderInitialPower: result.defenderInitialPower,
        loot: result.loot,
        heroXpGained: result.heroXpGained,
      }),
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
          `Troops: ${defender.troops.length > 0 ? defender.troops.map(t => `T${t.tier}×${t.count}`).join(', ') : 'None'}`,
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

  // Add hero shard drop (NPC only)
  if (heroShardsDropped > 0) {
    embed.addFields({
      name: '✨ Rare Drop!',
      value: `You found **${heroShardsDropped}** Hero Shards (${heroShardType})!`,
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
  await interaction.editReply({ embeds: [embed], components: [] });
}
