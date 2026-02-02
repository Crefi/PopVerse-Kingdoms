import type { Knex } from 'knex';

/**
 * Add 'elite' and 'recruit' to guild_role enum for Task 7 (guild roles and permissions).
 * Order: leader > officer > elite > member > recruit
 */
export async function up(knex: Knex): Promise<void> {
  // Add new role values (run once; re-running may error with "already exists" on older PostgreSQL)
  await knex.raw(`ALTER TYPE guild_role ADD VALUE 'elite'`);
  await knex.raw(`ALTER TYPE guild_role ADD VALUE 'recruit'`);
}

export async function down(knex: Knex): Promise<void> {
  // PostgreSQL does not support removing enum values; would require recreating type and column.
  // No-op for safety - existing data may use elite/recruit.
}
