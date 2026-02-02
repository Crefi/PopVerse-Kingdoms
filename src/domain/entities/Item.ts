import { ItemData, ItemSlot, ItemRarity, ItemStatValue } from '../../shared/types/items.js';
import { 
  MAX_ITEM_LEVEL, 
  ITEM_BASE_STATS, 
  ITEM_STAT_GROWTH,
  ITEM_UPGRADE_COST,
  SLOT_PRIMARY_STATS,
  SECONDARY_STATS_POOL,
  SECONDARY_STATS_COUNT,
  ITEM_NAMES,
} from '../../shared/constants/items.js';

export class Item {
  readonly id: bigint;
  readonly heroId: bigint;
  readonly slot: ItemSlot;
  readonly rarity: ItemRarity;
  private _level: number;
  readonly primaryStat: ItemStatValue;
  readonly secondaryStats: ItemStatValue[];
  private _equipped: boolean;
  readonly createdAt: Date;

  constructor(data: ItemData) {
    this.id = data.id;
    this.heroId = data.heroId;
    this.slot = data.slot;
    this.rarity = data.rarity;
    this._level = data.level;
    this.primaryStat = { ...data.primaryStat };
    this.secondaryStats = data.secondaryStats.map(s => ({ ...s }));
    this._equipped = data.equipped;
    this.createdAt = data.createdAt;
  }

  static create(heroId: bigint, slot: ItemSlot, rarity: ItemRarity): Item {
    // Generate random primary stat for this slot
    const possiblePrimaryStats = SLOT_PRIMARY_STATS[slot];
    const primaryStatType = possiblePrimaryStats[Math.floor(Math.random() * possiblePrimaryStats.length)];
    
    // Determine if primary stat is percentage (crit_rate, crit_damage, accuracy, resistance are %)
    const isPercentage = ['crit_rate', 'crit_damage', 'accuracy', 'resistance'].includes(primaryStatType);
    
    const primaryStat: ItemStatValue = {
      stat: primaryStatType,
      value: ITEM_BASE_STATS[rarity],
      isPercentage,
    };

    // Generate secondary stats
    const secondaryCount = SECONDARY_STATS_COUNT[rarity];
    const secondaryStats: ItemStatValue[] = [];
    const usedStats = new Set([primaryStatType]);

    for (let i = 0; i < secondaryCount; i++) {
      const availableStats = SECONDARY_STATS_POOL.filter(s => !usedStats.has(s));
      if (availableStats.length === 0) break;

      const statType = availableStats[Math.floor(Math.random() * availableStats.length)];
      usedStats.add(statType);

      const isSecondaryPercentage = ['crit_rate', 'crit_damage', 'accuracy', 'resistance'].includes(statType);
      
      secondaryStats.push({
        stat: statType,
        value: Math.floor(ITEM_BASE_STATS[rarity] * 0.5), // Secondary stats are 50% of primary
        isPercentage: isSecondaryPercentage,
      });
    }

    return new Item({
      id: BigInt(0),
      heroId,
      slot,
      rarity,
      level: 1,
      primaryStat,
      secondaryStats,
      equipped: false,
      createdAt: new Date(),
    });
  }

  get level(): number {
    return this._level;
  }

  get equipped(): boolean {
    return this._equipped;
  }

  get name(): string {
    const names = ITEM_NAMES[this.slot][this.rarity];
    return names[0]; // For now, use first name. Could randomize or use ID-based selection
  }

  // Calculate current stat values based on level
  getPrimaryStatValue(): number {
    const baseValue = this.primaryStat.value;
    const growth = ITEM_STAT_GROWTH[this.rarity];
    return Math.floor(baseValue + (this._level - 1) * growth);
  }

  getSecondaryStatValue(index: number): number {
    if (index < 0 || index >= this.secondaryStats.length) return 0;
    const baseValue = this.secondaryStats[index].value;
    const growth = Math.floor(ITEM_STAT_GROWTH[this.rarity] * 0.5); // Secondary stats grow slower
    return Math.floor(baseValue + (this._level - 1) * growth);
  }

  // Get upgrade cost for next level
  getUpgradeCost(): number {
    if (this._level >= MAX_ITEM_LEVEL) return 0;
    return ITEM_UPGRADE_COST[this._level + 1] || 0;
  }

  // Upgrade item to next level
  upgrade(): boolean {
    if (this._level >= MAX_ITEM_LEVEL) return false;
    this._level++;
    return true;
  }

  equip(): void {
    this._equipped = true;
  }

  unequip(): void {
    this._equipped = false;
  }

  // Get total power contribution
  getPower(): number {
    const primaryValue = this.getPrimaryStatValue();
    const secondaryTotal = this.secondaryStats.reduce((sum, _, index) => {
      return sum + this.getSecondaryStatValue(index);
    }, 0);
    
    return Math.floor((primaryValue + secondaryTotal) * (1 + this._level * 0.1));
  }

  toData(): ItemData {
    return {
      id: this.id,
      heroId: this.heroId,
      slot: this.slot,
      rarity: this.rarity,
      level: this._level,
      primaryStat: { ...this.primaryStat },
      secondaryStats: this.secondaryStats.map(s => ({ ...s })),
      equipped: this._equipped,
      createdAt: this.createdAt,
    };
  }
}
