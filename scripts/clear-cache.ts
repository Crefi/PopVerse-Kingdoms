/**
 * Clear all Redis cache
 * Usage: npx tsx scripts/clear-cache.ts
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function clearCache() {
  console.log('🗑️  Clearing Redis cache...\n');
  console.log(`Connecting to: ${REDIS_URL}`);

  const redis = new Redis(REDIS_URL);

  try {
    // Get all keys
    const keys = await redis.keys('*');
    console.log(`Found ${keys.length} keys in cache`);

    if (keys.length > 0) {
      // Group keys by prefix for reporting
      const keyGroups: Record<string, number> = {};
      for (const key of keys) {
        const prefix = key.split(':')[0];
        keyGroups[prefix] = (keyGroups[prefix] || 0) + 1;
      }

      console.log('\nCache contents:');
      for (const [prefix, count] of Object.entries(keyGroups)) {
        console.log(`  ${prefix}: ${count} keys`);
      }

      // Delete all keys
      await redis.flushdb();
      console.log('\n✅ All cache cleared!');
    } else {
      console.log('Cache is already empty.');
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  } finally {
    await redis.quit();
  }
}

clearCache().catch(console.error);
