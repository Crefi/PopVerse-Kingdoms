import { getDatabase } from '../../infrastructure/database/connection.js';
import { Hero } from '../entities/Hero.js';
import { combatService, type CombatContext } from './CombatService.js';
import type { Faction, TroopTier, Resources } from '../../shared/types/index.js';

// Rally constants
export const RALLY_JOIN_WINDOW_MINUTES = 10;
export const RALLY_MAX_PARTICIPANTS = 5;

interface RallyRow {
  id: string;
  guild_id: string;
  leader_id: string;
  target_x: number;
  target_y: number;
  target_player_id: string | null;
  target_npc_id: string | null;
  starts_at: Date;
  launches_at: Date;
  launched: boolean;
  completed: boolean;
  result: string | object | null;
  created_at: Date;
}

interface RallyParticipantRow {
  id: string;
  rally_id: string;
  player_id: string;
  hero_id: string | null;
  troops: string | object;
  joined_at: Date;
}

export interface RallyInfo {
  id: string;
  guildId: string;
  leaderId: string;
  leaderName: string;
  targetX: number;
  targetY: number;
  targetName: string;
  targetPower: number;
  startsAt: Date;
  launchesAt: Date;
  launched: boolean;
  completed: boolean;
  participants: RallyParticipant[];
  totalPower: number;
}

export interface RallyParticipant {
  playerId: string;
  username: string;
  heroName: string | null;
  troops: { tier: TroopTier; count: number }[];
  power: number;
  joinedAt: Date;
}

export interface RallyResult {
  success: boolean;
  error?: string;
  rally?: RallyInfo;
}

export class RallyService {
  /**
   * Start a new rally
   */
  async startRally(
    leaderId: string,
    targetX: number,
    targetY: number,
    heroId: string | null,
    troops: { tier: TroopTier; count: number }[]
  ): Promise<RallyResult> {
    const db = getDatabase();

    // Check if player is in a guild
    const membership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', leaderId)
      .first();

    if (!membership) {
      return { success: false, error: 'You must be in a guild to start a rally.' };
    }

    // Check if player is leader or officer
    if (membership.role === 'member') {
      return { success: false, error: 'Only guild leaders and officers can start rallies.' };
    }

    // Check if there's already an active rally for this guild
    const existingRally = await db('guild_rallies')
      .where('guild_id', membership.guild_id)
      .where('completed', false)
      .first();

    if (existingRally) {
      return { success: false, error: 'Your guild already has an active rally. Wait for it to complete or cancel it.' };
    }

    // Validate target
    const targetTile = await db('map_tiles')
      .select('*')
      .where({ x: targetX, y: targetY })
      .first();

    if (!targetTile?.occupant_id && !targetTile?.npc_id) {
      return { success: false, error: 'Nothing to attack at that location!' };
    }

    // Validate troops
    if (troops.length === 0 || troops.every(t => t.count === 0)) {
      return { success: false, error: 'You must send at least some troops.' };
    }

    // Check player has enough troops
    const playerTroops = await db('troops')
      .select('tier', 'count')
      .where('player_id', leaderId);

    for (const sent of troops) {
      const available = playerTroops.find(t => t.tier === sent.tier)?.count ?? 0;
      if (available < sent.count) {
        return { success: false, error: `Not enough T${sent.tier} troops. You have ${available}.` };
      }
    }

    // Create rally
    const now = new Date();
    const launchesAt = new Date(now.getTime() + RALLY_JOIN_WINDOW_MINUTES * 60 * 1000);

    const [rally] = await db('guild_rallies')
      .insert({
        guild_id: membership.guild_id,
        leader_id: leaderId,
        target_x: targetX,
        target_y: targetY,
        target_player_id: targetTile.occupant_id,
        target_npc_id: targetTile.npc_id,
        starts_at: now,
        launches_at: launchesAt,
      })
      .returning('*');

    // Add leader as first participant
    await db('rally_participants').insert({
      rally_id: rally.id,
      player_id: leaderId,
      hero_id: heroId,
      troops: JSON.stringify(troops),
    });

    // Deduct troops from leader
    for (const sent of troops) {
      await db('troops')
        .where('player_id', leaderId)
        .where('tier', sent.tier)
        .decrement('count', sent.count);
    }

    const rallyInfo = await this.getRallyInfo(rally.id.toString());
    return { success: true, rally: rallyInfo! };
  }

