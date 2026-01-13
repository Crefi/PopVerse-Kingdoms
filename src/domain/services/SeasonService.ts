import { getDatabase } from '../../infrastructure/database/connection.js';
import { cacheManager, CacheManager } from '../../infrastructure/cache/CacheManager.js';
import { SEASON_DURATION_DAYS } from '../../shared/constants/game.js';
import { logger } from '../../shared/utils/logger.js';

export interface Season {
  id: bigint;
  seasonNumber: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  hallOfFame: HallOfFame;
  createdAt: Date;
}

export interface HallOfFame {
  topPower: LeaderboardEntry[];
  topArena: LeaderboardEntry[];
  topConquest: LeaderboardEntry[];
  topGuilds: GuildLeaderboardEntry[];
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  faction: string;
  score: number;
  rank: number;
}

export interface GuildLeaderboardEntry {
  guildId: string;
  name: string;
  tag: string;
  score: number;
  rank: number;
}

export interface SeasonEndRewards {
  playerId: string;
  diamonds: number;
  prestigePoints: number;
  achievements: string[];
}

export interface SeasonStatistics {
  totalPlayers: number;
  totalBattles: number;
  totalConquestEvents: number;
  factionDistribution: Record<string, number>;
  averageHqLevel: number;
  topHeroes: { name: string; count: number }[];
}

const CACHE_KEYS = {
  CURRENT_SEASON: 'season:current',
  SEASON_STATS: 'season:stats',
  GRACE_PERIOD: 'season:grace_period',
};

const CACHE_TTL = {
  CURRENT_SEASON: 3600, // 1 hour
  SEASON_STATS: 300, // 5 minutes
};

// Prestige point calculation weights
const PRESTIGE_WEIGHTS = {
  HQ_LEVEL: 100,
  ARENA_TIER_BRONZE: 50,
  ARENA_TIER_SILVER: 100,
  ARENA_TIER_GOLD: 200,
  ARENA_TIER_PLATINUM: 400,
  ARENA_TIER_DIAMOND: 800,
  ARENA_TIER_LEGEND: 1500,
  CONQUEST_PARTICIPATION: 25,
  LAND_OWNED: 50,
};

// Arena tier thresholds
const ARENA_TIERS = {
  LEGEND: 2500,
  DIAMOND: 2000,
  PLATINUM: 1500,
  GOLD: 1200,
  SILVER: 1000,
  BRONZE: 0,
};

export class SeasonService {
  private cache: CacheManager;

  constructor() {
    this.cache = cacheManager;
  }

  private get db() {
    return getDatabase();
  }

  /**
   * Get the current active season
   */
  async getCurrentSeason(): Promise<Season | null> {
    const cached = await this.cache.get<Season>(CACHE_KEYS.CURRENT_SEASON);
    if (cached) {
      return this.deserializeSeason(cached);
    }

    const season = await this.db('seasons')
      .where('active', true)
      .first();

    if (!season) return null;

    const result = this.mapDbToSeason(season);
    await this.cache.set(CACHE_KEYS.CURRENT_SEASON, result, CACHE_TTL.CURRENT_SEASON);
    return result;
  }

  /**
   * Create a new season
   */
  async createSeason(seasonNumber?: number): Promise<Season> {
    const lastSeason = await this.db('seasons')
      .orderBy('season_number', 'desc')
      .first();

    const newSeasonNumber = seasonNumber ?? (lastSeason ? lastSeason.season_number + 1 : 1);
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const [season] = await this.db('seasons')
      .insert({
        season_number: newSeasonNumber,
        starts_at: startsAt,
        ends_at: endsAt,
        active: true,
        hall_of_fame: JSON.stringify({
          topPower: [],
          topArena: [],
          topConquest: [],
          topGuilds: [],
        }),
      })
      .returning('*');

    await this.cache.delete(CACHE_KEYS.CURRENT_SEASON);
    logger.info(`Created new season ${newSeasonNumber}`);

    return this.mapDbToSeason(season);
  }


