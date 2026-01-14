/**
 * Regenerate the world map with terrain and NPCs
 * This preserves player positions but regenerates all terrain and NPCs
 * 
 * Map Layout:
 * - Mountains at the edges (natural border)
 * - Forests scattered throughout  
 * - Resources spread across the map (slightly more in center)
 * - Plains everywhere else
 * - NO water/lakes
 * 
 * Usage: npx tsx scripts/regenerate-map.ts
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const MAP_SIZE = 100;
const CENTER = MAP_SIZE / 2;

interface TileData {
  x: number;
  y: number;
  terrain: string;
  zone?: string;
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

const NPC_NAMES = {
  bandit_camp: ['Bandit Hideout', 'Outlaw Camp', 'Raider Den', 'Thief Refuge', 'Brigand Base'],
  goblin_outpost: ['Goblin Warren', 'Greenskin Camp', 'Goblin Nest', 'Orc Outpost', 'Troll Cave'],
  dragon_lair: ["Dragon's Den", 'Wyrm Lair', 'Drake Nest', 'Serpent Cave', 'Fire Pit'],
};

// Hash-based random to avoid patterns
const hashRandom = (x: number, y: number, seed: number = 0): number => {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (Math.abs(h) % 10000) / 10000;
};

const distanceFromEdge = (x: number, y: number): number => {
  return Math.min(x, MAP_SIZE - 1 - x, y, MAP_SIZE - 1 - y);
};

const distanceFromCenter = (x: number, y: number): number => {
  return Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
};

type NpcType = 'bandit_camp' | 'goblin_outpost' | 'dragon_lair';

// Zone configuration
const TEMPLE_RADIUS = 15;
const RESOURCE_RADIUS = 30;

const getZone = (x: number, y: number): string => {
  const centerDist = distanceFromCenter(x, y);
  if (centerDist <= TEMPLE_RADIUS) return 'temple';
  if (centerDist <= RESOURCE_RADIUS) return 'resource';
  return 'spawn';
};

// Updated terrain generation with zones
const getTerrainWithZone = (x: number, y: number): { terrain: string; zone: string } => {
  const edgeDist = distanceFromEdge(x, y);
  const centerDist = distanceFromCenter(x, y);
  const zone = getZone(x, y);
  const rand = hashRandom(x, y, 12345);
  const rand2 = hashRandom(x, y, 67890);
  const forestRand = hashRandom(x, y, 11111);
  
  // Mountains at edges (3-4 tiles thick)
  if (edgeDist <= 2) return { terrain: 'mountain', zone };
  if (edgeDist === 3 && rand < 0.7) return { terrain: 'mountain', zone };
  if (edgeDist === 4 && rand < 0.4) return { terrain: 'mountain', zone };
  if (rand < 0.01) return { terrain: 'mountain', zone };
  
  // Zone-based terrain
  if (zone === 'temple') {
    if (centerDist <= 5) {
      if (rand2 < 0.05) return { terrain: 'resource', zone };
      if (forestRand < 0.05) return { terrain: 'forest', zone };
    } else {
      if (rand2 < 0.08) return { terrain: 'resource', zone };
      if (forestRand < 0.10) return { terrain: 'forest', zone };
    }
  } else if (zone === 'resource') {
    if (rand2 < 0.15) return { terrain: 'resource', zone };
    if (forestRand < 0.12) return { terrain: 'forest', zone };
  } else {
    if (rand2 < 0.04) return { terrain: 'resource', zone };
    if (forestRand < 0.10) return { terrain: 'forest', zone };
  }
  
  return { terrain: 'plains', zone };
};

// Updated NPC generation with zones
const generateNPCWithZone = (x: number, y: number, terrain: string, zone: string): NPCData | null => {
  if (terrain !== 'plains' && terrain !== 'forest') return null;

  const centerDist = distanceFromCenter(x, y);
  const rand = hashRandom(x, y, 77777);
  const typeRand = hashRandom(x, y, 88888);

  let npcType: NpcType;
  let basePower: number;

  if (zone === 'temple') {
    if (centerDist <= 5) {
      if (rand > 0.03) return null;
      npcType = 'dragon_lair';
      basePower = 15000;
    } else {
      if (rand > 0.06) return null;
      npcType = typeRand < 0.4 ? 'dragon_lair' : typeRand < 0.7 ? 'goblin_outpost' : 'bandit_camp';
      basePower = npcType === 'dragon_lair' ? 10000 : npcType === 'goblin_outpost' ? 6000 : 4000;
    }
  } else if (zone === 'resource') {
    if (rand > 0.07) return null;
    npcType = typeRand < 0.2 ? 'dragon_lair' : typeRand < 0.5 ? 'goblin_outpost' : 'bandit_camp';
    basePower = npcType === 'dragon_lair' ? 6000 : npcType === 'goblin_outpost' ? 3000 : 1500;
  } else {
    if (rand > 0.05) return null;
    npcType = typeRand < 0.1 ? 'goblin_outpost' : 'bandit_camp';
    basePower = npcType === 'goblin_outpost' ? 1200 : 500;
  }

  const power = Math.floor(basePower * (0.8 + hashRandom(x, y, 99999) * 0.4));
  const troops = { t1: Math.floor(power / 10), t2: Math.floor(power / 50), t3: Math.floor(power / 200) };
  const rewards = { food: Math.floor(power * 2), iron: Math.floor(power * 1.5), gold: Math.floor(power * 0.5), xp: Math.floor(power * 0.3), shardChance: Math.min(0.4, power / 25000) };
  const names = NPC_NAMES[npcType];

  return {
    type: npcType,
    name: names[Math.floor(hashRandom(x, y, 44444) * names.length)],
    coord_x: x,
    coord_y: y,
    power,
    troops: JSON.stringify(troops),
    rewards: JSON.stringify(rewards),
  };
};

async function generateLandParcels(tiles: TileData[]): Promise<Record<string, number>> {
  const LAND_TYPES = ['farm', 'mine', 'goldmine', 'fort'] as const;
  
  const LAND_CONFIG = {
    farm: { count: 30, minSize: 3, maxSize: 5, baseCost: 500, name: 'Fertile Farm', zones: ['spawn', 'resource'] },
    mine: { count: 25, minSize: 3, maxSize: 4, baseCost: 600, name: 'Iron Mine', zones: ['spawn', 'resource'] },
    goldmine: { count: 18, minSize: 2, maxSize: 3, baseCost: 1200, name: 'Gold Vein', zones: ['resource', 'temple'] },
    fort: { count: 20, minSize: 3, maxSize: 4, baseCost: 800, name: 'Strategic Fort', zones: ['spawn', 'resource', 'temple'] },
  };

  const LAND_BONUSES = {
    farm: { food: 0.15 },
    mine: { iron: 0.15 },
    goldmine: { gold: 0.20 },
    fort: { defense: 0.10 },
  };

  const terrainMap = new Map<string, { terrain: string; zone: string }>();
  for (const tile of tiles) {
    terrainMap.set(`${tile.x},${tile.y}`, { terrain: tile.terrain, zone: tile.zone || 'spawn' });
  }

  interface LandParcelData {
    name: string;
    type: string;
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
    bonuses: string;
    purchase_cost: number;
  }

  const parcels: LandParcelData[] = [];
  const occupiedAreas: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
  const counts: Record<string, number> = { farm: 0, mine: 0, goldmine: 0, fort: 0 };

  let globalSeed = 42;
  const nextRandom = (): number => {
    globalSeed = (globalSeed * 1103515245 + 12345) >>> 0;
    return (globalSeed % 2147483647) / 2147483647;
  };

  const isAreaFree = (minX: number, minY: number, maxX: number, maxY: number): boolean => {
    for (const area of occupiedAreas) {
      if (!(maxX < area.minX || minX > area.maxX || maxY < area.minY || minY > area.maxY)) {
        return false;
      }
    }
    return true;
  };

  const hasBlockedTerrain = (minX: number, minY: number, maxX: number, maxY: number): boolean => {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = terrainMap.get(`${x},${y}`);
        if (tile && tile.terrain === 'mountain') return true;
      }
    }
    return false;
  };

  const getZoneOfArea = (minX: number, minY: number, maxX: number, maxY: number): string => {
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const tile = terrainMap.get(`${Math.floor(centerX)},${Math.floor(centerY)}`);
    return tile?.zone || 'spawn';
  };

  for (const type of LAND_TYPES) {
    const config = LAND_CONFIG[type];
    let attempts = 0;
    const maxAttempts = 1500;

    while (counts[type] < config.count && attempts < maxAttempts) {
      attempts++;

      const sizeX = Math.floor(nextRandom() * (config.maxSize - config.minSize + 1)) + config.minSize;
      const sizeY = Math.floor(nextRandom() * (config.maxSize - config.minSize + 1)) + config.minSize;

      const minX = Math.floor(nextRandom() * (MAP_SIZE - sizeX - 12)) + 6;
      const minY = Math.floor(nextRandom() * (MAP_SIZE - sizeY - 12)) + 6;
      const maxX = minX + sizeX - 1;
      const maxY = minY + sizeY - 1;

      const zone = getZoneOfArea(minX, minY, maxX, maxY);
      
      if (!config.zones.includes(zone as any)) continue;

      if (isAreaFree(minX - 2, minY - 2, maxX + 2, maxY + 2) && !hasBlockedTerrain(minX, minY, maxX, maxY)) {
        let costMultiplier = 1;
        if (zone === 'resource') costMultiplier = 1.3;
        if (zone === 'temple') costMultiplier = 1.6;
        
        const cost = Math.floor(config.baseCost * (sizeX * sizeY) / 9 * costMultiplier);
        
        parcels.push({
          name: `${config.name} #${counts[type] + 1}`,
          type,
          min_x: minX,
          min_y: minY,
          max_x: maxX,
          max_y: maxY,
          bonuses: JSON.stringify(LAND_BONUSES[type]),
          purchase_cost: cost,
        });

        occupiedAreas.push({ minX, minY, maxX, maxY });
        counts[type]++;
      }
    }
  }

  if (parcels.length > 0) {
    const inserted = await db('land_parcels').insert(parcels).returning(['id', 'min_x', 'min_y', 'max_x', 'max_y']);
    
    for (const parcel of inserted) {
      await db('map_tiles')
        .where('x', '>=', parcel.min_x)
        .where('x', '<=', parcel.max_x)
        .where('y', '>=', parcel.min_y)
        .where('y', '<=', parcel.max_y)
        .update({ land_parcel_id: parcel.id });
    }
  }

  return counts;
}

async function regenerateMap(): Promise<void> {
  console.log('🗺️  Regenerating world map...');
  console.log('');

  // Get existing player positions to preserve
  const players = await db('players').select('id', 'coord_x', 'coord_y');
  console.log(`  Found ${players.length} players to preserve`);

  // Clear existing map data (but not players)
  console.log('  Clearing existing map data...');
  await db('map_tiles').del();
  await db('npcs').del();
  await db('land_parcels').del();

  // Generate tiles and NPCs
  console.log('  Generating terrain and zones...');
  
  interface TileWithZone extends TileData {
    zone: string;
  }
  
  const tiles: TileWithZone[] = [];
  const npcs: NPCData[] = [];
  const zoneCounts = { temple: 0, resource: 0, spawn: 0 };

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const { terrain, zone } = getTerrainWithZone(x, y);
      tiles.push({ x, y, terrain, zone });
      
      if (terrain !== 'mountain' && distanceFromEdge(x, y) > 4) {
        zoneCounts[zone as keyof typeof zoneCounts]++;
      }

      const npc = generateNPCWithZone(x, y, terrain, zone);
      if (npc) npcs.push(npc);
    }
  }

  // Insert NPCs first
  console.log(`  Inserting ${npcs.length} NPCs...`);
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

  // Insert tiles (without zone - column doesn't exist in DB)
  console.log('  Inserting map tiles...');
  const tilesWithNpcs = tiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    terrain: tile.terrain,
    npc_id: npcIdMap.get(`${tile.x},${tile.y}`) || null,
  }));

  const BATCH_SIZE = 1000;
  for (let i = 0; i < tilesWithNpcs.length; i += BATCH_SIZE) {
    const batch = tilesWithNpcs.slice(i, i + BATCH_SIZE);
    await db('map_tiles').insert(batch);
  }

  // Restore player positions on map (uses occupant_id, not player_id)
  console.log('  Restoring player positions...');
  for (const player of players) {
    await db('map_tiles')
      .where({ x: player.coord_x, y: player.coord_y })
      .update({ occupant_id: player.id });
  }

  // Generate land parcels
  console.log('  Generating land parcels...');
  const landCounts = await generateLandParcels(tiles);

  // Stats
  const terrainCounts = tiles.reduce((acc, t) => {
    acc[t.terrain] = (acc[t.terrain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const npcCounts = npcs.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalZoneTiles = zoneCounts.temple + zoneCounts.resource + zoneCounts.spawn;
  const zonePercentages = {
    temple: ((zoneCounts.temple / totalZoneTiles) * 100).toFixed(1),
    resource: ((zoneCounts.resource / totalZoneTiles) * 100).toFixed(1),
    spawn: ((zoneCounts.spawn / totalZoneTiles) * 100).toFixed(1),
  };

  console.log('\n✅ Map regeneration complete!');
  console.log('');
  console.log('🌍 Zone Distribution:');
  console.log(`   🏛️  Temple Zone:   ${zoneCounts.temple} tiles (${zonePercentages.temple}%)`);
  console.log(`   💎 Resource Zone: ${zoneCounts.resource} tiles (${zonePercentages.resource}%)`);
  console.log(`   🛡️  Spawn Zone:    ${zoneCounts.spawn} tiles (${zonePercentages.spawn}%)`);
  console.log('');
  console.log('📊 Terrain Distribution:');
  console.log(`   🟩 Plains:   ${terrainCounts.plains || 0}`);
  console.log(`   🌲 Forest:   ${terrainCounts.forest || 0}`);
  console.log(`   ⛰️  Mountain: ${terrainCounts.mountain || 0}`);
  console.log(`   💎 Resource: ${terrainCounts.resource || 0}`);
  console.log('');
  console.log('👹 NPC Distribution:');
  console.log(`   🏴 Bandit Camps:    ${npcCounts.bandit_camp || 0}`);
  console.log(`   👺 Goblin Outposts: ${npcCounts.goblin_outpost || 0}`);
  console.log(`   🐉 Dragon Lairs:    ${npcCounts.dragon_lair || 0}`);
  console.log(`   Total NPCs: ${npcs.length}`);
  console.log('');
  console.log('🏞️ Land Parcels:');
  console.log(`   🌾 Farms:     ${landCounts.farm || 0}`);
  console.log(`   ⛏️  Mines:     ${landCounts.mine || 0}`);
  console.log(`   💰 Gold Mines: ${landCounts.goldmine || 0}`);
  console.log(`   🏰 Forts:     ${landCounts.fort || 0}`);
  console.log(`   Total Lands: ${Object.values(landCounts).reduce((a, b) => a + b, 0)}`);

  await db.destroy();
}

regenerateMap().catch((err) => {
  console.error('❌ Map regeneration failed:', err);
  process.exit(1);
});
