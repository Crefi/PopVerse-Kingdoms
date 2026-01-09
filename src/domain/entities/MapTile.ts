import { Coordinate, TerrainType } from '../../shared/types/index.js';

export interface MapTileData {
  x: number;
  y: number;
  terrain: TerrainType;
  occupantId: bigint | null;
  npcId: bigint | null;
  landParcelId: bigint | null;
  updatedAt: Date;
}

export class MapTile {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainType;
  private _occupantId: bigint | null;
  private _npcId: bigint | null;
  private _landParcelId: bigint | null;
  private _updatedAt: Date;

  constructor(data: MapTileData) {
    this.x = data.x;
    this.y = data.y;
    this.terrain = data.terrain;
    this._occupantId = data.occupantId;
    this._npcId = data.npcId;
    this._landParcelId = data.landParcelId;
    this._updatedAt = data.updatedAt;
  }

  static create(x: number, y: number, terrain: TerrainType): MapTile {
    return new MapTile({
      x,
      y,
      terrain,
      occupantId: null,
      npcId: null,
      landParcelId: null,
      updatedAt: new Date(),
    });
  }

  get coordinates(): Coordinate {
    return { x: this.x, y: this.y };
  }

  get occupantId(): bigint | null {
    return this._occupantId;
  }

  get npcId(): bigint | null {
    return this._npcId;
  }

  get landParcelId(): bigint | null {
    return this._landParcelId;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isPassable(): boolean {
    return !['mountain', 'lake'].includes(this.terrain);
  }

  isOccupied(): boolean {
    return this._occupantId !== null;
  }

  hasNpc(): boolean {
    return this._npcId !== null;
  }

  isPartOfLand(): boolean {
    return this._landParcelId !== null;
  }

  getDefenseBonus(): number {
    if (this.terrain === 'mountain') return 1.05;
    // Strategic fort bonus is handled at land parcel level
    return 1.0;
  }

  setOccupant(playerId: bigint | null): void {
    this._occupantId = playerId;
    this._updatedAt = new Date();
  }

  setNpc(npcId: bigint | null): void {
    this._npcId = npcId;
    this._updatedAt = new Date();
  }

  setLandParcel(landParcelId: bigint | null): void {
    this._landParcelId = landParcelId;
    this._updatedAt = new Date();
  }

  getEmoji(_viewerFaction?: string, isExplored: boolean = true): string {
    if (!isExplored) return '❓';

    if (this._occupantId !== null) {
      // This would need faction info from the player
      return '🏰';
    }

    if (this._npcId !== null) {
      return '👹';
    }

    switch (this.terrain) {
      case 'mountain':
        return '⛰️';
      case 'lake':
        return '🌊';
      case 'forest':
        return '🌳';
      case 'resource':
        return '💎';
      case 'plains':
      default:
        return '🟩';
    }
  }

  toData(): MapTileData {
    return {
      x: this.x,
      y: this.y,
      terrain: this.terrain,
      occupantId: this._occupantId,
      npcId: this._npcId,
      landParcelId: this._landParcelId,
      updatedAt: this._updatedAt,
    };
  }
}

// Map generation utilities
export class MapGenerator {
  private readonly size: number;
  private readonly seed: number;

  constructor(size: number = 100, seed?: number) {
    this.size = size;
    this.seed = seed ?? Date.now();
  }

  generate(): MapTile[] {
    const tiles: MapTile[] = [];
    const rng = this.createSeededRandom(this.seed);

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const terrain = this.determineTerrain(x, y, rng);
        tiles.push(MapTile.create(x, y, terrain));
      }
    }

    return tiles;
  }

  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  private determineTerrain(x: number, y: number, rng: () => number): TerrainType {
    const centerX = this.size / 2;
    const centerY = this.size / 2;
    const distanceFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const maxDistance = Math.sqrt(2) * (this.size / 2);
    const normalizedDistance = distanceFromCenter / maxDistance;

    const roll = rng();

    // Center zone (10%) - more resources
    if (normalizedDistance < 0.15) {
      if (roll < 0.3) return 'resource';
      if (roll < 0.4) return 'mountain';
      return 'plains';
    }

    // Resource zone (20%) - medium resources
    if (normalizedDistance < 0.4) {
      if (roll < 0.15) return 'resource';
      if (roll < 0.25) return 'forest';
      if (roll < 0.35) return 'mountain';
      if (roll < 0.4) return 'lake';
      return 'plains';
    }

    // Spawn zone (70%) - safe plains
    if (roll < 0.05) return 'resource';
    if (roll < 0.1) return 'forest';
    if (roll < 0.15) return 'mountain';
    if (roll < 0.18) return 'lake';
    return 'plains';
  }
}
