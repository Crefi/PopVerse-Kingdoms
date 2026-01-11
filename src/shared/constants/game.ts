// Map constants
export const MAP_SIZE = 100;
export const MAP_VIEW_SIZE = 15;
export const SPAWN_ZONE_PERCENTAGE = 0.7;
export const RESOURCE_ZONE_PERCENTAGE = 0.2;
export const CENTER_ZONE_PERCENTAGE = 0.1;

// Player constants
export const STARTER_RESOURCES = { food: 5000, iron: 2500, gold: 1000 };
export const STARTER_DIAMONDS = 500;
export const PROTECTION_SHIELD_HOURS = 24;
export const MAX_LANDS_PER_PLAYER = 3;
export const MAX_LANDS_PER_GUILD = 10;

// Building slots based on HQ level
export const BUILDING_SLOTS_BY_HQ: Record<number, number> = {
  1: 1,   // HQ 1-4: 1 slot
  5: 2,   // HQ 5-9: 2 slots
  10: 3,  // HQ 10-14: 3 slots
  15: 4,  // HQ 15-19: 4 slots
  20: 5,  // HQ 20+: 5 slots
};

// Get building slots for a given HQ level
export function getBuildingSlots(hqLevel: number): number {
  const thresholds = Object.keys(BUILDING_SLOTS_BY_HQ)
    .map(Number)
    .sort((a, b) => b - a);
  
  for (const threshold of thresholds) {
    if (hqLevel >= threshold) {
      return BUILDING_SLOTS_BY_HQ[threshold];
    }
  }
  return 1;
}

// Shop constants
export const SHOP_ITEMS = {
  teleport_scroll: {
    id: 'teleport_scroll',
    name: 'Teleport Scroll',
    emoji: '📜',
    description: 'Instantly relocate your city to any valid tile',
    diamondCost: 100,
    goldCost: 0,
    maxDaily: 3,
  },
  resource_boost: {
    id: 'resource_boost',
    name: 'Resource Boost (1h)',
    emoji: '⚡',
    description: '+50% resource production for 1 hour',
    diamondCost: 50,
    goldCost: 0,
    maxDaily: 5,
  },
  shield_8h: {
    id: 'shield_8h',
    name: 'Peace Shield (8h)',
    emoji: '🛡️',
    description: 'Protect your city from attacks for 8 hours',
    diamondCost: 150,
    goldCost: 0,
    maxDaily: 2,
  },
  speed_up_1h: {
    id: 'speed_up_1h',
    name: 'Speed Up (1h)',
    emoji: '⏩',
    description: 'Reduce building/research time by 1 hour',
    diamondCost: 30,
    goldCost: 0,
    maxDaily: 10,
  },
  troop_heal: {
    id: 'troop_heal',
    name: 'Healing Salve',
    emoji: '💊',
    description: 'Instantly heal all wounded troops',
    diamondCost: 0,
    goldCost: 5000,
    maxDaily: 3,
  },
} as const;

export type ShopItemId = keyof typeof SHOP_ITEMS;

// Combat constants
export const ELEMENTAL_DAMAGE_BONUS = 0.25;
export const CRITICAL_HIT_CHANCE = 0.1;
export const CRITICAL_HIT_MULTIPLIER = 2.0;
export const MAX_TROOPS_PER_MARCH = 500;
export const HOSPITAL_RECOVERY_RATE = 0.5;

// Arena constants
export const ARENA_STARTING_RATING = 1000;
export const ARENA_MATCHMAKING_RANGE = 200;
export const ARENA_DAILY_FREE_ATTACKS = 5;
export const ARENA_MAX_TOKENS = 10;
export const ARENA_TOKEN_REGEN_HOURS = 2;
export const ARENA_WIN_POINTS_MIN = 20;
export const ARENA_WIN_POINTS_MAX = 40;
export const ARENA_LOSS_POINTS_MIN = 10;
export const ARENA_LOSS_POINTS_MAX = 20;

// Hero constants
export const HERO_MAX_LEVEL = 50;
export const HERO_SHARDS_TO_UNLOCK = 10;
export const HERO_SKILL_MILESTONES = [10, 20, 30, 40, 50];

// Building constants
export const MAX_HQ_LEVEL = 25;
export const GUILD_HELP_TIME_REDUCTION_MINUTES = 10;
export const MAX_GUILD_HELPERS = 5;
export const VAULT_PROTECTION_RATE = 0.5;

// March constants
export const MIN_MARCH_TIME_MINUTES = 3;
export const MAX_MARCH_TIME_MINUTES = 15;

// NPC constants
export const NPC_MIN_POWER = 500;
export const NPC_MAX_POWER = 10000;
export const NPC_RESPAWN_HOURS = 12;
export const STARTER_NPC_COUNT = 5;
export const STARTER_NPC_RADIUS = 5;

// Conquest constants
export const CONQUEST_DURATION_MINUTES = 60;
export const CONQUEST_CONTROL_POINTS = 5;
export const CONQUEST_COOLDOWN_MINUTES = 5;
export const CONQUEST_POINTS_PER_MINUTE = 1;

// Season constants
export const SEASON_DURATION_DAYS = 90;

// Research constants
export const RESEARCH_CATEGORIES = 6;
export const RESEARCH_LEVELS_PER_CATEGORY = 5;
export const RESEARCH_MIN_HOURS = 1;
export const RESEARCH_MAX_HOURS = 20;

// Daily rewards
export const DAILY_FOOD_REWARD = 1000;
export const DAILY_IRON_REWARD = 500;
export const DAILY_DIAMOND_REWARD = 50;
export const NEWBIE_BONUS_DAYS = 7;