  /**
   * Join an existing rally
   */
  async joinRally(
    playerId: string,
    rallyId: string,
    heroId: string | null,
    troops: { tier: TroopTier; count: number }[]
  ): Promise<RallyResult> {
    const db = getDatabase();

    // Get rally
    const rally = await db('guild_rallies')
      .select('*')
      .where('id', rallyId)
      .first() as RallyRow | undefined;

    if (!rally) {
      return { success: false, error: 'Rally not found.' };
    }

    if (rally.launched || rally.completed) {
      return { success: false, error: 'This rally has already launched.' };
    }

    // Check if join window has passed
    if (new Date() > new Date(rally.launches_at)) {
      return { success: false, error: 'The join window for this rally has closed.' };
    }

    // Check if player is in the same guild
    const membership = await db('guild_members')
      .select('guild_id')
      .where('player_id', playerId)
      .first();

    if (!membership || membership.guild_id !== rally.guild_id) {
      return { success: false, error: 'You must be in the same guild to join this rally.' };
    }

    // Check if already participating
    const existing = await db('rally_participants')
      .where('rally_id', rallyId)
      .where('player_id', playerId)
      .first();

    if (existing) {
      return { success: false, error: 'You are already participating in this rally.' };
    }

    // Check participant limit
    const participantCount = await db('rally_participants')
      .where('rally_id', rallyId)
      .count('* as count')
      .first();

    if (parseInt(participantCount?.count as string, 10) >= RALLY_MAX_PARTICIPANTS) {
      return { success: false, error: `Rally is full (max ${RALLY_MAX_PARTICIPANTS} participants).` };
    }

    // Validate troops
    if (troops.length === 0 || troops.every(t => t.count === 0)) {
      return { success: false, error: 'You must send at least some troops.' };
    }

    // Check player has enough troops
    const playerTroops = await db('troops')
      .select('tier', 'count')
      .where('player_id', playerId);

    for (const sent of troops) {
      const available = playerTroops.find(t => t.tier === sent.tier)?.count ?? 0;
      if (available < sent.count) {
        return { success: false, error: `Not enough T${sent.tier} troops. You have ${available}.` };
      }
    }

    // Add participant
    await db('rally_participants').insert({
      rally_id: rallyId,
      player_id: playerId,
      hero_id: heroId,
      troops: JSON.stringify(troops),
    });

    // Deduct troops
    for (const sent of troops) {
      await db('troops')
        .where('player_id', playerId)
        .where('tier', sent.tier)
        .decrement('count', sent.count);
    }

    const rallyInfo = await this.getRallyInfo(rallyId);
    return { success: true, rally: rallyInfo! };
  }

