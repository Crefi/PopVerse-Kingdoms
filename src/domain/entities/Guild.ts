import { Resources } from '../../shared/types/index.js';
import { MAX_LANDS_PER_GUILD } from '../../shared/constants/game.js';

export type GuildRole = 'leader' | 'officer' | 'elite' | 'member' | 'recruit';

/** Role order for display and rally priority: leader=0, officer=1, elite=2, member=3, recruit=4 (lower = higher rank) */
export const GUILD_ROLE_PRIORITY: Record<GuildRole, number> = {
  leader: 0,
  officer: 1,
  elite: 2,
  member: 3,
  recruit: 4,
};

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
  discordRoleId: string | null;
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
  private _discordRoleId: string | null;
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
    this._discordRoleId = data.discordRoleId;
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
      discordRoleId: null,
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

  get discordRoleId(): string | null {
    return this._discordRoleId;
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

  /** Officers+: invite members, start rallies, manage quests */
  canInvite(playerId: bigint): boolean {
    const role = this.getMemberRole(playerId);
    return role === 'leader' || role === 'officer';
  }

  /** Officers+: start rallies (Leader/Officer only per spec) */
  canStartRally(playerId: bigint): boolean {
    const role = this.getMemberRole(playerId);
    return role === 'leader' || role === 'officer';
  }

  /** Officers+: manage guild quests */
  canManageQuests(playerId: bigint): boolean {
    const role = this.getMemberRole(playerId);
    return role === 'leader' || role === 'officer';
  }

  /** Elite+: priority in rallies, guild vault access */
  canAccessVault(playerId: bigint): boolean {
    const role = this.getMemberRole(playerId);
    return role === 'leader' || role === 'officer' || role === 'elite';
  }

  /** Leader only: assign and change roles */
  canAssignRoles(playerId: bigint): boolean {
    return this.isLeader(playerId);
  }

  /** Role priority for rally slot order (lower = higher priority). Elite before member before recruit. */
  getRolePriority(playerId: bigint): number {
    const role = this.getMemberRole(playerId);
    return role != null ? GUILD_ROLE_PRIORITY[role] : 99;
  }

  addMember(playerId: bigint, role: GuildRole = 'recruit'): boolean {
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

  /** Promote one step: recruit->member->elite->officer->leader. Only leader can promote. */
  promoteMember(playerId: bigint): boolean {
    const member = this._members.find((m) => m.playerId === playerId);
    if (!member || member.role === 'leader') return false;

    const order: GuildRole[] = ['recruit', 'member', 'elite', 'officer', 'leader'];
    const idx = order.indexOf(member.role);
    if (idx < 0 || idx >= order.length - 1) return false;

    const newRole = order[idx + 1];
    member.role = newRole;
    if (newRole === 'leader') {
      const currentLeader = this._members.find((m) => m.playerId === this._leaderId);
      if (currentLeader) currentLeader.role = 'officer';
      this._leaderId = playerId;
    }
    this._updatedAt = new Date();
    return true;
  }

  /** Demote one step. Only leader can demote. */
  demoteMember(playerId: bigint): boolean {
    const member = this._members.find((m) => m.playerId === playerId);
    if (!member || member.role === 'leader' || member.role === 'recruit') return false;

    const order: GuildRole[] = ['recruit', 'member', 'elite', 'officer', 'leader'];
    const idx = order.indexOf(member.role);
    if (idx <= 0) return false;
    member.role = order[idx - 1];
    this._updatedAt = new Date();
    return true;
  }

  /** Leader assigns a member to a specific role (any role except replacing leader). */
  setMemberRole(assignerId: bigint, targetId: bigint, newRole: GuildRole): boolean {
    if (!this.canAssignRoles(assignerId)) return false;
    if (newRole === 'leader') return false; // use promoteMember to transfer leadership

    const target = this._members.find((m) => m.playerId === targetId);
    if (!target) return false;

    target.role = newRole;
    this._updatedAt = new Date();
    return true;
  }

  /** Transfer leadership to another member (they become leader, current leader becomes officer). */
  transferLeadership(currentLeaderId: bigint, newLeaderId: bigint): boolean {
    if (this._leaderId !== currentLeaderId) return false;
    const newLeader = this._members.find((m) => m.playerId === newLeaderId);
    if (!newLeader) return false;

    const currentLeader = this._members.find((m) => m.playerId === currentLeaderId);
    if (currentLeader) currentLeader.role = 'officer';
    newLeader.role = 'leader';
    this._leaderId = newLeaderId;
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
      discordRoleId: this._discordRoleId,
      treasury: { ...this._treasury },
      isStarterGuild: this.isStarterGuild,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
