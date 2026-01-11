import { BattlePhase, TroopCount, Army, BattleResult } from '../entities/Battle.js';
import { Hero } from '../entities/Hero.js';
import {
  Element,
  Resources,
  BattleType,
  Coordinate,
  ELEMENT_ADVANTAGES,
  FACTION_BONUSES,
  Faction,
} from '../../shared/types/index.js';
import {
  ELEMENTAL_DAMAGE_BONUS,
  CRITICAL_HIT_CHANCE,
  CRITICAL_HIT_MULTIPLIER,
  HOSPITAL_RECOVERY_RATE,
} from '../../shared/constants/game.js';

// Troop power by tier
const TROOP_POWER: Record<number, number> = {
  1: 10,
  2: 30,
  3: 100,
  4: 300,
};

// Hero skill effects
interface SkillEffect {
  name: string;
  type: 'damage' | 'buff' | 'debuff' | 'heal' | 'special';
  value: number;
  target: 'self' | 'enemy' | 'all_allies' | 'all_enemies';
  description: string;
}

// Known hero skills from design doc
const HERO_SKILLS: Record<string, SkillEffect> = {
  // Cinema (Fire) heroes
  'John McClane': { name: 'Die Hard', type: 'buff', value: 0.1, target: 'self', description: '+10% Attack to Fire troops' },
  'Jason Bourne': { name: 'Lethal Strike', type: 'damage', value: 2.0, target: 'enemy', description: '20% chance to deal double damage' },
  'John Wick': { name: 'Baba Yaga', type: 'damage', value: 1.5, target: 'all_enemies', description: 'AoE attack hits 3 enemies' },
  'T-800 Terminator': { name: 'Titanium Armor', type: 'buff', value: 0.3, target: 'self', description: 'Reduces all incoming damage by 30%' },
  
  // Otaku (Wind) heroes
  'Naruto': { name: 'Shadow Clone', type: 'buff', value: 0.2, target: 'self', description: '+20% March Speed' },
  'Edward Elric': { name: 'Alchemy', type: 'buff', value: 0.1, target: 'self', description: '+10% Scout Range' },
  'Son Goku': { name: 'First Strike', type: 'special', value: 100, target: 'self', description: 'Always attacks first' },
  'Saitama': { name: 'One Punch', type: 'damage', value: 10.0, target: 'enemy', description: 'Instantly defeats one enemy troop unit' },
  
  // Arcade (Water) heroes
  'Mario': { name: 'Super Star', type: 'buff', value: 0.15, target: 'self', description: '+15% Defense' },
  'Ryu': { name: 'Hadouken', type: 'damage', value: 0.1, target: 'enemy', description: 'Counterattack: reflects 10% of damage' },
  'Liu Kang': { name: 'Dragon Fire', type: 'heal', value: 0.05, target: 'self', description: 'Heals 5% of troops after each battle' },
  'Kyo Kusanagi': { name: 'Flame Shield', type: 'special', value: 1, target: 'self', description: 'Immune to first attack' },
};

export interface CombatContext {
  battleType: BattleType;
  location: Coordinate;
  attacker: {
    playerId: bigint;
    faction: Faction;
    hero: Hero | null;
    troops: TroopCount[];
  };
  defender: {
    playerId: bigint | null;
    npcId: bigint | null;
    faction: Faction | null;
    hero: Hero | null;
    troops: TroopCount[];
    resources?: Resources;
  };
  terrainBonus: number;
  seed?: number;
}

export interface DetailedBattleResult extends BattleResult {
  attackerInitialPower: number;
  defenderInitialPower: number;
  attackerFinalPower: number;
  defenderFinalPower: number;
  elementalAdvantage: 'attacker' | 'defender' | 'none';
  skillsActivated: { hero: string; skill: string; effect: string }[];
  turnOrder: string[];
}