  /**
   * Get rally information
   */
  async getRallyInfo(rallyId: string): Promise<RallyInfo | null> {
    const db = getDatabase();

    const rally = await db('guild_rallies')
      .select('guild_rallies.*', 'players.username as leader_name')
      .join('players', 'guild_rallies.leader_id', 'players.id')
      .where('guild_rallies.id', rallyId)
      .first() as (RallyRow & { leader_name: string }) | undefined;

    if (!rally) return null;

    // Get target info
    let targetName = 'Unknown';
    let targetPower = 0;

    if (rally.target_player_id) {
      const target = await db('players')
        .select('username')
        .where('id', rally.target_player_id)
        .first();
      targetName = target?.username ?? 'Unknown Player';
      
      // Calculate target power from troops
      const targetTroops = await db('troops')
        .select('tier', 'count')
        .where('player_id', rally.target_player_id);
      targetPower = this.calculateTroopPower(targetTroops.map(t => ({ tier: t.tier as TroopTier, count: t.count })));
    } else if (rally.target_npc_id) {
      const npc = await db('npcs')
        .select('name', 'power')
        .where('id', rally.target_npc_id)
        .first();
      targetName = npc?.name ?? 'Unknown NPC';
      targetPower = npc?.power ?? 0;
    }

    // Get participants
    const participantRows = await db('rally_participants')
      .select(
        'rally_participants.*',
        'players.username',
        'heroes.name as hero_name'
      )
      .join('players', 'rally_participants.player_id', 'players.id')
      .leftJoin('heroes', 'rally_participants.hero_id', 'heroes.id')
      .where('rally_participants.rally_id', rallyId) as (RallyParticipantRow & { username: string; hero_name: string | null })[];

    const participants: RallyParticipant[] = participantRows.map(p => {
      const troops = typeof p.troops === 'string' ? JSON.parse(p.troops) : p.troops;
      return {
        playerId: p.player_id,
        username: p.username,
        heroName: p.hero_name,
        troops,
        power: this.calculateTroopPower(troops),
        joinedAt: p.joined_at,
      };
    });

    const totalPower = participants.reduce((sum, p) => sum + p.power, 0);

    return {
      id: rally.id,
      guildId: rally.guild_id,
      leaderId: rally.leader_id,
      leaderName: rally.leader_name,
      targetX: rally.target_x,
      targetY: rally.target_y,
      targetName,
      targetPower,
      startsAt: rally.starts_at,
      launchesAt: rally.launches_at,
      launched: rally.launched,
      completed: rally.completed,
      participants,
      totalPower,
    };
  }

  /**
   * Get active rally for a guild
   */
  async getActiveRally(guildId: string): Promise<RallyInfo | null> {
    const db = getDatabase();

    const rally = await db('guild_rallies')
      .select('id')
      .where('guild_id', guildId)
      .where('completed', false)
      .first();

    if (!rally) return null;

    return this.getRallyInfo(rally.id.toString());
  }

  /**
   * Cancel a rally (leader only)
   */
  async cancelRally(playerId: string, rallyId: string): Promise<{ success: boolean; error?: string }> {
    const db = getDatabase();

    const rally = await db('guild_rallies')
      .select('*')
      .where('id', rallyId)
      .first() as RallyRow | undefined;

    if (!rally) {
      return { success: false, error: 'Rally not found.' };
    }

    if (rally.leader_id !== playerId) {
      return { success: false, error: 'Only the rally leader can cancel it.' };
    }

    if (rally.launched || rally.completed) {
      return { success: false, error: 'Cannot cancel a rally that has already launched.' };
    }

    // Return troops to all participants
    const participants = await db('rally_participants')
      .select('player_id', 'troops')
      .where('rally_id', rallyId) as { player_id: string; troops: string | object }[];

    await db.transaction(async (trx) => {
      for (const p of participants) {
        const troops = typeof p.troops === 'string' ? JSON.parse(p.troops) : p.troops;
        for (const t of troops) {
          await trx('troops')
            .where('player_id', p.player_id)
            .where('tier', t.tier)
            .increment('count', t.count);
        }
      }

      // Delete rally
      await trx('rally_participants').where('rally_id', rallyId).delete();
      await trx('guild_rallies').where('id', rallyId).delete();
    });

    return { success: true };
  }

