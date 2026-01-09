import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import {
  DAILY_FOOD_REWARD,
  DAILY_IRON_REWARD,
  DAILY_DIAMOND_REWARD,
  NEWBIE_BONUS_DAYS,
} from '../../../shared/constants/game.js';
import type { Knex } from 'knex';

// Newbie bonus rewards (7 days)
const NEWBIE_REWARDS: { food: number; iron: number; gold: number; diamonds: number; description: string }[] = [
  { food: 2000, iron: 1000, gold: 500, diamonds: 50, description: 'Day 1: Welcome Pack!' },
  { food: 3000, iron: 1500, gold: 750, diamonds: 75, description: 'Day 2: Building Boost' },
  { food: 4000, iron: 2000, gold: 1000, diamonds: 100, description: 'Day 3: Army Supplies' },
  { food: 5000, iron: 2500, gold: 1250, diamonds: 150, description: 'Day 4: War Chest' },
  { food: 6000, iron: 3000, gold: 1500, diamonds: 200, description: 'Day 5: Commander\'s Gift' },
  { food: 8000, iron: 4000, gold: 2000, diamonds: 300, description: 'Day 6: Hero\'s Bounty' },
  { food: 10000, iron: 5000, gold: 3000, diamonds: 500, description: 'Day 7: Legend\'s Treasure!' },
];

// Daily quests
const DAILY_QUESTS = [
  { type: 'train_troops', target: 50, reward: 30, description: 'Train 50 troops' },
  { type: 'build_upgrade', target: 1, reward: 40, description: 'Upgrade a building' },
  { type: 'scout_location', target: 3, reward: 20, description: 'Scout 3 locations' },
  { type: 'attack_npc', target: 1, reward: 50, description: 'Defeat an NPC' },
  { type: 'view_map', target: 5, reward: 30, description: 'Explore 5 map tiles' },
];

