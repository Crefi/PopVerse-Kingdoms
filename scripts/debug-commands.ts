#!/usr/bin/env tsx
/**
 * Debug Discord commands - check what's registered
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import { REST, Routes } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

async function debugCommands() {
  console.log('🔍 Checking registered Discord commands...\n');

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    if (DISCORD_GUILD_ID) {
      console.log(`📍 Checking guild commands for guild ${DISCORD_GUILD_ID}...`);
      const commands: any = await rest.get(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
      );
      
      console.log(`\n✅ Found ${commands.length} registered commands:\n`);
      commands.forEach((cmd: any) => {
        console.log(`   /${cmd.name} - ${cmd.description}`);
      });
      
      // Check if hero command exists
      const heroCmd = commands.find((c: any) => c.name === 'hero');
      if (heroCmd) {
        console.log('\n✅ /hero command IS registered!');
        console.log('   Options:', heroCmd.options);
      } else {
        console.log('\n❌ /hero command NOT found in registered commands');
      }
    } else {
      console.log('📍 Checking global commands...');
      const commands: any = await rest.get(
        Routes.applicationCommands(DISCORD_CLIENT_ID)
      );
      
      console.log(`\n✅ Found ${commands.length} registered commands:\n`);
      commands.forEach((cmd: any) => {
        console.log(`   /${cmd.name} - ${cmd.description}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Error fetching commands:', error.message);
    if (error.code === 50001) {
      console.log('\n💡 Missing Access error - The bot needs to be invited with applications.commands scope');
      console.log('   Invite URL: https://discord.com/api/oauth2/authorize?client_id=' + DISCORD_CLIENT_ID + '&permissions=8&scope=bot%20applications.commands');
    }
  }
}

debugCommands();
