import {
  Faction,
  Element,
  HeroRarity,
  FACTION_ELEMENTS,
} from '../../shared/types/index.js';
import { HERO_MAX_LEVEL, HERO_SKILL_MILESTONES } from '../../shared/constants/game.js';

export interface HeroSkill {
  name: string;
  description: string;
  type: 'active' | 'passive';
  level: number;
  unlockLevel: number;
}

export interface HeroGear {
  weapon?: { name: string; power: number };
  armor?: { name: string; power: number };
}

export interface HeroData {
  id: bigint;
  playerId: bigint;
  name: string;
  faction: Faction;
  element: Element;
  rarity: HeroRarity;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  speed: number;
  hp: number;
  skills: HeroSkill[];
  gear: HeroGear;
  createdAt: Date;
}

const RARITY_BASE_STATS: Record<HeroRarity, { attack: number; defense: number; speed: number; hp: number }> = {
  common: { attack: 50, defense: 40, speed: 30, hp: 200 },
  rare: { attack: 75, defense: 60, speed: 45, hp: 300 },
  epic: { attack: 100, defense: 80, speed: 60, hp: 450 },
  legendary: { attack: 150, defense: 120, speed: 80, hp: 700 },
};

const RARITY_LEVEL_MULTIPLIER: Record<HeroRarity, number> = {
  common: 1.0,
  rare: 1.5,
  epic: 2.5,
  legendary: 4.0,
};

const XP_PER_LEVEL = 100;

export class Hero {
  readonly id: bigint;
  readonly playerId: bigint;
  readonly name: string;
  readonly faction: Faction;
  readonly element: Element;
  readonly rarity: HeroRarity;
  private _level: number;
  private _experience: number;
  private _baseAttack: number;
  private _baseDefense: number;
  private _baseSpeed: number;
  private _baseHp: number;
  private _skills: HeroSkill[];
  private _gear: HeroGear;
  readonly createdAt: Date;

  constructor(data: HeroData) {
    this.id = data.id;
    this.playerId = data.playerId;
    this.name = data.name;
    this.faction = data.faction;
    this.element = data.element;
    this.rarity = data.rarity;
    this._level = data.level;
    this._experience = data.experience;
    this._baseAttack = data.attack;
    this._baseDefense = data.defense;
    this._baseSpeed = data.speed;
    this._baseHp = data.hp;
    this._skills = [...data.skills];
    this._gear = { ...data.gear };
    this.createdAt = data.createdAt;
  }

  static create(playerId: bigint, name: string, faction: Faction, rarity: HeroRarity): Hero {
    const baseStats = RARITY_BASE_STATS[rarity];
    const element = FACTION_ELEMENTS[faction];

    return new Hero({
      id: BigInt(0),
      playerId,
      name,
      faction,
      element,
      rarity,
      level: 1,
      experience: 0,
      attack: baseStats.attack,
      defense: baseStats.defense,
      speed: baseStats.speed,
      hp: baseStats.hp,
      skills: [],
      gear: {},
      createdAt: new Date(),
    });
  }

  get level(): number {
    return this._level;
  }

  get experience(): number {
    return this._experience;
  }

  get attack(): number {
    const levelBonus = (this._level - 1) * 5 * RARITY_LEVEL_MULTIPLIER[this.rarity];
    const gearBonus = this._gear.weapon?.power ?? 0;
    return Math.floor(this._baseAttack + levelBonus + gearBonus);
  }

  get defense(): number {
    const levelBonus = (this._level - 1) * 4 * RARITY_LEVEL_MULTIPLIER[this.rarity];
    const gearBonus = this._gear.armor?.power ?? 0;
    return Math.floor(this._baseDefense + levelBonus + gearBonus);
  }

  get speed(): number {
    const levelBonus = (this._level - 1) * 2 * RARITY_LEVEL_MULTIPLIER[this.rarity];
    return Math.floor(this._baseSpeed + levelBonus);
  }

  get hp(): number {
    const levelBonus = (this._level - 1) * 20 * RARITY_LEVEL_MULTIPLIER[this.rarity];
    return Math.floor(this._baseHp + levelBonus);
  }

  get skills(): HeroSkill[] {
    return [...this._skills];
  }

  get gear(): HeroGear {
    return { ...this._gear };
  }

  getPower(): number {
    const statPower = this.attack + this.defense + this.speed + this.hp / 10;
    const skillPower = this._skills.reduce((sum, skill) => sum + skill.level * 10, 0);
    return Math.floor(statPower + skillPower);
  }

  getXpForNextLevel(): number {
    if (this._level >= HERO_MAX_LEVEL) return 0;
    return this._level * XP_PER_LEVEL;
  }

  addExperience(xp: number): { leveledUp: boolean; newLevel: number } {
    if (this._level >= HERO_MAX_LEVEL) {
      return { leveledUp: false, newLevel: this._level };
    }

    this._experience += xp;
    let leveledUp = false;

    let xpNeeded = this.getXpForNextLevel();
    while (this._level < HERO_MAX_LEVEL && xpNeeded > 0 && this._experience >= xpNeeded) {
      this._experience -= xpNeeded;
      this._level++;
      leveledUp = true;
      this.checkSkillUnlocks();
      xpNeeded = this.getXpForNextLevel();
    }

    return { leveledUp, newLevel: this._level };
  }

  private checkSkillUnlocks(): void {
    for (const milestone of HERO_SKILL_MILESTONES) {
      if (this._level >= milestone) {
        const existingSkill = this._skills.find((s) => s.unlockLevel === milestone);
        if (!existingSkill) {
          this._skills.push({
            name: `Skill ${milestone}`,
            description: `Unlocked at level ${milestone}`,
            type: milestone % 20 === 0 ? 'active' : 'passive',
            level: 1,
            unlockLevel: milestone,
          });
        }
      }
    }
  }

  equipGear(type: 'weapon' | 'armor', gear: { name: string; power: number }): void {
    this._gear[type] = gear;
  }

  unequipGear(type: 'weapon' | 'armor'): void {
    delete this._gear[type];
  }

  upgradeSkill(skillIndex: number): boolean {
    if (skillIndex < 0 || skillIndex >= this._skills.length) return false;
    this._skills[skillIndex].level++;
    return true;
  }

  toData(): HeroData {
    return {
      id: this.id,
      playerId: this.playerId,
      name: this.name,
      faction: this.faction,
      element: this.element,
      rarity: this.rarity,
      level: this._level,
      experience: this._experience,
      attack: this._baseAttack,
      defense: this._baseDefense,
      speed: this._baseSpeed,
      hp: this._baseHp,
      skills: [...this._skills],
      gear: { ...this._gear },
      createdAt: this.createdAt,
    };
  }
}
