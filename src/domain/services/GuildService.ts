import { getDatabase } from '../../infrastructure/database/connection.js';
import { Guild, GuildMember, GuildRole } from '../entities/Guild.js';
import type { Faction, Resources } from '../../shared/types/index.js';

interface GuildRow {
  id: string;
  name: string;
  tag: string;
  leader_id: string | null;
  discord_channel_id: string | null;
  treasury: string | Resources;
  is_starter_guild: boolean;
  created_at: Date;
  updated_at: Date;
}

interface GuildMemberRow {
  id: string;
  guild_id: string;
  player_id: string;
  role: GuildRole;
  joined_at: Date;
}

interface PlayerRow {
  id: string;
  username: string;
  faction: Faction;
  resources: string | Resources;
}

export interface GuildCreateResult {
  success: boolean;
  error?: string;
  guild?: Guild;
}

export interface GuildJoinResult {
  success: boolean;
  error?: string;
}

export interface GuildMemberInfo {
  playerId: string;
  username: string;
  faction: Faction;
  role: GuildRole;
  joinedAt: Date;
}

export class GuildService {
  /**
   * Create a new guild
   */
  async createGuild(
    leaderId: string,
    name: string,
    tag: string
  ): Promise<GuildCreateResult> {
    const db = getDatabase();

    // Validate name
    if (name.length < 3 || name.length > 50) {
      return { success: false, error: 'Guild name must be between 3 and 50 characters.' };
    }

    // Validate tag
    if (tag.length < 2 || tag.length > 5) {
      return { success: false, error: 'Guild tag must be between 2 and 5 characters.' };
    }

    // Check if player is already in a guild
    const existingMembership = await db('guild_members')
      .where('player_id', leaderId)
      .first();

    if (existingMembership) {
      return { success: false, error: 'You are already in a guild. Leave your current guild first.' };
    }

    // Check if name is taken
    const existingName = await db('guilds')
      .where('name', name)
      .first();

    if (existingName) {
      return { success: false, error: 'A guild with this name already exists.' };
    }

    // Check if tag is taken
    const existingTag = await db('guilds')
      .whereRaw('UPPER(tag) = ?', [tag.toUpperCase()])
      .first();

    if (existingTag) {
      return { success: false, error: 'A guild with this tag already exists.' };
    }

    // Check if player has enough gold
    const player = await db('players')
      .select('resources')
      .where('id', leaderId)
      .first() as PlayerRow | undefined;

    if (!player) {
      return { success: false, error: 'Player not found.' };
    }

    const resources = typeof player.resources === 'string'
      ? JSON.parse(player.resources) as Resources
      : player.resources;

    if (resources.gold < Guild.CREATION_COST) {
      return { success: false, error: `You need ${Guild.CREATION_COST} gold to create a guild. You have ${resources.gold}.` };
    }

    // Create guild and add leader as member
    const guildId = await db.transaction(async (trx) => {
      // Deduct gold
      await trx('players')
        .where('id', leaderId)
        .update({
          resources: JSON.stringify({
            ...resources,
            gold: resources.gold - Guild.CREATION_COST,
          }),
        });

      // Create guild
      const [guild] = await trx('guilds')
        .insert({
          name,
          tag: tag.toUpperCase(),
          leader_id: leaderId,
          treasury: JSON.stringify({ food: 0, iron: 0, gold: 0 }),
          is_starter_guild: false,
        })
        .returning('id');

      // Add leader as member
      await trx('guild_members').insert({
        guild_id: guild.id,
        player_id: leaderId,
        role: 'leader',
      });

      return guild.id;
    });

    const guild = await this.getGuildById(guildId.toString());
    return { success: true, guild: guild! };
  }

  /**
   * Get guild by ID
   */
  async getGuildById(guildId: string): Promise<Guild | null> {
    const db = getDatabase();
    const row = await db('guilds')
      .select('*')
      .where('id', guildId)
      .first() as GuildRow | undefined;

    if (!row) return null;

    const guild = this.rowToGuild(row);
    await this.loadGuildMembers(guild);
    return guild;
  }

  /**
   * Get guild by name
   */
  async getGuildByName(name: string): Promise<Guild | null> {
    const db = getDatabase();
    const row = await db('guilds')
      .select('*')
      .whereRaw('LOWER(name) = ?', [name.toLowerCase()])
      .first() as GuildRow | undefined;

    if (!row) return null;

    const guild = this.rowToGuild(row);
    await this.loadGuildMembers(guild);
    return guild;
  }

