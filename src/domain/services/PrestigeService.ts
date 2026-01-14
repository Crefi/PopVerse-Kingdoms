import { getDatabase } from '../../infrastructure/database/connection.js';
import { cacheManager } from '../../infrastructure/cache/CacheManager.js';
import { logger } from '../../shared/utils/logger.js';

// Cosmetic types
export type CosmeticType = 'city_skin' | 'profile_badge' | 'guild_banner' | 'title';

export interface Cosmetic {
  id: string;
  name: string;
  description: string;
  type: CosmeticType;
  prestigeCost: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  imageUrl?: string;
  unlockRequirement?: string; // Achievement ID required to purchase
}

export interface PlayerCosmetics {
  playerId: string;
  unlockedCosmetics: string[];
  equippedCitySkin: string | null;
  equippedBadge: string | null;
  equippedTitle: string | null;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'combat' | 'building' | 'social' | 'conquest' | 'arena' | 'collection';
  prestigeReward: number;
  requirement: AchievementRequirement;
  icon: string;
}

export interface AchievementRequirement {
  type: string;
  target: number;
  current?: number;
}

export interface PlayerAchievementProgress {
  achievementId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  claimed: boolean;
}

// Prestige shop items
const PRESTIGE_SHOP: Cosmetic[] = [
  // City Skins
  { id: 'city_golden', name: 'Golden City', description: 'A majestic golden city skin', type: 'city_skin', prestigeCost: 500, rarity: 'rare' },
  { id: 'city_crystal', name: 'Crystal Palace', description: 'A shimmering crystal city', type: 'city_skin', prestigeCost: 1000, rarity: 'epic' },
  { id: 'city_shadow', name: 'Shadow Fortress', description: 'A dark and mysterious fortress', type: 'city_skin', prestigeCost: 2000, rarity: 'legendary' },
  { id: 'city_nature', name: 'Nature\'s Haven', description: 'A city in harmony with nature', type: 'city_skin', prestigeCost: 750, rarity: 'rare' },
  
  // Profile Badges
  { id: 'badge_veteran', name: 'Veteran', description: 'Completed 3 seasons', type: 'profile_badge', prestigeCost: 200, rarity: 'common' },
  { id: 'badge_champion', name: 'Champion', description: 'Reached top 10 in any leaderboard', type: 'profile_badge', prestigeCost: 500, rarity: 'rare' },
  { id: 'badge_legend', name: 'Legend', description: 'Reached Legend tier in Arena', type: 'profile_badge', prestigeCost: 1500, rarity: 'legendary', unlockRequirement: 'arena_legend' },
  { id: 'badge_conqueror', name: 'Conqueror', description: 'Won 100 conquest battles', type: 'profile_badge', prestigeCost: 800, rarity: 'epic', unlockRequirement: 'conquest_champion' },
  
  // Titles
  { id: 'title_warlord', name: 'Warlord', description: 'Display "Warlord" before your name', type: 'title', prestigeCost: 300, rarity: 'rare' },
  { id: 'title_emperor', name: 'Emperor', description: 'Display "Emperor" before your name', type: 'title', prestigeCost: 1000, rarity: 'epic' },
  { id: 'title_immortal', name: 'Immortal', description: 'Display "Immortal" before your name', type: 'title', prestigeCost: 3000, rarity: 'legendary' },
  { id: 'title_strategist', name: 'Grand Strategist', description: 'Display "Grand Strategist" before your name', type: 'title', prestigeCost: 600, rarity: 'rare' },
  
  // Guild Banners
  { id: 'banner_flame', name: 'Flame Banner', description: 'A fiery guild banner', type: 'guild_banner', prestigeCost: 400, rarity: 'rare' },
  { id: 'banner_frost', name: 'Frost Banner', description: 'An icy guild banner', type: 'guild_banner', prestigeCost: 400, rarity: 'rare' },
  { id: 'banner_royal', name: 'Royal Banner', description: 'A regal guild banner', type: 'guild_banner', prestigeCost: 1200, rarity: 'epic' },
  { id: 'banner_dragon', name: 'Dragon Banner', description: 'A fearsome dragon banner', type: 'guild_banner', prestigeCost: 2500, rarity: 'legendary' },
];

