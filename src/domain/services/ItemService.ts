import { Knex } from 'knex';
import { Item } from '../entities/Item.js';
import { ItemRepository } from '../../infrastructure/database/repositories/ItemRepository.js';
import { ItemSlot, ItemRarity } from '../../shared/types/items.js';
import { ITEM_DROP_RATES } from '../../shared/constants/items.js';

export class ItemService {
  private itemRepo: ItemRepository;

  constructor(private db: Knex) {
    this.itemRepo = new ItemRepository(db);
  }

  // Generate a random item for a hero
  async generateRandomItem(heroId: bigint, slot?: ItemSlot): Promise<Item> {
    // Determine slot if not provided
    const selectedSlot = slot || this.getRandomSlot();
    
    // Determine rarity based on drop rates
    const rarity = this.getRandomRarity();
    
    // Create the item
    const item = Item.create(heroId, selectedSlot, rarity);
    
    // Save to database
    return await this.itemRepo.create(item);
  }

  // Get all items for a hero
  async getHeroItems(heroId: bigint): Promise<Item[]> {
    return await this.itemRepo.findByHeroId(heroId);
  }

  // Get equipped items for a hero
  async getEquippedItems(heroId: bigint): Promise<Item[]> {
    return await this.itemRepo.findEquippedByHeroId(heroId);
  }

  // Equip an item
  async equipItem(itemId: bigint, heroId: bigint): Promise<{ success: boolean; message: string }> {
    const item = await this.itemRepo.findById(itemId);
    
    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    if (item.heroId !== heroId) {
      return { success: false, message: 'Item does not belong to this hero' };
    }

    if (item.equipped) {
      return { success: false, message: 'Item is already equipped' };
    }

    // Unequip any item in the same slot
    await this.itemRepo.unequipSlot(heroId, item.slot);

    // Equip the new item
    item.equip();
    await this.itemRepo.update(item);

    return { success: true, message: `Equipped ${item.name}` };
  }

  // Unequip an item
  async unequipItem(itemId: bigint, heroId: bigint): Promise<{ success: boolean; message: string }> {
    const item = await this.itemRepo.findById(itemId);
    
    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    if (item.heroId !== heroId) {
      return { success: false, message: 'Item does not belong to this hero' };
    }

    if (!item.equipped) {
      return { success: false, message: 'Item is not equipped' };
    }

    item.unequip();
    await this.itemRepo.update(item);

    return { success: true, message: `Unequipped ${item.name}` };
  }

  // Upgrade an item
  async upgradeItem(
    itemId: bigint, 
    heroId: bigint, 
    playerGold: number
  ): Promise<{ success: boolean; message: string; newLevel?: number; goldSpent?: number }> {
    const item = await this.itemRepo.findById(itemId);
    
    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    if (item.heroId !== heroId) {
      return { success: false, message: 'Item does not belong to this hero' };
    }

    const upgradeCost = item.getUpgradeCost();
    
    if (upgradeCost === 0) {
      return { success: false, message: 'Item is already at max level' };
    }

    if (playerGold < upgradeCost) {
      return { success: false, message: `Not enough gold. Need ${upgradeCost} gold` };
    }

    const upgraded = item.upgrade();
    
    if (!upgraded) {
      return { success: false, message: 'Failed to upgrade item' };
    }

    await this.itemRepo.update(item);

    return { 
      success: true, 
      message: `Upgraded ${item.name} to level ${item.level}`,
      newLevel: item.level,
      goldSpent: upgradeCost,
    };
  }

  // Sell an item for gold
  async sellItem(itemId: bigint, heroId: bigint): Promise<{ success: boolean; message: string; goldEarned?: number }> {
    const item = await this.itemRepo.findById(itemId);
    
    if (!item) {
      return { success: false, message: 'Item not found' };
    }

    if (item.heroId !== heroId) {
      return { success: false, message: 'Item does not belong to this hero' };
    }

    if (item.equipped) {
      return { success: false, message: 'Cannot sell equipped item. Unequip it first' };
    }

    // Calculate sell value (50% of upgrade costs spent)
    const sellValue = this.calculateSellValue(item);

    await this.itemRepo.delete(itemId);

    return { 
      success: true, 
      message: `Sold ${item.name} for ${sellValue} gold`,
      goldEarned: sellValue,
    };
  }

  // Helper: Calculate sell value
  private calculateSellValue(item: Item): number {
    let totalCost = 0;
    for (let level = 1; level < item.level; level++) {
      totalCost += item.getUpgradeCost();
    }
    return Math.floor(totalCost * 0.5);
  }

  // Helper: Get random slot
  private getRandomSlot(): ItemSlot {
    const slots: ItemSlot[] = ['head', 'weapon', 'chest', 'boots', 'ring'];
    return slots[Math.floor(Math.random() * slots.length)];
  }

  // Helper: Get random rarity based on drop rates
  private getRandomRarity(): ItemRarity {
    const roll = Math.random() * 100;
    let cumulative = 0;

    for (const [rarity, rate] of Object.entries(ITEM_DROP_RATES)) {
      cumulative += rate;
      if (roll <= cumulative) {
        return rarity as ItemRarity;
      }
    }

    return 'common'; // Fallback
  }

  // Get item by ID
  async getItem(itemId: bigint): Promise<Item | null> {
    return await this.itemRepo.findById(itemId);
  }

  // Get items by slot
  async getItemsBySlot(heroId: bigint, slot: ItemSlot): Promise<Item[]> {
    return await this.itemRepo.findByHeroIdAndSlot(heroId, slot);
  }
}
