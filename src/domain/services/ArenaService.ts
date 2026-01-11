import { getDatabase } from '../../infrastructure/database/connection.js';
import { Hero } from '../entities/Hero.js';
import { combatService, CombatContext, DetailedBattleResult } from './CombatService.js';
import type { Faction, Element, HeroRarity, ArenaTier } from '../../shared/types/index.js';
import {
  ARENA_MATCHMAKING_RANGE,
  ARENA_DAILY_FREE_ATTACKS,
  ARENA_MAX_TOKENS,
  ARENA_TOKEN_REGEN_HOURS,
  ARENA_WIN_POINTS_MIN,
  ARENA_WIN_POINTS_MAX,
  ARENA_LOSS_POINTS_MIN,
  ARENA_LOSS_POINTS_MAX,
} from '../../shared/constants/game.js';

// Arena tier thresholds
const ARENA_TIER_THRESHOLDS: Record<ArenaTier, { min: number; max: number }> = {
  bronze: { min: 0, max: 999 },
  silver: { min: 1000, max: 1499 },
  gold: { min: 1500, max: 1999 },
  platinum: { min: 2000, max: 2499 },
  diamond: { min: 2500, max: 2999 },
  legend: { min: 3000, max: Infinity },
};

// Weekly rewards by tier
const ARENA_WEEKLY_REWARDS: Record<ArenaTier, { diamonds: number; heroShards: number }> = {
  bronze: { diamonds: 50, heroShards: 0 },
  silver: { diamonds: 100, heroShards: 5 },
  gold: { diamonds: 250, heroShards: 10 },
  platinum: { diamonds: 500, heroShards: 20 },
  diamond: { diamonds: 1000, heroShards: 35 },
  legend: { diamonds: 2000, heroShards: 50 },
};

// Bot hero templates for low population - using famous characters with [BOT] tags
const BOT_HEROES: { name: string; faction: Faction; element: Element; rarity: HeroRarity }[] = [
  // Cinema (Fire) bots
  { name: '[BOT] John Rambo', faction: 'cinema', element: 'fire', rarity: 'rare' },
  { name: '[BOT] Ellen Ripley', faction: 'cinema', element: 'fire', rarity: 'rare' },
  { name: '[BOT] Neo Anderson', faction: 'cinema', element: 'fire', rarity: 'epic' },
  { name: '[BOT] Sarah Connor', faction: 'cinema', element: 'fire', rarity: 'epic' },
  // Otaku (Wind) bots
  { name: '[BOT] Sasuke Uchiha', faction: 'otaku', element: 'wind', rarity: 'rare' },
  { name: '[BOT] Mikasa Ackerman', faction: 'otaku', element: 'wind', rarity: 'rare' },
  { name: '[BOT] Levi Ackerman', faction: 'otaku', element: 'wind', rarity: 'epic' },
  { name: '[BOT] Ichigo Kurosaki', faction: 'otaku', element: 'wind', rarity: 'epic' },
  // Arcade (Water) bots
  { name: '[BOT] Link Hero', faction: 'arcade', element: 'water', rarity: 'rare' },
  { name: '[BOT] Samus Aran', faction: 'arcade', element: 'water', rarity: 'rare' },
  { name: '[BOT] Cloud Strife', faction: 'arcade', element: 'water', rarity: 'epic' },
  { name: '[BOT] Solid Snake', faction: 'arcade', element: 'water', rarity: 'epic' },
];

export interface ArenaOpponent {
  id: string;
  username: string;
  faction: Faction;
  rating: number;
  power: number;
  isBot: boolean;
  heroes: { name: string; level: number; rarity: HeroRarity; power: number }[];
}

export interface ArenaDefenseTeam {
  hero1: Hero | null;
  hero2: Hero | null;
  hero3: Hero | null;
}

export interface ArenaBattleResult {
  winner: 'attacker' | 'defender';
  ratingChange: number;
  diamondsEarned: number;
  heroXpGained: number;
  battleDetails: DetailedBattleResult;
  opponentName: string;
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

interface PlayerRow {
  id: string;
  discord_id: string;
  username: string;
  faction: Faction;
  arena_rating: number;
  arena_tokens: number;
  last_arena_token_regen: Date;
}

interface ArenaDefenseRow {
  player_id: string;
  hero1_id: string | null;
  hero2_id: string | null;
  hero3_id: string | null;
}

export class ArenaService {
  /**
   * Get player's current arena tier based on rating
   */
  getTier(rating: number): ArenaTier {
    for (const [tier, { min, max }] of Object.entries(ARENA_TIER_THRESHOLDS)) {
      if (rating >= min && rating <= max) {
        return tier as ArenaTier;
      }
    }
    return 'bronze';
  }

