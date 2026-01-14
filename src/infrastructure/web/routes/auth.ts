import { Router, Request, Response } from 'express';
import { config } from '../../../shared/config/index.js';
import { getDatabase } from '../../database/connection.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../../../shared/utils/logger.js';

export const authRouter = Router();

// Discord OAuth configuration
const DISCORD_API_URL = 'https://discord.com/api/v10';
const DISCORD_CDN_URL = 'https://cdn.discordapp.com';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// Get Discord OAuth URL
authRouter.get('/discord', (_req: Request, res: Response) => {
  const redirectUri = encodeURIComponent(
    config.nodeEnv === 'production'
      ? 'https://your-domain.com/api/auth/discord/callback'
      : `http://localhost:${config.web.port}/api/auth/discord/callback`
  );
  
  const scope = encodeURIComponent('identify');
  const clientId = config.discordClientId;
  
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  
  res.json({ url: authUrl });
});

// Discord OAuth callback
authRouter.get('/discord/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    // Exchange code for token
    const tokenResponse = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.nodeEnv === 'production'
          ? 'https://your-domain.com/api/auth/discord/callback'
          : `http://localhost:${config.web.port}/api/auth/discord/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      logger.error('Discord token exchange failed:', await tokenResponse.text());
      res.status(401).json({ error: 'Failed to authenticate with Discord' });
      return;
    }

    const tokenData = await tokenResponse.json() as DiscordTokenResponse;

    // Get user info
    const userResponse = await fetch(`${DISCORD_API_URL}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      res.status(401).json({ error: 'Failed to get user info' });
      return;
    }

    const discordUser = await userResponse.json() as DiscordUser;

    // Check if player exists
    const db = getDatabase();
    const player = await db('players')
      .where('discord_id', discordUser.id)
      .first();

    if (!player) {
      // Redirect to registration page or return error
      res.status(404).json({ 
        error: 'Player not found',
        message: 'You need to register in Discord first using the /begin command',
        discordId: discordUser.id,
      });
      return;
    }

    // Generate JWT token
    const token = generateToken({
      discordId: discordUser.id,
      playerId: player.id.toString(),
      username: player.username,
    });

    // Get avatar URL
    const avatarUrl = discordUser.avatar
      ? `${DISCORD_CDN_URL}/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `${DISCORD_CDN_URL}/embed/avatars/${parseInt(discordUser.discriminator) % 5}.png`;

    // Redirect to frontend with token (or return JSON for API usage)
    if (req.query.redirect === 'true') {
      const frontendUrl = config.nodeEnv === 'production'
        ? 'https://your-domain.com'
        : 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } else {
      res.json({
        token,
        user: {
          discordId: discordUser.id,
          playerId: player.id.toString(),
          username: player.username,
          faction: player.faction,
          avatar: avatarUrl,
        },
      });
    }
  } catch (error) {
    logger.error('Discord OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Verify token and get user info
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    
    // Import here to avoid circular dependency
    const { verifyToken } = await import('../middleware/auth.js');
    const decoded = verifyToken(token);

    const db = getDatabase();
    const player = await db('players')
      .where('discord_id', decoded.discordId)
      .first();

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json({
      discordId: decoded.discordId,
      playerId: player.id.toString(),
      username: player.username,
      faction: player.faction,
      coordinates: { x: player.coord_x, y: player.coord_y },
      resources: player.resources,
      diamonds: player.diamonds,
      arenaRating: player.arena_rating,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Development-only: Login with Discord ID (for testing)
if (config.nodeEnv === 'development') {
  authRouter.post('/dev-login', async (req: Request, res: Response) => {
    try {
      const { discordId } = req.body;
      
      if (!discordId) {
        res.status(400).json({ error: 'Discord ID required' });
        return;
      }

      const db = getDatabase();
      const player = await db('players')
        .where('discord_id', discordId)
        .first();

      if (!player) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }

      const token = generateToken({
        discordId: discordId.toString(),
        playerId: player.id.toString(),
        username: player.username,
      });

      res.json({
        token,
        user: {
          discordId: discordId.toString(),
          playerId: player.id.toString(),
          username: player.username,
          faction: player.faction,
        },
      });
    } catch (error) {
      logger.error('Dev login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
}
