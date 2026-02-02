import { ItemRarity, ItemSlot, ItemStat } from '../types/items.js';

// Maximum item level
export const MAX_ITEM_LEVEL = 15;

// Base stat values by rarity (at level 1)
export const ITEM_BASE_STATS: Record<ItemRarity, number> = {
  common: 10,
  rare: 20,
  epic: 35,
  legendary: 60,
};

// Stat growth per level
export const ITEM_STAT_GROWTH: Record<ItemRarity, number> = {
  common: 2,
  rare: 4,
  epic: 7,
  legendary: 12,
};

// Upgrade costs (gold) per level
export const ITEM_UPGRADE_COST: Record<number, number> = {
  1: 100,
  2: 150,
  3: 200,
  4: 300,
  5: 400,
  6: 600,
  7: 800,
  8: 1200,
  9: 1600,
  10: 2400,
  11: 3200,
  12: 4800,
  13: 6400,
  14: 9600,
  15: 15000,
};

// Primary stats by slot
export const SLOT_PRIMARY_STATS: Record<ItemSlot, ItemStat[]> = {
  head: ['hp', 'defense'],
  weapon: ['attack', 'crit_damage'],
  chest: ['hp', 'defense'],
  boots: ['speed', 'hp'],
  ring: ['attack', 'hp', 'defense'],
};

// Secondary stats pool (can appear on any item)
export const SECONDARY_STATS_POOL: ItemStat[] = [
  'attack',
  'defense',
  'hp',
  'speed',
  'crit_rate',
  'crit_damage',
  'accuracy',
  'resistance',
];

// Number of secondary stats by rarity
export const SECONDARY_STATS_COUNT: Record<ItemRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

// Item names by slot and rarity
export const ITEM_NAMES: Record<ItemSlot, Record<ItemRarity, string[]>> = {
  head: {
    common: ['Leather Cap', 'Iron Helm', 'Cloth Hood'],
    rare: ['Steel Helmet', 'Reinforced Helm', 'Battle Crown'],
    epic: ['Dragon Helm', 'Crown of Valor', 'Mythril Circlet'],
    legendary: ['Crown of Kings', 'Helm of Legends', 'Divine Diadem'],
  },
  weapon: {
    common: ['Iron Sword', 'Wooden Staff', 'Short Blade'],
    rare: ['Steel Longsword', 'Battle Axe', 'War Hammer'],
    epic: ['Dragon Slayer', 'Flame Blade', 'Thunder Staff'],
    legendary: ['Excalibur', 'Godslayer', 'Eternal Edge'],
  },
  chest: {
    common: ['Leather Armor', 'Cloth Robe', 'Chain Mail'],
    rare: ['Steel Plate', 'Reinforced Armor', 'Battle Vest'],
    epic: ['Dragon Scale Armor', 'Mythril Plate', 'Enchanted Robe'],
    legendary: ['Armor of Gods', 'Eternal Plate', 'Divine Vestment'],
  },
  boots: {
    common: ['Leather Boots', 'Iron Greaves', 'Cloth Shoes'],
    rare: ['Steel Boots', 'Swift Greaves', 'Battle Boots'],
    epic: ['Dragon Boots', 'Winged Greaves', 'Shadow Walkers'],
    legendary: ['Boots of Hermes', 'Divine Treads', 'Eternal Steps'],
  },
  ring: {
    common: ['Bronze Ring', 'Simple Band', 'Iron Ring'],
    rare: ['Silver Ring', 'Ruby Ring', 'Sapphire Band'],
    epic: ['Dragon Ring', 'Mythril Band', 'Enchanted Ring'],
    legendary: ['Ring of Power', 'Eternal Band', 'Divine Circle'],
  },
};

// Drop rates for item rarity (percentage)
export const ITEM_DROP_RATES: Record<ItemRarity, number> = {
  common: 60,
  rare: 30,
  epic: 8,
  legendary: 2,
};
