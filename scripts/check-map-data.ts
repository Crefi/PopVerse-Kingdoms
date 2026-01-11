/**
 * Check map data in database
 * Usage: npx tsx scripts/check-map-data.ts
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

async function checkMapData() {
  console.log('🔍 Checking map data...\n');

  // Check terrain distribution
  const terrainCounts = await db('map_tiles')
    .select('terrain')
    .count('* as count')
    .groupBy('terrain');

  console.log('📊 Terrain Distribution:');
  for (const row of terrainCounts) {
    console.log(`   ${row.terrain}: ${row.count}`);
  }

  // Check NPC count
  const npcCount = await db('npcs').count('* as count').first();
  console.log(`\n👹 Total NPCs: ${npcCount?.count || 0}`);

  // Check tiles with NPCs
  const tilesWithNpcs = await db('map_tiles')
    .whereNotNull('npc_id')
    .count('* as count')
    .first();
  console.log(`📍 Tiles with NPCs: ${tilesWithNpcs?.count || 0}`);

  // Sample some tiles around center (50,50)
  const sampleTiles = await db('map_tiles')
    .select('x', 'y', 'terrain', 'npc_id', 'occupant_id')
    .whereBetween('x', [45, 55])
    .whereBetween('y', [45, 55])
    .limit(20);

  console.log('\n🗺️  Sample tiles around center (45-55, 45-55):');
  for (const tile of sampleTiles) {
    const extras = [];
    if (tile.npc_id) extras.push(`NPC:${tile.npc_id}`);
    if (tile.occupant_id) extras.push(`Player:${tile.occupant_id}`);
    console.log(`   (${tile.x},${tile.y}): ${tile.terrain}${extras.length ? ' [' + extras.join(', ') + ']' : ''}`);
  }

  // Check if any resource tiles exist
  const resourceTiles = await db('map_tiles')
    .where('terrain', 'resource')
    .select('x', 'y')
    .limit(5);

  console.log('\n💎 Sample resource tiles:');
  if (resourceTiles.length === 0) {
    console.log('   ⚠️  NO RESOURCE TILES FOUND - Map may need to be regenerated!');
  } else {
    for (const tile of resourceTiles) {
      console.log(`   (${tile.x},${tile.y})`);
    }
  }

  await db.destroy();
}

checkMapData().catch(console.error);