// Achievement definitions
const ACHIEVEMENTS: Achievement[] = [
  // Combat achievements
  { id: 'first_blood', name: 'First Blood', description: 'Win your first battle', category: 'combat', prestigeReward: 10, requirement: { type: 'battles_won', target: 1 }, icon: '⚔️' },
  { id: 'warrior', name: 'Warrior', description: 'Win 50 battles', category: 'combat', prestigeReward: 50, requirement: { type: 'battles_won', target: 50 }, icon: '🗡️' },
  { id: 'warlord', name: 'Warlord', description: 'Win 500 battles', category: 'combat', prestigeReward: 200, requirement: { type: 'battles_won', target: 500 }, icon: '⚔️' },
  
  // Building achievements
  { id: 'builder', name: 'Builder', description: 'Upgrade any building to level 5', category: 'building', prestigeReward: 20, requirement: { type: 'max_building_level', target: 5 }, icon: '🏗️' },
  { id: 'architect', name: 'Architect', description: 'Upgrade HQ to level 15', category: 'building', prestigeReward: 100, requirement: { type: 'hq_level', target: 15 }, icon: '🏛️' },
  { id: 'master_builder', name: 'Master Builder', description: 'Upgrade HQ to level 20', category: 'building', prestigeReward: 300, requirement: { type: 'hq_level', target: 20 }, icon: '🏰' },
  
  // Arena achievements
  { id: 'arena_bronze', name: 'Bronze Fighter', description: 'Reach Bronze tier in Arena', category: 'arena', prestigeReward: 25, requirement: { type: 'arena_rating', target: 1000 }, icon: '🥉' },
  { id: 'arena_silver', name: 'Silver Fighter', description: 'Reach Silver tier in Arena', category: 'arena', prestigeReward: 50, requirement: { type: 'arena_rating', target: 1200 }, icon: '🥈' },
  { id: 'arena_gold', name: 'Gold Fighter', description: 'Reach Gold tier in Arena', category: 'arena', prestigeReward: 100, requirement: { type: 'arena_rating', target: 1500 }, icon: '🥇' },
  { id: 'arena_diamond', name: 'Diamond Fighter', description: 'Reach Diamond tier in Arena', category: 'arena', prestigeReward: 250, requirement: { type: 'arena_rating', target: 2000 }, icon: '💎' },
  { id: 'arena_legend', name: 'Arena Legend', description: 'Reach Legend tier in Arena', category: 'arena', prestigeReward: 500, requirement: { type: 'arena_rating', target: 2500 }, icon: '🏆' },
  
  // Conquest achievements
  { id: 'conquest_participant', name: 'Conquest Participant', description: 'Participate in a Conquest event', category: 'conquest', prestigeReward: 15, requirement: { type: 'conquest_battles', target: 1 }, icon: '🏰' },
  { id: 'conquest_veteran', name: 'Conquest Veteran', description: 'Win 20 Conquest battles', category: 'conquest', prestigeReward: 75, requirement: { type: 'conquest_wins', target: 20 }, icon: '⚔️' },
  { id: 'conquest_champion', name: 'Conquest Champion', description: 'Win 50 Conquest battles', category: 'conquest', prestigeReward: 200, requirement: { type: 'conquest_wins', target: 50 }, icon: '👑' },
  
  // Collection achievements
  { id: 'hero_collector', name: 'Hero Collector', description: 'Collect 5 heroes', category: 'collection', prestigeReward: 30, requirement: { type: 'heroes_owned', target: 5 }, icon: '🦸' },
  { id: 'hero_master', name: 'Hero Master', description: 'Collect 15 heroes', category: 'collection', prestigeReward: 100, requirement: { type: 'heroes_owned', target: 15 }, icon: '🦸‍♂️' },
  { id: 'legendary_hunter', name: 'Legendary Hunter', description: 'Collect a legendary hero', category: 'collection', prestigeReward: 150, requirement: { type: 'legendary_heroes', target: 1 }, icon: '⭐' },
  
  // Social achievements
  { id: 'guild_member', name: 'Guild Member', description: 'Join a guild', category: 'social', prestigeReward: 10, requirement: { type: 'in_guild', target: 1 }, icon: '🏛️' },
  { id: 'guild_leader', name: 'Guild Leader', description: 'Create or lead a guild', category: 'social', prestigeReward: 50, requirement: { type: 'guild_leader', target: 1 }, icon: '👑' },
  { id: 'rally_master', name: 'Rally Master', description: 'Participate in 10 rallies', category: 'social', prestigeReward: 40, requirement: { type: 'rallies_joined', target: 10 }, icon: '📯' },
];

