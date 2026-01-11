import { getDatabase } from '../../infrastructure/database/connection.js';
import { MAX_LANDS_PER_PLAYER, MAX_LANDS_PER_GUILD } from '../../shared/constants/game.js';
import type { Resources } from '../../shared/types/index.js';

// Land types and their bonuses
export const LAND_TYPES = {
  farm: { name: 'Fertile Farm', emoji: '🌾', bonus: { food: 0.15 }, description: '+15% Food production' },
  mine: { name: 'Iron Mine', emoji: '⛏️', bonus: { iron: 0.15 }, description: '+15% Iron production' },
  goldmine: { name: 'Gold Vein', emoji: '💰', bonus: { gold: 0.20 }, description: '+20% Gold production' },
  fort: { name: 'Strategic Fort', emoji: '🏰', bonus: { defense: 0.10 }, description: '+10% Defense in battles' },
} as const;

export type LandType = keyof typeof LAND_TYPES;

export interface LandParcel {
  id: string;
  name: string;
  type: LandType;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ownerPlayerId: string | null;
  ownerGuildId: string | null;
  bonuses: Record<string, number>;
  purchaseCost: number;
  createdAt: Date;
}

export interface LandPurchaseResult {
  success: boolean;
  error?: string;
  land?: LandParcel;
  costPaid?: Partial<Resources>;
}

interface LandRow {
  id: string;
  name: string;
  type: string;
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  owner_player_id: string | null;
  owner_guild_id: string | null;
  bonuses: string | object;
  purchase_cost: number;
  created_at: Date;
}

interface PlayerRow {
  id: string;
  resources: string | Resources;
}

export class LandService {
  /**
   * Get all land parcels
   */
  async getAllLands(): Promise<LandParcel[]> {
    const db = getDatabase();
    const rows = await db('land_parcels').select('*') as LandRow[];
    return rows.map(this.rowToLand);
  }

  /**
   * Get available (unowned) land parcels
   */
  async getAvailableLands(): Promise<LandParcel[]> {
    const db = getDatabase();
    const rows = await db('land_parcels')
      .select('*')
      .whereNull('owner_player_id')
      .whereNull('owner_guild_id') as LandRow[];
    return rows.map(this.rowToLand);
  }

  /**
   * Get lands owned by a player
   */
  async getPlayerLands(playerId: string): Promise<LandParcel[]> {
    const db = getDatabase();
    const rows = await db('land_parcels')
      .select('*')
      .where('owner_player_id', playerId) as LandRow[];
    return rows.map(this.rowToLand);
  }

  /**
   * Get lands owned by a guild
   */
  async getGuildLands(guildId: string): Promise<LandParcel[]> {
    const db = getDatabase();
    const rows = await db('land_parcels')
      .select('*')
      .where('owner_guild_id', guildId) as LandRow[];
    return rows.map(this.rowToLand);
  }

  /**
   * Get a specific land parcel by ID
   */
  async getLandById(landId: string): Promise<LandParcel | null> {
    const db = getDatabase();
    const row = await db('land_parcels')
      .select('*')
      .where('id', landId)
      .first() as LandRow | undefined;
    return row ? this.rowToLand(row) : null;
  }

  /**
   * Get land at specific coordinates
   */
  async getLandAtCoords(x: number, y: number): Promise<LandParcel | null> {
    const db = getDatabase();
    const row = await db('land_parcels')
      .select('*')
      .where('min_x', '<=', x)
      .where('max_x', '>=', x)
      .where('min_y', '<=', y)
      .where('max_y', '>=', y)
      .first() as LandRow | undefined;
    return row ? this.rowToLand(row) : null;
  }

  /**
   * Purchase a land parcel for a player
   */
  async purchaseLand(playerId: string, landId: string): Promise<LandPurchaseResult> {
    const db = getDatabase();

    // Get the land
    const land = await this.getLandById(landId);
    if (!land) {
      return { success: false, error: 'Land parcel not found.' };
    }

    // Check if already owned
    if (land.ownerPlayerId || land.ownerGuildId) {
      return { success: false, error: 'This land is already owned by someone else.' };
    }

    // Check player's current land count
    const playerLands = await this.getPlayerLands(playerId);
    if (playerLands.length >= MAX_LANDS_PER_PLAYER) {
      return { success: false, error: `You already own ${MAX_LANDS_PER_PLAYER} lands (maximum allowed).` };
    }

    // Get player resources
    const player = await db('players')
      .select('id', 'resources')
      .where('id', playerId)
      .first() as PlayerRow | undefined;

    if (!player) {
      return { success: false, error: 'Player not found.' };
    }

    const resources = typeof player.resources === 'string' 
      ? JSON.parse(player.resources) as Resources 
      : player.resources;

    // Calculate cost (gold-based)
    const cost = land.purchaseCost;
    if (resources.gold < cost) {
      return { success: false, error: `Insufficient gold. You need ${cost} gold but only have ${resources.gold}.` };
    }

    // Deduct gold and assign ownership
    await db.transaction(async (trx) => {
      await trx('players')
        .where('id', playerId)
        .update({
          resources: JSON.stringify({
            ...resources,
            gold: resources.gold - cost,
          }),
        });

      await trx('land_parcels')
        .where('id', landId)
        .update({
          owner_player_id: playerId,
        });

      // Update map tiles to reflect ownership
      await trx('map_tiles')
        .where('land_parcel_id', landId)
        .update({ updated_at: new Date() });
    });

    // Return updated land
    const updatedLand = await this.getLandById(landId);
    return {
      success: true,
      land: updatedLand!,
      costPaid: { gold: cost },
    };
  }

