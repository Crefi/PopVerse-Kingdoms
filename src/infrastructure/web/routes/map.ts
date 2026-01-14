import { Router, Response } from 'express';
import { getDatabase } from '../../database/connection.js';
import { getRedis } from '../../cache/redis.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../../../shared/config/index.js';
import logger from '../../../shared/utils/logger.js';

export const mapRouter = Router();

interface MapTileResponse {
  x: number;
  y: number;
  terrain: string;
  occupant: {
    id: string;
    username: string;
    faction: string;
  } | null;
  npc: {
    id: string;
    type: string;
    power: number;
  } | null;
  landParcel: {
    id: string;
    type: string;
    ownerId: string | null;
    ownerName: string | null;
  } | null;
}

// Get map region
mapRouter.get('/region/:x/:y/:size', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);
    const size = Math.min(parseInt(req.params.size) || 15, 50); // Max 50x50

    if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= config.game.mapSize || y >= config.game.mapSize) {
      res.status(400).json({ error: 'Invalid coordinates' });
      return;
    }

    const redis = getRedis();
    const cacheKey = `map:region:${x}:${y}:${size}`;
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    // Calculate bounds
    const minX = Math.max(0, x - Math.floor(size / 2));
    const maxX = Math.min(config.game.mapSize - 1, x + Math.floor(size / 2));
    const minY = Math.max(0, y - Math.floor(size / 2));
    const maxY = Math.min(config.game.mapSize - 1, y + Math.floor(size / 2));

    // Get tiles with occupant and NPC info
    const tiles = await db('map_tiles as mt')
      .leftJoin('players as p', 'mt.occupant_id', 'p.id')
      .leftJoin('npcs as n', 'mt.npc_id', 'n.id')
      .leftJoin('land_parcels as lp', 'mt.land_parcel_id', 'lp.id')
      .leftJoin('players as lpo', 'lp.owner_player_id', 'lpo.id')
      .select(
        'mt.x',
        'mt.y',
        'mt.terrain',
        'mt.occupant_id',
        'p.username as occupant_username',
        'p.faction as occupant_faction',
        'mt.npc_id',
        'n.type as npc_type',
        'n.power as npc_power',
        'mt.land_parcel_id',
        'lp.type as land_type',
        'lp.owner_player_id as land_owner_id',
        'lpo.username as land_owner_name'
      )
      .whereBetween('mt.x', [minX, maxX])
      .whereBetween('mt.y', [minY, maxY]);

    const response: MapTileResponse[] = tiles.map(tile => ({
      x: tile.x,
      y: tile.y,
      terrain: tile.terrain,
      occupant: tile.occupant_id ? {
        id: tile.occupant_id.toString(),
        username: tile.occupant_username,
        faction: tile.occupant_faction,
      } : null,
      npc: tile.npc_id ? {
        id: tile.npc_id.toString(),
        type: tile.npc_type,
        power: tile.npc_power,
      } : null,
      landParcel: tile.land_parcel_id ? {
        id: tile.land_parcel_id.toString(),
        type: tile.land_type,
        ownerId: tile.land_owner_id?.toString() || null,
        ownerName: tile.land_owner_name || null,
      } : null,
    }));

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify({
      tiles: response,
      bounds: { minX, maxX, minY, maxY },
      center: { x, y },
      size,
    }));

    res.json({
      tiles: response,
      bounds: { minX, maxX, minY, maxY },
      center: { x, y },
      size,
    });
  } catch (error) {
    logger.error('Error fetching map region:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// Get single tile details
mapRouter.get('/tile/:x/:y', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);

    if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x >= config.game.mapSize || y >= config.game.mapSize) {
      res.status(400).json({ error: 'Invalid coordinates' });
      return;
    }

    const db = getDatabase();

    const tile = await db('map_tiles as mt')
      .leftJoin('players as p', 'mt.occupant_id', 'p.id')
      .leftJoin('npcs as n', 'mt.npc_id', 'n.id')
      .leftJoin('land_parcels as lp', 'mt.land_parcel_id', 'lp.id')
      .leftJoin('players as lpo', 'lp.owner_player_id', 'lpo.id')
      .leftJoin('guilds as g', 'lp.owner_guild_id', 'g.id')
      .select(
        'mt.*',
        'p.username as occupant_username',
        'p.faction as occupant_faction',
        'p.arena_rating as occupant_rating',
        'n.type as npc_type',
        'n.power as npc_power',
        'n.rewards as npc_rewards',
        'lp.type as land_type',
        'lp.bonuses as land_bonuses',
        'lp.owner_player_id as land_owner_id',
        'lpo.username as land_owner_name',
        'g.name as land_guild_name'
      )
      .where('mt.x', x)
      .where('mt.y', y)
      .first();

    if (!tile) {
      res.status(404).json({ error: 'Tile not found' });
      return;
    }

    res.json({
      x: tile.x,
      y: tile.y,
      terrain: tile.terrain,
      occupant: tile.occupant_id ? {
        id: tile.occupant_id.toString(),
        username: tile.occupant_username,
        faction: tile.occupant_faction,
        arenaRating: tile.occupant_rating,
      } : null,
      npc: tile.npc_id ? {
        id: tile.npc_id.toString(),
        type: tile.npc_type,
        power: tile.npc_power,
        rewards: tile.npc_rewards,
      } : null,
      landParcel: tile.land_parcel_id ? {
        id: tile.land_parcel_id.toString(),
        type: tile.land_type,
        bonuses: tile.land_bonuses,
        ownerId: tile.land_owner_id?.toString() || null,
        ownerName: tile.land_owner_name || null,
        guildName: tile.land_guild_name || null,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching tile:', error);
    res.status(500).json({ error: 'Failed to fetch tile data' });
  }
});

// Get all player cities
mapRouter.get('/cities', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = getRedis();
    const cacheKey = 'map:cities:all';
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    const cities = await db('players')
      .select('id', 'username', 'faction', 'coord_x', 'coord_y', 'arena_rating')
      .orderBy('arena_rating', 'desc');

    const response = cities.map(city => ({
      id: city.id.toString(),
      username: city.username,
      faction: city.faction,
      x: city.coord_x,
      y: city.coord_y,
      arenaRating: city.arena_rating,
    }));

    // Cache for 1 minute
    await redis.setex(cacheKey, 60, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Get all land parcels
mapRouter.get('/lands', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = getRedis();
    const cacheKey = 'map:lands:all';
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    const lands = await db('land_parcels as lp')
      .leftJoin('players as p', 'lp.owner_player_id', 'p.id')
      .leftJoin('guilds as g', 'lp.owner_guild_id', 'g.id')
      .select(
        'lp.id',
        'lp.type',
        'lp.min_x',
        'lp.min_y',
        'lp.max_x',
        'lp.max_y',
        'lp.bonuses',
        'lp.owner_player_id',
        'p.username as owner_name',
        'p.faction as owner_faction',
        'lp.owner_guild_id',
        'g.name as guild_name'
      );

    const response = lands.map(land => ({
      id: land.id.toString(),
      type: land.type,
      bounds: {
        minX: land.min_x,
        minY: land.min_y,
        maxX: land.max_x,
        maxY: land.max_y,
      },
      bonuses: land.bonuses,
      owner: land.owner_player_id ? {
        id: land.owner_player_id.toString(),
        username: land.owner_name,
        faction: land.owner_faction,
      } : null,
      guild: land.owner_guild_id ? {
        id: land.owner_guild_id.toString(),
        name: land.guild_name,
      } : null,
    }));

    // Cache for 2 minutes
    await redis.setex(cacheKey, 120, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching lands:', error);
    res.status(500).json({ error: 'Failed to fetch land parcels' });
  }
});

// Get NPCs on map
mapRouter.get('/npcs', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const redis = getRedis();
    const cacheKey = 'map:npcs:all';
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const db = getDatabase();
    
    const npcs = await db('npcs')
      .select('id', 'type', 'power', 'coord_x', 'coord_y', 'respawn_at')
      .where(function() {
        this.whereNull('respawn_at').orWhere('respawn_at', '<=', new Date());
      });

    const response = npcs.map(npc => ({
      id: npc.id.toString(),
      type: npc.type,
      power: npc.power,
      x: npc.coord_x,
      y: npc.coord_y,
    }));

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching NPCs:', error);
    res.status(500).json({ error: 'Failed to fetch NPCs' });
  }
});

// Search for player by name
mapRouter.get('/search/player/:name', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = req.params;
    
    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Search term must be at least 2 characters' });
      return;
    }

    const db = getDatabase();
    
    const players = await db('players')
      .select('id', 'username', 'faction', 'coord_x', 'coord_y', 'arena_rating')
      .whereILike('username', `%${name}%`)
      .limit(10);

    res.json(players.map(p => ({
      id: p.id.toString(),
      username: p.username,
      faction: p.faction,
      x: p.coord_x,
      y: p.coord_y,
      arenaRating: p.arena_rating,
    })));
  } catch (error) {
    logger.error('Error searching players:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});
