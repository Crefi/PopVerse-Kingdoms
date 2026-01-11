import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { SHOP_ITEMS, type ShopItemId } from '../../../shared/constants/game.js';
import type { Faction, Resources } from '../../../shared/types/index.js';

const FACTION_COLORS: Record<string, number> = {
  cinema: 0xe74c3c,
  otaku: 0x9b59b6,
  arcade: 0x3498db,
};

export const shopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Buy items with diamonds or gold')
    .addSubcommand(sub =>
      sub.setName('browse')
        .setDescription('Browse available items')
    )
    .addSubcommand(sub =>
      sub.setName('buy')
        .setDescription('Purchase an item')
        .addStringOption(opt =>
          opt.setName('item')
            .setDescription('Item to purchase')
            .setRequired(true)
            .addChoices(
              { name: '📜 Teleport Scroll (100💎)', value: 'teleport_scroll' },
              { name: '⚡ Resource Boost 1h (50💎)', value: 'resource_boost' },
              { name: '🛡️ Peace Shield 8h (150💎)', value: 'shield_8h' },
              { name: '⏩ Speed Up 1h (30💎)', value: 'speed_up_1h' },
              { name: '💊 Healing Salve (5000g)', value: 'troop_heal' },
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('inventory')
        .setDescription('View your purchased items')
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const subcommand = context.interaction.options.getSubcommand();
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players')
      .select('id', 'faction', 'diamonds', 'resources')
      .where('discord_id', discordId)
      .first() as { id: string; faction: Faction; diamonds: number; resources: string | Resources } | undefined;

    if (!player) {
      await context.interaction.reply({
        content: '❌ Use `/begin` to start your journey first!',
        ephemeral: true,
      });
      return;
    }

    switch (subcommand) {
      case 'browse':
        await handleBrowse(context, player);
        break;
      case 'buy':
        await handleBuy(context, player);
        break;
      case 'inventory':
        await handleInventory(context, player);
        break;
    }
  },
};

async function handleBrowse(
  context: CommandContext,
  player: { id: string; faction: Faction; diamonds: number; resources: string | Resources }
): Promise<void> {
  const resources = typeof player.resources === 'string' 
    ? JSON.parse(player.resources) as Resources 
    : player.resources;

  const embed = new EmbedBuilder()
    .setTitle('🏪 Item Shop')
    .setDescription(
      `💎 **${player.diamonds.toLocaleString()}** Diamonds\n` +
      `💰 **${resources.gold.toLocaleString()}** Gold\n\n` +
      `Purchase items to help your kingdom!`
    )
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  // Group items by currency
  const diamondItems = Object.values(SHOP_ITEMS).filter(i => i.diamondCost > 0);
  const goldItems = Object.values(SHOP_ITEMS).filter(i => i.goldCost > 0 && i.diamondCost === 0);

  if (diamondItems.length > 0) {
    const itemList = diamondItems.map(item => 
      `${item.emoji} **${item.name}** — 💎 ${item.diamondCost}\n┗ ${item.description}`
    ).join('\n\n');
    
    embed.addFields({
      name: '💎 Diamond Items',
      value: itemList,
      inline: false,
    });
  }

  if (goldItems.length > 0) {
    const itemList = goldItems.map(item => 
      `${item.emoji} **${item.name}** — 💰 ${item.goldCost.toLocaleString()}\n┗ ${item.description}`
    ).join('\n\n');
    
    embed.addFields({
      name: '💰 Gold Items',
      value: itemList,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Use /shop buy <item> to purchase' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleBuy(
  context: CommandContext,
  player: { id: string; faction: Faction; diamonds: number; resources: string | Resources }
): Promise<void> {
  const itemId = context.interaction.options.getString('item', true) as ShopItemId;
  const item = SHOP_ITEMS[itemId];

  if (!item) {
    await context.interaction.reply({
      content: '❌ Invalid item.',
      ephemeral: true,
    });
    return;
  }

  const db = getDatabase();
  const resources = typeof player.resources === 'string' 
    ? JSON.parse(player.resources) as Resources 
    : player.resources;

  // Check daily purchase limit
  const today = new Date().toISOString().split('T')[0];
  const purchases = await db('shop_purchases')
    .where('player_id', player.id)
    .where('item_id', itemId)
    .whereRaw("DATE(purchased_at) = ?", [today])
    .count('* as count')
    .first() as { count: string };

  const purchaseCount = parseInt(purchases?.count || '0', 10);
  if (purchaseCount >= item.maxDaily) {
    await context.interaction.reply({
      content: `❌ You've reached the daily limit for **${item.name}** (${item.maxDaily}/day).`,
      ephemeral: true,
    });
    return;
  }

  // Check currency
  if (item.diamondCost > 0 && player.diamonds < item.diamondCost) {
    await context.interaction.reply({
      content: `❌ Not enough diamonds! You need 💎 ${item.diamondCost} but have 💎 ${player.diamonds}.`,
      ephemeral: true,
    });
    return;
  }

  if (item.goldCost > 0 && resources.gold < item.goldCost) {
    await context.interaction.reply({
      content: `❌ Not enough gold! You need 💰 ${item.goldCost.toLocaleString()} but have 💰 ${resources.gold.toLocaleString()}.`,
      ephemeral: true,
    });
    return;
  }

  // Deduct currency and add to inventory
  await db.transaction(async (trx) => {
    if (item.diamondCost > 0) {
      await trx('players')
        .where('id', player.id)
        .update({ diamonds: player.diamonds - item.diamondCost });
    }

    if (item.goldCost > 0) {
      await trx('players')
        .where('id', player.id)
        .update({
          resources: JSON.stringify({
            ...resources,
            gold: resources.gold - item.goldCost,
          }),
        });
    }

    // Add to inventory
    const existing = await trx('player_inventory')
      .where('player_id', player.id)
      .where('item_id', itemId)
      .first();

    if (existing) {
      await trx('player_inventory')
        .where('id', existing.id)
        .update({ quantity: existing.quantity + 1 });
    } else {
      await trx('player_inventory').insert({
        player_id: player.id,
        item_id: itemId,
        quantity: 1,
      });
    }

    // Record purchase
    await trx('shop_purchases').insert({
      player_id: player.id,
      item_id: itemId,
      cost_diamonds: item.diamondCost,
      cost_gold: item.goldCost,
    });
  });

  const costText = item.diamondCost > 0 
    ? `💎 ${item.diamondCost}` 
    : `💰 ${item.goldCost.toLocaleString()}`;

  const embed = new EmbedBuilder()
    .setTitle('🛒 Purchase Complete!')
    .setDescription(`You bought **${item.emoji} ${item.name}**!`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Cost', value: costText, inline: true },
      { name: 'Daily Limit', value: `${purchaseCount + 1}/${item.maxDaily}`, inline: true },
    )
    .setFooter({ text: 'Use /shop inventory to see your items' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleInventory(
  context: CommandContext,
  player: { id: string; faction: Faction; diamonds: number; resources: string | Resources }
): Promise<void> {
  const db = getDatabase();
  
  const inventory = await db('player_inventory')
    .where('player_id', player.id)
    .where('quantity', '>', 0) as { item_id: string; quantity: number }[];

  const embed = new EmbedBuilder()
    .setTitle('🎒 Your Inventory')
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  if (inventory.length === 0) {
    embed.setDescription('Your inventory is empty.\nUse `/shop browse` to see available items!');
  } else {
    const itemList = inventory.map(inv => {
      const item = SHOP_ITEMS[inv.item_id as ShopItemId];
      if (!item) return null;
      return `${item.emoji} **${item.name}** × ${inv.quantity}`;
    }).filter(Boolean).join('\n');

    embed.setDescription(itemList || 'No items');
    embed.setFooter({ text: 'Use /teleport to use Teleport Scrolls' });
  }

  await context.interaction.reply({ embeds: [embed] });
}

/**
 * Handle shop button interactions
 */
export async function handleShopButton(
  interaction: ButtonInteraction,
  _action: string,
  _params: string[]
): Promise<void> {
  // Future: Add quick-buy buttons
  await interaction.reply({
    content: '🛒 Use `/shop buy <item>` to purchase items.',
    ephemeral: true,
  });
}
