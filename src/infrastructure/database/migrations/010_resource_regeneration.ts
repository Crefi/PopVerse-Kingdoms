import type { Knex } from 'knex';

/**
 * Add resource regeneration tracking to map tiles
 * Resources can be gathered and will regenerate daily
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('map_tiles', (table) => {
    // Track when resource was last gathered (null = never gathered, still available)
    table.timestamp('resource_gathered_at').nullable();
    
    // Track who gathered it (for analytics)
    table.bigInteger('resource_gathered_by').nullable()
      .references('id').inTable('players').onDelete('SET NULL');
    
    // Amount of resources available (0 = depleted, will regenerate)
    table.integer('resource_amount').defaultTo(100);
  });

  // Add index for finding depleted resources that need regeneration
  await knex.raw(`
    CREATE INDEX idx_map_tiles_resource_regen 
    ON map_tiles (terrain, resource_gathered_at) 
    WHERE terrain = 'resource' AND resource_gathered_at IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('map_tiles', (table) => {
    table.dropColumn('resource_gathered_at');
    table.dropColumn('resource_gathered_by');
    table.dropColumn('resource_amount');
  });
}
