# PopVerse Kingdoms - Complete Game Overview

## 🎮 Game Concept
A Discord-based strategy MMO where players build cities, collect heroes, train armies, and compete for territory control across three factions: **Cinema** 🎬, **Otaku** ⚔️, and **Arcade** 🎮.

**Getting started:** Use **`/begin`** to create your account and choose a faction. Use **`/help`** to see all commands by category (Getting Started, City, Combat, Heroes, Arena, Guild, Map, Conquest). Use **`/tutorial`** for a step-by-step guide and bonus rewards.

---

## 📋 Complete Feature List

### ✅ Core Systems (Implemented)

#### 1. **Player Onboarding** (`/begin`)
- Faction selection (Cinema, Otaku, Arcade)
- Spawn location assignment on 100x100 map
- Starter resources (5000 food, 2500 iron, 1000 gold, 500 diamonds)
- Starter hero based on faction
- 24-hour protection shield
- Tutorial system integration

#### 2. **City Management** (`/city`, `/build`)
- **Buildings** (7 types):
  - 🏛️ HQ (Level 1-25) - Unlocks features
  - 🌾 Farm (Level 1-20) - Food production
  - ⚒️ Mine (Level 1-20) - Iron production
  - ⚔️ Barracks (Level 1-20) - Train troops
  - 🏦 Vault (Level 1-20) - Protect 50% of resources
  - 🏥 Hospital (Level 1-20) - Heal wounded troops
  - 📚 Academy (Level 1-20) - Research upgrades
- **Building Slots**: 1-5 slots based on HQ level (1 at HQ1, 2 at HQ5, 3 at HQ10, 4 at HQ15, 5 at HQ20)
- **Upgrade System**: Progressive costs and times
- **Guild Help**: Members can reduce build time by 10 minutes each (max 5 helpers)
- **Guild Build Notification**: When a member uses `/build`, a message with a **Help Build** button is posted in the guild’s Discord channel (message only, no @role ping). Guild mates click once per build to help.

#### 3. **Resource System**
- **3 Resources**: Food 🌾, Iron ⚒️, Gold 💰
- **Premium Currency**: Diamonds 💎
- **Production**: Farms and Mines generate hourly
- **Protection**: Vault protects 50% from raids
- **Regeneration**: Passive resource regeneration over time

#### 4. **Military System** (`/train`, `/attack`, `/scout`)
- **4 Troop Tiers**: T1, T2, T3, T4 (increasing power)
- **Training**: Barracks level determines available tiers
- **Combat**: Real-time battles with casualties (dead/wounded)
- **Hospital**: Heal wounded troops
- **March System**: Troops travel across map (3-15 minutes)
- **Scouting**: Reveal enemy defenses before attacking

#### 5. **Hero System** (`/heroes`, `/hero`, `/loot`, `/gear`, `/forge`, `/salvage`)
- **Hero Collection**: 12 unique heroes across factions
- **Rarities**: Common ⚪, Rare 🔵, Epic 🟣, Legendary 🟡
- **Leveling**: Max level 50, gain XP from battles
- **Elements**: Fire 🔥, Water 💧, Wind 💨 (elemental advantages in combat)
- **Skills**: Unlock at levels 10, 20, 30, 40, 50
- **Hero Shards**: Collect 10 shards to unlock a hero
- **Gear System** (NEW):
  - 5 Equipment Slots: Head 🪖, Weapon ⚔️, Chest 🛡️, Boots 👢, Ring 💍
  - 4 Item Rarities: Common (60%), Rare (30%), Epic (8%), Legendary (2%)
  - Item Levels: 1-15 with upgrade costs (100g → 15,000g)
  - 8 Stat Types: Attack, Defense, HP, Speed, Crit Rate, Crit Damage, Accuracy, Resistance
  - Primary + Secondary Stats (1-4 based on rarity)
- **Loot**: Generate and earn gear from battles; equip via `/gear`
- **Salvage**: Break down unwanted items for materials via `/salvage`

#### 5b. **Forge & Crafting** (`/forge`, `/salvage`)
- **Forge**: Craft gear from materials (unlocks with HQ progression)
- **Commands**: `/forge status`, `/forge recipes`, `/forge materials`, `/forge craft [recipe]`, `/forge cancel [job_id]`
- **Materials**: Earned from salvaging items; used in recipes
- **Salvage** (`/salvage`): Break down equipped or stored items for materials (with confirmation)

#### 6. **Map & Territory** (`/map`)
- **100x100 Grid**: 10,000 tiles
- **3 Zones**:
  - Spawn Zone (70%) - Player cities
  - Resource Zone (20%) - Special resources
  - Temple Zone (10%) - High-value targets
