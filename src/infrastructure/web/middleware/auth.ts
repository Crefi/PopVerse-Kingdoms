import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../shared/config/index.js';
import { getDatabase } from '../../database/connection.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    discordId: string;
    playerId: string;
    username: string;
  };
}

interface JwtPayload {
  discordId: string;
  playerId: string;
  username: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, config.web.jwtSecret) as JwtPayload;
    
    // Verify player still exists
    const db = getDatabase();
    const player = await db('players')
      .where('discord_id', decoded.discordId)
      .first();

    if (!player) {
      res.status(401).json({ error: 'Player not found' });
      return;
    }

    req.user = {
      discordId: decoded.discordId,
      playerId: decoded.playerId,
      username: decoded.username,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function generateToken(payload: { discordId: string; playerId: string; username: string }): string {
  return jwt.sign(payload, config.web.jwtSecret, {
    expiresIn: config.web.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.web.jwtSecret) as JwtPayload;
}
