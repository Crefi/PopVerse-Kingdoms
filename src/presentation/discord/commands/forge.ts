import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { CraftingService, MATERIAL_NAMES } from '../../../domain/services/CraftingService.js';
import type { MaterialType } from '../../../shared/types/index.js';

const data = new SlashCommandBuilder()
  .setName('forge')
  .setDescription('Manage your forge and crafting')
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('View forge status and crafting queue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('recipes')
      .setDescription('View available crafting recipes')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('materials')
      .setDescription('View your crafting materials')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('craft')
      .setDescription('Start crafting an item')
      .addStringOption(option =>
        option
          .setName('recipe')
          .setDescription('Recipe to craft')
          .setRequired(true)
          .addChoices(
            { name: 'Iron Sword (Common)', value: 'iron_sword' },
            { name: 'Leather Armor (Common)', value: 'leather_armor' },
            { name: 'Steel Blade (Uncommon)', value: 'steel_blade' },
            { name: 'Reinforced Armor (Uncommon)', value: 'reinforced_armor' },
            { name: 'Enchanted Blade (Rare)', value: 'enchanted_blade' },
            { name: 'Mystic Robes (Rare)', value: 'mystic_robes' },
            { name: 'Dragonforged Sword (Epic)', value: 'dragonforged_sword' },
            { name: 'Dragonscale Armor (Epic)', value: 'dragonscale_armor' },
            { name: 'Celestial Blade (Legendary)', value: 'celestial_blade' },
            { name: 'Celestial Armor (Legendary)', value: 'celestial_armor' }
          )
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Cancel a crafting job')
      .addIntegerOption(option =>
        option
          .setName('job_id')
          .setDescription('Crafting job ID to cancel')
          .setRequired(true)
      )
  );

async function execute(context: CommandContext): Promise<void> {
  const { interaction } = context;
  const db = getDatabase();
  const craftingService = new CraftingService();
  
  const subcommand = interaction.options.getSubcommand();

  const player = await db('players').select('*').where('discord_id', interaction.user.id).first();
  if (!player) {
    await interaction.reply({ content: 'You need to `/begin` your journey first!', ephemeral: true });
    return;
  }

  switch (subcommand) {
    case 'status':
      await handleStatus(interaction, player.id, craftingService, db);
      break;
    case 'recipes':
      await handleRecipes(interaction, player.id, craftingService, db);
      break;
    case 'materials':
      await handleMaterials(interaction, player.id, craftingService);
      break;
    case 'craft':
      await handleCraft(interaction, player.id, craftingService);
      break;
    case 'cancel':
      await handleCancel(interaction, player.id, craftingService);
      break;
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction, playerId: string, craftingService: CraftingService, db: any): Promise<void> {
  // Get forge building
  const forge = await db('buildings')
    .where('player_id', playerId)
    .where('type', 'forge')
    .first();

  if (!forge) {
    await interaction.reply({
      content: '❌ You need to build a Forge first! Use `/build forge` to construct one (requires HQ 10).',
      ephemeral: true,
    });
    return;
  }

  // Get crafting queue
  const queue = await craftingService.getCraftingQueue(playerId);
  const availableSlots = await craftingService.getAvailableSlots(playerId);

  const embed = new EmbedBuilder()
    .setTitle('🔨 Forge Status')
    .setColor(0xFF6600)
    .addFields(
      { name: '📊 Forge Level', value: `**${forge.level}** / 10`, inline: true },
      { name: '🔧 Crafting Slots', value: `${queue.length} / ${queue.length + availableSlots} in use`, inline: true }
    );

  if (queue.length > 0) {
    let queueText = '';
    for (const job of queue) {
      const recipe = craftingService.getRecipe(job.recipe_id);
      if (recipe) {
        const completesAt = Math.floor(new Date(job.completes_at).getTime() / 1000);
        queueText += `**${recipe.name}** (ID: ${job.id})\n`;
        queueText += `└ Completes <t:${completesAt}:R>\n\n`;
      }
    }
    embed.addFields({ name: '⏳ Active Crafting Jobs', value: queueText, inline: false });
  } else {
    embed.addFields({ name: '⏳ Active Crafting Jobs', value: '*No active jobs*', inline: false });
  }

  embed.setFooter({ text: 'Use /forge craft to start crafting items!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleRecipes(interaction: ChatInputCommandInteraction, playerId: string, craftingService: CraftingService, db: any): Promise<void> {
  // Get forge level
  const forge = await db('buildings')
    .where('player_id', playerId)
    .where('type', 'forge')
    .first();

  if (!forge) {
    await interaction.reply({
      content: '❌ You need to build a Forge first! Use `/build forge` to construct one (requires HQ 10).',
      ephemeral: true,
    });
    return;
  }

  const recipes = craftingService.getRecipes(forge.level);

  const embed = new EmbedBuilder()
    .setTitle('📜 Available Recipes')
    .setDescription(`Showing recipes for Forge Level ${forge.level}`)
    .setColor(0xFF6600);

  // Group by rarity
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  
  for (const rarity of rarities) {
    const rarityRecipes = recipes.filter(r => r.rarity === rarity);
    if (rarityRecipes.length > 0) {
      let recipeText = '';
      for (const recipe of rarityRecipes) {
        const rarityEmoji = getRarityEmoji(recipe.rarity);
        const materialsText = Object.entries(recipe.materialsRequired)
          .map(([mat, qty]) => `${MATERIAL_NAMES[mat as MaterialType]}: ${qty}`)
          .join(', ');
        
        const timeMinutes = Math.floor(recipe.craftingTimeSeconds / 60);
        recipeText += `${rarityEmoji} **${recipe.name}**\n`;
        recipeText += `└ ${materialsText}\n`;
        recipeText += `└ ⏱️ ${timeMinutes}min | 🎲 ${recipe.successRate}% success\n\n`;
      }
      embed.addFields({ name: `${rarity.toUpperCase()}`, value: recipeText, inline: false });
    }
  }

  embed.setFooter({ text: 'Use /forge craft [recipe] to start crafting!' });

  await interaction.reply({ embeds: [embed] });
}

async function handleMaterials(interaction: ChatInputCommandInteraction, playerId: string, craftingService: CraftingService): Promise<void> {
  const materials = await craftingService.getPlayerMaterials(playerId);

  const embed = new EmbedBuilder()
    .setTitle('📦 Crafting Materials')
    .setColor(0xFF6600);

  let materialsText = '';
  for (const [materialType, quantity] of Object.entries(materials)) {
    const name = MATERIAL_NAMES[materialType as MaterialType];
    materialsText += `${name}: **${quantity.toLocaleString()}**\n`;
  }

  embed.setDescription(materialsText || '*No materials*');
  embed.setFooter({ text: 'Materials are obtained by salvaging items or defeating NPCs' });

  await interaction.reply({ embeds: [embed] });
}

async function handleCraft(interaction: ChatInputCommandInteraction, playerId: string, craftingService: CraftingService): Promise<void> {
  const recipeId = interaction.options.getString('recipe', true);

  const result = await craftingService.startCrafting(playerId, recipeId);

  if (result.success) {
    const recipe = craftingService.getRecipe(recipeId);
    if (recipe) {
      const completesAt = Math.floor((Date.now() + recipe.craftingTimeSeconds * 1000) / 1000);
      const embed = new EmbedBuilder()
        .setTitle('🔨 Crafting Started!')
        .setDescription(`Started crafting **${recipe.name}**`)
        .setColor(0x00FF00)
        .addFields(
          { name: '⏱️ Completes', value: `<t:${completesAt}:R>`, inline: true },
          { name: '🎲 Success Rate', value: `${recipe.successRate}%`, inline: true }
        )
        .setFooter({ text: 'Check /forge status to view your crafting queue' });

      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply({ content: result.message });
    }
  } else {
    await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
  }
}

async function handleCancel(interaction: ChatInputCommandInteraction, playerId: string, craftingService: CraftingService): Promise<void> {
  const jobId = interaction.options.getInteger('job_id', true);

  const result = await craftingService.cancelCrafting(jobId);

  if (result.success) {
    await interaction.reply({ content: `✅ ${result.message}` });
  } else {
    await interaction.reply({ content: `❌ ${result.message}`, ephemeral: true });
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

export const forgeCommand: Command = {
  data,
  execute,
  requiresPlayer: true,
};