- **Terrain Types**: Plains, Forest, Mountain, Resource nodes
- **NPCs**: Bandit Camps, Goblin Outposts, Dragon Lairs (762 total)
- **Land Parcels**: 124 special lands (Farms, Mines, Gold Mines, Forts)
- **Teleportation**: Move city with teleport scrolls via **`/teleport x y`** (consumes Teleport Scroll from shop)

#### 7. **PvE Combat** (NPC Battles)
- **3 NPC Types**:
  - Bandit Camps (Power: 500-2000) - 5% hero shard drop
  - Goblin Outposts (Power: 2000-5000) - 10% hero shard drop
  - Dragon Lairs (Power: 5000-10000) - 20% hero shard drop
- **Respawn**: 6 hours after defeat
- **Rewards**: Resources, hero shards, XP
- **Elemental Combat**: Hero elements affect damage

#### 8. **PvP Combat** (Player vs Player)
- **Attack System**: Send troops + hero to enemy city
- **Defense**: Automatic with stationed troops + hero
- **Loot**: Steal resources (vault protects 50%)
- **Protection**: 24-hour shield for new players
- **Battle Reports**: Detailed combat logs with casualties

#### 9. **Arena System** (`/arena`)
- **PvP Hero Battles**: 3v3 hero team fights
- **Rating System**: 1000 starting rating
- **6 Tiers**: Bronze, Silver, Gold, Platinum, Diamond, Legend
- **Attacks**: 5 free daily + token system (10 max, regen 1 per 2 hours)
- **Defense Team**: Set 3 heroes to defend automatically
- **Matchmaking**: Find opponents within ±200 rating
- **Rewards**: Diamonds, hero shards, rating points
- **Weekly Rewards**: Based on tier at week end
- **Leaderboard**: Top 10 rankings
- **Bot Opponents**: Fill matchmaking when needed (50% rewards)

#### 10. **Guild System** (`/guild`)
- **Creation**: 500 gold cost; creates a private Discord channel and optional Discord role for the guild
- **Max Members**: 50 per guild
- **Roles**: Leader 👑, Officer ⭐, Elite, Member 👤, Recruit (Leader can assign via `/guild setrole`)
- **Treasury**: Shared resources from contributions
- **Guild Lands**: Purchase up to 10 land parcels for bonuses
- **Land Bonuses**: Apply to all members (food/iron/gold production)
- **Invitations**: Leaders and Officers can invite players (new members join as Recruit)
- **Management**: Promote, demote, kick members; sync with Discord role on join/leave/kick
- **Search**: Find guilds by name/tag
- **Leaderboard**: Top guilds by member count
- **Guild Channel**: Build and rally notifications are posted as messages only (no @role mention)

#### 11. **Guild Features** (`/rally`, `/guildquests`)
- **Rally Attacks**: Coordinate group attacks on NPCs or players; notification posted to guild channel (message only, no @role). Members join via **Join Rally** button.
- **Conquest Rally**: Same for conquest control points; message posted to guild channel only.
- **Guild Quests**: Daily objectives for guild rewards
- **Guild Help**: Speed up building upgrades (Help Build button in guild channel)
- **Shared Benefits**: Land bonuses affect all members

#### 12. **Daily Systems** (`/daily`)
- **Login Rewards**: Daily resources + diamonds
- **Newbie Bonus**: 7 days of escalating rewards
- **Daily Quests**: 5 quests per day
  - Train 50 troops (30 💎)
  - Upgrade a building (40 💎)
  - Scout 3 locations (20 💎)
  - Defeat an NPC (50 💎)
  - Explore 5 map tiles (30 💎)
- **Quest Tracking**: Auto-progress tracking
- **Streak System**: Consecutive login bonuses

#### 13. **Research System** (`/research`)
- **6 Categories**: Military, Economy, Defense, etc.
- **5 Levels per Category**: Progressive unlocks
- **Time-Based**: Research takes 1-20 hours
- **Academy Required**: Must build Academy first
- **Permanent Bonuses**: Troop stats, production, etc.

#### 14. **Land System** (`/land`)
- **4 Land Types**:
  - 🌾 Farms (+20% food production)
  - ⛏️ Mines (+20% iron production)
  - 💰 Gold Mines (+15% gold production)
  - 🏰 Forts (+10% defense)
- **Ownership**: Players or guilds can own
- **Max Limits**: 3 per player, 10 per guild
- **Purchase**: Buy with gold from treasury/resources
- **Bonuses**: Stack with other bonuses

