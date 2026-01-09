import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  embed: EmbedBuilder;
  action?: string; // Command hint for the user
  reward?: { food?: number; iron?: number; gold?: number; diamonds?: number };
  // Verification requirements - what the player needs to have done
  requirement?: {
    type: 'none' | 'building' | 'troops' | 'command';
    building?: string; // building type required
    buildingLevel?: number; // minimum level
    troopTier?: number; // troop tier required
    troopCount?: number; // minimum count
  };
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '🎮 Welcome to PopVerse Kingdoms!',
    description: 'You\'ve chosen your faction and received your starter hero. Let\'s learn the basics!',
    embed: new EmbedBuilder()
      .setTitle('🎮 Tutorial: Welcome!')
      .setColor('#FFD700')
      .setDescription(
        'Welcome, Captain! You\'ve just founded your city in the PopVerse.\n\n' +
        '**Your Goals:**\n' +
        '• Build and upgrade your city\n' +
        '• Train troops and collect heroes\n' +
        '• Battle NPCs and other players\n' +
        '• Join a guild and conquer territory\n\n' +
        'Let\'s start by exploring your city!'
      )
      .addFields({
        name: '📍 Next Step',
        value: 'Click **Continue** to learn about your city.',
        inline: false,
      }),
    reward: { food: 1000, iron: 500 },
    requirement: { type: 'none' }, // Free reward for starting
  },
  {
    id: 'city',
    title: '🏰 Your City',
    description: 'Your city is your base of operations.',
    embed: new EmbedBuilder()
      .setTitle('🏰 Tutorial: Your City')
      .setColor('#8B4513')
      .setDescription(
        'Your city produces resources and trains troops.\n\n' +
        '**Key Buildings:**\n' +
        '🏛️ **HQ** - Upgrade to unlock features (max level 25)\n' +
        '🌾 **Farm** - Produces Food for troops\n' +
        '⚒️ **Mine** - Produces Iron for buildings\n' +
        '⚔️ **Barracks** - Train your army\n\n' +
        '**Try it:** Use `/city` to view your city status!'
      )
      .addFields({
        name: '💡 Tip',
        value: 'You have a 24-hour protection shield. Use this time to build up!',
        inline: false,
      }),
    action: '/city',
    // No reward for this info step
  },
  {
    id: 'building_farm',
    title: '🌾 Build a Farm',
    description: 'Start producing food for your troops.',
    embed: new EmbedBuilder()
      .setTitle('🌾 Tutorial: Build a Farm')
      .setColor('#228B22')
      .setDescription(
        'Your first building should be a Farm to produce Food!\n\n' +
        '**How to Build:**\n' +
        '• Use `/build building:farm` to build a Farm\n' +
        '• Farms produce Food every hour\n' +
        '• Food is needed to train troops\n\n' +
        '**Try it now:** `/build building:farm`'
      )
      .addFields({
        name: '🎁 Reward',
        value: 'Build a Farm to receive **2,000 Food** and **1,000 Iron**!',
        inline: false,
      }),
    action: '/build building:farm',
    reward: { food: 2000, iron: 1000 },
    requirement: { type: 'building', building: 'farm', buildingLevel: 1 },
  },
  {
    id: 'building_barracks',
    title: '⚔️ Build Barracks',
    description: 'You need barracks to train troops!',
    embed: new EmbedBuilder()
      .setTitle('⚔️ Tutorial: Build Barracks')
      .setColor('#DC143C')
      .setDescription(
        'Barracks are required to train your army!\n\n' +
        '**Requirements:**\n' +
        '• HQ Level 2 required for Barracks\n' +
        '• First, upgrade your HQ: `/build building:hq`\n' +
        '• Then build Barracks: `/build building:barracks`\n\n' +
        '**Steps:**\n' +
        '1. `/build building:hq` (upgrade to level 2)\n' +
        '2. `/build building:barracks` (build barracks)'
      )
      .addFields({
        name: '🎁 Reward',
        value: 'Build Barracks to receive **2,000 Food** and **1,500 Iron**!',
        inline: false,
      }),
    action: '/build building:barracks',
    reward: { food: 2000, iron: 1500 },
    requirement: { type: 'building', building: 'barracks', buildingLevel: 1 },
  },
  {
    id: 'troops',
    title: '🪖 Training Troops',
    description: 'Build your army to defend and attack.',
    embed: new EmbedBuilder()
      .setTitle('🪖 Tutorial: Training Troops')
      .setColor('#FF0000')
      .setDescription(
        'Now that you have Barracks, train your army!\n\n' +
        '**Troop Tiers:**\n' +
        '• **T1 Militia** - Basic troops (HQ 1)\n' +
        '• **T2 Soldiers** - Stronger (HQ 10)\n' +
        '• **T3 Veterans** - Elite (HQ 18)\n' +
        '• **T4 Elite Guards** - Best (HQ 25)\n\n' +
        '**Try it:** `/train tier:1 amount:50`'
      )
      .addFields({
        name: '🎁 Reward',
        value: 'Train at least 20 T1 troops to receive **2,000 Food** and **1,000 Iron**!',
        inline: false,
      }),
    action: '/train tier:1 amount:50',
    reward: { food: 2000, iron: 1000 },
    requirement: { type: 'troops', troopTier: 1, troopCount: 20 },
  },
  {
    id: 'map',
    title: '🗺️ The World Map',
    description: 'Explore the world around you.',
    embed: new EmbedBuilder()
      .setTitle('🗺️ Tutorial: The World Map')
      .setColor('#1E90FF')
      .setDescription(
        'The map is a 100x100 grid where all players live!\n\n' +
        '**Map Features:**\n' +
        '🏰 Cities - Player bases\n' +
        '👹 Monsters - Enemies to defeat for rewards\n' +
        '⛰️ Mountains - Impassable terrain\n' +
        '🌊 Lakes - Impassable terrain\n' +
        '💎 Resources - Gather materials\n\n' +
        '**Try it:** Use `/map` to see your surroundings!'
      )
      .addFields({
        name: '📍 Navigation',
        value: 'Use the arrow buttons to pan, or `/map x:50 y:50` to jump to coordinates.',
        inline: false,
      }),
    action: '/map',
    reward: { diamonds: 100 },
    requirement: { type: 'none' }, // Free reward for reading
  },
  {
    id: 'combat',
    title: '⚔️ Combat',
    description: 'Learn how to fight enemies.',
    embed: new EmbedBuilder()
      .setTitle('⚔️ Tutorial: Combat')
      .setColor('#DC143C')
      .setDescription(
        'Combat is how you grow stronger and earn rewards!\n\n' +
        '**Combat Basics:**\n' +
        '• `/scout x:__ y:__` - Check enemy strength first\n' +
        '• `/attack x:__ y:__ hero:Name troops:100` - Attack!\n' +
        '• Heroes lead your army and use special skills\n\n' +
        '**Elemental Advantage:**\n' +
        '🔥 Fire beats 💨 Wind (+25% damage)\n' +
        '💨 Wind beats 💧 Water (+25% damage)\n' +
        '💧 Water beats 🔥 Fire (+25% damage)'
      )
      .addFields({
        name: '💡 Tip',
        value: 'Always scout before attacking to see if you can win!',
        inline: false,
      }),
    action: '/scout',
    reward: { diamonds: 100 },
    requirement: { type: 'none' }, // Free reward for reading
  },
  {
    id: 'heroes',
    title: '🦸 Heroes',
    description: 'Your heroes are powerful allies.',
    embed: new EmbedBuilder()
      .setTitle('🦸 Tutorial: Heroes')
      .setColor('#9932CC')
      .setDescription(
        'Heroes lead your armies and have special abilities!\n\n' +
        '**Hero Rarities:**\n' +
        '⬜ Common - Basic heroes\n' +
        '🟦 Rare - Better stats\n' +
        '🟪 Epic - Powerful skills\n' +
        '🟨 Legendary - Game-changers!\n\n' +
        '**Your Starter Hero:**\n' +
        'You received a Common hero from your faction. Level them up through battles!'
      )
      .addFields({
        name: '⭐ Leveling',
        value: 'Heroes gain XP from battles. Higher levels = stronger stats!',
        inline: false,
      }),
    action: '/heroes',
    // No reward for this info step
  },
  {
    id: 'daily',
    title: '📅 Daily Rewards',
    description: 'Claim rewards every day!',
    embed: new EmbedBuilder()
      .setTitle('📅 Tutorial: Daily Rewards')
      .setColor('#FFD700')
      .setDescription(
        'Log in daily for free rewards!\n\n' +
        '**Newbie Bonus (7 Days):**\n' +
        'Special rewards for your first week!\n\n' +
        '**Daily Quests:**\n' +
        'Complete objectives for Diamond rewards!\n\n' +
        '**Try it:** Use `/daily` to claim your rewards!'
      )
      .addFields({
        name: '💎 Tip',
        value: 'Don\'t miss a day! Consecutive logins give better rewards.',
        inline: false,
      }),
    action: '/daily',
    reward: { diamonds: 200 },
    requirement: { type: 'none' }, // Free reward for reading
  },
  {
    id: 'complete',
    title: '🎉 Tutorial Complete!',
    description: 'You\'re ready to conquer the PopVerse!',
    embed: new EmbedBuilder()
      .setTitle('🎉 Tutorial Complete!')
      .setColor('#00FF00')
      .setDescription(
        'Congratulations, Captain! You\'ve completed the tutorial!\n\n' +
        '**What\'s Next:**\n' +
        '• Build up your city during protection\n' +
        '• Train troops and level your hero\n' +
        '• Scout and attack NPCs for rewards\n' +
        '• Join a guild at HQ level 5\n' +
        '• Compete in the Arena for rankings\n\n' +
        '**Your Completion Rewards:**\n' +
        '🌾 5,000 Food | ⚒️ 2,500 Iron | 💰 1,000 Gold | 💎 500 Diamonds'
      )
      .addFields({
        name: '📚 Need Help?',
        value: 'Use `/help` anytime to see all available commands!',
        inline: false,
      }),
    reward: { food: 5000, iron: 2500, gold: 1000, diamonds: 500 },
    requirement: { type: 'none' }, // Completion reward
  },
];

