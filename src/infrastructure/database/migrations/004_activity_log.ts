import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Activity log table for tracking player actions
  await knex.schema.createTable('activity_logs', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.string('action_type', 30).notNullable(); // train, build, attack, scout, gather, etc.
    table.string('description', 255).notNullable();
    table.jsonb('resources_changed').nullable(); // { food: +100, iron: -50, gold: 0 }
    table.jsonb('metadata').nullable(); // Additional context (building type, troop tier, etc.)
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('player_id');
    table.index(['player_id', 'created_at']);
    table.index('action_type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('activity_logs');
}
