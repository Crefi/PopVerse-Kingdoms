import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { Faction, Element, HeroRarity } from '../../../shared/types/index.js';
import { existsSync } from 'fs';
import { join } from 'path';

const ELEMENT_EMOJIS: Record<Element, string> = {
  fire: '🔥',
  wind: '💨',
  water: '💧',
};

const RARITY_COLORS: Record<HeroRarity, number> = {
  common: 0x95a5a6,    // Gray
  rare: 0x3498db,      // Blue
  epic: 0x9b59b6,      // Purple
  legendary: 0xf1c40f, // Gold
};

const RARITY_EMOJIS: Record<HeroRarity, string> = {
  common: '⬜',
  rare: '🟦',
  epic: '🟪',
  legendary: '🟨',
};

// Helper to get hero image file path
function getHeroImagePath(heroName: string): string | null {
  const imageMap: Record<string, string> = {
    'Ethan Hunt': 'Ethan-Hunt.jpg',
    'James Bond': 'James-Bond.png',
    'John Wick': 'John-Wick.jpg',
    'T-800 Terminator': 'T-800-Terminator.jpg',
    'Naruto Uzumaki': 'Naruto-Uzumaki.jpg',
    'Edward Elric': 'Edward-Elric.jpg',
    'Son Goku': 'Son-Goku.jpg',
    'Saitama': 'Saitama.png',
    'Master Chief': 'Master-Chief.jpg',
    'Kratos': 'Kratos.jpg',
    'Geralt of Rivia': 'Geralt-of-Rivia.jpg',
    'Solid Snake': 'Solid-Snake.jpg',
  };
  
  const filename = imageMap[heroName];
  if (!filename) return null;
  
  const imagePath = join(process.cwd(), 'assets', 'heroes', filename);
  return existsSync(imagePath) ? imagePath : null;
}

interface HeroRow {
  id: string;
  name: string;
  faction: Faction;
  element: Element;
  rarity: HeroRarity;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  skill_name: string;
  skill_description: string;
  skills: string | object;
  gear: string | object;
}

export const heroesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('heroes')
    .setDescription('View your hero roster')
    .addStringOption(option =>
      option
        .setName('hero')
        .setDescription('View detailed stats for a specific hero')
        .setRequired(false)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const heroName = context.interaction.options.getString('hero');

    const player = await db('players').select('id', 'username', 'faction').where('discord_id', discordId).first();
    if (!player) {
      await context.interaction.reply({ content: '❌ Use `/begin` to start!', ephemeral: true });
      return;
    }

    const heroes: HeroRow[] = await db('heroes')
      .select('*')
      .where('player_id', player.id)
      .orderBy('rarity', 'desc')
      .orderBy('level', 'desc');

    if (heroes.length === 0) {
      await context.interaction.reply({ content: '❌ You have no heroes! Complete the tutorial to get your starter hero.', ephemeral: true });
      return;
    }

    // If specific hero requested, show detailed view
    if (heroName) {
      const hero = heroes.find(h => h.name.toLowerCase().includes(heroName.toLowerCase()));
      if (!hero) {
        await context.interaction.reply({ content: `❌ Hero "${heroName}" not found in your roster!`, ephemeral: true });
        return;
      }

      await showHeroDetails(context, hero, player.username);
      return;
    }

    // Show roster overview with modern, compact design
    const embed = new EmbedBuilder()
      .setTitle(`🦸 ${player.username}'s Hero Collection`)
      .setColor(RARITY_COLORS[heroes[0].rarity])
      .setDescription(
        `╔═══════════════════════════╗\n` +
        `║  **${heroes.length}** ${heroes.length === 1 ? 'Hero' : 'Heroes'} Collected  ║\n` +
        `╚═══════════════════════════╝`
      );

    // Try to attach hero image
    const topHeroImagePath = getHeroImagePath(heroes[0].name);
    let attachment: AttachmentBuilder | undefined;
    
    if (topHeroImagePath) {
      try {
        attachment = new AttachmentBuilder(topHeroImagePath, { name: 'hero.jpg' });
        embed.setThumbnail('attachment://hero.jpg');
      } catch (error) {
        console.error('Failed to load hero image:', error);
      }
    }

    // Group heroes by rarity
    const legendary = heroes.filter(h => h.rarity === 'legendary');
    const epic = heroes.filter(h => h.rarity === 'epic');
    const rare = heroes.filter(h => h.rarity === 'rare');
    const common = heroes.filter(h => h.rarity === 'common');

    const formatHeroCompact = (h: HeroRow): string => {
      const power = h.attack + h.defense + h.speed + Math.floor(h.hp / 10);
      return `${ELEMENT_EMOJIS[h.element]} **${h.name}** • Lv.**${h.level}** • ${power.toLocaleString()}⚡`;
    };

    // Create a single field with all heroes organized by rarity
    let heroList = '';
    
    if (legendary.length > 0) {
      heroList += `\n**🟨 LEGENDARY**\n${legendary.map(formatHeroCompact).join('\n')}\n`;
    }
    
    if (epic.length > 0) {
      heroList += `\n**🟪 EPIC**\n${epic.map(formatHeroCompact).join('\n')}\n`;
    }
    
    if (rare.length > 0) {
      heroList += `\n**🟦 RARE**\n${rare.map(formatHeroCompact).join('\n')}\n`;
    }
    
    if (common.length > 0) {
      heroList += `\n**⬜ COMMON**\n${common.map(formatHeroCompact).join('\n')}`;
    }

    embed.addFields({
      name: '━━━━━━━━━━━━━━━━━━━━━━━━━━',
      value: heroList,
      inline: false,
    });

    // Add quick stats footer
    const totalPower = heroes.reduce((sum, h) => sum + h.attack + h.defense + h.speed + Math.floor(h.hp / 10), 0);
    const avgLevel = Math.floor(heroes.reduce((sum, h) => sum + h.level, 0) / heroes.length);
    
    embed.addFields({
      name: '📊 Collection Stats',
      value: 
        `⚡ Total Power: **${totalPower.toLocaleString()}**\n` +
        `📈 Average Level: **${avgLevel}**\n` +
        `🏆 Highest Level: **${heroes[0].name}** (Lv.${heroes[0].level})`,
      inline: false,
    });

    embed.setFooter({ text: `💡 Use /hero to view detailed stats for any hero` });
    embed.setTimestamp();

    const replyOptions: any = { embeds: [embed] };
    if (attachment) {
      replyOptions.files = [attachment];
    }

    await context.interaction.reply(replyOptions);
  },
};