export class TutorialService {
  getSteps(): TutorialStep[] {
    return TUTORIAL_STEPS;
  }

  getStep(index: number): TutorialStep | null {
    return TUTORIAL_STEPS[index] ?? null;
  }

  getStepCount(): number {
    return TUTORIAL_STEPS.length;
  }

  createNavigationButtons(currentStep: number, totalSteps: number): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    if (currentStep > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`tutorial:prev:${currentStep}`)
          .setLabel('◀️ Back')
          .setStyle(ButtonStyle.Secondary)
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
          .setLabel('🎉 Claim Rewards & Finish')
          .setStyle(ButtonStyle.Success)
      );
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tutorial:skip:${currentStep}`)
        .setLabel('Skip Tutorial')
        .setStyle(ButtonStyle.Danger)
    );

    return row;
  }

  getTotalRewards(): { food: number; iron: number; gold: number; diamonds: number } {
    return TUTORIAL_STEPS.reduce(
      (acc, step) => ({
        food: acc.food + (step.reward?.food ?? 0),
        iron: acc.iron + (step.reward?.iron ?? 0),
        gold: acc.gold + (step.reward?.gold ?? 0),
        diamonds: acc.diamonds + (step.reward?.diamonds ?? 0),
      }),
      { food: 0, iron: 0, gold: 0, diamonds: 0 }
    );
  }
}

export const tutorialService = new TutorialService();
