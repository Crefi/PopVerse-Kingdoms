import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { config } from '../../shared/config/index.js';
import logger from '../../shared/utils/logger.js';
import { authRouter } from './routes/auth.js';
import { mapRouter } from './routes/map.js';
import { playerRouter } from './routes/player.js';
import { marchRouter } from './routes/march.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { SocketManager } from './SocketManager.js';

export class WebServer {
  private app: Express;
  private httpServer: HttpServer;
  private io: SocketServer;
  private socketManager: SocketManager;
  private isRunning = false;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketServer(this.httpServer, {
      cors: {
        origin: config.nodeEnv === 'production' 
          ? ['https://your-domain.com'] 
          : ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    this.socketManager = new SocketManager(this.io);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: config.nodeEnv === 'production',
    }));
    
    // CORS
    this.app.use(cors({
      origin: config.nodeEnv === 'production'
        ? ['https://your-domain.com']
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API routes
    this.app.use('/api/auth', authRouter);
    this.app.use('/api/map', authMiddleware, mapRouter);
    this.app.use('/api/player', authMiddleware, playerRouter);
    this.app.use('/api/marches', authMiddleware, marchRouter);
    this.app.use('/api/leaderboard', authMiddleware, leaderboardRouter);

    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: config.nodeEnv === 'production' 
          ? 'Internal server error' 
          : err.message,
      });
    });
  }

  getSocketManager(): SocketManager {
    return this.socketManager;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    return new Promise((resolve) => {
      this.httpServer.listen(config.web.port, () => {
        this.isRunning = true;
        logger.info(`Web server started on port ${config.web.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    return new Promise((resolve) => {
      this.io.close();
      this.httpServer.close(() => {
        this.isRunning = false;
        logger.info('Web server stopped');
        resolve();
      });
    });
  }
}

let webServer: WebServer | null = null;

export function getWebServer(): WebServer {
  if (!webServer) {
    webServer = new WebServer();
  }
  return webServer;
}