  /**
   * Get tier display info
   */
  getTierInfo(tier: ArenaTier): { name: string; emoji: string; color: number } {
    const info: Record<ArenaTier, { name: string; emoji: string; color: number }> = {
      bronze: { name: 'Bronze', emoji: '🥉', color: 0xcd7f32 },
      silver: { name: 'Silver', emoji: '🥈', color: 0xc0c0c0 },
      gold: { name: 'Gold', emoji: '🥇', color: 0xffd700 },
      platinum: { name: 'Platinum', emoji: '💎', color: 0xe5e4e2 },
      diamond: { name: 'Diamond', emoji: '💠', color: 0xb9f2ff },
      legend: { name: 'Legend', emoji: '👑', color: 0xff4500 },
    };
    return info[tier];
  }

  /**
   * Get weekly rewards for a tier
   */
  getWeeklyRewards(tier: ArenaTier): { diamonds: number; heroShards: number } {
    return ARENA_WEEKLY_REWARDS[tier];
  }

  /**
   * Regenerate arena tokens based on time elapsed
   */
  async regenerateTokens(playerId: string): Promise<number> {
    const db = getDatabase();
    const player = await db('players')
      .select('arena_tokens', 'last_arena_token_regen')
      .where('id', playerId)
      .first() as PlayerRow | undefined;

    if (!player) return 0;

    const now = new Date();
    const lastRegen = new Date(player.last_arena_token_regen);
    const hoursPassed = (now.getTime() - lastRegen.getTime()) / (1000 * 60 * 60);
    const tokensToAdd = Math.floor(hoursPassed / ARENA_TOKEN_REGEN_HOURS);

    if (tokensToAdd > 0 && player.arena_tokens < ARENA_MAX_TOKENS) {
      const newTokens = Math.min(ARENA_MAX_TOKENS, player.arena_tokens + tokensToAdd);
      await db('players')
        .where('id', playerId)
        .update({
          arena_tokens: newTokens,
          last_arena_token_regen: now,
        });
      return newTokens;
    }

    return player.arena_tokens;
  }

  /**
   * Check if player can attack (has tokens or free attacks remaining)
   */
  async canAttack(playerId: string): Promise<{ canAttack: boolean; tokensRemaining: number; freeAttacksUsed: number }> {
    const db = getDatabase();
    
    // Regenerate tokens first
    const tokens = await this.regenerateTokens(playerId);

    // Count today's arena battles
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const battlesToday = await db('battles')
      .where('attacker_id', playerId)
      .where('type', 'arena')
      .where('created_at', '>=', today)
      .count('id as count')
      .first() as { count: string } | undefined;

    const attacksToday = parseInt(battlesToday?.count ?? '0', 10);
    const freeAttacksUsed = Math.min(attacksToday, ARENA_DAILY_FREE_ATTACKS);

    // Can attack if: free attacks remaining OR has tokens
    const freeAttacksRemaining = ARENA_DAILY_FREE_ATTACKS - freeAttacksUsed;
    const canAttack = freeAttacksRemaining > 0 || tokens > 0;

    return {
      canAttack,
      tokensRemaining: tokens,
      freeAttacksUsed,
    };
  }


  /**
   * Find potential opponents for arena battle
   */
  async findOpponents(playerId: string, playerRating: number): Promise<ArenaOpponent[]> {
    const db = getDatabase();
    const minRating = Math.max(0, playerRating - ARENA_MATCHMAKING_RANGE);
    const maxRating = playerRating + ARENA_MATCHMAKING_RANGE;

    // Check active player count (active in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activePlayerCount = await db('players')
      .where('last_active', '>=', sevenDaysAgo)
      .count('id as count')
      .first() as { count: string };
    
    const activeCount = parseInt(activePlayerCount?.count ?? '0', 10);
    const shouldUseBots = activeCount < 20; // Use bots if less than 20 active players

    // Find real players with defense teams set up
    const opponents = await db('players')
      .select('players.id', 'players.username', 'players.faction', 'players.arena_rating')
      .join('arena_defenses', 'players.id', 'arena_defenses.player_id')
      .where('players.id', '!=', playerId)
      .whereBetween('players.arena_rating', [minRating, maxRating])
      .whereNotNull('arena_defenses.hero1_id')
      .orderByRaw('RANDOM()')
      .limit(5) as (PlayerRow & { arena_rating: number })[];

    const result: ArenaOpponent[] = [];

    for (const opp of opponents) {
      const defense = await this.getDefenseTeam(opp.id);
      const heroes = [defense.hero1, defense.hero2, defense.hero3]
        .filter((h): h is Hero => h !== null)
        .map(h => ({
          name: h.name,
          level: h.level,
          rarity: h.rarity,
          power: h.getPower(),
        }));

      const totalPower = heroes.reduce((sum, h) => sum + h.power, 0);

      result.push({
        id: opp.id,
        username: opp.username,
        faction: opp.faction,
        rating: opp.arena_rating,
        power: totalPower,
        isBot: false,
        heroes,
      });
    }

    // If not enough real opponents and server has low population, generate bots
    if (result.length < 5 && shouldUseBots) {
      const botsNeeded = 5 - result.length;
      const bots = this.generateBotOpponents(playerRating, botsNeeded);
      result.push(...bots);
    }

    return result;
  }

