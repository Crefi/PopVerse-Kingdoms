import {
  Coordinate,
  Resources,
  Element,
  BattleType,
  ELEMENT_ADVANTAGES,
} from '../../shared/types/index.js';
import {
  ELEMENTAL_DAMAGE_BONUS,
  CRITICAL_HIT_CHANCE,
  CRITICAL_HIT_MULTIPLIER,
  HOSPITAL_RECOVERY_RATE,
} from '../../shared/constants/game.js';
import { Hero } from './Hero.js';

export interface TroopCount {
  tier: 1 | 2 | 3 | 4;
  count: number;
}

export interface Army {
  playerId: bigint;
  hero: Hero | null;
  troops: TroopCount[];
  factionBonus: { attack?: number; defense?: number };
}

export interface BattlePhase {
  turn: number;
  action: string;
  attacker: string;
  damage: number;
  critical: boolean;
  skillActivated?: string;
}

export interface BattleCasualties {
  dead: TroopCount[];
  wounded: TroopCount[];
}

export interface BattleResult {
  winner: 'attacker' | 'defender';
  attackerCasualties: BattleCasualties;
  defenderCasualties: BattleCasualties;
  loot: Resources;
  heroXpGained: number;
  phases: BattlePhase[];
}

export interface BattleData {
  id: bigint;
  type: BattleType;
  attackerId: bigint | null;
  defenderId: bigint | null;
  npcId: bigint | null;
  location: Coordinate;
  attackerArmy: Army;
  defenderArmy: Army;
  result: BattleResult;
  createdAt: Date;
}

// Troop power by tier
const TROOP_POWER: Record<number, number> = {
  1: 10,
  2: 30,
  3: 100,
  4: 300,
};

export class Battle {
  readonly id: bigint;
  readonly type: BattleType;
  readonly attackerId: bigint | null;
  readonly defenderId: bigint | null;
  readonly npcId: bigint | null;
  readonly location: Coordinate;
  readonly attackerArmy: Army;
  readonly defenderArmy: Army;
  private _result: BattleResult | null = null;
  readonly createdAt: Date;

  constructor(data: Partial<BattleData> & { type: BattleType; location: Coordinate; attackerArmy: Army; defenderArmy: Army }) {
    this.id = data.id ?? BigInt(0);
    this.type = data.type;
    this.attackerId = data.attackerId ?? null;
    this.defenderId = data.defenderId ?? null;
    this.npcId = data.npcId ?? null;
    this.location = data.location;
    this.attackerArmy = data.attackerArmy;
    this.defenderArmy = data.defenderArmy;
    this._result = data.result ?? null;
    this.createdAt = data.createdAt ?? new Date();
  }

  get result(): BattleResult | null {
    return this._result;
  }

  static calculateArmyPower(army: Army, terrainBonus: number = 1.0): number {
    // Calculate troop power
    const troopPower = army.troops.reduce((sum, t) => sum + t.count * TROOP_POWER[t.tier], 0);

    // Calculate hero power
    const heroPower = army.hero?.getPower() ?? 0;

    // Apply faction bonus
    const attackBonus = army.factionBonus.attack ?? 1.0;
    const defenseBonus = army.factionBonus.defense ?? 1.0;
    const combinedBonus = Math.max(attackBonus, defenseBonus);

    return Math.floor((troopPower + heroPower) * combinedBonus * terrainBonus);
  }

  static getElementalModifier(attackerElement: Element | null, defenderElement: Element | null): number {
    if (!attackerElement || !defenderElement) return 1.0;

    if (ELEMENT_ADVANTAGES[attackerElement] === defenderElement) {
      return 1 + ELEMENTAL_DAMAGE_BONUS; // 1.25
    }
    if (ELEMENT_ADVANTAGES[defenderElement] === attackerElement) {
      return 1 - ELEMENTAL_DAMAGE_BONUS; // 0.75
    }
    return 1.0;
  }

