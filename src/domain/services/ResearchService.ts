import { getDatabase } from '../../infrastructure/database/connection.js';

// Research categories and their configurations
export const RESEARCH_CATEGORIES = {
  troop_training: {
    name: 'Troop Training',
    emoji: '⚔️',
    description: 'Reduces troop training time',
    maxLevel: 5,
    effects: [0.10, 0.20, 0.30, 0.40, 0.50], // -10% to -50% training time
    costs: [2000, 5000, 10000, 15000, 20000], // Gold costs
    times: [1, 3, 6, 9, 12], // Hours
  },
  resource_boost: {
    name: 'Resource Boost',
    emoji: '📦',
    description: 'Increases resource production',
    maxLevel: 5,
    effects: [0.10, 0.20, 0.30, 0.40, 0.50], // +10% to +50% production
    costs: [3000, 7000, 12000, 18000, 25000],
    times: [2, 5, 8, 12, 15],
  },
  march_speed: {
    name: 'March Speed',
    emoji: '🏃',
    description: 'Increases army march speed',
    maxLevel: 5,
    effects: [0.10, 0.20, 0.30, 0.40, 0.50], // +10% to +50% march speed
    costs: [2500, 6000, 11000, 16000, 22000],
    times: [1, 3, 5, 7, 10],
  },
  combat_power: {
    name: 'Combat Power',
    emoji: '💪',
    description: 'Increases attack and defense',
    maxLevel: 5,
    effects: [0.05, 0.10, 0.15, 0.20, 0.25], // +5% to +25% attack/defense
    costs: [5000, 10000, 18000, 25000, 30000],
    times: [3, 6, 10, 14, 18],
  },
  hero_xp: {
    name: 'Hero XP Boost',
    emoji: '⭐',
    description: 'Increases hero XP gain',
    maxLevel: 3,
    effects: [0.20, 0.40, 0.60], // +20% to +60% hero XP
    costs: [10000, 25000, 40000],
    times: [6, 12, 20],
  },
  army_capacity: {
    name: 'Army Capacity',
    emoji: '🎖️',
    description: 'Increases max troop capacity per march',
    maxLevel: 3,
    effects: [100, 200, 300], // +100 to +300 troops
    costs: [8000, 20000, 35000],
    times: [4, 10, 16],
  },
} as const;

export type ResearchCategory = keyof typeof RESEARCH_CATEGORIES;

export interface ResearchInfo {
  category: ResearchCategory;
  level: number;
  researchStartedAt: Date | null;
  researchCompletesAt: Date | null;
}

export interface ResearchBonuses {
  troopTrainingSpeed: number; // Multiplier (0.9 = 10% faster)
  resourceProduction: number; // Multiplier (1.1 = 10% more)
  marchSpeed: number; // Multiplier (1.1 = 10% faster)
  combatPower: number; // Multiplier (1.05 = 5% more)
  heroXpGain: number; // Multiplier (1.2 = 20% more)
  armyCapacity: number; // Flat bonus
}

interface ResearchRow {
  id: string;
  player_id: string;
  category: string;
  level: number;
  research_started_at: Date | null;
  research_completes_at: Date | null;
}

export class ResearchService {
  /**
   * Get all research for a player
   */
  async getPlayerResearch(playerId: string): Promise<ResearchInfo[]> {
    const db = getDatabase();
    const rows = await db('research')
      .select('*')
      .where('player_id', playerId) as ResearchRow[];

    // Create entries for all categories, defaulting to level 0
    const researchMap = new Map<ResearchCategory, ResearchInfo>();
    
    for (const category of Object.keys(RESEARCH_CATEGORIES) as ResearchCategory[]) {
      researchMap.set(category, {
        category,
        level: 0,
        researchStartedAt: null,
        researchCompletesAt: null,
      });
    }

    for (const row of rows) {
      researchMap.set(row.category as ResearchCategory, {
        category: row.category as ResearchCategory,
        level: row.level,
        researchStartedAt: row.research_started_at,
        researchCompletesAt: row.research_completes_at,
      });
    }

    return Array.from(researchMap.values());
  }

