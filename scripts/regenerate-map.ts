/**
 * Regenerate the world map with terrain and NPCs
 * This preserves player positions but regenerates all terrain and NPCs
 * 
 * Usage: npx tsx scripts/regenerate-map.ts
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const MAP_SIZE = 100;

interface TileData {
  x: number;
  y: number;
  terrain: string;
}

interface NPCData {
  type: string;
  name: string;
  coord_x: number;
  coord_y: number;
  power: number;
  troops: string;
  rewards: string;
}

// NPC names by type
const NPC_NAMES = {
  bandit_camp: ['Bandit Hideout', 'Outlaw Camp', 'Raider Den', 'Thief Refuge', 'Brigand Base'],
  goblin_outpost: ['Goblin Warren', 'Greenskin Camp', 'Goblin Nest', 'Orc Outpost', 'Troll Cave'],
  dragon_lair: ["Dragon's Den", 'Wyrm Lair', 'Drake Nest', 'Serpent Cave', 'Fire Pit'],
};

// Seeded random function for consistent map generation
const seededRandom = (x: number, y: number, offset: number = 0): number => {
  const seed = ((x * 1000 + y + offset) * 9973) % 2147483647;
  return ((seed * 16807) % 2147483647) / 2147483647;
};

// Terrain distribution based on distance from center
const getTerrainAt = (x: number, y: number): string => {
  const centerX = MAP_SIZE / 2;
  const centerY = MAP_SIZE / 2;
  const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
  const random = seededRandom(x, y);

  // Center area - more resources, strategic value
  if (distFromCenter < 15) {
    if (random < 0.08) return 'resource';
    if (random < 0.15) return 'lake';
    if (random < 0.25) return 'forest';
    if (random < 0.30) return 'mountain';
    return 'plains';
  }

  // Middle ring - mixed terrain
  if (distFromCenter < 35) {
    if (random < 0.04) return 'resource';
    if (random < 0.14) return 'mountain';
    if (random < 0.24) return 'lake';
    if (random < 0.38) return 'forest';
    return 'plains';
  }

  // Outer ring (spawn zone) - mostly plains, easier for new players
  if (random < 0.02) return 'resource';
  if (random < 0.08) return 'mountain';
  if (random < 0.14) return 'lake';
  if (random < 0.24) return 'forest';
  return 'plains';
};

type NpcType = 'bandit_camp' | 'goblin_outpost' | 'dragon_lair';

// Generate NPC if conditions are met
const generateNPC = (x: number, y: number, terrain: string): NPCData | null => {
  // Only spawn on plains or forest
  if (terrain !== 'plains' && terrain !== 'forest') return null;

  const random = seededRandom(x, y, 12345);
  const centerX = MAP_SIZE / 2;
  const centerY = MAP_SIZE / 2;
  const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

  let npcChance: number;
  let npcType: NpcType;
  let basePower: number;

  if (distFromCenter < 20) {
    npcChance = 0.03;
    npcType = random < 0.3 ? 'dragon_lair' : random < 0.6 ? 'goblin_outpost' : 'bandit_camp';
    basePower = npcType === 'dragon_lair' ? 8000 : npcType === 'goblin_outpost' ? 5000 : 3000;
  } else if (distFromCenter < 35) {
    npcChance = 0.05;
    npcType = random < 0.2 ? 'dragon_lair' : random < 0.5 ? 'goblin_outpost' : 'bandit_camp';
    basePower = npcType === 'dragon_lair' ? 5000 : npcType === 'goblin_outpost' ? 2500 : 1500;
  } else {
    npcChance = 0.06;
    npcType = random < 0.05 ? 'goblin_outpost' : 'bandit_camp';
    basePower = npcType === 'goblin_outpost' ? 1000 : 500;
  }

  if (random > npcChance) return null;

  const powerVariance = seededRandom(x, y, 54321);
  const power = Math.floor(basePower * (0.7 + powerVariance * 0.6));

  const troops = {
    t1: Math.floor(power / 10),
    t2: Math.floor(power / 50),
    t3: Math.floor(power / 200),
  };

  const rewards = {
    food: Math.floor(power * 2),
    iron: Math.floor(power * 1.5),
    gold: Math.floor(power * 0.5),
    xp: Math.floor(power * 0.3),
    shardChance: Math.min(0.3, power / 30000),
  };

  const names = NPC_NAMES[npcType];
  const nameIndex = Math.floor(seededRandom(x, y, 99999) * names.length);

  return {
    type: npcType,
    name: names[nameIndex],
    coord_x: x,
    coord_y: y,
    power,
    troops: JSON.stringify(troops),
    rewards: JSON.stringify(rewards),
  };
};

async function regenerateMap() {
  console.log('🗺️  Regenerating world map...\n');

  // Get existing player positions to preserve them
  const playerTiles = await db('map_tiles')
    .select('x', 'y', 'occupant_id')
    .whereNotNull('occupant_id');
  
  const playerPositions = new Map(playerTiles.map(t => [`${t.x},${t.y}`, t.occupant_id]));
  console.log(`Found ${playerPositions.size} player positions to preserve`);

  // Clear existing map data
  console.log('Clearing existing map data...');
  await db('map_tiles').del();
  await db('npcs').del();

  const tiles: TileData[] = [];
  const npcs: NPCData[] = [];

  // Generate all tiles and NPCs
  console.log('Generating terrain...');
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const terrain = getTerrainAt(x, y);
      tiles.push({ x, y, terrain });

      // Don't spawn NPCs on player tiles
      if (!playerPositions.has(`${x},${y}`)) {
        const npc = generateNPC(x, y, terrain);
        if (npc) npcs.push(npc);
      }
    }
  }

  // Insert NPCs first
  console.log(`Inserting ${npcs.length} NPCs...`);
  const npcIdMap = new Map<string, number>();
  
  if (npcs.length > 0) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < npcs.length; i += BATCH_SIZE) {
      const batch = npcs.slice(i, i + BATCH_SIZE);
      const inserted = await db('npcs').insert(batch).returning(['id', 'coord_x', 'coord_y']);
      for (const row of inserted) {
        npcIdMap.set(`${row.coord_x},${row.coord_y}`, row.id);
      }
    }
  }

  // Prepare tiles with NPC and player references
  console.log('Inserting map tiles...');
  const tilesWithRefs = tiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    terrain: tile.terrain,
    npc_id: npcIdMap.get(`${tile.x},${tile.y}`) || null,
    occupant_id: playerPositions.get(`${tile.x},${tile.y}`) || null,
  }));

  // Insert tiles in batches
  const BATCH_SIZE = 1000;
  for (let i = 0; i < tilesWithRefs.length; i += BATCH_SIZE) {
    const batch = tilesWithRefs.slice(i, i + BATCH_SIZE);
    await db('map_tiles').insert(batch);
    
    if (i % 5000 === 0) {
      console.log(`  Progress: ${Math.floor((i / tilesWithRefs.length) * 100)}%`);
    }
  }

  // Count terrain types
  const terrainCounts = tiles.reduce((acc, t) => {
    acc[t.terrain] = (acc[t.terrain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Count NPC types
  const npcCounts = npcs.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n✅ Map regeneration complete!');
  console.log('');
  console.log('📊 Terrain Distribution:');
  console.log(`   🟩 Plains:   ${terrainCounts.plains || 0}`);
  console.log(`   🟫 Forest:   ${terrainCounts.forest || 0}`);
  console.log(`   ⬛ Mountain: ${terrainCounts.mountain || 0}`);
  console.log(`   🟦 Lake:     ${terrainCounts.lake || 0}`);
  console.log(`   🟨 Resource: ${terrainCounts.resource || 0}`);
  console.log('');
  console.log('👹 NPC Distribution:');
  console.log(`   🏴 Bandit Camps:    ${npcCounts.bandit_camp || 0}`);
  console.log(`   👺 Goblin Outposts: ${npcCounts.goblin_outpost || 0}`);
  console.log(`   🐉 Dragon Lairs:    ${npcCounts.dragon_lair || 0}`);
  console.log(`   Total NPCs: ${npcs.length}`);
  console.log('');
  console.log('👤 Player positions preserved:', playerPositions.size);

  await db.destroy();
}

regenerateMap().catch(console.error);
