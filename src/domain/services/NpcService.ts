import { getDatabase } from '../../infrastructure/database/connection.js';
import type { TroopTier, Resources } from '../../shared/types/index.js';
import { MAP_SIZE } from '../../shared/constants/game.js';

// NPC types and their configurations
export const NPC_TYPES = {
  bandit_camp: {
    name: 'Bandit Camp',
    emoji: '🏴',
    minPower: 500,
    maxPower: 2000,
    description: 'A small camp of bandits. Easy pickings for new players.',
  },
  goblin_outpost: {
    name: 'Goblin Outpost',
    emoji: '👺',
    minPower: 2000,
    maxPower: 5000,
    description: 'A fortified goblin position. Moderate challenge.',
  },
  dragon_lair: {
    name: 'Dragon Lair',
    emoji: '🐉',
    minPower: 5000,
    maxPower: 10000,
    description: 'Home to a fearsome dragon. Only for the strongest!',
  },
} as const;

export type NpcType = keyof typeof NPC_TYPES;

export interface NpcInfo {
  id: string;
  type: NpcType;
  name: string;
  coordX: number;
  coordY: number;
  power: number;
  troops: { tier: TroopTier; count: number }[];
  rewards: Resources;
  respawnAt: Date | null;
  createdAt: Date;
}

interface NpcRow {
  id: string;
  type: string;
  name: string;
  coord_x: number;
  coord_y: number;
  power: number;
  troops: string | object;
  rewards: string | object;
  respawn_at: Date | null;
  created_at: Date;
}

// NPC respawn time in hours
const NPC_RESPAWN_HOURS = 12;

// Starter NPC guarantee: 5 weak camps within 5 tiles of new players
const STARTER_NPC_RADIUS = 5;
const STARTER_NPC_COUNT = 5;
const STARTER_NPC_MAX_POWER = 800;

export class NpcService {
  /**
   * Get all NPCs
   */
  async getAllNpcs(): Promise<NpcInfo[]> {
    const db = getDatabase();
    const rows = await db('npcs').select('*') as NpcRow[];
    return rows.map(this.rowToNpc);
  }

  /**
   * Get active NPCs (not respawning)
   */
  async getActiveNpcs(): Promise<NpcInfo[]> {
    const db = getDatabase();
    const rows = await db('npcs')
      .select('*')
      .where(function() {
        this.whereNull('respawn_at')
          .orWhere('respawn_at', '<=', new Date());
      }) as NpcRow[];
    return rows.map(this.rowToNpc);
  }

  /**
   * Get NPC by ID
   */
  async getNpcById(npcId: string): Promise<NpcInfo | null> {
    const db = getDatabase();
    const row = await db('npcs')
      .select('*')
      .where('id', npcId)
      .first() as NpcRow | undefined;
    return row ? this.rowToNpc(row) : null;
  }

  /**
   * Get NPC at coordinates
   */
  async getNpcAtCoords(x: number, y: number): Promise<NpcInfo | null> {
    const db = getDatabase();
    const row = await db('npcs')
      .select('*')
      .where('coord_x', x)
      .where('coord_y', y)
      .first() as NpcRow | undefined;
    return row ? this.rowToNpc(row) : null;
  }

  /**
   * Get NPCs near a location
   */
  async getNpcsNearLocation(x: number, y: number, radius: number): Promise<NpcInfo[]> {
    const db = getDatabase();
    const rows = await db('npcs')
      .select('*')
      .whereBetween('coord_x', [x - radius, x + radius])
      .whereBetween('coord_y', [y - radius, y + radius])
      .where(function() {
        this.whereNull('respawn_at')
          .orWhere('respawn_at', '<=', new Date());
      }) as NpcRow[];
    return rows.map(this.rowToNpc);
  }

  /**
   * Get NPCs by power range
   */
  async getNpcsByPowerRange(minPower: number, maxPower: number): Promise<NpcInfo[]> {
    const db = getDatabase();
    const rows = await db('npcs')
      .select('*')
      .whereBetween('power', [minPower, maxPower])
      .where(function() {
        this.whereNull('respawn_at')
          .orWhere('respawn_at', '<=', new Date());
      }) as NpcRow[];
    return rows.map(this.rowToNpc);
  }

