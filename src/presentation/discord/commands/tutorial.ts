import {
  SlashCommandBuilder,
  EmbedBuilder,
  ComponentType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';
import { getDatabase } from '../../../infrastructure/database/connection.js';
import { tutorialService, type TutorialStep } from '../../../domain/services/TutorialService.js';
import type { Resources } from '../../../shared/types/index.js';
import type { Knex } from 'knex';

interface TutorialProgress {
  id: string;
  player_id: string;
  current_step: number;
  completed_steps: string[];
  claimed_rewards: string[];
  tutorial_completed: boolean;
}

// Check if player meets the requirement for a tutorial step
async function checkStepRequirement(
  db: Knex,
  playerId: string,
  step: TutorialStep,
  progress: TutorialProgress
): Promise<{ met: boolean; message?: string }> {
  const req = step.requirement;
  const steps = tutorialService.getSteps();
  
  // Find steps with rewards that come before this one
  const stepsWithRewards = steps.filter(s => s.reward && Object.values(s.reward).some(v => v && v > 0));
  const currentRewardIndex = stepsWithRewards.findIndex(s => s.id === step.id);
  
  // Check if all previous reward steps have been claimed
  if (currentRewardIndex > 0) {
    for (let i = 0; i < currentRewardIndex; i++) {
      if (!progress.claimed_rewards.includes(stepsWithRewards[i].id)) {
        return { 
          met: false, 
          message: `Complete previous steps first!` 
        };
      }
    }
  }
  
  // No requirement or type 'none' = claimable (if previous steps done)
  if (!req || req.type === 'none') {
    return { met: true };
  }

  if (req.type === 'building' && req.building) {
    const building = await db('buildings')
      .where('player_id', playerId)
      .where('type', req.building)
      .first();
    
    const requiredLevel = req.buildingLevel ?? 1;
    if (!building || building.level < requiredLevel) {
      return { 
        met: false, 
        message: `Build a ${req.building} (level ${requiredLevel}+) first!` 
      };
    }
    return { met: true };
  }

  if (req.type === 'troops' && req.troopTier) {
    const troops = await db('troops')
      .where('player_id', playerId)
      .where('tier', req.troopTier)
      .first();
    
    const requiredCount = req.troopCount ?? 1;
    if (!troops || troops.count < requiredCount) {
      return { 
        met: false, 
        message: `Train at least ${requiredCount} T${req.troopTier} troops first!` 
      };
    }
    return { met: true };
  }

  // Default: requirement met
  return { met: true };
}

export const tutorialCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('tutorial')
    .setDescription('Start or continue the game tutorial'),

  requiresPlayer: true,

  async execute(context: CommandContext): Promise<void> {
    const db = getDatabase();
    const discordId = context.interaction.user.id;

    const player = await db('players').select('*').where('discord_id', discordId).first();
    if (!player) {
      await context.interaction.reply({ content: '❌ Use `/begin` to start!', ephemeral: true });
      return;
    }

    // Get or create tutorial progress
    let progressRow = await db('tutorial_progress')
      .select('*')
      .where('player_id', player.id)
      .first();

    let progress: TutorialProgress;

    if (!progressRow) {
      // Create new progress record
      const [inserted] = await db('tutorial_progress')
        .insert({
          player_id: player.id,
          current_step: 0,
          completed_steps: JSON.stringify([]),
          claimed_rewards: JSON.stringify([]),
          tutorial_completed: false,
        })
        .returning('*');
      progress = {
        ...inserted,
        completed_steps: [],
        claimed_rewards: [],
      };
    } else {
      // Parse JSON fields
      progress = {
        ...progressRow,
        completed_steps: typeof progressRow.completed_steps === 'string' 
          ? JSON.parse(progressRow.completed_steps) 
          : progressRow.completed_steps,
        claimed_rewards: typeof progressRow.claimed_rewards === 'string'
          ? JSON.parse(progressRow.claimed_rewards)
          : progressRow.claimed_rewards,
      };
    }

    // Check if tutorial already completed
    if (progress.tutorial_completed) {
      await context.interaction.reply({
        content: '✅ You\'ve already completed the tutorial! Use `/help` to see all commands.',
        ephemeral: true,
      });
      return;
    }

    let currentStep = progress.current_step;
    const totalSteps = tutorialService.getStepCount();

    const { embed, buttons } = await buildTutorialEmbed(db, player.id, currentStep, totalSteps, progress);

    const response = await context.interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    // Handle navigation
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i: ButtonInteraction) => i.user.id === discordId,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      const [, action, stepStr] = buttonInteraction.customId.split(':');
      const stepNum = parseInt(stepStr, 10);

      await buttonInteraction.deferUpdate();

      if (action === 'skip') {
        collector.stop();
        await context.interaction.editReply({
          content: '⏭️ Tutorial skipped. Use `/tutorial` anytime to continue where you left off!',
          embeds: [],
          components: [],
        });
        return;
      }

      if (action === 'claim') {
        // Claim reward for current step
        const step = tutorialService.getStep(stepNum);
        if (step?.reward && !progress.claimed_rewards.includes(step.id)) {
          // Verify requirement is met before claiming
          const reqCheck = await checkStepRequirement(db, player.id, step, progress);
          if (!reqCheck.met) {
            await context.interaction.editReply({
              content: `❌ ${reqCheck.message}`,
            });
            return;
          }

          // Refresh player data
          const freshPlayer = await db('players').select('*').where('id', player.id).first();
          const freshResources: Resources = typeof freshPlayer.resources === 'string'
            ? JSON.parse(freshPlayer.resources)
            : freshPlayer.resources;

          await db.transaction(async (trx: Knex.Transaction) => {
            await trx('players')
              .where('id', player.id)
              .update({
                resources: JSON.stringify({
                  food: freshResources.food + (step.reward?.food ?? 0),
                  iron: freshResources.iron + (step.reward?.iron ?? 0),
                  gold: freshResources.gold + (step.reward?.gold ?? 0),
                }),
                diamonds: freshPlayer.diamonds + (step.reward?.diamonds ?? 0),
              });

            // Update progress
            progress.claimed_rewards.push(step.id);
            progress.completed_steps.push(step.id);
            
            await trx('tutorial_progress')
              .where('player_id', player.id)
              .update({
                completed_steps: JSON.stringify(progress.completed_steps),
                claimed_rewards: JSON.stringify(progress.claimed_rewards),
                updated_at: new Date(),
              });
          });
        }

        // Rebuild embed with updated progress
        const { embed: newEmbed, buttons: newButtons } = await buildTutorialEmbed(db, player.id, currentStep, totalSteps, progress);
        await context.interaction.editReply({
          embeds: [newEmbed],
          components: [newButtons],
        });
        return;
      }

      if (action === 'complete') {
        // Complete tutorial
        const step = tutorialService.getStep(stepNum);
        if (step?.reward && !progress.claimed_rewards.includes(step.id)) {
          // Verify requirement is met before claiming
          const reqCheck = await checkStepRequirement(db, player.id, step, progress);
          if (!reqCheck.met) {
            await context.interaction.editReply({
              content: `❌ ${reqCheck.message}`,
            });
            return;
          }

          const freshPlayer = await db('players').select('*').where('id', player.id).first();
          const freshResources: Resources = typeof freshPlayer.resources === 'string'
            ? JSON.parse(freshPlayer.resources)
            : freshPlayer.resources;

          await db.transaction(async (trx: Knex.Transaction) => {
            await trx('players')
              .where('id', player.id)
              .update({
                resources: JSON.stringify({
                  food: freshResources.food + (step.reward?.food ?? 0),
                  iron: freshResources.iron + (step.reward?.iron ?? 0),
                  gold: freshResources.gold + (step.reward?.gold ?? 0),
                }),
                diamonds: freshPlayer.diamonds + (step.reward?.diamonds ?? 0),
              });

            progress.claimed_rewards.push(step.id);
            progress.completed_steps.push(step.id);
            
            await trx('tutorial_progress')
              .where('player_id', player.id)
              .update({
                completed_steps: JSON.stringify(progress.completed_steps),
                claimed_rewards: JSON.stringify(progress.claimed_rewards),
                tutorial_completed: true,
                completed_at: new Date(),
                updated_at: new Date(),
              });
          });
        }

        collector.stop();
        
        const completeEmbed = new EmbedBuilder()
          .setTitle('🎉 Tutorial Complete!')
          .setColor('#00FF00')
          .setDescription(
            'Congratulations, Captain! You\'ve completed the tutorial!\n\n' +
            '**What\'s Next:**\n' +
            '• Build up your city during protection\n' +
            '• Train troops and level your hero\n' +
            '• Scout and attack NPCs for rewards\n' +
            '• Join a guild at HQ level 5\n' +
            '• Compete in the Arena for rankings'
          )
          .addFields({
            name: '📚 Need Help?',
            value: 'Use `/help` anytime to see all available commands!',
            inline: false,
          });

        await context.interaction.editReply({
          embeds: [completeEmbed],
          components: [],
        });
        return;
      }

      // Navigate
      if (action === 'next') {
        currentStep = Math.min(stepNum + 1, totalSteps - 1);
      } else if (action === 'prev') {
        currentStep = Math.max(stepNum - 1, 0);
      }

      // Update current step in database
      await db('tutorial_progress')
        .where('player_id', player.id)
        .update({ current_step: currentStep, updated_at: new Date() });

      progress.current_step = currentStep;

      const { embed: newEmbed, buttons: newButtons } = await buildTutorialEmbed(db, player.id, currentStep, totalSteps, progress);
      await context.interaction.editReply({
        embeds: [newEmbed],
        components: [newButtons],
      });
    });

    collector.on('end', async (_: unknown, reason: string) => {
      if (reason === 'time') {
        await context.interaction.editReply({
          content: '⏰ Tutorial timed out. Use `/tutorial` to continue where you left off!',
          components: [],
        }).catch(() => {});
      }
    });
  },
};

