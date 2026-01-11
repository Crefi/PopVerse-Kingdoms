import { getDatabase } from '../../infrastructure/database/connection.js';

// Quest types and their configurations
export const GUILD_QUEST_TYPES = {
  defeat_npcs: {
    name: 'Defeat NPCs',
    description: 'Defeat {target} NPC camps as a guild',
    baseTarget: 5,
    targetPerMember: 1,
    rewards: { gold: 500, heroShards: 5, diamonds: 50 },
  },
  train_troops: {
    name: 'Train Troops',
    description: 'Train {target} troops collectively',
    baseTarget: 100,
    targetPerMember: 20,
    rewards: { gold: 300, heroShards: 3, diamonds: 30 },
  },
  win_arena: {
    name: 'Arena Victories',
    description: 'Win {target} arena battles as a guild',
    baseTarget: 3,
    targetPerMember: 1,
    rewards: { gold: 400, heroShards: 4, diamonds: 40 },
  },
  upgrade_buildings: {
    name: 'Upgrade Buildings',
    description: 'Complete {target} building upgrades',
    baseTarget: 3,
    targetPerMember: 1,
    rewards: { gold: 350, heroShards: 3, diamonds: 35 },
  },
  gather_resources: {
    name: 'Gather Resources',
    description: 'Gather {target} total resources',
    baseTarget: 5000,
    targetPerMember: 1000,
    rewards: { gold: 250, heroShards: 2, diamonds: 25 },
  },
} as const;

export type GuildQuestType = keyof typeof GUILD_QUEST_TYPES;

interface GuildQuestRow {
  id: string;
  guild_id: string;
  quest_type: GuildQuestType;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  rewards_claimed: boolean;
  rewards: string | object;
  quest_date: Date;
  created_at: Date;
}

interface ContributionRow {
  quest_id: string;
  player_id: string;
  contribution: number;
}

export interface GuildQuestInfo {
  id: string;
  questType: GuildQuestType;
  name: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  rewardsClaimed: boolean;
  rewards: { gold: number; heroShards: number; diamonds: number };
  topContributors: { playerId: string; username: string; contribution: number }[];
}

export interface QuestResult {
  success: boolean;
  error?: string;
  quests?: GuildQuestInfo[];
}

export class GuildQuestService {
  /**
   * Generate daily quests for a guild
   */
  async generateDailyQuests(guildId: string): Promise<GuildQuestInfo[]> {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    // Check if quests already exist for today
    const existingQuests = await db('guild_quests')
      .where('guild_id', guildId)
      .where('quest_date', today);

    if (existingQuests.length > 0) {
      return this.getGuildQuests(guildId);
    }

    // Get member count for scaling
    const memberCount = await db('guild_members')
      .where('guild_id', guildId)
      .count('* as count')
      .first();

    const members = parseInt(memberCount?.count as string, 10) || 1;

    // Generate 3 random quests
    const questTypes = Object.keys(GUILD_QUEST_TYPES) as GuildQuestType[];
    const selectedTypes = this.shuffleArray(questTypes).slice(0, 3);

    const quests: GuildQuestInfo[] = [];

    for (const questType of selectedTypes) {
      const config = GUILD_QUEST_TYPES[questType];
      const target = config.baseTarget + (config.targetPerMember * Math.min(members, 10));
      const description = config.description.replace('{target}', target.toString());

      const [quest] = await db('guild_quests')
        .insert({
          guild_id: guildId,
          quest_type: questType,
          description,
          target,
          progress: 0,
          completed: false,
          rewards_claimed: false,
          rewards: JSON.stringify(config.rewards),
          quest_date: today,
        })
        .returning('*');

      quests.push({
        id: quest.id.toString(),
        questType,
        name: config.name,
        description,
        target,
        progress: 0,
        completed: false,
        rewardsClaimed: false,
        rewards: config.rewards,
        topContributors: [],
      });
    }

    return quests;
  }

  /**
   * Get guild's current quests
   */
  async getGuildQuests(guildId: string): Promise<GuildQuestInfo[]> {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    const questRows = await db('guild_quests')
      .where('guild_id', guildId)
      .where('quest_date', today) as GuildQuestRow[];

    if (questRows.length === 0) {
      // Generate quests if none exist
      return this.generateDailyQuests(guildId);
    }

    const quests: GuildQuestInfo[] = [];

    for (const row of questRows) {
      const config = GUILD_QUEST_TYPES[row.quest_type];
      const rewards = typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards;

      // Get top contributors
      const contributors = await db('guild_quest_contributions')
        .select('guild_quest_contributions.player_id', 'guild_quest_contributions.contribution', 'players.username')
        .join('players', 'guild_quest_contributions.player_id', 'players.id')
        .where('guild_quest_contributions.quest_id', row.id)
        .orderBy('guild_quest_contributions.contribution', 'desc')
        .limit(5) as (ContributionRow & { username: string })[];

      quests.push({
        id: row.id,
        questType: row.quest_type,
        name: config.name,
        description: row.description,
        target: row.target,
        progress: row.progress,
        completed: row.completed,
        rewardsClaimed: row.rewards_claimed,
        rewards,
        topContributors: contributors.map(c => ({
          playerId: c.player_id,
          username: c.username,
          contribution: c.contribution,
        })),
      });
    }

    return quests;
  }