  /**
   * Defeat an NPC (mark for respawn)
   */
  async defeatNpc(npcId: string): Promise<{ success: boolean; respawnAt: Date }> {
    const db = getDatabase();
    const respawnAt = new Date(Date.now() + NPC_RESPAWN_HOURS * 60 * 60 * 1000);

    await db('npcs')
      .where('id', npcId)
      .update({ respawn_at: respawnAt });

    // Remove from map tile
    await db('map_tiles')
      .where('npc_id', npcId)
      .update({ npc_id: null });

    return { success: true, respawnAt };
  }

  /**
   * Respawn NPCs that are ready
   */
  async respawnReadyNpcs(): Promise<number> {
    const db = getDatabase();
    const now = new Date();

    // Get NPCs ready to respawn
    const readyNpcs = await db('npcs')
      .select('*')
      .whereNotNull('respawn_at')
      .where('respawn_at', '<=', now) as NpcRow[];

    let respawnedCount = 0;

    for (const npc of readyNpcs) {
      // Find a new location for the NPC
      const newCoords = await this.findEmptyTileNear(npc.coord_x, npc.coord_y, 10);
      if (!newCoords) continue;

      await db.transaction(async (trx) => {
        // Update NPC location and clear respawn
        await trx('npcs')
          .where('id', npc.id)
          .update({
            coord_x: newCoords.x,
            coord_y: newCoords.y,
            respawn_at: null,
          });

        // Update map tile
        await trx('map_tiles')
          .where({ x: newCoords.x, y: newCoords.y })
          .update({ npc_id: npc.id });
      });

      respawnedCount++;
    }

    return respawnedCount;
  }

  /**
   * Spawn initial NPCs for the map
   */
  async spawnInitialNpcs(count: number = 50): Promise<number> {
    let spawned = 0;

    // Distribution: 50% bandit camps, 35% goblin outposts, 15% dragon lairs
    const distribution = {
      bandit_camp: Math.floor(count * 0.5),
      goblin_outpost: Math.floor(count * 0.35),
      dragon_lair: Math.floor(count * 0.15),
    };

    for (const [type, typeCount] of Object.entries(distribution)) {
      for (let i = 0; i < typeCount; i++) {
        const npc = await this.spawnNpc(type as NpcType);
        if (npc) spawned++;
      }
    }

    return spawned;
  }

  /**
   * Spawn a single NPC of a given type
   */
  async spawnNpc(type: NpcType, nearX?: number, nearY?: number): Promise<NpcInfo | null> {
    const db = getDatabase();
    const config = NPC_TYPES[type];

    // Find empty tile
    const coords = nearX !== undefined && nearY !== undefined
      ? await this.findEmptyTileNear(nearX, nearY, 10)
      : await this.findRandomEmptyTile();

    if (!coords) return null;

    // Generate power within range
    const power = Math.floor(
      config.minPower + Math.random() * (config.maxPower - config.minPower)
    );

    // Generate troops based on power
    const troops = this.generateTroopsForPower(power);

    // Generate rewards based on power
    const rewards = this.generateRewardsForPower(power, type);

    // Generate name
    const name = this.generateNpcName(type);

    const [npc] = await db('npcs')
      .insert({
        type,
        name,
        coord_x: coords.x,
        coord_y: coords.y,
        power,
        troops: JSON.stringify(troops),
        rewards: JSON.stringify(rewards),
      })
      .returning('*') as NpcRow[];

    // Update map tile
    await db('map_tiles')
      .where({ x: coords.x, y: coords.y })
      .update({ npc_id: npc.id });

    return this.rowToNpc(npc);
  }

