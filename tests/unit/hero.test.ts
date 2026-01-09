import { Hero } from '../../src/domain/entities/Hero.js';

describe('Hero Entity', () => {
  describe('create', () => {
    it('should create a common hero with correct base stats', () => {
      const hero = Hero.create(BigInt(1), 'John McClane', 'cinema', 'common');

      expect(hero.name).toBe('John McClane');
      expect(hero.faction).toBe('cinema');
      expect(hero.element).toBe('fire');
      expect(hero.rarity).toBe('common');
      expect(hero.level).toBe(1);
      expect(hero.attack).toBe(50);
      expect(hero.defense).toBe(40);
      expect(hero.speed).toBe(30);
      expect(hero.hp).toBe(200);
    });

    it('should create a legendary hero with higher base stats', () => {
      const hero = Hero.create(BigInt(1), 'T-800 Terminator', 'cinema', 'legendary');

      expect(hero.rarity).toBe('legendary');
      expect(hero.attack).toBe(150);
      expect(hero.defense).toBe(120);
      expect(hero.speed).toBe(80);
      expect(hero.hp).toBe(700);
    });

    it('should assign correct element based on faction', () => {
      const cinemaHero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      const otakuHero = Hero.create(BigInt(1), 'Test', 'otaku', 'common');
      const arcadeHero = Hero.create(BigInt(1), 'Test', 'arcade', 'common');

      expect(cinemaHero.element).toBe('fire');
      expect(otakuHero.element).toBe('wind');
      expect(arcadeHero.element).toBe('water');
    });
  });

  describe('power calculation', () => {
    it('should calculate power correctly for level 1 hero', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      const power = hero.getPower();

      // attack(50) + defense(40) + speed(30) + hp/10(20) = 140
      expect(power).toBe(140);
    });

    it('should include gear in power calculation', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      hero.equipGear('weapon', { name: 'Sword', power: 50 });
      hero.equipGear('armor', { name: 'Shield', power: 30 });

      // Base stats + gear bonuses
      expect(hero.attack).toBe(100); // 50 + 50
      expect(hero.defense).toBe(70); // 40 + 30
    });
  });

  describe('leveling', () => {
    it('should level up when enough XP is gained', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      const result = hero.addExperience(100); // Level 1 needs 100 XP

      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(hero.level).toBe(2);
    });

    it('should handle multiple level ups', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      const result = hero.addExperience(500); // Enough for multiple levels

      expect(result.leveledUp).toBe(true);
      expect(hero.level).toBeGreaterThan(2);
    });

    it('should not exceed max level 50', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      // XP needed: sum of (level * 100) for levels 1-49 = 100 * (49*50/2) = 122,500
      hero.addExperience(200000); // Way more than needed

      expect(hero.level).toBe(50);
    });

    it('should increase stats with level', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      const initialAttack = hero.attack;

      hero.addExperience(100); // Level up

      expect(hero.attack).toBeGreaterThan(initialAttack);
    });
  });

  describe('gear management', () => {
    it('should equip weapon', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      hero.equipGear('weapon', { name: 'Sword', power: 50 });

      expect(hero.gear.weapon).toEqual({ name: 'Sword', power: 50 });
    });

    it('should equip armor', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      hero.equipGear('armor', { name: 'Shield', power: 30 });

      expect(hero.gear.armor).toEqual({ name: 'Shield', power: 30 });
    });

    it('should unequip gear', () => {
      const hero = Hero.create(BigInt(1), 'Test', 'cinema', 'common');
      hero.equipGear('weapon', { name: 'Sword', power: 50 });
      hero.unequipGear('weapon');

      expect(hero.gear.weapon).toBeUndefined();
    });
  });
});