  /**
   * Add progress to a quest
   */
  async addProgress(
    guildId: string,
    playerId: string,
    questType: GuildQuestType,
    amount: number
  ): Promise<{ success: boolean; questCompleted?: boolean }> {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    // Get the quest
    const quest = await db('guild_quests')
      .where('guild_id', guildId)
      .where('quest_type', questType)
      .where('quest_date', today)
      .first() as GuildQuestRow | undefined;

    if (!quest || quest.completed) {
      return { success: false };
    }

    const newProgress = Math.min(quest.progress + amount, quest.target);
    const completed = newProgress >= quest.target;

    await db.transaction(async (trx) => {
      // Update quest progress
      await trx('guild_quests')
        .where('id', quest.id)
        .update({
          progress: newProgress,
          completed,
        });

      // Update or insert contribution
      const existing = await trx('guild_quest_contributions')
        .where('quest_id', quest.id)
        .where('player_id', playerId)
        .first();

      if (existing) {
        await trx('guild_quest_contributions')
          .where('quest_id', quest.id)
          .where('player_id', playerId)
          .update({
            contribution: trx.raw('contribution + ?', [amount]),
            updated_at: new Date(),
          });
      } else {
        await trx('guild_quest_contributions').insert({
          quest_id: quest.id,
          player_id: playerId,
          contribution: amount,
        });
      }
    });

    return { success: true, questCompleted: completed };
  }

  /**
   * Claim quest rewards
   */
  async claimRewards(guildId: string, questId: string): Promise<QuestResult> {
    const db = getDatabase();

    const quest = await db('guild_quests')
      .where('id', questId)
      .where('guild_id', guildId)
      .first() as GuildQuestRow | undefined;

    if (!quest) {
      return { success: false, error: 'Quest not found.' };
    }

    if (!quest.completed) {
      return { success: false, error: 'Quest is not completed yet.' };
    }

    if (quest.rewards_claimed) {
      return { success: false, error: 'Rewards have already been claimed.' };
    }

    const rewards = typeof quest.rewards === 'string' ? JSON.parse(quest.rewards) : quest.rewards;

    // Get all contributors
    const contributors = await db('guild_quest_contributions')
      .select('player_id', 'contribution')
      .where('quest_id', questId) as ContributionRow[];

    const totalContribution = contributors.reduce((sum, c) => sum + c.contribution, 0);

    await db.transaction(async (trx) => {
      // Add gold to guild treasury
      const guild = await trx('guilds')
        .select('treasury')
        .where('id', guildId)
        .first();

      const treasury = typeof guild.treasury === 'string' ? JSON.parse(guild.treasury) : guild.treasury;

      await trx('guilds')
        .where('id', guildId)
        .update({
          treasury: JSON.stringify({
            ...treasury,
            gold: treasury.gold + rewards.gold,
          }),
        });

      // Distribute hero shards and diamonds proportionally to contributors
      for (const contributor of contributors) {
        const proportion = contributor.contribution / totalContribution;
        const shardsShare = Math.max(1, Math.floor(rewards.heroShards * proportion));
        const diamondsShare = Math.max(1, Math.floor(rewards.diamonds * proportion));

        // Add diamonds to player
        await trx('players')
          .where('id', contributor.player_id)
          .increment('diamonds', diamondsShare);

        // Add hero shards (to a generic pool for now)
        const existingShard = await trx('hero_shards')
          .where('player_id', contributor.player_id)
          .where('hero_name', 'Guild Reward')
          .first();

        if (existingShard) {
          await trx('hero_shards')
            .where('player_id', contributor.player_id)
            .where('hero_name', 'Guild Reward')
            .increment('count', shardsShare);
        } else {
          await trx('hero_shards').insert({
            player_id: contributor.player_id,
            hero_name: 'Guild Reward',
            count: shardsShare,
          });
        }
      }

      // Mark rewards as claimed
      await trx('guild_quests')
        .where('id', questId)
        .update({ rewards_claimed: true });
    });

    const quests = await this.getGuildQuests(guildId);
    return { success: true, quests };
  }

  /**
   * Shuffle array helper
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const guildQuestService = new GuildQuestService();
