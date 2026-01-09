import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { GameEmbeds } from '../../../infrastructure/discord/embeds/GameEmbeds.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { imageCacheService } from '../../../infrastructure/cache/ImageCacheService.js';
import type { Faction, Resources } from '../../../shared/types/index.js';

interface BuildingRow {
  type: string;
  level: number;
  upgrade_completes_at: Date | null;
}

interface TroopRow {
  tier: number;
  count: number;
  wounded: number;
}

export const cityCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('city')
    .setDescription('View your city status, resources, and buildings'),

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    // Defer reply for heavy canvas rendering
    await context.interaction.deferReply();
    
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    // Batch queries with Promise.all for better performance
    const [player, heroCount] = await Promise.all([
      db('players').select('*').where('discord_id', discordId).first(),
      db('heroes').where('player_id', db('players').select('id').where('discord_id', discordId)).count('id as count').first(),
    ]);

    if (!player) {
      await context.interaction.editReply({
        content: '❌ You haven\'t started your journey yet! Use `/begin` to get started.',
      });
      return;
    }

    // Batch remaining queries
    const [buildings, troops] = await Promise.all([
      db('buildings').select('type', 'level', 'upgrade_completes_at').where('player_id', player.id) as Promise<BuildingRow[]>,
      db('troops').select('tier', 'count', 'wounded').where('player_id', player.id) as Promise<TroopRow[]>,
    ]);

    // Parse resources
    const resources: Resources = typeof player.resources === 'string' 
      ? JSON.parse(player.resources) 
      : player.resources;

    // Find HQ level
    const hq = buildings.find((b) => b.type === 'hq');
    const hqLevel = hq?.level ?? 1;

    // Format buildings list for embed
    const formattedBuildings = buildings.map((b) => {
      return { type: formatBuildingName(b.type), level: b.level };
    });

    // Format troops
    const troopList = troops.length > 0
      ? troops.map((t) => 
          `T${t.tier}: ${t.count.toLocaleString()}${t.wounded > 0 ? ` (${t.wounded} wounded)` : ''}`
        ).join(' | ')
      : 'No troops trained';

    // Calculate total power
    const troopPower = troops.reduce((sum, t) => {
      const tierPower = [0, 10, 30, 100, 300][t.tier] || 0;
      return sum + (t.count * tierPower);
    }, 0);

    // Check protection status
    const isProtected = player.protection_until && new Date(player.protection_until) > new Date();
    const protectionText = isProtected 
      ? `🛡️ Protected until <t:${Math.floor(new Date(player.protection_until).getTime() / 1000)}:R>`
      : '';

    const embed = GameEmbeds.cityStatus(
      player.username,
      player.faction as Faction,
      hqLevel,
      { x: player.coord_x, y: player.coord_y },
      resources,
      formattedBuildings,
      player.diamonds
    );

    // Add extra fields
    embed.addFields(
      { name: '⚔️ Army', value: troopList, inline: false },
      { name: '🦸 Heroes', value: `**${heroCount?.count ?? 0}** collected`, inline: true },
      { name: '💪 Power', value: `**${troopPower.toLocaleString()}**`, inline: true },
      { name: '🏟️ Arena', value: `**${player.arena_rating.toLocaleString()}** rating`, inline: true }
    );

    if (protectionText) {
      embed.addFields({ name: '🛡️ Protection', value: protectionText, inline: false });
    }

    // Render city canvas image with caching
    let attachment: AttachmentBuilder | null = null;
    try {
      const buildingsForRender = buildings.map((b) => ({
        type: b.type,
        level: b.level,
        upgrading: b.upgrade_completes_at !== null && new Date(b.upgrade_completes_at) > new Date(),
      }));

      const troopsForRender = troops.map((t) => ({
        tier: t.tier,
        count: t.count,
        wounded: t.wounded,
      }));

      const imageBuffer = await imageCacheService.getCityImage(player.id.toString(), {
        username: player.username,
        faction: player.faction as Faction,
        hqLevel,
        buildings: buildingsForRender,
        troops: troopsForRender,
        resources,
        diamonds: player.diamonds,
        power: troopPower,
        isProtected,
      });
      attachment = new AttachmentBuilder(imageBuffer, { name: 'city.png' });
      embed.setImage('attachment://city.png');
    } catch (error) {
      console.error('Failed to render city image:', error);
    }

    await context.interaction.editReply({ 
      embeds: [embed], 
      files: attachment ? [attachment] : [] 
    });
  },
};

function formatBuildingName(type: string): string {
  const names: Record<string, string> = {
    hq: '🏛️ HQ',
    farm: '🌾 Farm',
    mine: '⚒️ Mine',
    barracks: '⚔️ Barracks',
    vault: '🏦 Vault',
    hospital: '🏥 Hospital',
    academy: '📚 Academy',
  };
  return names[type] || type;
}
