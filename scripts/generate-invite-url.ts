#!/usr/bin/env tsx
/**
 * Generate Discord bot invite URL with correct permissions
 */

import { config } from 'dotenv';
config({ path: '.env.dev' });

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;

if (!DISCORD_CLIENT_ID) {
  console.error('❌ Missing DISCORD_CLIENT_ID in .env.dev');
  process.exit(1);
}

console.log('\n🤖 Discord Bot Invite URL Generator\n');
console.log('═'.repeat(60));
console.log('\n📋 Your bot invite URL:\n');

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

console.log(inviteUrl);
console.log('\n' + '═'.repeat(60));
console.log('\n📝 Instructions:');
console.log('   1. Copy the URL above');
console.log('   2. Open it in your browser');
console.log('   3. Select your Discord server');
console.log('   4. Authorize the bot with the requested permissions');
console.log('   5. Restart your bot: npm run dev');
console.log('\n✨ The /hero command will appear after re-inviting!\n');
