import { getDatabase } from '../../infrastructure/database/connection.js';

export type ActionType = 
  | 'train_troops'
  | 'build_upgrade'
  | 'attack_player'
  | 'attack_npc'
  | 'scout'
  | 'daily_reward'
  | 'quest_reward'
  | 'arena_battle'
  | 'research'
  | 'teleport'
  | 'shop_purchase';

export interface ResourceChange {
  food?: number;
  iron?: number;
  gold?: number;
  diamonds?: number;
}

export interface ActivityMetadata {
  buildingType?: string;
  buildingLevel?: number;
  troopTier?: number;
  troopCount?: number;
  targetName?: string;
  targetLocation?: { x: number; y: number };
  researchType?: string;
  itemName?: string;
  [key: string]: unknown;
}

export class ActivityLogService {
  /**
   * Log a player activity
   */
  static async log(
    playerId: number,
    actionType: ActionType,
    description: string,
    resourcesChanged?: ResourceChange,
    metadata?: ActivityMetadata
  ): Promise<void> {
    const db = getDatabase();

    try {
      await db('activity_logs').insert({
        player_id: playerId,
        action_type: actionType,
        description,
        resources_changed: resourcesChanged ? JSON.stringify(resourcesChanged) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } catch (error) {
      // Log but don't throw - activity logging shouldn't break main functionality
      console.error(`Failed to log activity: ${error}`);
    }
  }

  /**
   * Get activity log for a player for today
   */
  static async getTodayActivity(playerId: number): Promise<{
    activities: Array<{
      actionType: string;
      description: string;
      resourcesChanged: ResourceChange | null;
      metadata: ActivityMetadata | null;
      createdAt: Date;
    }>;
    summary: {
      foodEarned: number;
      foodSpent: number;
      ironEarned: number;
      ironSpent: number;
      goldEarned: number;
      goldSpent: number;
      diamondsEarned: number;
      diamondsSpent: number;
      troopsTrained: number;
      buildingsUpgraded: number;
      battlesWon: number;
      scoutsMade: number;
    };
  }> {
    const db = getDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activities = await db('activity_logs')
      .select('action_type', 'description', 'resources_changed', 'metadata', 'created_at')
      .where('player_id', playerId)
      .where('created_at', '>=', today)
      .orderBy('created_at', 'desc')
      .limit(50);

    // Calculate summary
    const summary = {
      foodEarned: 0,
      foodSpent: 0,
      ironEarned: 0,
      ironSpent: 0,
      goldEarned: 0,
      goldSpent: 0,
      diamondsEarned: 0,
      diamondsSpent: 0,
      troopsTrained: 0,
      buildingsUpgraded: 0,
      battlesWon: 0,
      scoutsMade: 0,
    };

    for (const activity of activities) {
      const resources = activity.resources_changed
        ? (typeof activity.resources_changed === 'string'
            ? JSON.parse(activity.resources_changed)
            : activity.resources_changed)
        : null;

      const meta = activity.metadata
        ? (typeof activity.metadata === 'string'
            ? JSON.parse(activity.metadata)
            : activity.metadata)
        : null;

      if (resources) {
        if (resources.food > 0) summary.foodEarned += resources.food;
        if (resources.food < 0) summary.foodSpent += Math.abs(resources.food);
        if (resources.iron > 0) summary.ironEarned += resources.iron;
        if (resources.iron < 0) summary.ironSpent += Math.abs(resources.iron);
        if (resources.gold > 0) summary.goldEarned += resources.gold;
        if (resources.gold < 0) summary.goldSpent += Math.abs(resources.gold);
        if (resources.diamonds > 0) summary.diamondsEarned += resources.diamonds;
        if (resources.diamonds < 0) summary.diamondsSpent += Math.abs(resources.diamonds);
      }

      switch (activity.action_type) {
        case 'train_troops':
          summary.troopsTrained += meta?.troopCount ?? 0;
          break;
        case 'build_upgrade':
          summary.buildingsUpgraded += 1;
          break;
        case 'attack_player':
        case 'attack_npc':
          if (meta?.won) summary.battlesWon += 1;
          break;
        case 'scout':
          summary.scoutsMade += 1;
          break;
      }
    }

    return {
      activities: activities.map(a => ({
        actionType: a.action_type,
        description: a.description,
        resourcesChanged: a.resources_changed
          ? (typeof a.resources_changed === 'string' ? JSON.parse(a.resources_changed) : a.resources_changed)
          : null,
        metadata: a.metadata
          ? (typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata)
          : null,
        createdAt: new Date(a.created_at),
      })),
      summary,
    };
  }
}