  /**
   * Check if we're in the grace period (7 days before season end)
   */
  async isInGracePeriod(): Promise<boolean> {
    const season = await this.getCurrentSeason();
    if (!season) return false;

    const gracePeriodStart = new Date(season.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    return new Date() >= gracePeriodStart;
  }

  /**
   * Get time remaining in current season
   */
  async getTimeRemaining(): Promise<{ days: number; hours: number; minutes: number } | null> {
    const season = await this.getCurrentSeason();
    if (!season) return null;

    const now = new Date();
    const remaining = season.endsAt.getTime() - now.getTime();

    if (remaining <= 0) return { days: 0, hours: 0, minutes: 0 };

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    return { days, hours, minutes };
  }

  /**
   * Calculate prestige points for a player based on their achievements
   */
  async calculatePrestigePoints(playerId: string): Promise<number> {
    let points = 0;

    // Get player data
    const player = await this.db('players').where('id', playerId).first();
    if (!player) return 0;

    // HQ level contribution
    const hqBuilding = await this.db('buildings')
      .where('player_id', playerId)
      .where('type', 'hq')
      .first();
    const hqLevel = hqBuilding?.level || 1;
    points += hqLevel * PRESTIGE_WEIGHTS.HQ_LEVEL;

    // Arena tier contribution
    const arenaRating = player.arena_rating;
    if (arenaRating >= ARENA_TIERS.LEGEND) {
      points += PRESTIGE_WEIGHTS.ARENA_TIER_LEGEND;
    } else if (arenaRating >= ARENA_TIERS.DIAMOND) {
      points += PRESTIGE_WEIGHTS.ARENA_TIER_DIAMOND;
    } else if (arenaRating >= ARENA_TIERS.PLATINUM) {
      points += PRESTIGE_WEIGHTS.ARENA_TIER_PLATINUM;
    } else if (arenaRating >= ARENA_TIERS.GOLD) {
      points += PRESTIGE_WEIGHTS.ARENA_TIER_GOLD;
    } else if (arenaRating >= ARENA_TIERS.SILVER) {
      points += PRESTIGE_WEIGHTS.ARENA_TIER_SILVER;
    } else {
      points += PRESTIGE_WEIGHTS.ARENA_TIER_BRONZE;
    }

    // Conquest participation
    const conquestBattles = await this.db('battles')
      .where('attacker_id', playerId)
      .where('type', 'conquest')
      .count('* as count')
      .first();
    points += (Number(conquestBattles?.count) || 0) * PRESTIGE_WEIGHTS.CONQUEST_PARTICIPATION;

    // Land ownership
    const landsOwned = await this.db('land_parcels')
      .where('owner_player_id', playerId)
      .count('* as count')
      .first();
    points += (Number(landsOwned?.count) || 0) * PRESTIGE_WEIGHTS.LAND_OWNED;

    return points;
  }

  /**
   * Calculate end-of-season rewards for a player
   */
  async calculateSeasonEndRewards(playerId: string): Promise<SeasonEndRewards> {
    const prestigePoints = await this.calculatePrestigePoints(playerId);
    
    // Diamond rewards based on prestige points
    const diamonds = Math.floor(prestigePoints / 10);

    // Check for achievements
    const achievements: string[] = [];
    
    const player = await this.db('players').where('id', playerId).first();
    if (!player) {
      return { playerId, diamonds: 0, prestigePoints: 0, achievements: [] };
    }

    // Check arena achievements
    if (player.arena_rating >= ARENA_TIERS.LEGEND) {
      achievements.push('arena_legend');
    } else if (player.arena_rating >= ARENA_TIERS.DIAMOND) {
      achievements.push('arena_diamond');
    }

    // Check HQ level achievements
    const hqBuilding = await this.db('buildings')
      .where('player_id', playerId)
      .where('type', 'hq')
      .first();
    if (hqBuilding?.level >= 20) {
      achievements.push('master_builder');
    } else if (hqBuilding?.level >= 15) {
      achievements.push('city_architect');
    }

    // Check conquest achievements
    const conquestWins = await this.db('battles')
      .where('attacker_id', playerId)
      .where('type', 'conquest')
      .whereRaw("result->>'winner' = ?", [playerId])
      .count('* as count')
      .first();
    if (Number(conquestWins?.count) >= 50) {
      achievements.push('conquest_champion');
    } else if (Number(conquestWins?.count) >= 20) {
      achievements.push('conquest_veteran');
    }

    return { playerId, diamonds, prestigePoints, achievements };
  }

  /**
   * Build the Hall of Fame for the current season
   */
  async buildHallOfFame(): Promise<HallOfFame> {
    // Top power players (based on total hero power + troops)
    const topPowerPlayers = await this.db('players')
      .select('players.id', 'players.username', 'players.faction')
      .select(this.db.raw(`
        COALESCE((
          SELECT SUM(
            CASE rarity
              WHEN 'common' THEN level * 10 + 50
              WHEN 'rare' THEN level * 15 + 100
              WHEN 'epic' THEN level * 25 + 200
              WHEN 'legendary' THEN level * 40 + 400
            END
          )
          FROM heroes WHERE heroes.player_id = players.id
        ), 0) +
        COALESCE((
          SELECT SUM(count * tier * 10)
          FROM troops WHERE troops.player_id = players.id
        ), 0) as total_power
      `))
      .orderBy('total_power', 'desc')
      .limit(10);

    const topPower: LeaderboardEntry[] = topPowerPlayers.map((p, i) => ({
      playerId: String(p.id),
      username: p.username,
      faction: p.faction,
      score: Number(p.total_power),
      rank: i + 1,
    }));

    // Top arena players
    const topArenaPlayers = await this.db('players')
      .select('id', 'username', 'faction', 'arena_rating')
      .orderBy('arena_rating', 'desc')
      .limit(10);

    const topArena: LeaderboardEntry[] = topArenaPlayers.map((p, i) => ({
      playerId: String(p.id),
      username: p.username,
      faction: p.faction,
      score: p.arena_rating,
      rank: i + 1,
    }));

    // Top conquest players (by conquest battle wins)
    const topConquestPlayers = await this.db('battles')
      .select('players.id', 'players.username', 'players.faction')
      .count('battles.id as wins')
      .join('players', 'players.id', 'battles.attacker_id')
      .where('battles.type', 'conquest')
      .whereRaw("battles.result->>'winner' = battles.attacker_id::text")
      .groupBy('players.id', 'players.username', 'players.faction')
      .orderBy('wins', 'desc')
      .limit(10);

    const topConquest: LeaderboardEntry[] = topConquestPlayers.map((p: any, i) => ({
      playerId: String(p.id),
      username: String(p.username),
      faction: String(p.faction),
      score: Number(p.wins),
      rank: i + 1,
    }));

    // Top guilds (by total member power)
    const topGuildsData = await this.db('guilds')
      .select('guilds.id', 'guilds.name', 'guilds.tag')
      .select(this.db.raw(`
        COALESCE((
          SELECT SUM(
            COALESCE((
              SELECT SUM(
                CASE rarity
                  WHEN 'common' THEN level * 10 + 50
                  WHEN 'rare' THEN level * 15 + 100
                  WHEN 'epic' THEN level * 25 + 200
                  WHEN 'legendary' THEN level * 40 + 400
                END
              )
              FROM heroes WHERE heroes.player_id = gm.player_id
            ), 0)
          )
          FROM guild_members gm WHERE gm.guild_id = guilds.id
        ), 0) as total_power
      `))
      .where('guilds.is_starter_guild', false)
      .orderBy('total_power', 'desc')
      .limit(10);

    const topGuilds: GuildLeaderboardEntry[] = topGuildsData.map((g, i) => ({
      guildId: String(g.id),
      name: g.name,
      tag: g.tag,
      score: Number(g.total_power),
      rank: i + 1,
    }));

    return { topPower, topArena, topConquest, topGuilds };
  }


  /**
   * End the current season and process rewards
   */
  async endSeason(): Promise<{ hallOfFame: HallOfFame; rewardsDistributed: number }> {
    const currentSeason = await this.getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No active season to end');
    }

    logger.info(`Ending season ${currentSeason.seasonNumber}`);

    // Build Hall of Fame
    const hallOfFame = await this.buildHallOfFame();

    // Get all players
    const players = await this.db('players').select('id', 'diamonds', 'prestige_points');

    // Calculate and distribute rewards
    let rewardsDistributed = 0;
    for (const player of players) {
      const rewards = await this.calculateSeasonEndRewards(String(player.id));
      
      // Update player with rewards (diamonds and prestige points are preserved)
      await this.db('players')
        .where('id', player.id)
        .update({
          diamonds: player.diamonds + rewards.diamonds,
          prestige_points: player.prestige_points + rewards.prestigePoints,
        });

      // Store achievements
      if (rewards.achievements.length > 0) {
        await this.storePlayerAchievements(String(player.id), rewards.achievements);
      }

      rewardsDistributed++;
    }

    // Update season with Hall of Fame and mark as inactive
    await this.db('seasons')
      .where('id', String(currentSeason.id))
      .update({
        active: false,
        hall_of_fame: JSON.stringify(hallOfFame),
      });

    await this.cache.delete(CACHE_KEYS.CURRENT_SEASON);
    logger.info(`Season ${currentSeason.seasonNumber} ended. Rewards distributed to ${rewardsDistributed} players`);

    return { hallOfFame, rewardsDistributed };
  }

