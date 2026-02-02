# Implementation Plan: Combat Improvements

## Overview

Enhance combat mechanics with formations, skill synergies, terrain effects, enhanced battle reports, counter-attacks, morale system, and battle replays.

## Tasks

- [ ] 1. Implement formation system
  - Create 5 formation types: Offensive (+15% Attack, -10% Defense), Defensive (+20% Defense, -5% Attack), Balanced (+5% all stats), Speed (+20% Speed, +10% First Strike), Magic (+25% Skill Damage, -10% Physical Defense)
  - Allow players to set formations before battle
  - Apply formation bonuses during combat
  - Allow free formation changes outside combat

- [ ] 2. Create skill synergy system
  - Define synergy pairs: Fire+Wind = "Inferno" (+15% AoE), Water+Wind = "Storm" (+20% Speed), Fire+Water = "Steam" (+10% Healing)
  - Add faction unity bonus: 3 same-faction heroes = +10% to faction bonus
  - Check for synergies at battle start
  - Apply synergy bonuses during combat
  - Display synergy notifications in battle reports

- [ ] 3. Implement terrain and environmental effects
  - Apply terrain bonuses: Mountains (+10% Defense to defender), Forests (+15% Speed to Wind), Rivers/Lakes (+15% Attack to Water), Deserts (+15% Attack to Fire), Strategic Forts (+20% Defense to owner)
  - Add weather effects: Rain (+10% Water damage), Sunny (+10% Fire damage)
  - Determine terrain based on battle location
  - Apply terrain modifiers during combat

- [ ] 4. Enhance battle reports
  - Generate turn-by-turn action timeline
  - Display hero HP bars, skill activations, damage numbers
  - Highlight critical hits with special indicators
  - Show synergy effects in timeline
  - Indicate terrain effects that influenced battle
  - Add share/export functionality (guild channels, images)

- [ ] 5. Implement counter-attack and reaction system
  - Add counter-attack mechanic (50% normal damage when hit)
  - Implement "Riposte" skill (100% counter-attack chance)
  - Implement "Evasion" skill (chance to dodge attacks)
  - Implement "Reflect" skill (return 30% damage to attacker)
  - Check for reactive abilities during enemy turns

- [ ] 6. Create morale and momentum system
  - Initialize all heroes at 50 Morale at battle start
  - Increase Morale by 10 when defeating enemies
  - Decrease Morale by 15 when falling below 30% HP
  - Adjust Morale by ±5 on critical hits
  - Apply stat modifiers: +10% all stats at 80+ Morale, -10% all stats at 20- Morale

- [ ] 7. Implement combat statistics tracking
  - Track per-player stats: win rate, average damage dealt/taken
  - Track per-hero stats: battles fought, wins, kills, deaths
  - Track matchup win rates against faction combinations
  - Generate performance graphs over last 30 days
  - Add guild aggregate combat statistics

- [ ] 8. Create battle replay system
  - Save battle data for replay (last 20 battles per player)
  - Generate animated turn-by-turn recreation
  - Add playback controls: pause, fast-forward, rewind
  - Display detailed stats for each turn
  - Generate shareable links (7-day expiration)

- [ ] 9. Implement combat balance adjustments
  - Cap faction advantage bonus at +25%
  - Apply diminishing returns to extreme stat differences
  - Provide minimum 10% hit chance for low-level vs high-level
  - Apply increasing damage after turn 20 for long battles
  - Award partial rewards for draw outcomes

- [ ] 10. Add combat analysis commands
  - `!combat stats` - View personal combat statistics
  - `!hero stats [hero]` - View hero-specific statistics
  - `!replay [battle_id]` - View battle replay
  - `!formation set [type]` - Set battle formation
