import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create material_type enum
  await knex.raw(`
    CREATE TYPE material_type AS ENUM ('leather_scraps', 'iron_ingots', 'mystic_essence', 'dragon_scales', 'celestial_fragments');
  `);

  // Create player_materials table
  await knex.schema.createTable('player_materials', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
    table.specificType('material_type', 'material_type').notNullable();
    table.integer('quantity').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.unique(['player_id', 'material_type']);
    table.index('player_id');
  });

  // Create crafting_recipes table
  await knex.schema.createTable('crafting_recipes', (table) => {
    table.bigIncrements('id').primary();
    table.string('recipe_id').notNullable().unique();
    table.string('name').notNullable();
    table.text('description').notNullable();
    table.string('item_type').notNullable(); // weapon, armor, accessory
    table.string('rarity').notNullable(); // common, uncommon, rare, epic, legendary
    table.integer('forge_level_required').notNullable().defaultTo(1);
    table.jsonb('materials_required').notNullable(); // { material_type: quantity }
    table.integer('crafting_time_seconds').notNullable();
    table.integer('success_rate').notNullable(); // percentage
    table.jsonb('stat_ranges').notNullable(); // min/max stats for the item
    table.string('set_id').nullable(); // for item sets
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // Create crafting_queue table
  await knex.schema.createTable('crafting_queue', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
    table.string('recipe_id').notNullable().references('recipe_id').inTable('crafting_recipes');
    table.integer('slot').notNullable(); // 1, 2, or 3 (VIP gets 3 slots)
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completes_at').notNullable();
    table.string('status').notNullable().defaultTo('in_progress'); // in_progress, completed, failed
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    table.index('player_id');
    table.index(['player_id', 'status']);
  });

  // Add item_set field to items table if it exists
  const hasItemsTable = await knex.schema.hasTable('items');
  if (hasItemsTable) {
    const hasItemSet = await knex.schema.hasColumn('items', 'item_set');
    if (!hasItemSet) {
      await knex.schema.alterTable('items', (table) => {
        table.string('item_set').nullable();
        table.integer('set_piece_number').nullable(); // 1-6 for set pieces
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables
  await knex.schema.dropTableIfExists('crafting_queue');
  await knex.schema.dropTableIfExists('crafting_recipes');
  await knex.schema.dropTableIfExists('player_materials');

  // Drop enum
  await knex.raw('DROP TYPE IF EXISTS material_type');

  // Remove item_set columns if items table exists
  const hasItemsTable = await knex.schema.hasTable('items');
  if (hasItemsTable) {
    const hasItemSet = await knex.schema.hasColumn('items', 'item_set');
    if (hasItemSet) {
      await knex.schema.alterTable('items', (table) => {
        table.dropColumn('item_set');
        table.dropColumn('set_piece_number');
      });
    }
  }
}