  /**
   * Purchase a land parcel for a guild
   */
  async purchaseGuildLand(guildId: string, landId: string, purchaserId: string): Promise<LandPurchaseResult> {
    const db = getDatabase();

    // Verify purchaser is leader or officer
    const member = await db('guild_members')
      .select('role')
      .where('guild_id', guildId)
      .where('player_id', purchaserId)
      .first() as { role: string } | undefined;

    if (!member || (member.role !== 'leader' && member.role !== 'officer')) {
      return { success: false, error: 'Only guild leaders and officers can purchase land for the guild.' };
    }

    // Get the land
    const land = await this.getLandById(landId);
    if (!land) {
      return { success: false, error: 'Land parcel not found.' };
    }

    // Check if already owned
    if (land.ownerPlayerId || land.ownerGuildId) {
      return { success: false, error: 'This land is already owned by someone else.' };
    }

    // Check guild's current land count
    const guildLands = await this.getGuildLands(guildId);
    if (guildLands.length >= MAX_LANDS_PER_GUILD) {
      return { success: false, error: `Your guild already owns ${MAX_LANDS_PER_GUILD} lands (maximum allowed).` };
    }

    // Get guild treasury
    const guild = await db('guilds')
      .select('treasury')
      .where('id', guildId)
      .first() as { treasury: string | Resources } | undefined;

    if (!guild) {
      return { success: false, error: 'Guild not found.' };
    }

    const treasury = typeof guild.treasury === 'string'
      ? JSON.parse(guild.treasury) as Resources
      : guild.treasury;

    // Calculate cost
    const cost = land.purchaseCost;
    if (treasury.gold < cost) {
      return { success: false, error: `Insufficient guild gold. Need ${cost} gold but treasury has ${treasury.gold}.` };
    }

    // Deduct gold and assign ownership
    await db.transaction(async (trx) => {
      await trx('guilds')
        .where('id', guildId)
        .update({
          treasury: JSON.stringify({
            ...treasury,
            gold: treasury.gold - cost,
          }),
        });

      await trx('land_parcels')
        .where('id', landId)
        .update({
          owner_guild_id: guildId,
        });
    });

    const updatedLand = await this.getLandById(landId);
    return {
      success: true,
      land: updatedLand!,
      costPaid: { gold: cost },
    };
  }

  /**
   * Sell a land parcel (50% cost recovery)
   */
  async sellLand(playerId: string, landId: string): Promise<{ success: boolean; error?: string; goldReceived?: number }> {
    const db = getDatabase();

    const land = await this.getLandById(landId);
    if (!land) {
      return { success: false, error: 'Land parcel not found.' };
    }

    if (land.ownerPlayerId !== playerId) {
      return { success: false, error: 'You do not own this land.' };
    }

    const refund = Math.floor(land.purchaseCost * 0.5);

    await db.transaction(async (trx) => {
      // Add gold to player
      await trx('players')
        .where('id', playerId)
        .update({
          resources: trx.raw(`jsonb_set(resources, '{gold}', (COALESCE((resources->>'gold')::int, 0) + ${refund})::text::jsonb)`),
        });

      // Remove ownership
      await trx('land_parcels')
        .where('id', landId)
        .update({
          owner_player_id: null,
        });
    });

    return { success: true, goldReceived: refund };
  }

  /**
   * Calculate total bonuses from owned lands
   */
  async calculatePlayerBonuses(playerId: string): Promise<Record<string, number>> {
    const lands = await this.getPlayerLands(playerId);
    return this.aggregateBonuses(lands);
  }

  /**
   * Calculate total bonuses from guild lands (for all members)
   */
  async calculateGuildBonuses(guildId: string): Promise<Record<string, number>> {
    const lands = await this.getGuildLands(guildId);
    return this.aggregateBonuses(lands);
  }

  /**
   * Aggregate bonuses from multiple lands
   */
  private aggregateBonuses(lands: LandParcel[]): Record<string, number> {
    const bonuses: Record<string, number> = {};
    
    for (const land of lands) {
      for (const [key, value] of Object.entries(land.bonuses)) {
        bonuses[key] = (bonuses[key] || 0) + value;
      }
    }

    return bonuses;
  }