  /**
   * Store player achievements
   */
  private async storePlayerAchievements(playerId: string, achievements: string[]): Promise<void> {
    // Check if player_achievements table exists, if not we'll store in a JSONB column
    const existingAchievements = await this.db('player_achievements')
      .where('player_id', playerId)
      .first()
      .catch(() => null);

    if (existingAchievements) {
      const current = existingAchievements.achievements || [];
      const updated = [...new Set([...current, ...achievements])];
      await this.db('player_achievements')
        .where('player_id', playerId)
        .update({ achievements: JSON.stringify(updated) });
    } else {
      await this.db('player_achievements')
        .insert({
          player_id: playerId,
          achievements: JSON.stringify(achievements),
        })
        .catch(() => {
          // Table might not exist, log and continue
          logger.warn(`Could not store achievements for player ${playerId}`);
        });
    }
  }

  /**
   * Reset all player progress for new season (preserves diamonds and prestige)
   */
  async resetPlayerProgress(): Promise<number> {
    logger.info('Resetting player progress for new season');

    // Reset player resources and arena rating (preserve diamonds and prestige)
    await this.db('players').update({
      resources: JSON.stringify({ food: 5000, iron: 2500, gold: 1000 }),
      arena_rating: 1000,
      arena_tokens: 10,
      protection_until: this.db.raw("NOW() + INTERVAL '24 hours'"),
    });

    // Delete all heroes
    await this.db('heroes').delete();

    // Delete all buildings
    await this.db('buildings').delete();

    // Delete all troops
    await this.db('troops').delete();

    // Delete all research
    await this.db('research').delete();

    // Delete all marches
    await this.db('marches').delete();

    // Delete all battles
    await this.db('battles').delete();

    // Delete all arena defenses
    await this.db('arena_defenses').delete();

    // Delete all daily quests
    await this.db('daily_quests').delete();

    // Delete all login rewards
    await this.db('login_rewards').delete();

    // Delete all fog of war
    await this.db('fog_of_war').delete();

    // Delete all conquest events
    await this.db('conquest_events').delete();

    // Reset land ownership
    await this.db('land_parcels').update({
      owner_player_id: null,
      owner_guild_id: null,
    });

    // Reset tutorial progress
    await this.db('tutorial_progress').update({
      current_step: 0,
      completed_steps: JSON.stringify([]),
      claimed_rewards: JSON.stringify([]),
      tutorial_completed: false,
      completed_at: null,
    });

    const playerCount = await this.db('players').count('* as count').first();
    logger.info(`Reset progress for ${playerCount?.count} players`);

    return Number(playerCount?.count) || 0;
  }

