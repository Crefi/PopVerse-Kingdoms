# PopVerse Kingdoms - New Management Scripts

## Summary

Three new scripts have been created to manage your PopVerse Kingdoms game:

### 1. Start Script (`scripts/start.sh`)
- Starts the game using PM2 in production mode
- Checks if game is already running to prevent duplicates
- Usage: `./scripts/start.sh`

### 2. Stop Script (`scripts/stop.sh`)
- Stops the running game
- Removes the process from PM2
- Usage: `./scripts/stop.sh`

### 3. Player Reset Script (`scripts/reset-players.ts`)
- **NEW**: Resets ONLY player data
- **Preserves**: NPCs (bandit camps, goblin outposts, dragon lairs)
- **Preserves**: Map tiles and resource nodes
- Clears: Players, heroes, buildings, troops, guilds, battles
- Removes player occupancy from map but keeps the map intact
- Usage: `npm run reset:players`

## Quick Start

```bash
# Start the game
./scripts/start.sh

# Check status
pm2 status

# View logs
pm2 logs popverse-kingdoms

# Stop the game
./scripts/stop.sh

# Reset only players (keep NPCs and map)
npm run reset:players
```

## What Changed

### package.json
Added new script:
```json
"reset:players": "tsx scripts/reset-players.ts"
```

### Files Created
1. `/home/alexlv/PopVerse-Kingdoms/scripts/start.sh` (executable)
2. `/home/alexlv/PopVerse-Kingdoms/scripts/stop.sh` (executable)
3. `/home/alexlv/PopVerse-Kingdoms/scripts/reset-players.ts`
4. `/home/alexlv/PopVerse-Kingdoms/scripts/README.md` (documentation)

## Key Differences: reset-players.ts vs reset-dev.ts

| Feature | reset-players.ts | reset-dev.ts |
|---------|------------------|--------------|
| Players | ✅ Cleared | ✅ Cleared |
| Guilds | ✅ Cleared | ✅ Cleared |
| Heroes/Troops | ✅ Cleared | ✅ Cleared |
| NPCs | ❌ **Preserved** | ✅ Cleared |
| Map Tiles | ❌ **Preserved** | ✅ Cleared |
| Land Parcels | Structure preserved, ownership cleared | ✅ Cleared |

## Notes

- The start script uses the existing `npm run start:prod` command
- All scripts use the `.env` file for database configuration
- The reset-players script clears Redis cache to ensure clean state
- NPCs will remain at their positions with their rewards intact
- Map resources and terrain remain unchanged