  /**
   * Generate bot opponents for low population scenarios
   */
  private generateBotOpponents(targetRating: number, count: number): ArenaOpponent[] {
    const bots: ArenaOpponent[] = [];
    
    for (let i = 0; i < count; i++) {
      // Vary rating around target
      const ratingVariance = Math.floor(Math.random() * 200) - 100;
      const botRating = Math.max(800, targetRating + ratingVariance);
      
      // Select random bot heroes
      const shuffledHeroes = [...BOT_HEROES].sort(() => Math.random() - 0.5);
      const selectedHeroes = shuffledHeroes.slice(0, 3);
      
      // Calculate level based on rating
      const baseLevel = Math.min(50, Math.max(1, Math.floor(botRating / 50)));
      
      const heroes = selectedHeroes.map(h => {
        const levelVariance = Math.floor(Math.random() * 5) - 2;
        const level = Math.min(50, Math.max(1, baseLevel + levelVariance));
        const rarityMultiplier = h.rarity === 'epic' ? 2.5 : 1.5;
        const power = Math.floor((50 + level * 10) * rarityMultiplier);
        
        return {
          name: h.name,
          level,
          rarity: h.rarity,
          power,
        };
      });

      const totalPower = heroes.reduce((sum, h) => sum + h.power, 0);

      bots.push({
        id: `bot_${Date.now()}_${i}`,
        username: `Bot_${Math.floor(Math.random() * 9000) + 1000}`,
        faction: selectedHeroes[0].faction,
        rating: botRating,
        power: totalPower,
        isBot: true,
        heroes,
      });
    }

    return bots;
  }

  /**
   * Get player's defense team
   */
  async getDefenseTeam(playerId: string): Promise<ArenaDefenseTeam> {
    const db = getDatabase();
    
    const defense = await db('arena_defenses')
      .select('hero1_id', 'hero2_id', 'hero3_id')
      .where('player_id', playerId)
      .first() as ArenaDefenseRow | undefined;

    if (!defense) {
      return { hero1: null, hero2: null, hero3: null };
    }

    const heroIds = [defense.hero1_id, defense.hero2_id, defense.hero3_id].filter(Boolean);
    
    if (heroIds.length === 0) {
      return { hero1: null, hero2: null, hero3: null };
    }

    const heroes = await db('heroes')
      .select('*')
      .whereIn('id', heroIds) as HeroRow[];

    const heroMap = new Map(heroes.map(h => [h.id.toString(), this.rowToHero(h)]));

    return {
      hero1: defense.hero1_id ? heroMap.get(defense.hero1_id.toString()) ?? null : null,
      hero2: defense.hero2_id ? heroMap.get(defense.hero2_id.toString()) ?? null : null,
      hero3: defense.hero3_id ? heroMap.get(defense.hero3_id.toString()) ?? null : null,
    };
  }