  /**
   * Initialize a new season with fresh map and starter guilds
   */
  async initializeNewSeason(): Promise<Season> {
    logger.info('Initializing new season');

    // End current season if exists
    const currentSeason = await this.getCurrentSeason();
    if (currentSeason) {
      await this.endSeason();
    }

    // Reset player progress
    await this.resetPlayerProgress();

    // Regenerate map (clear and reseed)
    await this.regenerateMap();

    // Recreate starter guilds
    await this.recreateStarterGuilds();

    // Respawn NPCs
    await this.respawnAllNpcs();

    // Create new season
    const newSeason = await this.createSeason();

    // Assign starter heroes to all players
    await this.assignStarterHeroes();

    // Create starter buildings for all players
    await this.createStarterBuildings();

    logger.info(`New season ${newSeason.seasonNumber} initialized`);
    return newSeason;
  }

  /**
   * Regenerate the game map
   */
  private async regenerateMap(): Promise<void> {
    logger.info('Regenerating map');

    // Clear existing map tiles
    await this.db('map_tiles').delete();

    // The map will be regenerated by the seed script
    // For now, we'll create a basic map structure
    const MAP_SIZE = 100;
    const tiles: Array<{ x: number; y: number; terrain: string }> = [];

    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        let terrain = 'plains';
        
        // Add some variety
        const rand = Math.random();
        if (rand < 0.05) terrain = 'mountain';
        else if (rand < 0.08) terrain = 'lake';
        else if (rand < 0.15) terrain = 'forest';
        else if (rand < 0.25) terrain = 'resource';

        tiles.push({ x, y, terrain });
      }
    }

    // Batch insert tiles
    const batchSize = 1000;
    for (let i = 0; i < tiles.length; i += batchSize) {
      const batch = tiles.slice(i, i + batchSize);
      await this.db('map_tiles').insert(batch);
    }

    logger.info('Map regenerated');
  }

  /**
   * Recreate starter guilds
   */
  private async recreateStarterGuilds(): Promise<void> {
    logger.info('Recreating starter guilds');

    // Delete existing starter guilds
    await this.db('guilds').where('is_starter_guild', true).delete();

    // Create new starter guilds
    const starterGuilds = [
      { name: 'Cinema Legion', tag: 'CINE', faction: 'cinema' },
      { name: 'Otaku Alliance', tag: 'OTAK', faction: 'otaku' },
      { name: 'Arcade Coalition', tag: 'ARCA', faction: 'arcade' },
    ];

    for (const guild of starterGuilds) {
      await this.db('guilds').insert({
        name: guild.name,
        tag: guild.tag,
        is_starter_guild: true,
        treasury: JSON.stringify({ food: 0, iron: 0, gold: 0 }),
      });
    }

    logger.info('Starter guilds recreated');
  }

  /**
   * Respawn all NPCs
   */
  private async respawnAllNpcs(): Promise<void> {
    logger.info('Respawning NPCs');

    // Clear existing NPCs
    await this.db('npcs').delete();

    // NPC spawning will be handled by NpcService
    // This is a placeholder for the respawn logic
    logger.info('NPCs respawned');
  }

  /**
   * Assign starter heroes to all players based on faction
   */
  private async assignStarterHeroes(): Promise<void> {
    logger.info('Assigning starter heroes');

    const players = await this.db('players').select('id', 'faction');
    const heroTemplates = await this.db('hero_templates').select('*');

    for (const player of players) {
      // Find starter hero for faction
      const starterHero = heroTemplates.find(
        (h: any) => h.faction === player.faction && h.is_starter
      );

      if (starterHero) {
        await this.db('heroes').insert({
          player_id: player.id,
          name: starterHero.name,
          faction: starterHero.faction,
          element: starterHero.element,
          rarity: starterHero.rarity,
          level: 1,
          experience: 0,
          attack: starterHero.base_attack,
          defense: starterHero.base_defense,
          speed: starterHero.base_speed,
          hp: starterHero.base_hp,
          skills: JSON.stringify(starterHero.skills || []),
          gear: JSON.stringify({}),
        });
      }
    }

    logger.info('Starter heroes assigned');
  }

  /**
   * Create starter buildings for all players
   */
  private async createStarterBuildings(): Promise<void> {
    logger.info('Creating starter buildings');

    const players = await this.db('players').select('id');

    for (const player of players) {
      // Create HQ level 1
      await this.db('buildings').insert({
        player_id: player.id,
        type: 'hq',
        level: 1,
      });
    }

    logger.info('Starter buildings created');
  }


  /**
   * Get season statistics
   */
  async getSeasonStatistics(): Promise<SeasonStatistics> {
    const cached = await this.cache.get<SeasonStatistics>(CACHE_KEYS.SEASON_STATS);
    if (cached) return cached;

    const totalPlayers = await this.db('players').count('* as count').first();
    const totalBattles = await this.db('battles').count('* as count').first();
    const totalConquestEvents = await this.db('conquest_events').count('* as count').first();

    const factionCounts = await this.db('players')
      .select('faction')
      .count('* as count')
      .groupBy('faction');

    const factionDistribution: Record<string, number> = {};
    for (const fc of factionCounts) {
      factionDistribution[fc.faction as string] = Number(fc.count);
    }

    const avgHqLevel = await this.db('buildings')
      .where('type', 'hq')
      .avg('level as avg')
      .first();

    const topHeroes = await this.db('heroes')
      .select('name')
      .count('* as count')
      .groupBy('name')
      .orderBy('count', 'desc')
      .limit(10);

    const stats: SeasonStatistics = {
      totalPlayers: Number(totalPlayers?.count) || 0,
      totalBattles: Number(totalBattles?.count) || 0,
      totalConquestEvents: Number(totalConquestEvents?.count) || 0,
      factionDistribution,
      averageHqLevel: Number(avgHqLevel?.avg) || 1,
      topHeroes: topHeroes.map((h: any) => ({ name: h.name, count: Number(h.count) })),
    };

    await this.cache.set(CACHE_KEYS.SEASON_STATS, stats, CACHE_TTL.SEASON_STATS);
    return stats;
  }

  /**
   * Get historical seasons
   */
  async getSeasonHistory(limit = 10): Promise<Season[]> {
    const seasons = await this.db('seasons')
      .orderBy('season_number', 'desc')
      .limit(limit);

    return seasons.map((s: any) => this.mapDbToSeason(s));
  }

  /**
   * Get a specific season by number
   */
  async getSeasonByNumber(seasonNumber: number): Promise<Season | null> {
    const season = await this.db('seasons')
      .where('season_number', seasonNumber)
      .first();

    return season ? this.mapDbToSeason(season) : null;
  }

  /**
   * Schedule season end notification
   */
  async scheduleSeasonEndNotification(daysBeforeEnd: number): Promise<void> {
    const season = await this.getCurrentSeason();
    if (!season) return;

    const notificationTime = new Date(
      season.endsAt.getTime() - daysBeforeEnd * 24 * 60 * 60 * 1000
    );

    if (notificationTime > new Date()) {
      // Store notification schedule in cache
      await this.cache.set(
        `season:notification:${daysBeforeEnd}`,
        { seasonId: String(season.id), notificationTime: notificationTime.toISOString() },
        daysBeforeEnd * 24 * 60 * 60
      );
    }
  }

  /**
   * Check if season should end
   */
  async shouldSeasonEnd(): Promise<boolean> {
    const season = await this.getCurrentSeason();
    if (!season) return false;

    return new Date() >= season.endsAt;
  }

  /**
   * Get player's season summary
   */
  async getPlayerSeasonSummary(playerId: string): Promise<{
    prestigePoints: number;
    estimatedRewards: SeasonEndRewards;
    rank: { power: number; arena: number; conquest: number };
    achievements: string[];
  }> {
    const prestigePoints = await this.calculatePrestigePoints(playerId);
    const estimatedRewards = await this.calculateSeasonEndRewards(playerId);

    // Get player ranks
    const powerRank = await this.getPlayerPowerRank(playerId);
    const arenaRank = await this.getPlayerArenaRank(playerId);
    const conquestRank = await this.getPlayerConquestRank(playerId);

    // Get existing achievements
    const achievementsRecord = await this.db('player_achievements')
      .where('player_id', playerId)
      .first()
      .catch(() => null);

    const achievements = achievementsRecord?.achievements || [];

    return {
      prestigePoints,
      estimatedRewards,
      rank: {
        power: powerRank,
        arena: arenaRank,
        conquest: conquestRank,
      },
      achievements,
    };
  }

  private async getPlayerPowerRank(playerId: string): Promise<number> {
    const result = await this.db.raw(`
      SELECT rank FROM (
        SELECT id, RANK() OVER (ORDER BY (
          COALESCE((SELECT SUM(
            CASE rarity
              WHEN 'common' THEN level * 10 + 50
              WHEN 'rare' THEN level * 15 + 100
              WHEN 'epic' THEN level * 25 + 200
              WHEN 'legendary' THEN level * 40 + 400
            END
          ) FROM heroes WHERE heroes.player_id = players.id), 0) +
          COALESCE((SELECT SUM(count * tier * 10) FROM troops WHERE troops.player_id = players.id), 0)
        ) DESC) as rank
        FROM players
      ) ranked WHERE id = ?
    `, [playerId]);

    return Number(result.rows[0]?.rank) || 0;
  }

  private async getPlayerArenaRank(playerId: string): Promise<number> {
    const result = await this.db.raw(`
      SELECT rank FROM (
        SELECT id, RANK() OVER (ORDER BY arena_rating DESC) as rank
        FROM players
      ) ranked WHERE id = ?
    `, [playerId]);

    return Number(result.rows[0]?.rank) || 0;
  }

  private async getPlayerConquestRank(playerId: string): Promise<number> {
    const result = await this.db.raw(`
      SELECT rank FROM (
        SELECT attacker_id as id, RANK() OVER (ORDER BY COUNT(*) DESC) as rank
        FROM battles
        WHERE type = 'conquest' AND result->>'winner' = attacker_id::text
        GROUP BY attacker_id
      ) ranked WHERE id = ?
    `, [playerId]);

    return Number(result.rows[0]?.rank) || 0;
  }

  private mapDbToSeason(dbSeason: any): Season {
    return {
      id: BigInt(dbSeason.id),
      seasonNumber: dbSeason.season_number,
      startsAt: new Date(dbSeason.starts_at),
      endsAt: new Date(dbSeason.ends_at),
      active: dbSeason.active,
      hallOfFame: typeof dbSeason.hall_of_fame === 'string'
        ? JSON.parse(dbSeason.hall_of_fame)
        : dbSeason.hall_of_fame,
      createdAt: new Date(dbSeason.created_at),
    };
  }

  private deserializeSeason(cached: any): Season {
    return {
      ...cached,
      id: BigInt(cached.id),
      startsAt: new Date(cached.startsAt),
      endsAt: new Date(cached.endsAt),
      createdAt: new Date(cached.createdAt),
    };
  }

  // ==================== END-OF-SEASON EVENTS ====================

  /**
   * Check if we're in the final week (bonus period)
   */
  async isInFinalWeek(): Promise<boolean> {
    const season = await this.getCurrentSeason();
    if (!season) return false;

    const finalWeekStart = new Date(season.endsAt.getTime() - 7 * 24 * 60 * 60 * 1000);
    return new Date() >= finalWeekStart;
  }

  /**
   * Get active bonuses for the current period
   */
  async getActiveBonuses(): Promise<{
    doubleDiamonds: boolean;
    xpBoost: number;
    landSaleDiscount: number;
    description: string[];
  }> {
    const inFinalWeek = await this.isInFinalWeek();
    const inGracePeriod = await this.isInGracePeriod();
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const bonuses = {
      doubleDiamonds: false,
      xpBoost: 1.0,
      landSaleDiscount: 0,
      description: [] as string[],
    };

    if (inFinalWeek) {
      // Final week bonuses
      bonuses.doubleDiamonds = true;
      bonuses.description.push('🎉 Double Diamonds from all sources!');

      if (isWeekend) {
        bonuses.xpBoost = 2.0;
        bonuses.description.push('⚡ 2x Hero XP Weekend!');
      } else {
        bonuses.xpBoost = 1.5;
        bonuses.description.push('⚡ 1.5x Hero XP Boost!');
      }

      bonuses.landSaleDiscount = 0.25; // 25% off land
      bonuses.description.push('🏠 25% off Land Purchases!');
    }

    if (inGracePeriod) {
      bonuses.description.push('⚠️ Grace Period - Claim your rewards before season ends!');
    }

    return bonuses;
  }

  /**
   * Get player's personal season wrap-up summary
   */
  async getPlayerSeasonWrapUp(playerId: string): Promise<{
    seasonNumber: number;
    totalBattles: number;
    battlesWon: number;
    winRate: number;
    heroesRecruited: number;
    buildingsUpgraded: number;
    landsOwned: number;
    conquestParticipation: number;
    arenaHighestRating: number;
    totalResourcesGathered: { food: number; iron: number; gold: number };
    topHero: { name: string; level: number } | null;
    achievements: string[];
    finalRanks: { power: number; arena: number; conquest: number };
    estimatedRewards: SeasonEndRewards;
  }> {
    const season = await this.getCurrentSeason();
    const seasonNumber = season?.seasonNumber || 0;

    // Get battle stats
    const totalBattles = await this.db('battles')
      .where('attacker_id', playerId)
      .count('* as count')
      .first();

    const battlesWon = await this.db('battles')
      .where('attacker_id', playerId)
      .whereRaw("result->>'winner' = ?", [playerId])
      .count('* as count')
      .first();

    const total = Number(totalBattles?.count) || 0;
    const won = Number(battlesWon?.count) || 0;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

    // Get hero stats
    const heroCount = await this.db('heroes')
      .where('player_id', playerId)
      .count('* as count')
      .first();

    const topHero = await this.db('heroes')
      .where('player_id', playerId)
      .orderBy('level', 'desc')
      .first();

    // Get building stats
    const buildingCount = await this.db('buildings')
      .where('player_id', playerId)
      .sum('level as total')
      .first();

    // Get land stats
    const landsOwned = await this.db('land_parcels')
      .where('owner_player_id', playerId)
      .count('* as count')
      .first();

    // Get conquest participation
    const conquestBattles = await this.db('battles')
      .where('attacker_id', playerId)
      .where('type', 'conquest')
      .count('* as count')
      .first();

    // Get player data
    const player = await this.db('players').where('id', playerId).first();

    // Get ranks
    const powerRank = await this.getPlayerPowerRank(playerId);
    const arenaRank = await this.getPlayerArenaRank(playerId);
    const conquestRank = await this.getPlayerConquestRank(playerId);

    // Get achievements
    const achievementsRecord = await this.db('player_achievements')
      .where('player_id', playerId)
      .first()
      .catch(() => null);

    // Get estimated rewards
    const estimatedRewards = await this.calculateSeasonEndRewards(playerId);

    return {
      seasonNumber,
      totalBattles: total,
      battlesWon: won,
      winRate,
      heroesRecruited: Number(heroCount?.count) || 0,
      buildingsUpgraded: Number(buildingCount?.total) || 0,
      landsOwned: Number(landsOwned?.count) || 0,
      conquestParticipation: Number(conquestBattles?.count) || 0,
      arenaHighestRating: player?.arena_rating || 1000,
      totalResourcesGathered: { food: 0, iron: 0, gold: 0 }, // Would need activity tracking
      topHero: topHero ? { name: topHero.name, level: topHero.level } : null,
      achievements: achievementsRecord?.achievements || [],
      finalRanks: {
        power: powerRank,
        arena: arenaRank,
        conquest: conquestRank,
      },
      estimatedRewards,
    };
  }

  /**
   * Get season transition preview (what's coming next season)
   */
  async getSeasonPreview(): Promise<{
    nextSeasonNumber: number;
    estimatedStartDate: Date;
    newFeatures: string[];
    tips: string[];
  }> {
    const currentSeason = await this.getCurrentSeason();
    const nextSeasonNumber = (currentSeason?.seasonNumber || 0) + 1;
    const estimatedStartDate = currentSeason 
      ? new Date(currentSeason.endsAt.getTime() + 24 * 60 * 60 * 1000) // 1 day after current ends
      : new Date();

    return {
      nextSeasonNumber,
      estimatedStartDate,
      newFeatures: [
        '🗺️ Fresh map with new strategic locations',
        '🏰 All empires reset - equal starting ground',
        '⚔️ New Conquest event schedule',
        '🎁 Preserved Diamonds and Prestige Points',
      ],
      tips: [
        '💎 Spend your resources before reset - they won\'t carry over!',
        '🏆 Claim all achievement rewards before season ends',
        '📊 Check your season summary with /season summary',
        '⭐ Your Prestige Points are permanent - keep earning!',
      ],
    };
  }

  /**
   * Get celebration data for end-of-season
   */
  async getCelebrationData(): Promise<{
    topPlayers: LeaderboardEntry[];
    topGuilds: GuildLeaderboardEntry[];
    seasonHighlights: {
      totalBattles: number;
      totalPlayers: number;
      mostPopularFaction: string;
      mostUsedHero: string;
    };
    specialAwards: Array<{
      title: string;
      playerId: string;
      username: string;
      description: string;
    }>;
  }> {
    const hallOfFame = await this.buildHallOfFame();
    const stats = await this.getSeasonStatistics();

    // Find most popular faction
    const factionEntries = Object.entries(stats.factionDistribution);
    const mostPopularFaction = factionEntries.length > 0
      ? factionEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
      : 'unknown';

    // Find most used hero
    const mostUsedHero = stats.topHeroes.length > 0 ? stats.topHeroes[0].name : 'unknown';

    // Generate special awards
    const specialAwards: Array<{
      title: string;
      playerId: string;
      username: string;
      description: string;
    }> = [];

    // Most battles fought
    const mostBattles = await this.db('battles')
      .select('attacker_id')
      .count('* as count')
      .groupBy('attacker_id')
      .orderBy('count', 'desc')
      .first();

    if (mostBattles) {
      const player = await this.db('players').where('id', mostBattles.attacker_id).first();
      if (player) {
        specialAwards.push({
          title: '⚔️ Battle Maniac',
          playerId: String(mostBattles.attacker_id),
          username: player.username,
          description: `Fought ${mostBattles.count} battles this season!`,
        });
      }
    }

    // Most lands owned
    const mostLands = await this.db('land_parcels')
      .select('owner_player_id')
      .count('* as count')
      .whereNotNull('owner_player_id')
      .groupBy('owner_player_id')
      .orderBy('count', 'desc')
      .first();

    if (mostLands) {
      const player = await this.db('players').where('id', mostLands.owner_player_id).first();
      if (player) {
        specialAwards.push({
          title: '🏠 Land Baron',
          playerId: String(mostLands.owner_player_id),
          username: player.username,
          description: `Owned ${mostLands.count} land parcels!`,
        });
      }
    }

    // Highest level hero
    const highestHero = await this.db('heroes')
      .select('heroes.*', 'players.username')
      .join('players', 'players.id', 'heroes.player_id')
      .orderBy('heroes.level', 'desc')
      .first();

    if (highestHero) {
      specialAwards.push({
        title: '🦸 Hero Master',
        playerId: String(highestHero.player_id),
        username: highestHero.username,
        description: `Trained ${highestHero.name} to level ${highestHero.level}!`,
      });
    }

    return {
      topPlayers: hallOfFame.topPower.slice(0, 3),
      topGuilds: hallOfFame.topGuilds.slice(0, 3),
      seasonHighlights: {
        totalBattles: stats.totalBattles,
        totalPlayers: stats.totalPlayers,
        mostPopularFaction,
        mostUsedHero,
      },
      specialAwards,
    };
  }
}
