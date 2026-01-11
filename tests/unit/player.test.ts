import { Player } from '../../src/domain/entities/Player.js';
import { STARTER_RESOURCES, STARTER_DIAMONDS } from '../../src/shared/constants/game.js';

describe('Player Entity', () => {
  describe('create', () => {
    it('should create a new player with starter resources', () => {
      const player = Player.create(BigInt(123456789), 'TestPlayer', 'cinema', { x: 50, y: 50 });

      expect(player.username).toBe('TestPlayer');
      expect(player.faction).toBe('cinema');
      expect(player.coordinates).toEqual({ x: 50, y: 50 });
      expect(player.resources).toEqual(STARTER_RESOURCES);
      expect(player.diamonds).toBe(STARTER_DIAMONDS);
      expect(player.arenaRating).toBe(1000);
    });

    it('should apply 24-hour protection shield', () => {
      const player = Player.create(BigInt(123456789), 'TestPlayer', 'otaku', { x: 25, y: 75 });

      expect(player.isProtected()).toBe(true);
      expect(player.protectionUntil).not.toBeNull();
    });
  });

  describe('faction bonuses', () => {
    it('should return correct bonus for cinema faction', () => {
      const player = Player.create(BigInt(1), 'CinemaPlayer', 'cinema', { x: 0, y: 0 });
      expect(player.getFactionBonus()).toEqual({ attack: 1.1 });
    });

    it('should return correct bonus for otaku faction', () => {
      const player = Player.create(BigInt(2), 'OtakuPlayer', 'otaku', { x: 0, y: 0 });
      expect(player.getFactionBonus()).toEqual({ marchSpeed: 1.15 });
    });

    it('should return correct bonus for arcade faction', () => {
      const player = Player.create(BigInt(3), 'ArcadePlayer', 'arcade', { x: 0, y: 0 });
      expect(player.getFactionBonus()).toEqual({ defense: 1.1 });
    });
  });

  describe('resource management', () => {
    it('should check if player has sufficient resources', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });

      expect(player.hasResources({ food: 500 })).toBe(true);
      expect(player.hasResources({ food: 10000 })).toBe(false);
      expect(player.hasResources({ food: 5000, iron: 2500, gold: 1000 })).toBe(true);
    });

    it('should add resources correctly', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      player.addResources({ food: 500, iron: 200 });

      expect(player.resources.food).toBe(5500);
      expect(player.resources.iron).toBe(2700);
      expect(player.resources.gold).toBe(1000);
    });

    it('should deduct resources correctly', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      const result = player.deductResources({ food: 500, iron: 200 });

      expect(result).toBe(true);
      expect(player.resources.food).toBe(4500);
      expect(player.resources.iron).toBe(2300);
    });

    it('should not deduct resources if insufficient', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      const result = player.deductResources({ food: 10000 });

      expect(result).toBe(false);
      expect(player.resources.food).toBe(5000); // Unchanged
    });
  });

  describe('diamond management', () => {
    it('should add diamonds correctly', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      player.addDiamonds(50);

      expect(player.diamonds).toBe(550);
    });

    it('should deduct diamonds correctly', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      const result = player.deductDiamonds(50);

      expect(result).toBe(true);
      expect(player.diamonds).toBe(450);
    });

    it('should not deduct diamonds if insufficient', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      const result = player.deductDiamonds(600);

      expect(result).toBe(false);
      expect(player.diamonds).toBe(500); // Unchanged
    });
  });

  describe('arena', () => {
    it('should update arena rating', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      player.updateArenaRating(30);

      expect(player.arenaRating).toBe(1030);
    });

    it('should not go below 0 rating', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      player.updateArenaRating(-2000);

      expect(player.arenaRating).toBe(0);
    });

    it('should use arena tokens', () => {
      const player = Player.create(BigInt(1), 'Test', 'cinema', { x: 0, y: 0 });
      const result = player.useArenaToken();

      expect(result).toBe(true);
      expect(player.arenaTokens).toBe(9);
    });
  });
});