  /**
   * Get research for a specific category
   */
  async getResearchCategory(playerId: string, category: ResearchCategory): Promise<ResearchInfo> {
    const db = getDatabase();
    const row = await db('research')
      .select('*')
      .where('player_id', playerId)
      .where('category', category)
      .first() as ResearchRow | undefined;

    if (!row) {
      return {
        category,
        level: 0,
        researchStartedAt: null,
        researchCompletesAt: null,
      };
    }

    return {
      category: row.category as ResearchCategory,
      level: row.level,
      researchStartedAt: row.research_started_at,
      researchCompletesAt: row.research_completes_at,
    };
  }

  /**
   * Start researching a category
   */
  async startResearch(
    playerId: string,
    category: ResearchCategory
  ): Promise<{ success: boolean; error?: string; completesAt?: Date }> {
    const db = getDatabase();
    const config = RESEARCH_CATEGORIES[category];

    // Get current research status
    const current = await this.getResearchCategory(playerId, category);

    // Check if already at max level
    if (current.level >= config.maxLevel) {
      return { success: false, error: `${config.name} is already at max level!` };
    }

    // Check if already researching something
    const activeResearch = await db('research')
      .select('category', 'research_completes_at')
      .where('player_id', playerId)
      .whereNotNull('research_completes_at')
      .where('research_completes_at', '>', new Date())
      .first();

    if (activeResearch) {
      const activeCat = RESEARCH_CATEGORIES[activeResearch.category as ResearchCategory];
      return {
        success: false,
        error: `Already researching ${activeCat.name}! Completes <t:${Math.floor(new Date(activeResearch.research_completes_at).getTime() / 1000)}:R>`,
      };
    }

    // Get player's gold
    const player = await db('players')
      .select('resources')
      .where('id', playerId)
      .first();

    if (!player) {
      return { success: false, error: 'Player not found!' };
    }

    const resources = typeof player.resources === 'string'
      ? JSON.parse(player.resources)
      : player.resources;

    const nextLevel = current.level;
    const cost = config.costs[nextLevel];
    const timeHours = config.times[nextLevel];

    // Check if player has enough gold
    if (resources.gold < cost) {
      return {
        success: false,
        error: `Not enough Gold! Need ${cost.toLocaleString()}, have ${resources.gold.toLocaleString()}`,
      };
    }

    // Calculate completion time
    const now = new Date();
    const completesAt = new Date(now.getTime() + timeHours * 60 * 60 * 1000);

    // Start research in transaction
    await db.transaction(async (trx) => {
      // Deduct gold
      await trx('players')
        .where('id', playerId)
        .update({
          resources: JSON.stringify({
            ...resources,
            gold: resources.gold - cost,
          }),
        });

      // Update or insert research record
      const existing = await trx('research')
        .select('id')
        .where('player_id', playerId)
        .where('category', category)
        .first();

      if (existing) {
        await trx('research')
          .where('id', existing.id)
          .update({
            research_started_at: now,
            research_completes_at: completesAt,
          });
      } else {
        await trx('research').insert({
          player_id: playerId,
          category,
          level: 0,
          research_started_at: now,
          research_completes_at: completesAt,
        });
      }
    });

    return { success: true, completesAt };
  }

