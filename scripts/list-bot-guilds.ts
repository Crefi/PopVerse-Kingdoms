#!/usr/bin/env tsx
/**
 * List all guilds the bot is currently in
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

import { Client, GatewayIntentBits } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

async function listGuilds() {
  console.log('🔍 Checking bot guild membership...\n');
  
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once('ready', () => {
    console.log(`✅ Bot logged in as: ${client.user?.tag}\n`);
    console.log('═'.repeat(60));
    console.log(`\n📊 Bot is in ${client.guilds.cache.size} guild(s):\n`);
    
    if (client.guilds.cache.size === 0) {
      console.log('   ❌ Bot is not in any guilds!');
      console.log('\n💡 You need to invite the bot to your server:');
      console.log(`   https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands\n`);
    } else {
      client.guilds.cache.forEach(guild => {
        console.log(`   🏰 ${guild.name}`);
        console.log(`      ID: ${guild.id}`);
        console.log(`      Members: ${guild.memberCount}`);
        console.log('');
      });
      
      const envGuildId = process.env.DISCORD_GUILD_ID;
      if (envGuildId) {
        const isInGuild = client.guilds.cache.has(envGuildId);
        console.log('═'.repeat(60));
        console.log(`\n🎯 DISCORD_GUILD_ID in .env.dev: ${envGuildId}`);
        if (isInGuild) {
          console.log('   ✅ Bot IS in this guild');
        } else {
          console.log('   ❌ Bot is NOT in this guild!');
          console.log('\n💡 Either:');
          console.log('   1. Update DISCORD_GUILD_ID to match one of the guilds above');
          console.log('   2. Or invite the bot to the guild with ID ' + envGuildId);
        }
      }
    }
    
    console.log('\n');
    client.destroy();
    process.exit(0);
  });

  await client.login(DISCORD_TOKEN);
}

listGuilds();
