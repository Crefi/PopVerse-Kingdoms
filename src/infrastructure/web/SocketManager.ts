import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../shared/config/index.js';
import logger from '../../shared/utils/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  playerId?: string;
}

interface MarchUpdate {
  marchId: string;
  playerId: string;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  progress: number;
  estimatedArrival: Date;
  type: 'attack' | 'scout' | 'return';
}

interface ControlPointUpdate {
  pointId: string;
  x: number;
  y: number;
  ownerId: string | null;
  ownerFaction: string | null;
  contestedBy: string[];
  points: number;
}

export class SocketManager {
  private io: SocketServer;
  private connectedUsers = new Map<string, Set<string>>(); // playerId -> socketIds

  constructor(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, config.web.jwtSecret) as {
          discordId: string;
          playerId: string;
        };

        socket.userId = decoded.discordId;
        socket.playerId = decoded.playerId;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.debug(`Socket connected: ${socket.id} (player: ${socket.playerId})`);

      if (socket.playerId) {
        // Track connected sockets per player
        if (!this.connectedUsers.has(socket.playerId)) {
          this.connectedUsers.set(socket.playerId, new Set());
        }
        this.connectedUsers.get(socket.playerId)!.add(socket.id);

        // Join player-specific room
        socket.join(`player:${socket.playerId}`);
      }

      // Handle map subscription
      socket.on('subscribe:map', (region: { x: number; y: number; size: number }) => {
        const roomName = `map:${region.x}:${region.y}:${region.size}`;
        socket.join(roomName);
        logger.debug(`Socket ${socket.id} subscribed to ${roomName}`);
      });

      socket.on('unsubscribe:map', (region: { x: number; y: number; size: number }) => {
        const roomName = `map:${region.x}:${region.y}:${region.size}`;
        socket.leave(roomName);
      });

      // Handle conquest subscription
      socket.on('subscribe:conquest', () => {
        socket.join('conquest:live');
        logger.debug(`Socket ${socket.id} subscribed to conquest updates`);
      });

      socket.on('unsubscribe:conquest', () => {
        socket.leave('conquest:live');
      });

      // Handle march tracking subscription
      socket.on('subscribe:marches', () => {
        socket.join('marches:live');
      });

      socket.on('unsubscribe:marches', () => {
        socket.leave('marches:live');
      });

      socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
        if (socket.playerId) {
          const sockets = this.connectedUsers.get(socket.playerId);
          if (sockets) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.connectedUsers.delete(socket.playerId);
            }
          }
        }
      });
    });
  }

  // Broadcast march position updates
  broadcastMarchUpdate(march: MarchUpdate): void {
    this.io.to('marches:live').emit('march:update', march);
  }

  // Broadcast march completion
  broadcastMarchComplete(marchId: string, result: unknown): void {
    this.io.to('marches:live').emit('march:complete', { marchId, result });
  }

  // Broadcast control point updates during conquest
  broadcastControlPointUpdate(update: ControlPointUpdate): void {
    this.io.to('conquest:live').emit('conquest:point:update', update);
  }

  // Broadcast conquest leaderboard updates
  broadcastConquestLeaderboard(leaderboard: unknown): void {
    this.io.to('conquest:live').emit('conquest:leaderboard', leaderboard);
  }

  // Broadcast conquest event status
  broadcastConquestStatus(status: { active: boolean; timeRemaining?: number }): void {
    this.io.to('conquest:live').emit('conquest:status', status);
  }

  // Send notification to specific player
  notifyPlayer(playerId: string, event: string, data: unknown): void {
    this.io.to(`player:${playerId}`).emit(event, data);
  }

  // Broadcast map tile update to relevant subscribers
  broadcastMapUpdate(x: number, y: number, tileData: Record<string, unknown>): void {
    // Broadcast to all map regions that include this tile
    // This is a simplified version - in production you'd want more efficient region management
    this.io.emit('map:tile:update', { x, y, ...tileData });
  }

  // Get count of connected users
  getConnectedCount(): number {
    return this.connectedUsers.size;
  }

  // Check if player is online
  isPlayerOnline(playerId: string): boolean {
    return this.connectedUsers.has(playerId);
  }
}
