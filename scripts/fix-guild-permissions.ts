#!/usr/bin/env tsx
/**
 * Fix guild command permissions
 * This script helps diagnose and fix the Missing Access error
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import { REST, Routes } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID!;

async function fixGuildPermissions() {
  console.log('🔧 Guild Command Permission Fixer\n');
  console.log('═'.repeat(60));
  
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  // Step 1: Check current guild command status
  console.log('\n1️⃣ Checking guild command access...');
  try {
    const guildCmds: any = await rest.get(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    );
    console.log(`   ✅ Guild commands accessible (${guildCmds.length} registered)`);
    console.log('\n✨ Guild commands are working! No fix needed.');
    return;
  } catch (error: any) {
    if (error.code === 50001) {
      console.log('   ❌ Missing Access error detected');
    } else {
      console.log(`   ❌ Error: ${error.message}`);
      return;
    }
  }

  // Step 2: Verify bot is in the guild
  console.log('\n2️⃣ Checking if bot is in the guild...');
  try {
    const guild: any = await rest.get(Routes.guild(DISCORD_GUILD_ID));
    console.log(`   ✅ Guild found: ${guild.name}`);
  } catch (error: any) {
    console.log(`   ❌ Cannot access guild: ${error.message}`);
    console.log('\n💡 The bot might not be in this guild or guild ID is wrong');
    return;
  }

  // Step 3: Generate proper invite URL
  console.log('\n3️⃣ Generating proper invite URL...');
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${DISCORD_GUILD_ID}&disable_guild_select=true`;
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n🔗 GUILD-SPECIFIC INVITE URL:\n');
  console.log(inviteUrl);
  console.log('\n' + '═'.repeat(60));
  
  console.log('\n📝 INSTRUCTIONS:');
  console.log('   1. Copy the URL above');
  console.log('   2. Open it in your browser');
  console.log('   3. You will see "PopVerse is already in this server"');
  console.log('   4. Click "Continue" anyway');
  console.log('   5. Check "applications.commands" if not already checked');
  console.log('   6. Click "Authorize"');
  console.log('   7. Run: npx tsx scripts/refresh-commands.ts');
  console.log('   8. Restart bot: npm run dev\n');
  
  console.log('💡 This will add the missing applications.commands scope');
  console.log('   without removing the bot from the server.\n');
}

fixGuildPermissions();