export class CombatService {
  /**
   * Resolve a battle between attacker and defender
   */
  resolveBattle(context: CombatContext): DetailedBattleResult {
    const seed = context.seed ?? Date.now();
    const rng = this.createSeededRandom(seed);
    
    // Build armies
    const attackerArmy = this.buildArmy(
      context.attacker.playerId,
      context.attacker.faction,
      context.attacker.hero,
      context.attacker.troops
    );
    
    const defenderArmy = this.buildArmy(
      context.defender.playerId ?? BigInt(0),
      context.defender.faction ?? 'arcade',
      context.defender.hero,
      context.defender.troops
    );

    // Calculate initial powers
    const attackerInitialPower = this.calculateArmyPower(attackerArmy, 1.0);
    const defenderInitialPower = this.calculateArmyPower(defenderArmy, context.terrainBonus);

    // Track state
    let attackerPower = attackerInitialPower;
    let defenderPower = defenderInitialPower;
    const phases: BattlePhase[] = [];
    const skillsActivated: { hero: string; skill: string; effect: string }[] = [];

    // Determine elemental advantage
    const attackerElement = attackerArmy.hero?.element ?? null;
    const defenderElement = defenderArmy.hero?.element ?? null;
    let elementalAdvantage: 'attacker' | 'defender' | 'none' = 'none';

    if (attackerElement && defenderElement) {
      if (ELEMENT_ADVANTAGES[attackerElement as Element] === defenderElement) {
        elementalAdvantage = 'attacker';
        attackerPower = Math.floor(attackerPower * (1 + ELEMENTAL_DAMAGE_BONUS));
      } else if (ELEMENT_ADVANTAGES[defenderElement as Element] === attackerElement) {
        elementalAdvantage = 'defender';
        defenderPower = Math.floor(defenderPower * (1 + ELEMENTAL_DAMAGE_BONUS));
      }
    }

    // Determine turn order
    const turnOrder = this.determineTurnOrder(attackerArmy, defenderArmy);

    // Apply pre-battle skills
    const preSkills = this.applyPreBattleSkills(attackerArmy, defenderArmy, rng);
    skillsActivated.push(...preSkills.activated);
    attackerPower += preSkills.attackerPowerMod;
    defenderPower += preSkills.defenderPowerMod;

    // Check for Kyo's immunity
    let defenderImmune = this.hasSkill(defenderArmy.hero, 'Flame Shield');
    let attackerImmune = this.hasSkill(attackerArmy.hero, 'Flame Shield');

    // Combat rounds
    let turn = 1;
    const maxTurns = 10;

    while (turn <= maxTurns && attackerPower > 0 && defenderPower > 0) {
      for (const actor of turnOrder) {
        if (attackerPower <= 0 || defenderPower <= 0) break;

        const isAttacker = actor === 'attacker';
        const actorArmy = isAttacker ? attackerArmy : defenderArmy;
        const targetArmy = isAttacker ? defenderArmy : attackerArmy;
        const actorPower = isAttacker ? attackerPower : defenderPower;
        const targetPower = isAttacker ? defenderPower : attackerPower;

        // Check immunity
        const targetImmune = isAttacker ? defenderImmune : attackerImmune;
        if (targetImmune) {
          if (isAttacker) defenderImmune = false;
          else attackerImmune = false;
          
          phases.push({
            turn,
            action: 'blocked',
            attacker: actor,
            damage: 0,
            critical: false,
            skillActivated: 'Flame Shield (Immune)',
          });
          continue;
        }

        // Calculate damage
        const critical = rng() < CRITICAL_HIT_CHANCE;
        let damage = this.calculateDamage(actorPower, targetPower, critical);

        // Check for special damage skills
        if (actorArmy.hero) {
          const skillEffect = this.getHeroSkillEffect(actorArmy.hero.name);
          if (skillEffect?.type === 'damage' && rng() < 0.2) {
            damage = Math.floor(damage * skillEffect.value);
            skillsActivated.push({
              hero: actorArmy.hero.name,
              skill: skillEffect.name,
              effect: skillEffect.description,
            });
          }
        }

        // Apply damage reduction from T-800
        if (targetArmy.hero && this.hasSkill(targetArmy.hero, 'Titanium Armor')) {
          damage = Math.floor(damage * 0.7);
        }

        // Apply damage
        if (isAttacker) {
          defenderPower = Math.max(0, defenderPower - damage);
        } else {
          attackerPower = Math.max(0, attackerPower - damage);
        }

        // Check for counterattack (Ryu)
        let counterDamage = 0;
        if (targetArmy.hero && this.hasSkill(targetArmy.hero, 'Hadouken')) {
          counterDamage = Math.floor(damage * 0.1);
          if (isAttacker) {
            attackerPower = Math.max(0, attackerPower - counterDamage);
          } else {
            defenderPower = Math.max(0, defenderPower - counterDamage);
          }
        }

        phases.push({
          turn,
          action: 'attack',
          attacker: actor,
          damage,
          critical,
          skillActivated: counterDamage > 0 ? `Hadouken (${counterDamage} reflected)` : undefined,
        });
      }

      turn++;
    }

    // Determine winner
    const winner: 'attacker' | 'defender' = attackerPower > defenderPower ? 'attacker' : 'defender';

    // Calculate casualties
    const attackerCasualties = this.calculateCasualties(
      context.attacker.troops,
      winner === 'defender',
      attackerInitialPower,
      attackerPower
    );
    const defenderCasualties = this.calculateCasualties(
      context.defender.troops,
      winner === 'attacker',
      defenderInitialPower,
      defenderPower
    );

    // Apply Liu Kang's healing
    if (winner === 'attacker' && attackerArmy.hero && this.hasSkill(attackerArmy.hero, 'Dragon Fire')) {
      // Reduce wounded by 5%
      for (const w of attackerCasualties.wounded) {
        w.count = Math.floor(w.count * 0.95);
      }
    }

    // Calculate loot
    const loot = this.calculateLoot(winner, context.defender.resources);

    // Calculate hero XP
    const heroXpGained = this.calculateHeroXp(winner, context.battleType, defenderInitialPower);

    return {
      winner,
      attackerCasualties,
      defenderCasualties,
      loot,
      heroXpGained,
      phases,
      attackerInitialPower,
      defenderInitialPower,
      attackerFinalPower: attackerPower,
      defenderFinalPower: defenderPower,
      elementalAdvantage,
      skillsActivated,
      turnOrder,
    };
  }