export const dailyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim daily rewards and view quest progress'),

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players').select('*').where('discord_id', discordId).first();
    if (!player) {
      await context.interaction.reply({ content: '❌ Use `/begin` to start!', ephemeral: true });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const playerCreatedDate = new Date(player.created_at);
    const daysSinceCreation = Math.floor((Date.now() - playerCreatedDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check login reward for today
    const loginReward = await db('login_rewards')
      .select('*')
      .where('player_id', player.id)
      .where('login_date', today)
      .first();

    // Get daily quests
    let quests = await db('daily_quests')
      .select('*')
      .where('player_id', player.id)
      .where('quest_date', today);

    // Generate quests if none exist for today
    if (quests.length === 0) {
      const questsToInsert = DAILY_QUESTS.map(q => ({
        player_id: player.id,
        quest_type: q.type,
        target: q.target,
        progress: 0,
        claimed: false,
        quest_date: today,
      }));
      await db('daily_quests').insert(questsToInsert);
      quests = await db('daily_quests')
        .select('*')
        .where('player_id', player.id)
        .where('quest_date', today);
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('📅 Daily Rewards & Quests')
      .setColor('#FFD700')
      .setTimestamp();

    // Login reward section
    const isNewbie = daysSinceCreation < NEWBIE_BONUS_DAYS;
    const streakDay = Math.min(daysSinceCreation, NEWBIE_BONUS_DAYS - 1);

    if (!loginReward?.claimed) {
      if (isNewbie) {
        const reward = NEWBIE_REWARDS[streakDay];
        embed.addFields({
          name: `🎁 ${reward.description}`,
          value: `🌾 ${reward.food.toLocaleString()} Food\n⚒️ ${reward.iron.toLocaleString()} Iron\n💰 ${reward.gold.toLocaleString()} Gold\n💎 ${reward.diamonds} Diamonds\n\n**Click the button below to claim!**`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '🎁 Daily Login Reward',
          value: `🌾 ${DAILY_FOOD_REWARD.toLocaleString()} Food\n⚒️ ${DAILY_IRON_REWARD.toLocaleString()} Iron\n💎 ${DAILY_DIAMOND_REWARD} Diamonds\n\n**Click the button below to claim!**`,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: '✅ Login Reward Claimed',
        value: 'Come back tomorrow for more rewards!',
        inline: false,
      });
    }

    // Quest progress section
    let questsDisplay = '';
    let totalDiamonds = 0;
    let claimableQuests = 0;

    for (const quest of quests) {
      const questDef = DAILY_QUESTS.find(q => q.type === quest.quest_type);
      if (!questDef) continue;

      const isComplete = quest.progress >= quest.target;
      const isClaimed = quest.claimed;
      const status = isClaimed ? '✅' : isComplete ? '🎁' : '⏳';
      const progress = `${Math.min(quest.progress, quest.target)}/${quest.target}`;

      questsDisplay += `${status} **${questDef.description}** (${progress}) - ${questDef.reward} 💎\n`;

      if (isComplete && !isClaimed) {
        claimableQuests++;
        totalDiamonds += questDef.reward;
      }
    }

    embed.addFields({
      name: '📋 Daily Quests',
      value: questsDisplay || 'No quests available',
      inline: false,
    });

    if (claimableQuests > 0) {
      embed.addFields({
        name: '💎 Claimable Rewards',
        value: `${claimableQuests} quest(s) complete! Claim **${totalDiamonds} Diamonds**`,
        inline: false,
      });
    }

    // Newbie progress
    if (isNewbie) {
      const daysRemaining = NEWBIE_BONUS_DAYS - daysSinceCreation;
      embed.addFields({
        name: '🌟 Newbie Bonus',
        value: `Day ${daysSinceCreation + 1} of ${NEWBIE_BONUS_DAYS} - ${daysRemaining} days of bonus rewards remaining!`,
        inline: false,
      });
    }

    // Buttons
    const buttons = new ActionRowBuilder<ButtonBuilder>();

    if (!loginReward?.claimed) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId('daily:claim_login')
          .setLabel('🎁 Claim Login Reward')
          .setStyle(ButtonStyle.Success)
      );
    }

    if (claimableQuests > 0) {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId('daily:claim_quests')
          .setLabel(`📋 Claim Quest Rewards (${totalDiamonds} 💎)`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    const hasButtons = buttons.components.length > 0;
    const response = await context.interaction.reply({
      embeds: [embed],
      components: hasButtons ? [buttons] : [],
      fetchReply: true,
    });

    if (!hasButtons) return;

    // Handle button interactions
    try {
      const buttonInteraction = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === discordId,
        time: 60000,
      });

      await buttonInteraction.deferUpdate();

      if (buttonInteraction.customId === 'daily:claim_login') {
        // Claim login reward
        const resources = typeof player.resources === 'string'
          ? JSON.parse(player.resources)
          : player.resources;

        let rewardFood: number, rewardIron: number, rewardGold: number, rewardDiamonds: number;

        if (isNewbie) {
          const reward = NEWBIE_REWARDS[streakDay];
          rewardFood = reward.food;
          rewardIron = reward.iron;
          rewardGold = reward.gold;
          rewardDiamonds = reward.diamonds;
        } else {
          rewardFood = DAILY_FOOD_REWARD;
          rewardIron = DAILY_IRON_REWARD;
          rewardGold = 0;
          rewardDiamonds = DAILY_DIAMOND_REWARD;
        }

        await db.transaction(async (trx: Knex.Transaction) => {
          await trx('players')
            .where('id', player.id)
            .update({
              resources: JSON.stringify({
                food: resources.food + rewardFood,
                iron: resources.iron + rewardIron,
                gold: resources.gold + rewardGold,
              }),
              diamonds: player.diamonds + rewardDiamonds,
            });

          await trx('login_rewards').insert({
            player_id: player.id,
            login_date: today,
            streak_day: streakDay + 1,
            claimed: true,
          });
        });

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Login Reward Claimed!')
          .setColor('#00FF00')
          .setDescription(
            `You received:\n🌾 ${rewardFood.toLocaleString()} Food\n⚒️ ${rewardIron.toLocaleString()} Iron\n` +
            (rewardGold > 0 ? `💰 ${rewardGold.toLocaleString()} Gold\n` : '') +
            `💎 ${rewardDiamonds} Diamonds`
          )
          .setTimestamp();

        await context.interaction.editReply({ embeds: [successEmbed], components: [] });
      } else if (buttonInteraction.customId === 'daily:claim_quests') {
        // Claim all completed quests
        const completedQuests = quests.filter(q => {
          const def = DAILY_QUESTS.find(d => d.type === q.quest_type);
          return def && q.progress >= q.target && !q.claimed;
        });

        let totalReward = 0;
        for (const quest of completedQuests) {
          const def = DAILY_QUESTS.find(d => d.type === quest.quest_type);
          if (def) totalReward += def.reward;
        }

        await db.transaction(async (trx: Knex.Transaction) => {
          await trx('players')
            .where('id', player.id)
            .update({ diamonds: player.diamonds + totalReward });

          for (const quest of completedQuests) {
            await trx('daily_quests')
              .where('id', quest.id)
              .update({ claimed: true });
          }
        });

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Quest Rewards Claimed!')
          .setColor('#00FF00')
          .setDescription(`You received **${totalReward} Diamonds** 💎 from ${completedQuests.length} quest(s)!`)
          .setTimestamp();

        await context.interaction.editReply({ embeds: [successEmbed], components: [] });
      }
    } catch {
      // Timeout - remove buttons
      await context.interaction.editReply({ components: [] }).catch(() => {});
    }
  },
};