  /**
   * Ensure starter NPCs exist near a new player
   */
  async ensureStarterNpcs(playerX: number, playerY: number): Promise<number> {
    // Check existing weak NPCs near player
    const nearbyNpcs = await this.getNpcsNearLocation(playerX, playerY, STARTER_NPC_RADIUS);
    const weakNpcs = nearbyNpcs.filter(n => n.power <= STARTER_NPC_MAX_POWER);

    const needed = STARTER_NPC_COUNT - weakNpcs.length;
    if (needed <= 0) return 0;

    const db = getDatabase();
    let spawned = 0;
    for (let i = 0; i < needed; i++) {
      // Spawn weak bandit camps near player
      const coords = await this.findEmptyTileNear(playerX, playerY, STARTER_NPC_RADIUS);
      if (!coords) continue;

      const power = Math.floor(500 + Math.random() * 300); // 500-800 power
      const troops = this.generateTroopsForPower(power);
      const rewards = this.generateRewardsForPower(power, 'bandit_camp');
      const name = this.generateNpcName('bandit_camp');

      const [npc] = await db('npcs')
        .insert({
          type: 'bandit_camp',
          name,
          coord_x: coords.x,
          coord_y: coords.y,
          power,
          troops: JSON.stringify(troops),
          rewards: JSON.stringify(rewards),
        })
        .returning('*') as NpcRow[];

      await db('map_tiles')
        .where({ x: coords.x, y: coords.y })
        .update({ npc_id: npc.id });

      spawned++;
    }

    return spawned;
  }

  /**
   * Get NPC statistics
   */
  async getNpcStats(): Promise<{
    total: number;
    active: number;
    respawning: number;
    byType: Record<NpcType, { total: number; active: number }>;
  }> {
    const db = getDatabase();
    const now = new Date();

    const allNpcs = await db('npcs').select('type', 'respawn_at') as { type: string; respawn_at: Date | null }[];

    const stats = {
      total: allNpcs.length,
      active: 0,
      respawning: 0,
      byType: {
        bandit_camp: { total: 0, active: 0 },
        goblin_outpost: { total: 0, active: 0 },
        dragon_lair: { total: 0, active: 0 },
      } as Record<NpcType, { total: number; active: number }>,
    };

    for (const npc of allNpcs) {
      const type = npc.type as NpcType;
      const isActive = !npc.respawn_at || new Date(npc.respawn_at) <= now;

      stats.byType[type].total++;
      if (isActive) {
        stats.active++;
        stats.byType[type].active++;
      } else {
        stats.respawning++;
      }
    }

    return stats;
  }

  /**
   * Generate troops for a given power level
   */
  private generateTroopsForPower(power: number): { tier: TroopTier; count: number }[] {
    const troops: { tier: TroopTier; count: number }[] = [];
    let remainingPower = power;

    // Power per troop tier
    const tierPower: Record<TroopTier, number> = { 1: 10, 2: 30, 3: 100, 4: 300 };

    // Higher power NPCs have higher tier troops
    if (power >= 5000) {
      // Dragon lairs have T3 and T4
      const t4Count = Math.floor(remainingPower * 0.3 / tierPower[4]);
      remainingPower -= t4Count * tierPower[4];
      if (t4Count > 0) troops.push({ tier: 4, count: t4Count });

      const t3Count = Math.floor(remainingPower * 0.5 / tierPower[3]);
      remainingPower -= t3Count * tierPower[3];
      if (t3Count > 0) troops.push({ tier: 3, count: t3Count });

      const t2Count = Math.floor(remainingPower / tierPower[2]);
      if (t2Count > 0) troops.push({ tier: 2, count: t2Count });
    } else if (power >= 2000) {
      // Goblin outposts have T2 and T3
      const t3Count = Math.floor(remainingPower * 0.3 / tierPower[3]);
      remainingPower -= t3Count * tierPower[3];
      if (t3Count > 0) troops.push({ tier: 3, count: t3Count });

      const t2Count = Math.floor(remainingPower * 0.5 / tierPower[2]);
      remainingPower -= t2Count * tierPower[2];
      if (t2Count > 0) troops.push({ tier: 2, count: t2Count });

      const t1Count = Math.floor(remainingPower / tierPower[1]);
      if (t1Count > 0) troops.push({ tier: 1, count: t1Count });
    } else {
      // Bandit camps have T1 and T2
      const t2Count = Math.floor(remainingPower * 0.2 / tierPower[2]);
      remainingPower -= t2Count * tierPower[2];
      if (t2Count > 0) troops.push({ tier: 2, count: t2Count });

      const t1Count = Math.floor(remainingPower / tierPower[1]);
      if (t1Count > 0) troops.push({ tier: 1, count: t1Count });
    }

    return troops;
  }

