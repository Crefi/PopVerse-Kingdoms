import type { Knex } from 'knex';

// Hero templates for reference - these define the available heroes in the game
// Actual hero instances are created when players summon or receive starter heroes

export interface HeroTemplate {
  name: string;
  faction: 'cinema' | 'anime' | 'gamer';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseHp: number;
  skillName: string;
  skillDescription: string;
  imageUrl?: string; // Optional hero portrait URL
}

// Hero image URLs - served from local assets folder
// Images are accessible at http://localhost:3000/assets/heroes/[filename]
const BASE_URL = process.env.WEB_URL || 'http://localhost:3000';

const HERO_IMAGES: Record<string, string> = {
  // Cinema Heroes
  'Ethan Hunt': `${BASE_URL}/assets/heroes/Ethan-Hunt.jpg`,
  'James Bond': `${BASE_URL}/assets/heroes/James-Bond.png`,
  'John Wick': `${BASE_URL}/assets/heroes/John-Wick.jpg`,
  'T-800 Terminator': `${BASE_URL}/assets/heroes/T-800-Terminator.jpg`,
  
  // Anime Heroes
  'Naruto Uzumaki': `${BASE_URL}/assets/heroes/Naruto-Uzumaki.jpg`,
  'Edward Elric': `${BASE_URL}/assets/heroes/Edward-Elric.jpg`,
  'Son Goku': `${BASE_URL}/assets/heroes/Son-Goku.jpg`,
  'Saitama': `${BASE_URL}/assets/heroes/Saitama.png`,
  
  // Gamer Heroes
  'Master Chief': `${BASE_URL}/assets/heroes/Master-Chief.jpg`,
  'Kratos': `${BASE_URL}/assets/heroes/Kratos.jpg`,
  'Geralt of Rivia': `${BASE_URL}/assets/heroes/Geralt-of-Rivia.jpg`,
  'Solid Snake': `${BASE_URL}/assets/heroes/Solid-Snake.jpg`,
};

export const HERO_TEMPLATES: HeroTemplate[] = [
  // Cinema (Fire) Heroes
  {
    name: 'Ethan Hunt',
    faction: 'cinema',
    rarity: 'common',
    baseAttack: 55,
    baseDefense: 40,
    baseSpeed: 30,
    baseHp: 200,
    skillName: 'Mission Impossible',
    skillDescription: '+10% Attack to Fire troops',
    imageUrl: HERO_IMAGES['Ethan Hunt'],
  },
  {
    name: 'James Bond',
    faction: 'cinema',
    rarity: 'rare',
    baseAttack: 80,
    baseDefense: 60,
    baseSpeed: 50,
    baseHp: 300,
    skillName: 'License to Kill',
    skillDescription: '20% chance to deal double damage',
    imageUrl: HERO_IMAGES['James Bond'],
  },
  {
    name: 'John Wick',
    faction: 'cinema',
    rarity: 'epic',
    baseAttack: 110,
    baseDefense: 75,
    baseSpeed: 65,
    baseHp: 450,
    skillName: 'Baba Yaga',
    skillDescription: 'AoE attack hits 3 enemies',
    imageUrl: HERO_IMAGES['John Wick'],
  },
  {
    name: 'T-800 Terminator',
    faction: 'cinema',
    rarity: 'legendary',
    baseAttack: 160,
    baseDefense: 130,
    baseSpeed: 70,
    baseHp: 750,
    skillName: 'Cybernetic Armor',
    skillDescription: 'Reduces all incoming damage by 30%',
    imageUrl: HERO_IMAGES['T-800 Terminator'],
  },

  // Anime (Wind) Heroes
  {
    name: 'Naruto Uzumaki',
    faction: 'anime',
    rarity: 'common',
    baseAttack: 50,
    baseDefense: 35,
    baseSpeed: 45,
    baseHp: 200,
    skillName: 'Shadow Clone',
    skillDescription: '+20% March Speed',
    imageUrl: HERO_IMAGES['Naruto Uzumaki'],
  },
  {
    name: 'Edward Elric',
    faction: 'anime',
    rarity: 'rare',
    baseAttack: 75,
    baseDefense: 55,
    baseSpeed: 55,
    baseHp: 280,
    skillName: 'Alchemy',
    skillDescription: '+10% Scout Range',
    imageUrl: HERO_IMAGES['Edward Elric'],
  },
  {
    name: 'Son Goku',
    faction: 'anime',
    rarity: 'epic',
    baseAttack: 105,
    baseDefense: 70,
    baseSpeed: 80,
    baseHp: 420,
    skillName: 'Instant Transmission',
    skillDescription: 'First strike (attacks before enemy)',
    imageUrl: HERO_IMAGES['Son Goku'],
  },
  {
    name: 'Saitama',
    faction: 'anime',
    rarity: 'legendary',
    baseAttack: 200,
    baseDefense: 100,
    baseSpeed: 90,
    baseHp: 600,
    skillName: 'One Punch',
    skillDescription: 'Instantly defeats one enemy troop unit',
    imageUrl: HERO_IMAGES['Saitama'],
  },

  // Gamer (Water) Heroes - Popular game characters
  {
    name: 'Master Chief',
    faction: 'gamer',
    rarity: 'common',
    baseAttack: 45,
    baseDefense: 50,
    baseSpeed: 30,
    baseHp: 220,
    skillName: 'Spartan Shield',
    skillDescription: '+15% Defense',
    imageUrl: HERO_IMAGES['Master Chief'],
  },
  {
    name: 'Kratos',
    faction: 'gamer',
    rarity: 'rare',
    baseAttack: 70,
    baseDefense: 70,
    baseSpeed: 45,
    baseHp: 320,
    skillName: 'Spartan Rage',
    skillDescription: 'Counterattack: reflects 10% of damage',
    imageUrl: HERO_IMAGES['Kratos'],
  },
  {
    name: 'Geralt of Rivia',
    faction: 'gamer',
    rarity: 'epic',
    baseAttack: 95,
    baseDefense: 90,
    baseSpeed: 60,
    baseHp: 480,
    skillName: 'Witcher Signs',
    skillDescription: 'Heals 5% of troops after each battle',
    imageUrl: HERO_IMAGES['Geralt of Rivia'],
  },
  {
    name: 'Solid Snake',
    faction: 'gamer',
    rarity: 'legendary',
    baseAttack: 140,
    baseDefense: 140,
    baseSpeed: 75,
    baseHp: 800,
    skillName: 'Tactical Espionage',
    skillDescription: 'Immune to first attack',
    imageUrl: HERO_IMAGES['Solid Snake'],
  },
];

export async function seed(_knex: Knex): Promise<void> {
  // Hero templates are stored in code, not database
  // This seed file exports the templates for use in the game logic
  console.log(`Loaded ${HERO_TEMPLATES.length} hero templates`);
}

/**
 * Get hero image URL by name
 */
export function getHeroImageUrl(heroName: string): string | undefined {
  return HERO_IMAGES[heroName];
}

/**
 * Get hero template by name
 */
export function getHeroTemplate(heroName: string): HeroTemplate | undefined {
  return HERO_TEMPLATES.find(h => h.name === heroName);
}
