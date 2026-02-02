import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all available commands and game information')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Command category to view')
        .setRequired(false)
        .addChoices(
          { name: '🎮 Getting Started', value: 'start' },
          { name: '🏰 City & Buildings', value: 'city' },
          { name: '⚔️ Combat & Troops', value: 'combat' },
          { name: '🦸 Heroes & Items', value: 'heroes' },
          { name: '🏟️ Arena', value: 'arena' },
          { name: '🛡️ Guild', value: 'guild' },
          { name: '🗺️ Map & Land', value: 'map' },
          { name: '⚔️ Conquest Events', value: 'conquest' }
        )
    ) as SlashCommandBuilder,

  async execute(context: CommandContext): Promise<void> {
    const category = context.interaction.options.getString('category');

    let embed: EmbedBuilder;

    switch (category) {
      case 'start':
        embed = createStartEmbed();
        break;
      case 'city':
        embed = createCityEmbed();
        break;
      case 'combat':
        embed = createCombatEmbed();
        break;
      case 'heroes':
        embed = createHeroesEmbed();
        break;
      case 'arena':
        embed = createArenaEmbed();
        break;
      case 'guild':
        embed = createGuildEmbed();
        break;
      case 'map':
        embed = createMapEmbed();
        break;
      case 'conquest':
        embed = createConquestEmbed();
        break;
      default:
        embed = createMainHelpEmbed();
    }

    await context.interaction.reply({ embeds: [embed] });
  },
};

function createMainHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📚 PopVerse Kingdoms — Command Reference')
    .setDescription(
      '**Build your empire, train heroes, and conquer the realm!**\n\n' +
      'Pick a category below or use **`/help category:[name]`** for a detailed guide.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '🎮 Getting Started',
        value: '`/begin` · `/tutorial` · `/daily`\nStart the game, learn basics, claim rewards.',
        inline: true,
      },
      {
        name: '🏰 City & Buildings',
        value: '`/city` · `/build` · `/train`\nManage city, construct buildings, train troops.',
        inline: true,
      },
      {
        name: '⚔️ Combat',
        value: '`/attack` · `/scout` · `/heroes`\nAttack, scout, view hero roster.',
        inline: true,
      },
      {
        name: '🦸 Heroes & Items',
        value: '`/hero` · `/gear` · `/forge`\n`/loot` · `/salvage`\nHeroes, equipment, crafting.',
        inline: true,
      },
      {
        name: '🏟️ Arena',
        value: '`/arena` · `/leaderboard`\nPvP battles and rankings.',
        inline: true,
      },
      {
        name: '🛡️ Guild',
        value: '`/guild` · `/rally`\nGuilds, rallies, build support.',
        inline: true,
      },
      {
        name: '🗺️ Map & Land',
        value: '`/map` · `/land` · `/teleport`\nWorld map, territory, relocate.',
        inline: true,
      },
      {
        name: '⚔️ Conquest',
        value: '`/conquest` · `/conquest rally`\nServer events, guild rallies.',
        inline: true,
      },
      {
        name: '🏪 Other',
        value: '`/shop` · `/prestige`\nItems, diamonds, prestige.',
        inline: true,
      }
    )
    .setColor(0x5865f2)
    .setFooter({ text: '💡 Use the category dropdown in /help for full details on each section' });
}

function createStartEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎮 Getting Started')
    .setDescription(
      '**New to PopVerse Kingdoms?**\nFollow these steps to begin your conquest!\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '1️⃣ Choose Your Faction',
        value: 'Use `/begin` to select from:\n' +
          '> 🔥 **Cinema** — +10% Attack\n' +
          '> 💨 **Anime** — +15% March Speed\n' +
          '> 💧 **Gamer** — +10% Defense',
        inline: false,
      },
      {
        name: '2️⃣ Build Your City',
        value: 'Use `/build farm` and `/build mine` to start producing resources.\nUpgrade your HQ to unlock more features!',
        inline: false,
      },
      {
        name: '3️⃣ Train Your Army',
        value: 'Use `/train tier:1 amount:50` to train 50 Tier 1 troops.\nHigher tiers unlock at higher HQ levels.',
        inline: false,
      },
      {
        name: '4️⃣ Fight NPCs',
        value: 'Use `/scout x:[x] y:[y]` to find nearby NPCs.\nDefeat them with `/attack` to earn resources and Hero XP!',
        inline: false,
      },
      {
        name: '5️⃣ Join a Guild',
        value: 'Use `/guild search` to find guilds or `/guild create` to make your own.\nGuilds unlock rallies, shared lands, and Conquest rewards!',
        inline: false,
      }
    )
    .setColor(0x00ff00)
    .setFooter({ text: '🍀 Good luck, Captain!' });
}

function createCityEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🏰 City & Buildings')
    .setDescription(
      '**Manage your city and buildings to grow your empire.**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/city`', value: 'View your city status, resources, and buildings (including upgrade timers).', inline: false },
      {
        name: '`/build [building]`',
        value:
          'Start building or upgrading. Choose: **HQ**, **Farm**, **Mine**, **Barracks**, **Vault**, **Hospital**, **Academy**, **Forge**.\n' +
          '🔨 **Guild build support:** If you\'re in a guild, a message appears in your guild channel with a **Help Build** button — guild mates can click it to speed up your construction by **10 minutes** (once per build).',
        inline: false,
      },
      {
        name: '📦 Building Types',
        value:
          '> 🏛️ **HQ** — Unlock features & slots (max 25)\n' +
          '> 🌾 **Farm** — Produce Food\n' +
          '> ⛏️ **Mine** — Produce Iron\n' +
          '> ⚔️ **Barracks** — Train troops\n' +
          '> 🏦 **Vault** — Protect resources (50%)\n' +
          '> 🏥 **Hospital** — Heal wounded troops\n' +
          '> 📚 **Academy** — Research\n' +
          '> 🔨 **Forge** — Craft gear (HQ 10+)',
        inline: false,
      }
    )
    .setColor(0x8b4513);
}

function createCombatEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚔️ Combat & Troops')
    .setDescription(
      '**Train troops and engage in battle!**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/train tier:[1-4] amount:[qty]`', value: 'Train troops (t1–t4). Higher tiers unlock at higher HQ levels.', inline: false },
      { name: '`/attack x:[x] y:[y] troops:[qty]`', value: 'Attack a tile (player city or NPC).', inline: false },
      { name: '`/scout x:[x] y:[y]`', value: 'Scout a location to see power and defenders.', inline: false },
      { name: '`/heroes`', value: 'View your hero roster. Use `/hero` for a single hero.', inline: false },
      {
        name: '🔥 Elemental Advantages',
        value: '> 🔥 Fire beats 💨 Wind (+25% damage)\n> 💨 Wind beats 💧 Water (+25% damage)\n> 💧 Water beats 🔥 Fire (+25% damage)',
        inline: false,
      },
      {
        name: '🎖️ Troop Tiers',
        value: '> **T1** Militia — HQ 1 (Power: 10)\n> **T2** Soldiers — HQ 10 (Power: 30)\n> **T3** Veterans — HQ 18 (Power: 100)\n> **T4** Elite — HQ 25 (Power: 300)',
        inline: false,
      }
    )
    .setColor(0xff0000);
}

function createHeroesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🦸 Heroes & Items')
    .setDescription(
      '**Heroes, equipment, crafting, and loot!**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/heroes`', value: 'View your hero roster and stats.', inline: false },
      { name: '`/hero [name]`', value: 'View or manage a specific hero.', inline: false },
      { name: '`/gear hero:[name]`', value: 'View or equip gear on a hero (weapon, armor, etc.).', inline: false },
      { name: '`/forge`', value: 'Craft equipment at the Forge (requires Forge building, HQ 10+).', inline: false },
      { name: '`/loot hero:[name]`', value: 'Loot gear from defeated NPCs and assign to heroes.', inline: false },
      { name: '`/salvage`', value: 'Salvage unwanted gear for materials.', inline: false },
      {
        name: '📌 Tips',
        value:
          '> • Defeat NPCs to earn Hero XP and loot\n' +
          '> • Equip gear to boost hero stats\n' +
          '> • Use the Forge to craft better equipment\n' +
          '> • Salvage old gear to fund new crafts',
        inline: false,
      }
    )
    .setColor(0x9b59b6);
}

function createArenaEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🏟️ Arena')
    .setDescription(
      '**Compete in asynchronous PvP battles!**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/arena defense`', value: 'Set your 3-hero defense team (AI-controlled)', inline: false },
      { name: '`/arena attack`', value: 'View 5 potential opponents', inline: false },
      { name: '`/arena leaderboard`', value: 'View top 100 players', inline: false },
      { name: '`/arena status`', value: 'Check your tokens and stats', inline: false },
      { name: '`/arena stats`', value: 'View your win/loss record', inline: false },
      {
        name: '🎯 Arena Tips',
        value:
          '> • 10 tokens per day, regenerate 1 per 2 hours\n' +
          '> • First 5 daily matches are **FREE**\n' +
          '> • Win: +20-40 points | Lose: -10-20 points\n' +
          '> • Weekly rewards based on your tier!',
        inline: false,
      }
    )
    .setColor(0xffd700);
}

function createGuildEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🛡️ Guild')
    .setDescription(
      '**Team up with other players for shared benefits!**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/guild create name:[name] tag:[tag]`', value: 'Create a guild (costs 500 Gold). Creates a private Discord channel for your guild.', inline: false },
      { name: '`/guild join name:[name]`', value: 'Join an existing guild (or use an invite).', inline: false },
      { name: '`/guild info`', value: 'View your guild\'s stats, members, and roles.', inline: false },
      { name: '`/guild leave`', value: 'Leave your current guild.', inline: false },
      { name: '`/guild buyland land_id:[id]`', value: 'Purchase a land parcel for the guild (bonuses for all members).', inline: false },
      { name: '`/rally start x:[x] y:[y]`', value: 'Start a rally attack (up to 5 members). A notification is posted in your guild channel with a **Join Rally** button.', inline: false },
      {
        name: '🔨 Guild Build Support',
        value:
          'When a guild member uses **`/build`**, a **Guild Build Support** message is posted in your guild\'s Discord channel with a **Help Build** button. Guild mates can click it once per construction to speed it up by **10 minutes** — no need to spam commands!',
        inline: false,
      },
      {
        name: '🎁 Guild Benefits',
        value:
          '> • Shared land bonuses for all members\n' +
          '> • Rally attacks combine armies\n' +
          '> • Help speed up each other\'s builds (10 min per help)\n' +
          '> • Daily guild quests with rewards\n' +
          '> • Conquest event bonuses',
        inline: false,
      }
    )
    .setColor(0x9932cc);
}

function createMapEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🗺️ Map & Land')
    .setDescription(
      '**Navigate the world and claim territory!**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/map`', value: 'View 9x9 grid around your city', inline: false },
      { name: '`/map direction:[n/s/e/w]`', value: 'Pan the map view', inline: false },
      { name: '`/map player:[name]`', value: 'Find a player on the map', inline: false },
      { name: '`/map x:[x] y:[y]`', value: 'View specific coordinates', inline: false },
      { name: '`/land buy land_id:[id]`', value: 'Purchase a land parcel', inline: false },
      { name: '`/land owned`', value: 'View your owned lands', inline: false },
      {
        name: '🏞️ Land Types',
        value:
          '> 🌾 **Farm** — +15% Food production\n' +
          '> ⛏️ **Mine** — +15% Iron production\n' +
          '> 💰 **Gold Mine** — +20% Gold production\n' +
          '> 🏰 **Fort** — +10% Defense in battles',
        inline: false,
      },
      {
        name: '📍 Map Legend',
        value: '🏰 Your City • 👹 Monster • 💎 Resource • 🎬⚔️🎮 Players',
        inline: false,
      }
    )
    .setColor(0x228b22);
}


function createConquestEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚔️ Conquest Events')
    .setDescription(
      '**Compete in server-wide guild events for glory and rewards!**\n\n' +
      '🛡️ **This is a guild-focused event!** Coordinate with your guild for maximum impact.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      { name: '`/conquest status`', value: 'View current event status and leaderboard', inline: false },
      { name: '`/conquest attack point:[1-5]`', value: 'Capture a Control Point solo during an event', inline: false },
      { name: '`/conquest rally`', value: '🛡️ Start a guild rally (select point from dropdown)', inline: false },
      { name: '`/conquest start duration:[30-120]`', value: '🔒 **Admin Only** — Start a new Conquest event', inline: false },
      { name: '`/conquest stop`', value: '🔒 **Admin Only** — End the current event early', inline: false },
      {
        name: '🛡️ Guild Rally System (No Troops Needed!)',
        value:
          '> • Use `/conquest rally` to start\n' +
          '> • Select a Control Point from the dropdown\n' +
          '> • Guild members click "Join Rally" to participate\n' +
          '> • Leader clicks "Send Rally" to launch attack\n' +
          '> • All participants capture the point together!\n' +
          '> • **Note:** This is different from `/rally` which is for attacking players/NPCs',
        inline: false,
      },
      {
        name: '🏰 How Conquest Works',
        value:
          '> • Admins start events with 5 Control Points\n' +
          '> • Control Points appear as temples on the map\n' +
          '> • Capture points by attacking them\n' +
          '> • Earn 1 point per minute while holding a point\n' +
          '> • 5-minute cooldown between attacks on same point\n' +
          '> • Events last 30-120 minutes',
        inline: false,
      },
      {
        name: '🏆 Rewards',
        value:
          '> **Top 10 Players:** 100-2000 Diamonds + Hero Shards\n' +
          '> **Top 3 Guilds:** 1500-5000 Diamonds to treasury\n' +
          '> Rewards distributed when event ends!',
        inline: false,
      }
    )
    .setColor(0xff4444);
}
