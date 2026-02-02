import type { Knex } from 'knex';

/**
 * Generate the 100x100 world map with proper zone distribution
 * 
 * Map Layout (based on distance from center):
 * - CENTER (10%): The Temple zone - radius 0-15 tiles from center
 * - RESOURCE ZONE (20%): Higher yields, no shields - radius 15-30 tiles
 * - SPAWN ZONE (70%): Safe plains with shields - radius 30-70 tiles (outer area)
 * 
 * Mountains form natural borders OUTSIDE the map (at edges)
 * Forests mark zone boundaries with strategic entrances
 * NO water tiles
 */
export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('map_tiles').del();
  await knex('npcs').del();
  await knex('land_parcels').del();

  console.log('🗺️  Generating world map (100x100) with zone system...');

  const MAP_SIZE = 100;
  const CENTER = MAP_SIZE / 2;
  
  // Zone radiuses (distance from center)
  const TEMPLE_RADIUS = 15;      // Center 10%
  const RESOURCE_RADIUS = 30;     // Resource zone 20%
  const SPAWN_RADIUS = 70;        // Spawn zone 70% (everything beyond resource zone)
  
  interface TileData {
    x: number;
    y: number;
    terrain: string;
    zone: string;
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

  const tiles: TileData[] = [];
  const npcs: NPCData[] = [];

  // Simple hash-based random that avoids patterns
  const hashRandom = (x: number, y: number, seed: number = 0): number => {
    let h = seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (Math.abs(h) % 10000) / 10000;
  };

  // Perlin-like noise for smoother distribution
  const smoothNoise = (x: number, y: number, scale: number = 10): number => {
    const sx = x / scale;
    const sy = y / scale;
    const v1 = hashRandom(Math.floor(sx), Math.floor(sy), 12345);
    const v2 = hashRandom(Math.floor(sx) + 1, Math.floor(sy), 12345);
    const v3 = hashRandom(Math.floor(sx), Math.floor(sy) + 1, 12345);
    const v4 = hashRandom(Math.floor(sx) + 1, Math.floor(sy) + 1, 12345);
    const fx = sx - Math.floor(sx);
    const fy = sy - Math.floor(sy);
    const i1 = v1 * (1 - fx) + v2 * fx;
    const i2 = v3 * (1 - fx) + v4 * fx;
    return i1 * (1 - fy) + i2 * fy;
  };

  // Get distance from map edge (0 = at edge, 50 = at center)
  const distanceFromEdge = (x: number, y: number): number => {
    const distFromLeft = x;
    const distFromRight = MAP_SIZE - 1 - x;
    const distFromTop = y;
    const distFromBottom = MAP_SIZE - 1 - y;
    return Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
  };

  // Get distance from center
  const distanceFromCenter = (x: number, y: number): number => {
    return Math.sqrt((x - CENTER) ** 2 + (y - CENTER) ** 2);
  };

  // Determine which zone a tile belongs to
  const getZone = (x: number, y: number): string => {
    const centerDist = distanceFromCenter(x, y);
    
    if (centerDist <= TEMPLE_RADIUS) return 'temple';
    if (centerDist <= RESOURCE_RADIUS) return 'resource';
    return 'spawn';
  };

  // Check if position is near zone boundary (for forest walls)
  const isNearZoneBoundary = (x: number, y: number): { isNear: boolean; isEntrance: boolean } => {
    const centerDist = distanceFromCenter(x, y);
    
    // Check if near temple boundary
    const nearTempleBoundary = Math.abs(centerDist - TEMPLE_RADIUS) < 1.5;
    const nearResourceBoundary = Math.abs(centerDist - RESOURCE_RADIUS) < 1.5;
    
    if (!nearTempleBoundary && !nearResourceBoundary) {
      return { isNear: false, isEntrance: false };
    }
    
    // Create entrances at cardinal directions (N, S, E, W) and diagonals (NE, SE, SW, NW)
    const angle = Math.atan2(y - CENTER, x - CENTER);
    const angleDegrees = (angle * 180 / Math.PI + 360) % 360;
    
    // 8 entrances at 45-degree intervals, each entrance is ~15 degrees wide
    const entranceAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    const entranceWidth = 15;
    
    const isEntrance = entranceAngles.some(entranceAngle => {
      const diff = Math.abs(((angleDegrees - entranceAngle + 180) % 360) - 180);
      return diff < entranceWidth;
    });
    
    return { isNear: true, isEntrance };
  };

  // Terrain generation based on zones with forest boundaries
  const getTerrainAt = (x: number, y: number): string => {
    const edgeDist = distanceFromEdge(x, y);
    const centerDist = distanceFromCenter(x, y);
    const zone = getZone(x, y);
    const rand = hashRandom(x, y, 12345);
    
    // Use smooth noise for more natural resource distribution
    const resourceNoise = smoothNoise(x, y, 15);
    const forestNoise = smoothNoise(x, y, 12);
    
    // MOUNTAINS: Thick border at map edges (2-3 tiles thick) - visible barrier
    if (edgeDist === 0) {
      return 'mountain';
    }
    if (edgeDist === 1) {
      if (rand < 0.8) return 'mountain'; // 80% mountains at edge-1
    }
    if (edgeDist === 2) {
      if (rand < 0.4) return 'mountain'; // 40% mountains at edge-2
    }
    
    // FOREST ZONE BOUNDARIES with entrances
    const boundary = isNearZoneBoundary(x, y);
    if (boundary.isNear && !boundary.isEntrance) {
      // Forest wall with some gaps for natural look
      if (rand > 0.15) return 'forest';
    }
    
    // Scattered forests for variety (less than before since we have zone boundaries)
    if (forestNoise > 0.88) return 'forest';
    
    // ZONE-BASED TERRAIN GENERATION - Use random for scattered resources (not clustered)
    // Further reduced resource density by 50%: ~300-400 total resources across the map
    const resourceRand = hashRandom(x, y, 67890);
    
    if (zone === 'temple') {
      // CENTER (Temple Zone): Resources scattered randomly
      if (centerDist <= 5) {
        // Inner 5 tiles - mostly plains for Temple area
        if (resourceRand < 0.04) return 'resource'; // 4% scattered (50% reduction)
        return 'plains';
      }
      // Rest of temple zone - moderate resources scattered
      if (resourceRand < 0.05) return 'resource'; // 5% scattered (50% reduction)
      return 'plains';
    }
    
    if (zone === 'resource') {
      // RESOURCE ZONE: Higher resource density, randomly scattered
      if (resourceRand < 0.06) return 'resource'; // 6% scattered (50% reduction)
      return 'plains';
    }
    
    // SPAWN ZONE: Fewer resources, randomly scattered
    if (resourceRand < 0.025) return 'resource'; // 2.5% scattered (50% reduction)
    return 'plains';
  };

  // NPC names by type
  const NPC_NAMES = {
    bandit_camp: ['Bandit Hideout', 'Outlaw Camp', 'Raider Den', 'Thief Refuge', 'Brigand Base'],
    goblin_outpost: ['Goblin Warren', 'Greenskin Camp', 'Goblin Nest', 'Orc Outpost', 'Troll Cave'],
    dragon_lair: ['Dragon\'s Den', 'Wyrm Lair', 'Drake Nest', 'Serpent Cave', 'Fire Pit'],
  };

  // Generate NPC based on zone with better distribution across all zones
  const generateNPC = (x: number, y: number, terrain: string, zone: string): NPCData | null => {
    if (terrain !== 'plains' && terrain !== 'forest') return null;

    const centerDist = distanceFromCenter(x, y);
    const rand = hashRandom(x, y, 77777);
    const typeRand = hashRandom(x, y, 88888);

    let npcType: 'bandit_camp' | 'goblin_outpost' | 'dragon_lair';
    let basePower: number;

    if (zone === 'temple') {
      // Temple zone - strongest NPCs, better distribution
      if (centerDist <= 5) {
        // Very center - Dragon Lairs (strongest)
        if (rand < 0.92) return null;
        npcType = 'dragon_lair';
        basePower = 15000;
      } else {
        // Outer temple zone - mixed NPCs
        if (rand < 0.88) return null;
        npcType = typeRand < 0.4 ? 'dragon_lair' : typeRand < 0.7 ? 'goblin_outpost' : 'bandit_camp';
        basePower = npcType === 'dragon_lair' ? 10000 : npcType === 'goblin_outpost' ? 6000 : 4000;
      }
    } else if (zone === 'resource') {
      // Resource zone - medium NPCs, good distribution
      if (rand < 0.90) return null;
      npcType = typeRand < 0.2 ? 'dragon_lair' : typeRand < 0.5 ? 'goblin_outpost' : 'bandit_camp';
      basePower = npcType === 'dragon_lair' ? 6000 : npcType === 'goblin_outpost' ? 3000 : 1500;
    } else {
      // Spawn zone - weakest NPCs, evenly distributed (easier for new players)
      if (rand < 0.92) return null;
      npcType = typeRand < 0.1 ? 'goblin_outpost' : 'bandit_camp';
      basePower = npcType === 'goblin_outpost' ? 1200 : 500;
    }

    const powerVariance = hashRandom(x, y, 99999);
    const power = Math.floor(basePower * (0.8 + powerVariance * 0.4));

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
      shardChance: Math.min(0.4, power / 25000),
    };

    const names = NPC_NAMES[npcType];
    const nameIndex = Math.floor(hashRandom(x, y, 44444) * names.length);

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

  // Generate all tiles and NPCs
  console.log('  Generating terrain and zones...');
  const zoneCounts = { temple: 0, resource: 0, spawn: 0 };
  
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const zone = getZone(x, y);
      const terrain = getTerrainAt(x, y);
      
      tiles.push({ x, y, terrain, zone });
      
      // Count zones (excluding mountains and edges)
      if (terrain !== 'mountain' && distanceFromEdge(x, y) > 1) {
        zoneCounts[zone as keyof typeof zoneCounts]++;
      }

      const npc = generateNPC(x, y, terrain, zone);
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
      const inserted = await knex('npcs').insert(batch).returning(['id', 'coord_x', 'coord_y']);
      for (const row of inserted) {
        npcIdMap.set(`${row.coord_x},${row.coord_y}`, row.id);
      }
    }
  }

  // Prepare tiles with NPC references
  console.log('  Inserting map tiles...');
  const tilesWithNpcs = tiles.map((tile) => ({
    x: tile.x,
    y: tile.y,
    terrain: tile.terrain,
    npc_id: npcIdMap.get(`${tile.x},${tile.y}`) || null,
  }));

  // Insert tiles in batches
  const BATCH_SIZE = 1000;
  for (let i = 0; i < tilesWithNpcs.length; i += BATCH_SIZE) {
    const batch = tilesWithNpcs.slice(i, i + BATCH_SIZE);
    await knex('map_tiles').insert(batch);
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

  // Generate land parcels
  console.log('  Generating land parcels...');
  const landParcels = await generateLandParcels(knex, tiles);

  // Calculate zone percentages
  const totalZoneTiles = zoneCounts.temple + zoneCounts.resource + zoneCounts.spawn;
  const zonePercentages = {
    temple: ((zoneCounts.temple / totalZoneTiles) * 100).toFixed(1),
    resource: ((zoneCounts.resource / totalZoneTiles) * 100).toFixed(1),
    spawn: ((zoneCounts.spawn / totalZoneTiles) * 100).toFixed(1),
  };

  console.log('\n✅ Map generation complete!');
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
  console.log(`   🌾 Farms:     ${landParcels.farm || 0}`);
  console.log(`   ⛏️  Mines:     ${landParcels.mine || 0}`);
  console.log(`   💰 Gold Mines: ${landParcels.goldmine || 0}`);
  console.log(`   🏰 Forts:     ${landParcels.fort || 0}`);
  console.log(`   Total Lands: ${Object.values(landParcels).reduce((a, b) => a + b, 0)}`);
}