async function buildTutorialEmbed(
  db: Knex,
  playerId: string,
  currentStep: number,
  totalSteps: number,
  progress: TutorialProgress
): Promise<{ embed: EmbedBuilder; buttons: ActionRowBuilder<ButtonBuilder> }> {
  const step = tutorialService.getStep(currentStep);
  const steps = tutorialService.getSteps();
  
  // Build progress indicator - only show steps with rewards
  const stepsWithRewards = steps.filter(s => s.reward && Object.values(s.reward).some(v => v && v > 0));
  const progressLine = stepsWithRewards.map((s) => {
    const rewardClaimed = progress.claimed_rewards.includes(s.id);
    if (rewardClaimed) return '✅';
    return '⬜';
  }).join(' ');
  
  const claimedCount = stepsWithRewards.filter(s => progress.claimed_rewards.includes(s.id)).length;
  const totalRewards = stepsWithRewards.length;

  // Clone the embed and add progress
  const embed = EmbedBuilder.from(step!.embed.toJSON())
    .setFooter({ text: `Step ${currentStep + 1} of ${totalSteps}` });

  // Add progress field at the top
  const fields = embed.data.fields || [];
  embed.setFields([
    {
      name: `🎁 Rewards (${claimedCount}/${totalRewards})`,
      value: progressLine,
      inline: false,
    },
    ...fields,
  ]);

  // Check if current step has a reward and if requirement is met
  const hasReward = step?.reward && Object.values(step.reward).some(v => v && v > 0);
  const rewardClaimed = progress.claimed_rewards.includes(step!.id);
  
  // Check requirement for current step
  let requirementMet = true;
  if (hasReward && !rewardClaimed && step) {
    const reqCheck = await checkStepRequirement(db, playerId, step, progress);
    requirementMet = reqCheck.met;
  }

  // Build buttons
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (currentStep > 0) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial:prev:${currentStep}`)
        .setLabel('◀️ Back')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // Claim reward button - only show if has reward, not claimed, AND requirement met
  if (hasReward && !rewardClaimed && requirementMet) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial:claim:${currentStep}`)
        .setLabel('🎁 Claim Reward')
        .setStyle(ButtonStyle.Success)
    );
  } else if (hasReward && !rewardClaimed && !requirementMet) {
    // Show disabled button with hint
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial:locked:${currentStep}`)
        .setLabel('🔒 Complete Task First')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }

  if (currentStep < totalSteps - 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial:next:${currentStep}`)
        .setLabel('Continue ▶️')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (currentStep === totalSteps - 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial:complete:${currentStep}`)
        .setLabel('🎉 Complete Tutorial')
        .setStyle(ButtonStyle.Success)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`tutorial:skip:${currentStep}`)
      .setLabel('Skip')
      .setStyle(ButtonStyle.Danger)
  );

  return { embed, buttons: row };
}
