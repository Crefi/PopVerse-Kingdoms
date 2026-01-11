import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { guildService } from '../../../domain/services/GuildService.js';
import { landService } from '../../../domain/services/LandService.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { Guild } from '../../../domain/entities/Guild.js';
import type { Faction } from '../../../shared/types/index.js';

const FACTION_COLORS: Record<string, number> = {
  cinema: 0xe74c3c,
  otaku: 0x9b59b6,
  arcade: 0x3498db,
};

const FACTION_EMOJIS: Record<string, string> = {
  cinema: '🎬',
  otaku: '⚔️',
  arcade: '🎮',
};

const ROLE_EMOJIS: Record<string, string> = {
  leader: '👑',
  officer: '⭐',
  member: '👤',
};

export const guildCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Guild management commands')
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View your guild information')
    )
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new guild (costs 500 gold)')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Guild name (3-50 characters)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('tag')
            .setDescription('Guild tag (2-5 characters)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Join a guild')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Guild name to join')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Leave your current guild')
    )
    .addSubcommand(sub =>
      sub.setName('members')
        .setDescription('View guild members')
    )
    .addSubcommand(sub =>
      sub.setName('promote')
        .setDescription('Promote a member (Leader only)')
        .addUserOption(opt =>
          opt.setName('player')
            .setDescription('Player to promote')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('demote')
        .setDescription('Demote an officer (Leader only)')
        .addUserOption(opt =>
          opt.setName('player')
            .setDescription('Player to demote')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('Kick a member (Leader/Officer)')
        .addUserOption(opt =>
          opt.setName('player')
            .setDescription('Player to kick')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('contribute')
        .setDescription('Contribute resources to guild treasury')
        .addIntegerOption(opt =>
          opt.setName('food')
            .setDescription('Amount of food to contribute')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('iron')
            .setDescription('Amount of iron to contribute')
            .setMinValue(0)
        )
        .addIntegerOption(opt =>
          opt.setName('gold')
            .setDescription('Amount of gold to contribute')
            .setMinValue(0)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disband')
        .setDescription('Disband your guild (Leader only)')
    )
    .addSubcommand(sub =>
      sub.setName('search')
        .setDescription('Search for guilds')
        .addStringOption(opt =>
          opt.setName('query')
            .setDescription('Search by name or tag')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('top')
        .setDescription('View top guilds')
    )
    .addSubcommand(sub =>
      sub.setName('lands')
        .setDescription('View guild-owned lands')
    )
    .addSubcommand(sub =>
      sub.setName('buyland')
        .setDescription('Buy a land parcel for the guild (Leader/Officer)')
        .addStringOption(opt =>
          opt.setName('land_id')
            .setDescription('Land parcel ID to purchase')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('invite')
        .setDescription('Invite a player to your guild (Leader/Officer)')
        .addUserOption(opt =>
          opt.setName('player')
            .setDescription('Player to invite')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('invitations')
        .setDescription('View your pending guild invitations')
    )
    .addSubcommand(sub =>
      sub.setName('accept')
        .setDescription('Accept a guild invitation')
        .addStringOption(opt =>
          opt.setName('guild')
            .setDescription('Guild name to accept invitation from')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('decline')
        .setDescription('Decline a guild invitation')
        .addStringOption(opt =>
          opt.setName('guild')
            .setDescription('Guild name to decline invitation from')
            .setRequired(true)
        )
    ) as SlashCommandBuilder,

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const subcommand = context.interaction.options.getSubcommand();
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players')
      .select('id', 'username', 'faction')
      .where('discord_id', discordId)
      .first() as { id: string; username: string; faction: Faction } | undefined;

    if (!player) {
      await context.interaction.reply({
        content: '❌ Use `/begin` to start your journey first!',
        ephemeral: true,
      });
      return;
    }

    switch (subcommand) {
      case 'info':
        await handleInfo(context, player);
        break;
      case 'create':
        await handleCreate(context, player);
        break;
      case 'join':
        await handleJoin(context, player);
        break;
      case 'leave':
        await handleLeave(context, player);
        break;
      case 'members':
        await handleMembers(context, player);
        break;
      case 'promote':
        await handlePromote(context, player);
        break;
      case 'demote':
        await handleDemote(context, player);
        break;
      case 'kick':
        await handleKick(context, player);
        break;
      case 'contribute':
        await handleContribute(context, player);
        break;
      case 'disband':
        await handleDisband(context, player);
        break;
      case 'search':
        await handleSearch(context, player);
        break;
      case 'top':
        await handleTop(context, player);
        break;
      case 'lands':
        await handleLands(context, player);
        break;
      case 'buyland':
        await handleBuyLand(context, player);
        break;
      case 'invite':
        await handleInvite(context, player);
        break;
      case 'invitations':
        await handleInvitations(context, player);
        break;
      case 'accept':
        await handleAccept(context, player);
        break;
      case 'decline':
        await handleDecline(context, player);
        break;
    }
  },
};

async function handleInfo(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guild = await guildService.getPlayerGuild(player.id);

  if (!guild) {
    const embed = new EmbedBuilder()
      .setTitle('🏰 No Guild')
      .setDescription('You are not in a guild.\n\nUse `/guild create` to create one or `/guild search` to find one to join.')
      .setColor(0x808080);

    await context.interaction.reply({ embeds: [embed] });
    return;
  }

  const members = await guildService.getGuildMembersInfo(guild.id.toString());
  const landBonuses = await landService.calculateGuildBonuses(guild.id.toString());

  const embed = new EmbedBuilder()
    .setTitle(`🏰 [${guild.tag}] ${guild.name}`)
    .setColor(FACTION_COLORS[player.faction] || 0x808080);

  // Guild stats
  embed.addFields(
    {
      name: '👥 Members',
      value: `${guild.memberCount}/${Guild.MAX_MEMBERS}`,
      inline: true,
    },
    {
      name: '🗺️ Lands',
      value: `${guild.ownedLandCount}/10`,
      inline: true,
    },
    {
      name: '📅 Created',
      value: guild.createdAt.toLocaleDateString(),
      inline: true,
    }
  );

  // Treasury
  const treasury = guild.treasury;
  embed.addFields({
    name: '💰 Treasury',
    value: `🍖 ${treasury.food.toLocaleString()} | ⚙️ ${treasury.iron.toLocaleString()} | 💰 ${treasury.gold.toLocaleString()}`,
    inline: false,
  });

  // Land bonuses
  if (Object.keys(landBonuses).length > 0) {
    const bonusText = Object.entries(landBonuses)
      .map(([key, value]) => `+${Math.round(value * 100)}% ${key}`)
      .join(', ');
    embed.addFields({
      name: '✨ Land Bonuses',
      value: bonusText,
      inline: false,
    });
  }

  // Leadership
  const leader = members.find(m => m.role === 'leader');
  const officers = members.filter(m => m.role === 'officer');

  embed.addFields({
    name: '👑 Leader',
    value: leader ? `${FACTION_EMOJIS[leader.faction]} ${leader.username}` : 'None',
    inline: true,
  });

  if (officers.length > 0) {
    embed.addFields({
      name: '⭐ Officers',
      value: officers.map(o => `${FACTION_EMOJIS[o.faction]} ${o.username}`).join(', '),
      inline: true,
    });
  }

  embed.setFooter({ text: 'Use /guild members to see all members' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleCreate(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const name = context.interaction.options.getString('name', true);
  const tag = context.interaction.options.getString('tag', true);

  const result = await guildService.createGuild(player.id, name, tag);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const guild = result.guild!;

  const embed = new EmbedBuilder()
    .setTitle('🎉 Guild Created!')
    .setDescription(`**[${guild.tag}] ${guild.name}** has been founded!`)
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Cost', value: `💰 ${Guild.CREATION_COST} gold`, inline: true },
      { name: 'Tag', value: guild.tag, inline: true },
      { name: 'Leader', value: 'You!', inline: true },
    )
    .setFooter({ text: 'Invite others with /guild search or share your guild name!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleJoin(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guildName = context.interaction.options.getString('name', true);

  const guild = await guildService.getGuildByName(guildName);
  if (!guild) {
    await context.interaction.reply({
      content: '❌ Guild not found. Check the name and try again.',
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.joinGuild(player.id, guild.id.toString());

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Joined Guild!')
    .setDescription(`You are now a member of **[${guild.tag}] ${guild.name}**!`)
    .setColor(0x2ecc71)
    .setFooter({ text: 'Use /guild info to see guild details' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleLeave(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const result = await guildService.leaveGuild(player.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('👋 Left Guild')
    .setDescription('You have left your guild.')
    .setColor(0xf39c12);

  await context.interaction.reply({ embeds: [embed] });
}

async function handleMembers(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guild = await guildService.getPlayerGuild(player.id);

  if (!guild) {
    await context.interaction.reply({
      content: '❌ You are not in a guild.',
      ephemeral: true,
    });
    return;
  }

  const members = await guildService.getGuildMembersInfo(guild.id.toString());

  const embed = new EmbedBuilder()
    .setTitle(`👥 [${guild.tag}] ${guild.name} - Members`)
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .setDescription(`${members.length}/${Guild.MAX_MEMBERS} members`);

  const memberList = members.map(m => {
    const roleEmoji = ROLE_EMOJIS[m.role];
    const factionEmoji = FACTION_EMOJIS[m.faction];
    const joinDate = new Date(m.joinedAt).toLocaleDateString();
    return `${roleEmoji} ${factionEmoji} **${m.username}** - Joined ${joinDate}`;
  }).join('\n');

  embed.addFields({
    name: 'Members',
    value: memberList || 'No members',
    inline: false,
  });

  await context.interaction.reply({ embeds: [embed] });
}

async function handlePromote(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const targetUser = context.interaction.options.getUser('player', true);
  const db = getDatabase();

  const targetPlayer = await db('players')
    .select('id', 'username')
    .where('discord_id', targetUser.id)
    .first() as { id: string; username: string } | undefined;

  if (!targetPlayer) {
    await context.interaction.reply({
      content: '❌ Player not found.',
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.promoteMember(player.id, targetPlayer.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⬆️ Member Promoted!')
    .setDescription(`**${targetPlayer.username}** has been promoted!`)
    .setColor(0x2ecc71);

  await context.interaction.reply({ embeds: [embed] });
}

async function handleDemote(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const targetUser = context.interaction.options.getUser('player', true);
  const db = getDatabase();

  const targetPlayer = await db('players')
    .select('id', 'username')
    .where('discord_id', targetUser.id)
    .first() as { id: string; username: string } | undefined;

  if (!targetPlayer) {
    await context.interaction.reply({
      content: '❌ Player not found.',
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.demoteMember(player.id, targetPlayer.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⬇️ Member Demoted')
    .setDescription(`**${targetPlayer.username}** has been demoted to member.`)
    .setColor(0xf39c12);

  await context.interaction.reply({ embeds: [embed] });
}

async function handleKick(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const targetUser = context.interaction.options.getUser('player', true);
  const db = getDatabase();

  const targetPlayer = await db('players')
    .select('id', 'username')
    .where('discord_id', targetUser.id)
    .first() as { id: string; username: string } | undefined;

  if (!targetPlayer) {
    await context.interaction.reply({
      content: '❌ Player not found.',
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.kickMember(player.id, targetPlayer.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🚪 Member Kicked')
    .setDescription(`**${targetPlayer.username}** has been kicked from the guild.`)
    .setColor(0xe74c3c);

  await context.interaction.reply({ embeds: [embed] });
}

async function handleContribute(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const food = context.interaction.options.getInteger('food') || 0;
  const iron = context.interaction.options.getInteger('iron') || 0;
  const gold = context.interaction.options.getInteger('gold') || 0;

  if (food === 0 && iron === 0 && gold === 0) {
    await context.interaction.reply({
      content: '❌ Please specify at least one resource to contribute.',
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.contributeToTreasury(player.id, { food, iron, gold });

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const contributions: string[] = [];
  if (food > 0) contributions.push(`🍖 ${food.toLocaleString()} food`);
  if (iron > 0) contributions.push(`⚙️ ${iron.toLocaleString()} iron`);
  if (gold > 0) contributions.push(`💰 ${gold.toLocaleString()} gold`);

  const embed = new EmbedBuilder()
    .setTitle('💝 Contribution Made!')
    .setDescription(`You contributed to the guild treasury:\n${contributions.join('\n')}`)
    .setColor(0x2ecc71)
    .setFooter({ text: 'Thank you for supporting your guild!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleDisband(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guild = await guildService.getPlayerGuild(player.id);

  if (!guild) {
    await context.interaction.reply({
      content: '❌ You are not in a guild.',
      ephemeral: true,
    });
    return;
  }

  // Show confirmation
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Disband Guild?')
    .setDescription(`Are you sure you want to disband **[${guild.tag}] ${guild.name}**?\n\nThis action cannot be undone. All members will be removed and guild lands will become unowned.`)
    .setColor(0xe74c3c);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('guild:disband:confirm')
      .setLabel('Disband Guild')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('guild:disband:cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await context.interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleSearch(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const query = context.interaction.options.getString('query', true);

  const guilds = await guildService.searchGuilds(query);

  if (guilds.length === 0) {
    await context.interaction.reply({
      content: '❌ No guilds found matching your search.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Guild Search: "${query}"`)
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .setDescription(`Found ${guilds.length} guild(s):`);

  for (const guild of guilds.slice(0, 10)) {
    const members = await guildService.getGuildMembersInfo(guild.id.toString());
    const leader = members.find(m => m.role === 'leader');

    embed.addFields({
      name: `[${guild.tag}] ${guild.name}`,
      value: [
        `👥 ${guild.memberCount}/${Guild.MAX_MEMBERS} members`,
        `👑 Leader: ${leader?.username || 'Unknown'}`,
        guild.isStarterGuild ? '🌟 Starter Guild' : '',
      ].filter(Boolean).join('\n'),
      inline: true,
    });
  }

  embed.setFooter({ text: 'Use /guild join <name> to join a guild' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleTop(
  context: CommandContext,
  _player: { id: string; faction: Faction }
): Promise<void> {
  const guilds = await guildService.getTopGuilds(10);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Top Guilds')
    .setColor(0xffd700)
    .setDescription('Guilds ranked by member count:');

  for (let i = 0; i < guilds.length; i++) {
    const guild = guilds[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

    embed.addFields({
      name: `${medal} [${guild.tag}] ${guild.name}`,
      value: `👥 ${guild.memberCount} members | 🗺️ ${guild.ownedLandCount} lands`,
      inline: false,
    });
  }

  await context.interaction.reply({ embeds: [embed] });
}

async function handleLands(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guild = await guildService.getPlayerGuild(player.id);

  if (!guild) {
    await context.interaction.reply({
      content: '❌ You are not in a guild.',
      ephemeral: true,
    });
    return;
  }

  const lands = await landService.getGuildLands(guild.id.toString());
  const bonuses = await landService.calculateGuildBonuses(guild.id.toString());

  const embed = new EmbedBuilder()
    .setTitle(`🗺️ [${guild.tag}] ${guild.name} - Lands`)
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .setDescription(`${lands.length}/10 lands owned`);

  if (lands.length === 0) {
    embed.addFields({
      name: 'No Lands',
      value: 'Your guild doesn\'t own any lands yet.\nUse `/guild buyland <land_id>` to purchase one!\nUse `/land list` to see available lands.',
      inline: false,
    });
  } else {
    for (const land of lands) {
      const typeInfo = landService.getLandTypeInfo(land.type);
      embed.addFields({
        name: `${typeInfo.emoji} ${land.name}`,
        value: [
          `Type: ${typeInfo.name}`,
          `Location: (${land.minX},${land.minY}) to (${land.maxX},${land.maxY})`,
          `Bonus: ${typeInfo.description}`,
        ].join('\n'),
        inline: true,
      });
    }
  }

  // Show total bonuses
  if (Object.keys(bonuses).length > 0) {
    const bonusText = Object.entries(bonuses)
      .map(([key, value]) => `+${Math.round(value * 100)}% ${key}`)
      .join('\n');
    embed.addFields({
      name: '✨ Total Land Bonuses (All Members)',
      value: bonusText,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Guild land bonuses apply to all members!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleBuyLand(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const landId = context.interaction.options.getString('land_id', true);

  const guild = await guildService.getPlayerGuild(player.id);

  if (!guild) {
    await context.interaction.reply({
      content: '❌ You are not in a guild.',
      ephemeral: true,
    });
    return;
  }

  const result = await landService.purchaseGuildLand(guild.id.toString(), landId, player.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const land = result.land!;
  const typeInfo = landService.getLandTypeInfo(land.type);

  const embed = new EmbedBuilder()
    .setTitle('🎉 Guild Land Purchased!')
    .setColor(0x2ecc71)
    .setDescription(`**[${guild.tag}] ${guild.name}** now owns **${land.name}**!`)
    .addFields(
      {
        name: `${typeInfo.emoji} Land Type`,
        value: typeInfo.name,
        inline: true,
      },
      {
        name: '💰 Cost',
        value: `${result.costPaid?.gold?.toLocaleString()} gold from treasury`,
        inline: true,
      },
      {
        name: '✨ Bonus',
        value: typeInfo.description,
        inline: true,
      },
      {
        name: '📍 Location',
        value: `(${land.minX},${land.minY}) to (${land.maxX},${land.maxY})`,
        inline: true,
      }
    )
    .setFooter({ text: 'This bonus now applies to all guild members!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleInvite(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const targetUser = context.interaction.options.getUser('player', true);
  const db = getDatabase();

  const targetPlayer = await db('players')
    .select('id', 'username')
    .where('discord_id', targetUser.id)
    .first() as { id: string; username: string } | undefined;

  if (!targetPlayer) {
    await context.interaction.reply({
      content: '❌ Player not found. They need to use `/begin` first.',
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.sendInvitation(player.id, targetPlayer.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const guild = await guildService.getPlayerGuild(player.id);

  const embed = new EmbedBuilder()
    .setTitle('📨 Invitation Sent!')
    .setColor(0x2ecc71)
    .setDescription(`You have invited **${targetPlayer.username}** to join **[${guild?.tag}] ${guild?.name}**!`)
    .setFooter({ text: 'The invitation expires in 24 hours.' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleInvitations(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const invitations = await guildService.getPlayerInvitations(player.id);

  if (invitations.length === 0) {
    await context.interaction.reply({
      content: '📭 You have no pending guild invitations.',
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('📬 Guild Invitations')
    .setColor(FACTION_COLORS[player.faction] || 0x808080)
    .setDescription(`You have ${invitations.length} pending invitation(s):`);

  for (const inv of invitations) {
    const expiresAt = Math.floor(new Date(inv.expiresAt).getTime() / 1000);
    embed.addFields({
      name: `[${inv.guildTag}] ${inv.guildName}`,
      value: [
        `Invited by: ${inv.invitedBy}`,
        `Expires: <t:${expiresAt}:R>`,
      ].join('\n'),
      inline: true,
    });
  }

  embed.setFooter({ text: 'Use /guild accept <guild_name> or /guild decline <guild_name>' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleAccept(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guildName = context.interaction.options.getString('guild', true);

  const invitations = await guildService.getPlayerInvitations(player.id);
  const invitation = invitations.find(
    inv => inv.guildName.toLowerCase() === guildName.toLowerCase()
  );

  if (!invitation) {
    await context.interaction.reply({
      content: `❌ No invitation found from guild "${guildName}".`,
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.acceptInvitation(player.id, invitation.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Invitation Accepted!')
    .setColor(0x2ecc71)
    .setDescription(`You are now a member of **[${invitation.guildTag}] ${invitation.guildName}**!`)
    .setFooter({ text: 'Use /guild info to see your new guild!' });

  await context.interaction.reply({ embeds: [embed] });
}

async function handleDecline(
  context: CommandContext,
  player: { id: string; faction: Faction }
): Promise<void> {
  const guildName = context.interaction.options.getString('guild', true);

  const invitations = await guildService.getPlayerInvitations(player.id);
  const invitation = invitations.find(
    inv => inv.guildName.toLowerCase() === guildName.toLowerCase()
  );

  if (!invitation) {
    await context.interaction.reply({
      content: `❌ No invitation found from guild "${guildName}".`,
      ephemeral: true,
    });
    return;
  }

  const result = await guildService.declineInvitation(player.id, invitation.id);

  if (!result.success) {
    await context.interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('❌ Invitation Declined')
    .setColor(0xf39c12)
    .setDescription(`You have declined the invitation from **[${invitation.guildTag}] ${invitation.guildName}**.`);

  await context.interaction.reply({ embeds: [embed] });
}

// Button handler for guild actions
export async function handleGuildButton(
  interaction: import('discord.js').ButtonInteraction,
  action: string,
  _params: string[]
): Promise<void> {
  if (action === 'disband') {
    await handleDisbandConfirm(interaction, _params[0]);
  }
}

async function handleDisbandConfirm(
  interaction: import('discord.js').ButtonInteraction,
  confirmAction: string
): Promise<void> {
  if (confirmAction === 'cancel') {
    await interaction.update({
      content: 'Guild disband cancelled.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (confirmAction === 'confirm') {
    const db = getDatabase();
    const player = await db('players')
      .select('id')
      .where('discord_id', interaction.user.id)
      .first() as { id: string } | undefined;

    if (!player) {
      await interaction.update({
        content: '❌ Player not found.',
        embeds: [],
        components: [],
      });
      return;
    }

    const result = await guildService.disbandGuild(player.id);

    if (!result.success) {
      await interaction.update({
        content: `❌ ${result.error}`,
        embeds: [],
        components: [],
      });
      return;
    }

    await interaction.update({
      content: '✅ Guild has been disbanded.',
      embeds: [],
      components: [],
    });
  }
}
