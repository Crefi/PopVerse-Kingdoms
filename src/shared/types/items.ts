// Item system types for hero gear

export type ItemSlot = 'head' | 'weapon' | 'chest' | 'boots' | 'ring';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ItemStat = 
  | 'attack' 
  | 'defense' 
  | 'hp' 
  | 'speed' 
  | 'crit_rate' 
  | 'crit_damage' 
  | 'accuracy' 
  | 'resistance';

export interface ItemStatValue {
  stat: ItemStat;
  value: number;
  isPercentage: boolean; // true for %, false for flat value
}

export interface ItemData {
  id: bigint;
  heroId: bigint;
  slot: ItemSlot;
  rarity: ItemRarity;
  level: number;
  primaryStat: ItemStatValue;
  secondaryStats: ItemStatValue[];
  equipped: boolean;
  createdAt: Date;
}

export interface ItemTemplate {
  slot: ItemSlot;
  rarity: ItemRarity;
  name: string;
  primaryStat: ItemStat;
  possibleSecondaryStats: ItemStat[];
}
