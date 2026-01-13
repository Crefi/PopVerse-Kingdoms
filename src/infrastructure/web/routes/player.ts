import { Router, Response } from 'express';
import { getDatabase } from '../../database/connection.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import logger from '../../../shared/utils/logger.js';

export const playerRouter = Router();

// Get current player's full profile
playerRouter.get('/me', async (req: AuthenticatedRequest, res: Response) => {
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

    // Get buildings
    const buildings = await db('buildings')
      .where('player_id', player.id)
      .select('type', 'level', 'upgrade_completes_at');

    // Get heroes (power is calculated from stats, not stored)
    const heroes = await db('heroes')
      .where('player_id', player.id)
      .select('id', 'name', 'faction', 'rarity', 'level', 'experience', 'attack', 'defense', 'speed', 'hp');

    // Get troops
    const troops = await db('troops')
      .where('player_id', player.id)
      .select('tier', 'count', 'wounded');

    // Get guild info via guild_members table
    let guild = null;
    const guildMembership = await db('guild_members')
      .where('player_id', player.id)
      .first();
    
    if (guildMembership) {
      guild = await db('guilds')
        .where('id', guildMembership.guild_id)
        .first();
    }

    // Get owned lands count
    const landsCount = await db('land_parcels')
      .where('owner_player_id', player.id)
      .count('id as count')
      .first();

    res.json({
      id: player.id.toString(),
      discordId: player.discord_id.toString(),
      username: player.username,
      faction: player.faction,
      coordinates: { x: player.coord_x, y: player.coord_y },
      resources: player.resources,
      diamonds: player.diamonds,
      arenaRating: player.arena_rating,
      arenaTokens: player.arena_tokens,
      prestigePoints: player.prestige_points,
      protectionUntil: player.protection_until,
      lastActive: player.last_active,
      createdAt: player.created_at,
      buildings: buildings.map(b => ({
        type: b.type,
        level: b.level,
        upgradeEndsAt: b.upgrade_completes_at,
      })),
      heroes: heroes.map(h => ({
        id: h.id.toString(),
        name: h.name,
        faction: h.faction,
        rarity: h.rarity,
        level: h.level,
        experience: h.experience,
        power: h.attack + h.defense + h.speed + h.hp, // Calculate power from stats
      })),
      troops: troops.map(t => ({
        tier: t.tier,
        count: t.count,
        wounded: t.wounded,
      })),
      guild: guild ? {
        id: guild.id.toString(),
        name: guild.name,
        tag: guild.tag,
      } : null,
      landsOwned: parseInt(landsCount?.count?.toString() || '0'),
    });
  } catch (error) {
    logger.error('Error fetching player profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get another player's public profile
playerRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const db = getDatabase();
    
    const player = await db('players')
      .where('id', id)
      .first();

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Get public hero info (power calculated from stats)
    const heroes = await db('heroes')
      .where('player_id', player.id)
      .select('name', 'faction', 'rarity', 'level', 'attack', 'defense', 'speed', 'hp')
      .orderByRaw('(attack + defense + speed + hp) DESC')
      .limit(5);

    // Get guild info via guild_members table
    let guild = null;
    const guildMembership = await db('guild_members')
      .where('player_id', player.id)
      .first();
    
    if (guildMembership) {
      guild = await db('guilds')
        .where('id', guildMembership.guild_id)
        .select('id', 'name', 'tag')
        .first();
    }

    res.json({
      id: player.id.toString(),
      username: player.username,
      faction: player.faction,
      coordinates: { x: player.coord_x, y: player.coord_y },
      arenaRating: player.arena_rating,
      prestigePoints: player.prestige_points,
      isProtected: player.protection_until && new Date(player.protection_until) > new Date(),
      topHeroes: heroes.map(h => ({
        name: h.name,
        faction: h.faction,
        rarity: h.rarity,
        level: h.level,
        power: h.attack + h.defense + h.speed + h.hp,
      })),
      guild: guild ? {
        id: guild.id.toString(),
        name: guild.name,
        tag: guild.tag,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Get player's battle history
playerRouter.get('/me/battles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const db = getDatabase();
    
    const player = await db('players')
      .where('discord_id', req.user.discordId)
      .first();

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const battles = await db('battles')
      .where('attacker_id', player.id)
      .orWhere('defender_id', player.id)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Get player names for battles
    const playerIds = new Set<string>();
    battles.forEach(b => {
      playerIds.add(b.attacker_id.toString());
      playerIds.add(b.defender_id.toString());
    });

    const players = await db('players')
      .whereIn('id', Array.from(playerIds))
      .select('id', 'username', 'faction');

    const playerMap = new Map(players.map(p => [p.id.toString(), p]));

    res.json(battles.map(b => {
      const attacker = playerMap.get(b.attacker_id.toString());
      const defender = playerMap.get(b.defender_id.toString());
      const isAttacker = b.attacker_id.toString() === player.id.toString();
      
      return {
        id: b.id.toString(),
        type: b.type,
        isAttacker,
        opponent: isAttacker ? {
          id: defender?.id?.toString(),
          username: defender?.username,
          faction: defender?.faction,
        } : {
          id: attacker?.id?.toString(),
          username: attacker?.username,
          faction: attacker?.faction,
        },
        result: b.result,
        casualties: b.casualties,
        loot: b.loot,
        createdAt: b.created_at,
      };
    }));
  } catch (error) {
    logger.error('Error fetching battles:', error);
    res.status(500).json({ error: 'Failed to fetch battles' });
  }
});

// Get player's arena stats
playerRouter.get('/me/arena', async (req: AuthenticatedRequest, res: Response) => {
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

    // Get arena defense team
    const defenseTeam = await db('arena_defense')
      .where('player_id', player.id)
      .join('heroes', 'arena_defense.hero_id', 'heroes.id')
      .select('heroes.id', 'heroes.name', 'heroes.faction', 'heroes.rarity', 'heroes.level', 'heroes.power', 'arena_defense.slot');

    // Get recent arena battles
    const recentBattles = await db('battles')
      .where('type', 'arena')
      .where(function() {
        this.where('attacker_id', player.id).orWhere('defender_id', player.id);
      })
      .orderBy('created_at', 'desc')
      .limit(10);

    // Calculate win/loss stats
    const stats = await db('battles')
      .where('type', 'arena')
      .where(function() {
        this.where('attacker_id', player.id).orWhere('defender_id', player.id);
      })
      .select(
        db.raw('COUNT(*) as total'),
        db.raw(`SUM(CASE WHEN (attacker_id = ? AND result->>'winner' = 'attacker') OR (defender_id = ? AND result->>'winner' = 'defender') THEN 1 ELSE 0 END) as wins`, [player.id, player.id])
      )
      .first();

    res.json({
      rating: player.arena_rating,
      tokens: player.arena_tokens,
      tier: getArenaTier(player.arena_rating),
      defenseTeam: defenseTeam.map(h => ({
        slot: h.slot,
        hero: {
          id: h.id.toString(),
          name: h.name,
          faction: h.faction,
          rarity: h.rarity,
          level: h.level,
          power: h.power,
        },
      })),
      stats: {
        total: parseInt(stats?.total || '0'),
        wins: parseInt(stats?.wins || '0'),
        losses: parseInt(stats?.total || '0') - parseInt(stats?.wins || '0'),
        winRate: stats?.total > 0 ? (parseInt(stats.wins) / parseInt(stats.total) * 100).toFixed(1) : '0',
      },
      recentBattles: recentBattles.length,
    });
  } catch (error) {
    logger.error('Error fetching arena stats:', error);
    res.status(500).json({ error: 'Failed to fetch arena stats' });
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
