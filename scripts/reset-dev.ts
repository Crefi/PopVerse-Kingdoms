/**
 * Development Reset Script
 * Clears all game data from the database for fresh testing
 * 
 * Usage: npm run reset
 */

import dotenv from 'dotenv';
import knex from 'knex';
import Redis from 'ioredis';

dotenv.config({ path: '.env.dev' });

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'popverse_kingdoms_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
});

async function resetDatabase(): Promise<void> {
  console.log('🗑️  Resetting development database...\n');

  // Tables to clear (in order due to foreign keys)
  const tables = [
    'tutorial_progress',
    'fog_of_war',
    'daily_quests',
    'login_rewards',
    'battle_logs',
    'marches',
    'troops',
    'heroes',
    'buildings',
    'guild_members',
    'guilds',
    'land_parcels',
    'map_tiles',
    'players',
  ];

  for (const table of tables) {
    try {
      const result = await db(table).del();
      console.log(`  ✓ Cleared ${table} (${result} rows)`);
    } catch (error) {
      // Table might not exist yet
      console.log(`  - Skipped ${table} (not found)`);
    }
  }

  console.log('\n✅ Database reset complete!');
}

async function resetRedis(): Promise<void> {
  console.log('\n🗑️  Clearing Redis cache...');

  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    await redis.flushdb();
    await redis.quit();

    console.log('  ✓ Redis cache cleared');
  } catch (error) {
    console.log('  - Redis not available or already empty');
  }
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   PopVerse Kingdoms - Dev Reset Tool   ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await resetDatabase();
    await resetRedis();

    console.log('\n🌍 Regenerating world map...');
    console.log('   Run: npm run db:seed:dev');
    console.log('\n🎮 Then start the bot:');
    console.log('   Run: npm run dev');
    console.log('   Then use /begin in Discord\n');
  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
