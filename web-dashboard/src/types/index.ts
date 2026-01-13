export interface User {
  discordId: string;
  playerId: string;
  username: string;
  faction: 'cinema' | 'otaku' | 'arcade';
  avatar?: string;
}

export interface Player {
  id: string;
  username: string;
  faction: 'cinema' | 'otaku' | 'arcade';
  x: number;
  y: number;
  arenaRating: number;
  resources?: {
    food: number;
    iron: number;
    gold: number;
  };
  diamonds?: number;
  power?: number;
}

export interface MapTile {
  x: number;
  y: number;
  terrain: string;
  occupant: {
    id: string;
    username: string;
    faction: string;
  } | null;
  npc: {
    id: string;
    type: string;
    power: number;
  } | null;
  landParcel: {
    id: string;
    type: string;
    ownerId: string | null;
    ownerName: string | null;
  } | null;
}

export interface MapRegion {
  tiles: MapTile[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center: { x: number; y: number };
  size: number;
}

export interface March {
  id: string;
  playerId: string;
  playerName: string;
  type: 'attack' | 'scout' | 'return';
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  departureTime: string;
  arrivalTime: string;
  troops: Record<string, number>;
}

export interface LandParcel {
  id: string;
  type: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  bonuses?: Record<string, number>;
  owner: { id: string; username: string; faction: string } | null;
  guild: { id: string; name: string } | null;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  faction: string;
  value: number;
}

export interface Battle {
  id: string;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  winner: 'attacker' | 'defender';
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  resourcesLooted: Record<string, number>;
  createdAt: string;
}
