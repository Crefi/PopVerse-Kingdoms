import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class MetricsService {
  private static instance: MetricsService;
  private registry: Registry;

  // Counters
  public commandsTotal: Counter;
  public errorsTotal: Counter;
  public battlesTotal: Counter;
  public playersRegistered: Counter;

  // Histograms
  public commandDuration: Histogram;
  public battleDuration: Histogram;
  public dbQueryDuration: Histogram;

  // Gauges
  public activePlayers: Gauge;
  public activeGuilds: Gauge;
  public cacheHitRate: Gauge;

  private constructor() {
    this.registry = new Registry();
    
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register: this.registry });

    // Initialize custom metrics
    this.commandsTotal = new Counter({
      name: 'popverse_commands_total',
      help: 'Total number of commands executed',
      labelNames: ['command', 'status'],
      registers: [this.registry],
    });

    this.errorsTotal = new Counter({
      name: 'popverse_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'command'],
      registers: [this.registry],
    });

    this.battlesTotal = new Counter({
      name: 'popverse_battles_total',
      help: 'Total number of battles',
      labelNames: ['type', 'result'],
      registers: [this.registry],
    });

    this.playersRegistered = new Counter({
      name: 'popverse_players_registered_total',
      help: 'Total number of players registered',
      labelNames: ['faction'],
      registers: [this.registry],
    });

    this.commandDuration = new Histogram({
      name: 'popverse_command_duration_seconds',
      help: 'Command execution duration',
      labelNames: ['command'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.battleDuration = new Histogram({
      name: 'popverse_battle_duration_seconds',
      help: 'Battle resolution duration',
      labelNames: ['type'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'popverse_db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.activePlayers = new Gauge({
      name: 'popverse_active_players',
      help: 'Number of active players',
      registers: [this.registry],
    });

    this.activeGuilds = new Gauge({
      name: 'popverse_active_guilds',
      help: 'Number of active guilds',
      registers: [this.registry],
    });

    this.cacheHitRate = new Gauge({
      name: 'popverse_cache_hit_rate',
      help: 'Cache hit rate percentage',
      registers: [this.registry],
    });
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  public getRegistry(): Registry {
    return this.registry;
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export const metricsService = MetricsService.getInstance();
