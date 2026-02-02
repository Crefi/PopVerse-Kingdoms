import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { CraftingService, MATERIAL_NAMES } from '../../../domain/services/CraftingService.js';
import type { MaterialType } from '../../../shared/types/index.js';

const data = new SlashCommandBuilder()
  .setName('salvage')
  .setDescription('Break down items for crafting materials')
  .addIntegerOption(option =>
    option
      .setName('item_id')
      .setDescription('Item ID to salvage')
      .setRequired(true)
  ) as SlashCommandBuilder;

async function execute(context: CommandContext): Promise<void> {
  const { interaction } = context;
  const db = getDatabase();
  const craftingService = new CraftingService();
  
  const itemId = interaction.options.getInteger('item_id', true);

  const player = await db('players').select('*').where('discord_id', interaction.user.id).first();
  if (!player) {
    await interaction.reply({ content: 'You need to `/begin` your journey first!', ephemeral: true });
    return;
  }

  // Get the item
  const item = await db('items')
    .where('id', itemId)
    .where('player_id', player.id)
    .first();

  if (!item) {
    await interaction.reply({ content: '❌ Item not found or does not belong to you!', ephemeral: true });
    return;
  }

  // Check if equipped
  const isEquipped = await db('hero_equipment')
    .where('item_id', itemId)
    .first();

  if (isEquipped) {
    await interaction.reply({ content: '❌ Cannot salvage equipped items. Unequip it first!', ephemeral: true });
    return;
  }

  // Check if locked
  if (item.locked) {
    await interaction.reply({ content: '❌ Cannot salvage locked items. Unlock it first!', ephemeral: true });
    return;
  }

  // Calculate potential materials
  const salvageData = await craftingService.salvageItem(player.id, itemId.toString());
  
  // Rollback the salvage (we'll do it after confirmation)
  if (salvageData.success && salvageData.materials) {
    // Re-create the item since we salvaged it
    await db('items').insert({
      id: itemId,
      player_id: player.id,
      name: item.name,
      type: item.type,
      slot: item.slot,
      rarity: item.rarity,
      level: item.level,
      primary_stat: item.primary_stat,
      secondary_stats: item.secondary_stats,
      locked: item.locked,
      equipped: item.equipped,
    });

    // Remove the materials we added
    await craftingService.removeMaterials(player.id, salvageData.materials);

    // Show confirmation prompt
    const materialsText = Object.entries(salvageData.materials)
      .map(([mat, qty]) => `${MATERIAL_NAMES[mat as MaterialType]}: **${qty}**`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🔨 Salvage Item?')
      .setDescription(`Are you sure you want to salvage **${item.name}**?`)
      .setColor(0xFF6600)
      .addFields(
        { name: '📦 Item', value: `${getRarityEmoji(item.rarity)} **${item.name}** (Level ${item.level})`, inline: false },
        { name: '✨ Materials Gained', value: materialsText, inline: false }
      )
      .setFooter({ text: 'This action cannot be undone!' });

    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_salvage')
      .setLabel('Salvage')
      .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_salvage')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(confirmButton, cancelButton);

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });

    // Wait for button interaction
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        componentType: ComponentType.Button,
        time: 30000, // 30 seconds
      });

      if (confirmation.customId === 'confirm_salvage') {
        // Actually salvage the item
        const finalResult = await craftingService.salvageItem(player.id, itemId.toString());

        if (finalResult.success && finalResult.materials) {
          const finalMaterialsText = Object.entries(finalResult.materials)
            .map(([mat, qty]) => `${MATERIAL_NAMES[mat as MaterialType]}: **+${qty}**`)
            .join('\n');

          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Item Salvaged!')
            .setDescription(`Successfully salvaged **${item.name}**`)
            .setColor(0x00FF00)
            .addFields({ name: '✨ Materials Gained', value: finalMaterialsText, inline: false })
            .setFooter({ text: 'Use /forge materials to view your materials' });

          await confirmation.update({ embeds: [successEmbed], components: [] });
        } else {
          await confirmation.update({ content: `❌ ${finalResult.message}`, embeds: [], components: [] });
        }
      } else {
        await confirmation.update({ content: '❌ Salvage cancelled.', embeds: [], components: [] });
      }
    } catch (error) {
      // Timeout - no response
      await interaction.editReply({ content: '❌ Salvage cancelled (timeout).', embeds: [], components: [] });
    }
  } else {
    await interaction.reply({ content: `❌ ${salvageData.message}`, ephemeral: true });
  }
}

function getRarityEmoji(rarity: string): string {
  const emojis: Record<string, string> = {
    common: '⚪',
    uncommon: '🟢',
    rare: '🔵',
    epic: '🟣',
    legendary: '🟠',
  };
  return emojis[rarity] || '⚪';
}

export const salvageCommand: Command = {
  data,
  execute,
  requiresPlayer: true,
};