  /**
   * Set player's defense team
   */
  async setDefenseTeam(playerId: string, heroIds: (string | null)[]): Promise<{ success: boolean; error?: string }> {
    const db = getDatabase();

    // Validate heroes belong to player
    const validHeroIds = heroIds.filter(Boolean) as string[];
    
    if (validHeroIds.length === 0) {
      return { success: false, error: 'You must select at least one hero for your defense team.' };
    }

    if (validHeroIds.length > 0) {
      const ownedHeroes = await db('heroes')
        .select('id')
        .where('player_id', playerId)
        .whereIn('id', validHeroIds) as { id: string }[];

      if (ownedHeroes.length !== validHeroIds.length) {
        return { success: false, error: 'One or more selected heroes do not belong to you.' };
      }
    }

    // Check for duplicates
    const uniqueIds = new Set(validHeroIds);
    if (uniqueIds.size !== validHeroIds.length) {
      return { success: false, error: 'You cannot use the same hero multiple times in your defense team.' };
    }

    // Upsert defense team
    await db('arena_defenses')
      .insert({
        player_id: playerId,
        hero1_id: heroIds[0] || null,
        hero2_id: heroIds[1] || null,
        hero3_id: heroIds[2] || null,
        updated_at: new Date(),
      })
      .onConflict('player_id')
      .merge();

    return { success: true };
  }

  /**
   * Execute an arena battle
   */
  async executeBattle(
    attackerId: string,
    attackerFaction: Faction,
    attackerHeroes: Hero[],
    opponent: ArenaOpponent
  ): Promise<ArenaBattleResult> {
    const db = getDatabase();

    // Consume token if needed
    const attackStatus = await this.canAttack(attackerId);
    if (!attackStatus.canAttack) {
      throw new Error('No arena tokens available');
    }

    // Deduct token if free attacks exhausted
    if (attackStatus.freeAttacksUsed >= ARENA_DAILY_FREE_ATTACKS) {
      await db('players')
        .where('id', attackerId)
        .decrement('arena_tokens', 1);
    }

    // Build defender army
    let defenderHeroes: Hero[] = [];
    const defenderFaction: Faction = opponent.faction;

    if (!opponent.isBot) {
      const defense = await this.getDefenseTeam(opponent.id);
      defenderHeroes = [defense.hero1, defense.hero2, defense.hero3].filter((h): h is Hero => h !== null);
    } else {
      // Create temporary hero objects for bots - use regular numbers for IDs to avoid BigInt serialization issues
      defenderHeroes = opponent.heroes.map((h, idx) => {
        const botHeroTemplate = BOT_HEROES.find(b => b.name === h.name) ?? BOT_HEROES[idx % BOT_HEROES.length];
        return new Hero({
          id: BigInt(1000000 + idx), // Use large number to avoid conflicts
          playerId: BigInt(0),
          name: h.name,
          faction: botHeroTemplate.faction,
          element: botHeroTemplate.element,
          rarity: h.rarity,
          level: h.level,
          experience: 0,
          attack: 50 + h.level * 5,
          defense: 40 + h.level * 4,
          speed: 30 + h.level * 2,
          hp: 200 + h.level * 20,
          skills: [],
          gear: {},
          createdAt: new Date(),
        });
      });
    }

    // Use the first hero for combat context (simplified arena combat)
    const attackerHero = attackerHeroes[0] ?? null;
    const defenderHero = defenderHeroes[0] ?? null;

    const context: CombatContext = {
      battleType: 'arena',
      location: { x: 0, y: 0 },
      attacker: {
        playerId: BigInt(attackerId),
        faction: attackerFaction,
        hero: attackerHero,
        troops: [], // No troops in arena
      },
      defender: {
        playerId: opponent.isBot ? null : BigInt(opponent.id),
        npcId: null,
        faction: defenderFaction,
        hero: defenderHero,
        troops: [],
      },
      terrainBonus: 1.0,
    };

    // Resolve battle using combat service
    const battleResult = combatService.resolveBattle(context);

    // Calculate rating change
    const isWin = battleResult.winner === 'attacker';
    const ratingChange = this.calculateRatingChange(isWin, opponent.rating, opponent.isBot);

    // Calculate rewards
    const diamondsEarned = isWin ? Math.floor(Math.random() * 21) + 10 : 0; // 10-30 diamonds
    const heroXpGained = battleResult.heroXpGained;

    // Update player rating
    const player = await db('players')
      .select('arena_rating')
      .where('id', attackerId)
      .first() as { arena_rating: number };

    const newRating = Math.max(0, player.arena_rating + ratingChange);
    
    await db('players')
      .where('id', attackerId)
      .update({
        arena_rating: newRating,
        diamonds: db.raw(`diamonds + ${diamondsEarned}`),
      });

    // Update defender rating if not a bot
    if (!opponent.isBot && !isWin) {
      // Defender wins, gains some rating
      const defenderGain = Math.floor(Math.abs(ratingChange) * 0.5);
      await db('players')
        .where('id', opponent.id)
        .increment('arena_rating', defenderGain);
    }

    // Award XP to attacker's heroes
    if (heroXpGained > 0) {
      for (const hero of attackerHeroes) {
        await db('heroes')
          .where('id', hero.id.toString())
          .increment('experience', Math.floor(heroXpGained / attackerHeroes.length));
      }
    }

    // Record battle - convert BigInt to string for JSON serialization
    const attackerHeroData = attackerHeroes.map(h => {
      const data = h.toData();
      return {
        ...data,
        id: data.id.toString(),
        playerId: data.playerId.toString(),
      };
    });

    await db('battles').insert({
      type: 'arena',
      attacker_id: attackerId,
      defender_id: opponent.isBot ? null : opponent.id,
      location_x: 0,
      location_y: 0,
      attacker_army: JSON.stringify({ heroes: attackerHeroData }),
      defender_army: JSON.stringify({ heroes: opponent.heroes }),
      result: JSON.stringify({
        winner: battleResult.winner,
        ratingChange,
        diamondsEarned,
        heroXpGained,
      }),
    });

    return {
      winner: battleResult.winner,
      ratingChange,
      diamondsEarned,
      heroXpGained,
      battleDetails: battleResult,
      opponentName: opponent.username,
    };
  }

