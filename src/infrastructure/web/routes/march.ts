import { Router, Response } from 'express';
import { getDatabase } from '../../database/connection.js';
import { getRedis } from '../../cache/redis.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import logger from '../../../shared/utils/logger.js';

export const marchRouter = Router();

interface MarchResponse {
  id: string;
  playerId: string;
  playerName: string;
  playerFaction: string;
  type: 'attack' | 'scout' | 'return' | 'rally';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startedAt: Date;
  arrivesAt: Date;
  progress: number;
  currentPosition: { x: number; y: number };
  troops: { tier: number; count: number }[];
  heroName: string | null;
}

// Get all active marches (for map visualization)
marchRouter.get('/active', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = getRedis();
    const cacheKey = 'marches:active:all';
    
    // Short cache for real-time data
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    const marches = await db('marches as m')
      .join('players as p', 'm.player_id', 'p.id')
      .leftJoin('heroes as h', 'm.hero_id', 'h.id')
      .select(
        'm.id',
        'm.player_id',
        'p.username as player_name',
        'p.faction as player_faction',
        'm.type',
        'm.from_x as start_x',
        'm.from_y as start_y',
        'm.to_x as target_x',
        'm.to_y as target_y',
        'm.started_at',
        'm.arrives_at',
        'm.troops',
        'h.name as hero_name'
      )
      .where('m.completed', false)
      .where('m.arrives_at', '>', new Date());

    const response: MarchResponse[] = marches.map(march => {
      const now = Date.now();
      const startTime = new Date(march.started_at).getTime();
      const arriveTime = new Date(march.arrives_at).getTime();
      const totalDuration = arriveTime - startTime;
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / totalDuration));

      // Calculate current position
      const currentX = march.start_x + (march.target_x - march.start_x) * progress;
      const currentY = march.start_y + (march.target_y - march.start_y) * progress;

      return {
        id: march.id.toString(),
        playerId: march.player_id.toString(),
        playerName: march.player_name,
        playerFaction: march.player_faction,
        type: march.type,
        startX: march.start_x,
        startY: march.start_y,
        targetX: march.target_x,
        targetY: march.target_y,
        startedAt: march.started_at,
        arrivesAt: march.arrives_at,
        progress,
        currentPosition: { x: Math.round(currentX * 10) / 10, y: Math.round(currentY * 10) / 10 },
        troops: march.troops || [],
        heroName: march.hero_name,
      };
    });

    // Cache for 5 seconds
    await redis.setex(cacheKey, 5, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching active marches:', error);
    res.status(500).json({ error: 'Failed to fetch marches' });
  }
});

// Get current player's marches
marchRouter.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDatabase();
    
    const player = await db('players')
      .where('discord_id', req.user.discordId)
      .first();

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const marches = await db('marches as m')
      .leftJoin('heroes as h', 'm.hero_id', 'h.id')
      .select(
        'm.id',
        'm.type',
        'm.from_x as start_x',
        'm.from_y as start_y',
        'm.to_x as target_x',
        'm.to_y as target_y',
        'm.started_at',
        'm.arrives_at',
        'm.completed',
        'm.troops',
        'h.name as hero_name'
      )
      .where('m.player_id', player.id)
      .where('m.completed', false)
      .orderBy('m.arrives_at', 'asc');

    res.json(marches.map(march => {
      const now = Date.now();
      const startTime = new Date(march.started_at).getTime();
      const arriveTime = new Date(march.arrives_at).getTime();
      const totalDuration = arriveTime - startTime;
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / totalDuration));

      return {
        id: march.id.toString(),
        type: march.type,
        startX: march.start_x,
        startY: march.start_y,
        targetX: march.target_x,
        targetY: march.target_y,
        startedAt: march.started_at,
        arrivesAt: march.arrives_at,
        status: march.completed ? 'completed' : 'active',
        progress,
        timeRemaining: Math.max(0, arriveTime - now),
        troops: march.troops || [],
        heroName: march.hero_name,
      };
    }));
  } catch (error) {
    logger.error('Error fetching player marches:', error);
    res.status(500).json({ error: 'Failed to fetch marches' });
  }
});

// Get incoming attacks to current player
marchRouter.get('/incoming', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDatabase();
    
    const player = await db('players')
      .where('discord_id', req.user.discordId)
      .first();

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Find marches targeting player's coordinates
    const incoming = await db('marches as m')
      .join('players as p', 'm.player_id', 'p.id')
      .select(
        'm.id',
        'm.type',
        'p.username as attacker_name',
        'p.faction as attacker_faction',
        'm.arrives_at'
      )
      .where('m.to_x', player.coord_x)
      .where('m.to_y', player.coord_y)
      .where('m.completed', false)
      .whereIn('m.type', ['attack', 'rally'])
      .orderBy('m.arrives_at', 'asc');

    res.json(incoming.map(march => ({
      id: march.id.toString(),
      type: march.type,
      attackerName: march.attacker_name,
      attackerFaction: march.attacker_faction,
      arrivesAt: march.arrives_at,
      timeRemaining: Math.max(0, new Date(march.arrives_at).getTime() - Date.now()),
    })));
  } catch (error) {
    logger.error('Error fetching incoming attacks:', error);
    res.status(500).json({ error: 'Failed to fetch incoming attacks' });
  }
});

// Get march details
marchRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    
    const march = await db('marches as m')
      .join('players as p', 'm.player_id', 'p.id')
      .leftJoin('heroes as h', 'm.hero_id', 'h.id')
      .select(
        'm.id',
        'm.player_id',
        'm.type',
        'm.from_x',
        'm.from_y',
        'm.to_x',
        'm.to_y',
        'm.started_at',
        'm.arrives_at',
        'm.completed',
        'm.troops',
        'p.username as player_name',
        'p.faction as player_faction',
        'h.name as hero_name',
        'h.level as hero_level'
      )
      .where('m.id', id)
      .first();

    if (!march) {
      res.status(404).json({ error: 'March not found' });
      return;
    }

    const now = Date.now();
    const startTime = new Date(march.started_at).getTime();
    const arriveTime = new Date(march.arrives_at).getTime();
    const totalDuration = arriveTime - startTime;
    const elapsed = now - startTime;
    const progress = Math.min(1, Math.max(0, elapsed / totalDuration));

    const currentX = march.from_x + (march.to_x - march.from_x) * progress;
    const currentY = march.from_y + (march.to_y - march.from_y) * progress;

    res.json({
      id: march.id.toString(),
      playerId: march.player_id.toString(),
      playerName: march.player_name,
      playerFaction: march.player_faction,
      type: march.type,
      status: march.completed ? 'completed' : 'active',
      startX: march.from_x,
      startY: march.from_y,
      targetX: march.to_x,
      targetY: march.to_y,
      startedAt: march.started_at,
      arrivesAt: march.arrives_at,
      progress,
      currentPosition: { x: Math.round(currentX * 10) / 10, y: Math.round(currentY * 10) / 10 },
      timeRemaining: Math.max(0, arriveTime - now),
      troops: march.troops || [],
      hero: march.hero_name ? {
        name: march.hero_name,
        level: march.hero_level,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching march:', error);
    res.status(500).json({ error: 'Failed to fetch march' });
  }
});
