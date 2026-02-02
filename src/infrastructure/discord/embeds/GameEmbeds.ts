import { EmbedBuilder, type ColorResolvable } from 'discord.js';
import type { Faction, Resources } from '../../../shared/types/index.js';
import { getHeroImageUrl } from '../../database/seeds/002_hero_templates.js';

// Faction colors - vibrant and distinct
const FACTION_COLORS: Record<Faction, ColorResolvable> = {
  cinema: '#E74C3C',  // Vibrant Red
  anime: '#2ECC71',   // Emerald Green
  gamer: '#3498DB',  // Bright Blue
};

const FACTION_EMOJIS: Record<Faction, string> = {
  cinema: '🎬',
  anime: '⚔️',
  gamer: '🎮',
};

const FACTION_NAMES: Record<Faction, string> = {
  cinema: 'Cinema',
  anime: 'Otaku',
  gamer: 'Arcade',
};

export class GameEmbeds {
  static welcome(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('⚔️ PopVerse Kingdoms')
      .setDescription(
        'Welcome, Future Captain!\n\n' +
        'Command heroes from across the multiverse and build your empire!\n\n' +
        '**Choose your faction wisely** — this choice is permanent for the season!'
      )
      .addFields(
        {
          name: '🎬 CINEMA',
          value: '**Fire Element**\n+10% Attack Power\nAggressive Playstyle\n\n*Starter:* John McClane',
          inline: true,
        },
        {
          name: '⚔️ OTAKU',
          value: '**Wind Element**\n+15% March Speed\nHit-and-Run Tactics\n\n*Starter:* Naruto Uzumaki',
          inline: true,
        },
        {
          name: '🎮 ARCADE',
          value: '**Water Element**\n+10% Defense\nTank Playstyle\n\n*Starter:* Mario',
          inline: true,
        }
      )
      .setColor('#FFD700')
      .setFooter({ text: '🎮 Click a button below to choose your destiny!' });
  }

  static factionSelected(faction: Faction, heroName: string, coordinates: { x: number; y: number }): EmbedBuilder {
    const bonuses: Record<Faction, string> = {
      cinema: '+10% Attack to all armies',
      anime: '+15% March Speed',
      gamer: '+10% Defense to all armies',
    };

    const embed = new EmbedBuilder()
      .setTitle(`${FACTION_EMOJIS[faction]} Welcome to ${FACTION_NAMES[faction]}!`)
      .setDescription(`🎉 **Registration Complete!**\n\nYou've received your starter hero and established your base!`)
      .addFields(
        {
          name: '🦸 Your Starter Hero',
          value: `**${heroName}**\nA legendary warrior ready to fight for your cause!`,
          inline: false,
        },
        {
          name: '📍 City Location',
          value: `\`(${coordinates.x}, ${coordinates.y})\`\nIn the Spawn Zone`,
          inline: true,
        },
        {
          name: '⚡ Faction Bonus',
          value: bonuses[faction],
          inline: true,
        },
        {
          name: '🛡️ Protection Active',
          value: '24 hours of immunity from attacks!',
          inline: false,
        }
      )
      .setColor(FACTION_COLORS[faction])
      .setFooter({ text: 'Use /tutorial to learn the basics • Good luck, Captain!' })
      .setTimestamp();

    // Add hero image if available
    const heroImage = getHeroImageUrl(heroName);
    if (heroImage) {
      embed.setThumbnail(heroImage);
    }

    return embed;
  }

  static cityStatus(
    username: string,
    faction: Faction,
    hqLevel: number,
    coordinates: { x: number; y: number },
    resources: Resources,
    buildings: { type: string; level: number }[],
    diamonds: number = 0
  ): EmbedBuilder {
    const buildingEmojis: Record<string, string> = {
      hq: '🏛️',
      barracks: '⚔️',
      farm: '🌾',
      mine: '⛏️',
      market: '🏪',
      wall: '🧱',
      hospital: '🏥',
      academy: '📚',
    };

    const buildingList = buildings.length > 0
      ? buildings.map((b) => `${buildingEmojis[b.type] || '🏗️'} ${b.type.charAt(0).toUpperCase() + b.type.slice(1)}: Lv.${b.level}`).join('\n')
      : '*No buildings yet*';

    const resourceBar = (current: number, emoji: string) => {
      return `${emoji} **${current.toLocaleString()}**`;
    };

    return new EmbedBuilder()
      .setTitle(`🏰 ${username}'s Kingdom`)
      .setDescription(
        `${FACTION_EMOJIS[faction]} **${FACTION_NAMES[faction]}** Faction\n` +
        `📍 Location: \`(${coordinates.x}, ${coordinates.y})\``
      )
      .addFields(
        {
          name: '📦 Resources',
          value: [
            resourceBar(resources.food, '🌾'),
            resourceBar(resources.iron, '⚒️'),
            resourceBar(resources.gold, '💰'),
            resourceBar(diamonds, '💎'),
          ].join('\n'),
          inline: true,
        },
        {
          name: `🏛️ HQ Level ${hqLevel}`,
          value: buildingList,
          inline: true,
        }
      )
      .setColor(FACTION_COLORS[faction])
      .setTimestamp()
      .setFooter({ text: 'Use /build to construct • /train to recruit troops' });
  }