  /**
   * Get player's guild
   */
  async getPlayerGuild(playerId: string): Promise<Guild | null> {
    const db = getDatabase();
    const membership = await db('guild_members')
      .select('guild_id')
      .where('player_id', playerId)
      .first() as { guild_id: string } | undefined;

    if (!membership) return null;

    return this.getGuildById(membership.guild_id);
  }

  /**
   * Join a guild
   */
  async joinGuild(playerId: string, guildId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    // Check if player is already in a guild
    const existingMembership = await db('guild_members')
      .where('player_id', playerId)
      .first();

    if (existingMembership) {
      return { success: false, error: 'You are already in a guild.' };
    }

    // Get guild
    const guild = await this.getGuildById(guildId);
    if (!guild) {
      return { success: false, error: 'Guild not found.' };
    }

    // Check if guild is full
    if (guild.isFull()) {
      return { success: false, error: 'This guild is full.' };
    }

    // Add member
    await db('guild_members').insert({
      guild_id: guildId,
      player_id: playerId,
      role: 'member',
    });

    return { success: true };
  }

  /**
   * Leave a guild
   */
  async leaveGuild(playerId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    const membership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', playerId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!membership) {
      return { success: false, error: 'You are not in a guild.' };
    }

    // Leaders cannot leave, they must transfer leadership or disband
    if (membership.role === 'leader') {
      return { success: false, error: 'Leaders cannot leave. Transfer leadership or disband the guild.' };
    }

    await db('guild_members')
      .where('player_id', playerId)
      .delete();

