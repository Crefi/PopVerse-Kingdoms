import { Resources } from '../../shared/types/index.js';
import { MAX_LANDS_PER_GUILD } from '../../shared/constants/game.js';

export type GuildRole = 'leader' | 'officer' | 'member';

export interface GuildMember {
  playerId: bigint;
  role: GuildRole;
  joinedAt: Date;
}

export interface GuildData {
  id: bigint;
  name: string;
  tag: string;
  leaderId: bigint | null;
  discordChannelId: string | null;
  treasury: Resources;
  isStarterGuild: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Guild {
  readonly id: bigint;
  readonly name: string;
  readonly tag: string;
  private _leaderId: bigint | null;
  private _discordChannelId: string | null;
  private _treasury: Resources;
  readonly isStarterGuild: boolean;
  readonly createdAt: Date;
  private _updatedAt: Date;
  private _members: GuildMember[] = [];
  private _ownedLandCount: number = 0;

  static readonly MAX_MEMBERS = 20;
  static readonly CREATION_COST = 500; // Gold

  constructor(data: GuildData) {
    this.id = data.id;
    this.name = data.name;
    this.tag = data.tag;
    this._leaderId = data.leaderId;
    this._discordChannelId = data.discordChannelId;
    this._treasury = { ...data.treasury };
    this.isStarterGuild = data.isStarterGuild;
    this.createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  static create(name: string, tag: string, leaderId: bigint): Guild {
    const now = new Date();
    return new Guild({
      id: BigInt(0),
      name,
      tag: tag.toUpperCase().slice(0, 5),
      leaderId,
      discordChannelId: null,
      treasury: { food: 0, iron: 0, gold: 0 },
      isStarterGuild: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  get leaderId(): bigint | null {
    return this._leaderId;
  }

  get discordChannelId(): string | null {
    return this._discordChannelId;
  }

  get treasury(): Resources {
    return { ...this._treasury };
  }

  get members(): GuildMember[] {
    return [...this._members];
  }

  get memberCount(): number {
    return this._members.length;
  }

  get ownedLandCount(): number {
    return this._ownedLandCount;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  setMembers(members: GuildMember[]): void {
    this._members = [...members];
  }

  setOwnedLandCount(count: number): void {
    this._ownedLandCount = count;
  }

  setDiscordChannelId(channelId: string): void {
    this._discordChannelId = channelId;
    this._updatedAt = new Date();
  }

  isFull(): boolean {
    return this._members.length >= Guild.MAX_MEMBERS;
  }

  canBuyLand(): boolean {
    return this._ownedLandCount < MAX_LANDS_PER_GUILD;
  }

  hasMember(playerId: bigint): boolean {
    return this._members.some((m) => m.playerId === playerId);
  }

  getMemberRole(playerId: bigint): GuildRole | null {
    const member = this._members.find((m) => m.playerId === playerId);
    return member?.role ?? null;
  }

  isLeader(playerId: bigint): boolean {
    return this._leaderId === playerId;
  }

  isOfficerOrHigher(playerId: bigint): boolean {
    const role = this.getMemberRole(playerId);
    return role === 'leader' || role === 'officer';
  }

  addMember(playerId: bigint, role: GuildRole = 'member'): boolean {
    if (this.isFull() || this.hasMember(playerId)) return false;

    this._members.push({
      playerId,
      role,
      joinedAt: new Date(),
    });
    this._updatedAt = new Date();
    return true;
  }

  removeMember(playerId: bigint): boolean {
    const index = this._members.findIndex((m) => m.playerId === playerId);
    if (index === -1) return false;

    this._members.splice(index, 1);
    this._updatedAt = new Date();
    return true;
  }

  promoteMember(playerId: bigint): boolean {
    const member = this._members.find((m) => m.playerId === playerId);
    if (!member || member.role === 'leader') return false;

    if (member.role === 'member') {
      member.role = 'officer';
    } else if (member.role === 'officer') {
      member.role = 'leader';
      // Demote current leader to officer
      const currentLeader = this._members.find((m) => m.playerId === this._leaderId);
      if (currentLeader) {
        currentLeader.role = 'officer';
      }
      this._leaderId = playerId;
    }
    this._updatedAt = new Date();
    return true;
  }

  demoteMember(playerId: bigint): boolean {
    const member = this._members.find((m) => m.playerId === playerId);
    if (!member || member.role === 'member' || member.role === 'leader') return false;

    member.role = 'member';
    this._updatedAt = new Date();
    return true;
  }

  hasTreasuryResources(required: Partial<Resources>): boolean {
    return (
      (required.food === undefined || this._treasury.food >= required.food) &&
      (required.iron === undefined || this._treasury.iron >= required.iron) &&
      (required.gold === undefined || this._treasury.gold >= required.gold)
    );
  }

  addToTreasury(resources: Partial<Resources>): void {
    if (resources.food) this._treasury.food += resources.food;
    if (resources.iron) this._treasury.iron += resources.iron;
    if (resources.gold) this._treasury.gold += resources.gold;
    this._updatedAt = new Date();
  }

  deductFromTreasury(resources: Partial<Resources>): boolean {
    if (!this.hasTreasuryResources(resources)) return false;

    if (resources.food) this._treasury.food -= resources.food;
    if (resources.iron) this._treasury.iron -= resources.iron;
    if (resources.gold) this._treasury.gold -= resources.gold;
    this._updatedAt = new Date();
    return true;
  }

  toData(): GuildData {
    return {
      id: this.id,
      name: this.name,
      tag: this.tag,
      leaderId: this._leaderId,
      discordChannelId: this._discordChannelId,
      treasury: { ...this._treasury },
      isStarterGuild: this.isStarterGuild,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
