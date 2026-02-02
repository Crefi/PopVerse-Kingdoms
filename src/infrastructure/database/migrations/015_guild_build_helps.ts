import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('guild_build_helps', (table) => {
    table.bigInteger('building_id').notNullable().references('id').inTable('buildings').onDelete('CASCADE');
    table.timestamp('upgrade_completes_at').notNullable();
    table.bigInteger('helper_player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
    table.timestamp('helped_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['building_id', 'upgrade_completes_at', 'helper_player_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guild_build_helps');
}
