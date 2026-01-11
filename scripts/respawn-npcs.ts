/**
 * Respawn all NPCs on the map
 * This script will:
 * 1. Clear all existing NPCs
 * 2. Regenerate NPCs across the map
 * 3. Link them to map tiles
 * 
 * Usage: npx tsx scripts/respawn-npcs.ts
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

const MAP_SIZE = 100;

// NPC names by type
const NPC_NAMES = {
  bandit_camp: ['Bandit Hideout', 'Outlaw Camp', 'Raider Den', 'Thief Refuge', 'Brigand Base'],
  goblin_outpost: ['Goblin Warren', 'Greenskin Camp', 'Goblin Nest', 'Orc Outpost', 'Troll Cave'],
  dragon_lair: ["Dragon's Den", 'Wyrm Lair', 'Drake Nest', 'Serpent Cave', 'Fire Pit'],
};

type NpcType = 'bandit_camp' | 'goblin_outpost' | 'dragon_lair';

interface NPCData {
  type: string;
  name: string;
  coord_x: number;
  coord_y: number;
  power: number;
  troops: string;
  rewards: string;
}

// Seeded random function for consistent NPC generation
const seededRandom = (x: number, y: number, offset: number = 0): number => {
  const seed = ((x * 1000 + y + offset) * 9973) % 2147483647;
  return ((seed * 16807) % 2147483647) / 2147483647;
};

async function respawnNpcs() {
  console.log('🔄 Respawning all NPCs...\n');

  // Get all tiles that don't have players
  const availableTiles = await db('map_tiles')
    .select('x', 'y', 'terrain')
    .whereNull('occupant_id');

  console.log(`Found ${availableTiles.length} available tiles`);

  // Clear existing NPCs
  console.log('Clearing existing NPCs...');
  await db('map_tiles').update({ npc_id: null });
  await db('npcs').del();

  const npcs: NPCData[] = [];

  // Generate NPCs based on location
  for (const tile of availableTiles) {
    // Only spawn on plains or forest
    if (tile.terrain !== 'plains' && tile.terrain !== 'forest') continue;

    const x = tile.x;
    const y = tile.y;
    const random = seededRandom(x, y, 12345);
    const centerX = MAP_SIZE / 2;
    const centerY = MAP_SIZE / 2;
    const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

    let npcChance: number;
    let npcType: NpcType;
    let basePower: number;

    if (distFromCenter < 20) {
      // Center - dragon lairs, very strong
      npcChance = 0.03;
      npcType = random < 0.3 ? 'dragon_lair' : random < 0.6 ? 'goblin_outpost' : 'bandit_camp';
      basePower = npcType === 'dragon_lair' ? 8000 : npcType === 'goblin_outpost' ? 5000 : 3000;
    } else if (distFromCenter < 35) {
      // Middle - goblin outposts, medium
      npcChance = 0.05;
      npcType = random < 0.2 ? 'dragon_lair' : random < 0.5 ? 'goblin_outpost' : 'bandit_camp';
      basePower = npcType === 'dragon_lair' ? 5000 : npcType === 'goblin_outpost' ? 2500 : 1500;
    } else {
      // Outer - bandit camps, weak (good for new players)
      npcChance = 0.06;
      npcType = random < 0.05 ? 'goblin_outpost' : 'bandit_camp';
      basePower = npcType === 'goblin_outpost' ? 1000 : 500;
    }

    if (random > npcChance) continue;

    // Vary power within range
    const powerVariance = seededRandom(x, y, 54321);
    const power = Math.floor(basePower * (0.7 + powerVariance * 0.6));

    // Generate troops based on power
    const troops = {
      t1: Math.floor(power / 10),
      t2: Math.floor(power / 50),
      t3: Math.floor(power / 200),
    };

    // Generate rewards based on power
    const rewards = {
      food: Math.floor(power * 2),
      iron: Math.floor(power * 1.5),
      gold: Math.floor(power * 0.5),
      xp: Math.floor(power * 0.3),
      shardChance: Math.min(0.3, power / 30000),
    };

    const names = NPC_NAMES[npcType];
    const nameIndex = Math.floor(seededRandom(x, y, 99999) * names.length);

    npcs.push({
      type: npcType,
      name: names[nameIndex],
      coord_x: x,
      coord_y: y,
      power,
      troops: JSON.stringify(troops),
      rewards: JSON.stringify(rewards),
    });
  }

  console.log(`Generated ${npcs.length} NPCs`);

  // Insert NPCs
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

  // Update map tiles with NPC references
  console.log('Linking NPCs to map tiles...');
  for (const [coords, npcId] of npcIdMap) {
    const [x, y] = coords.split(',').map(Number);
    await db('map_tiles')
      .where({ x, y })
      .update({ npc_id: npcId });
  }

  // Count NPC types
  const npcCounts = npcs.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n✅ NPC respawn complete!');
  console.log('');
  console.log('👹 NPC Distribution:');
  console.log(`   🏴 Bandit Camps:    ${npcCounts.bandit_camp || 0}`);
  console.log(`   👺 Goblin Outposts: ${npcCounts.goblin_outpost || 0}`);
  console.log(`   🐉 Dragon Lairs:    ${npcCounts.dragon_lair || 0}`);
  console.log(`   Total NPCs: ${npcs.length}`);

  await db.destroy();
}

respawnNpcs().catch(console.error);