const CACHE_KEYS = {
  PLAYER_COSMETICS: (playerId: string) => `prestige:cosmetics:${playerId}`,
  PLAYER_ACHIEVEMENTS: (playerId: string) => `prestige:achievements:${playerId}`,
  PRESTIGE_LEADERBOARD: 'prestige:leaderboard',
};

const CACHE_TTL = {
  COSMETICS: 300, // 5 minutes
  ACHIEVEMENTS: 300,
  LEADERBOARD: 60, // 1 minute
};

export class PrestigeService {
  private get db() {
    return getDatabase();
  }

  /**
   * Get all available cosmetics in the shop
   */
  getShopItems(type?: CosmeticType): Cosmetic[] {
    if (type) {
      return PRESTIGE_SHOP.filter(c => c.type === type);
    }
    return PRESTIGE_SHOP;
  }

  /**
   * Get all achievements
   */
  getAchievements(category?: string): Achievement[] {
    if (category) {
      return ACHIEVEMENTS.filter(a => a.category === category);
    }
    return ACHIEVEMENTS;
  }


  /**
   * Get player's cosmetics
   */
  async getPlayerCosmetics(playerId: string): Promise<PlayerCosmetics> {
    const cached = await cacheManager.get<PlayerCosmetics>(CACHE_KEYS.PLAYER_COSMETICS(playerId));
    if (cached) return cached;

    const record = await this.db('player_cosmetics')
      .where('player_id', playerId)
      .first();

    const cosmetics: PlayerCosmetics = record ? {
      playerId,
      unlockedCosmetics: record.unlocked_cosmetics || [],
      equippedCitySkin: record.equipped_city_skin,
      equippedBadge: record.equipped_badge,
      equippedTitle: record.equipped_title,
    } : {
      playerId,
      unlockedCosmetics: [],
      equippedCitySkin: null,
      equippedBadge: null,
      equippedTitle: null,
    };

    await cacheManager.set(CACHE_KEYS.PLAYER_COSMETICS(playerId), cosmetics, CACHE_TTL.COSMETICS);
    return cosmetics;
  }

  /**
   * Purchase a cosmetic from the prestige shop
   */
  async purchaseCosmetic(playerId: string, cosmeticId: string): Promise<{ success: boolean; message: string }> {
    const cosmetic = PRESTIGE_SHOP.find(c => c.id === cosmeticId);
    if (!cosmetic) {
      return { success: false, message: 'Cosmetic not found' };
    }

    // Check if player already owns it
    const playerCosmetics = await this.getPlayerCosmetics(playerId);
    if (playerCosmetics.unlockedCosmetics.includes(cosmeticId)) {
      return { success: false, message: 'You already own this cosmetic' };
    }

    // Check unlock requirement
    if (cosmetic.unlockRequirement) {
      const achievements = await this.getPlayerAchievements(playerId);
      const hasRequirement = achievements.some(a => a.achievementId === cosmetic.unlockRequirement && a.completed);
      if (!hasRequirement) {
        return { success: false, message: `You need the "${cosmetic.unlockRequirement}" achievement to purchase this` };
      }
    }

    // Check prestige points
    const player = await this.db('players').where('id', playerId).first();
    if (!player || player.prestige_points < cosmetic.prestigeCost) {
      return { success: false, message: `Not enough prestige points (need ${cosmetic.prestigeCost})` };
    }

    // Deduct points and add cosmetic
    await this.db.transaction(async (trx) => {
      await trx('players')
        .where('id', playerId)
        .update({ prestige_points: player.prestige_points - cosmetic.prestigeCost });

      const existing = await trx('player_cosmetics').where('player_id', playerId).first();
      if (existing) {
        const unlocked = [...(existing.unlocked_cosmetics || []), cosmeticId];
        await trx('player_cosmetics')
          .where('player_id', playerId)
          .update({ unlocked_cosmetics: JSON.stringify(unlocked) });
      } else {
        await trx('player_cosmetics').insert({
          player_id: playerId,
          unlocked_cosmetics: JSON.stringify([cosmeticId]),
        });
      }
    });

    await cacheManager.delete(CACHE_KEYS.PLAYER_COSMETICS(playerId));
    logger.info(`Player ${playerId} purchased cosmetic ${cosmeticId}`);

    return { success: true, message: `Successfully purchased ${cosmetic.name}!` };
  }

