import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import type { Faction, Element, HeroRarity } from '../../../shared/types/index.js';

const ELEMENT_EMOJIS: Record<Element, string> = {
  fire: '🔥',
  wind: '💨',
  water: '💧',
};

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
}

export const heroesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('heroes')
    .setDescription('View your hero roster'),

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players').select('id', 'username').where('discord_id', discordId).first();
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

    const embed = new EmbedBuilder()
      .setTitle(`🦸 ${player.username}'s Heroes`)
      .setColor('#FFD700')
      .setDescription(`You have **${heroes.length}** hero${heroes.length > 1 ? 'es' : ''}`);

    // Group heroes by rarity
    const legendary = heroes.filter(h => h.rarity === 'legendary');
    const epic = heroes.filter(h => h.rarity === 'epic');
    const rare = heroes.filter(h => h.rarity === 'rare');
    const common = heroes.filter(h => h.rarity === 'common');

    const formatHero = (h: HeroRow): string => {
      const power = h.attack + h.defense + h.speed + Math.floor(h.hp / 10);
      return `${ELEMENT_EMOJIS[h.element]} **${h.name}** Lv.${h.level} (${power} power)`;
    };

    if (legendary.length > 0) {
      embed.addFields({
        name: '🟨 Legendary',
        value: legendary.map(formatHero).join('\n'),
        inline: false,
      });
    }

    if (epic.length > 0) {
      embed.addFields({
        name: '🟪 Epic',
        value: epic.map(formatHero).join('\n'),
        inline: false,
      });
    }

    if (rare.length > 0) {
      embed.addFields({
        name: '🟦 Rare',
        value: rare.map(formatHero).join('\n'),
        inline: false,
      });
    }

    if (common.length > 0) {
      embed.addFields({
        name: '⬜ Common',
        value: common.map(formatHero).join('\n'),
        inline: false,
      });
    }

    // Show detailed stats for top hero
    const topHero = heroes[0];
    embed.addFields({
      name: `📊 ${topHero.name} Stats`,
      value: `⚔️ Attack: ${topHero.attack}\n🛡️ Defense: ${topHero.defense}\n💨 Speed: ${topHero.speed}\n❤️ HP: ${topHero.hp}\n⭐ XP: ${topHero.experience}`,
      inline: false,
    });

    embed.setFooter({ text: 'Use /attack with a hero name to send them into battle!' });
    embed.setTimestamp();

    await context.interaction.reply({ embeds: [embed] });
  },
};