  /**
   * Generate rewards for a given power level
   */
  private generateRewardsForPower(power: number, type: NpcType): Resources {
    const baseMultiplier = power / 1000;

    // Type-specific reward bonuses
    const typeBonus: Record<NpcType, { food: number; iron: number; gold: number }> = {
      bandit_camp: { food: 1.2, iron: 0.8, gold: 1.0 },
      goblin_outpost: { food: 0.8, iron: 1.2, gold: 1.0 },
      dragon_lair: { food: 1.0, iron: 1.0, gold: 1.5 },
    };

    const bonus = typeBonus[type];

    return {
      food: Math.floor(500 * baseMultiplier * bonus.food * (0.8 + Math.random() * 0.4)),
      iron: Math.floor(300 * baseMultiplier * bonus.iron * (0.8 + Math.random() * 0.4)),
      gold: Math.floor(100 * baseMultiplier * bonus.gold * (0.8 + Math.random() * 0.4)),
    };
  }

  /**
   * Generate a random NPC name
   */
  private generateNpcName(type: NpcType): string {
    const prefixes: Record<NpcType, string[]> = {
      bandit_camp: ['Ragged', 'Dusty', 'Shadow', 'Rusty', 'Wild'],
      goblin_outpost: ['Grimfang', 'Bloodtooth', 'Ironskull', 'Darkspear', 'Bonecrusher'],
      dragon_lair: ['Ancient', 'Infernal', 'Frost', 'Storm', 'Void'],
    };

    const suffixes: Record<NpcType, string[]> = {
      bandit_camp: ['Hideout', 'Camp', 'Den', 'Refuge', 'Outpost'],
      goblin_outpost: ['Stronghold', 'Fortress', 'Bastion', 'Citadel', 'Keep'],
      dragon_lair: ['Lair', 'Cavern', 'Abyss', 'Domain', 'Sanctum'],
    };

    const prefix = prefixes[type][Math.floor(Math.random() * prefixes[type].length)];
    const suffix = suffixes[type][Math.floor(Math.random() * suffixes[type].length)];

    return `${prefix} ${suffix}`;
  }

  /**
   * Find an empty tile near a location
   */
  private async findEmptyTileNear(x: number, y: number, radius: number): Promise<{ x: number; y: number } | null> {
    const db = getDatabase();

    for (let attempt = 0; attempt < 50; attempt++) {
      const offsetX = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const offsetY = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
      const newX = Math.max(0, Math.min(MAP_SIZE - 1, x + offsetX));
      const newY = Math.max(0, Math.min(MAP_SIZE - 1, y + offsetY));

      const tile = await db('map_tiles')
        .select('occupant_id', 'npc_id')
        .where({ x: newX, y: newY })
        .first();

      if (tile && !tile.occupant_id && !tile.npc_id) {
        return { x: newX, y: newY };
      }
    }

    return null;
  }

  /**
   * Find a random empty tile on the map
   */
  private async findRandomEmptyTile(): Promise<{ x: number; y: number } | null> {
    const db = getDatabase();

    for (let attempt = 0; attempt < 100; attempt++) {
      const x = Math.floor(Math.random() * MAP_SIZE);
      const y = Math.floor(Math.random() * MAP_SIZE);

      const tile = await db('map_tiles')
        .select('occupant_id', 'npc_id')
        .where({ x, y })
        .first();

      if (tile && !tile.occupant_id && !tile.npc_id) {
        return { x, y };
      }
    }

    return null;
  }

  /**
   * Get NPC type info
   */
  getNpcTypeInfo(type: NpcType): typeof NPC_TYPES[NpcType] {
    return NPC_TYPES[type];
  }

  /**
   * Convert database row to NpcInfo
   */
  private rowToNpc(row: NpcRow): NpcInfo {
    return {
      id: row.id,
      type: row.type as NpcType,
      name: row.name,
      coordX: row.coord_x,
      coordY: row.coord_y,
      power: row.power,
      troops: typeof row.troops === 'string' ? JSON.parse(row.troops) : row.troops,
      rewards: typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards,
      respawnAt: row.respawn_at,
      createdAt: row.created_at,
    };
  }
}

export const npcService = new NpcService();