  private buildArmy(playerId: bigint, faction: Faction, hero: Hero | null, troops: TroopCount[]): Army {
    return {
      playerId,
      hero,
      troops: Array.isArray(troops) ? troops : [],
      factionBonus: FACTION_BONUSES[faction],
    };
  }

  private calculateArmyPower(army: Army, terrainBonus: number): number {
    const troopsArray = Array.isArray(army.troops) ? army.troops : [];
    const troopPower = troopsArray.reduce((sum: number, t: TroopCount) => sum + t.count * TROOP_POWER[t.tier], 0);
    const heroPower = army.hero?.getPower() ?? 0;
    const attackBonus = army.factionBonus.attack ?? 1.0;
    const defenseBonus = army.factionBonus.defense ?? 1.0;
    const combinedBonus = Math.max(attackBonus, defenseBonus);

    return Math.floor((troopPower + heroPower) * combinedBonus * terrainBonus);
  }

  private determineTurnOrder(attacker: Army, defender: Army): string[] {
    const attackerSpeed = attacker.hero?.speed ?? 0;
    const defenderSpeed = defender.hero?.speed ?? 0;

    // Check for First Strike skill (Goku)
    const attackerFirstStrike = this.hasSkill(attacker.hero, 'First Strike');
    const defenderFirstStrike = this.hasSkill(defender.hero, 'First Strike');

    if (attackerFirstStrike && !defenderFirstStrike) {
      return ['attacker', 'defender'];
    }
    if (defenderFirstStrike && !attackerFirstStrike) {
      return ['defender', 'attacker'];
    }

    // Speed-based order
    return attackerSpeed >= defenderSpeed ? ['attacker', 'defender'] : ['defender', 'attacker'];
  }

