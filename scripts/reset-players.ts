/**
 * Player Data Reset Script
 * Clears only player-related data while preserving NPCs and map resources
 * 
 * Usage: npm run reset:players
 */

import dotenv from 'dotenv';
import knex from 'knex';
import Redis from 'ioredis';

dotenv.config({ path: '.env.prod' });

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'popverse_postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'popverse_kingdoms',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
});

async function resetPlayerData(): Promise<void> {
  console.log('🗑️  Resetting player data...\n');

  // Tables to clear (in order due to foreign keys)
  // Only player-related tables, NOT npcs or map_tiles
  const tables = [
    'tutorial_progress',
    'fog_of_war',
    'daily_quests',
    'login_rewards',
    'battle_logs',
    'marches',
    'arena_defenses',
    'research',
    'battles',
    'troops',
    'hero_shards',
    'heroes',
    'buildings',
    'guild_members',
    'guilds',
  ];

  for (const table of tables) {
    try {
      const result = await db(table).del();
      console.log(`  ✓ Cleared ${table} (${result} rows)`);
    } catch (error) {
      console.log(`  - Skipped ${table} (not found)`);
    }
  }

  // Clear player occupancy from map tiles but keep the tiles
  try {
    const result = await db('map_tiles')
      .whereNotNull('occupant_id')
      .update({ occupant_id: null });
    console.log(`  ✓ Cleared player occupancy from map_tiles (${result} tiles)`);
  } catch (error) {
    console.log(`  - Skipped map_tiles update`);
  }

  // Clear land parcel ownership but keep the parcels
  try {
    const result = await db('land_parcels')
      .update({ 
        owner_player_id: null,
        owner_guild_id: null 
      });
    console.log(`  ✓ Cleared land parcel ownership (${result} parcels)`);
  } catch (error) {
    console.log(`  - Skipped land_parcels update`);
  }

  // Finally, delete all players
  try {
    const result = await db('players').del();
    console.log(`  ✓ Cleared players (${result} rows)`);
  } catch (error) {
    console.log(`  - Skipped players`);
  }

  console.log('\n✅ Player data reset complete!');
  console.log('   NPCs and map resources preserved.');
}

async function resetRedis(): Promise<void> {
  console.log('\n🗑️  Clearing Redis cache...');

  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'popverse_redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
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
  console.log('║  PopVerse Kingdoms - Player Reset     ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await resetPlayerData();
    await resetRedis();

    console.log('\n🎮 Game is ready for new players!');
    console.log('   NPCs and resources remain on the map.\n');
  } catch (error) {
    console.error('\n❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
