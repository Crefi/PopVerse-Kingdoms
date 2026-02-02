import { getDatabase } from '../../infrastructure/database/connection.js';
import { logger } from '../../shared/utils/logger.js';
import type { MaterialType, CraftingRecipe } from '../../shared/types/index.js';

// Material drop rates from salvaging items by rarity
export const SALVAGE_MATERIALS: Record<string, { min: number; max: number; materials: MaterialType[] }> = {
  common: { min: 5, max: 10, materials: ['leather_scraps', 'iron_ingots'] },
  uncommon: { min: 15, max: 25, materials: ['leather_scraps', 'iron_ingots', 'mystic_essence'] },
  rare: { min: 30, max: 50, materials: ['iron_ingots', 'mystic_essence'] },
  epic: { min: 60, max: 100, materials: ['mystic_essence', 'dragon_scales'] },
  legendary: { min: 150, max: 250, materials: ['dragon_scales', 'celestial_fragments'] },
};

// Material names for display
export const MATERIAL_NAMES: Record<MaterialType, string> = {
  leather_scraps: '🧵 Leather Scraps',
  iron_ingots: '⚙️ Iron Ingots',
  mystic_essence: '✨ Mystic Essence',
  dragon_scales: '🐉 Dragon Scales',
  celestial_fragments: '⭐ Celestial Fragments',
};

// Crafting recipes (will be loaded from database)
const RECIPES: CraftingRecipe[] = [
  // Common weapons
  {
    recipeId: 'iron_sword',
    name: 'Iron Sword',
    description: 'A basic iron sword',
    itemType: 'weapon',
    rarity: 'common',
    forgeLevelRequired: 1,
    materialsRequired: { iron_ingots: 10, leather_scraps: 5 },
    craftingTimeSeconds: 300, // 5 minutes
    successRate: 95,
    statRanges: { attack: { min: 10, max: 15 } },
  },
  {
    recipeId: 'leather_armor',
    name: 'Leather Armor',
    description: 'Basic leather protection',
    itemType: 'armor',
    rarity: 'common',
    forgeLevelRequired: 1,
    materialsRequired: { leather_scraps: 15 },
    craftingTimeSeconds: 300,
    successRate: 95,
    statRanges: { defense: { min: 8, max: 12 } },
  },
  // Uncommon items
  {
    recipeId: 'steel_blade',
    name: 'Steel Blade',
    description: 'A well-crafted steel weapon',
    itemType: 'weapon',
    rarity: 'uncommon',
    forgeLevelRequired: 3,
    materialsRequired: { iron_ingots: 25, mystic_essence: 5 },
    craftingTimeSeconds: 900, // 15 minutes
    successRate: 85,
    statRanges: { attack: { min: 20, max: 30 } },
  },
  {
    recipeId: 'reinforced_armor',
    name: 'Reinforced Armor',
    description: 'Sturdy reinforced protection',
    itemType: 'armor',
    rarity: 'uncommon',
    forgeLevelRequired: 3,
    materialsRequired: { iron_ingots: 20, leather_scraps: 15, mystic_essence: 3 },
    craftingTimeSeconds: 900,
    successRate: 85,
    statRanges: { defense: { min: 18, max: 25 } },
  },
  // Rare items
  {
    recipeId: 'enchanted_blade',
    name: 'Enchanted Blade',
    description: 'A magically enhanced weapon',
    itemType: 'weapon',
    rarity: 'rare',
    forgeLevelRequired: 5,
    materialsRequired: { iron_ingots: 40, mystic_essence: 15 },
    craftingTimeSeconds: 1800, // 30 minutes
    successRate: 75,
    statRanges: { attack: { min: 35, max: 50 } },
  },
  {
    recipeId: 'mystic_robes',
    name: 'Mystic Robes',
    description: 'Robes infused with magic',
    itemType: 'armor',
    rarity: 'rare',
    forgeLevelRequired: 5,
    materialsRequired: { leather_scraps: 30, mystic_essence: 20 },
    craftingTimeSeconds: 1800,
    successRate: 75,
    statRanges: { defense: { min: 30, max: 40 }, magic: { min: 10, max: 15 } },
  },
  // Epic items
  {
    recipeId: 'dragonforged_sword',
    name: 'Dragonforged Sword',
    description: 'A sword forged with dragon scales',
    itemType: 'weapon',
    rarity: 'epic',
    forgeLevelRequired: 7,
    materialsRequired: { iron_ingots: 60, mystic_essence: 30, dragon_scales: 10 },
    craftingTimeSeconds: 3600, // 1 hour
    successRate: 60,
    statRanges: { attack: { min: 55, max: 75 } },
  },
  {
    recipeId: 'dragonscale_armor',
    name: 'Dragonscale Armor',
    description: 'Armor made from dragon scales',
    itemType: 'armor',
    rarity: 'epic',
    forgeLevelRequired: 7,
    materialsRequired: { dragon_scales: 15, mystic_essence: 25 },
    craftingTimeSeconds: 3600,
    successRate: 60,
    statRanges: { defense: { min: 50, max: 65 } },
  },
  // Legendary items
  {
    recipeId: 'celestial_blade',
    name: 'Celestial Blade',
    description: 'A weapon blessed by the stars',
    itemType: 'weapon',
    rarity: 'legendary',
    forgeLevelRequired: 10,
    materialsRequired: { dragon_scales: 30, celestial_fragments: 20, mystic_essence: 50 },
    craftingTimeSeconds: 7200, // 2 hours
    successRate: 40,
    statRanges: { attack: { min: 80, max: 120 } },
  },
  {
    recipeId: 'celestial_armor',
    name: 'Celestial Armor',
    description: 'Armor forged from celestial fragments',
    itemType: 'armor',
    rarity: 'legendary',
    forgeLevelRequired: 10,
    materialsRequired: { celestial_fragments: 25, dragon_scales: 20, mystic_essence: 40 },
    craftingTimeSeconds: 7200,
    successRate: 40,
    statRanges: { defense: { min: 75, max: 100 } },
  },
];