#### 15. **Shop System** (`/shop`)
- **5 Items**:
  - 📜 Teleport Scroll (100 💎) - Relocate city
  - ⚡ Resource Boost (50 💎) - +50% production for 1h
  - 🛡️ Peace Shield 8h (150 💎) - Protection from attacks
  - ⏩ Speed Up 1h (30 💎) - Reduce build/research time
  - 💊 Healing Salve (5000 gold) - Heal all wounded troops
- **Daily Limits**: Prevent abuse
- **Diamond Shop**: Premium currency purchases

#### 16. **Season System** (`/season`)
- **90-Day Seasons**: Competitive cycles
- **Season Rewards**: Based on performance
- **Leaderboards**: Track top players
- **Season Wrap-Up**: Summary at season end
- **Prestige Points**: Carry over between seasons

#### 17. **Prestige System** (`/prestige`)
- **Achievements**: 50+ achievements to complete
- **Prestige Points**: Earned from achievements
- **Cosmetics Shop**: Titles, badges, effects
- **Prestige Ranks**: Bronze → Silver → Gold → Platinum → Diamond
- **Leaderboard**: Top 20 prestige players
- **Permanent Rewards**: Carry across seasons

#### 18. **Conquest Events** (`/conquest`)
- **Weekly Events**: Friday at 8 PM
- **60-Minute Duration**: Intense battles
- **5 Control Points**: Capture and hold
- **Guild Coordination**: Rally system for groups; territory captured posts message to guild channel
- **Points System**: 1 point per minute of control
- **Rewards**: Based on contribution and placement

#### 19. **Activity Tracking** (`/activity`)
- **Activity Log**: Track all player actions
- **Resource Changes**: See gains/losses
- **Battle History**: Recent combat results
- **Quest Progress**: Daily quest tracking

#### 20. **Help & Tutorial** (`/help`, `/tutorial`)
- **Help** (`/help`): View all commands; optional category (Getting Started, City, Combat, Heroes, Arena, Guild, Map, Conquest) for focused guidance
- **Tutorial** (`/tutorial`): Step-by-step guide through game mechanics
- **Bonus Rewards**: Complete tutorial for extra resources

#### 21. **Command Reference** (Quick lookup)
| Command | Purpose |
|--------|--------|
| `/begin` | Start game, choose faction |
| `/help` | Commands and categories |
| `/ping` | Bot latency check |
| `/map` | View world map |
| `/city` | City overview |
| `/build` | Upgrade buildings |
| `/train` | Train troops |
| `/attack` | Attack player or NPC |
| `/scout` | Scout target |
| `/heroes` | Hero roster |
| `/hero` | Single hero details |
| `/loot` | Generate/earn gear |
| `/gear` | Equip / upgrade items |
| `/forge` | Craft (status, recipes, materials, craft, cancel) |
| `/salvage` | Break items for materials |
| `/daily` | Login rewards, quests |
| `/activity` | Activity log |
| `/tutorial` | Step-by-step guide |
| `/arena` | PvP hero battles |
| `/land` | Land parcels |
| `/guild` | Guild management |
| `/rally` | Start or join rally |
| `/guildquests` | Guild daily quests |
| `/research` | Research tree |
| `/shop` | Buy items (scrolls, boosts, etc.) |
| `/teleport` | Relocate city (uses scroll) |
| `/conquest` | Conquest event, rally |
| `/season` | Season info and rewards |
| `/prestige` | Achievements, prestige shop |

#### 22. **Web Dashboard** (Optional)
- **React Frontend**: Visual interface
- **Interactive Map**: Click and explore
- **Real-Time Updates**: WebSocket integration
- **Player Stats**: View profiles and stats
- **Leaderboards**: Web-based rankings
- **OAuth Login**: Discord authentication

---

## 🎯 Game Workflow

### New Player Journey

1. **Start** (`/begin`)
   - Choose faction
   - Get starter resources + hero
   - Spawn on map with 24h protection

2. **Build Foundation** (`/city`, `/build`)
   - Upgrade HQ to unlock features
   - Build Farm + Mine for resources
   - Build Barracks to train troops

3. **Grow Army** (`/train`)
   - Train T1 troops initially
   - Upgrade Barracks for higher tiers
   - Build Hospital to heal wounded

4. **First Combat** (`/attack`)
   - Scout nearby NPCs (`/scout`)
   - Attack Bandit Camps for loot
   - Gain hero XP and resources

5. **Hero Development** (`/heroes`, `/loot`, `/gear`, `/forge`, `/salvage`)
   - Level up starter hero
   - Collect hero shards from NPCs
   - Generate and equip gear; salvage unwanted items for materials
   - Craft new gear at the Forge; upgrade items with gold

6. **Join Community** (`/guild`)
   - Search for active guild
   - Join for bonuses and help
   - Participate in guild quests

