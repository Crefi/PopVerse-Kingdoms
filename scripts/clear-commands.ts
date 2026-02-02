#!/usr/bin/env tsx
/**
 * Clear all Discord slash commands
 * Use this before re-inviting the bot with new permissions
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import { REST, Routes } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment');
  process.exit(1);
}

async function clearCommands() {
  console.log('🗑️  Clearing Discord commands...\n');

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    if (DISCORD_GUILD_ID) {
      console.log(`🎯 Clearing guild commands for ${DISCORD_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: [] }
      );
      console.log('✅ Guild commands cleared!');
    } else {
      console.log('🌍 Clearing global commands...');
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: [] }
      );
      console.log('✅ Global commands cleared!');
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Kick the bot from your Discord server');
    console.log('   2. Run: npx tsx scripts/generate-invite-url.ts');
    console.log('   3. Use the invite URL to re-add the bot');
    console.log('   4. Run: npx tsx scripts/refresh-commands.ts');
    console.log('   5. Start the bot: npm run dev\n');
  } catch (error: any) {
    console.error('❌ Error clearing commands:', error.message);
    if (error.code === 50001) {
      console.log('\n💡 Missing Access error means the bot lacks applications.commands scope');
      console.log('   You need to:');
      console.log('   1. Kick the bot from your server');
      console.log('   2. Run: npx tsx scripts/generate-invite-url.ts');
      console.log('   3. Use the new invite URL to re-add the bot\n');
    }
    process.exit(1);
  }
}

clearCommands();
