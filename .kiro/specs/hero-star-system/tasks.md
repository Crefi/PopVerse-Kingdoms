# Implementation Plan: Hero Star System

## Overview

Implement hero star upgrades (1-5 stars) using hero shards, with stat bonuses, ability unlocks, visual indicators, and shard management.

## Tasks

- [ ] 1. Implement hero shard collection
  - Convert duplicate hero summons to 10 shards automatically
  - Add shard drops from NPCs (5% Common, 2% Rare, 1% Epic, 0.5% Legendary)
  - Award shards from guild quest completions
  - Offer shards as event milestone rewards
  - Add shard bundles to shop for Diamonds

- [ ] 2. Create star upgrade system
  - Start all heroes at 1-star when unlocked
  - Set upgrade requirements:
    - 2-star: 10 shards + 5,000 Gold
    - 3-star: 20 shards + 10,000 Gold + level 20
    - 4-star: 50 shards + 25,000 Gold + level 30
    - 5-star: 100 shards + 50,000 Gold + level 40
  - Display missing requirements when upgrade unavailable
  - Consume resources and apply upgrade

- [ ] 3. Implement star upgrade stat bonuses
  - Apply cumulative stat increases:
    - 2-star: +20% all base stats
    - 3-star: +40% all base stats
    - 4-star: +70% all base stats
    - 5-star: +100% all base stats
  - Recalculate hero power rating immediately on upgrade

- [ ] 4. Create star-specific ability unlocks
  - Unlock passive ability at 3-star (hero-specific)
  - Enhance existing active skill at 4-star
  - Unlock ultimate ability at 5-star (once per battle)
  - Display ability descriptions and effects
  - Indicate star-unlocked abilities in battle reports

- [ ] 5. Add visual star indicators
  - Display star rating with visual star icons on hero cards
  - Show stars next to hero names in battle
  - Allow sorting hero lists by star rating
  - Highlight star rating differences when comparing heroes
  - Use special golden star icons for 5-star heroes

- [ ] 6. Implement shard management system
  - Display all owned shards with quantities in inventory
  - Allow converting excess shards to universal shards (5:1 ratio)
  - Allow converting universal shards to any hero shards (1:1 ratio)
  - Require confirmation for shard conversions
  - Add filtering by hero rarity, faction, or upgrade readiness

- [ ] 7. Create star upgrade celebrations
  - Display special animation for 3-star upgrades
  - Announce 4-star upgrades in guild channel
  - Announce 5-star upgrades server-wide and award bonus Diamonds
  - Show before/after stat comparisons
  - Award special achievement and title for first 5-star

- [ ] 8. Integrate star ratings with Arena matchmaking
  - Factor average hero star rating into opponent selection
  - Adjust Arena Point gains/losses based on star rating differences
  - Match 5-star heroes against similarly advanced players
  - Expand star rating range when matchmaking pools are small
  - Display opponent heroes' star ratings in matchmaking

- [ ] 9. Implement shard trading and guild support
  - Allow posting shard requests in guild chat
  - Enable guildmates to donate shards (award contribution points)
  - Limit donations to 5 shards per day per member
  - Offer hero shards in guild shop for contribution points
  - Distribute event shard rewards based on participation

- [ ] 10. Add hero star commands
  - `!hero upgrade [hero]` - Upgrade hero star rating
  - `!shards` - View shard inventory
  - `!shards convert [hero] [amount]` - Convert shards
  - `!hero stars` - View all heroes with star ratings
