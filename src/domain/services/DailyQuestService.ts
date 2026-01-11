import { getDatabase } from '../../infrastructure/database/connection.js';

export type QuestType = 'train_troops' | 'build_upgrade' | 'scout_location' | 'attack_npc' | 'view_map';

export class DailyQuestService {
  /**
   * Update progress for a daily quest
   * @param playerId - The player's database ID
   * @param questType - The type of quest to update
   * @param amount - Amount to add to progress (default 1)
   */
  static async updateProgress(playerId: number, questType: QuestType, amount: number = 1): Promise<void> {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    try {
      // Update the quest progress for today
      await db('daily_quests')
        .where('player_id', playerId)
        .where('quest_type', questType)
        .where('quest_date', today)
        .where('claimed', false)
        .increment('progress', amount);
    } catch (error) {
      // Log but don't throw - quest tracking shouldn't break main functionality
      console.error(`Failed to update daily quest progress: ${error}`);
    }
  }

  /**
   * Get current quest progress for a player
   */
  static async getProgress(playerId: number): Promise<Record<QuestType, { progress: number; target: number; claimed: boolean }>> {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    const quests = await db('daily_quests')
      .select('quest_type', 'progress', 'target', 'claimed')
      .where('player_id', playerId)
      .where('quest_date', today);

    const result: Record<string, { progress: number; target: number; claimed: boolean }> = {};
    for (const quest of quests) {
      result[quest.quest_type] = {
        progress: quest.progress,
        target: quest.target,
        claimed: quest.claimed,
      };
    }
    return result as Record<QuestType, { progress: number; target: number; claimed: boolean }>;
  }
}
