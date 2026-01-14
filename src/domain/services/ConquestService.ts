import { getDatabase } from '../../infrastructure/database/connection.js';
import { getRedis, CacheKeys, CacheTTL } from '../../infrastructure/cache/redis.js';
import logger from '../../shared/utils/logger.js';
import {
  CONQUEST_DURATION_MINUTES,
  CONQUEST_CONTROL_POINTS,
  CONQUEST_COOLDOWN_MINUTES,
  CONQUEST_POINTS_PER_MINUTE,
} from '../../shared/constants/game.js';

export interface ControlPoint {
  id: number;
  x: number;
  y: number;
  currentOwner: string | null;
  ownerId: string | null;
  ownerFaction: string | null;
  capturedAt: Date | null;
}

export interface ConquestEvent {
  id: string;
  startsAt: Date;
  endsAt: Date;
  controlPoints: ControlPoint[];
  scores: Record<string, number>;
  guildScores: Record<string, number>;
  completed: boolean;
}

export interface ConquestLeaderboard {
  players: Array<{ playerId: string; username: string; score: number; faction: string }>;
  guilds: Array<{ guildId: string; name: string; score: number }>;
}

interface PlayerRow {
  id: string;
  username: string;
  faction: string;
  guild_id: string | null;
}

interface GuildRow {
  id: string;
  name: string;
}

interface ConquestEventRow {
  id: string;
  starts_at: string;
  ends_at: string;
  control_points: string | ControlPoint[];
  scores: string | Record<string, number>;
  completed: boolean;
}

export class ConquestService {
  private get db() {
    return getDatabase();
  }

  private get redis() {
    return getRedis();
  }

