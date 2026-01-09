import type { Knex } from 'knex';

// Hero templates for reference - these define the available heroes in the game
// Actual hero instances are created when players summon or receive starter heroes

export interface HeroTemplate {
  name: string;
  faction: 'cinema' | 'otaku' | 'arcade';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  baseHp: number;
  skillName: string;
  skillDescription: string;
}

export const HERO_TEMPLATES: HeroTemplate[] = [
  // Cinema (Fire) Heroes
  {
    name: 'John McClane',
    faction: 'cinema',
    rarity: 'common',
    baseAttack: 55,
    baseDefense: 40,
    baseSpeed: 30,
    baseHp: 200,
    skillName: 'Die Hard',
    skillDescription: '+10% Attack to Fire troops',
  },
  {
    name: 'Jason Bourne',
    faction: 'cinema',
    rarity: 'rare',
    baseAttack: 80,
    baseDefense: 60,
    baseSpeed: 50,
    baseHp: 300,
    skillName: 'Precision Strike',
    skillDescription: '20% chance to deal double damage',
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
  },

  // Otaku (Wind) Heroes
  {
    name: 'Naruto Uzumaki',
    faction: 'otaku',
    rarity: 'common',
    baseAttack: 50,
    baseDefense: 35,
    baseSpeed: 45,
    baseHp: 200,
    skillName: 'Shadow Clone',
    skillDescription: '+20% March Speed',
  },
  {
    name: 'Edward Elric',
    faction: 'otaku',
    rarity: 'rare',
    baseAttack: 75,
    baseDefense: 55,
    baseSpeed: 55,
    baseHp: 280,
    skillName: 'Alchemy',
    skillDescription: '+10% Scout Range',
  },
  {
    name: 'Son Goku',
    faction: 'otaku',
    rarity: 'epic',
    baseAttack: 105,
    baseDefense: 70,
    baseSpeed: 80,
    baseHp: 420,
    skillName: 'Instant Transmission',
    skillDescription: 'First strike (attacks before enemy)',
  },
  {
    name: 'Saitama',
    faction: 'otaku',
    rarity: 'legendary',
    baseAttack: 200,
    baseDefense: 100,
    baseSpeed: 90,
    baseHp: 600,
    skillName: 'One Punch',
    skillDescription: 'Instantly defeats one enemy troop unit',
  },

  // Arcade (Water) Heroes
  {
    name: 'Mario',
    faction: 'arcade',
    rarity: 'common',
    baseAttack: 45,
    baseDefense: 50,
    baseSpeed: 30,
    baseHp: 220,
    skillName: 'Super Star',
    skillDescription: '+15% Defense',
  },
  {
    name: 'Ryu',
    faction: 'arcade',
    rarity: 'rare',
    baseAttack: 70,
    baseDefense: 70,
    baseSpeed: 45,
    baseHp: 320,
    skillName: 'Hadouken',
    skillDescription: 'Counterattack: reflects 10% of damage',
  },
  {
    name: 'Liu Kang',
    faction: 'arcade',
    rarity: 'epic',
    baseAttack: 95,
    baseDefense: 90,
    baseSpeed: 60,
    baseHp: 480,
    skillName: 'Dragon Fire',
    skillDescription: 'Heals 5% of troops after each battle',
  },
  {
    name: 'Kyo Kusanagi',
    faction: 'arcade',
    rarity: 'legendary',
    baseAttack: 140,
    baseDefense: 140,
    baseSpeed: 75,
    baseHp: 800,
    skillName: 'Crimson Flame',
    skillDescription: 'Immune to first attack',
  },
];

export async function seed(_knex: Knex): Promise<void> {
  // Hero templates are stored in code, not database
  // This seed file exports the templates for use in the game logic
  console.log(`Loaded ${HERO_TEMPLATES.length} hero templates`);
}