  private applyPreBattleSkills(
    attacker: Army,
    defender: Army,
    _rng: () => number
  ): { attackerPowerMod: number; defenderPowerMod: number; activated: { hero: string; skill: string; effect: string }[] } {
    let attackerPowerMod = 0;
    let defenderPowerMod = 0;
    const activated: { hero: string; skill: string; effect: string }[] = [];

    // Apply passive buffs
    if (attacker.hero) {
      const skill = this.getHeroSkillEffect(attacker.hero.name);
      if (skill?.type === 'buff') {
        attackerPowerMod = Math.floor(this.calculateArmyPower(attacker, 1.0) * skill.value);
        activated.push({ hero: attacker.hero.name, skill: skill.name, effect: skill.description });
      }
    }

    if (defender.hero) {
      const skill = this.getHeroSkillEffect(defender.hero.name);
      if (skill?.type === 'buff') {
        defenderPowerMod = Math.floor(this.calculateArmyPower(defender, 1.0) * skill.value);
        activated.push({ hero: defender.hero.name, skill: skill.name, effect: skill.description });
      }
    }

    return { attackerPowerMod, defenderPowerMod, activated };
  }

  private hasSkill(hero: Hero | null, skillName: string): boolean {
    if (!hero) return false;
    const effect = HERO_SKILLS[hero.name];
    return effect?.name === skillName;
  }

  private getHeroSkillEffect(heroName: string): SkillEffect | null {
    return HERO_SKILLS[heroName] ?? null;
  }

  private calculateDamage(attackerPower: number, defenderPower: number, critical: boolean): number {
    const baseDamage = attackerPower * (1 - defenderPower / (defenderPower + 100));
    const finalDamage = critical ? baseDamage * CRITICAL_HIT_MULTIPLIER : baseDamage;
    return Math.floor(Math.max(1, finalDamage * 0.1));
  }

  private calculateCasualties(
    troops: TroopCount[],
    isLoser: boolean,
    initialPower: number,
    finalPower: number
  ): { dead: TroopCount[]; wounded: TroopCount[] } {
    // Ensure troops is an array
    const troopsArray = Array.isArray(troops) ? troops : [];
    
    // Calculate casualty rate based on power loss
    const powerLossRatio = initialPower > 0 ? 1 - (finalPower / initialPower) : 0;
    const baseCasualtyRate = isLoser ? 0.5 : 0.1;
    const casualtyRate = Math.min(0.8, baseCasualtyRate + powerLossRatio * 0.3);

    const dead: TroopCount[] = [];
    const wounded: TroopCount[] = [];

    for (const troop of troopsArray) {
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

  private calculateLoot(winner: 'attacker' | 'defender', defenderResources?: Resources): Resources {
    if (winner !== 'attacker' || !defenderResources) {
      return { food: 0, iron: 0, gold: 0 };
    }

    // Attacker captures 20% of defender's resources
    return {
      food: Math.floor(defenderResources.food * 0.2),
      iron: Math.floor(defenderResources.iron * 0.2),
      gold: Math.floor(defenderResources.gold * 0.2),
    };
  }

  private calculateHeroXp(winner: 'attacker' | 'defender', battleType: BattleType, enemyPower: number): number {
    const baseXp = winner === 'attacker' ? 50 : 25;
    const powerBonus = Math.floor(enemyPower / 100);
    
    const typeMultiplier: Record<BattleType, number> = {
      pvp: 1.5,
      pve: 1.0,
      arena: 2.0,
      conquest: 2.5,
      rally: 1.5,
    };

    return Math.floor((baseXp + powerBonus) * typeMultiplier[battleType]);
  }

  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Scout a location without engaging in combat
   */
  scoutLocation(
    targetTroops: TroopCount[],
    targetHero: Hero | null,
    targetFaction: Faction | null
  ): { power: number; troops: { tier: number; count: string }[]; hero: string | null } {
    // Ensure targetTroops is an array
    const troopsArray = Array.isArray(targetTroops) ? targetTroops : [];
    
    const army = this.buildArmy(BigInt(0), targetFaction ?? 'arcade', targetHero, troopsArray);
    const power = this.calculateArmyPower(army, 1.0);

    // Show approximate troop counts
    const troops = troopsArray.map(t => ({
      tier: t.tier,
      count: this.approximateCount(t.count),
    }));

    return {
      power,
      troops,
      hero: targetHero?.name ?? null,
    };
  }

  private approximateCount(count: number): string {
    if (count < 10) return '< 10';
    if (count < 50) return '10-50';
    if (count < 100) return '50-100';
    if (count < 250) return '100-250';
    if (count < 500) return '250-500';
    return '500+';
  }
}

export const combatService = new CombatService();
