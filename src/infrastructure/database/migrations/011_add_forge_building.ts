import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add 'forge' to the building_type enum
  await knex.raw(`
    ALTER TYPE building_type ADD VALUE IF NOT EXISTS 'forge';
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Note: PostgreSQL doesn't support removing enum values directly
  // This would require recreating the enum type, which is complex
  // For now, we'll leave the enum value in place
  console.log('Note: Cannot remove enum value "forge" from building_type. Manual intervention required if rollback is needed.');
}