  /**
   * Launch a rally (called when timer expires or manually by leader)
   */
  async launchRally(rallyId: string): Promise<{ success: boolean; error?: string; result?: object }> {
    const db = getDatabase();

    const rally = await db('guild_rallies')
      .select('*')
      .where('id', rallyId)
      .first() as RallyRow | undefined;

    if (!rally) {
      return { success: false, error: 'Rally not found.' };
    }

    if (rally.launched || rally.completed) {
      return { success: false, error: 'Rally has already been launched.' };
    }

    // Get all participants
    const participants = await db('rally_participants')
      .select('rally_participants.*', 'heroes.*', 'players.faction')
      .leftJoin('heroes', 'rally_participants.hero_id', 'heroes.id')
      .join('players', 'rally_participants.player_id', 'players.id')
      .where('rally_participants.rally_id', rallyId);

    // Combine all troops
    const combinedTroops: Map<TroopTier, number> = new Map();
    let leadHero: Hero | null = null;
    let attackerFaction: Faction = 'cinema';

    for (const p of participants) {
      const troops = typeof p.troops === 'string' ? JSON.parse(p.troops) : p.troops;
      for (const t of troops) {
        combinedTroops.set(t.tier, (combinedTroops.get(t.tier) ?? 0) + t.count);
      }

      // Use rally leader's hero as the lead hero
      if (p.player_id === rally.leader_id && p.hero_id) {
        leadHero = new Hero({
          id: BigInt(p.hero_id),
          playerId: BigInt(p.player_id),
          name: p.name,
          faction: p.faction,
          element: p.element,
          rarity: p.rarity,
          level: p.level,
          experience: p.experience,
          attack: p.attack,
          defense: p.defense,
          speed: p.speed,
          hp: p.hp,
          skills: typeof p.skills === 'string' ? JSON.parse(p.skills) : p.skills,
          gear: typeof p.gear === 'string' ? JSON.parse(p.gear) : p.gear,
          createdAt: p.created_at,
        });
        attackerFaction = p.faction;
      }
    }

    const attackerTroops = Array.from(combinedTroops.entries()).map(([tier, count]) => ({ tier, count }));

    // Get defender info
    let defender: {
      playerId: bigint | null;
      npcId: bigint | null;
      faction: Faction | null;
      hero: Hero | null;
      troops: { tier: TroopTier; count: number }[];
      resources: Resources;
    };

    if (rally.target_player_id) {
      const defenderPlayer = await db('players').select('*').where('id', rally.target_player_id).first();
      const defenderTroops = await db('troops').select('tier', 'count').where('player_id', rally.target_player_id);
      const defenderHeroRow = await db('heroes').select('*').where('player_id', rally.target_player_id).orderBy('level', 'desc').first();

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
        playerId: BigInt(rally.target_player_id),
        npcId: null,
        faction: defenderPlayer.faction,
        hero: defenderHero,
        troops: defenderTroops.map(t => ({ tier: t.tier as TroopTier, count: t.count })),
        resources: defResources,
      };
    } else {
      const npc = await db('npcs').select('*').where('id', rally.target_npc_id).first();
      const npcTroops = typeof npc.troops === 'string' ? JSON.parse(npc.troops) : npc.troops;
      const npcRewards = typeof npc.rewards === 'string' ? JSON.parse(npc.rewards) : npc.rewards;

      defender = {
        playerId: null,
        npcId: BigInt(npc.id),
        faction: null,
        hero: null,
        troops: npcTroops,
        resources: npcRewards,
      };
    }

