# Game Management Scripts

## Starting and Stopping the Game

### Start the Game
```bash
./scripts/start.sh
```
Starts the PopVerse Kingdoms game using PM2 in production mode.

### Stop the Game
```bash
./scripts/stop.sh
```
Stops the running game and removes it from PM2.

## Reset Scripts

### Reset Player Data Only (Preserves NPCs & Resources)
```bash
npm run reset:players
```
This script:
- ✅ Clears all player data (accounts, heroes, buildings, troops, etc.)
- ✅ Clears guild data
- ✅ Removes player occupancy from map tiles
- ✅ Clears land parcel ownership
- ✅ Clears Redis cache
- ❌ **Preserves NPCs** (bandit camps, goblin outposts, dragon lairs)
- ❌ **Preserves map tiles** (terrain and resource nodes)

### Full Development Reset
```bash
npm run reset
```
Clears ALL game data including NPCs and map tiles (for development).

### Full Reset + Regenerate Map
```bash
npm run reset:full
```
Clears everything and regenerates the world map from scratch.

## Quick Reference

| Command | What it does |
|---------|-------------|
| `./scripts/start.sh` | Start game with PM2 |
| `./scripts/stop.sh` | Stop game |
| `npm run reset:players` | Reset players only, keep NPCs/map |
| `npm run reset` | Reset everything (dev) |
| `npm run reset:full` | Reset + regenerate map |
| `pm2 status` | Check if game is running |
| `pm2 logs popverse-kingdoms` | View game logs |

## Map Analysis & Debugging

### Analyze Map Distribution
```bash
npx tsx scripts/analyze-map-distribution.ts
```
Shows detailed statistics about map generation:
- Resource distribution by zone (temple/resource/spawn)
- NPC distribution and density
- Land parcel distribution
- Terrain type percentages
- Identifies potential issues with distribution

Use this after regenerating the map to verify improvements.

### Check Map Data
```bash
npx tsx scripts/check-map-data.ts
```
Quick check of map data status (terrain distribution, NPCs, resources).

### Regenerate Map
```bash
npx tsx scripts/regenerate-map.ts
```
Regenerate the entire map with terrain and NPCs (preserves player positions).

### Respawn NPCs
```bash
npx tsx scripts/respawn-npcs.ts
```
Respawn NPCs only (without regenerating terrain).

### Clear Cache
```bash
npx tsx scripts/clear-cache.ts
```
Clear Redis cache (map images, etc.) - useful after map changes.
