import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('guilds', (table) => {
    table.string('discord_role_id').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('guilds', (table) => {
    table.dropColumn('discord_role_id');
  });
}
