// Core game types
export type Faction = 'cinema' | 'anime' | 'gamer';
export type Element = 'fire' | 'wind' | 'water';
export type HeroRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type TerrainType = 'plains' | 'mountain' | 'lake' | 'forest' | 'resource';
export type BiomeType = 'grassland' | 'desert' | 'tundra' | 'swamp';
export type BuildingType = 'hq' | 'farm' | 'mine' | 'barracks' | 'vault' | 'hospital' | 'academy' | 'forge';

export type MaterialType = 'leather_scraps' | 'iron_ingots' | 'mystic_essence' | 'dragon_scales' | 'celestial_fragments';

export interface CraftingMaterial {
  type: MaterialType;
  quantity: number;
}

export interface CraftingRecipe {
  recipeId: string;
  name: string;
  description: string;
  itemType: string;
  rarity: string;
  forgeLevelRequired: number;
  materialsRequired: Partial<Record<MaterialType, number>>;
  craftingTimeSeconds: number;
  successRate: number;
  statRanges: Record<string, { min: number; max: number }>;
  setId?: string;
}
export type TroopTier = 1 | 2 | 3 | 4;
export type BattleType = 'pvp' | 'pve' | 'arena' | 'conquest' | 'rally';
export type ArenaTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';

export interface Coordinate {
  x: number;
  y: number;
}

export interface Resources {
  food: number;
  iron: number;
  gold: number;
}

export interface FactionBonus {
  attack?: number;
  defense?: number;
  marchSpeed?: number;
}

export const FACTION_ELEMENTS: Record<Faction, Element> = {
  cinema: 'fire',
  anime: 'wind',
  gamer: 'water',
};

export const FACTION_BONUSES: Record<Faction, FactionBonus> = {
  cinema: { attack: 1.1 },
  anime: { marchSpeed: 1.15 },
  gamer: { defense: 1.1 },
};

export const ELEMENT_ADVANTAGES: Record<Element, Element> = {
  fire: 'wind',
  wind: 'water',
  water: 'fire',
};

export const STARTER_HEROES: Record<Faction, string> = {
  cinema: 'Ethan Hunt',
  anime: 'Naruto',
  gamer: 'Master Chief',
};