7. **Competitive Play** (`/arena`, `/conquest`)
   - Battle other players in arena
   - Participate in weekend conquest
   - Climb leaderboards

8. **Daily Routine**
   - Claim daily rewards (`/daily`)
   - Complete daily quests
   - Collect resources
   - Train troops
   - Attack NPCs/players
   - Arena battles

### Mid-Game Loop

1. **Resource Management**
   - Upgrade resource buildings
   - Attack for loot
   - Contribute to guild treasury
   - Purchase land parcels

2. **Military Expansion**
   - Train higher tier troops
   - Upgrade hero levels
   - Collect and upgrade gear
   - Research military tech

3. **Territory Control**
   - Capture land parcels
   - Defend against raids
   - Coordinate guild rallies
   - Participate in conquest

4. **Hero & Gear**
   - Farm hero shards from NPCs; unlock new heroes
   - Build arena teams; optimize gear loadouts
   - Salvage items for materials; craft gear at the Forge

### End-Game Content

1. **Competitive PvP**
   - High-tier arena battles
   - Guild vs Guild warfare
   - Conquest dominance
   - Leaderboard climbing

2. **Optimization**
   - Max-level heroes with legendary gear
   - Perfect stat rolls on items
   - Complete research trees
   - Maximize land bonuses

3. **Season Competition**
   - Compete for season rewards
   - Earn prestige points
   - Unlock cosmetics
   - Prepare for next season

---

## 🔧 Technical Architecture

### Database (PostgreSQL)
- **Players**: User accounts and resources
- **Heroes**: Hero collection and stats
- **Hero Items**: Gear system (NEW)
- **Buildings**: City structures
- **Troops**: Army composition
- **Guilds**: Guild data and membership
- **Battles**: Combat history
- **NPCs**: Enemy spawns and respawns
- **Map Tiles**: World grid
- **Land Parcels**: Special territories
- **Daily Quests**: Quest progress
- **Arena**: PvP stats and defense teams
- **Research**: Tech tree progress
- **Seasons**: Competitive cycles
- **Crafting**: Forge jobs, materials, recipes

### Cache (Redis)
- Player data caching
- Map image caching
- Session management
- Rate limiting

### Services
- **CombatService**: Battle resolution
- **NpcService**: NPC spawning and respawning
- **ArenaService**: PvP matchmaking and battles
- **GuildService**: Guild management
- **GuildDiscordService**: Discord guild channel/role creation, announcements (build/rally messages)
- **LandService**: Territory control
- **RallyService**: Guild rally creation and participation
- **SeasonService**: Season management
- **ResearchService**: Tech tree
- **DailyQuestService**: Quest tracking
- **ItemService**: Gear and item management
- **CraftingService**: Forge crafting, materials, recipes, salvage
- **PrestigeService**: Achievements and prestige points
- **ConquestService**: Conquest events, control points, rallies
- **GuildQuestService**: Guild daily quests
- **TutorialService**: Tutorial steps and progress
- **ActivityLogService**: Action tracking

---



## 📊 Current Game Balance

### Resources
- **Starting**: 5000 food, 2500 iron, 1000 gold, 500 diamonds
- **Production**: Farms/Mines generate hourly
- **Costs**: Buildings scale exponentially
- **Loot**: NPCs drop 100-1000 resources

### Combat Power
- **T1 Troops**: 10 power each
- **T2 Troops**: 30 power each
- **T3 Troops**: 100 power each
- **T4 Troops**: 300 power each
- **Heroes**: 200-1000+ power based on level/gear

### Progression Time
- **HQ 1→10**: ~2-4 hours
- **HQ 10→20**: ~1-2 days
- **HQ 20→25**: ~3-5 days
- **Max Hero**: ~1-2 weeks of active play
- **Full Gear Set**: should take days/weeks

### Key Limits (quick reference)
- **Rally**: Up to 5 participants per rally
- **Build help**: 5 helpers per construction (10 min each)
- **Arena tokens**: 10 max, 1 per 2 hours
- **Land**: 3 per player, 10 per guild
- **Guild**: 50 members max
- **Building slots**: 1–5 based on HQ level

---

## 🎮 Player Retention Hooks

1. **Daily Login**: Rewards + quests
2. **Resource Collection**: Check in for production
3. **Building Timers**: Come back when upgrades finish
4. **Arena Tokens**: Regenerate every 2 hours
5. **NPC Respawns**: Check for new targets every 6 hours
6. **Guild Activities**: Social pressure to participate
7. **Conquest Events**: Weekly scheduled events
8. **Season Competition**: Long-term goals
9. **Hero Collection**: Gacha-style collection
10. **Gear Grinding**: Farm for perfect items; Forge and salvage loop

---