  /**
   * Equip a cosmetic
   */
  async equipCosmetic(playerId: string, cosmeticId: string): Promise<{ success: boolean; message: string }> {
    const cosmetic = PRESTIGE_SHOP.find(c => c.id === cosmeticId);
    if (!cosmetic) {
      return { success: false, message: 'Cosmetic not found' };
    }

    const playerCosmetics = await this.getPlayerCosmetics(playerId);
    if (!playerCosmetics.unlockedCosmetics.includes(cosmeticId)) {
      return { success: false, message: 'You don\'t own this cosmetic' };
    }

    const updateField = {
      city_skin: 'equipped_city_skin',
      profile_badge: 'equipped_badge',
      title: 'equipped_title',
      guild_banner: 'equipped_guild_banner',
    }[cosmetic.type];

    if (!updateField) {
      return { success: false, message: 'Invalid cosmetic type' };
    }

    await this.db('player_cosmetics')
      .where('player_id', playerId)
      .update({ [updateField]: cosmeticId });

    await cacheManager.delete(CACHE_KEYS.PLAYER_COSMETICS(playerId));

    return { success: true, message: `Equipped ${cosmetic.name}!` };
  }

  /**
   * Unequip a cosmetic
   */
  async unequipCosmetic(playerId: string, type: CosmeticType): Promise<{ success: boolean; message: string }> {
    const updateField = {
      city_skin: 'equipped_city_skin',
      profile_badge: 'equipped_badge',
      title: 'equipped_title',
      guild_banner: 'equipped_guild_banner',
    }[type];

    if (!updateField) {
      return { success: false, message: 'Invalid cosmetic type' };
    }

    await this.db('player_cosmetics')
      .where('player_id', playerId)
      .update({ [updateField]: null });

    await cacheManager.delete(CACHE_KEYS.PLAYER_COSMETICS(playerId));

    return { success: true, message: `Unequipped ${type.replace('_', ' ')}` };
  }

  /**
   * Get player's achievement progress
   */
  async getPlayerAchievements(playerId: string): Promise<PlayerAchievementProgress[]> {
    const cached = await cacheManager.get<PlayerAchievementProgress[]>(CACHE_KEYS.PLAYER_ACHIEVEMENTS(playerId));
    if (cached) return cached;

    const records = await this.db('player_achievement_progress')
      .where('player_id', playerId);

    const progress: PlayerAchievementProgress[] = records.map((r: any) => ({
      achievementId: r.achievement_id,
      progress: r.progress,
      completed: r.completed,
      completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
      claimed: r.claimed,
    }));

    await cacheManager.set(CACHE_KEYS.PLAYER_ACHIEVEMENTS(playerId), progress, CACHE_TTL.ACHIEVEMENTS);
    return progress;
  }

  /**
   * Update achievement progress for a player
   */
  async updateAchievementProgress(playerId: string, achievementId: string, progress: number): Promise<boolean> {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return false;

    const completed = progress >= achievement.requirement.target;

    await this.db('player_achievement_progress')
      .insert({
        player_id: playerId,
        achievement_id: achievementId,
        progress,
        completed,
        completed_at: completed ? new Date() : null,
        claimed: false,
      })
      .onConflict(['player_id', 'achievement_id'])
      .merge({
        progress,
        completed,
        completed_at: completed ? this.db.raw('COALESCE(completed_at, NOW())') : null,
      });

    await cacheManager.delete(CACHE_KEYS.PLAYER_ACHIEVEMENTS(playerId));

    if (completed) {
      logger.info(`Player ${playerId} completed achievement ${achievementId}`);
    }

    return completed;
  }

  /**
   * Claim achievement reward
   */
  async claimAchievementReward(playerId: string, achievementId: string): Promise<{ success: boolean; message: string; prestigeAwarded?: number }> {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) {
      return { success: false, message: 'Achievement not found' };
    }

    const progress = await this.db('player_achievement_progress')
      .where('player_id', playerId)
      .where('achievement_id', achievementId)
      .first();

    if (!progress || !progress.completed) {
      return { success: false, message: 'Achievement not completed' };
    }

    if (progress.claimed) {
      return { success: false, message: 'Reward already claimed' };
    }

    await this.db.transaction(async (trx) => {
      await trx('player_achievement_progress')
        .where('player_id', playerId)
        .where('achievement_id', achievementId)
        .update({ claimed: true });

      await trx('players')
        .where('id', playerId)
        .increment('prestige_points', achievement.prestigeReward);
    });

    await cacheManager.delete(CACHE_KEYS.PLAYER_ACHIEVEMENTS(playerId));

