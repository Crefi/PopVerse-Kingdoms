import knex, { Knex } from 'knex';
import { config } from '../../shared/config/index.js';
import logger from '../../shared/utils/logger.js';

let db: Knex | null = null;

export function getDatabase(): Knex {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
      },
      pool: {
        min: config.db.poolMin,
        max: config.db.poolMax,
        afterCreate: (conn: unknown, done: (err: Error | null, conn: unknown) => void) => {
          logger.debug('Database connection created');
          done(null, conn);
        },
      },
    });
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database connection closed');
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const database = getDatabase();
    await database.raw('SELECT 1');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
}
