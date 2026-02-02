# Implementation Plan: NPC Item Drops

## Overview

Implement item and material drops from NPCs with configurable drop tables, loot generation, drop rate modifiers, and a pity system for guaranteed drops.

## Tasks

- [ ] 1. Create NPC drop table system
  - Define drop tables for each NPC type (Bandit Camps, Goblin Outposts, Dragon Lairs)
  - Set drop rates: Bandits (30% Common items, 10% materials), Goblins (20% Uncommon, 15% materials), Dragons (15% Rare, 5% Epic, 20% materials)
  - Guarantee at least one drop for Boss NPCs
  - Store drop tables in database or configuration

- [ ] 2. Implement loot generation system
  - Roll for drops based on NPC's drop table when defeated
  - Generate items with random stats within rarity range
  - Add all dropped items to player inventory
  - Send overflow items to mailbox if inventory full (7-day expiration)

- [ ] 3. Add drop rate modifiers
  - Apply Luck research bonus (+5% per level, max 25%)
  - Apply guild Treasure Hunter perk (+10%)
  - Apply VIP status bonus (+15%)
  - Stack bonuses additively
  - Guarantee one drop + roll for additional if bonuses exceed 100%

- [ ] 4. Create loot notification system
  - Display loot summary after NPC defeat showing all items/materials
  - Send special notifications for Epic drops with visual effects
  - Announce Legendary drops in server game channel
  - Highlight set items in loot summary
  - Show "New Item Discovered" for first-time drops

- [ ] 5. Implement drop history and statistics
  - Track last 50 items received with timestamps
  - Display total NPCs defeated, items dropped, drop rate percentages
  - Add filtering by rarity, item type, or date range
  - Show drop rates per NPC type
  - Add guild aggregate drop statistics

- [ ] 6. Create pity system for guaranteed drops
  - Track NPCs defeated without item drops
  - Guarantee item drop after 10 NPCs without drops
  - Guarantee Rare+ item after 50 NPCs without Rare+ drops
  - Reset pity counter when guaranteed drop triggers
  - Display pity progress in player stats
  - Indicate guaranteed drops in loot summary

- [ ] 7. Add loot commands
  - `!loot history` - View recent drops
  - `!loot stats` - View drop statistics
  - `!loot pity` - Check pity system progress
