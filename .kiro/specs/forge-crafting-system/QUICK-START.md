# Forge & Crafting System - Quick Start Guide

## 🎯 What's Working Now

The forge crafting system is **fully functional** and ready to use! Players can:
- Build and upgrade the Forge
- Salvage items for materials
- Craft new items with timers
- View materials and recipes
- Auto-complete crafting jobs

## 🚀 Getting Started

### 1. Build the Forge
```
/build forge
```
**Requirements:** HQ Level 10, 2000 Iron, 5000 Gold

### 2. Get Materials
You can get materials by salvaging items:
```
/salvage [item_id]
```
This breaks down items into crafting materials based on rarity.

### 3. View Available Recipes
```
/forge recipes
```
Shows all recipes you can craft based on your forge level.

### 4. Start Crafting
```
/forge craft iron_sword
```
Choose from 10 available recipes (Common to Legendary).

### 5. Check Progress
```
/forge status
```
View active crafting jobs and time remaining.

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `/forge status` | View forge level and active crafting jobs |
| `/forge recipes` | View all available recipes |
| `/forge materials` | View your material inventory |
| `/forge craft [recipe]` | Start crafting an item |
| `/forge cancel [job_id]` | Cancel a crafting job |
| `/salvage [item_id]` | Break down an item for materials |

## 🔨 Crafting Recipes

### Common (Forge Level 1)
- **Iron Sword** - 10 Iron Ingots, 5 Leather Scraps (5min, 95% success)
- **Leather Armor** - 15 Leather Scraps (5min, 95% success)

### Uncommon (Forge Level 3)
- **Steel Blade** - 25 Iron Ingots, 5 Mystic Essence (15min, 85% success)
- **Reinforced Armor** - 20 Iron Ingots, 15 Leather Scraps, 3 Mystic Essence (15min, 85% success)

### Rare (Forge Level 5)
- **Enchanted Blade** - 40 Iron Ingots, 15 Mystic Essence (30min, 75% success)
- **Mystic Robes** - 30 Leather Scraps, 20 Mystic Essence (30min, 75% success)

### Epic (Forge Level 7)
- **Dragonforged Sword** - 60 Iron Ingots, 30 Mystic Essence, 10 Dragon Scales (1hr, 60% success)
- **Dragonscale Armor** - 15 Dragon Scales, 25 Mystic Essence (1hr, 60% success)

### Legendary (Forge Level 10)
- **Celestial Blade** - 30 Dragon Scales, 20 Celestial Fragments, 50 Mystic Essence (2hr, 40% success)
- **Celestial Armor** - 25 Celestial Fragments, 20 Dragon Scales, 40 Mystic Essence (2hr, 40% success)

## 💎 Material Types

| Material | Emoji | How to Get |
|----------|-------|------------|
| Leather Scraps | 🧵 | Salvage Common/Uncommon items |
| Iron Ingots | ⚙️ | Salvage Common/Uncommon/Rare items |
| Mystic Essence | ✨ | Salvage Uncommon/Rare/Epic items |
| Dragon Scales | 🐉 | Salvage Epic/Legendary items |
| Celestial Fragments | ⭐ | Salvage Legendary items |

## ⚡ Key Features

### Auto-Completion
Crafting jobs complete automatically! A background process checks every minute and completes ready jobs.

### Success/Failure System
- Higher rarity = Lower success rate
- Failed crafts return 50% of materials
- Success creates item with random stats

### Salvage Confirmation
Breaking down items shows a confirmation prompt with the materials you'll receive.

### Crafting Queue
- View all active jobs with time remaining
- Cancel jobs for refunds (100% if not started, 50% if in progress)

## 🎮 Example Workflow

1. **Get some items** (from loot, NPCs, etc.)
2. **Salvage unwanted items:** `/salvage 123`
3. **Check materials:** `/forge materials`
4. **View recipes:** `/forge recipes`
5. **Start crafting:** `/forge craft iron_sword`
6. **Check status:** `/forge status`
7. **Wait for completion** (auto-completes in background)
8. **Equip your new item!**

## 🔧 Technical Details

### Database Tables
- `player_materials` - Tracks material inventory per player
- `crafting_queue` - Manages active crafting jobs
- `crafting_recipes` - Stores recipe definitions

### Background Jobs
- Crafting completion check runs every 60 seconds
- Automatically completes ready jobs and creates items

### Item Generation
- Items created with random stats based on recipe ranges
- Stats scale with item level
- Items assigned to player's first hero

## 📝 Notes

- Materials don't count against vault capacity
- You can only craft one item at a time (VIP will get 3 slots)
- Equipped and locked items cannot be salvaged
- Crafting continues even if you're offline

## 🐛 Known Limitations

- Recipes are hardcoded (not in database yet)
- No recipe discovery from bosses yet
- No item sets system yet
- No guild material trading yet

These features are planned for future updates!

## 🎉 Ready to Craft!

The system is fully functional. Start building your forge and crafting powerful items!
