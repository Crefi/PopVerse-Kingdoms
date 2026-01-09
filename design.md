# PopVerse Kingdoms – MVP Design v8.0

## 1. Game Overview

**PopVerse Kingdoms** is a streamlined text-based strategy game for Discord communities (50-100 players). Players pick a faction—**Cinema** (Fire), **Otaku** (Wind), or **Arcade** (Water)—then build a city, summon heroes, and battle for territory. Seasons last 3 months with weekly Conquest events and **full wipes** (only Diamonds persist).

* **Genre:** Light 4X Strategy / Community Game
* **Platform:** Discord Bot + Optional Web Dashboard
* **Economy:** F2P. Diamonds earned via gameplay (Arena, Conquest, dailies). Optional cosmetic packs.
* **Cycle:** 3-Month Seasons (Fresh start every season—only Diamonds carry over!)

---

## 2. Server Setup

### 2.1. Admin Setup
**Command:** `!setup start`

Bot creates these channels automatically:
* `#game-news` – War declarations, Conquest announcements
* `#city-hall` – Build/Upgrade commands
* `#battlefield` – Attack/Scout commands
* `#arena` – PvP duels

**Map Size:** Fixed 100x100 grid (10,000 tiles). Good for 50-100 players.

### 2.2. Map Generation
* **Spawn Zone (70%):** Safe plains. New players get 24h shield.
* **Resource Zone (20%):** Higher yields, but no shields.
* **Center (10%):** The Temple (endgame objective).
* **Obstacles:** Random mountains/lakes create chokepoints.

### 2.3. Map Viewing (Discord + Optional Web Dashboard)

#### Discord Map (Primary)
* **Command:** `!map`
* Shows 15x15 grid around your city with emojis:
  - 🏰 Your City (1 tile)
  - 🔥 Cinema City
  - 💨 Otaku City
  - 💧 Arcade City
  - ⛰️ Mountain
  - 🌊 Lake
  - 🌳 Resource Node
  - 🟩 Farmstead Land
  - 🟫 Mining Camp Land
  - 🟨 Trade Hub Land
  - 🟥 Strategic Fort Land
  - ❓ Unexplored (Fog of War)
* **Pan:** `!map north`, `!map south`, `!map east`, `!map west`
* **Search:** `!map player [Name]` or `!map coords [X,Y]`

#### Web Dashboard (Optional - For Strategy Nerds)
* **Access:** `!map link` → Bot DMs you a unique URL
* **Features:**
  - Full 100x100 zoomable map
  - Real-time march tracking (see your armies moving)
  - Land ownership overlay (see who owns which parcels)
  - Click any tile for instant info
  - Mobile-friendly
* **Note:** Completely optional! Everything can be done in Discord.

---

## 3. The 3 Core Modes

### 3.1. Main Map (Territory Control)
* **Objective:** Expand, gather resources, attack enemies.
* **Marches:** Real-time (3-15 minutes depending on distance).
* **Combat:** Auto-resolved. Losers lose troops; winners capture resources.

### 3.2. The Arena (Offline PvP with RSL-Style System)

**Format:** 3 Heroes vs 3 Heroes (auto-battle, asynchronous PvP)

#### How It Works
The Arena is an offline PvP mode where you attack other players' defense teams that are controlled by AI. You set up two separate teams:
- **Attack Team:** The 3 heroes you use when you initiate battles
- **Defense Team:** The 3 heroes that defend your rank when others attack you (AI-controlled)

