/**
 * Generate Test Players Script
 * Creates fake players near a specific location for testing
 * 
 * Usage: npx ts-node scripts/generate-test-players.ts
 */

import dotenv from 'dotenv';
import knex from 'knex';

dotenv.config({ path: '.env.dev' });

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'popverse_kingdoms_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
});

const TEST_PLAYERS = [
  { username: 'TestWarrior', faction: 'cinema', offset: { x: 2, y: 1 } },
  { username: 'NinjaPlayer', faction: 'otaku', offset: { x: -1, y: 3 } },
  { username: 'ArcadeMaster', faction: 'arcade', offset: { x: 3, y: -2 } },
  { username: 'FireLord99', faction: 'cinema', offset: { x: -2, y: -1 } },
  { username: 'WindRunner', faction: 'otaku', offset: { x: 1, y: -3 } },
];

async function generateTestPlayers(): Promise<void> {
  console.log('🎮 Generating test players...\n');

  // Find the first real player to spawn near them
  const realPlayer = await db('players')
    .select('coord_x', 'coord_y')
    .whereNotIn('username', TEST_PLAYERS.map(p => p.username))
    .first();

  if (!realPlayer) {
    console.log('❌ No real player found. Use /begin first, then run this script.');
    return;
  }

  const baseX = realPlayer.coord_x;
  const baseY = realPlayer.coord_y;
  console.log(`📍 Found player at (${baseX}, ${baseY}). Spawning test players nearby...\n`);

  for (const testPlayer of TEST_PLAYERS) {
    const x = baseX + testPlayer.offset.x;
    const y = baseY + testPlayer.offset.y;

    // Check if username already exists
    const existing = await db('players').where('username', testPlayer.username).first();
    if (existing) {
      console.log(`  ⏭️  ${testPlayer.username} already exists, skipping`);
      continue;
    }

    // Check if tile is available
    const tile = await db('map_tiles').where({ x, y }).first();
    if (tile?.occupant_id) {
      console.log(`  ⏭️  Tile (${x},${y}) occupied, skipping ${testPlayer.username}`);
      continue;
    }

    // Create fake discord ID (numeric for bigint column)
    const fakeDiscordId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;

    // Insert player
    const [insertedPlayer] = await db('players')
      .insert({
        discord_id: fakeDiscordId,
        username: testPlayer.username,
        faction: testPlayer.faction,
        coord_x: x,
        coord_y: y,
        resources: JSON.stringify({ food: 5000, iron: 2500, gold: 1000 }),
        diamonds: 500,
        arena_rating: 1000 + Math.floor(Math.random() * 500),
        arena_tokens: 10,
        prestige_points: 0,
        protection_until: new Date(Date.now() + 24 * 60 * 60 * 1000),
        last_active: new Date(),
        last_arena_token_regen: new Date(),
      })
      .returning('id');

    // Create or update map tile
    if (tile) {
      await db('map_tiles').where({ x, y }).update({ occupant_id: insertedPlayer.id });
    } else {
      await db('map_tiles').insert({
        x,
        y,
        terrain: 'plains',
        occupant_id: insertedPlayer.id,
      });
    }

    // Add some troops
    await db('troops').insert([
      { player_id: insertedPlayer.id, tier: 1, count: 50 + Math.floor(Math.random() * 100), wounded: 0 },
      { player_id: insertedPlayer.id, tier: 2, count: 20 + Math.floor(Math.random() * 30), wounded: 0 },
    ]);

    // Add a hero
    const heroNames: Record<string, string> = {
      cinema: 'John McClane',
      otaku: 'Naruto Uzumaki',
      arcade: 'Mario',
    };
    await db('heroes').insert({
      player_id: insertedPlayer.id,
      name: heroNames[testPlayer.faction],
      faction: testPlayer.faction,
      element: testPlayer.faction === 'cinema' ? 'fire' : testPlayer.faction === 'otaku' ? 'wind' : 'water',
      rarity: 'common',
      level: 1 + Math.floor(Math.random() * 5),
      experience: 0,
      attack: 100,
      defense: 80,
      speed: 90,
      hp: 500,
      skills: JSON.stringify([]),
      gear: JSON.stringify({}),
    });

    // Add HQ building
    await db('buildings').insert({
      player_id: insertedPlayer.id,
      type: 'hq',
      level: 1 + Math.floor(Math.random() * 3),
    });

    const factionEmoji = testPlayer.faction === 'cinema' ? '🔴' : testPlayer.faction === 'otaku' ? '🟢' : '🔵';
    console.log(`  ✅ Created ${factionEmoji} ${testPlayer.username} at (${x}, ${y})`);
  }

  console.log('\n✅ Test players generated!');
  console.log('   Use /map to see them on the map.');
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Generate Test Players for Testing    ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    await generateTestPlayers();
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