async function showHeroDetails(context: CommandContext, hero: HeroRow, playerName: string): Promise<void> {
  const power = hero.attack + hero.defense + hero.speed + Math.floor(hero.hp / 10);
  const xpToNext = (hero.level + 1) * 100;
  const xpProgress = Math.floor((hero.experience / xpToNext) * 100);
  
  // Parse gear
  const gear = typeof hero.gear === 'string' ? JSON.parse(hero.gear) : hero.gear;
  const hasWeapon = gear && gear.weapon;
  const hasArmor = gear && gear.armor;

  const embed = new EmbedBuilder()
    .setTitle(`${RARITY_EMOJIS[hero.rarity]} ${hero.name}`)
    .setColor(RARITY_COLORS[hero.rarity])
    .setDescription(
      `╔════════════════════════════╗\n` +
      `║ ${hero.rarity.toUpperCase()} ${ELEMENT_EMOJIS[hero.element]} ${hero.element.toUpperCase()} HERO\n` +
      `║ Owner: **${playerName}**\n` +
      `╚════════════════════════════╝`
    );

  // Try to attach hero image
  const heroImagePath = getHeroImagePath(hero.name);
  let attachment: AttachmentBuilder | undefined;
  
  if (heroImagePath) {
    try {
      attachment = new AttachmentBuilder(heroImagePath, { name: 'hero.jpg' });
      embed.setImage('attachment://hero.jpg');
    } catch (error) {
      console.error('Failed to load hero image:', error);
    }
  }

  // Level & XP Progress
  const xpBar = '█'.repeat(Math.floor(xpProgress / 5)) + '░'.repeat(20 - Math.floor(xpProgress / 5));
  embed.addFields({
    name: '📊 Level & Experience',
    value: 
      `**Level ${hero.level}** • ${power.toLocaleString()} ⚡ Total Power\n` +
      `\`${xpBar}\` ${xpProgress}%\n` +
      `${hero.experience.toLocaleString()} / ${xpToNext.toLocaleString()} XP`,
    inline: false,
  });

  // Combat Stats in a clean grid
  embed.addFields(
    {
      name: '⚔️ Attack',
      value: `**${hero.attack}**${hasWeapon ? `\n+${gear.weapon.power} 🗡️` : ''}`,
      inline: true,
    },
    {
      name: '�️ Defense',
      value: `**${hero.defense}**${hasArmor ? `\n+${gear.armor.power} 🛡️` : ''}`,
      inline: true,
    },
    {
      name: '💨 Speed',
      value: `**${hero.speed}**`,
      inline: true,
    },
    {
      name: '❤️ Health',
      value: `**${hero.hp}**`,
      inline: true,
    },
    {
      name: '🎯 Faction',
      value: `**${hero.faction.charAt(0).toUpperCase() + hero.faction.slice(1)}**`,
      inline: true,
    },
    {
      name: '⭐ Rarity',
      value: `**${hero.rarity.charAt(0).toUpperCase() + hero.rarity.slice(1)}**`,
      inline: true,
    }
  );

  // Equipment Section
  if (hasWeapon || hasArmor) {
    embed.addFields({
      name: '🎒 Equipment',
      value: 
        (hasWeapon ? `⚔️ **${gear.weapon.name}** (+${gear.weapon.power} ATK)\n` : '') +
        (hasArmor ? `🛡️ **${gear.armor.name}** (+${gear.armor.power} DEF)` : ''),
      inline: false,
    });
  }

  // Skill
  embed.addFields({
    name: `✨ ${hero.skill_name}`,
    value: `*${hero.skill_description}*`,
    inline: false,
  });

  // Next Level Preview
  embed.addFields({
    name: `� Level ${hero.level + 1} Preview`,
    value: 
      `⚔️ ${hero.attack} → **${hero.attack + 5}**\n` +
      `🛡️ ${hero.defense} → **${hero.defense + 4}**\n` +
      `💨 ${hero.speed} → **${hero.speed + 2}**\n` +
      `❤️ ${hero.hp} → **${hero.hp + 20}**`,
    inline: false,
  });

  embed.setFooter({ text: `💡 Use /attack to gain XP and level up your heroes!` });
  embed.setTimestamp();

  const replyOptions: any = { embeds: [embed] };
  if (attachment) {
    replyOptions.files = [attachment];
  }

  await context.interaction.reply(replyOptions);
}
