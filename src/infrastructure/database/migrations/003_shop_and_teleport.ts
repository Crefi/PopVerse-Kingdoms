import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Player inventory table for shop items
  await knex.schema.createTable('player_inventory', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('item_id', 50).notNullable();
    table.integer('quantity').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['player_id', 'item_id']);
    table.index('player_id');
  });

  // Shop purchases log for daily limits
  await knex.schema.createTable('shop_purchases', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('item_id', 50).notNullable();
    table.integer('cost_diamonds').notNullable().defaultTo(0);
    table.integer('cost_gold').notNullable().defaultTo(0);
    table.timestamp('purchased_at').notNullable().defaultTo(knex.fn.now());

    table.index('player_id');
    table.index(['player_id', 'item_id', 'purchased_at']);
  });

  // Teleport log for tracking
  await knex.schema.createTable('teleport_log', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.integer('from_x').notNullable();
    table.integer('from_y').notNullable();
    table.integer('to_x').notNullable();
    table.integer('to_y').notNullable();
    table.timestamp('teleported_at').notNullable().defaultTo(knex.fn.now());

    table.index('player_id');
  });

  // Active boosts table for resource boost, shields, etc.
  await knex.schema.createTable('active_boosts', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('boost_type', 50).notNullable();
    table.float('multiplier').notNullable().defaultTo(1.0);
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('player_id');
    table.index(['player_id', 'boost_type']);
    table.index('expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('active_boosts');
  await knex.schema.dropTableIfExists('teleport_log');
  await knex.schema.dropTableIfExists('shop_purchases');
  await knex.schema.dropTableIfExists('player_inventory');
}