  /**
   * Start a new Conquest event (admin only)
   */
  async startEvent(durationMinutes: number = CONQUEST_DURATION_MINUTES): Promise<ConquestEvent> {
    // Validate duration
    if (durationMinutes < 30 || durationMinutes > 120) {
      throw new Error('Event duration must be between 30 and 120 minutes');
    }

    // Check if there's already an active event
    const activeEvent = await this.getActiveEvent();
    if (activeEvent) {
      throw new Error('A Conquest event is already in progress');
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    // Generate control points at strategic locations
    const controlPoints = await this.generateControlPoints();

    const [event] = await this.db('conquest_events')
      .insert({
        starts_at: startsAt,
        ends_at: endsAt,
        control_points: JSON.stringify(controlPoints),
        scores: JSON.stringify({}),
        completed: false,
      })
      .returning('*');

    const conquestEvent: ConquestEvent = {
      id: event.id.toString(),
      startsAt: new Date(event.starts_at),
      endsAt: new Date(event.ends_at),
      controlPoints,
      scores: {},
      guildScores: {},
      completed: false,
    };

    // Cache the active event
    await this.redis.setex(
      CacheKeys.conquest(),
      CacheTTL.conquest,
      JSON.stringify(conquestEvent)
    );

    logger.info('Conquest event started', {
      eventId: conquestEvent.id,
      duration: durationMinutes,
      controlPoints: controlPoints.length,
    });

    return conquestEvent;
  }

  /**
   * Stop an active Conquest event early (admin only)
   */
  async stopEvent(): Promise<ConquestEvent | null> {
    const activeEvent = await this.getActiveEvent();
    if (!activeEvent) {
      throw new Error('No active Conquest event to stop');
    }

    // Calculate final scores before stopping
    await this.updateScores(activeEvent);

    // Mark event as completed
    await this.db('conquest_events')
      .where('id', activeEvent.id)
      .update({
        completed: true,
        ends_at: new Date(),
        scores: JSON.stringify(activeEvent.scores),
      });

    // Distribute rewards
    await this.distributeRewards(activeEvent);

    // Clear cache
    await this.redis.del(CacheKeys.conquest());

    logger.info('Conquest event stopped early', { eventId: activeEvent.id });

    return { ...activeEvent, completed: true };
  }

  /**
   * Get the currently active Conquest event
   */
  async getActiveEvent(): Promise<ConquestEvent | null> {
    // Check cache first
    const cached = await this.redis.get(CacheKeys.conquest());
    if (cached) {
      const event = JSON.parse(cached) as ConquestEvent;
      // Verify it's still active
      if (new Date(event.endsAt) > new Date() && !event.completed) {
        return event;
      }
    }

    // Query database
    const event = await this.db('conquest_events')
      .where('completed', false)
      .where('ends_at', '>', new Date())
      .orderBy('starts_at', 'desc')
      .first() as ConquestEventRow | undefined;

    if (!event) {
      return null;
    }

    const conquestEvent: ConquestEvent = {
      id: event.id.toString(),
      startsAt: new Date(event.starts_at),
      endsAt: new Date(event.ends_at),
      controlPoints: typeof event.control_points === 'string' 
        ? JSON.parse(event.control_points) 
        : event.control_points,
      scores: typeof event.scores === 'string' 
        ? JSON.parse(event.scores) 
        : event.scores,
      guildScores: {},
      completed: event.completed,
    };

    // Cache it
    await this.redis.setex(
      CacheKeys.conquest(),
      CacheTTL.conquest,
      JSON.stringify(conquestEvent)
    );

    return conquestEvent;
  }

  /**
   * Get event status including time remaining and leaderboard
   */
  async getEventStatus(): Promise<{
    active: boolean;
    event: ConquestEvent | null;
    timeRemaining: number;
    leaderboard: ConquestLeaderboard;
  }> {
    const event = await this.getActiveEvent();
    
    if (!event) {
      return {
        active: false,
        event: null,
        timeRemaining: 0,
        leaderboard: { players: [], guilds: [] },
      };
    }

    // Update scores before returning status
    await this.updateScores(event);

    // Ensure endsAt is a Date object (may be string from JSON cache)
    const endsAtDate = event.endsAt instanceof Date ? event.endsAt : new Date(event.endsAt);
    const timeRemaining = Math.max(0, endsAtDate.getTime() - Date.now());
    const leaderboard = await this.getLeaderboard(event);

    return {
      active: true,
      event,
      timeRemaining,
      leaderboard,
    };
  }


  /**
   * Generate control points at strategic map locations
   */
  private async generateControlPoints(): Promise<ControlPoint[]> {
    const controlPoints: ControlPoint[] = [];
    const mapSize = 100;
    
    // Strategic positions: center and 4 quadrants
    const positions = [
      { x: Math.floor(mapSize / 2), y: Math.floor(mapSize / 2) }, // Center
      { x: Math.floor(mapSize / 4), y: Math.floor(mapSize / 4) }, // NW
      { x: Math.floor(3 * mapSize / 4), y: Math.floor(mapSize / 4) }, // NE
      { x: Math.floor(mapSize / 4), y: Math.floor(3 * mapSize / 4) }, // SW
      { x: Math.floor(3 * mapSize / 4), y: Math.floor(3 * mapSize / 4) }, // SE
    ];

    for (let i = 0; i < CONQUEST_CONTROL_POINTS && i < positions.length; i++) {
      // Add some randomness to positions (±5 tiles)
      const randomOffset = () => Math.floor(Math.random() * 11) - 5;
      const x = Math.max(5, Math.min(mapSize - 5, positions[i].x + randomOffset()));
      const y = Math.max(5, Math.min(mapSize - 5, positions[i].y + randomOffset()));

      controlPoints.push({
        id: i + 1,
        x,
        y,
        currentOwner: null,
        ownerId: null,
        ownerFaction: null,
        capturedAt: null,
      });
    }

    return controlPoints;
  }

  /**
   * Attempt to capture a control point
   */
  async captureControlPoint(
    playerId: string,
    controlPointId: number
  ): Promise<{ success: boolean; message: string; controlPoint?: ControlPoint }> {
    const event = await this.getActiveEvent();
    if (!event) {
      return { success: false, message: 'No active Conquest event' };
    }

    // Check cooldown
    const cooldownKey = `conquest:cooldown:${playerId}:${controlPointId}`;
    const onCooldown = await this.redis.get(cooldownKey);
    if (onCooldown) {
      const remaining = await this.redis.ttl(cooldownKey);
      return {
        success: false,
        message: `You must wait ${Math.ceil(remaining / 60)} minutes before attacking this point again`,
      };
    }

    // Find the control point
    const cpIndex = event.controlPoints.findIndex((cp: ControlPoint) => cp.id === controlPointId);
    if (cpIndex === -1) {
      return { success: false, message: 'Control point not found' };
    }

    // Get player info
    const player = await this.db('players').where('id', playerId).first() as PlayerRow | undefined;
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    // Update scores for previous owner before capture
    await this.updateScores(event);

    // Capture the point
    const controlPoint = event.controlPoints[cpIndex];
    controlPoint.currentOwner = player.username;
    controlPoint.ownerId = playerId;
    controlPoint.ownerFaction = player.faction;
    controlPoint.capturedAt = new Date();

    // Update database
    await this.db('conquest_events')
      .where('id', event.id)
      .update({
        control_points: JSON.stringify(event.controlPoints),
        scores: JSON.stringify(event.scores),
      });

    // Set cooldown
    await this.redis.setex(cooldownKey, CONQUEST_COOLDOWN_MINUTES * 60, '1');

    // Update cache
    await this.redis.setex(
      CacheKeys.conquest(),
      CacheTTL.conquest,
      JSON.stringify(event)
    );

    logger.info('Control point captured', {
      eventId: event.id,
      controlPointId,
      playerId,
      playerName: player.username,
    });

    return {
      success: true,
      message: `You captured Control Point ${controlPointId}!`,
      controlPoint,
    };
  }

  /**
   * Update scores based on current control point ownership
   */
  private async updateScores(event: ConquestEvent): Promise<void> {
    const now = new Date();

    for (const cp of event.controlPoints) {
      if (cp.ownerId && cp.capturedAt) {
        const capturedAt = new Date(cp.capturedAt);
        const minutesHeld = Math.floor((now.getTime() - capturedAt.getTime()) / 60000);
        const pointsEarned = minutesHeld * CONQUEST_POINTS_PER_MINUTE;

        if (pointsEarned > 0) {
          // Update player score
          event.scores[cp.ownerId] = (event.scores[cp.ownerId] || 0) + pointsEarned;

          // Get player's guild and update guild score
          const player = await this.db('players').where('id', cp.ownerId).first() as PlayerRow | undefined;
          if (player?.guild_id) {
            event.guildScores[player.guild_id] = 
              (event.guildScores[player.guild_id] || 0) + pointsEarned;
          }

          // Reset captured time to now to avoid double counting
          cp.capturedAt = now;
        }
      }
    }
  }

  /**
   * Get the current leaderboard
   */
  private async getLeaderboard(event: ConquestEvent): Promise<ConquestLeaderboard> {
    // Get player details for scores
    const playerIds = Object.keys(event.scores);
    const players: PlayerRow[] = playerIds.length > 0
      ? await this.db('players').whereIn('id', playerIds)
      : [];

    const playerLeaderboard = players
      .map((p: PlayerRow) => ({
        playerId: p.id.toString(),
        username: p.username,
        score: event.scores[p.id.toString()] || 0,
        faction: p.faction,
      }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 10);

    // Get guild details for scores
    const guildIds = Object.keys(event.guildScores);
    const guilds: GuildRow[] = guildIds.length > 0
      ? await this.db('guilds').whereIn('id', guildIds)
      : [];

    const guildLeaderboard = guilds
      .map((g: GuildRow) => ({
        guildId: g.id.toString(),
        name: g.name,
        score: event.guildScores[g.id.toString()] || 0,
      }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 3);

    return {
      players: playerLeaderboard,
      guilds: guildLeaderboard,
    };
  }


  /**
   * Distribute rewards at the end of the event
   */
  private async distributeRewards(event: ConquestEvent): Promise<void> {
    const leaderboard = await this.getLeaderboard(event);

    // Player rewards (top 10)
    const playerRewards = [
      { diamonds: 2000, shards: 50 },  // 1st
      { diamonds: 1500, shards: 40 },  // 2nd
      { diamonds: 1000, shards: 30 },  // 3rd
      { diamonds: 750, shards: 25 },   // 4th
      { diamonds: 500, shards: 20 },   // 5th
      { diamonds: 400, shards: 15 },   // 6th
      { diamonds: 300, shards: 10 },   // 7th
      { diamonds: 200, shards: 8 },    // 8th
      { diamonds: 150, shards: 5 },    // 9th
      { diamonds: 100, shards: 3 },    // 10th
    ];

    for (let i = 0; i < leaderboard.players.length && i < playerRewards.length; i++) {
      const player = leaderboard.players[i];
      const reward = playerRewards[i];

      await this.db('players')
        .where('id', player.playerId)
        .increment('diamonds', reward.diamonds);

      logger.info('Conquest reward distributed', {
        playerId: player.playerId,
        rank: i + 1,
        diamonds: reward.diamonds,
      });
    }

    // Guild rewards (top 3)
    const guildRewards = [
      { diamonds: 5000 },  // 1st
      { diamonds: 3000 },  // 2nd
      { diamonds: 1500 },  // 3rd
    ];

    for (let i = 0; i < leaderboard.guilds.length && i < guildRewards.length; i++) {
      const guild = leaderboard.guilds[i];
      const reward = guildRewards[i];

      // Add to guild treasury
      await this.db('guilds')
        .where('id', guild.guildId)
        .increment('treasury', reward.diamonds);

      logger.info('Conquest guild reward distributed', {
        guildId: guild.guildId,
        rank: i + 1,
        diamonds: reward.diamonds,
      });
    }
  }

  /**
   * Check and complete expired events
   */
  async checkAndCompleteExpiredEvents(): Promise<void> {
    const expiredEvents = await this.db('conquest_events')
      .where('completed', false)
      .where('ends_at', '<=', new Date()) as ConquestEventRow[];

    for (const event of expiredEvents) {
      const conquestEvent: ConquestEvent = {
        id: event.id.toString(),
        startsAt: new Date(event.starts_at),
        endsAt: new Date(event.ends_at),
        controlPoints: typeof event.control_points === 'string'
          ? JSON.parse(event.control_points)
          : event.control_points,
        scores: typeof event.scores === 'string'
          ? JSON.parse(event.scores)
          : event.scores,
        guildScores: {},
        completed: false,
      };

      await this.updateScores(conquestEvent);
      await this.distributeRewards(conquestEvent);

      await this.db('conquest_events')
        .where('id', event.id)
        .update({
          completed: true,
          scores: JSON.stringify(conquestEvent.scores),
        });

      await this.redis.del(CacheKeys.conquest());

      logger.info('Conquest event completed', { eventId: event.id });
    }
  }
}

export const conquestService = new ConquestService();
