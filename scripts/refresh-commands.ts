#!/usr/bin/env tsx
/**
 * Refresh Discord slash commands
 * This will re-register all commands with Discord
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import { REST, Routes } from 'discord.js';
import { loadCommands } from '../dist/presentation/discord/commands/index.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment');
  process.exit(1);
}

async function refreshCommands() {
  console.log('🔄 Refreshing Discord commands...\n');

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const commands = loadCommands();
  
  const commandData = commands.map(cmd => cmd.data.toJSON());
  
  console.log(`📝 Found ${commandData.length} commands:`);
  commandData.forEach(cmd => console.log(`   - /${cmd.name}`));
  console.log('');

  try {
    if (DISCORD_GUILD_ID) {
      // Register to specific guild (instant update)
      console.log(`🎯 Registering commands to guild ${DISCORD_GUILD_ID}...`);
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
        { body: commandData }
      );
      console.log('✅ Guild commands registered successfully!');
    } else {
      // Register globally (takes up to 1 hour to propagate)
      console.log('🌍 Registering commands globally...');
      await rest.put(
        Routes.applicationCommands(DISCORD_CLIENT_ID),
        { body: commandData }
      );
      console.log('✅ Global commands registered successfully!');
      console.log('⏰ Note: Global commands may take up to 1 hour to update');
    }
  } catch (error) {
    console.error('❌ Error refreshing commands:', error);
    process.exit(1);
  }
}

refreshCommands();
