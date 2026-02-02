import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { ItemService } from '../../../domain/services/ItemService.js';

const data = new SlashCommandBuilder()
  .setName('loot')
  .setDescription('Generate a random item for your hero')
  .addStringOption(option =>
    option
      .setName('hero')
      .setDescription('Hero name to receive the item')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('slot')
      .setDescription('Specific slot (optional)')
      .setRequired(false)
      .addChoices(
        { name: 'Head', value: 'head' },
        { name: 'Weapon', value: 'weapon' },
        { name: 'Chest', value: 'chest' },
        { name: 'Boots', value: 'boots' },
        { name: 'Ring', value: 'ring' }
      )
  );

async function execute(context: CommandContext): Promise<void> {
  const { interaction } = context;
  const db = getDatabase();
  const itemService = new ItemService(db);
  
  const heroName = interaction.options.getString('hero', true);
  const slot = interaction.options.getString('slot') as any;

  const player = await db('players').select('*').where('discord_id', interaction.user.id).first();
  if (!player) {
    await interaction.reply({ content: 'You need to `/begin` your journey first!', ephemeral: true });
    return;
  }

  const heroes = await db('heroes').select('*').where('player_id', player.id);
  const hero = heroes.find((h: any) => h.name.toLowerCase() === heroName.toLowerCase());

  if (!hero) {
    await interaction.reply({ content: `Hero "${heroName}" not found!`, ephemeral: true });
    return;
  }

  // Generate random item
  const item = await itemService.generateRandomItem(BigInt(hero.id), slot);

  const rarityEmoji = getRarityEmoji(item.rarity);
  const slotEmoji = getSlotEmoji(item.slot);

  const embed = new EmbedBuilder()
    .setTitle('🎁 Item Looted!')
    .setColor(getRarityColor(item.rarity))
    .setDescription(`${rarityEmoji} **${item.name}** ${slotEmoji}`)
    .addFields(
      { name: 'Slot', value: item.slot.toUpperCase(), inline: true },
      { name: 'Rarity', value: item.rarity.toUpperCase(), inline: true },
      { name: 'Level', value: `${item.level}`, inline: true }
    );

  // Add primary stat
  const primaryValue = item.getPrimaryStatValue();
  const primaryDisplay = item.primaryStat.isPercentage 
    ? `${primaryValue}%` 
    : `+${primaryValue}`;
  
  embed.addFields({
    name: '📊 Primary Stat',
    value: `${getStatEmoji(item.primaryStat.stat)} ${item.primaryStat.stat}: ${primaryDisplay}`,
    inline: false,
  });

  // Add secondary stats
  if (item.secondaryStats.length > 0) {
    let secondaryText = '';
    item.secondaryStats.forEach((stat, index) => {
      const value = item.getSecondaryStatValue(index);
      const displayValue = stat.isPercentage ? `${value}%` : `+${value}`;
      secondaryText += `${getStatEmoji(stat.stat)} ${stat.stat}: ${displayValue}\n`;
    });

    embed.addFields({
      name: '📊 Secondary Stats',
      value: secondaryText,
      inline: false,
    });
  }

  embed.addFields({
    name: '⚡ Power',
    value: `${item.getPower()}`,
    inline: true,
  });

  embed.addFields({
    name: 'Item ID',
    value: `${item.id}`,
    inline: true,
  });

  embed.setFooter({ text: `Use /gear equip hero:${heroName} item_id:${item.id} to equip this item` });

  await interaction.reply({ embeds: [embed] });
}

function getRarityEmoji(rarity: string): string {
  const emojis: Record<string, string> = {
    common: '⚪',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟠',
  };
  return emojis[rarity] || '⚪';
}

function getSlotEmoji(slot: string): string {
  const emojis: Record<string, string> = {
    head: '🪖',
    weapon: '⚔️',
    chest: '🛡️',
    boots: '👢',
    ring: '💍',
  };
  return emojis[slot] || '📦';
}

function getStatEmoji(stat: string): string {
  const emojis: Record<string, string> = {
    attack: '⚔️',
    defense: '🛡️',
    hp: '❤️',
    speed: '⚡',
    crit_rate: '🎯',
    crit_damage: '💥',
    accuracy: '🔍',
    resistance: '🧱',
  };
  return emojis[stat] || '📊';
}

function getRarityColor(rarity: string): number {
  const colors: Record<string, number> = {
    common: 0x808080,
    rare: 0x0070DD,
    epic: 0xA335EE,
    legendary: 0xFF8000,
  };
  return colors[rarity] || 0x808080;
}

export const lootCommand: Command = {
  data: data as SlashCommandBuilder,
  execute,
  requiresPlayer: true,
};