    // Execute battle
    const combatContext: CombatContext = {
      battleType: 'rally',
      location: { x: rally.target_x, y: rally.target_y },
      attacker: {
        playerId: BigInt(rally.leader_id),
        faction: attackerFaction,
        hero: leadHero,
        troops: attackerTroops,
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

    const battleResult = combatService.resolveBattle(combatContext);

    // Distribute casualties proportionally among participants
    await db.transaction(async (trx) => {
      const totalTroopsSent = attackerTroops.reduce((sum, t) => sum + t.count, 0);

      for (const p of participants) {
        const pTroops = typeof p.troops === 'string' ? JSON.parse(p.troops) : p.troops;
        const pTotalTroops = pTroops.reduce((sum: number, t: { count: number }) => sum + t.count, 0);
        const proportion = pTotalTroops / totalTroopsSent;

        // Dead troops are already deducted when joining rally, no action needed

        for (const casualty of battleResult.attackerCasualties.wounded) {
          const share = Math.floor(casualty.count * proportion);
          await trx('troops')
            .where('player_id', p.player_id)
            .where('tier', casualty.tier)
            .increment('wounded', share);
        }

        // Return surviving troops
        for (const t of pTroops) {
          const deadShare = battleResult.attackerCasualties.dead.find(d => d.tier === t.tier)?.count ?? 0;
          const woundedShare = battleResult.attackerCasualties.wounded.find(w => w.tier === t.tier)?.count ?? 0;
          const totalCasualties = Math.floor((deadShare + woundedShare) * proportion);
          const surviving = Math.max(0, t.count - totalCasualties);

          if (surviving > 0) {
            await trx('troops')
              .where('player_id', p.player_id)
              .where('tier', t.tier)
              .increment('count', surviving);
          }
        }

        // Distribute loot proportionally
        if (battleResult.winner === 'attacker') {
          const lootShare = {
            food: Math.floor(battleResult.loot.food * proportion),
            iron: Math.floor(battleResult.loot.iron * proportion),
            gold: Math.floor(battleResult.loot.gold * proportion),
          };

          const playerResources = await trx('players')
            .select('resources')
            .where('id', p.player_id)
            .first();

          const currentResources = typeof playerResources.resources === 'string'
            ? JSON.parse(playerResources.resources)
            : playerResources.resources;

          await trx('players')
            .where('id', p.player_id)
            .update({
              resources: JSON.stringify({
                food: currentResources.food + lootShare.food,
                iron: currentResources.iron + lootShare.iron,
                gold: currentResources.gold + lootShare.gold,
              }),
            });
        }
      }

      // Update defender if player
      if (defender.playerId) {
        for (const troop of defender.troops) {
          const dead = battleResult.defenderCasualties.dead.find(d => d.tier === troop.tier)?.count ?? 0;
          const wounded = battleResult.defenderCasualties.wounded.find(w => w.tier === troop.tier)?.count ?? 0;

          await trx('troops')
            .where('player_id', defender.playerId.toString())
            .where('tier', troop.tier)
            .update({
              count: trx.raw('count - ?', [dead + wounded]),
              wounded: trx.raw('wounded + ?', [wounded]),
            });
        }

        if (battleResult.winner === 'attacker') {
          await trx('players')
            .where('id', defender.playerId.toString())
            .update({
              resources: JSON.stringify({
                food: Math.max(0, defender.resources.food - battleResult.loot.food),
                iron: Math.max(0, defender.resources.iron - battleResult.loot.iron),
                gold: Math.max(0, defender.resources.gold - battleResult.loot.gold),
              }),
            });
        }
      }

      // Record battle
      await trx('battles').insert({
        type: 'rally',
        attacker_id: rally.leader_id,
        defender_id: defender.playerId?.toString() ?? null,
        npc_id: defender.npcId?.toString() ?? null,
        location_x: rally.target_x,
        location_y: rally.target_y,
        attacker_army: JSON.stringify({ participants: participants.length, troops: attackerTroops }),
        defender_army: JSON.stringify(defender),
        result: JSON.stringify(battleResult),
      });

      // Mark rally as completed
      await trx('guild_rallies')
        .where('id', rallyId)
        .update({
          launched: true,
          completed: true,
          result: JSON.stringify(battleResult),
        });
    });

    return { success: true, result: battleResult };
  }

  /**
   * Calculate troop power
   */
  private calculateTroopPower(troops: { tier: TroopTier; count: number }[]): number {
    const tierPower: Record<TroopTier, number> = { 1: 10, 2: 25, 3: 50, 4: 100 };
    return troops.reduce((sum, t) => sum + (tierPower[t.tier] ?? 10) * t.count, 0);
  }
}

export const rallyService = new RallyService();
