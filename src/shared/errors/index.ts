export enum ErrorCode {
  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Player errors
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  PLAYER_ALREADY_EXISTS = 'PLAYER_ALREADY_EXISTS',
  INVALID_FACTION = 'INVALID_FACTION',
  PROTECTION_ACTIVE = 'PROTECTION_ACTIVE',

  // Resource errors
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  INSUFFICIENT_DIAMONDS = 'INSUFFICIENT_DIAMONDS',

  // Building errors
  BUILDING_NOT_FOUND = 'BUILDING_NOT_FOUND',
  BUILDING_MAX_LEVEL = 'BUILDING_MAX_LEVEL',
  BUILDING_IN_PROGRESS = 'BUILDING_IN_PROGRESS',
  HQ_LEVEL_REQUIRED = 'HQ_LEVEL_REQUIRED',

  // Hero errors
  HERO_NOT_FOUND = 'HERO_NOT_FOUND',
  HERO_MAX_LEVEL = 'HERO_MAX_LEVEL',
  INSUFFICIENT_SHARDS = 'INSUFFICIENT_SHARDS',

  // Combat errors
  INVALID_TARGET = 'INVALID_TARGET',
  MARCH_IN_PROGRESS = 'MARCH_IN_PROGRESS',
  INSUFFICIENT_TROOPS = 'INSUFFICIENT_TROOPS',
  COOLDOWN_ACTIVE = 'COOLDOWN_ACTIVE',

  // Arena errors
  NO_ARENA_TOKENS = 'NO_ARENA_TOKENS',
  INVALID_OPPONENT = 'INVALID_OPPONENT',
  DEFENSE_NOT_SET = 'DEFENSE_NOT_SET',

  // Guild errors
  GUILD_NOT_FOUND = 'GUILD_NOT_FOUND',
  ALREADY_IN_GUILD = 'ALREADY_IN_GUILD',
  NOT_IN_GUILD = 'NOT_IN_GUILD',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  GUILD_FULL = 'GUILD_FULL',

  // Land errors
  LAND_NOT_FOUND = 'LAND_NOT_FOUND',
  LAND_ALREADY_OWNED = 'LAND_ALREADY_OWNED',
  MAX_LANDS_REACHED = 'MAX_LANDS_REACHED',
}

export class GameError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GameError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class ValidationError extends GameError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.VALIDATION_ERROR, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends GameError {
  constructor(resource: string, id?: string) {
    super(ErrorCode.NOT_FOUND, `${resource} not found${id ? `: ${id}` : ''}`, { resource, id });
    this.name = 'NotFoundError';
  }
}

export class InsufficientResourcesError extends GameError {
  constructor(required: Record<string, number>, available: Record<string, number>) {
    super(ErrorCode.INSUFFICIENT_RESOURCES, 'Insufficient resources', { required, available });
    this.name = 'InsufficientResourcesError';
  }
}
