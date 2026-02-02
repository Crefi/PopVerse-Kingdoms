#!/usr/bin/env tsx
/**
 * Check NPC distribution by zone for progression analysis
 */

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

async function checkNpcZones() {
  console.log('🔍 Analyzing NPC distribution by zone...\n');

  const npcs = await db('npcs').select('type', 'power', 'coord_x', 'coord_y');

  // Categorize by zone
  const zones: Record<string, any[]> = {
    spawn: [],
    resource: [],
    temple: [],
  };

  npcs.forEach((npc: any) => {
    const centerDist = Math.sqrt(
      Math.pow(npc.coord_x - 50, 2) + Math.pow(npc.coord_y - 50, 2)
    );
    
    let zone = 'spawn';
    if (centerDist <= 15) zone = 'temple';
    else if (centerDist <= 30) zone = 'resource';
    
    zones[zone].push(npc);
  });

  // Analyze each zone
  for (const [zoneName, zoneNpcs] of Object.entries(zones)) {
    console.log(`\n📍 ${zoneName.toUpperCase()} ZONE (${zoneNpcs.length} NPCs):`);
    
    const byType: Record<string, any[]> = {};
    zoneNpcs.forEach(npc => {
      if (!byType[npc.type]) byType[npc.type] = [];
      byType[npc.type].push(npc);
    });

    for (const [type, typeNpcs] of Object.entries(byType)) {
      const powers = typeNpcs.map(n => n.power);
      const min = Math.min(...powers);
      const max = Math.max(...powers);
      const avg = Math.round(powers.reduce((a, b) => a + b, 0) / powers.length);
      
      console.log(`  ${type}: ${typeNpcs.length} NPCs`);
      console.log(`    Power: ${min} - ${max} (avg: ${avg})`);
    }
  }

  // Overall stats
  console.log('\n\n📊 OVERALL DISTRIBUTION:');
  const allTypes: Record<string, number[]> = {};
  npcs.forEach((npc: any) => {
    if (!allTypes[npc.type]) allTypes[npc.type] = [];
    allTypes[npc.type].push(npc.power);
  });

  for (const [type, powers] of Object.entries(allTypes)) {
    const min = Math.min(...powers);
    const max = Math.max(...powers);
    const avg = Math.round(powers.reduce((a, b) => a + b, 0) / powers.length);
    console.log(`  ${type}: ${powers.length} total (${min}-${max}, avg ${avg})`);
  }

  await db.destroy();
}

checkNpcZones().catch(console.error);