    return { success: true };
  }

  /**
   * Kick a member from guild
   */
  async kickMember(kickerId: string, targetId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    // Get kicker's guild and role
    const kickerMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', kickerId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!kickerMembership) {
      return { success: false, error: 'You are not in a guild.' };
    }

    if (kickerMembership.role !== 'leader' && kickerMembership.role !== 'officer') {
      return { success: false, error: 'Only leaders and officers can kick members.' };
    }

    // Get target's membership
    const targetMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', targetId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!targetMembership || targetMembership.guild_id !== kickerMembership.guild_id) {
      return { success: false, error: 'Player is not in your guild.' };
    }

    // Cannot kick leader
    if (targetMembership.role === 'leader') {
      return { success: false, error: 'Cannot kick the guild leader.' };
    }

    // Officers can only kick members, not other officers
    if (kickerMembership.role === 'officer' && targetMembership.role === 'officer') {
      return { success: false, error: 'Officers cannot kick other officers.' };
    }

    await db('guild_members')
      .where('player_id', targetId)
      .delete();

    return { success: true };
  }

  /**
   * Promote a member
   */
  async promoteMember(promoterId: string, targetId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    const promoterMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', promoterId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!promoterMembership || promoterMembership.role !== 'leader') {
      return { success: false, error: 'Only the guild leader can promote members.' };
    }

    const targetMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', targetId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!targetMembership || targetMembership.guild_id !== promoterMembership.guild_id) {
      return { success: false, error: 'Player is not in your guild.' };
    }

    if (targetMembership.role === 'leader') {
      return { success: false, error: 'Cannot promote the leader.' };
    }

    const newRole: GuildRole = targetMembership.role === 'member' ? 'officer' : 'leader';

    await db.transaction(async (trx) => {
      if (newRole === 'leader') {
        // Demote current leader to officer
        await trx('guild_members')
          .where('player_id', promoterId)
          .update({ role: 'officer' });

        // Update guild leader
        await trx('guilds')
          .where('id', promoterMembership.guild_id)
          .update({ leader_id: targetId });
      }

      await trx('guild_members')
        .where('player_id', targetId)
        .update({ role: newRole });
    });

    return { success: true };
  }

  /**
   * Demote a member
   */
  async demoteMember(demoterId: string, targetId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    const demoterMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', demoterId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!demoterMembership || demoterMembership.role !== 'leader') {
      return { success: false, error: 'Only the guild leader can demote members.' };
    }

    const targetMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', targetId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!targetMembership || targetMembership.guild_id !== demoterMembership.guild_id) {
      return { success: false, error: 'Player is not in your guild.' };
    }

    if (targetMembership.role !== 'officer') {
      return { success: false, error: 'Can only demote officers.' };
    }

    await db('guild_members')
      .where('player_id', targetId)
      .update({ role: 'member' });

    return { success: true };
  }

  /**
   * Disband a guild
   */
  async disbandGuild(leaderId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    const membership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', leaderId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!membership || membership.role !== 'leader') {
      return { success: false, error: 'Only the guild leader can disband the guild.' };
    }

    // Check if it's a starter guild
    const guild = await db('guilds')
      .select('is_starter_guild')
      .where('id', membership.guild_id)
      .first() as { is_starter_guild: boolean } | undefined;

    if (guild?.is_starter_guild) {
      return { success: false, error: 'Starter guilds cannot be disbanded.' };
    }

    await db.transaction(async (trx) => {
      // Remove all members
      await trx('guild_members')
        .where('guild_id', membership.guild_id)
        .delete();

      // Remove land ownership
      await trx('land_parcels')
        .where('owner_guild_id', membership.guild_id)
        .update({ owner_guild_id: null });

      // Delete guild
      await trx('guilds')
        .where('id', membership.guild_id)
        .delete();
    });

    return { success: true };
  }

  /**
   * Contribute resources to guild treasury
   */
  async contributeToTreasury(
    playerId: string,
    resources: Partial<Resources>
  ): Promise<{ success: boolean; error?: string }> {
    const db = getDatabase();

    const membership = await db('guild_members')
      .select('guild_id')
      .where('player_id', playerId)
      .first() as { guild_id: string } | undefined;

    if (!membership) {
      return { success: false, error: 'You are not in a guild.' };
    }

    // Get player resources
    const player = await db('players')
      .select('resources')
      .where('id', playerId)
      .first() as PlayerRow | undefined;

    if (!player) {
      return { success: false, error: 'Player not found.' };
    }

    const playerResources = typeof player.resources === 'string'
      ? JSON.parse(player.resources) as Resources
      : player.resources;

    // Validate player has enough
    if (resources.food && playerResources.food < resources.food) {
      return { success: false, error: 'Insufficient food.' };
    }
    if (resources.iron && playerResources.iron < resources.iron) {
      return { success: false, error: 'Insufficient iron.' };
    }
    if (resources.gold && playerResources.gold < resources.gold) {
      return { success: false, error: 'Insufficient gold.' };
    }

    // Get guild treasury
    const guild = await db('guilds')
      .select('treasury')
      .where('id', membership.guild_id)
      .first() as { treasury: string | Resources } | undefined;

    if (!guild) {
      return { success: false, error: 'Guild not found.' };
    }

    const treasury = typeof guild.treasury === 'string'
      ? JSON.parse(guild.treasury) as Resources
      : guild.treasury;

    await db.transaction(async (trx) => {
      // Deduct from player
      await trx('players')
        .where('id', playerId)
        .update({
          resources: JSON.stringify({
            food: playerResources.food - (resources.food || 0),
            iron: playerResources.iron - (resources.iron || 0),
            gold: playerResources.gold - (resources.gold || 0),
          }),
        });

      // Add to treasury
      await trx('guilds')
        .where('id', membership.guild_id)
        .update({
          treasury: JSON.stringify({
            food: treasury.food + (resources.food || 0),
            iron: treasury.iron + (resources.iron || 0),
            gold: treasury.gold + (resources.gold || 0),
          }),
        });
    });

    return { success: true };
  }

  /**
   * Get guild members with player info
   */
  async getGuildMembersInfo(guildId: string): Promise<GuildMemberInfo[]> {
    const db = getDatabase();

    const members = await db('guild_members')
      .select(
        'guild_members.player_id',
        'guild_members.role',
        'guild_members.joined_at',
        'players.username',
        'players.faction'
      )
      .join('players', 'guild_members.player_id', 'players.id')
      .where('guild_members.guild_id', guildId)
      .orderByRaw(`
        CASE guild_members.role 
          WHEN 'leader' THEN 1 
          WHEN 'officer' THEN 2 
          ELSE 3 
        END
      `) as (GuildMemberRow & { username: string; faction: Faction })[];

    return members.map(m => ({
      playerId: m.player_id,
      username: m.username,
      faction: m.faction,
      role: m.role,
      joinedAt: m.joined_at,
    }));
  }

  /**
   * Search guilds
   */
  async searchGuilds(query: string, limit: number = 10): Promise<Guild[]> {
    const db = getDatabase();

    const rows = await db('guilds')
      .select('*')
      .whereRaw('LOWER(name) LIKE ?', [`%${query.toLowerCase()}%`])
      .orWhereRaw('LOWER(tag) LIKE ?', [`%${query.toLowerCase()}%`])
      .limit(limit) as GuildRow[];

    const guilds: Guild[] = [];
    for (const row of rows) {
      const guild = this.rowToGuild(row);
      await this.loadGuildMembers(guild);
      guilds.push(guild);
    }

    return guilds;
  }

  /**
   * Get top guilds by member count
   */
  async getTopGuilds(limit: number = 10): Promise<Guild[]> {
    const db = getDatabase();

    const guildIds = await db('guild_members')
      .select('guild_id')
      .count('* as member_count')
      .groupBy('guild_id')
      .orderBy('member_count', 'desc')
      .limit(limit) as { guild_id: string; member_count: string }[];

    const guilds: Guild[] = [];
    for (const { guild_id } of guildIds) {
      const guild = await this.getGuildById(guild_id);
      if (guild) guilds.push(guild);
    }

    return guilds;
  }

  /**
   * Load guild members into guild entity
   */
  private async loadGuildMembers(guild: Guild): Promise<void> {
    const db = getDatabase();
    const memberRows = await db('guild_members')
      .select('player_id', 'role', 'joined_at')
      .where('guild_id', guild.id.toString()) as GuildMemberRow[];

    const members: GuildMember[] = memberRows.map(m => ({
      playerId: BigInt(m.player_id),
      role: m.role,
      joinedAt: m.joined_at,
    }));

    guild.setMembers(members);

    // Load land count
    const landCount = await db('land_parcels')
      .where('owner_guild_id', guild.id.toString())
      .count('* as count')
      .first() as { count: string };

    guild.setOwnedLandCount(parseInt(landCount?.count || '0', 10));
  }

  /**
   * Convert database row to Guild entity
   */
  private rowToGuild(row: GuildRow): Guild {
    return new Guild({
      id: BigInt(row.id),
      name: row.name,
      tag: row.tag,
      leaderId: row.leader_id ? BigInt(row.leader_id) : null,
      discordChannelId: row.discord_channel_id,
      treasury: typeof row.treasury === 'string' ? JSON.parse(row.treasury) : row.treasury,
      isStarterGuild: row.is_starter_guild,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  /**
   * Get or create starter guild for a faction
   */
  async getOrCreateStarterGuild(faction: Faction): Promise<Guild> {
    const db = getDatabase();
    const starterConfig = STARTER_GUILDS[faction];

    // Check if starter guild exists
    let guild = await db('guilds')
      .select('*')
      .where('name', starterConfig.name)
      .where('is_starter_guild', true)
      .first() as GuildRow | undefined;

    if (!guild) {
      // Create starter guild
      const [newGuild] = await db('guilds')
        .insert({
          name: starterConfig.name,
          tag: starterConfig.tag,
          leader_id: null,
          treasury: JSON.stringify({ food: 10000, iron: 5000, gold: 2000 }),
          is_starter_guild: true,
        })
        .returning('*') as GuildRow[];
      guild = newGuild;
    }

    const guildEntity = this.rowToGuild(guild!);
    await this.loadGuildMembers(guildEntity);
    return guildEntity;
  }

  /**
   * Auto-assign player to starter guild based on faction
   */
  async assignToStarterGuild(playerId: string, faction: Faction): Promise<GuildJoinResult> {
    const db = getDatabase();

    // Check if player is already in a guild
    const existingMembership = await db('guild_members')
      .where('player_id', playerId)
      .first();

    if (existingMembership) {
      return { success: false, error: 'Player is already in a guild.' };
    }

    const starterGuild = await this.getOrCreateStarterGuild(faction);

    // Add player to starter guild
    await db('guild_members').insert({
      guild_id: starterGuild.id.toString(),
      player_id: playerId,
      role: 'member',
    });

    return { success: true };
  }

  /**
   * Send guild invitation
   */
  async sendInvitation(
    inviterId: string,
    targetPlayerId: string
  ): Promise<{ success: boolean; error?: string }> {
    const db = getDatabase();

    // Check inviter's guild and role
    const inviterMembership = await db('guild_members')
      .select('guild_id', 'role')
      .where('player_id', inviterId)
      .first() as { guild_id: string; role: GuildRole } | undefined;

    if (!inviterMembership) {
      return { success: false, error: 'You are not in a guild.' };
    }

    if (inviterMembership.role === 'member') {
      return { success: false, error: 'Only leaders and officers can send invitations.' };
    }

    // Check if target is already in a guild
    const targetMembership = await db('guild_members')
      .where('player_id', targetPlayerId)
      .first();

    if (targetMembership) {
      return { success: false, error: 'Player is already in a guild.' };
    }

    // Check if invitation already exists
    const existingInvite = await db('guild_invitations')
      .where('guild_id', inviterMembership.guild_id)
      .where('player_id', targetPlayerId)
      .where('expires_at', '>', new Date())
      .first();

    if (existingInvite) {
      return { success: false, error: 'An invitation has already been sent to this player.' };
    }

    // Create invitation (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db('guild_invitations').insert({
      guild_id: inviterMembership.guild_id,
      player_id: targetPlayerId,
      invited_by: inviterId,
      expires_at: expiresAt,
    });

    return { success: true };
  }

  /**
   * Get player's pending invitations
   */
  async getPlayerInvitations(playerId: string): Promise<InvitationInfo[]> {
    const db = getDatabase();

    const invitations = await db('guild_invitations')
      .select(
        'guild_invitations.id',
        'guild_invitations.guild_id',
        'guild_invitations.expires_at',
        'guilds.name as guild_name',
        'guilds.tag as guild_tag',
        'players.username as invited_by'
      )
      .join('guilds', 'guild_invitations.guild_id', 'guilds.id')
      .leftJoin('players', 'guild_invitations.invited_by', 'players.id')
      .where('guild_invitations.player_id', playerId)
      .where('guild_invitations.expires_at', '>', new Date()) as {
        id: string;
        guild_id: string;
        expires_at: Date;
        guild_name: string;
        guild_tag: string;
        invited_by: string;
      }[];

    return invitations.map(inv => ({
      id: inv.id,
      guildId: inv.guild_id,
      guildName: inv.guild_name,
      guildTag: inv.guild_tag,
      invitedBy: inv.invited_by ?? 'Unknown',
      expiresAt: inv.expires_at,
    }));
  }

  /**
   * Accept guild invitation
   */
  async acceptInvitation(playerId: string, invitationId: string): Promise<GuildJoinResult> {
    const db = getDatabase();

    const invitation = await db('guild_invitations')
      .select('guild_id', 'expires_at')
      .where('id', invitationId)
      .where('player_id', playerId)
      .first() as { guild_id: string; expires_at: Date } | undefined;

    if (!invitation) {
      return { success: false, error: 'Invitation not found.' };
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await db('guild_invitations').where('id', invitationId).delete();
      return { success: false, error: 'Invitation has expired.' };
    }

    // Check if player is already in a guild
    const existingMembership = await db('guild_members')
      .where('player_id', playerId)
      .first();

    if (existingMembership) {
      return { success: false, error: 'You are already in a guild.' };
    }

    // Check if guild is full
    const guild = await this.getGuildById(invitation.guild_id);
    if (!guild) {
      return { success: false, error: 'Guild no longer exists.' };
    }

    if (guild.isFull()) {
      return { success: false, error: 'Guild is full.' };
    }

    await db.transaction(async (trx) => {
      // Add member
      await trx('guild_members').insert({
        guild_id: invitation.guild_id,
        player_id: playerId,
        role: 'member',
      });

      // Delete invitation
      await trx('guild_invitations').where('id', invitationId).delete();

      // Delete all other invitations for this player
      await trx('guild_invitations').where('player_id', playerId).delete();
    });

    return { success: true };
  }

  /**
   * Decline guild invitation
   */
  async declineInvitation(playerId: string, invitationId: string): Promise<{ success: boolean; error?: string }> {
    const db = getDatabase();

    const deleted = await db('guild_invitations')
      .where('id', invitationId)
      .where('player_id', playerId)
      .delete();

    if (deleted === 0) {
      return { success: false, error: 'Invitation not found.' };
    }

    return { success: true };
  }

  /**
   * Get players without guilds who have reached HQ level 5
   */
  async getRecruitablePlayers(_guildId: string, limit: number = 10): Promise<{
    playerId: string;
    username: string;
    faction: Faction;
    hqLevel: number;
  }[]> {
    const db = getDatabase();

    // Get players not in any guild with HQ level >= 5
    const players = await db('players')
      .select('players.id', 'players.username', 'players.faction', 'buildings.level as hq_level')
      .leftJoin('guild_members', 'players.id', 'guild_members.player_id')
      .leftJoin('buildings', function() {
        this.on('players.id', '=', 'buildings.player_id')
            .andOn('buildings.type', '=', db.raw('?', ['hq']));
      })
      .whereNull('guild_members.id')
      .where('buildings.level', '>=', 5)
      .orderBy('buildings.level', 'desc')
      .limit(limit) as { id: string; username: string; faction: Faction; hq_level: number }[];

    return players.map(p => ({
      playerId: p.id,
      username: p.username,
      faction: p.faction,
      hqLevel: p.hq_level,
    }));
  }
}

// Starter guild names by faction
const STARTER_GUILDS: Record<Faction, { name: string; tag: string }> = {
  cinema: { name: 'Cinema Legion', tag: 'CINE' },
  otaku: { name: 'Otaku Alliance', tag: 'OTAK' },
  arcade: { name: 'Arcade Coalition', tag: 'ARCA' },
};

export interface InvitationInfo {
  id: string;
  guildId: string;
  guildName: string;
  guildTag: string;
  invitedBy: string;
  expiresAt: Date;
}

export const guildService = new GuildService();