  /**
   * Calculate rating change based on battle outcome
   */
  private calculateRatingChange(isWin: boolean, _opponentRating: number, isBot: boolean): number {
    if (isWin) {
      let points = Math.floor(Math.random() * (ARENA_WIN_POINTS_MAX - ARENA_WIN_POINTS_MIN + 1)) + ARENA_WIN_POINTS_MIN;
      // Reduce rewards for bot victories
      if (isBot) {
        points = Math.floor(points * 0.5);
      }
      return points;
    } else {
      const points = Math.floor(Math.random() * (ARENA_LOSS_POINTS_MAX - ARENA_LOSS_POINTS_MIN + 1)) + ARENA_LOSS_POINTS_MIN;
      return -points;
    }
  }

  /**
   * Get arena leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<{ rank: number; username: string; faction: Faction; rating: number; tier: ArenaTier }[]> {
    const db = getDatabase();
    
    const players = await db('players')
      .select('username', 'faction', 'arena_rating')
      .orderBy('arena_rating', 'desc')
      .limit(limit) as { username: string; faction: Faction; arena_rating: number }[];

    return players.map((p, idx) => ({
      rank: idx + 1,
      username: p.username,
      faction: p.faction,
      rating: p.arena_rating,
      tier: this.getTier(p.arena_rating),
    }));
  }

  /**
   * Get player's arena stats
   */
  async getPlayerStats(playerId: string): Promise<{
    rating: number;
    tier: ArenaTier;
    tokens: number;
    wins: number;
    losses: number;
    winRate: number;
  }> {
    const db = getDatabase();

    const player = await db('players')
      .select('arena_rating', 'arena_tokens')
      .where('id', playerId)
      .first() as { arena_rating: number; arena_tokens: number };

    // Count wins and losses
    const stats = await db('battles')
      .select(
        db.raw(`SUM(CASE WHEN result->>'winner' = 'attacker' THEN 1 ELSE 0 END) as wins`),
        db.raw(`SUM(CASE WHEN result->>'winner' = 'defender' THEN 1 ELSE 0 END) as losses`)
      )
      .where('attacker_id', playerId)
      .where('type', 'arena')
      .first() as { wins: string; losses: string };

    const wins = parseInt(stats?.wins ?? '0', 10);
    const losses = parseInt(stats?.losses ?? '0', 10);
    const total = wins + losses;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Regenerate tokens
    const tokens = await this.regenerateTokens(playerId);

    return {
      rating: player.arena_rating,
      tier: this.getTier(player.arena_rating),
      tokens,
      wins,
      losses,
      winRate,
    };
  }

  /**
   * Convert database row to Hero entity
   */
  private rowToHero(row: HeroRow): Hero {
    return new Hero({
      id: BigInt(row.id),
      playerId: BigInt(row.player_id),
      name: row.name,
      faction: row.faction,
      element: row.element,
      rarity: row.rarity,
      level: row.level,
      experience: row.experience,
      attack: row.attack,
      defense: row.defense,
      speed: row.speed,
      hp: row.hp,
      skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills,
      gear: typeof row.gear === 'string' ? JSON.parse(row.gear) : row.gear,
      createdAt: row.created_at,
    });
  }

