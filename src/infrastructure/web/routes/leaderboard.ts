import { Router, Response } from 'express';
import { getDatabase } from '../../database/connection.js';
import { getRedis } from '../../cache/redis.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import logger from '../../../shared/utils/logger.js';

export const leaderboardRouter = Router();

// Get arena leaderboard
leaderboardRouter.get('/arena', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const redis = getRedis();
    const cacheKey = `leaderboard:arena:${limit}:${offset}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    // Join through guild_members table since players don't have guild_id
    const players = await db('players')
      .leftJoin('guild_members', 'players.id', 'guild_members.player_id')
      .leftJoin('guilds', 'guild_members.guild_id', 'guilds.id')
      .select(
        'players.id',
        'players.username',
        'players.faction',
        'players.arena_rating',
        'guilds.name as guild_name',
        'guilds.tag as guild_tag'
      )
      .orderBy('players.arena_rating', 'desc')
      .limit(limit)
      .offset(offset);

    const response = players.map((p, index) => ({
      rank: offset + index + 1,
      id: p.id.toString(),
      username: p.username,
      faction: p.faction,
      arenaRating: p.arena_rating,
      tier: getArenaTier(p.arena_rating),
      guild: p.guild_name ? { name: p.guild_name, tag: p.guild_tag } : null,
    }));

    // Cache for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching arena leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get power leaderboard
leaderboardRouter.get('/power', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const redis = getRedis();
    const cacheKey = `leaderboard:power:${limit}:${offset}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    // Calculate total power from heroes and troops (power = attack + defense + speed + hp)
    const players = await db('players')
      .leftJoin('guild_members', 'players.id', 'guild_members.player_id')
      .leftJoin('guilds', 'guild_members.guild_id', 'guilds.id')
      .select(
        'players.id',
        'players.username',
        'players.faction',
        'guilds.name as guild_name',
        'guilds.tag as guild_tag',
        db.raw(`(
          SELECT COALESCE(SUM(attack + defense + speed + hp), 0) FROM heroes WHERE player_id = players.id
        ) + (
          SELECT COALESCE(SUM(
            CASE tier
              WHEN 1 THEN count * 10
              WHEN 2 THEN count * 25
              WHEN 3 THEN count * 50
              WHEN 4 THEN count * 100
            END
          ), 0) FROM troops WHERE player_id = players.id
        ) as total_power`)
      )
      .orderBy('total_power', 'desc')
      .limit(limit)
      .offset(offset);

    const response = players.map((p, index) => ({
      rank: offset + index + 1,
      id: p.id.toString(),
      username: p.username,
      faction: p.faction,
      totalPower: parseInt(p.total_power) || 0,
      guild: p.guild_name ? { name: p.guild_name, tag: p.guild_tag } : null,
    }));

    // Cache for 2 minutes
    await redis.setex(cacheKey, 120, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching power leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get guild leaderboard
leaderboardRouter.get('/guilds', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const redis = getRedis();
    const cacheKey = `leaderboard:guilds:${limit}:${offset}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    const guilds = await db('guilds')
      .leftJoin('players as leader', 'guilds.leader_id', 'leader.id')
      .select(
        'guilds.id',
        'guilds.name',
        'guilds.tag',
        'leader.username as leader_name',
        db.raw('(SELECT COUNT(*) FROM guild_members WHERE guild_id = guilds.id) as member_count'),
        db.raw(`(
          SELECT COALESCE(SUM(
            (SELECT COALESCE(SUM(attack + defense + speed + hp), 0) FROM heroes WHERE player_id = gm.player_id) +
            (SELECT COALESCE(SUM(
              CASE tier
                WHEN 1 THEN count * 10
                WHEN 2 THEN count * 25
                WHEN 3 THEN count * 50
                WHEN 4 THEN count * 100
              END
            ), 0) FROM troops WHERE player_id = gm.player_id)
          ), 0) FROM guild_members gm WHERE gm.guild_id = guilds.id
        ) as total_power`)
      )
      .orderBy('total_power', 'desc')
      .limit(limit)
      .offset(offset);

    const response = guilds.map((g, index) => ({
      rank: offset + index + 1,
      id: g.id.toString(),
      name: g.name,
      tag: g.tag,
      leaderName: g.leader_name,
      memberCount: parseInt(g.member_count) || 0,
      totalPower: parseInt(g.total_power) || 0,
    }));

    // Cache for 2 minutes
    await redis.setex(cacheKey, 120, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching guild leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get conquest leaderboard (current event or last event)
leaderboardRouter.get('/conquest', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = getRedis();
    const cacheKey = 'leaderboard:conquest';
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    // Get current or most recent conquest event
    const event = await db('conquest_events')
      .orderBy('started_at', 'desc')
      .first();

    if (!event) {
      res.json({ event: null, players: [], guilds: [] });
      return;
    }

    // Get player scores
    const playerScores = await db('conquest_scores as cs')
      .join('players as p', 'cs.player_id', 'p.id')
      .leftJoin('guild_members as gm', 'p.id', 'gm.player_id')
      .leftJoin('guilds as g', 'gm.guild_id', 'g.id')
      .select(
        'p.id',
        'p.username',
        'p.faction',
        'cs.points',
        'cs.captures',
        'cs.defenses',
        'g.name as guild_name'
      )
      .where('cs.event_id', event.id)
      .orderBy('cs.points', 'desc')
      .limit(50);

    // Get guild scores
    const guildScores = await db('conquest_guild_scores as cgs')
      .join('guilds as g', 'cgs.guild_id', 'g.id')
      .select(
        'g.id',
        'g.name',
        'g.tag',
        'cgs.points',
        'cgs.captures'
      )
      .where('cgs.event_id', event.id)
      .orderBy('cgs.points', 'desc')
      .limit(20);

    const response = {
      event: {
        id: event.id.toString(),
        startedAt: event.started_at,
        endedAt: event.ended_at,
        status: event.status,
      },
      players: playerScores.map((p, index) => ({
        rank: index + 1,
        id: p.id.toString(),
        username: p.username,
        faction: p.faction,
        points: p.points,
        captures: p.captures,
        defenses: p.defenses,
        guildName: p.guild_name,
      })),
      guilds: guildScores.map((g, index) => ({
        rank: index + 1,
        id: g.id.toString(),
        name: g.name,
        tag: g.tag,
        points: g.points,
        captures: g.captures,
      })),
    };

    // Cache for 30 seconds during active event, 5 minutes otherwise
    const cacheTtl = event.status === 'active' ? 30 : 300;
    await redis.setex(cacheKey, cacheTtl, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching conquest leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get faction statistics
leaderboardRouter.get('/factions', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = getRedis();
    const cacheKey = 'leaderboard:factions';
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    const factionStats = await db('players')
      .select('faction')
      .count('id as player_count')
      .sum('arena_rating as total_rating')
      .avg('arena_rating as avg_rating')
      .groupBy('faction');

    // Get land ownership by faction
    const landStats = await db('land_parcels as lp')
      .join('players as p', 'lp.owner_player_id', 'p.id')
      .select('p.faction')
      .count('lp.id as land_count')
      .groupBy('p.faction');

    const landMap = new Map(landStats.map(l => [l.faction, parseInt(l.land_count as string)]));

    const response = factionStats.map(f => ({
      faction: f.faction,
      playerCount: parseInt(f.player_count as string),
      totalRating: parseInt(f.total_rating as string) || 0,
      avgRating: Math.round(parseFloat(f.avg_rating as string) || 0),
      landsOwned: landMap.get(f.faction) || 0,
    }));

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching faction stats:', error);
    res.status(500).json({ error: 'Failed to fetch faction stats' });
  }
});

function getArenaTier(rating: number): string {
  if (rating >= 2500) return 'legend';
  if (rating >= 2000) return 'diamond';
  if (rating >= 1600) return 'platinum';
  if (rating >= 1200) return 'gold';
  if (rating >= 800) return 'silver';
  return 'bronze';
}
