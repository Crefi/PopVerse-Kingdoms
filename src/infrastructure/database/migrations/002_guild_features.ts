import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Guild rallies table
  await knex.schema.createTable('guild_rallies', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('guild_id').references('id').inTable('guilds').onDelete('CASCADE').notNullable();
    table.bigInteger('leader_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.integer('target_x').notNullable();
    table.integer('target_y').notNullable();
    table.bigInteger('target_player_id').references('id').inTable('players').onDelete('SET NULL');
    table.bigInteger('target_npc_id').references('id').inTable('npcs').onDelete('SET NULL');
    table.timestamp('starts_at').notNullable();
    table.timestamp('launches_at').notNullable();
    table.boolean('launched').notNullable().defaultTo(false);
    table.boolean('completed').notNullable().defaultTo(false);
    table.jsonb('result').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('guild_id');
    table.index('leader_id');
    table.index('launches_at');
  });

  // Rally participants table
  await knex.schema.createTable('rally_participants', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('rally_id').references('id').inTable('guild_rallies').onDelete('CASCADE').notNullable();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.bigInteger('hero_id').references('id').inTable('heroes').onDelete('SET NULL');
    table.jsonb('troops').notNullable();
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['rally_id', 'player_id']);
    table.index('player_id');
  });

  // Guild quests table
  await knex.schema.createTable('guild_quests', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('guild_id').references('id').inTable('guilds').onDelete('CASCADE').notNullable();
    table.string('quest_type', 30).notNullable();
    table.string('description', 200).notNullable();
    table.integer('target').notNullable();
    table.integer('progress').notNullable().defaultTo(0);
    table.boolean('completed').notNullable().defaultTo(false);
    table.boolean('rewards_claimed').notNullable().defaultTo(false);
    table.jsonb('rewards').notNullable();
    table.date('quest_date').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['guild_id', 'quest_type', 'quest_date']);
    table.index(['guild_id', 'quest_date']);
  });

  // Guild quest contributions table
  await knex.schema.createTable('guild_quest_contributions', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('quest_id').references('id').inTable('guild_quests').onDelete('CASCADE').notNullable();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.integer('contribution').notNullable().defaultTo(0);
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['quest_id', 'player_id']);
    table.index('player_id');
  });

  // Guild invitations table
  await knex.schema.createTable('guild_invitations', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('guild_id').references('id').inTable('guilds').onDelete('CASCADE').notNullable();
    table.bigInteger('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable();
    table.bigInteger('invited_by').references('id').inTable('players').onDelete('SET NULL');
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['guild_id', 'player_id']);
    table.index('player_id');
    table.index('expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('guild_invitations');
  await knex.schema.dropTableIfExists('guild_quest_contributions');
  await knex.schema.dropTableIfExists('guild_quests');
  await knex.schema.dropTableIfExists('rally_participants');
  await knex.schema.dropTableIfExists('guild_rallies');
}
