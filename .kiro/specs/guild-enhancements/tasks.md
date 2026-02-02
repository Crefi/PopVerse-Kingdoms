# Implementation Plan: Guild Enhancements

## Overview

Expand guild functionality with perks, buildings, contribution system, guild shop, events, communication tools, roles, leaderboards, and diplomacy (excluding tech tree and wars/tournaments).

## Tasks

- [ ] 1. Implement guild perks system
  - Create perk types: Resource Boost (+5% per level, max 25%), March Speed (+3% per level, max 15%), Combat Power (+2% per level, max 10%), Treasure Hunter (+2% per level, max 10%), Builder's Guild (-5% build time per level, max 25%)
  - Allow spending guild contribution points on perks
  - Apply perk bonuses to all guild members
  - Track perk levels per guild

- [ ] 2. Create guild buildings system
  - Implement Guild Hall (increases member capacity by 5 per level, starting 30, max 100)
  - Implement Guild Vault (shared resource storage with 10% deposit bonus)
  - Implement Guild Barracks (10% faster troop training)
  - Implement Guild Market (better resource trading rates)
  - Implement Guild Shrine (daily blessing buffs)
  - Add building construction and upgrade mechanics

- [ ] 3. Implement guild contribution system
  - Award 10% of resource value for donations
  - Award 50-200 points for guild quests based on difficulty
  - Award 25 points per rally participation
  - Award 5 points per build help action
  - Award 100 points for winning battles for guild territory
  - Track lifetime and weekly contribution totals

- [ ] 4. Create guild shop
  - Display items purchasable with contribution points
  - Offer hero shards, speedups, resources, exclusive cosmetics
  - Refresh shop inventory weekly
  - Unlock higher-tier items at contribution milestones
  - Expand inventory as guild level increases

- [ ] 5. Implement guild events
  - Create Guild Boss event (coordinated attacks, damage tracking, rewards based on contribution)
  - Create Guild Treasure Hunt (special resource nodes, bonus resources and contribution)
  - Create Guild Defense event (waves of NPCs attacking guild territory)
  - Schedule events and notify guild members
  - Distribute event rewards

- [x] 6. Enhance guild communication tools
  - Add guild announcement system with member pings ( maybe create a role when a user creates a guild with the role beign the guild name and then a system with pings and mentions tho the guild role?)
  - Send rally call notifications to online members
  - Support @mentions, emojis, message history in guild chat
  - Post automated updates (member joins, territory captured, boss defeated)

- [x] 7. Implement guild roles and permissions
  - Create roles: Leader, Officer, Elite, Member, Recruit
  - Define permissions per role
  - Officers: invite members, start rallies, manage quests
  - Elite: priority in rallies, guild vault access
  - Allow leaders to assign and change roles
  - Update member capabilities immediately on role change

- [ ] 8. Create guild leaderboards
  - Display rankings by total power, territory controlled, contribution points
  - Award bonus rewards to top 10 guilds weekly
  - Show internal member contribution rankings
  - Record guild achievements in Hall of Fame at season end
  - Track head-to-head records between guilds

- [ ] 9. Implement guild diplomacy system
  - Allow guild leaders to propose alliances
  - Prevent attacks between allied guild members
  - Allow allied guilds to share rally participation
  - Implement rivalry declarations with bonus rewards for defeating rivals
  - Notify all guild members of diplomatic status changes

- [ ] 10. Add guild management commands
  - `!guild perks` - View and upgrade guild perks
  - `!guild buildings` - View and upgrade guild buildings
  - `!guild shop` - Access guild shop
  - `!guild events` - View upcoming guild events
  - `!guild leaderboard` - View guild rankings
  - `!guild alliance [guild_name]` - Propose alliance
  - `!guild rival [guild_name]` - Declare rivalry