  /**
   * Complete research that has finished
   */
  async completeResearch(playerId: string): Promise<{ completed: ResearchCategory[]; stillInProgress: ResearchCategory | null }> {
    const db = getDatabase();
    const now = new Date();

    // Find completed research
    const completedRows = await db('research')
      .select('*')
      .where('player_id', playerId)
      .whereNotNull('research_completes_at')
      .where('research_completes_at', '<=', now) as ResearchRow[];

    const completed: ResearchCategory[] = [];

    for (const row of completedRows) {
      // Increment level and clear timers
      await db('research')
        .where('id', row.id)
        .update({
          level: row.level + 1,
          research_started_at: null,
          research_completes_at: null,
        });

      completed.push(row.category as ResearchCategory);
    }

    // Check for still in-progress research
    const inProgress = await db('research')
      .select('category')
      .where('player_id', playerId)
      .whereNotNull('research_completes_at')
      .where('research_completes_at', '>', now)
      .first();

    return {
      completed,
      stillInProgress: inProgress ? inProgress.category as ResearchCategory : null,
    };
  }

  /**
   * Cancel active research (no refund)
   */
  async cancelResearch(playerId: string): Promise<{ success: boolean; cancelled?: ResearchCategory }> {
    const db = getDatabase();

    const activeResearch = await db('research')
      .select('id', 'category')
      .where('player_id', playerId)
      .whereNotNull('research_completes_at')
      .where('research_completes_at', '>', new Date())
      .first();

    if (!activeResearch) {
      return { success: false };
    }

    await db('research')
      .where('id', activeResearch.id)
      .update({
        research_started_at: null,
        research_completes_at: null,
      });

    return { success: true, cancelled: activeResearch.category as ResearchCategory };
  }

  /**
   * Calculate all research bonuses for a player
   */
  async calculateBonuses(playerId: string): Promise<ResearchBonuses> {
    const research = await this.getPlayerResearch(playerId);
    
    const bonuses: ResearchBonuses = {
      troopTrainingSpeed: 1.0,
      resourceProduction: 1.0,
      marchSpeed: 1.0,
      combatPower: 1.0,
      heroXpGain: 1.0,
      armyCapacity: 0,
    };

    for (const r of research) {
      if (r.level === 0) continue;

      const config = RESEARCH_CATEGORIES[r.category];
      const effectIndex = r.level - 1;

      switch (r.category) {
        case 'troop_training':
          bonuses.troopTrainingSpeed = 1 - config.effects[effectIndex];
          break;
        case 'resource_boost':
          bonuses.resourceProduction = 1 + config.effects[effectIndex];
          break;
        case 'march_speed':
          bonuses.marchSpeed = 1 + config.effects[effectIndex];
          break;
        case 'combat_power':
          bonuses.combatPower = 1 + config.effects[effectIndex];
          break;
        case 'hero_xp':
          bonuses.heroXpGain = 1 + config.effects[effectIndex];
          break;
        case 'army_capacity':
          bonuses.armyCapacity = config.effects[effectIndex] as number;
          break;
      }
    }

    return bonuses;
  }

  /**
   * Get research category info
   */
  getCategoryInfo(category: ResearchCategory): typeof RESEARCH_CATEGORIES[ResearchCategory] {
    return RESEARCH_CATEGORIES[category];
  }

  /**
   * Get all category names
   */
  getAllCategories(): ResearchCategory[] {
    return Object.keys(RESEARCH_CATEGORIES) as ResearchCategory[];
  }

  /**
   * Format time remaining
   */
  formatTimeRemaining(completesAt: Date): string {
    const now = new Date();
    const diff = completesAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Complete!';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Get total research progress
   */
  async getTotalProgress(playerId: string): Promise<{ completed: number; total: number; percentage: number }> {
    const research = await this.getPlayerResearch(playerId);
    
    let completed = 0;
    let total = 0;

    for (const category of Object.keys(RESEARCH_CATEGORIES) as ResearchCategory[]) {
      const config = RESEARCH_CATEGORIES[category];
      total += config.maxLevel;
      
      const r = research.find(res => res.category === category);
      if (r) {
        completed += r.level;
      }
    }

    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    };
  }

  /**
   * Reset all research for a player (for season reset)
   */
  async resetAllResearch(playerId: string): Promise<void> {
    const db = getDatabase();
    await db('research')
      .where('player_id', playerId)
      .delete();
  }
}

export const researchService = new ResearchService();
