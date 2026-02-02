#!/usr/bin/env tsx
/**
 * Analyze map distribution to verify improvements
 * Shows resource, NPC, and land distribution by zone
 */

import { getDatabase } from '../src/infrastructure/database/connection.js';

const MAP_SIZE = 100;
const CENTER = MAP_SIZE / 2;
const TEMPLE_RADIUS = 15;
const RESOURCE_RADIUS = 30;

interface TileRow {
  x: number;
  y: number;
  terrain: string;
  npc_id: number | null;
  land_parcel_id: number | null;
}

interface NPCRow {
  id: number;
  coord_x: number;
  coord_y: number;
  type: string;
  power: number;
}

interface LandRow {
  id: number;
  type: string;
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

const distanceFromCenter = (x: number, y: number): number => {
  return Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
};

const getZone = (x: number, y: number): string => {
  const centerDist = distanceFromCenter(x, y);
  if (centerDist <= TEMPLE_RADIUS) return 'temple';
  if (centerDist <= RESOURCE_RADIUS) return 'resource';
  return 'spawn';
};

async function analyzeMap() {
  const db = getDatabase();

  console.log('🔍 Analyzing Map Distribution...\n');

  // Fetch all tiles
  const tiles = await db('map_tiles')
    .select('x', 'y', 'terrain', 'npc_id', 'land_parcel_id') as TileRow[];

  // Fetch all NPCs
  const npcs = await db('npcs')
    .select('id', 'coord_x', 'coord_y', 'type', 'power') as NPCRow[];

  // Fetch all lands
  const lands = await db('land_parcels')
    .select('id', 'type', 'min_x', 'min_y', 'max_x', 'max_y') as LandRow[];

  // Analyze by zone
  const zoneStats = {
    temple: { total: 0, resources: 0, npcs: 0, lands: 0 },
    resource: { total: 0, resources: 0, npcs: 0, lands: 0 },
    spawn: { total: 0, resources: 0, npcs: 0, lands: 0 },
  };

  const terrainCounts: Record<string, number> = {};
  const npcTypeCounts: Record<string, number> = {};
  const landTypeCounts: Record<string, number> = {};

  // Analyze tiles
  for (const tile of tiles) {
    const zone = getZone(tile.x, tile.y);
    
    // Skip mountain borders
    if (tile.terrain === 'mountain') continue;

    zoneStats[zone as keyof typeof zoneStats].total++;
    
    if (tile.terrain === 'resource') {
      zoneStats[zone as keyof typeof zoneStats].resources++;
    }

    terrainCounts[tile.terrain] = (terrainCounts[tile.terrain] || 0) + 1;
  }

  // Analyze NPCs
  for (const npc of npcs) {
    const zone = getZone(npc.coord_x, npc.coord_y);
    zoneStats[zone as keyof typeof zoneStats].npcs++;
    npcTypeCounts[npc.type] = (npcTypeCounts[npc.type] || 0) + 1;
  }

  // Analyze lands (by center point)
  for (const land of lands) {
    const centerX = (land.min_x + land.max_x) / 2;
    const centerY = (land.min_y + land.max_y) / 2;
    const zone = getZone(centerX, centerY);
    zoneStats[zone as keyof typeof zoneStats].lands++;
    landTypeCounts[land.type] = (landTypeCounts[land.type] || 0) + 1;
  }

  // Print results
  console.log('📊 ZONE DISTRIBUTION\n');
  console.log('═══════════════════════════════════════════════════════════');
  
  for (const [zone, stats] of Object.entries(zoneStats)) {
    const resourcePercent = ((stats.resources / stats.total) * 100).toFixed(1);
    const npcDensity = ((stats.npcs / stats.total) * 100).toFixed(1);
    
    console.log(`\n🏛️  ${zone.toUpperCase()} ZONE`);
    console.log(`   Total Tiles: ${stats.total}`);
    console.log(`   Resources: ${stats.resources} (${resourcePercent}%)`);
    console.log(`   NPCs: ${stats.npcs} (${npcDensity}% density)`);
    console.log(`   Lands: ${stats.lands}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('\n🌍 TERRAIN DISTRIBUTION\n');
  
  const totalTiles = Object.values(terrainCounts).reduce((a, b) => a + b, 0);
  for (const [terrain, count] of Object.entries(terrainCounts).sort((a, b) => b[1] - a[1])) {
    const percent = ((count / totalTiles) * 100).toFixed(1);
    const icon = terrain === 'plains' ? '🟩' : terrain === 'forest' ? '🌲' : terrain === 'mountain' ? '⛰️' : '💎';
    console.log(`   ${icon} ${terrain.padEnd(10)}: ${count.toString().padStart(5)} (${percent}%)`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('\n👹 NPC DISTRIBUTION\n');
  
  for (const [type, count] of Object.entries(npcTypeCounts).sort((a, b) => b[1] - a[1])) {
    const icon = type === 'dragon_lair' ? '🐉' : type === 'goblin_outpost' ? '👺' : '🏴';
    console.log(`   ${icon} ${type.padEnd(16)}: ${count}`);
  }
  console.log(`   Total NPCs: ${npcs.length}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('\n🏞️  LAND PARCEL DISTRIBUTION\n');
  
  for (const [type, count] of Object.entries(landTypeCounts).sort((a, b) => b[1] - a[1])) {
    const icon = type === 'farm' ? '🌾' : type === 'mine' ? '⛏️' : type === 'goldmine' ? '💰' : '🏰';
    console.log(`   ${icon} ${type.padEnd(10)}: ${count}`);
  }
  console.log(`   Total Lands: ${lands.length}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('\n✅ Analysis Complete!\n');

  // Check for issues
  const issues: string[] = [];
  
  if (zoneStats.spawn.npcs < 50) {
    issues.push('⚠️  Spawn zone has too few NPCs (should be 50+)');
  }
  if (zoneStats.spawn.lands < 30) {
    issues.push('⚠️  Spawn zone has too few lands (should be 30+)');
  }
  if (zoneStats.resource.resources / zoneStats.resource.total < 0.25) {
    issues.push('⚠️  Resource zone has too few resources (should be 25%+)');
  }

  if (issues.length > 0) {
    console.log('⚠️  ISSUES DETECTED:\n');
    issues.forEach(issue => console.log(`   ${issue}`));
    console.log('');
  } else {
    console.log('✨ Map distribution looks good!\n');
  }

  process.exit(0);
}

analyzeMap().catch((error) => {
  console.error('Error analyzing map:', error);
  process.exit(1);
});