  static heroCard(
    name: string,
    faction: Faction,
    rarity: string,
    level: number,
    stats: { attack: number; defense: number; speed: number; hp: number },
    power: number
  ): EmbedBuilder {
    const rarityColors: Record<string, ColorResolvable> = {
      common: '#9E9E9E',
      rare: '#2196F3',
      epic: '#9C27B0',
      legendary: '#FF9800',
    };

    const rarityStars: Record<string, string> = {
      common: '⭐',
      rare: '⭐⭐',
      epic: '⭐⭐⭐',
      legendary: '⭐⭐⭐⭐',
    };

    return new EmbedBuilder()
      .setTitle(`${FACTION_EMOJIS[faction]} ${name}`)
      .setDescription(
        `${rarityStars[rarity] || '⭐'} **${rarity.toUpperCase()}**\n` +
        `Level **${level}** / 50`
      )
      .addFields(
        {
          name: '📊 Stats',
          value: [
            `⚔️ ATK: **${stats.attack}**`,
            `🛡️ DEF: **${stats.defense}**`,
            `💨 SPD: **${stats.speed}**`,
            `❤️ HP: **${stats.hp}**`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💪 Power',
          value: `**${power.toLocaleString()}**`,
          inline: true,
        }
      )
      .setColor(rarityColors[rarity] || '#9E9E9E');
  }

  static battleReport(
    winner: 'attacker' | 'defender',
    attackerName: string,
    defenderName: string,
    attackerPower: number,
    defenderPower: number,
    attackerLosses: number,
    defenderLosses: number,
    loot: Resources
  ): EmbedBuilder {
    const isVictory = winner === 'attacker';

    return new EmbedBuilder()
      .setTitle(`⚔️ Battle Report: ${isVictory ? '✅ Victory!' : '❌ Defeat'}`)
      .setDescription(`**${attackerName}** vs **${defenderName}**`)
      .addFields(
        {
          name: `⚔️ ${attackerName}`,
          value: `Power: **${attackerPower.toLocaleString()}**\nLosses: **${attackerLosses.toLocaleString()}** troops`,
          inline: true,
        },
        {
          name: `🛡️ ${defenderName}`,
          value: `Power: **${defenderPower.toLocaleString()}**\nLosses: **${defenderLosses.toLocaleString()}** troops`,
          inline: true,
        },
        {
          name: '💰 Loot',
          value: isVictory
            ? `🌾 ${loot.food.toLocaleString()}\n⚒️ ${loot.iron.toLocaleString()}\n💰 ${loot.gold.toLocaleString()}`
            : '*No loot captured*',
          inline: false,
        }
      )
      .setColor(isVictory ? '#2ECC71' : '#E74C3C')
      .setTimestamp();
  }

  static dailyRewards(
    day: number,
    isNewbie: boolean,
    rewards: { food: number; iron: number; gold: number; diamonds: number },
    streakBonus: number
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🎁 Daily Rewards')
      .setColor('#FFD700');

    if (isNewbie) {
      embed.setDescription(
        `**Day ${day}/7** of Newbie Bonus!\n` +
        '```diff\n+ Special rewards for new players!\n```'
      );
    } else {
      embed.setDescription(
        `**Daily Login Reward**\n` +
        (streakBonus > 0 ? `🔥 Streak Bonus: +${streakBonus}%` : '')
      );
    }

    embed.addFields({
      name: '📦 Rewards Claimed',
      value: [
        rewards.food > 0 ? `🌾 **${rewards.food.toLocaleString()}** Food` : null,
        rewards.iron > 0 ? `⚒️ **${rewards.iron.toLocaleString()}** Iron` : null,
        rewards.gold > 0 ? `💰 **${rewards.gold.toLocaleString()}** Gold` : null,
        rewards.diamonds > 0 ? `💎 **${rewards.diamonds.toLocaleString()}** Diamonds` : null,
      ].filter(Boolean).join('\n'),
      inline: false,
    });

    return embed;
  }

  static questList(
    quests: { name: string; description: string; progress: number; target: number; reward: number; completed: boolean }[]
  ): EmbedBuilder {
    const questLines = quests.map((q) => {
      const progressBar = createProgressBar(q.progress, q.target);
      const status = q.completed ? '✅' : '⬜';
      return `${status} **${q.name}**\n${q.description}\n${progressBar} \`${q.progress}/${q.target}\` — 💎 ${q.reward}`;
    });

    return new EmbedBuilder()
      .setTitle('📋 Daily Quests')
      .setDescription(questLines.join('\n\n'))
      .setColor('#3498DB')
      .setFooter({ text: 'Quests reset daily at midnight UTC' });
  }

  static arenaOpponents(
    opponents: { name: string; tier: string; power: number; defense: string[]; isBot: boolean }[],
    tokens: number,
    freeMatches: number
  ): EmbedBuilder {
    const opponentList = opponents
      .map(
        (o, i) =>
          `**${i + 1}.** ${o.isBot ? '🤖 ' : ''}${o.name}\n` +
          `   └ ${o.tier} • Power: **${o.power.toLocaleString()}**`
      )
      .join('\n\n');

    return new EmbedBuilder()
      .setTitle('🏟️ Arena Challengers')
      .setDescription(opponentList || '*No opponents available*')
      .setColor('#9B59B6')
      .addFields({
        name: '📊 Your Status',
        value: `🎫 Tokens: **${tokens}/10**\n🆓 Free Matches: **${freeMatches}/5**`,
        inline: false,
      })
      .setFooter({ text: 'Use /arena fight [number] to challenge!' });
  }

  static error(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setDescription(`❌ ${message}`)
      .setColor('#E74C3C');
  }

  static success(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`✅ ${title}`)
      .setDescription(message)
      .setColor('#2ECC71');
  }

  static info(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`ℹ️ ${title}`)
      .setDescription(message)
      .setColor('#3498DB');
  }

  static warning(title: string, message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`⚠️ ${title}`)
      .setDescription(message)
      .setColor('#F39C12');
  }
}

function createProgressBar(current: number, max: number, length: number = 10): string {
  const progress = Math.min(current / max, 1);
  const filled = Math.round(progress * length);
  const empty = length - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}