export class CraftingService {
  private get db() {
    return getDatabase();
  }

  /**
   * Get all available recipes
   */
  getRecipes(forgeLevelFilter?: number): CraftingRecipe[] {
    if (forgeLevelFilter !== undefined) {
      return RECIPES.filter(r => r.forgeLevelRequired <= forgeLevelFilter);
    }
    return RECIPES;
  }

  /**
   * Get a specific recipe by ID
   */
  getRecipe(recipeId: string): CraftingRecipe | undefined {
    return RECIPES.find(r => r.recipeId === recipeId);
  }

  /**
   * Get player's materials
   */
  async getPlayerMaterials(playerId: string): Promise<Record<MaterialType, number>> {
    const materials = await this.db('player_materials')
      .where('player_id', playerId)
      .select('material_type', 'quantity');

    const result: Record<string, number> = {
      leather_scraps: 0,
      iron_ingots: 0,
      mystic_essence: 0,
      dragon_scales: 0,
      celestial_fragments: 0,
    };

    for (const mat of materials) {
      result[mat.material_type] = mat.quantity;
    }

    return result as Record<MaterialType, number>;
  }

  /**
   * Add materials to player inventory
   */
  async addMaterials(playerId: string, materials: Partial<Record<MaterialType, number>>): Promise<void> {
    for (const [materialType, quantity] of Object.entries(materials)) {
      if (quantity && quantity > 0) {
        await this.db('player_materials')
          .insert({
            player_id: playerId,
            material_type: materialType,
            quantity,
          })
          .onConflict(['player_id', 'material_type'])
          .merge({
            quantity: this.db.raw('player_materials.quantity + ?', [quantity]),
            updated_at: new Date(),
          });
      }
    }

    logger.info(`Added materials to player ${playerId}:`, materials);
  }

