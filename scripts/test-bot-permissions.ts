#!/usr/bin/env tsx
/**
 * Test bot permissions and access
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import { REST, Routes } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

async function testPermissions() {
  console.log('🔍 Testing bot permissions...\n');
  
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  // Test 1: Can we get application info?
  try {
    console.log('1️⃣ Testing application info access...');
    const app: any = await rest.get(Routes.oauth2CurrentApplication());
    console.log(`   ✅ Bot: ${app.name} (${app.id})`);
    console.log(`   ✅ Owner: ${app.owner?.username || 'Team'}`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 2: Can we access global commands?
  try {
    console.log('\n2️⃣ Testing global commands access...');
    const globalCmds: any = await rest.get(Routes.applicationCommands(DISCORD_CLIENT_ID));
    console.log(`   ✅ Can access global commands (${globalCmds.length} registered)`);
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  // Test 3: Can we access guild commands?
  if (DISCORD_GUILD_ID) {
    try {
      console.log('\n3️⃣ Testing guild commands access...');
      const guildCmds: any = await rest.get(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
      );
      console.log(`   ✅ Can access guild commands (${guildCmds.length} registered)`);
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message} (code: ${error.code})`);
      
      if (error.code === 50001) {
        console.log('\n💡 Error 50001 means one of:');
        console.log('   - Bot lacks applications.commands scope');
        console.log('   - Bot token is for a different application');
        console.log('   - Guild ID is incorrect');
        console.log('\n📋 Verify in Discord Developer Portal:');
        console.log('   1. Go to https://discord.com/developers/applications');
        console.log(`   2. Select your application (ID: ${DISCORD_CLIENT_ID})`);
        console.log('   3. Go to OAuth2 → URL Generator');
        console.log('   4. Check BOTH: "bot" and "applications.commands"');
        console.log('   5. Copy the generated URL and use it to re-invite');
      }
    }
  }

  // Test 4: Try to register a simple test command globally
  try {
    console.log('\n4️⃣ Testing global command registration...');
    const testCmd = {
      name: 'test-permission',
      description: 'Test command to verify permissions',
    };
    await rest.post(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: testCmd });
    console.log('   ✅ Can register global commands!');
    
    // Clean up
    const cmds: any = await rest.get(Routes.applicationCommands(DISCORD_CLIENT_ID));
    const testCmdObj = cmds.find((c: any) => c.name === 'test-permission');
    if (testCmdObj) {
      await rest.delete(Routes.applicationCommand(DISCORD_CLIENT_ID, testCmdObj.id));
      console.log('   ✅ Test command cleaned up');
    }
  } catch (error: any) {
    console.log(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Recommendation:');
  console.log('   If guild commands fail but global commands work,');
  console.log('   try removing DISCORD_GUILD_ID from .env.dev');
  console.log('   to use global commands instead (takes ~1 hour to sync).\n');
}

testPermissions();
