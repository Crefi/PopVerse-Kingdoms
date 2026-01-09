import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create enum types
  await knex.raw(`
    CREATE TYPE faction_type AS ENUM ('cinema', 'otaku', 'arcade');
    CREATE TYPE element_type AS ENUM ('fire', 'wind', 'water');
    CREATE TYPE hero_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');
    CREATE TYPE terrain_type AS ENUM ('plains', 'mountain', 'lake', 'forest', 'resource');
    CREATE TYPE building_type AS ENUM ('hq', 'farm', 'mine', 'barracks', 'vault', 'hospital', 'academy');
    CREATE TYPE battle_type AS ENUM ('pvp', 'pve', 'arena', 'conquest', 'rally');
    CREATE TYPE arena_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend');
    CREATE TYPE guild_role AS ENUM ('leader', 'officer', 'member');
    CREATE TYPE march_type AS ENUM ('attack', 'scout', 'rally', 'return');
    CREATE TYPE npc_type AS ENUM ('bandit_camp', 'goblin_outpost', 'dragon_lair');
  `);

  // Players table
  await knex.schema.createTable('players', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('discord_id').unique().notNullable();
    table.string('username', 32).notNullable();
    table.specificType('faction', 'faction_type').notNullable();
    table.integer('coord_x').notNullable();
    table.integer('coord_y').notNullable();
    table.jsonb('resources').notNullable().defaultTo('{"food":1000,"iron":500,"gold":200}');
    table.integer('diamonds').notNullable().defaultTo(100);
    table.integer('arena_rating').notNullable().defaultTo(1000);
    table.integer('arena_tokens').notNullable().defaultTo(10);
    table.integer('prestige_points').notNullable().defaultTo(0);
    table.timestamp('protection_until').nullable();
    table.timestamp('last_active').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_arena_token_regen').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('discord_id');
    table.index('faction');
    table.index(['coord_x', 'coord_y']);
    table.index('arena_rating');
  });

  // Guilds table
  await knex.schema.createTable('guilds', (table) => {
    table.bigIncrements('id').primary();
    table.string('name', 50).unique().notNullable();
    table.string('tag', 5).unique().notNullable();
    table.bigInteger('leader_id').references('id').inTable('players').onDelete('SET NULL');
    table.string('discord_channel_id').nullable();
    table.jsonb('treasury').notNullable().defaultTo('{"food":0,"iron":0,"gold":0}');
    table.boolean('is_starter_guild').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('name');
    table.index('leader_id');
  });

  // Guild members table
  await knex.schema.createTable('guild_members', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('guild_id').references('id').inTable('guilds').onDelete('CASCADE').notNullable();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.specificType('role', 'guild_role').notNullable().defaultTo('member');
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['guild_id', 'player_id']);
    table.index('player_id');
  });

  // Heroes table
  await knex.schema.createTable('heroes', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('name', 50).notNullable();
    table.specificType('faction', 'faction_type').notNullable();
    table.specificType('element', 'element_type').notNullable();
    table.specificType('rarity', 'hero_rarity').notNullable();
    table.smallint('level').notNullable().defaultTo(1);
    table.integer('experience').notNullable().defaultTo(0);
    table.integer('attack').notNullable();
    table.integer('defense').notNullable();
    table.integer('speed').notNullable();
    table.integer('hp').notNullable();
    table.jsonb('skills').notNullable().defaultTo('[]');
    table.jsonb('gear').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('player_id');
    table.index(['player_id', 'name']);
  });

  // Hero shards table
  await knex.schema.createTable('hero_shards', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('hero_name', 50).notNullable();
    table.integer('count').notNullable().defaultTo(0);

    table.unique(['player_id', 'hero_name']);
  });

  // Buildings table
  await knex.schema.createTable('buildings', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.specificType('type', 'building_type').notNullable();
    table.smallint('level').notNullable().defaultTo(1);
    table.timestamp('upgrade_started_at').nullable();
    table.timestamp('upgrade_completes_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['player_id', 'type']);
    table.index('player_id');
  });

  // Troops table
  await knex.schema.createTable('troops', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.smallint('tier').notNullable();
    table.integer('count').notNullable().defaultTo(0);
    table.integer('wounded').notNullable().defaultTo(0);

    table.unique(['player_id', 'tier']);
    table.index('player_id');
  });

  // Map tiles table
  await knex.schema.createTable('map_tiles', (table) => {
    table.integer('x').notNullable();
    table.integer('y').notNullable();
    table.specificType('terrain', 'terrain_type').notNullable();
    table.bigInteger('occupant_id').references('id').inTable('players').onDelete('SET NULL');
    table.bigInteger('npc_id').nullable();
    table.bigInteger('land_parcel_id').nullable();
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.primary(['x', 'y']);
    table.index('occupant_id');
    table.index('land_parcel_id');
  });

  // Land parcels table
  await knex.schema.createTable('land_parcels', (table) => {
    table.bigIncrements('id').primary();
    table.string('name', 50).notNullable();
    table.string('type', 20).notNullable();
    table.integer('min_x').notNullable();
    table.integer('min_y').notNullable();
    table.integer('max_x').notNullable();
    table.integer('max_y').notNullable();
    table.bigInteger('owner_player_id').references('id').inTable('players').onDelete('SET NULL');
    table.bigInteger('owner_guild_id').references('id').inTable('guilds').onDelete('SET NULL');
    table.jsonb('bonuses').notNullable().defaultTo('{}');
    table.integer('purchase_cost').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('owner_player_id');
    table.index('owner_guild_id');
  });

  // Add foreign key for land_parcel_id in map_tiles
  await knex.schema.alterTable('map_tiles', (table) => {
    table.foreign('land_parcel_id').references('id').inTable('land_parcels').onDelete('SET NULL');
  });

  // NPCs table
  await knex.schema.createTable('npcs', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('type', 'npc_type').notNullable();
    table.string('name', 50).notNullable();
    table.integer('coord_x').notNullable();
    table.integer('coord_y').notNullable();
    table.integer('power').notNullable();
    table.jsonb('troops').notNullable();
    table.jsonb('rewards').notNullable();
    table.timestamp('respawn_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['coord_x', 'coord_y']);
  });

  // Add foreign key for npc_id in map_tiles
  await knex.schema.alterTable('map_tiles', (table) => {
    table.foreign('npc_id').references('id').inTable('npcs').onDelete('SET NULL');
  });

  // Marches table
  await knex.schema.createTable('marches', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.specificType('type', 'march_type').notNullable();
    table.integer('from_x').notNullable();
    table.integer('from_y').notNullable();
    table.integer('to_x').notNullable();
    table.integer('to_y').notNullable();
    table.bigInteger('hero_id').references('id').inTable('heroes').onDelete('SET NULL');
    table.jsonb('troops').notNullable();
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('arrives_at').notNullable();
    table.boolean('completed').notNullable().defaultTo(false);

    table.index('player_id');
    table.index('arrives_at');
    table.index(['to_x', 'to_y']);
  });

  // Battles table
  await knex.schema.createTable('battles', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('type', 'battle_type').notNullable();
    table.bigInteger('attacker_id').references('id').inTable('players').onDelete('SET NULL');
    table.bigInteger('defender_id').references('id').inTable('players').onDelete('SET NULL');
    table.bigInteger('npc_id').references('id').inTable('npcs').onDelete('SET NULL');
    table.integer('location_x').notNullable();
    table.integer('location_y').notNullable();
    table.jsonb('attacker_army').notNullable();
    table.jsonb('defender_army').notNullable();
    table.jsonb('result').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('attacker_id');
    table.index('defender_id');
    table.index('created_at');
  });

  // Arena defense teams table
  await knex.schema.createTable('arena_defenses', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').unique().notNullable();
    table.bigInteger('hero1_id').references('id').inTable('heroes').onDelete('SET NULL');
    table.bigInteger('hero2_id').references('id').inTable('heroes').onDelete('SET NULL');
    table.bigInteger('hero3_id').references('id').inTable('heroes').onDelete('SET NULL');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Research table
  await knex.schema.createTable('research', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('category', 30).notNullable();
    table.smallint('level').notNullable().defaultTo(0);
    table.timestamp('research_started_at').nullable();
    table.timestamp('research_completes_at').nullable();

    table.unique(['player_id', 'category']);
    table.index('player_id');
  });

  // Daily quests table
  await knex.schema.createTable('daily_quests', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('quest_type', 30).notNullable();
    table.integer('target').notNullable();
    table.integer('progress').notNullable().defaultTo(0);
    table.boolean('claimed').notNullable().defaultTo(false);
    table.date('quest_date').notNullable();

    table.unique(['player_id', 'quest_type', 'quest_date']);
    table.index(['player_id', 'quest_date']);
  });

  // Login rewards table
  await knex.schema.createTable('login_rewards', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.date('login_date').notNullable();
    table.integer('streak_day').notNullable().defaultTo(1);
    table.boolean('claimed').notNullable().defaultTo(false);

    table.unique(['player_id', 'login_date']);
    table.index('player_id');
  });

  // Fog of war table
  await knex.schema.createTable('fog_of_war', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.integer('x').notNullable();
    table.integer('y').notNullable();
    table.timestamp('explored_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['player_id', 'x', 'y']);
    table.index('player_id');
  });

  // Conquest events table
  await knex.schema.createTable('conquest_events', (table) => {
    table.bigIncrements('id').primary();
    table.timestamp('starts_at').notNullable();
    table.timestamp('ends_at').notNullable();
    table.jsonb('control_points').notNullable();
    table.jsonb('scores').notNullable().defaultTo('{}');
    table.boolean('completed').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('starts_at');
  });

  // Seasons table
  await knex.schema.createTable('seasons', (table) => {
    table.bigIncrements('id').primary();
    table.integer('season_number').notNullable();
    table.timestamp('starts_at').notNullable();
    table.timestamp('ends_at').notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.jsonb('hall_of_fame').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('active');
  });

  // Tutorial progress table
  await knex.schema.createTable('tutorial_progress', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').unique().notNullable();
    table.integer('current_step').notNullable().defaultTo(0);
    table.jsonb('completed_steps').notNullable().defaultTo('[]');
    table.jsonb('claimed_rewards').notNullable().defaultTo('[]');
    table.boolean('tutorial_completed').notNullable().defaultTo(false);
    table.timestamp('completed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index('player_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('tutorial_progress');
  await knex.schema.dropTableIfExists('seasons');
  await knex.schema.dropTableIfExists('conquest_events');
  await knex.schema.dropTableIfExists('fog_of_war');
  await knex.schema.dropTableIfExists('login_rewards');
  await knex.schema.dropTableIfExists('daily_quests');
  await knex.schema.dropTableIfExists('research');
  await knex.schema.dropTableIfExists('arena_defenses');
  await knex.schema.dropTableIfExists('battles');
  await knex.schema.dropTableIfExists('marches');
  await knex.schema.dropTableIfExists('npcs');
  await knex.schema.dropTableIfExists('land_parcels');
  await knex.schema.dropTableIfExists('map_tiles');
  await knex.schema.dropTableIfExists('troops');
  await knex.schema.dropTableIfExists('buildings');
  await knex.schema.dropTableIfExists('hero_shards');
  await knex.schema.dropTableIfExists('heroes');
  await knex.schema.dropTableIfExists('guild_members');
  await knex.schema.dropTableIfExists('guilds');
  await knex.schema.dropTableIfExists('players');

  // Drop enum types
  await knex.raw(`
    DROP TYPE IF EXISTS npc_type;
    DROP TYPE IF EXISTS march_type;
    DROP TYPE IF EXISTS guild_role;
    DROP TYPE IF EXISTS arena_tier;
    DROP TYPE IF EXISTS battle_type;
    DROP TYPE IF EXISTS building_type;
    DROP TYPE IF EXISTS terrain_type;
    DROP TYPE IF EXISTS hero_rarity;
    DROP TYPE IF EXISTS element_type;
    DROP TYPE IF EXISTS faction_type;
  `);
}
