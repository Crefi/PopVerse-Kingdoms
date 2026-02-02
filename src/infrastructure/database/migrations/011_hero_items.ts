import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create item_slot enum
  await knex.raw(`
    CREATE TYPE item_slot AS ENUM ('head', 'weapon', 'chest', 'boots', 'ring');
  `);

  // Create item_rarity enum (reusing hero_rarity concept)
  await knex.raw(`
    CREATE TYPE item_rarity AS ENUM ('common', 'rare', 'epic', 'legendary');
  `);

  // Create item_stat enum
  await knex.raw(`
    CREATE TYPE item_stat AS ENUM (
      'attack', 
      'defense', 
      'hp', 
      'speed', 
      'crit_rate', 
      'crit_damage', 
      'accuracy', 
      'resistance'
    );
  `);

  // Create hero_items table
  await knex.schema.createTable('hero_items', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('hero_id').references('id').inTable('heroes').onDelete('CASCADE').notNullable();
    table.specificType('slot', 'item_slot').notNullable();
    table.specificType('rarity', 'item_rarity').notNullable();
    table.smallint('level').notNullable().defaultTo(1);
    table.jsonb('primary_stat').notNullable(); // { stat, value, isPercentage }
    table.jsonb('secondary_stats').notNullable().defaultTo('[]'); // Array of { stat, value, isPercentage }
    table.boolean('equipped').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('hero_id');
    table.index(['hero_id', 'slot', 'equipped']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('hero_items');
  await knex.raw('DROP TYPE IF EXISTS item_stat');
  await knex.raw('DROP TYPE IF EXISTS item_rarity');
  await knex.raw('DROP TYPE IF EXISTS item_slot');
}
