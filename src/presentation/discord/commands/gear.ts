import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { ItemService } from '../../../domain/services/ItemService.js';
import { Item } from '../../../domain/entities/Item.js';



const data = new SlashCommandBuilder()
  .setName('gear')
  .setDescription('Manage your hero gear and items')
  .addSubcommand(subcommand =>
    subcommand
      .setName('view')
      .setDescription('View equipped gear for a hero')
      .addStringOption(option =>
        option
          .setName('hero')
          .setDescription('Hero name')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('inventory')
      .setDescription('View all items for a hero')
      .addStringOption(option =>
        option
          .setName('hero')
          .setDescription('Hero name')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('equip')
      .setDescription('Equip an item')
      .addStringOption(option =>
        option
          .setName('hero')
          .setDescription('Hero name')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('item_id')
          .setDescription('Item ID to equip')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('unequip')
      .setDescription('Unequip an item')
      .addStringOption(option =>
        option
          .setName('hero')
          .setDescription('Hero name')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('slot')
          .setDescription('Slot to unequip')
          .setRequired(true)
          .addChoices(
            { name: 'Head', value: 'head' },
            { name: 'Weapon', value: 'weapon' },
            { name: 'Chest', value: 'chest' },
            { name: 'Boots', value: 'boots' },
            { name: 'Ring', value: 'ring' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('upgrade')
      .setDescription('Upgrade an item')
      .addStringOption(option =>
        option
          .setName('hero')
          .setDescription('Hero name')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('item_id')
          .setDescription('Item ID to upgrade')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('sell')
      .setDescription('Sell an item for gold')
      .addStringOption(option =>
        option
          .setName('hero')
          .setDescription('Hero name')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('item_id')
          .setDescription('Item ID to sell')
          .setRequired(true)
      )
  );

async function execute(context: CommandContext): Promise<void> {
  const { interaction } = context;
  const db = getDatabase();
  const itemService = new ItemService(db);
  
  const subcommand = interaction.options.getSubcommand();
  const heroName = interaction.options.getString('hero', true);

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

  switch (subcommand) {
    case 'view':
      await handleView(interaction, BigInt(hero.id), itemService);
      break;
    case 'inventory':
      await handleInventory(interaction, BigInt(hero.id), heroName, itemService);
      break;
    case 'equip':
      await handleEquip(interaction, BigInt(hero.id), BigInt(player.id), itemService);
      break;
    case 'unequip':
      await handleUnequip(interaction, BigInt(hero.id), itemService);
      break;
    case 'upgrade':
      await handleUpgrade(interaction, BigInt(hero.id), player, itemService, db);
      break;
    case 'sell':
      await handleSell(interaction, BigInt(hero.id), player, itemService, db);
      break;
  }
}

async function handleView(interaction: ChatInputCommandInteraction, heroId: bigint, itemService: ItemService): Promise<void> {
  const equippedItems = await itemService.getEquippedItems(heroId);

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Equipped Gear')
    .setColor(0x00AE86);

  if (equippedItems.length === 0) {
    embed.setDescription('No items equipped');
  } else {
    const slots = ['head', 'weapon', 'chest', 'boots', 'ring'];
    const slotEmojis = { head: '🪖', weapon: '⚔️', chest: '🛡️', boots: '👢', ring: '💍' };

    for (const slot of slots) {
      const item = equippedItems.find(i => i.slot === slot);
      if (item) {
        const rarityEmoji = getRarityEmoji(item.rarity);
        const primaryValue = item.getPrimaryStatValue();
        const primaryStat = item.primaryStat.isPercentage 
          ? `${primaryValue}%` 
          : `+${primaryValue}`;

        let fieldValue = `${rarityEmoji} **${item.name}** (Lvl ${item.level})\n`;
        fieldValue += `${getStatEmoji(item.primaryStat.stat)} ${item.primaryStat.stat}: ${primaryStat}\n`;

        item.secondaryStats.forEach((stat, index) => {
          const value = item.getSecondaryStatValue(index);
          const displayValue = stat.isPercentage ? `${value}%` : `+${value}`;
          fieldValue += `${getStatEmoji(stat.stat)} ${stat.stat}: ${displayValue}\n`;
        });

        fieldValue += `⚡ Power: ${item.getPower()}`;

        embed.addFields({ 
          name: `${slotEmojis[slot as keyof typeof slotEmojis]} ${slot.toUpperCase()}`, 
          value: fieldValue, 
          inline: true 
        });
      } else {
        embed.addFields({ 
          name: `${slotEmojis[slot as keyof typeof slotEmojis]} ${slot.toUpperCase()}`, 
          value: '*Empty*', 
          inline: true 
        });
      }
    }
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleInventory(interaction: ChatInputCommandInteraction, heroId: bigint, heroName: string, itemService: ItemService): Promise<void> {
  const items = await itemService.getHeroItems(heroId);

  if (items.length === 0) {
    await interaction.reply({ content: 'This hero has no items!', ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📦 ${heroName}'s Inventory`)
    .setColor(0x00AE86);

  // Group by slot
  const slots = ['head', 'weapon', 'chest', 'boots', 'ring'];
  
  for (const slot of slots) {
    const slotItems = items.filter(i => i.slot === slot);
    if (slotItems.length > 0) {
      let fieldValue = '';
      slotItems.forEach(item => {
        const rarityEmoji = getRarityEmoji(item.rarity);
        const equippedMark = item.equipped ? '✅ ' : '';
        fieldValue += `${equippedMark}${rarityEmoji} **${item.name}** (ID: ${item.id}) - Lvl ${item.level}\n`;
      });
      embed.addFields({ name: slot.toUpperCase(), value: fieldValue, inline: false });
    }
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleEquip(interaction: ChatInputCommandInteraction, heroId: bigint, playerId: bigint, itemService: ItemService): Promise<void> {
  const itemId = BigInt(interaction.options.getInteger('item_id', true));
  
  const result = await itemService.equipItem(itemId, heroId);
  
  await interaction.reply({ 
    content: result.message, 
    ephemeral: !result.success 
  });
}

async function handleUnequip(interaction: ChatInputCommandInteraction, heroId: bigint, itemService: ItemService): Promise<void> {
  const slot = interaction.options.getString('slot', true);
  
  const equippedItems = await itemService.getEquippedItems(heroId);
  const item = equippedItems.find(i => i.slot === slot);

  if (!item) {
    await interaction.reply({ content: `No item equipped in ${slot} slot!`, ephemeral: true });
    return;
  }

  const result = await itemService.unequipItem(item.id, heroId);
  
  await interaction.reply({ 
    content: result.message, 
    ephemeral: !result.success 
  });
}

async function handleUpgrade(interaction: ChatInputCommandInteraction, heroId: bigint, player: any, itemService: ItemService, db: any): Promise<void> {
  const itemId = BigInt(interaction.options.getInteger('item_id', true));
  
  const item = await itemService.getItem(itemId);
  if (!item) {
    await interaction.reply({ content: 'Item not found!', ephemeral: true });
    return;
  }

  const upgradeCost = item.getUpgradeCost();
  const resources = typeof player.resources === 'string' ? JSON.parse(player.resources) : player.resources;
  const playerGold = resources.gold || 0;

  const result = await itemService.upgradeItem(itemId, heroId, playerGold);
  
  if (result.success && result.goldSpent) {
    // Deduct gold from player
    resources.gold -= result.goldSpent;
    await db('players').where('id', player.id).update({ resources: JSON.stringify(resources) });
  }

  await interaction.reply({ 
    content: result.message, 
    ephemeral: !result.success 
  });
}

async function handleSell(interaction: ChatInputCommandInteraction, heroId: bigint, player: any, itemService: ItemService, db: any): Promise<void> {
  const itemId = BigInt(interaction.options.getInteger('item_id', true));
  
  const result = await itemService.sellItem(itemId, heroId);
  
  if (result.success && result.goldEarned) {
    // Add gold to player
    const resources = typeof player.resources === 'string' ? JSON.parse(player.resources) : player.resources;
    resources.gold = (resources.gold || 0) + result.goldEarned;
    await db('players').where('id', player.id).update({ resources: JSON.stringify(resources) });
  }

  await interaction.reply({ 
    content: result.message, 
    ephemeral: !result.success 
  });
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

export const gearCommand: Command = {
  data,
  execute,
  requiresPlayer: true,
};