#### Daily Attack Tokens
* **Starting Tokens:** 10 tokens per day (reset at 00:00 UTC)
* **Max Storage:** 10 tokens (can't exceed this)
* **Token Regeneration:** +1 token every 2 hours (so if you use 5, you'll slowly regenerate up to 10)
* **Cost:** 1 token per attack attempt
* **Free Daily Matches:** First 5 matches each day are FREE (don't consume tokens). After that, each match costs 1 token.

**Command:** `!arena tokens` (check your current tokens)

#### Bot Opponents (Early Game Solution)
During the first week of a new season or when player count is low (<20 active Arena players), the bot automatically generates **AI opponents** to fill matchmaking pools:

**Bot Characteristics:**
- Named after famous game/movie characters (e.g., "BotMasterChief", "BotGandalf", "BotMegaman")
- Have faction-appropriate heroes at various power levels
- Clearly marked with [BOT] tag in opponent list
- Winning against bots gives **50% normal rewards** (to prevent farming)
- Bots disappear once 20+ real players are active in Arena

**Example Bot Opponent:**
```
3. BotTerminator [BOT] [Gold III] - Power: 8,500 - Defense: T-800, Rambo, Dutch
```

#### Setting Up Your Teams

**Defense Team (Set Once, Update Anytime):**
* **Command:** `!arena defense [Hero1] [Hero2] [Hero3]`
* Example: `!arena defense "John Wick" "Goku" "Mario"`
* Your defense team is shown to other players when they search for opponents
* **Important:** Defense teams fight on autopilot (AI-controlled). Choose heroes with reliable skills.

**Attack Team (Choose Per Battle):**
* When you attack, you select 3 heroes from your roster each time
* This allows you to counter specific enemy teams

#### Finding Opponents

**Command:** `!arena attack`

The bot shows you **5 potential opponents** (mix of real players and bots if needed) with this info:
```
🏟️ ARENA OPPONENTS

1. CinemaKing47 [Gold III] - Power: 8,500 - Defense: T-800, Neo, Rambo
2. BotSaitama [BOT] [Gold II] - Power: 8,200 - Defense: Saitama, Goku, Naruto
3. ArcadeLegend [Gold III] - Power: 8,800 - Defense: Kyo, Liu Kang, Ryu
4. FireStorm99 [Gold IV] - Power: 9,100 - Defense: Wolverine, John Wick, Dutch
5. WindRunner [Gold II] - Power: 8,000 - Defense: Lelouch, Edward Elric, Ichigo

Available Tokens: 7/10 | Free Matches Today: 2/5 remaining
```

**Actions:**
* `!arena fight [Number]` - Attack the chosen opponent (e.g., `!arena fight 2`)
* `!arena refresh` - Get 5 new opponents (cooldown: 15 minutes OR spend 50 Diamonds to skip cooldown)

**Matchmaking:** The bot shows you opponents within ±200 Arena Points of your current rank (so you face similar-strength players).

#### Battle Resolution
Once you choose an opponent and your 3 attack heroes:
1. Battle auto-resolves using the combat formula (hero skills, troop power, elemental bonuses)
2. **You receive a Battle Report** showing:
   - Turn order (which heroes acted first based on speed)
   - Skill activations (e.g., "Goku used First Strike!")
   - Final result: Victory or Defeat
3. **Rewards/Penalties:**
   - **Win vs Real Player:** +20 to +40 Arena Points (more if opponent is higher ranked), Hero XP, 10-30 Diamonds
   - **Win vs Bot:** +10 to +20 Arena Points, Hero XP, 5-15 Diamonds (50% normal rewards)
   - **Loss:** -10 to -20 Arena Points, no rewards

#### Arena Points & Ranking System

Arena Points determine your Tier and Rank. Climb the ladder by winning battles (both on offense and by successfully defending when others attack you).

| Tier | Points Required | Weekly Reward |
|------|-----------------|---------------|
| **Bronze IV** | 0-299 | 50 Diamonds |
| **Bronze III** | 300-599 | 100 Diamonds |
| **Bronze II** | 600-899 | 150 Diamonds |
| **Bronze I** | 900-1,199 | 200 Diamonds |
| **Silver IV** | 1,200-1,499 | 300 Diamonds |
| **Silver III** | 1,500-1,799 | 400 Diamonds |
| **Silver II** | 1,800-2,099 | 500 Diamonds |
| **Silver I** | 2,100-2,399 | 600 Diamonds |
| **Gold IV** | 2,400-2,799 | 800 Diamonds + 1 Epic Hero Shard |
| **Gold III** | 2,800-3,199 | 1,000 Diamonds + 1 Epic Hero Shard |
| **Gold II** | 3,200-3,699 | 1,200 Diamonds + 2 Epic Hero Shards |
| **Gold I** | 3,700-4,299 | 1,500 Diamonds + 2 Epic Hero Shards |
| **Legend** | 4,300+ | 2,000 Diamonds + 1 Legendary Hero Shard + "Legend" Badge |

**Promotion/Demotion:** Gaining or losing points can promote or demote you to adjacent tiers. For example, earning enough points in Silver I promotes you to Gold IV.

#### Arena Leaderboard

**Command:** `!arena leaderboard`

Shows the **Top 100 players globally** ranked by Arena Points. Example:
```
🏆 POPVERSE KINGDOMS ARENA LEADERBOARD 🏆
Rank 1: CinemaGod (Legend) - 5,230 Points - T-800 | Terminator | Ripley
Rank 2: SaitamaMain (Legend) - 5,100 Points - Saitama | Goku | Madara
Rank 3: ArcadeKing (Legend) - 4,950 Points - Kyo | Terry Bogard | Liu Kang
...
Rank 47: YOU (Gold II) - 3,450 Points - John Wick | Mario | Naruto
...
Rank 100: NewbSlayer (Gold IV) - 2,600 Points
```

**Season Reset:** At the end of each 3-month season, Arena Points reset, but players keep their weekly rewards and any Diamonds earned.

#### Defense Log

**Command:** `!arena defense log`

See the last 10 times your defense was attacked:
```
📋 DEFENSE HISTORY
1. ❌ Lost vs OtakuMaster22 (Gold II) - Your Defense: John Wick, Mario, Naruto
2. ✅ Won vs FireStorm99 (Gold III) - Your Defense: John Wick, Mario, Naruto
3. ❌ Lost vs CinemaKing47 (Legend) - Your Defense: John Wick, Mario, Naruto
...
```

This helps you adjust your defense team if you're losing too much.

#### Arena Strategy Tips

**Offense Tips:**
- Speed is crucial—heroes with march speed bonuses or "First Strike" skills act before enemies
- Counter enemy factions (bring Water heroes vs Fire enemies for +25% damage)
- Target "squishy" defenses (high attack, low defense teams)
- **Refresh smartly:** If all 5 opponents look unbeatable, refresh to find easier targets
- **Use your 5 free matches wisely:** Scout strong opponents with free matches before committing tokens

**Defense Tips:**
- Your defense team doesn't need to win every fight—just make attackers think twice
- Use tanky heroes (Arcade faction with high defense) to stall
- Mix factions to avoid being hard-countered (don't put 3 Fire heroes together)
- Some players use weak defenses to drop rank for easier farming, then strengthen defense before weekly reset

#### Weekly Reset

Every **Sunday at 23:59 UTC**, Arena rewards are distributed based on your current tier:
- Everyone receives Diamonds based on their tier (see table above)
- Top 10 on the leaderboard get bonus rewards (extra Legendary Hero Shards, exclusive titles)
- **Points don't reset weekly**—only at the end of the 3-month season

---

### 3.3. Conquest (Weekly Event with Optimized Flow)

* **When:** Every Saturday, 8 PM server time, 1 hour duration.
* **Objective:** Capture and hold 5 Control Points on the map.
* **Scoring:** 1 point per minute held.
* **Troops:** Don't die permanently—they respawn after 5min if defeated.
* **Rewards:** Top 10 players get Diamonds + rare Hero shards + Land Vouchers.

#### Control Point Mechanics (Anti-Lag System)

**Location:** Control Points spawn at strategic locations (near chokepoints, center of map, resource-rich areas). Their exact locations are announced 1 hour before the event starts.

**Capture Cooldown:** 
- Once you attack a Control Point, you cannot attack it again for **5 minutes** (prevents spam)
- Other players can still attack it during your cooldown
- Cooldown applies per-player, per-Control Point (you can attack Point A, then immediately attack Point B)

**Battle Queue System:**
When multiple players attack the same Control Point simultaneously:
1. Attacks are queued in order of arrival (first command received = first to fight)
2. Each battle resolves one at a time (takes ~10 seconds to auto-resolve)
3. Winner becomes the new controller, next attacker in queue fights them
4. Queue is displayed: "⏳ Waiting: PlayerX, PlayerY, PlayerZ (3 in queue)"

**Example Queue Flow:**
```
8:00 PM - Control Point A is neutral
8:01 PM - PlayerA attacks → Captures Point A (now earning 1 point/min)
8:02 PM - PlayerB attacks → Queue: PlayerB vs PlayerA
  Result: PlayerB wins, now controls Point A
8:02 PM - PlayerC attacks → Queue: PlayerC vs PlayerB
  Result: PlayerB defends successfully, still controls Point A
8:03 PM - PlayerD attacks → Queue: PlayerD vs PlayerB
  (And so on...)
```

#### Live Event Feed

During Conquest, a dedicated `#conquest-live` channel auto-posts real-time updates:

```
🔥 CinemaKing47 captured Control Point A! (Fire faction now holds 2/5 points)
💨 OtakuMaster22 is attacking Control Point C... (Queue: 2 waiting)
💧 ArcadeLegend defended Control Point B successfully!
⚔️ Control Point D is under siege! 3 players in queue!
🏆 LEADERBOARD UPDATE: CinemaKing47 (42 pts) | OtakuMaster22 (38 pts) | ArcadeLegend (35 pts)
```

**Why This Works:**
- Players don't need to spam `!conquest status` commands (reduces bot load)
- Everyone sees what's happening in real-time (builds hype)
- Clear feedback when your attack is queued

#### Guild Coordination

Guilds can coordinate to dominate Conquest:
- **Guild Chat:** Use your private guild channel to call targets ("Everyone attack Point C at 8:15!")
- **Shared Scoring:** Guild leaderboard tracks total points earned by all members
- **Guild Rewards:** Top 3 guilds split bonus rewards (500 Diamonds per member + Land Voucher for guild treasury)

#### Rewards

**Individual Rewards (Top 10):**
1st: 500 Diamonds + 2 Legendary Hero Shards + 1 Land Voucher
2nd: 400 Diamonds + 1 Legendary Hero Shard + 1 Land Voucher
3rd: 300 Diamonds + 1 Legendary Hero Shard + 1 Land Voucher
4th-10th: 200 Diamonds + 1 Epic Hero Shard

**Participation Rewards (Everyone who earns 10+ points):**
100 Diamonds + 1 Rare Hero Shard

**Guild Rewards (Top 3 Guilds by Total Score):**
1st: 500 Diamonds per member + 3 Land Vouchers (guild treasury)
2nd: 300 Diamonds per member + 2 Land Vouchers
3rd: 200 Diamonds per member + 1 Land Voucher

#### Strategy Tips

- **Pick Your Battles:** Don't fight over heavily contested points if the queue is 5+ deep. Find a less defended point.
- **Speed Matters:** Otaku faction's +15% march speed means you can respond to threats faster.
- **Defensive Play:** Control 1-2 points and defend them aggressively rather than spreading thin.
- **Last Minute Rush:** Many players wait until the final 10 minutes to make their move (less time for others to steal points).

---

## 4. Resources (Simplified to 3)

| Resource | Use | How to Get |
|----------|-----|------------|
| **Food** | Train troops, heal wounded | Farms (auto-produce), Resource Nodes |
| **Iron** | Upgrade buildings, craft gear | Mines (auto-produce), Resource Nodes |
| **Gold** | Research, speed-ups | Taxes (auto-produce), defeating NPCs |

* **Auto-Production:** Buildings produce every hour (no need to manually collect).
* **Storage Cap:** Vault protects 50% of resources from raids.

---

## 5. Buildings (Keep It Simple)

| Building | Purpose | Max Level |
|----------|---------|-----------|
| **HQ** | Unlock features | 25 |
| **Barracks** | Train troops | 20 |
| **Farm** | Produce Food | 20 |
| **Mine** | Produce Iron | 20 |
| **Market** | Generate Gold | 20 |
| **Vault** | Protect resources | 20 |
| **Hospital** | Heal wounded troops | 20 |

**Command:** `!build [Building]` or `!upgrade [Building]`

**Build Times:**
* Levels 1-5: Instant to 5 minutes
* Levels 6-10: 10-45 minutes
* Levels 11-15: 1-4 hours
* Levels 16-20: 4-12 hours
* Levels 21-25: 12-24 hours (HQ only)

**Help Button:** Guildmates can speed up builds by 10 minutes each (max 5 helpers).

---

## 5.1. Land Parcels (Territory Ownership)

### How Lands Work
The map is divided into **Land Parcels**—pre-defined zones scattered across the 100x100 grid. These lands exist independently of players and can be purchased for bonuses.

**Key Concept:** Your HQ (city) is always 1 tile and can be placed anywhere, even if you don't own land. Owning land gives you bonuses and control over that area.

### Land Types & Sizes

| Land Type | Size | Bonus | Cost | Spawn Rate |
|-----------|------|-------|------|------------|
| **Farmstead** | 4x4 (16 tiles) | +15% Food production | 8,000 Food, 3,000 Iron | Common (40% of lands) |
| **Mining Camp** | 4x4 (16 tiles) | +15% Iron production | 3,000 Food, 8,000 Iron | Common (40% of lands) |
| **Trade Hub** | 5x5 (25 tiles) | +20% Gold production | 10,000 Food, 10,000 Iron | Uncommon (15% of lands) |
| **Strategic Fort** | 6x6 (36 tiles) | +10% Troop Defense when inside this land | 20,000 Food, 15,000 Iron | Rare (5% of lands) |

**Total Lands on Map:** ~150 parcels scattered randomly (leaves ~8,500 tiles as "neutral ground").

### Purchasing Land

**Command:** `!land buy [X,Y]`
* **X,Y** refers to any tile within the land parcel.
* **Visibility:** Use `!map` to see land borders (shown as colored outlines: 🟩 Farmstead, 🟫 Mining Camp, 🟨 Trade Hub, 🟥 Strategic Fort).
* **Ownership:** Once purchased, the land shows your name/faction color on the map.
* **Guild Ownership (Optional):** Guilds can pool resources to buy lands. Use `!guild land buy [X,Y]` to purchase as a guild. All guild members get the bonus.

### Land Ownership Limits (CLARIFIED)

**Individual Players:**
- **Maximum 3 lands** per player, regardless of whether they're in a guild or not
- Example: If you own 3 personal lands, you cannot buy more even if your guild owns 0 lands
- If you're in a guild that owns lands, you still get those bonuses AND can own your personal 3 lands (separate pools)

**Guilds:**
- **Maximum 10 lands** per guild (shared among all members)
- Guild lands are separate from personal lands
- All guild members receive the bonuses from guild-owned lands

**Example Scenario:**
- Player "CinemaKing" owns 3 personal lands (2 Farmsteads + 1 Mining Camp)
- CinemaKing joins "Fire Warriors" guild which owns 5 lands (1 Trade Hub + 4 Strategic Forts)
- **Total bonuses CinemaKing receives:**
  - +30% Food (from 2 personal Farmsteads)
  - +15% Iron (from 1 personal Mining Camp)
  - +20% Gold (from guild's Trade Hub)
  - +40% Defense in 4 specific Strategic Fort locations (from guild's Forts)

### Land Rules

1. **One Owner:** Only one player (or guild) can own a land parcel at a time.
2. **Your HQ Doesn't Need to Be on Land:** You can place your city anywhere. Land bonuses apply regardless of where your HQ is.
3. **Conquest:** To take someone's land, you must defeat them in a siege (attack their HQ). Winner can choose to claim one of the loser's lands for free.
4. **Selling:** Use `!land sell [X,Y]` to get back 50% of the purchase cost.
5. **Dynamic Spawning:** If >70% of lands are owned, the bot automatically spawns 10 new random land parcels each week.
6. **Land Vouchers:** Winning Conquest events grants "Land Vouchers" (free land claims that bypass resource costs—can exceed the 3-land cap by +1).

### Land Benefits

**Bonuses Apply Globally:** If you own a Farmstead, your Farm buildings produce +15% Food even if your city is on the other side of the map.

**Strategic Control:** Owning a Strategic Fort near a chokepoint (mountain pass) gives your troops +10% defense when fighting inside that land's borders.

**Resource Nodes:** Lands often contain resource nodes (🌳). Only the land owner can gather from nodes within their land.

### Visual Example on Map

```
Map Coordinates (50, 50) - (55, 55):

❓ ❓ ❓ ❓ ❓ ❓
❓ 🟩🟩🟩🟩 ❓  ← Farmstead (4x4) owned by Player A
❓ 🟩🟩🟩🟩 ❓
❓ 🟩🟩🟩🟩 ❓
❓ 🟩🟩🟩🟩 ❓
❓ ❓ 🏰 ❓ ❓ ❓  ← Player B's HQ (not on owned land, no bonus yet)
```

**Player A** owns the Farmstead and gets +15% Food production.  
**Player B** doesn't own land yet but can still build and fight normally.

### Why This System Works

- **Flexible Placement:** Your city isn't tied to land ownership. You can spawn anywhere and buy land later.
- **Strategic Depth:** Valuable lands near the center or resource-rich areas become contested.
- **Guild Cooperation:** Guilds can control key territories and share bonuses with all members.
- **Simple Rules:** Buy land → Get bonus. Lose a war → Lose land. Easy to understand.
- **No Double-Dipping Exploitation:** 3-land personal cap applies to everyone, guild lands are bonus on top.

---

## 6. Troops (Simple Tiers)

| Tier | Unlock | Training Cost | Training Time | Power |
|------|--------|---------------|---------------|-------|
| **T1** | HQ 1 | 50 Food, 20 Iron | 30 seconds each | 10 |
| **T2** | HQ 10 | 150 Food, 80 Iron | 2 minutes each | 30 |
| **T3** | HQ 18 | 400 Food, 200 Iron | 5 minutes each | 100 |
| **T4** | HQ 25 | 1,000 Food, 500 Iron | 15 minutes each | 300 |

**Command:** `!train t1 [Quantity]`

**Max Army Size:** 500 troops per march (increases with Barracks level).

---

## 7. Heroes (4 Per Faction)

### 7.1. Hero Roster

#### Cinema (Fire) – High Attack
| Rarity | Hero | Skill |
|--------|------|-------|
| Common | **John McClane** | +10% Attack to Fire troops |
| Rare | **Jason Bourne** | 20% chance to deal double damage |
| Epic | **John Wick** | AoE attack hits 3 enemies |
| Legendary | **T-800 Terminator** | Reduces all incoming damage by 30% |

#### Otaku (Wind) – High Speed
| Rarity | Hero | Skill |
|--------|------|-------|
| Common | **Naruto Uzumaki** | +20% March Speed |
| Rare | **Edward Elric** | +10% Scout Range |
| Epic | **Son Goku** | First strike (attacks before enemy) |
| Legendary | **Saitama** | Instantly defeats one enemy troop unit |

#### Arcade (Water) – High Defense
| Rarity | Hero | Skill |
|--------|------|-------|
| Common | **Mario** | +15% Defense |
| Rare | **Ryu** | Counterattack: reflects 10% of damage |
| Epic | **Liu Kang** | Heals 5% of troops after each battle |
| Legendary | **Kyo Kusanagi** | Immune to first attack |

### 7.2. How to Get Heroes
* **Starter:** Pick your faction, get the Common hero for free.
* **Summon:** Use Diamonds to pull random heroes (higher chance for your faction).
  - 100 Diamonds = 1 Summon
  - 900 Diamonds = 10 Summons (1 guaranteed Rare+)
* **Shards:** Defeat NPCs or Conquest rewards drop Hero Shards (collect 10 to unlock).

### 7.3. Hero Leveling
* **Max Level:** 50
* **XP Sources:** Arena battles, defeating NPCs, successful raids.
* **Level Milestones:**
  - Level 10: Unlock skill upgrade slot
  - Level 20: +25% base stats
  - Level 30: Unlock second skill upgrade slot
  - Level 40: +50% base stats
  - Level 50: Hero reaches full power
* **Command:** Heroes level automatically—no manual input needed.

### 7.4. Hero Gear (Optional)
* **Slots:** Weapon, Armor
* **Crafting:** Use Iron at HQ Level 10+.
* **Effect:** +10% to +30% stats depending on gear rarity.

---

## 8. Combat System (Keep It Simple)

### 8.1. Elemental Rock-Paper-Scissors
* **Fire (Cinema)** beats **Wind (Otaku)** → +25% damage
* **Wind (Otaku)** beats **Water (Arcade)** → +25% damage
* **Water (Arcade)** beats **Fire (Cinema)** → +25% damage

### 8.2. Power Calculation
**Total Power = (Troop Count × Troop Tier Power) + Hero Bonus + Terrain Bonus**

Example:
* 100 T2 troops (30 power each) = 3,000 base power
* John Wick (Epic, Level 20) adds +500 power
* Fighting inside owned Strategic Fort = +10% defense (+350 power)
* **Total:** 3,850 power

### 8.3. Battle Resolution

#### Step 1: Speed Check (Turn Order)
- Heroes with higher speed act first
- **Otaku faction bonus:** +15% march speed = faster first strikes in combat
- If Hero A has "First Strike" skill, they attack before anyone else regardless of speed

#### Step 2: Apply Elemental Advantage
- If Fire attacks Wind → Fire gets +25% power boost
- If both sides have elemental advantage (e.g., mixed faction armies), they cancel out

#### Step 3: Hero Skills Trigger
Active skills fire during battle:
- **John Wick (Epic):** AoE attack hits 3 enemy units
- **Goku (Epic):** First Strike (always attacks first, ignoring speed)
- **Terminator (Legendary):** Reduces all incoming damage by 30%
- **Kyo (Legendary):** Immune to first attack

Passive skills apply throughout:
- **John McClane (Common):** +10% Attack to Fire troops
- **Mario (Common):** +15% Defense
- **Liu Kang (Epic):** Heals 5% of troops after each battle

#### Step 4: Terrain Bonuses
- **Strategic Forts:** Defender gets +10% Defense when fighting inside their owned fort
- **Mountain Chokepoints:** Defender gets +5% Defense (narrow paths favor defenders)

#### Step 5: Damage Calculation
**Attacker Damage = Attacker Power × (1 - Defender Defense / (Defender Defense + 100)) × RPS Multiplier × Terrain Multiplier**

**Critical Hits:** 10% chance to deal **2x damage** on each attack phase (adds excitement to close battles)

#### Step 6: Calculate Losses
- **Winner loses:** 10-30% of troops (depends on power difference)
  - <10% power advantage: Lose 25-30% troops
  - 10-30% advantage: Lose 15-25% troops
  - >30% advantage: Lose 10-15% troops
- **Loser loses:** 50-80% of troops (heavier casualties)
  - Close battle (within 10%): Lose 50-60% troops
  - Decisive loss (>30% gap): Lose 70-80% troops
- **Hospital System:** Wounded troops go to Hospital (can be healed with Food)
  - 50% of lost troops go to Hospital (can be revived)
  - 50% are permanently dead (need to retrain)

**Command:** `!attack [X,Y] [Hero] [Troop Count]`

**Battle Report:** Sent via DM with full breakdown showing:
- Turn order and speed calculations
- Elemental advantages applied
- Critical hits landed
- Hero skill activations
- Final casualties and loot

---

### 8.4. Combat Example (Full Breakdown)

**Scenario:** CinemaKing47 (Fire) attacks OtakuMaster22 (Wind)

**Attacker (CinemaKing47):**
- 150 T2 Troops (30 power each = 4,500)
- Hero: John Wick, Level 25 (+600 power)
- Cinema Faction: +10% Attack
- **Total Power:** 5,100 × 1.10 = **5,610**

**Defender (OtakuMaster22):**
- 130 T2 Troops (30 power each = 3,900)
- Hero: Goku, Level 22 (+550 power)
- Otaku Faction: +15% March Speed (acts first)
- Fighting inside owned Strategic Fort: +10% Defense
- **Total Power:** 4,450 × 1.10 = **4,895**

**Battle Resolution:**

**Turn 1:** Goku (Otaku) acts first due to speed bonus
- Skill: "First Strike" activates → Deals 800 damage before CinemaKing can respond
- CinemaKing's power reduced to 4,810

**Turn 2:** Elemental Advantage Check
- Fire beats Wind → CinemaKing gets +25% damage (4,810 × 1.25 = 6,012 effective power)

**Turn 3:** John Wick's AoE Skill Triggers
- Hits 3 enemy troop units → 450 damage
- OtakuMaster's power reduced to 4,445

**Turn 4:** Critical Hit Roll
- CinemaKing rolls critical! 2x damage this phase
- Deals 1,200 damage instead of 600

**Final Power:** CinemaKing 6,012 vs OtakuMaster 3,245

**Result:** ✅ **CINEMAKING47 WINS!**

**Casualties:**
- **Winner (CinemaKing):** Lost 35 T2 troops (23% casualties - moderate due to 20%+ power advantage)
  - 18 dead permanently, 17 wounded (Hospital)
- **Loser (OtakuMaster):** Lost 85 T2 troops (65% casualties)
  - 43 dead permanently, 42 wounded (Hospital)

**Loot:** CinemaKing captures 20% of OtakuMaster's stored resources (800 Food, 400 Iron)

---

## 9. Factions (Pick One at Start)

| Faction | Element | Passive Bonus | Lore |
|---------|---------|---------------|------|
| **Cinema** | Fire | +10% Attack to all armies | Born from explosive blockbusters and cinematic legends. Raw power and destruction. |
| **Otaku** | Wind | +15% March Speed | Swift heroes from anime realms. Speed and precision. |
| **Arcade** | Water | +10% Defense | Pixel champions from arcade cabinets. Endurance and strategy. |

**Command:** `!begin` → Bot asks: "Pick your faction: Cinema, Otaku, or Arcade?"

**Note:** Choice is permanent for the season.

---

## 10. Guilds (Clans/Alliances)

### 10.1. Creating/Joining
* **Command:** `!guild create [Name]` (Costs **500 Gold** - affordable in first few hours of gameplay)
* **Command:** `!guild join [Name]`
* **Max Size:** 20 members

**Why 500 Gold?**
- New players earn ~200 Gold from tutorial + starter NPCs
- Another 300 Gold from 1-2 hours of Market production + NPC farming
- **Result:** Anyone can create a guild by the end of Day 1

### 10.2. Guild Features
* **Private Channel:** Auto-created for coordination (e.g., `#guild-fire-warriors`).
* **Guild Rallies:** Attack together (combine armies).
  - **Command:** `!rally start [X,Y]` → Guildmates have 10 minutes to join with `!rally join`.
  - Up to 5 players can join a rally (combined armies fight as one)
* **Help Buttons:** Speed up each other's builds (each helper = 10 min reduction, max 5 helpers).
* **Guild Wars:** During Conquest, guild with most combined points wins bonus rewards.
* **Guild Lands:** Guilds can own up to 10 land parcels (all members get bonuses).
* **Guild Bank:** Members can donate resources to a shared treasury (used for guild land purchases).

### 10.3. Guild Recruitment System

**Auto-Recruitment Post:**
When a player reaches HQ 5 without a guild, the bot auto-posts in `#guild-recruitment`:

```
🛡️ NEW RECRUIT AVAILABLE!

Player: FireStorm99
Faction: Cinema (Fire)
HQ Level: 5
Power: 1,200
Looking for: Active guild for Conquest events

React with ⚔️ to invite this player to your guild!
```

**How It Works:**
- Guild leaders react with ⚔️
- Player receives DMs from interested guilds
- Player accepts with `!guild join [Name]`

**Benefits:**
- No one gets "lost" without a guild
- Guilds actively compete to recruit strong players
- Reduces friction ("How do I find a guild?")

### 10.4. Guild Quests (Daily Challenges)

Every day at 00:00 UTC, guilds receive 3 random quests:

**Quest Examples:**
1. "Guild members defeat 50 NPCs collectively" → Reward: 1,000 Gold to guild bank
2. "Guild members train 500 troops collectively" → Reward: 2 Epic Hero Shards (distributed to all members)
3. "Guild members win 20 Arena battles collectively" → Reward: 500 Diamonds split among contributors

**Commands:**
- `!guild quests` - View today's active quests and progress
- `!guild rewards` - Claim completed quest rewards

**Why This Works:**
- Encourages daily activity without being mandatory
- Rewards scale with participation (more active = more rewards)
- Creates "team goals" beyond just Conquest

### 10.5. Starter Guilds (Auto-Created at Server Launch)

When the bot is first set up on a server, it automatically creates **3 official guilds**:

1. **🔥 Cinema Legion** (Fire faction focus, but all factions welcome)
2. **💨 Otaku Alliance** (Wind faction focus, but all factions welcome)
3. **💧 Arcade Coalition** (Water faction focus, but all factions welcome)

**Features:**
- Anyone can join for free (no invitation needed)
- Auto-managed by bot (no human guild leader)
- Perfect for new players who want instant guild benefits
- As community grows, players naturally split into custom player-run guilds

**Joining Starter Guilds:**
```
Type !guild join "Cinema Legion" (or the faction you prefer)
```

### 10.6. Guild Management Commands

* `!guild info` - View guild stats (members, total power, owned lands)
* `!guild promote [Player]` - Promote to officer (officers can invite/kick)
* `!guild kick [Player]` - Remove inactive member (guild leader only)
* `!guild leave` - Leave your current guild
* `!guild donate [Resource] [Amount]` - Contribute to guild bank
* `!guild bank` - View guild treasury balance

---

## 11. NPCs (PvE Content)

| NPC Type | Location | Drops | Power |
|----------|----------|-------|-------|
| **Bandit Camp** | Spawn Zone | Food, Gold | 500-1,000 |
| **Goblin Outpost** | Resource Zone | Iron, Hero XP | 1,500-3,000 |
| **Dragon Lair** | Center | Hero Shards, Diamonds | 5,000-10,000 |

**Command:** `!scout [X,Y]` (check NPC power before attacking)

**Respawn:** NPCs respawn 12 hours after defeat.

---

## 12. Research (Tech Tree - Expanded for 3-Month Season)

| Research Level | Effect | Cost | Time |
|----------------|--------|------|------|
| **Troop Training I-V** | -10%/-20%/-30%/-40%/-50% training time | 2k-20k Gold | 1-12 hours |
| **Resource Boost I-V** | +10%/+20%/+30%/+40%/+50% production | 3k-25k Gold | 2-15 hours |
| **March Speed I-V** | +10%/+20%/+30%/+40%/+50% march speed | 2.5k-22k Gold | 1-10 hours |
| **Combat Power I-V** | +5%/+10%/+15%/+20%/+25% attack/defense | 5k-30k Gold | 3-18 hours |
| **Hero XP Boost I-III** | +20%/+40%/+60% hero XP gain | 10k-40k Gold | 6-20 hours |
| **Army Capacity I-III** | +100/+200/+300 max troop capacity | 8k-35k Gold | 4-16 hours |

**Command:** `!research [Name]`

**Total Research:** 26 upgrades across 6 categories (enough content for 3 months of progression).

---

## 13. Seasons & Wipes

### 13.1. Season Length
* **Duration:** 3 months
* **Full Wipe:** Everything resets at season end:
  - Cities, buildings, troops → **DELETED**
  - Heroes → **DELETED** (everyone starts fresh!)
  - Resources → **DELETED**
  - Guild progress → **DELETED**
* **What You Keep:**
  - **Diamonds** (premium currency – use them next season!)
  - **Prestige System Rewards** (see below)

**Why full wipes?**
- Keeps the game competitive (no permanent advantages)
- Fresh meta every season (everyone experiments with new heroes)
- New players can catch up (not fighting year-old accounts)
- Makes every season feel like a new game

### 13.2. Prestige System (Season Rewards)

At the end of each season, players earn **Prestige Points** and rewards based on their achievements:

**HQ Level Rewards:**
- HQ 10-15: +100 Diamonds next season + "Builder" badge
- HQ 16-20: +300 Diamonds + "Architect" badge
- HQ 21-25: +500 Diamonds + "Legend" badge + exclusive "Golden Castle 🏛️" emoji (replaces 🏰 in next season)

**Arena Tier Rewards:**
- Reached Gold: +200 Diamonds + "Gladiator" title
- Reached Legend: +500 Diamonds + "Champion" title + permanent arena frame (visual flair in leaderboards)

**Conquest Participation:**
- Top 10 finisher any week: +300 Diamonds + "Conqueror" title
- Top 3 guild: +200 Diamonds + guild banner emoji

**Land Ownership:**
- Owned 3 lands: +100 Diamonds + "Landowner" badge
- Guild owned 10 lands: +150 Diamonds + "Territory Master" badge

**Total Possible Carry-Over:** Up to 2,000+ Diamonds for hardcore players who max everything

### 13.3. Seasonal Leaderboards (Permanent Hall of Fame)

After each season ends, the top players are immortalized:

```
🏆 SEASON 1 HALL OF FAME (Jan-Mar 2025)

OVERALL POWER:
1. CinemaGod - HQ 25 - 50,000 Total Power
2. OtakuKing - HQ 25 - 48,500 Total Power
3. ArcadeLord - HQ 24 - 46,000 Total Power

ARENA LEGENDS:
1. SaitamaMain - 5,500 Arena Points
2. TerminatorX - 5,200 Arena Points
3. MarioMaster - 5,000 Arena Points

CONQUEST CHAMPIONS:
1. FireWarriors Guild - 2,500 Total Points
2. Wind Alliance - 2,300 Total Points
3. Water Coalition - 2,100 Total Points
```

**Command:** `!seasons` - View hall of fame for all past seasons

**Why This Matters:**
- Your Season 1 #1 Arena rank is recorded forever (bragging rights)
- New players can see "Oh, CinemaGod dominated Season 1, but Season 2 is a fresh start"
- Creates legacy ("I was top 10 in Season 3!")

### 13.4. Cosmetic Unlocks (Permanent Progression)

Reaching milestones unlocks cosmetics that persist across seasons:

**City Skins (Visual Flair):**
- HQ 15: Unlock "Stone Castle 🏯" emoji option
- HQ 20: Unlock "Fortress 🏰" emoji option
- HQ 25: Unlock "Golden Palace 🏛️" emoji option

**Profile Badges:**
- Complete Tutorial: "Recruit" badge
- Reach HQ 10: "Captain" badge
- Reach HQ 25: "Warlord" badge
- Win 100 Arena matches: "Veteran Duelist" badge
- Own 3 Legendary Heroes: "Summoner" badge

**Guild Banners:**
- Guild reaches Top 3 in Conquest: Unlock custom emoji (e.g., 🔥⚔️ for "Fire Warriors")
- Guild owns 10 lands: Unlock "Empire" banner

**How to Use Cosmetics:**
- `!profile customize` - Choose your city emoji, badges, title
- Shows up when others scout you or see you on leaderboards

### 13.5. End-of-Season Event (Final Week Celebration)

The last 7 days of each season feature special bonuses:

- **Double Diamond Rewards** from Arena and daily quests
- **Mega Conquest:** Friday AND Saturday (two chances to win)
- **XP Boost Weekend:** 2x Hero XP from all sources
- **Land Sale:** All land parcels cost 50% less (encourages experimentation)
- **World Boss Finale:** On the final Sunday, a giant NPC spawns at the center. All players cooperate to defeat it. Top 100 contributors get bonus Diamonds.

**Why This Works:**
- Gives everyone a final push to hit their goals
- Builds hype for the next season
- Rewards active participation during transition

### 13.6. Season Reset Process

**Sunday 11:59 PM UTC (Last Day of Season):**
1. Final leaderboards are frozen and recorded
2. All rewards are distributed automatically
3. Bot announces: "Season 1 has ended! Season 2 begins in 1 hour."

**Monday 12:00 AM UTC (Season 2 Start):**
1. All cities/troops/heroes are deleted
2. Map regenerates with new land parcel placements
3. All players can use `!begin` again to respawn
4. Diamonds and Prestige rewards are available to spend immediately

**Grace Period:**
- Players have 7 days to claim their end-of-season rewards before they expire
- Unclaimed rewards are forfeited (encourages active login)

---

## 14. Daily Rewards & Quests

### 14.1. Daily Login Bonuses (Newbie Support)

**First 7 Days (Newbie Pack):**
* **Day 1:** 500 Food + 500 Iron + 50 Diamonds
* **Day 2:** 1,000 Food + 500 Iron + 50 Diamonds
* **Day 3:** 1,000 Food + 1,000 Iron + 100 Diamonds + 1 Rare Hero Shard
* **Day 4:** 2,000 Food + 1,000 Iron + 100 Diamonds
* **Day 5:** 2,000 Food + 2,000 Iron + 150 Diamonds + 1 Epic Hero Shard
* **Day 6:** 3,000 Food + 2,000 Iron + 200 Diamonds
* **Day 7:** 5,000 Food + 3,000 Iron + 300 Diamonds + 1 Legendary Hero Shard

**Ongoing Daily Login (After Day 7):**
* Every day: 1,000 Food + 500 Iron + 50 Diamonds
* Every 7 days: Bonus 200 Diamonds + 1 Rare Hero Shard
* Every 30 days: Bonus 500 Diamonds + 1 Epic Hero Shard

**Special Newbie Benefits (First 24 Hours):**
- All building upgrades that take <30 minutes are **instant** (no waiting!)
- This applies only during your first 24 hours in the game
- After 24 hours, normal build times apply

**Starter NPC Guarantee:**
- 5 weak Bandit Camps spawn near every new player's city (within 5 tiles)
- These NPCs are weaker than normal (200 power instead of 500)
- Perfect for learning combat and earning first resources
- Respawn once after defeat (so 10 total easy wins for new players)

### 14.2. Daily Quests
* Train 50 troops → 20 Diamonds
* Defeat 1 NPC → 30 Diamonds
* Win 1 Arena match → 50 Diamonds
* Upgrade any building → 40 Diamonds
* Gather from 3 resource nodes → 30 Diamonds

**Total Possible Daily Diamonds:** 170 (from quests alone)

**Command:** `!daily` (shows progress and claim buttons)

---

## 15. Tutorial (Interactive & Comprehensive)

When a player types `!begin`, the bot guides them through a structured 10-minute tutorial that teaches core mechanics step-by-step.

### Phase 1: Faction Selection & Lore (2 minutes)

**Bot Message:**
```
🌟 WELCOME TO POPVERSE KINGDOMS! 🌟

You are about to become a Captain—a leader commanding heroes from across the multiverse!

Choose your faction wisely. This choice is PERMANENT for this season (3 months).

🔥 CINEMA (Fire Element)
"Born from explosive blockbusters and cinematic legends."
✅ +10% Attack to all armies
✅ High damage, aggressive playstyle
✅ Starter Hero: John McClane (Die Hard)
Example Heroes: T-800 Terminator, John Wick, Neo

💨 OTAKU (Wind Element)
"Swift heroes from anime realms. Speed and precision."
✅ +15% March Speed
✅ Fast strikes, hit-and-run tactics
✅ Starter Hero: Naruto Uzumaki (Naruto)
Example Heroes: Saitama, Goku, Jotaro Kujo

💧 ARCADE (Water Element)
"Pixel champions from arcade cabinets. Endurance and strategy."
✅ +10% Defense
✅ High survival, tank playstyle
✅ Starter Hero: Mario (Donkey Kong)
Example Heroes: Kyo Kusanagi, Liu Kang, Scorpion

Type: !begin cinema, !begin otaku, or !begin arcade
```

**User Action:** Player types `!begin cinema` (or their choice)

**Bot Response:**
```
🔥 You have chosen CINEMA! 🔥

Your starting hero is John McClane. He's survived countless explosions and emerged victorious. Now he fights for you!

Your city has been placed at coordinates (42, 58) in the Spawn Zone. Type !map to see your surroundings.
```

### Phase 2: Understanding the Map (1 minute)

**Bot Message:**
```
📍 NAVIGATING THE MAP

Use !map to see a 15x15 grid around your city. Here's what the symbols mean:

🏰 = Your City (1 tile)
🔥💨💧 = Other players' cities (colored by faction)
⛰️ = Mountain (blocks movement)
🌊 = Lake (blocks movement)
🌳 = Resource Node (gather Food/Iron/Gold)
🟩🟫🟨🟥 = Land Parcels (buy these for bonuses!)
❓ = Unexplored (Fog of War)

Try it now: Type !map
```

**User Action:** Player types `!map`

**Bot Response:** (Shows their local map with tutorial markers)
```
📍 YOUR MAP (Coordinates 37-52, 53-68)

❓ ❓ ❓ ⛰️ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓
❓ ❓ ❓ ⛰️ ❓ 🌳 ❓ ❓ ❓ ❓ ❓ 🟩🟩🟩🟩
❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ 🟩🟩🟩🟩
❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ 🔥 ❓ ❓ 🟩🟩🟩🟩 ← Farmstead Land (4x4)
❓ ❓ ❓ ❓ ❓ 🏰 ❓ ❓ ❓ ❓ ❓ 🟩🟩🟩🟩
❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓ ❓
       ↑ YOUR CITY

Great! You can move around with !map north, !map south, !map east, !map west.
```

### Phase 3: Building Your Economy (3 minutes)

**Bot Message:**
```
🏗️ BUILDING YOUR CITY

Your city needs resources to survive. Let's build your first Farm!

Type: !build farm
```

**User Action:** Player types `!build farm`

**Bot Response:**
```
✅ Farm Level 1 constructed! (Instant at low levels)

Your Farm now produces 100 Food per hour automatically.

Now let's build a Mine for Iron:
Type: !build mine
```

**User Action:** Player types `!build mine`

**Bot Response:**
```
✅ Mine Level 1 constructed!

Great! Now you're producing Food and Iron. Check your resources:
Type: !city
```

**User Action:** Player types `!city`

**Bot Response:**
```
🏰 YOUR CITY STATUS

📍 Location: (42, 58)
🏛️ Faction: Cinema (Fire)
⭐ HQ Level: 1

RESOURCES:
🌾 Food: 500 / 5,000 (+100/hour from Farm Lv1)
⚒️ Iron: 300 / 5,000 (+80/hour from Mine Lv1)
💰 Gold: 200 / 5,000 (+50/hour from Market - not built yet)

BUILDINGS:
HQ: Level 1
Farm: Level 1 (Producing Food)
Mine: Level 1 (Producing Iron)
Barracks: Level 0 (Not built - needed to train troops!)

Next step: Build a Barracks so you can train troops.
Type: !build barracks
```

**User Action:** Player types `!build barracks`

**Bot Response:**
```
✅ Barracks Level 1 constructed!

Perfect! Now you can train troops to defend your city and attack enemies.
```

### Phase 4: Training Your First Army (2 minutes)

**Bot Message:**
```
⚔️ TRAINING TROOPS

Troops are the backbone of your army. Let's train 20 T1 (Tier 1) troops:

Type: !train t1 20
```

**User Action:** Player types `!train t1 20`

**Bot Response:**
```
🔨 Training 20 T1 Troops...
Cost: 1,000 Food, 400 Iron
Time: 10 minutes (20 troops x 30 seconds each)

✅ Training started! Your troops will be ready in 10 minutes.

(FOR TUTORIAL: Training completes instantly)
✅ 20 T1 Troops are now ready!

Your army:
- 20 T1 Troops (Power: 10 each = 200 total)
- Hero: John McClane (Level 1, Power: +100)
- TOTAL POWER: 300

Now let's put them to use!
```

### Phase 5: Your First Battle (NPC Combat) (2 minutes)

**Bot Message:**
```
⚔️ TIME FOR BATTLE!

A weak Bandit Camp has been spotted near your city at coordinates (44, 60).

Let's scout it first to see its power:
Type: !scout 44 60
```

**User Action:** Player types `!scout 44 60`

**Bot Response:**
```
👁️ SCOUT REPORT

Location: (44, 60)
Target: Bandit Camp (NPC)
Power: 250
Troops: 20 T1 Bandits
Rewards: 500 Food, 200 Gold, 50 Hero XP

Your Power: 300 (20 T1 Troops + John McClane)
⚖️ You have a power advantage! Victory is likely.

Ready to attack?
Type: !attack 44 60 "John McClane" 20
```

**User Action:** Player types `!attack 44 60 "John McClane" 20`

**Bot Response:**
```
🚀 MARCH STARTED!

Your army is marching to (44, 60)...
Distance: 2 tiles
March Time: 1 minute
ETA: 12:35 PM

(FOR TUTORIAL: March completes instantly)

⚔️ BATTLE REPORT ⚔️

Your Army: 20 T1 Troops + John McClane (Power: 300)
Enemy: Bandit Camp (Power: 250)

🔥 Cinema Faction Bonus: +10% Attack applied!
💥 John McClane's Skill: +10% Attack to Fire troops activated!

Turn 1: John McClane attacks first! (Deals 80 damage)
Turn 2: Bandits counterattack! (Deal 40 damage)
Turn 3: Your troops overwhelm the bandits!

✅ VICTORY!

Casualties:
- You lost 3 T1 Troops (17 survived)
- Enemy defeated

Rewards:
+ 500 Food
+ 200 Gold
+ 50 Hero XP (John McClane: Level 1 → Level 2)

Great job! You've won your first battle.
```

### Phase 6: Introduction to Lands (1 minute)

**Bot Message:**
```
🗺️ OWNING LAND

Remember that 🟩 Farmstead you saw on the map earlier? You can buy it!

Lands give you passive bonuses:
🟩 Farmstead = +15% Food production
🟫 Mining Camp = +15% Iron production
🟨 Trade Hub = +20% Gold production
🟥 Strategic Fort = +10% Defense when fighting inside it

To buy land, you need more resources. Keep building and fighting NPCs to earn enough!

When you're ready: !land buy [X,Y] (click any tile within the land parcel)

Farmstead Cost: 8,000 Food + 3,000 Iron
```

### Phase 7: Arena Introduction (1 minute)

**Bot Message:**
```
🏟️ THE ARENA

The Arena is where you fight other players for ranking and rewards!

First, set your Defense Team (3 heroes that defend your rank when others attack):
Type: !arena defense "John McClane" "John McClane" "John McClane"

(Don't worry—you'll get more heroes soon via summons and PvE drops!)

Once you have 3 different heroes, you can compete in Arena battles.
- 10 attacks per day
- Climb from Bronze → Silver → Gold → Legend
- Weekly rewards in Diamonds

Try it when you have more heroes!
```

### Phase 8: Joining a Guild (1 minute)

**Bot Message:**
```
🛡️ GUILDS (Alliances)

Guilds let you team up with other players for:
- Shared land ownership (guilds can own 10 lands!)
- Rally attacks (combine armies to defeat strong enemies)
- Weekly Conquest events (capture Control Points together)
- Help speed up each other's builds

See available guilds:
Type: !guild list

Or create your own:
Type: !guild create [Name] (Costs 5,000 Gold)

Guilds are key to late-game success!
```

### Phase 9: Next Steps & Goals (30 seconds)

**Bot Message:**
```
🎯 YOUR NEXT GOALS:

1. Upgrade your HQ to Level 5 (unlocks more features)
2. Train more troops (aim for 100 T1 troops)
3. Defeat more NPCs to earn Hero XP and resources
4. Save up to buy your first Land Parcel (8,000 Food + 3,000 Iron for Farmstead)
5. Summon new heroes with Diamonds (100 Diamonds = 1 Summon)
6. Join or create a Guild

Type !help anytime to see all commands.

Good luck, Captain! The PopVerse awaits! 🚀
```

### Tutorial Complete!

**User now has:**
- ✅ A city with Farm, Mine, Barracks
- ✅ 17 T1 Troops + John McClane (Level 2)
- ✅ 1,000 Food, 500 Iron, 400 Gold
- ✅ Understanding of map, combat, and lands
- ✅ Knowledge of Arena and Guilds

---

## 16. Commands Summary

### Core Commands
* `!begin [faction]` – Start the game (cinema/otaku/arcade)
* `!map` – View local map
* `!map link` – Get web dashboard URL
* `!city` – View your buildings/resources
* `!land buy [X,Y]` – Purchase a land parcel
* `!land sell [X,Y]` – Sell your land (50% refund)
* `!land list` – See all your owned lands
* `!build [Building]` – Construct a building
* `!upgrade [Building]` – Upgrade a building
* `!train [Tier] [Qty]` – Train troops
* `!attack [X,Y] [Hero] [Troops]` – March to attack
* `!scout [X,Y]` – Check enemy/NPC power
* `!heroes` – View your hero roster
* `!research` – View tech tree
* `!guild` – Guild management
* `!guild land buy [X,Y]` – Purchase land as a guild
* `!daily` – Check daily quests
* `!help` – Command list

### Arena Commands
* `!arena defense [Hero1] [Hero2] [Hero3]` – Set your defense team
* `!arena attack` – View 5 potential opponents
* `!arena fight [Number]` – Attack chosen opponent (1-5)
* `!arena refresh` – Get new opponent list (15min cooldown or 50 Diamonds)
* `!arena tokens` – Check remaining daily attacks
* `!arena leaderboard` – View top 100 players
* `!arena defense log` – See recent attacks on your defense
* `!arena stats` – View your win/loss record and current rank

### Admin Commands
* `!setup start` – Initialize the game
* `!admin pause` – Pause marches/events
* `!admin announce [Message]` – Global announcement

---

## 17. Balancing the Game (For First-Time Designers)

### 17.1. Core Balance Pillars
**The goal:** No faction or hero should win >60% of matches at equal power levels.

#### Faction Balance
* **Cinema (Fire):** High attack, low defense → Glass cannon
* **Otaku (Wind):** Balanced stats, high speed → Hit-and-run
* **Arcade (Water):** Low attack, high defense → Tank

**Test:** Simulate 100 battles between equal-power armies of each faction. Adjust bonuses until win rates are 45-55%.

#### Hero Balance by Rarity
* **Common:** +10-15% stat boost
* **Rare:** +20-25% stat boost + minor active skill
* **Epic:** +30-40% stat boost + strong active skill
* **Legendary:** +50% stat boost + game-changing skill (but rare!)

**Test:** An Epic hero with 100 T2 troops should beat a Rare hero with 120 T2 troops 50% of the time.

### 17.2. Economy Balance
**Resource Production Rates:**
* **Early Game (HQ 1-5):** Players should earn enough Food/Iron to train 50 T1 troops per hour.
* **Mid Game (HQ 6-15):** Enough to train 20 T2 troops per hour.
* **Late Game (HQ 16-25):** Enough to train 5 T3 troops per hour OR 2 T4 troops per hour.

**Land Parcel Impact:**
* Without lands: Base production rates.
* With 3 Farmsteads (+15% each = +45% Food): Mid-game players can sustain T3 production.
* With mixed lands (1 Farmstead, 1 Mining Camp, 1 Trade Hub): Balanced economy for diverse needs.

**Raid Balance:**
* Attackers should profit only if they win decisively (10%+ power advantage).
* Defenders shouldn't lose more than 20% of stored resources (Vault protection).

**Land Costs:**
* Farmstead/Mining Camp: ~3-4 hours of production at mid-game levels (accessible but requires planning).
* Trade Hub: ~6 hours of production (meaningful investment).
* Strategic Fort: ~10 hours of production (late-game power move).

**Why these costs?** Early lands are affordable for active players, but the 3-land cap forces strategic choices (do I stack food lands or diversify?).

### 17.3. PvP Balance (Arena)
* **Matchmaking:** Pair players within ±20% total power.
* **Meta Check:** If one hero appears in >70% of top 20 Arena teams, nerf its skill by 10-20%.

### 17.4. Conquest Balance
* **Control Points:** Scale rewards so rank 10 gets 50% of rank 1's rewards (keeps casuals engaged).
* **Troop Respawn:** 5-minute delay prevents "spam attacks" but keeps it fast-paced.

### 17.5. Land System Balance
* **Scarcity:** 150 parcels for 100 players. If every player maxes out (3 lands), that's only 300 parcels needed, but guilds can own 10 each. With 10 active guilds, that's 100 guild lands + 200 player lands = 300 total. Still room, but prime locations near the center will be hotly contested.
* **Strategic Value:** A Strategic Fort near a mountain chokepoint is worth more than a Farmstead in the corner. Creates natural conflict zones.
* **Guild Coordination:** Guilds controlling 10 lands spread across the map can create "supply chains" (Farmsteads near HQs, Strategic Forts near frontlines).
* **Land Loss Mechanic:** Losing your HQ in a siege means the winner can claim one of your lands for free. This prevents land hoarding (if you own 3 valuable lands, you become a target).

### 17.6. Playtesting Schedule
* **Week 1-2:** Internal testing with 10 friends. Focus: "Is it fun? Are rules clear? Can we find lands easily?"
* **Week 3-4:** Closed beta with 30 players. Focus: "What's broken? Which faction dominates? Are lands too cheap/expensive? Are guilds hoarding lands?"
* **Month 2:** Open to 100 players. Collect data: win rates, resource income, Arena rankings, land ownership distribution (are 10 players owning 80% of lands?).
* **Monthly Tweaks:** Adjust +/- 5% to hero skills, faction bonuses, or resource rates. Adjust land costs if everyone/no one is buying lands. Add more land types if needed (e.g., "XP Boost Land").

---

## 18. What Makes This Version Work

### Why 100 Players Max?
* **Map Density:** 100 players on 10,000 tiles = 100 tiles per player (enough room to expand without overcrowding).
* **Community Feel:** Everyone knows each other. Rivalries and alliances feel personal.
* **Bot Performance:** Smaller player count = less database load, faster response times.

### Why 3-Hero Arena?
* **Faster Matches:** 3v3 resolves in ~30 seconds (simpler than 5v5).
* **Lower Entry Barrier:** New players only need 3 heroes to compete (not 5).
* **Clearer Strategy:** Easier to understand why you won/lost with fewer moving parts.

### Why Keep Conquest?
* **Weekly Hype:** Gives players something to rally around ("Saturday is Conquest day!").
* **No Perma-Loss:** Troops respawn, so losing doesn't feel punishing (encourages participation).
* **Guild Bonding:** Coordinating 20 guildmates for a 1-hour event builds community.

### Why Full Wipes (No Soulbound Heroes)?
* **Fresh Starts:** Every season is a new game. No one has permanent advantages.
* **Experimentation:** Players try different factions/heroes each season instead of sticking to their "main."
* **New Player Friendly:** A new player in Season 3 can compete with veterans (everyone starts at zero).
* **Diamond Value:** Saved Diamonds let you jumpstart next season (summon heroes faster, speed up builds), but you still have to play.
* **Prevents Power Creep:** Without soulbound heroes, the game never becomes "collect all 12 and dominate forever."

### Why 3 Months Instead of 2?
* **Current content sustains:**
  - HQ 1-25 (with 24h builds at top levels) = ~4-6 weeks of progression
  - Research (26 upgrades, up to 20h each) = ~3-4 weeks
  - Hero leveling (1-50 across multiple heroes) = ongoing throughout season
  - Arena climb (Bronze → Legend) = 4-8 weeks
  - Weekly Conquests = 12 events per season
* **Avoids burnout:** 2 months feels rushed; 3 months lets casual players reach HQ 20+ and compete.
* **Seasonal hype:** Enough time for mid-season events (double XP weekends, special NPC spawns).

### Why Optional Web Dashboard?
* **Accessibility:** Not everyone wants to leave Discord. Casual players can play 100% in chat.
* **Depth for Hardcore Players:** Strategy nerds get zoomable maps, march tracking, and analytics.
* **No Paywall:** It's a free tool, not a required purchase.
* **Mobile Use:** Check the map on your phone during work/school without spamming Discord commands.

---

## 19. Launch Checklist

- [ ] Set up Discord bot with basic commands (`!begin`, `!map`, `!attack`)
- [ ] Code the 100x100 map generator
- [ ] Implement 3-resource economy (Food, Iron, Gold)
- [ ] Program 12 heroes (4 per faction) with skills
- [ ] Balance combat formula (run 100 simulated battles)
- [ ] Build Arena matchmaking (1 match/hour, rank ladder)
- [ ] Code Conquest event (5 Control Points, 1-hour duration)
- [ ] Write tutorial flow (`!begin` → 5-step walkthrough)
- [ ] Playtest with 10 friends for 1 week
- [ ] Launch to 50-100 players



---