# Requirements Document

## Introduction

PopVerse Kingdoms is a comprehensive Discord bot-based strategy game that combines territory control, hero collection, and competitive PvP elements. The game features three factions (Cinema/Fire, Otaku/Wind, Arcade/Water) competing in a persistent world with seasonal resets. Players build cities, collect heroes, engage in real-time battles, and participate in weekly Conquest events. The system includes an optional web dashboard for advanced map viewing and supports 50-100 players per server with 3-month seasons.

## Requirements

### Requirement 1: Core Game Setup and Server Management

**User Story:** As a Discord server administrator, I want to set up the game bot and configure channels automatically, so that my community can start playing immediately without manual channel creation.

#### Acceptance Criteria

1. WHEN an admin runs `!setup start` THEN the system SHALL create dedicated game channels (#game-news, #city-hall, #battlefield, #arena)
2. WHEN the setup completes THEN the system SHALL generate a 100x100 map with spawn zones (70%), resource zones (20%), and center temple (10%)
3. WHEN the map is generated THEN the system SHALL place random obstacles (mountains/lakes) to create strategic chokepoints
4. WHEN setup is complete THEN the system SHALL create three starter guilds (Cinema Legion, Otaku Alliance, Arcade Coalition) that players can join immediately

### Requirement 2: Player Registration and Faction Selection

**User Story:** As a new player, I want to choose my faction and spawn on the map, so that I can begin building my empire with faction-specific bonuses.

#### Acceptance Criteria

1. WHEN a new player runs `!begin` THEN the system SHALL prompt them to choose from Cinema (Fire), Otaku (Wind), or Arcade (Water) factions
2. WHEN a faction is selected THEN the system SHALL assign the corresponding starter hero (John McClane, Naruto, or Mario)
3. WHEN faction selection is complete THEN the system SHALL place the player's HQ on a random spawn zone tile with 24-hour protection shield
4. WHEN a player is created THEN the system SHALL apply permanent faction bonuses (+10% Attack for Cinema, +15% March Speed for Otaku, +10% Defense for Arcade)
5. IF a player tries to change factions THEN the system SHALL prevent this action (faction choice is permanent per season)

### Requirement 3: Building and Resource Management System

**User Story:** As a player, I want to construct and upgrade buildings that produce resources automatically, so that I can grow my city's economy without constant micromanagement.

#### Acceptance Criteria

1. WHEN a player runs `!build [Building]` THEN the system SHALL construct the specified building if resources are sufficient
2. WHEN buildings produce resources THEN the system SHALL automatically add Food/Iron/Gold to player storage every hour
3. WHEN a player runs `!upgrade [Building]` THEN the system SHALL start an upgrade timer based on building level (instant to 24 hours)
4. WHEN guildmates use help buttons THEN the system SHALL reduce build times by 10 minutes per helper (max 5 helpers)
5. WHEN resources exceed vault capacity THEN the system SHALL protect 50% of resources from raids while leaving the rest vulnerable

### Requirement 4: Hero Collection and Management System

**User Story:** As a player, I want to collect, level up, and equip heroes with unique abilities, so that I can create powerful armies and compete effectively in battles.

#### Acceptance Criteria

1. WHEN a player spends Diamonds on summons THEN the system SHALL grant random heroes with higher chances for their faction
2. WHEN heroes participate in battles THEN the system SHALL award XP and automatically level them up to max level 50
3. WHEN heroes reach level milestones (10, 20, 30, 40, 50) THEN the system SHALL unlock skill upgrades and stat bonuses
4. WHEN players craft gear at HQ 10+ THEN the system SHALL allow weapon/armor attachment for +10-30% stat bonuses
5. IF a player owns hero shards THEN the system SHALL allow combining 10 shards to unlock that hero

### Requirement 5: Combat System with Elemental Mechanics

**User Story:** As a player, I want to engage in strategic battles where faction advantages, hero skills, and troop composition matter, so that combat feels tactical rather than purely numerical.

#### Acceptance Criteria

1. WHEN Fire attacks Wind THEN the system SHALL apply +25% damage bonus (Rock-Paper-Scissors mechanics)
2. WHEN Wind attacks Water THEN the system SHALL apply +25% damage bonus
3. WHEN Water attacks Fire THEN the system SHALL apply +25% damage bonus
4. WHEN battles resolve THEN the system SHALL calculate turn order based on hero speed stats and "First Strike" abilities
5. WHEN hero skills activate THEN the system SHALL apply effects (AoE damage, damage reduction, healing, immunity)
6. WHEN battles conclude THEN the system SHALL send detailed battle reports showing turn order, skill activations, and casualties
7. WHEN troops are defeated THEN the system SHALL send 50% to Hospital (revivable) and 50% permanently lost

### Requirement 6: Arena PvP System with Offline Battles

**User Story:** As a player, I want to compete in asynchronous PvP battles against other players' defense teams, so that I can climb rankings and earn rewards without requiring both players to be online simultaneously.

#### Acceptance Criteria

1. WHEN a player sets up defense teams THEN the system SHALL save their 3-hero composition for AI-controlled battles
2. WHEN players attack in Arena THEN the system SHALL show 5 potential opponents within ±200 Arena Points
3. WHEN players have insufficient opponents THEN the system SHALL generate AI bots with [BOT] tags offering 50% normal rewards
4. WHEN players win Arena battles THEN the system SHALL award +20-40 Arena Points, Hero XP, and 10-30 Diamonds
5. WHEN players lose Arena battles THEN the system SHALL deduct -10-20 Arena Points with no rewards
6. WHEN weekly reset occurs THEN the system SHALL distribute tier-based rewards (50-2000 Diamonds based on rank)
7. WHEN players use attack tokens THEN the system SHALL consume 1 token per battle (10 max, regenerate 1 per 2 hours, first 5 daily battles free)

### Requirement 7: Territory Control and Land Ownership

**User Story:** As a player, I want to purchase and control land parcels that provide economic bonuses, so that I can establish strategic territorial advantages beyond just my city location.

#### Acceptance Criteria

1. WHEN players purchase land parcels THEN the system SHALL grant bonuses (+15% Food/Iron, +20% Gold, +10% Defense in forts)
2. WHEN land is purchased THEN the system SHALL display ownership on the map with faction colors and player names
3. WHEN players own Strategic Forts THEN the system SHALL apply +10% defense bonus to battles fought within those borders
4. WHEN players exceed ownership limits THEN the system SHALL prevent purchases (3 lands per player, 10 per guild)
5. WHEN guilds purchase land THEN the system SHALL grant bonuses to all guild members while maintaining separate personal land limits
6. WHEN players lose sieges THEN the system SHALL allow winners to claim one of the loser's lands for free

### Requirement 8: Guild System with Cooperative Features

**User Story:** As a player, I want to join or create guilds that enable coordinated strategies and shared benefits, so that I can participate in team-based gameplay and social features.

#### Acceptance Criteria

1. WHEN players create guilds THEN the system SHALL charge 500 Gold and create a private guild channel
2. WHEN guild members start rallies THEN the system SHALL allow up to 5 players to combine armies for joint attacks
3. WHEN guild members help with builds THEN the system SHALL reduce construction times by 10 minutes per helper
4. WHEN guilds complete daily quests THEN the system SHALL distribute rewards (Gold, Hero Shards, Diamonds) to participating members
5. WHEN guilds own lands THEN the system SHALL apply bonuses to all members regardless of their personal land ownership
6. WHEN new players reach HQ 5 without guilds THEN the system SHALL auto-post recruitment messages in #guild-recruitment

### Requirement 9: Admin-Triggered Conquest Events with Anti-Lag Mechanics

**User Story:** As a server administrator, I want to manually start Conquest events at my chosen time, so that I can schedule events when my community is most active and engaged.

#### Acceptance Criteria

1. WHEN an admin runs `/conquest start` THEN the system SHALL spawn 5 Control Points at strategic map locations for 1-hour duration
2. WHEN an admin runs `/conquest start [duration]` THEN the system SHALL allow custom event duration (30-120 minutes)
3. WHEN players attack Control Points THEN the system SHALL queue battles to prevent simultaneous conflicts and lag
4. WHEN players control points THEN the system SHALL award 1 point per minute held with real-time leaderboard updates
5. WHEN players attack the same Control Point THEN the system SHALL enforce 5-minute cooldowns per player to prevent spam
6. WHEN events conclude THEN the system SHALL distribute rewards to top 10 individuals and top 3 guilds (Diamonds, Hero Shards, Land Vouchers)
7. WHEN battles occur THEN the system SHALL post live updates to #conquest-live channel for real-time event tracking
8. WHEN an admin runs `/conquest stop` THEN the system SHALL end the event early and distribute rewards based on current standings
9. WHEN an admin runs `/conquest status` THEN the system SHALL show current event status, time remaining, and leaderboard

### Requirement 10: Map System with Multiple Viewing Options

**User Story:** As a player, I want to view and navigate the game map through Discord commands and optionally through a web interface, so that I can make informed strategic decisions about movement and territory.

#### Acceptance Criteria

1. WHEN players run `!map` THEN the system SHALL display a 15x15 grid around their city using faction emojis and terrain symbols
2. WHEN players use directional commands THEN the system SHALL pan the view (`!map north`, `!map south`, etc.)
3. WHEN players search locations THEN the system SHALL show specific areas (`!map player [Name]`, `!map coords [X,Y]`)
4. WHEN players request web access THEN the system SHALL generate unique URLs for full 100x100 zoomable map viewing
5. WHEN fog of war applies THEN the system SHALL hide unexplored areas with ❓ symbols until players scout those locations
6. IF web dashboard is accessed THEN the system SHALL show real-time march tracking, land ownership overlays, and clickable tile information

### Requirement 11: Seasonal Reset and Progression System

**User Story:** As a player, I want to participate in 3-month seasons with fresh starts while retaining some progression elements, so that the game stays competitive and engaging long-term.

#### Acceptance Criteria

1. WHEN seasons end THEN the system SHALL reset all player progress except Diamonds and Prestige Points
2. WHEN new seasons start THEN the system SHALL regenerate the map with new terrain and resource node placement
3. WHEN season resets occur THEN the system SHALL archive leaderboards and achievements to a Hall of Fame
4. WHEN players earn Prestige Points THEN the system SHALL carry these across seasons for permanent account progression
5. IF players earned exclusive titles or badges THEN the system SHALL preserve these as permanent account decorations

### Requirement 12: Real-time March and Timer Systems

**User Story:** As a player, I want my armies to move across the map in real-time with accurate timing, so that strategic positioning and timing become important tactical elements.

#### Acceptance Criteria

1. WHEN players send marches THEN the system SHALL calculate travel time based on distance (3-15 minutes) and faction speed bonuses
2. WHEN marches are in progress THEN the system SHALL track them in the database and resolve them automatically upon arrival
3. WHEN march timers complete THEN the system SHALL execute the intended action (attack, scout, return) and notify relevant players
4. WHEN multiple marches target the same location THEN the system SHALL resolve them in arrival order to prevent conflicts
5. IF web dashboard is enabled THEN the system SHALL display moving army icons for real-time march visualization

### Requirement 13: NPC System and PvE Content

**User Story:** As a player, I want to fight AI-controlled NPCs of varying difficulty levels, so that I can earn resources and hero experience through PvE content when other players aren't available.

#### Acceptance Criteria

1. WHEN the map generates THEN the system SHALL spawn NPCs (Bandit Camps, Goblin Outposts, Dragon Lairs) at appropriate locations
2. WHEN players scout NPCs THEN the system SHALL display power level, troop composition, and potential rewards
3. WHEN players defeat NPCs THEN the system SHALL award resources (Food/Iron/Gold), Hero XP, and occasionally Hero Shards
4. WHEN NPCs are defeated THEN the system SHALL respawn them after 12 hours at the same location
5. WHEN new players start THEN the system SHALL spawn 5 weak Bandit Camps within 5 tiles of their city for tutorial purposes

### Requirement 14: Research and Technology Tree System

**User Story:** As a player, I want to research technologies that provide permanent improvements to my empire, so that I can customize my playstyle and gain strategic advantages through long-term planning.

#### Acceptance Criteria

1. WHEN players initiate research THEN the system SHALL start timers (1-20 hours) and consume Gold resources
2. WHEN research completes THEN the system SHALL apply permanent bonuses (troop training speed, resource production, march speed, combat power, hero XP, army capacity)
3. WHEN players view research THEN the system SHALL show 6 categories with 5 levels each (26 total upgrades)
4. WHEN research prerequisites are met THEN the system SHALL unlock higher tier research options
5. WHEN seasons reset THEN the system SHALL reset all research progress to zero

### Requirement 15: Daily Rewards and Quest System

**User Story:** As a player, I want to receive daily login bonuses and complete daily quests, so that I'm rewarded for consistent engagement and have clear daily objectives.

#### Acceptance Criteria

1. WHEN new players log in THEN the system SHALL provide escalating 7-day newbie bonuses (resources, Diamonds, Hero Shards)
2. WHEN players log in daily THEN the system SHALL grant ongoing daily rewards (1,000 Food, 500 Iron, 50 Diamonds)
3. WHEN players complete daily quests THEN the system SHALL award Diamonds (train troops, defeat NPCs, win Arena, upgrade buildings, gather resources)
4. WHEN players claim rewards THEN the system SHALL track progress and reset daily at 00:00 UTC
5. WHEN new players start THEN the system SHALL provide 24-hour instant building upgrades and guaranteed starter NPCs

### Requirement 16: Comprehensive Tutorial System

**User Story:** As a new player, I want to be guided through an interactive tutorial that teaches all core game mechanics, so that I can understand how to play effectively without external documentation.

#### Acceptance Criteria

1. WHEN players run `!begin` THEN the system SHALL start a 10-minute interactive tutorial covering faction selection, map navigation, building construction, troop training, combat, and guild systems
2. WHEN tutorial steps complete THEN the system SHALL provide immediate feedback and guide players to the next action
3. WHEN tutorial battles occur THEN the system SHALL use instant timers and guaranteed weak enemies for learning purposes
4. WHEN tutorial completes THEN the system SHALL leave players with a functional city (Farm, Mine, Barracks), trained troops, and basic resources
5. WHEN players need help later THEN the system SHALL provide comprehensive command summaries via `!help`

### Requirement 17: Seasonal Progression and Prestige System

**User Story:** As a player, I want to earn permanent rewards and recognition for my achievements that carry over between seasons, so that my progress has lasting meaning despite seasonal resets.

#### Acceptance Criteria

1. WHEN seasons end THEN the system SHALL award Prestige Points and Diamonds based on HQ level, Arena tier, Conquest participation, and land ownership
2. WHEN achievements are earned THEN the system SHALL unlock permanent cosmetic rewards (city skins, profile badges, guild banners)
3. WHEN seasons conclude THEN the system SHALL record Hall of Fame leaderboards for overall power, Arena legends, and Conquest champions
4. WHEN new seasons start THEN the system SHALL preserve Diamonds and cosmetic unlocks while resetting all other progress
5. WHEN end-of-season events occur THEN the system SHALL provide double rewards, mega Conquest events, and cooperative World Boss battles

### Requirement 18: Advanced Guild Features and Coordination

**User Story:** As a guild member, I want access to advanced coordination tools and shared objectives, so that my guild can work together effectively in competitive events and territory control.

#### Acceptance Criteria 

1. WHEN guilds are created THEN the system SHALL establish private channels, shared banks, and daily quest systems
2. WHEN guild rallies are initiated THEN the system SHALL allow up to 5 members to combine armies for joint attacks
3. WHEN guild daily quests are available THEN the system SHALL assign collective goals (defeat NPCs, train troops, win Arena battles) with shared rewards
4. WHEN new players reach HQ 5 THEN the system SHALL auto-post recruitment messages in #guild-recruitment for guild leaders to respond to
5. WHEN server launches THEN the system SHALL create three starter guilds (Cinema Legion, Otaku Alliance, Arcade Coalition) that anyone can join immediately

### Requirement 19: End-of-Season Events and Celebrations  

**User Story:** As a player, I want special events and bonuses during the final week of each season, so that there's excitement and urgency leading up to the seasonal reset.

#### Acceptance Criteria 

1. WHEN the final week begins THEN the system SHALL activate double Diamond rewards from all sources
2. WHEN end-of-season Conquest occurs THEN the system SHALL run events on both Friday and Saturday for maximum participation
3. WHEN XP boost weekends activate THEN the system SHALL provide 2x Hero XP from all battle sources
4. WHEN land sales occur THEN the system SHALL reduce all land parcel costs by 50% to encourage experimentation
5. WHEN the final Sunday arrives THEN the system SHALL spawn a cooperative World Boss that requires server-wide coordination to defeat

### Requirement 20: Comprehensive Command System and User Interface

**User Story:** As a player, I want access to intuitive commands that cover all game systems with clear feedback, so that I can efficiently manage my empire and participate in all activities.

#### Acceptance Criteria

1. WHEN players use core commands THEN the system SHALL provide immediate feedback for city management, map viewing, combat, and resource management
2. WHEN players use Arena commands THEN the system SHALL handle defense setup, opponent selection, battle initiation, and statistics tracking
3. WHEN players use guild commands THEN the system SHALL manage creation, joining, land purchases, rallies, and quest tracking
4. WHEN players use admin commands THEN the system SHALL allow server setup, game pausing, and global announcements
5. WHEN players need help THEN the system SHALL provide comprehensive command lists and usage examples via `!help`