#!/usr/bin/env tsx
/**
 * Check resource distribution on the map
 */

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

async function checkResources() {
  console.log('🔍 Checking resource distribution...\n');

  // Count resources by terrain type
  const terrainCounts = await db('map_tiles')
    .select('terrain')
    .count('* as count')
    .groupBy('terrain')
    .orderBy('count', 'desc');

  console.log('📊 Terrain Distribution:');
  terrainCounts.forEach((row: any) => {
    console.log(`  ${row.terrain}: ${row.count}`);
  });

  // Get some sample resource locations
  const resources = await db('map_tiles')
    .select('x', 'y')
    .where('terrain', 'resource')
    .limit(20);

  console.log('\n💎 Sample Resource Locations (first 20):');
  resources.forEach((r: any) => {
    console.log(`  (${r.x}, ${r.y})`);
  });

  // Check mountains
  const mountains = await db('map_tiles')
    .select('x', 'y')
    .where('terrain', 'mountain')
    .limit(20);

  console.log('\n⛰️  Sample Mountain Locations (first 20):');
  mountains.forEach((m: any) => {
    console.log(`  (${m.x}, ${m.y})`);
  });

  // Check NPCs
  const npcCount = await db('npcs').count('* as count').first();
  console.log(`\n👹 Total NPCs: ${npcCount?.count || 0}`);

  const sampleNpcs = await db('npcs')
    .select('type', 'coord_x', 'coord_y', 'power')
    .limit(10);

  console.log('\n👹 Sample NPCs (first 10):');
  sampleNpcs.forEach((npc: any) => {
    console.log(`  ${npc.type} at (${npc.coord_x}, ${npc.coord_y}) - Power: ${npc.power}`);
  });

  await db.destroy();
}

checkResources().catch(console.error);