  resolve(seed: number, terrainBonus: number = 1.0): BattleResult {
    const rng = this.createSeededRandom(seed);
    const phases: BattlePhase[] = [];

    // Calculate base powers
    let attackerPower = Battle.calculateArmyPower(this.attackerArmy);
    let defenderPower = Battle.calculateArmyPower(this.defenderArmy, terrainBonus);

    // Get elements
    const attackerElement = this.attackerArmy.hero?.element ?? null;
    const defenderElement = this.defenderArmy.hero?.element ?? null;

    // Apply elemental modifier
    const elementalMod = Battle.getElementalModifier(attackerElement, defenderElement);
    attackerPower = Math.floor(attackerPower * elementalMod);

    // Determine turn order based on speed
    const attackerSpeed = this.attackerArmy.hero?.speed ?? 0;
    const defenderSpeed = this.defenderArmy.hero?.speed ?? 0;
    const attackerFirst = attackerSpeed >= defenderSpeed;

    // Simulate combat phases
    let turn = 1;
    const maxTurns = 10;

    while (turn <= maxTurns && attackerPower > 0 && defenderPower > 0) {
      const first = attackerFirst ? 'attacker' : 'defender';
      const second = attackerFirst ? 'defender' : 'attacker';

      // First strike
      const firstCrit = rng() < CRITICAL_HIT_CHANCE;
      const firstDamage = this.calculateDamage(
        first === 'attacker' ? attackerPower : defenderPower,
        first === 'attacker' ? defenderPower : attackerPower,
        firstCrit
      );

      if (first === 'attacker') {
        defenderPower -= firstDamage;
      } else {
        attackerPower -= firstDamage;
      }

      phases.push({
        turn,
        action: 'attack',
        attacker: first,
        damage: firstDamage,
        critical: firstCrit,
        skillActivated: this.checkSkillActivation(first === 'attacker' ? this.attackerArmy.hero : this.defenderArmy.hero, rng),
      });

      // Second strike (if still alive)
      if ((first === 'attacker' ? defenderPower : attackerPower) > 0) {
        const secondCrit = rng() < CRITICAL_HIT_CHANCE;
        const secondDamage = this.calculateDamage(
          second === 'attacker' ? attackerPower : defenderPower,
          second === 'attacker' ? defenderPower : attackerPower,
          secondCrit
        );

        if (second === 'attacker') {
          defenderPower -= secondDamage;
        } else {
          attackerPower -= secondDamage;
        }

        phases.push({
          turn,
          action: 'counterattack',
          attacker: second,
          damage: secondDamage,
          critical: secondCrit,
          skillActivated: this.checkSkillActivation(second === 'attacker' ? this.attackerArmy.hero : this.defenderArmy.hero, rng),
        });
      }

      turn++;
    }

    // Determine winner
    const winner: 'attacker' | 'defender' = attackerPower > defenderPower ? 'attacker' : 'defender';

    // Calculate casualties
    const attackerCasualties = this.calculateCasualties(this.attackerArmy.troops, winner === 'defender');
    const defenderCasualties = this.calculateCasualties(this.defenderArmy.troops, winner === 'attacker');

    // Calculate loot (20% of defender's resources if attacker wins)
    const loot: Resources = winner === 'attacker' ? { food: 500, iron: 200, gold: 100 } : { food: 0, iron: 0, gold: 0 };

    // Calculate hero XP
    const heroXpGained = winner === 'attacker' ? 50 : 25;

    this._result = {
      winner,
      attackerCasualties,
      defenderCasualties,
      loot,
      heroXpGained,
      phases,
    };

    return this._result;
  }

  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  private calculateDamage(attackerPower: number, defenderPower: number, critical: boolean): number {
    // Damage formula from design doc
    const baseDamage = attackerPower * (1 - defenderPower / (defenderPower + 100));
    const finalDamage = critical ? baseDamage * CRITICAL_HIT_MULTIPLIER : baseDamage;
    return Math.floor(Math.max(1, finalDamage * 0.1)); // Scale down for multi-turn combat
  }

  private checkSkillActivation(hero: Hero | null, rng: () => number): string | undefined {
    if (!hero || hero.skills.length === 0) return undefined;
    if (rng() < 0.3) {
      // 30% chance to activate skill
      return hero.skills[0]?.name;
    }
    return undefined;
  }

  private calculateCasualties(troops: TroopCount[], isLoser: boolean): BattleCasualties {
    const casualtyRate = isLoser ? 0.5 + Math.random() * 0.3 : 0.1 + Math.random() * 0.2;

    const dead: TroopCount[] = [];
    const wounded: TroopCount[] = [];

    for (const troop of troops) {
      const totalLost = Math.floor(troop.count * casualtyRate);
      const deadCount = Math.floor(totalLost * (1 - HOSPITAL_RECOVERY_RATE));
      const woundedCount = totalLost - deadCount;

      if (deadCount > 0) {
        dead.push({ tier: troop.tier, count: deadCount });
      }
      if (woundedCount > 0) {
        wounded.push({ tier: troop.tier, count: woundedCount });
      }
    }

    return { dead, wounded };
  }

  toData(): BattleData {
    return {
      id: this.id,
      type: this.type,
      attackerId: this.attackerId,
      defenderId: this.defenderId,
      npcId: this.npcId,
      location: this.location,
      attackerArmy: this.attackerArmy,
      defenderArmy: this.defenderArmy,
      result: this._result!,
      createdAt: this.createdAt,
    };
  }
}