/**
 * Generate land parcels distributed across all zones
 */
async function generateLandParcels(
  knex: Knex, 
  tiles: { x: number; y: number; terrain: string; zone: string }[]
): Promise<Record<string, number>> {
  const MAP_SIZE = 100;
  const CENTER = MAP_SIZE / 2;
  const LAND_TYPES = ['farm', 'mine', 'goldmine', 'fort'] as const;
  
  // Land parcel configuration - gold mines distributed across all zones
  const LAND_CONFIG = {
    farm: { count: 40, minSize: 3, maxSize: 5, baseCost: 500, name: 'Fertile Farm', zones: ['spawn', 'resource'] },
    mine: { count: 35, minSize: 3, maxSize: 4, baseCost: 600, name: 'Iron Mine', zones: ['spawn', 'resource'] },
    goldmine: { count: 25, minSize: 2, maxSize: 3, baseCost: 1200, name: 'Gold Vein', zones: ['spawn', 'resource', 'temple'] }, // Now in all zones
    fort: { count: 30, minSize: 3, maxSize: 4, baseCost: 800, name: 'Strategic Fort', zones: ['spawn', 'resource', 'temple'] },
  };

  const LAND_BONUSES = {
    farm: { food: 0.15 },
    mine: { iron: 0.15 },
    goldmine: { gold: 0.20 },
    fort: { defense: 0.10 },
  };

  const BLOCKED_TERRAIN = ['mountain', 'forest']; // Also avoid forests (zone boundaries)

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

  // Create terrain and zone lookup map
  const terrainMap = new Map<string, { terrain: string; zone: string }>();
  for (const tile of tiles) {
    terrainMap.set(`${tile.x},${tile.y}`, { terrain: tile.terrain, zone: tile.zone });
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
        if (tile && BLOCKED_TERRAIN.includes(tile.terrain)) {
          return true;
        }
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

  const distanceFromEdge = (x: number, y: number): number => {
    return Math.min(x, MAP_SIZE - 1 - x, y, MAP_SIZE - 1 - y);
  };

  // Generate parcels with even distribution across zones
  for (const type of LAND_TYPES) {
    const config = LAND_CONFIG[type];
    let attempts = 0;
    const maxAttempts = 3000;

    // Track zone distribution to ensure even spread across ALL allowed zones
    const zoneAttempts: Record<string, number> = { spawn: 0, resource: 0, temple: 0 };
    const targetPerZone = Math.floor(config.count / config.zones.length);

    while (counts[type] < config.count && attempts < maxAttempts) {
      attempts++;

      const sizeX = Math.floor(nextRandom() * (config.maxSize - config.minSize + 1)) + config.minSize;
      const sizeY = Math.floor(nextRandom() * (config.maxSize - config.minSize + 1)) + config.minSize;

      // Avoid edges and mountains (tiles 0-2 from edge)
      const minX = Math.floor(nextRandom() * (MAP_SIZE - sizeX - 6)) + 3;
      const minY = Math.floor(nextRandom() * (MAP_SIZE - sizeY - 6)) + 3;
      const maxX = minX + sizeX - 1;
      const maxY = minY + sizeY - 1;

      const zone = getZoneOfArea(minX, minY, maxX, maxY);
      
      // Check if this land type is allowed in this zone
      if (!config.zones.includes(zone as any)) continue;
      
      // Encourage VERY EVEN distribution - enforce strict limits per zone
      const maxPerZone = targetPerZone + 3; // Allow small variance
      if (zoneAttempts[zone] >= maxPerZone) continue;

      // Check if area is free and has no blocked terrain
      if (isAreaFree(minX - 2, minY - 2, maxX + 2, maxY + 2) && !hasBlockedTerrain(minX, minY, maxX, maxY)) {
        // Higher cost for land in better zones
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
        zoneAttempts[zone]++;
      }
    }
  }

  // Insert all parcels
  if (parcels.length > 0) {
    const inserted = await knex('land_parcels').insert(parcels).returning(['id', 'min_x', 'min_y', 'max_x', 'max_y']);
    
    for (const parcel of inserted) {
      await knex('map_tiles')
        .where('x', '>=', parcel.min_x)
        .where('x', '<=', parcel.max_x)
        .where('y', '>=', parcel.min_y)
        .where('y', '<=', parcel.max_y)
        .update({ land_parcel_id: parcel.id });
    }
  }

  return counts;
}