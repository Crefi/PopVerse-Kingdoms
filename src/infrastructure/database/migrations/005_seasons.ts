import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create seasons table
  await knex.schema.createTable('seasons', (table) => {
    table.bigIncrements('id').primary();
    table.integer('season_number').notNullable().unique();
    table.timestamp('starts_at').notNullable();
    table.timestamp('ends_at').notNullable();
    table.boolean('active').notNullable().defaultTo(false);
    table.jsonb('hall_of_fame').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // Create player_achievements table (for season-based achievements)
  await knex.schema.createTable('player_achievements', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
    table.jsonb('achievements').notNullable().defaultTo('[]');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.unique(['player_id']);
  });

  // Create player_cosmetics table
  await knex.schema.createTable('player_cosmetics', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
    table.jsonb('unlocked_cosmetics').notNullable().defaultTo('[]');
    table.string('equipped_city_skin').nullable();
    table.string('equipped_badge').nullable();
    table.string('equipped_title').nullable();
    table.string('equipped_guild_banner').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.unique(['player_id']);
  });

  // Create player_achievement_progress table (for permanent achievements)
  await knex.schema.createTable('player_achievement_progress', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE');
    table.string('achievement_id').notNullable();
    table.integer('progress').notNullable().defaultTo(0);
    table.boolean('completed').notNullable().defaultTo(false);
    table.timestamp('completed_at').nullable();
    table.boolean('claimed').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.unique(['player_id', 'achievement_id']);
  });

  // Add prestige_points column to players table if it doesn't exist
  const hasPrestigePoints = await knex.schema.hasColumn('players', 'prestige_points');
  if (!hasPrestigePoints) {
    await knex.schema.alterTable('players', (table) => {
      table.integer('prestige_points').notNullable().defaultTo(0);
    });
  }

  // Create indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(active)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_seasons_season_number ON seasons(season_number)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_player_achievements_player_id ON player_achievements(player_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_player_cosmetics_player_id ON player_cosmetics(player_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_player_achievement_progress_player_id ON player_achievement_progress(player_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_player_achievement_progress_achievement_id ON player_achievement_progress(achievement_id)');
}

export async function down(knex: Knex): Promise<void> {
  // Drop indexes
  await knex.schema.raw('DROP INDEX IF EXISTS idx_player_achievement_progress_achievement_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_player_achievement_progress_player_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_player_cosmetics_player_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_player_achievements_player_id');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_seasons_season_number');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_seasons_active');

  // Drop tables
  await knex.schema.dropTableIfExists('player_achievement_progress');
  await knex.schema.dropTableIfExists('player_cosmetics');
  await knex.schema.dropTableIfExists('player_achievements');
  await knex.schema.dropTableIfExists('seasons');

  // Remove prestige_points column from players
  const hasPrestigePoints = await knex.schema.hasColumn('players', 'prestige_points');
  if (hasPrestigePoints) {
    await knex.schema.alterTable('players', (table) => {
      table.dropColumn('prestige_points');
    });
  }
}