  /**
   * Check ownership percentage and spawn new lands if needed
   */
  async checkAndSpawnLands(): Promise<number> {
    const db = getDatabase();

    const stats = await db('land_parcels')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('COUNT(owner_player_id) + COUNT(owner_guild_id) as owned')
      )
      .first() as { total: string; owned: string };

    const total = parseInt(stats.total, 10);
    const owned = parseInt(stats.owned, 10);
    const ownershipRate = total > 0 ? owned / total : 0;

    // Spawn new lands if >70% owned
    if (ownershipRate > 0.7) {
      const landsToSpawn = Math.ceil(total * 0.2); // Spawn 20% more
      await this.spawnNewLands(landsToSpawn);
      return landsToSpawn;
    }

    return 0;
  }

  /**
   * Spawn new land parcels
   */
  private async spawnNewLands(count: number): Promise<void> {
    const db = getDatabase();
    const landTypes = Object.keys(LAND_TYPES) as LandType[];

    for (let i = 0; i < count; i++) {
      const type = landTypes[Math.floor(Math.random() * landTypes.length)];
      const typeInfo = LAND_TYPES[type];
      
      // Random size between 4x4 and 6x6
      const size = Math.floor(Math.random() * 3) + 4;
      
      // Find empty area on map
      const coords = await this.findEmptyArea(size);
      if (!coords) continue;

      const cost = this.calculateLandCost(type, size);

      await db('land_parcels').insert({
        name: `${typeInfo.name} #${Date.now().toString(36)}`,
        type,
        min_x: coords.minX,
        min_y: coords.minY,
        max_x: coords.maxX,
        max_y: coords.maxY,
        bonuses: JSON.stringify(typeInfo.bonus),
        purchase_cost: cost,
      });
    }
  }

  /**
   * Find an empty area on the map for new land
   */
  private async findEmptyArea(size: number): Promise<{ minX: number; minY: number; maxX: number; maxY: number } | null> {
    const db = getDatabase();
    
    // Try random positions
    for (let attempt = 0; attempt < 50; attempt++) {
      const minX = Math.floor(Math.random() * (100 - size));
      const minY = Math.floor(Math.random() * (100 - size));
      const maxX = minX + size - 1;
      const maxY = minY + size - 1;

      // Check for overlapping lands
      const overlap = await db('land_parcels')
        .where(function() {
          this.where('min_x', '<=', maxX)
            .andWhere('max_x', '>=', minX)
            .andWhere('min_y', '<=', maxY)
            .andWhere('max_y', '>=', minY);
        })
        .first();

      if (!overlap) {
        return { minX, minY, maxX, maxY };
      }
    }

    return null;
  }

  /**
   * Calculate land purchase cost based on type and size
   */
  private calculateLandCost(type: LandType, size: number): number {
    const baseCosts: Record<LandType, number> = {
      farm: 500,
      mine: 600,
      goldmine: 1000,
      fort: 800,
    };

    const base = baseCosts[type];
    const sizeMultiplier = size * size / 16; // Normalize to 4x4 = 1.0
    return Math.floor(base * sizeMultiplier);
  }

  /**
   * Get land info for display
   */
  getLandTypeInfo(type: LandType): typeof LAND_TYPES[LandType] {
    return LAND_TYPES[type];
  }

  /**
   * Convert database row to LandParcel
   */
  private rowToLand(row: LandRow): LandParcel {
    return {
      id: row.id,
      name: row.name,
      type: row.type as LandType,
      minX: row.min_x,
      minY: row.min_y,
      maxX: row.max_x,
      maxY: row.max_y,
      ownerPlayerId: row.owner_player_id,
      ownerGuildId: row.owner_guild_id,
      bonuses: typeof row.bonuses === 'string' ? JSON.parse(row.bonuses) : row.bonuses,
      purchaseCost: row.purchase_cost,
      createdAt: row.created_at,
    };
  }

  /**
   * Get ownership statistics
   */
  async getOwnershipStats(): Promise<{
    total: number;
    owned: number;
    available: number;
    ownershipRate: number;
    byType: Record<LandType, { total: number; owned: number }>;
  }> {
    const lands = await this.getAllLands();
    const total = lands.length;
    const owned = lands.filter(l => l.ownerPlayerId || l.ownerGuildId).length;
    const available = total - owned;

    const byType: Record<LandType, { total: number; owned: number }> = {
      farm: { total: 0, owned: 0 },
      mine: { total: 0, owned: 0 },
      goldmine: { total: 0, owned: 0 },
      fort: { total: 0, owned: 0 },
    };

    for (const land of lands) {
      if (byType[land.type]) {
        byType[land.type].total++;
        if (land.ownerPlayerId || land.ownerGuildId) {
          byType[land.type].owned++;
        }
      }
    }

    return {
      total,
      owned,
      available,
      ownershipRate: total > 0 ? owned / total : 0,
      byType,
    };
  }
}

export const landService = new LandService();
