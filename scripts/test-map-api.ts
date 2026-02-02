#!/usr/bin/env tsx
/**
 * Test the map API to see what data it returns
 */

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

async function testMapAPI() {
  console.log('🧪 Testing map API query logic...\n');

  const MAP_SIZE = 100;
  const x = 50; // Center
  const y = 50; // Center
  const size = 100;

  // Calculate bounds (same as API)
  const minX = Math.max(0, x - Math.floor(size / 2));
  const maxX = Math.min(MAP_SIZE - 1, x + Math.floor(size / 2));
  const minY = Math.max(0, y - Math.floor(size / 2));
  const maxY = Math.min(MAP_SIZE - 1, y + Math.floor(size / 2));

  console.log(`📍 Request: center=(${x}, ${y}), size=${size}`);
  console.log(`📐 Calculated bounds: (${minX}, ${minY}) to (${maxX}, ${maxY})`);
  console.log(`📏 Expected tiles: ${(maxX - minX + 1) * (maxY - minY + 1)}\n`);

  // Query tiles (same as API)
  const tiles = await db('map_tiles')
    .select('x', 'y', 'terrain')
    .whereBetween('x', [minX, maxX])
    .whereBetween('y', [minY, maxY]);

  console.log(`✅ Actual tiles returned: ${tiles.length}\n`);

  // Count by terrain
  const terrainCounts: Record<string, number> = {};
  tiles.forEach(t => {
    terrainCounts[t.terrain] = (terrainCounts[t.terrain] || 0) + 1;
  });

  console.log('📊 Terrain in returned data:');
  Object.entries(terrainCounts).forEach(([terrain, count]) => {
    console.log(`  ${terrain}: ${count}`);
  });

  // Show some resource locations
  const resources = tiles.filter(t => t.terrain === 'resource').slice(0, 10);
  console.log('\n💎 Sample resources in result:');
  resources.forEach(r => {
    console.log(`  (${r.x}, ${r.y})`);
  });

  // Show some mountain locations
  const mountains = tiles.filter(t => t.terrain === 'mountain').slice(0, 10);
  console.log('\n⛰️  Sample mountains in result:');
  mountains.forEach(m => {
    console.log(`  (${m.x}, ${m.y})`);
  });

  await db.destroy();
}

testMapAPI().catch(console.error);
