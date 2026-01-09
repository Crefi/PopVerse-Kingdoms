import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    await knex('guild_members').del();
    await knex('guilds').del();
  }

  // Create starter guilds
  const starterGuilds = [
    {
      name: 'Cinema Legion',
      tag: 'CINE',
      is_starter_guild: true,
      treasury: JSON.stringify({ food: 0, iron: 0, gold: 0 }),
    },
    {
      name: 'Otaku Alliance',
      tag: 'OTAK',
      is_starter_guild: true,
      treasury: JSON.stringify({ food: 0, iron: 0, gold: 0 }),
    },
    {
      name: 'Arcade Coalition',
      tag: 'ARCA',
      is_starter_guild: true,
      treasury: JSON.stringify({ food: 0, iron: 0, gold: 0 }),
    },
  ];

  await knex('guilds').insert(starterGuilds).onConflict('name').ignore();
}
