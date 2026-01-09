import {
  Faction,
  Coordinate,
  Resources,
  FACTION_BONUSES,
  FactionBonus,
} from '../../shared/types/index.js';
import { STARTER_RESOURCES, STARTER_DIAMONDS, PROTECTION_SHIELD_HOURS } from '../../shared/constants/game.js';

export interface PlayerData {
  id: bigint;
  discordId: bigint;
  username: string;
  faction: Faction;
  coordX: number;
  coordY: number;
  resources: Resources;
  diamonds: number;
  arenaRating: number;
  arenaTokens: number;
  prestigePoints: number;
  protectionUntil: Date | null;
  lastActive: Date;
  lastArenaTokenRegen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Player {
  readonly id: bigint;
  readonly discordId: bigint;
  readonly username: string;
  readonly faction: Faction;
  private _coordinates: Coordinate;
  private _resources: Resources;
  private _diamonds: number;
  private _arenaRating: number;
  private _arenaTokens: number;
  private _prestigePoints: number;
  private _protectionUntil: Date | null;
  private _lastActive: Date;
  private _lastArenaTokenRegen: Date;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(data: PlayerData) {
    this.id = data.id;
    this.discordId = data.discordId;
    this.username = data.username;
    this.faction = data.faction;
    this._coordinates = { x: data.coordX, y: data.coordY };
    this._resources = { ...data.resources };
    this._diamonds = data.diamonds;
    this._arenaRating = data.arenaRating;
    this._arenaTokens = data.arenaTokens;
    this._prestigePoints = data.prestigePoints;
    this._protectionUntil = data.protectionUntil;
    this._lastActive = data.lastActive;
    this._lastArenaTokenRegen = data.lastArenaTokenRegen;
    this.createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  static create(discordId: bigint, username: string, faction: Faction, coordinates: Coordinate): Player {
    const now = new Date();
    const protectionUntil = new Date(now.getTime() + PROTECTION_SHIELD_HOURS * 60 * 60 * 1000);

    return new Player({
      id: BigInt(0), // Will be set by database
      discordId,
      username,
      faction,
      coordX: coordinates.x,
      coordY: coordinates.y,
      resources: { ...STARTER_RESOURCES },
      diamonds: STARTER_DIAMONDS,
      arenaRating: 1000,
      arenaTokens: 10,
      prestigePoints: 0,
      protectionUntil,
      lastActive: now,
      lastArenaTokenRegen: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  get coordinates(): Coordinate {
    return { ...this._coordinates };
  }

  get resources(): Resources {
    return { ...this._resources };
  }

  get diamonds(): number {
    return this._diamonds;
  }

  get arenaRating(): number {
    return this._arenaRating;
  }

  get arenaTokens(): number {
    return this._arenaTokens;
  }

  get prestigePoints(): number {
    return this._prestigePoints;
  }

  get protectionUntil(): Date | null {
    return this._protectionUntil;
  }

  get lastActive(): Date {
    return this._lastActive;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  getFactionBonus(): FactionBonus {
    return FACTION_BONUSES[this.faction];
  }

  isProtected(): boolean {
    return this._protectionUntil !== null && this._protectionUntil > new Date();
  }

  hasResources(required: Partial<Resources>): boolean {
    return (
      (required.food === undefined || this._resources.food >= required.food) &&
      (required.iron === undefined || this._resources.iron >= required.iron) &&
      (required.gold === undefined || this._resources.gold >= required.gold)
    );
  }

  hasDiamonds(amount: number): boolean {
    return this._diamonds >= amount;
  }

  addResources(resources: Partial<Resources>): void {
    if (resources.food) this._resources.food += resources.food;
    if (resources.iron) this._resources.iron += resources.iron;
    if (resources.gold) this._resources.gold += resources.gold;
    this._updatedAt = new Date();
  }

  deductResources(resources: Partial<Resources>): boolean {
    if (!this.hasResources(resources)) return false;

    if (resources.food) this._resources.food -= resources.food;
    if (resources.iron) this._resources.iron -= resources.iron;
    if (resources.gold) this._resources.gold -= resources.gold;
    this._updatedAt = new Date();
    return true;
  }

  addDiamonds(amount: number): void {
    this._diamonds += amount;
    this._updatedAt = new Date();
  }

  deductDiamonds(amount: number): boolean {
    if (!this.hasDiamonds(amount)) return false;
    this._diamonds -= amount;
    this._updatedAt = new Date();
    return true;
  }

  updateArenaRating(change: number): void {
    this._arenaRating = Math.max(0, this._arenaRating + change);
    this._updatedAt = new Date();
  }

  useArenaToken(): boolean {
    if (this._arenaTokens <= 0) return false;
    this._arenaTokens--;
    this._updatedAt = new Date();
    return true;
  }

  regenerateArenaTokens(): number {
    const now = new Date();
    const hoursSinceRegen = (now.getTime() - this._lastArenaTokenRegen.getTime()) / (1000 * 60 * 60);
    const tokensToAdd = Math.floor(hoursSinceRegen / 2); // 1 token per 2 hours

    if (tokensToAdd > 0) {
      this._arenaTokens = Math.min(10, this._arenaTokens + tokensToAdd);
      this._lastArenaTokenRegen = now;
      this._updatedAt = now;
    }

    return this._arenaTokens;
  }

  addPrestigePoints(points: number): void {
    this._prestigePoints += points;
    this._updatedAt = new Date();
  }

  removeProtection(): void {
    this._protectionUntil = null;
    this._updatedAt = new Date();
  }

  updateLastActive(): void {
    this._lastActive = new Date();
    this._updatedAt = new Date();
  }

  toData(): PlayerData {
    return {
      id: this.id,
      discordId: this.discordId,
      username: this.username,
      faction: this.faction,
      coordX: this._coordinates.x,
      coordY: this._coordinates.y,
      resources: { ...this._resources },
      diamonds: this._diamonds,
      arenaRating: this._arenaRating,
      arenaTokens: this._arenaTokens,
      prestigePoints: this._prestigePoints,
      protectionUntil: this._protectionUntil,
      lastActive: this._lastActive,
      lastArenaTokenRegen: this._lastArenaTokenRegen,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
