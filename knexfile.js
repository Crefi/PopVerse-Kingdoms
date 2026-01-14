import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
dotenv.config({ path: envFile });

/** @type {import('knex').Knex.Config} */
const baseConfig = {
  client: 'pg',
  migrations: {
    directory: './src/infrastructure/database/migrations',
    extension: 'ts',
  },
  seeds: {
    directory: './src/infrastructure/database/seeds',
    extension: 'ts',
  },
};

export default {
  development: {
    ...baseConfig,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'popverse_kingdoms_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '5'),
    },
  },

  test: {
    ...baseConfig,
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'popverse_kingdoms_test',
      user: 'postgres',
      password: 'postgres',
    },
    pool: { min: 1, max: 2 },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'popverse_kingdoms',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5'),
      max: parseInt(process.env.DB_POOL_MAX || '20'),
    },
    migrations: {
      directory: './dist/infrastructure/database/migrations',
      extension: 'js',
      loadExtensions: ['.js'],
    },
    seeds: {
      directory: './dist/infrastructure/database/seeds',
      extension: 'js',
      loadExtensions: ['.js'],
    },
  },
};