  /**
   * Get defense log - last 10 attacks on player's defense team
   */
  async getDefenseLog(playerId: string): Promise<{
    attacker: string;
    attackerFaction: Faction;
    result: 'win' | 'loss';
    ratingChange: number;
    timestamp: Date;
  }[]> {
    const db = getDatabase();

    const battles = await db('battles')
      .select(
        'battles.result',
        'battles.created_at',
        'players.username as attacker_name',
        'players.faction as attacker_faction'
      )
      .join('players', 'battles.attacker_id', 'players.id')
      .where('battles.defender_id', playerId)
      .where('battles.type', 'arena')
      .orderBy('battles.created_at', 'desc')
      .limit(10) as {
        result: string;
        created_at: Date;
        attacker_name: string;
        attacker_faction: Faction;
      }[];

    return battles.map(b => {
      const resultData = typeof b.result === 'string' ? JSON.parse(b.result) : b.result;
      const defenderWon = resultData.winner === 'defender';
      
      return {
        attacker: b.attacker_name,
        attackerFaction: b.attacker_faction,
        result: defenderWon ? 'win' as const : 'loss' as const,
        ratingChange: defenderWon ? Math.floor(Math.abs(resultData.ratingChange || 0) * 0.5) : 0,
        timestamp: b.created_at,
      };
    });
  }

  /**
   * Get detailed arena statistics for a player
   */
  async getDetailedStats(playerId: string): Promise<{
    rating: number;
    tier: ArenaTier;
    tokens: number;
    totalBattles: number;
    wins: number;
    losses: number;
    winRate: number;
    defenseWins: number;
    defenseLosses: number;
    defenseWinRate: number;
    currentStreak: number;
    bestStreak: number;
    favoriteHeroes: { name: string; uses: number }[];
  }> {
    const db = getDatabase();

    const player = await db('players')
      .select('arena_rating', 'arena_tokens')
      .where('id', playerId)
      .first() as { arena_rating: number; arena_tokens: number };

    // Offensive stats
    const offenseStats = await db('battles')
      .select(
        db.raw(`COUNT(*) as total`),
        db.raw(`SUM(CASE WHEN result->>'winner' = 'attacker' THEN 1 ELSE 0 END) as wins`),
        db.raw(`SUM(CASE WHEN result->>'winner' = 'defender' THEN 1 ELSE 0 END) as losses`)
      )
      .where('attacker_id', playerId)
      .where('type', 'arena')
      .first() as { total: string; wins: string; losses: string };

    // Defensive stats
    const defenseStats = await db('battles')
      .select(
        db.raw(`SUM(CASE WHEN result->>'winner' = 'defender' THEN 1 ELSE 0 END) as wins`),
        db.raw(`SUM(CASE WHEN result->>'winner' = 'attacker' THEN 1 ELSE 0 END) as losses`)
      )
      .where('defender_id', playerId)
      .where('type', 'arena')
      .first() as { wins: string; losses: string };

    // Calculate streaks from recent battles
    const recentBattles = await db('battles')
      .select('result')
      .where('attacker_id', playerId)
      .where('type', 'arena')
      .orderBy('created_at', 'desc')
      .limit(50) as { result: string }[];

    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    for (const battle of recentBattles) {
      const resultData = typeof battle.result === 'string' ? JSON.parse(battle.result) : battle.result;
      if (resultData.winner === 'attacker') {
        tempStreak++;
        if (currentStreak === 0 || currentStreak === tempStreak - 1) {
          currentStreak = tempStreak;
        }
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        if (currentStreak > 0 && tempStreak === currentStreak) {
          // First loss breaks current streak
        }
        tempStreak = 0;
      }
    }

    const wins = parseInt(offenseStats?.wins ?? '0', 10);
    const losses = parseInt(offenseStats?.losses ?? '0', 10);
    const total = parseInt(offenseStats?.total ?? '0', 10);
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    const defenseWins = parseInt(defenseStats?.wins ?? '0', 10);
    const defenseLosses = parseInt(defenseStats?.losses ?? '0', 10);
    const defenseTotal = defenseWins + defenseLosses;
    const defenseWinRate = defenseTotal > 0 ? Math.round((defenseWins / defenseTotal) * 100) : 0;

    // Regenerate tokens
    const tokens = await this.regenerateTokens(playerId);

    return {
      rating: player.arena_rating,
      tier: this.getTier(player.arena_rating),
      tokens,
      totalBattles: total,
      wins,
      losses,
      winRate,
      defenseWins,
      defenseLosses,
      defenseWinRate,
      currentStreak,
      bestStreak,
      favoriteHeroes: [], // Would need additional tracking to implement
    };
  }
}

export const arenaService = new ArenaService();