    return {
      success: true,
      message: `Claimed ${achievement.prestigeReward} prestige points!`,
      prestigeAwarded: achievement.prestigeReward,
    };
  }

  /**
   * Check and update all achievements for a player
   */
  async checkAllAchievements(playerId: string): Promise<string[]> {
    const completedAchievements: string[] = [];
    const player = await this.db('players').where('id', playerId).first();
    if (!player) return completedAchievements;

    // Get player stats
    const battlesWon = await this.db('battles')
      .where('attacker_id', playerId)
      .whereRaw("result->>'winner' = ?", [playerId])
      .count('* as count')
      .first();

    const hqBuilding = await this.db('buildings')
      .where('player_id', playerId)
      .where('type', 'hq')
      .first();

    const maxBuildingLevel = await this.db('buildings')
      .where('player_id', playerId)
      .max('level as max')
      .first();

    const heroCount = await this.db('heroes')
      .where('player_id', playerId)
      .count('* as count')
      .first();

    const legendaryHeroes = await this.db('heroes')
      .where('player_id', playerId)
      .where('rarity', 'legendary')
      .count('* as count')
      .first();

    const conquestBattles = await this.db('battles')
      .where('attacker_id', playerId)
      .where('type', 'conquest')
      .count('* as count')
      .first();

    const conquestWins = await this.db('battles')
      .where('attacker_id', playerId)
      .where('type', 'conquest')
      .whereRaw("result->>'winner' = ?", [playerId])
      .count('* as count')
      .first();

    const guildMember = await this.db('guild_members')
      .where('player_id', playerId)
      .first();

    const isGuildLeader = guildMember?.role === 'leader';

    // Check each achievement
    for (const achievement of ACHIEVEMENTS) {
      let currentProgress = 0;

      switch (achievement.requirement.type) {
        case 'battles_won':
          currentProgress = Number(battlesWon?.count) || 0;
          break;
        case 'hq_level':
          currentProgress = hqBuilding?.level || 0;
          break;
        case 'max_building_level':
          currentProgress = Number(maxBuildingLevel?.max) || 0;
          break;
        case 'arena_rating':
          currentProgress = player.arena_rating || 0;
          break;
        case 'heroes_owned':
          currentProgress = Number(heroCount?.count) || 0;
          break;
        case 'legendary_heroes':
          currentProgress = Number(legendaryHeroes?.count) || 0;
          break;
        case 'conquest_battles':
          currentProgress = Number(conquestBattles?.count) || 0;
          break;
        case 'conquest_wins':
          currentProgress = Number(conquestWins?.count) || 0;
          break;
        case 'in_guild':
          currentProgress = guildMember ? 1 : 0;
          break;
        case 'guild_leader':
          currentProgress = isGuildLeader ? 1 : 0;
          break;
      }

      const completed = await this.updateAchievementProgress(playerId, achievement.id, currentProgress);
      if (completed) {
        completedAchievements.push(achievement.id);
      }
    }

    return completedAchievements;
  }

  /**
   * Get prestige leaderboard
   */
  async getPrestigeLeaderboard(limit = 20): Promise<Array<{ playerId: string; username: string; faction: string; prestigePoints: number; rank: number }>> {
    const cached = await cacheManager.get<Array<{ playerId: string; username: string; faction: string; prestigePoints: number; rank: number }>>(CACHE_KEYS.PRESTIGE_LEADERBOARD);
    if (cached) return cached;

    const players = await this.db('players')
      .select('id', 'username', 'faction', 'prestige_points')
      .orderBy('prestige_points', 'desc')
      .limit(limit);

    const leaderboard = players.map((p: any, i: number) => ({
      playerId: String(p.id),
      username: p.username,
      faction: p.faction,
      prestigePoints: p.prestige_points,
      rank: i + 1,
    }));

    await cacheManager.set(CACHE_KEYS.PRESTIGE_LEADERBOARD, leaderboard, CACHE_TTL.LEADERBOARD);
    return leaderboard;
  }

  /**
   * Get player's prestige rank
   */
  async getPlayerPrestigeRank(playerId: string): Promise<number> {
    const result = await this.db.raw(`
      SELECT rank FROM (
        SELECT id, RANK() OVER (ORDER BY prestige_points DESC) as rank
        FROM players
      ) ranked WHERE id = ?
    `, [playerId]);

    return Number(result.rows[0]?.rank) || 0;
  }
}
