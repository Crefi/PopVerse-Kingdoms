/**
 * Setup a test user with max resources, all heroes, max buildings, etc.
 * Usage: npx tsx scripts/setup-test-user.ts <discord_id>
 * Example: npx tsx scripts/setup-test-user.ts 123456789012345678
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import knex from 'knex';
import knexConfig from '../knexfile.js';

const db = knex(knexConfig.development);

// All heroes from the game
const ALL_HEROES = [
  // Cinema (Fire)
  { name: 'Ethan Hunt', faction: 'cinema', element: 'fire', rarity: 'common', attack: 55, defense: 40, speed: 30, hp: 200 },
  { name: 'James Bond', faction: 'cinema', element: 'fire', rarity: 'rare', attack: 80, defense: 60, speed: 50, hp: 300 },
  { name: 'John Wick', faction: 'cinema', element: 'fire', rarity: 'epic', attack: 110, defense: 75, speed: 65, hp: 450 },
  { name: 'T-800 Terminator', faction: 'cinema', element: 'fire', rarity: 'legendary', attack: 160, defense: 130, speed: 70, hp: 750 },
  
  // Anime (Wind)
  { name: 'Naruto Uzumaki', faction: 'anime', element: 'wind', rarity: 'common', attack: 50, defense: 35, speed: 45, hp: 200 },
  { name: 'Edward Elric', faction: 'anime', element: 'wind', rarity: 'rare', attack: 75, defense: 55, speed: 55, hp: 280 },
  { name: 'Son Goku', faction: 'anime', element: 'wind', rarity: 'epic', attack: 105, defense: 70, speed: 80, hp: 420 },
  { name: 'Saitama', faction: 'anime', element: 'wind', rarity: 'legendary', attack: 200, defense: 100, speed: 90, hp: 600 },
  
  // Gamer (Water)
  { name: 'Master Chief', faction: 'gamer', element: 'water', rarity: 'common', attack: 45, defense: 50, speed: 30, hp: 220 },
  { name: 'Kratos', faction: 'gamer', element: 'water', rarity: 'rare', attack: 70, defense: 70, speed: 45, hp: 320 },
  { name: 'Geralt of Rivia', faction: 'gamer', element: 'water', rarity: 'epic', attack: 95, defense: 90, speed: 60, hp: 480 },
  { name: 'Solid Snake', faction: 'gamer', element: 'water', rarity: 'legendary', attack: 140, defense: 140, speed: 75, hp: 800 },
];

async function setupTestUser(discordId: string) {
  console.log(`Setting up test user with Discord ID: ${discordId}`);

  // Check if player exists
  let player = await db('players').where('discord_id', discordId).first();

  if (!player) {
    console.log('Player not found. Please use /begin first to create your account.');
    process.exit(1);
  }

  console.log(`Found player: ${player.username} (ID: ${player.id})`);

  await db.transaction(async (trx) => {
    // 1. Max resources and diamonds
    console.log('Setting max resources...');
    await trx('players')
      .where('id', player.id)
      .update({
        resources: JSON.stringify({
          food: 999999,
          iron: 999999,
          gold: 999999,
        }),
        diamonds: 99999,
        arena_rating: 2500, // Legend tier
        arena_tokens: 99,
        prestige_points: 10000,
        protection_until: null, // Remove protection so you can attack
      });

    // 2. Max all buildings
    console.log('Maxing all buildings...');
    const buildingTypes = ['hq', 'farm', 'mine', 'barracks', 'vault', 'hospital', 'academy'];
    
    for (const type of buildingTypes) {
      const existing = await trx('buildings')
        .where('player_id', player.id)
        .where('type', type)
        .first();

      if (existing) {
        await trx('buildings')
          .where('id', existing.id)
          .update({ level: 25, upgrade_started_at: null, upgrade_completes_at: null });
      } else {
        await trx('buildings').insert({
          player_id: player.id,
          type,
          level: 25,
        });
      }
    }

    // 3. Max troops
    console.log('Setting max troops...');
    for (let tier = 1; tier <= 4; tier++) {
      const existing = await trx('troops')
        .where('player_id', player.id)
        .where('tier', tier)
        .first();

      if (existing) {
        await trx('troops')
          .where('id', existing.id)
          .update({ count: 5000, wounded: 0 });
      } else {
        await trx('troops').insert({
          player_id: player.id,
          tier,
          count: 5000,
          wounded: 0,
        });
      }
    }

    // 4. Add all heroes at max level
    console.log('Adding all heroes at max level...');
    
    // Delete existing heroes first
    await trx('heroes').where('player_id', player.id).delete();

    for (const hero of ALL_HEROES) {
      await trx('heroes').insert({
        player_id: player.id,
        name: hero.name,
        faction: hero.faction,
        element: hero.element,
        rarity: hero.rarity,
        level: 50,
        experience: 999999,
        attack: hero.attack * 2, // Boosted stats for max level
        defense: hero.defense * 2,
        speed: hero.speed,
        hp: hero.hp * 2,
        skills: JSON.stringify([]),
        gear: JSON.stringify({}),
      });
    }

    // 5. Max all research
    console.log('Maxing all research...');
    const researchCategories = [
      { category: 'troop_training', maxLevel: 5 },
      { category: 'resource_boost', maxLevel: 5 },
      { category: 'march_speed', maxLevel: 5 },
      { category: 'combat_power', maxLevel: 5 },
      { category: 'hero_xp', maxLevel: 3 },
      { category: 'army_capacity', maxLevel: 3 },
    ];

    await trx('research').where('player_id', player.id).delete();

    for (const r of researchCategories) {
      await trx('research').insert({
        player_id: player.id,
        category: r.category,
        level: r.maxLevel,
        research_started_at: null,
        research_completes_at: null,
      });
    }

    // 6. Complete tutorial
    console.log('Completing tutorial...');
    const tutorialExists = await trx('tutorial_progress')
      .where('player_id', player.id)
      .first();

    if (tutorialExists) {
      await trx('tutorial_progress')
        .where('player_id', player.id)
        .update({
          current_step: 10,
          tutorial_completed: true,
          completed_at: new Date(),
        });
    } else {
      await trx('tutorial_progress').insert({
        player_id: player.id,
        current_step: 10,
        completed_steps: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        claimed_rewards: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        tutorial_completed: true,
        completed_at: new Date(),
      });
    }

    // 7. Add hero shards
    console.log('Adding hero shards...');
    await trx('hero_shards').where('player_id', player.id).delete();
    
    for (const hero of ALL_HEROES) {
      await trx('hero_shards').insert({
        player_id: player.id,
        hero_name: hero.name,
        count: 100,
      });
    }

    // 8. Setup arena defense
    console.log('Setting up arena defense...');
    const heroes = await trx('heroes')
      .where('player_id', player.id)
      .orderBy('attack', 'desc')
      .limit(3);

    if (heroes.length >= 3) {
      const existingDefense = await trx('arena_defenses')
        .where('player_id', player.id)
        .first();

      if (existingDefense) {
        await trx('arena_defenses')
          .where('player_id', player.id)
          .update({
            hero1_id: heroes[0].id,
            hero2_id: heroes[1].id,
            hero3_id: heroes[2].id,
          });
      } else {
        await trx('arena_defenses').insert({
          player_id: player.id,
          hero1_id: heroes[0].id,
          hero2_id: heroes[1].id,
          hero3_id: heroes[2].id,
        });
      }
    }
  });

  console.log('\n✅ Test user setup complete!');
  console.log('Your account now has:');
  console.log('  - 999,999 of each resource');
  console.log('  - 99,999 diamonds');
  console.log('  - All buildings at level 25');
  console.log('  - 5,000 troops of each tier (T1-T4)');
  console.log('  - All 12 heroes at level 50');
  console.log('  - All research maxed');
  console.log('  - Tutorial completed');
  console.log('  - Arena rating: 2500 (Legend)');
  console.log('  - 100 shards for each hero');

  await db.destroy();
}

// Get Discord ID from command line
const discordId = process.argv[2];

if (!discordId) {
  console.log('Usage: npx tsx scripts/setup-test-user.ts <discord_id>');
  console.log('Example: npx tsx scripts/setup-test-user.ts 123456789012345678');
  console.log('\nTo find your Discord ID:');
  console.log('1. Enable Developer Mode in Discord settings');
  console.log('2. Right-click your username and select "Copy ID"');
  process.exit(1);
}

setupTestUser(discordId).catch(console.error);
