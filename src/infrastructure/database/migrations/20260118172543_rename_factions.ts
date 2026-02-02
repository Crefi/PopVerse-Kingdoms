import type { Knex } from "knex";

/**
 * Rename factions: otaku -> anime, arcade -> gamer
 */
export async function up(knex: Knex): Promise<void> {
  // Step 1: Create a new enum with all values
  await knex.raw(`
    CREATE TYPE faction_type_new AS ENUM ('cinema', 'anime', 'gamer', 'otaku', 'arcade');
  `);

  // Step 2: Update players table to use new enum
  await knex.raw(`
    ALTER TABLE players 
    ALTER COLUMN faction TYPE faction_type_new 
    USING faction::text::faction_type_new;
  `);

  // Step 3: Update heroes table to use new enum
  await knex.raw(`
    ALTER TABLE heroes 
    ALTER COLUMN faction TYPE faction_type_new 
    USING faction::text::faction_type_new;
  `);

  // Step 4: Drop old enum and rename new one
  await knex.raw(`
    DROP TYPE faction_type;
    ALTER TYPE faction_type_new RENAME TO faction_type;
  `);

  // Step 5: Update all existing data from old names to new names
  await knex.raw(`
    UPDATE players SET faction = 'anime' WHERE faction = 'otaku';
    UPDATE players SET faction = 'gamer' WHERE faction = 'arcade';
    UPDATE heroes SET faction = 'anime' WHERE faction = 'otaku';
    UPDATE heroes SET faction = 'gamer' WHERE faction = 'arcade';
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert the changes
  await knex.raw(`
    UPDATE players SET faction = 'otaku' WHERE faction = 'anime';
    UPDATE players SET faction = 'arcade' WHERE faction = 'gamer';
    UPDATE heroes SET faction = 'otaku' WHERE faction = 'anime';
    UPDATE heroes SET faction = 'arcade' WHERE faction = 'gamer';
  `);
}
