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
  common: 0x95a5a6,
  rare: 0x3498db,
  epic: 0x9b59b6,
  legendary: 0xf1c40f,
};

const RARITY_EMOJIS: Record<HeroRarity, string> = {
  common: '⬜',
  rare: '🟦',
  epic: '🟪',
  legendary: '🟨',
};

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

export const heroCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('hero')
    .setDescription('View detailed stats for a specific hero')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Select a hero')
        .setRequired(true)
        .setAutocomplete(true)
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;
    const heroName = context.interaction.options.getString('name', true);

    const player = await db('players').select('id', 'username').where('discord_id', discordId).first();
    if (!player) {
      await context.interaction.reply({ 
        content: '❌ Use `/begin` to start!', 
        flags: 64 // MessageFlags.Ephemeral
      });
      return;
    }

    const heroes: HeroRow[] = await db('heroes')
      .select('*')
      .where('player_id', player.id);

    if (heroes.length === 0) {
      await context.interaction.reply({ 
        content: '❌ You have no heroes!', 
        flags: 64 // MessageFlags.Ephemeral
      });
      return;
    }

    // Find hero by name (case insensitive, partial match)
    const hero = heroes.find(h => h.name.toLowerCase().includes(heroName.toLowerCase()));
    
    if (!hero) {
      const heroList = heroes.map(h => h.name).join(', ');
      await context.interaction.reply({ 
        content: `❌ Hero "${heroName}" not found!\n\n**Your heroes:** ${heroList}`, 
        flags: 64 // MessageFlags.Ephemeral
      });
      return;
    }

    await showHeroDetails(context, hero, player.username);
  },

  async autocomplete(interaction): Promise<void> {
    const db = getDatabase();
    const discordId = interaction.user.id;
    const focusedValue = interaction.options.getFocused().toLowerCase();

    console.log(`[HERO AUTOCOMPLETE] User: ${discordId}, Search: "${focusedValue}"`);

    try {
      const player = await db('players').select('id').where('discord_id', discordId).first();
      if (!player) {
        console.log('[HERO AUTOCOMPLETE] No player found');
        await interaction.respond([]);
        return;
      }

      const heroes: HeroRow[] = await db('heroes')
        .select('id', 'name', 'level', 'element', 'rarity')
        .where('player_id', player.id)
        .orderBy('rarity', 'desc')
        .orderBy('level', 'desc');

      console.log(`[HERO AUTOCOMPLETE] Found ${heroes.length} heroes`);

      // If no search term, show all heroes (up to 25)
      // If search term exists, filter by name
      const filtered = heroes
        .filter(h => !focusedValue || h.name.toLowerCase().includes(focusedValue))
        .slice(0, 25) // Discord limit
        .map(h => ({
          name: `${ELEMENT_EMOJIS[h.element]} ${h.name} (Lv.${h.level})`,
          value: h.name,
        }));

      console.log(`[HERO AUTOCOMPLETE] Responding with ${filtered.length} options`);
      await interaction.respond(filtered);
    } catch (error) {
      console.error('[HERO AUTOCOMPLETE] Error:', error);
      await interaction.respond([]);
    }
  },
};

async function showHeroDetails(context: CommandContext, hero: HeroRow, playerName: string): Promise<void> {
  const power = hero.attack + hero.defense + hero.speed + Math.floor(hero.hp / 10);
  const xpToNext = (hero.level + 1) * 100;
  const xpProgress = Math.min(100, Math.max(0, Math.floor((hero.experience / xpToNext) * 100)));
  
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

  // Level & XP Progress - ensure positive values
  const barFilled = Math.max(0, Math.floor(xpProgress / 5));
  const barEmpty = Math.max(0, 20 - barFilled);
  const xpBar = '█'.repeat(barFilled) + '░'.repeat(barEmpty);
  
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
      name: '🛡️ Defense',
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
    const equipmentLines = [];
    if (hasWeapon) {
      equipmentLines.push(`⚔️ **${gear.weapon.name}** (+${gear.weapon.power} ATK)`);
    }
    if (hasArmor) {
      equipmentLines.push(`🛡️ **${gear.armor.name}** (+${gear.armor.power} DEF)`);
    }
    
    embed.addFields({
      name: '🎒 Equipment',
      value: equipmentLines.join('\n') || 'None',
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
    name: `📈 Level ${hero.level + 1} Preview`,
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