  /**
   * Remove materials from player inventory
   */
  async removeMaterials(playerId: string, materials: Partial<Record<MaterialType, number>>): Promise<boolean> {
    // Check if player has enough materials
    const playerMaterials = await this.getPlayerMaterials(playerId);
    
    for (const [materialType, quantity] of Object.entries(materials)) {
      if (quantity && playerMaterials[materialType as MaterialType] < quantity) {
        return false;
      }
    }

    // Remove materials
    for (const [materialType, quantity] of Object.entries(materials)) {
      if (quantity && quantity > 0) {
        await this.db('player_materials')
          .where('player_id', playerId)
          .where('material_type', materialType)
          .update({
            quantity: this.db.raw('quantity - ?', [quantity]),
            updated_at: new Date(),
          });
      }
    }

    return true;
  }

  /**
   * Check if player has required materials for a recipe
   */
  async hasRequiredMaterials(playerId: string, recipe: CraftingRecipe): Promise<boolean> {
    const playerMaterials = await this.getPlayerMaterials(playerId);
    
    for (const [materialType, required] of Object.entries(recipe.materialsRequired)) {
      if (playerMaterials[materialType as MaterialType] < required) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get player's crafting queue
   */
  async getCraftingQueue(playerId: string): Promise<any[]> {
    return await this.db('crafting_queue')
      .where('player_id', playerId)
      .where('status', 'in_progress')
      .orderBy('slot', 'asc');
  }

  /**
   * Get number of available crafting slots for player
   */
  async getAvailableSlots(playerId: string): Promise<number> {
    // Check if player has VIP (you'll need to implement VIP system)
    // For now, everyone gets 1 slot
    const maxSlots = 1; // TODO: Check VIP status for 3 slots

    const queue = await this.getCraftingQueue(playerId);
    return maxSlots - queue.length;
  }

  /**
   * Start crafting an item
   */
  async startCrafting(playerId: string, recipeId: string): Promise<{ success: boolean; message: string; craftingId?: number }> {
    const recipe = this.getRecipe(recipeId);
    if (!recipe) {
      return { success: false, message: 'Recipe not found' };
    }

    // Check forge level
    const forge = await this.db('buildings')
      .where('player_id', playerId)
      .where('type', 'forge')
      .first();

    if (!forge) {
      return { success: false, message: 'You need to build a Forge first!' };
    }

    if (forge.level < recipe.forgeLevelRequired) {
      return { success: false, message: `Forge level ${recipe.forgeLevelRequired} required (yours is ${forge.level})` };
    }

    // Check available slots
    const availableSlots = await this.getAvailableSlots(playerId);
    if (availableSlots === 0) {
      return { success: false, message: 'All crafting slots are in use!' };
    }

    // Check materials
    const hasMaterials = await this.hasRequiredMaterials(playerId, recipe);
    if (!hasMaterials) {
      return { success: false, message: 'Not enough materials!' };
    }

    // Remove materials
    await this.removeMaterials(playerId, recipe.materialsRequired);

    // Add to crafting queue
    const queue = await this.getCraftingQueue(playerId);
    const slot = queue.length + 1;
    const completesAt = new Date(Date.now() + recipe.craftingTimeSeconds * 1000);

    const [craftingJob] = await this.db('crafting_queue')
      .insert({
        player_id: playerId,
        recipe_id: recipeId,
        slot,
        completes_at: completesAt,
        status: 'in_progress',
      })
      .returning('id');

    logger.info(`Player ${playerId} started crafting ${recipeId}`);

    return {
      success: true,
      message: `Started crafting ${recipe.name}!`,
      craftingId: craftingJob.id,
    };
  }

  /**
   * Complete a crafting job
   */
  async completeCrafting(craftingId: number): Promise<{ success: boolean; itemCreated: boolean; message: string; itemId?: string }> {
    const job = await this.db('crafting_queue')
      .where('id', craftingId)
      .first();

    if (!job) {
      return { success: false, itemCreated: false, message: 'Crafting job not found' };
    }

    const recipe = this.getRecipe(job.recipe_id);
    if (!recipe) {
      return { success: false, itemCreated: false, message: 'Recipe not found' };
    }

    // Roll for success
    const roll = Math.random() * 100;
    const succeeded = roll <= recipe.successRate;

    if (succeeded) {
      // Create the item
      const itemId = await this.createItemFromRecipe(job.player_id, recipe);

      await this.db('crafting_queue')
        .where('id', craftingId)
        .update({ status: 'completed' });

      logger.info(`Player ${job.player_id} successfully crafted ${recipe.name}`);

      return {
        success: true,
        itemCreated: true,
        message: `Successfully crafted ${recipe.name}!`,
        itemId,
      };
    } else {
      // Failed - return 50% of materials
      const refundMaterials: Partial<Record<MaterialType, number>> = {};
      for (const [materialType, quantity] of Object.entries(recipe.materialsRequired)) {
        refundMaterials[materialType as MaterialType] = Math.floor(quantity * 0.5);
      }

      await this.addMaterials(job.player_id, refundMaterials);

      await this.db('crafting_queue')
        .where('id', craftingId)
        .update({ status: 'failed' });

      logger.info(`Player ${job.player_id} failed to craft ${recipe.name}`);

      return {
        success: true,
        itemCreated: false,
        message: `Crafting failed! Returned 50% of materials.`,
      };
    }
  }

  /**
   * Create an item from a crafting recipe
   */
  private async createItemFromRecipe(playerId: string, recipe: CraftingRecipe): Promise<string> {
    // Get a hero for this player to assign the item to
    const hero = await this.db('heroes')
      .where('player_id', playerId)
      .first();

    if (!hero) {
      throw new Error('Player has no heroes');
    }

    // Determine slot based on item type
    const slot = recipe.itemType === 'weapon' ? 'weapon' : 'chest';

    // Generate stats based on recipe stat ranges
    const primaryStatType = Object.keys(recipe.statRanges)[0];
    const primaryRange = recipe.statRanges[primaryStatType];
    const primaryValue = Math.floor(Math.random() * (primaryRange.max - primaryRange.min + 1)) + primaryRange.min;

    const isPercentage = ['crit_rate', 'crit_damage', 'accuracy', 'resistance'].includes(primaryStatType);

    const primaryStat = {
      stat: primaryStatType,
      value: primaryValue,
      isPercentage,
    };

    // Generate secondary stats if recipe has multiple stat ranges
    const secondaryStats: any[] = [];
    const statKeys = Object.keys(recipe.statRanges);
    for (let i = 1; i < statKeys.length; i++) {
      const statType = statKeys[i];
      const range = recipe.statRanges[statType];
      const value = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const isSecondaryPercentage = ['crit_rate', 'crit_damage', 'accuracy', 'resistance'].includes(statType);

      secondaryStats.push({
        stat: statType,
        value,
        isPercentage: isSecondaryPercentage,
      });
    }

    // Insert item into database
    const [item] = await this.db('items')
      .insert({
        player_id: playerId,
        hero_id: hero.id,
        name: recipe.name,
        type: recipe.itemType,
        slot,
        rarity: recipe.rarity,
        level: 1,
        primary_stat: JSON.stringify(primaryStat),
        secondary_stats: JSON.stringify(secondaryStats),
        locked: false,
        equipped: false,
      })
      .returning('id');

    return item.id.toString();
  }

  /**
   * Cancel a crafting job
   */
  async cancelCrafting(craftingId: number): Promise<{ success: boolean; message: string }> {
    const job = await this.db('crafting_queue')
      .where('id', craftingId)
      .where('status', 'in_progress')
      .first();

    if (!job) {
      return { success: false, message: 'Crafting job not found or already completed' };
    }

    const recipe = this.getRecipe(job.recipe_id);
    if (!recipe) {
      return { success: false, message: 'Recipe not found' };
    }

    // Check if crafting has started
    const now = new Date();
    const started = new Date(job.started_at);
    const hasStarted = now > started;

    // Refund materials
    const refundAmount = hasStarted ? 0.5 : 1.0;
    const refundMaterials: Partial<Record<MaterialType, number>> = {};
    for (const [materialType, quantity] of Object.entries(recipe.materialsRequired)) {
      refundMaterials[materialType as MaterialType] = Math.floor(quantity * refundAmount);
    }

    await this.addMaterials(job.player_id, refundMaterials);

    // Delete the job
    await this.db('crafting_queue')
      .where('id', craftingId)
      .delete();

    const refundPercent = refundAmount * 100;
    return {
      success: true,
      message: `Crafting cancelled. Refunded ${refundPercent}% of materials.`,
    };
  }

  /**
   * Check and complete any crafting jobs that are ready
   */
  async completeReadyJobs(): Promise<number> {
    const readyJobs = await this.db('crafting_queue')
      .where('status', 'in_progress')
      .where('completes_at', '<=', new Date());

    let completed = 0;
    for (const job of readyJobs) {
      await this.completeCrafting(job.id);
      completed++;
    }

    return completed;
  }

  /**
   * Salvage an item for materials
   */
  async salvageItem(playerId: string, itemId: string): Promise<{ success: boolean; message: string; materials?: Partial<Record<MaterialType, number>> }> {
    // Get the item
    const item = await this.db('items')
      .where('id', itemId)
      .where('player_id', playerId)
      .first();

    if (!item) {
      return { success: false, message: 'Item not found or does not belong to you' };
    }

    // Check if item is equipped
    const isEquipped = await this.db('hero_equipment')
      .where('item_id', itemId)
      .first();

    if (isEquipped) {
      return { success: false, message: 'Cannot salvage equipped items. Unequip it first!' };
    }

    // Check if item is locked
    if (item.locked) {
      return { success: false, message: 'Cannot salvage locked items. Unlock it first!' };
    }

    // Calculate materials based on rarity
    const salvageData = SALVAGE_MATERIALS[item.rarity];
    if (!salvageData) {
      return { success: false, message: 'This item cannot be salvaged' };
    }

    // Generate random materials
    const materialsGained: Partial<Record<MaterialType, number>> = {};
    const amount = Math.floor(Math.random() * (salvageData.max - salvageData.min + 1)) + salvageData.min;
    
    // Distribute materials among available types for this rarity
    const materialTypes = salvageData.materials;
    const perMaterial = Math.floor(amount / materialTypes.length);
    const remainder = amount % materialTypes.length;

    for (let i = 0; i < materialTypes.length; i++) {
      const materialType = materialTypes[i];
      materialsGained[materialType] = perMaterial + (i < remainder ? 1 : 0);
    }

    // Add materials to player
    await this.addMaterials(playerId, materialsGained);

    // Delete the item
    await this.db('items')
      .where('id', itemId)
      .delete();

    logger.info(`Player ${playerId} salvaged item ${itemId} for materials:`, materialsGained);

    return {
      success: true,
      message: 'Item salvaged successfully!',
      materials: materialsGained,
    };
  }

  /**
   * Salvage multiple items at once
   */
  async salvageMultipleItems(playerId: string, itemIds: string[]): Promise<{ success: boolean; message: string; totalMaterials?: Partial<Record<MaterialType, number>>; salvaged: number; failed: number }> {
    const totalMaterials: Partial<Record<MaterialType, number>> = {};
    let salvaged = 0;
    let failed = 0;

    for (const itemId of itemIds) {
      const result = await this.salvageItem(playerId, itemId);
      if (result.success && result.materials) {
        salvaged++;
        // Aggregate materials
        for (const [materialType, quantity] of Object.entries(result.materials)) {
          if (quantity) {
            totalMaterials[materialType as MaterialType] = (totalMaterials[materialType as MaterialType] || 0) + quantity;
          }
        }
      } else {
        failed++;
      }
    }

    return {
      success: salvaged > 0,
      message: `Salvaged ${salvaged} items${failed > 0 ? `, ${failed} failed` : ''}`,
      totalMaterials,
      salvaged,
      failed,
    };
  }
}
