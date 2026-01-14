# Known Issue: Map Seed Failing

## Problem
The map generation seed (`001_generate_map.ts`) is trying to create NPCs with type `temple_guardian`, but the database only supports 3 NPC types:
- `bandit_camp`
- `goblin_outpost`
- `dragon_lair`

## Current Status
- ✅ Map tiles are created (10,000 tiles for 100x100 map)
- ❌ NPCs are not being created (seed fails)
- ✅ All other database tables exist and are ready

## Impact
- The `/map` Discord command will show an empty map (no NPCs)
- Players can still use other commands like `/profile`, `/help`
- The game is partially functional

## Fix Required
The seed file at `src/infrastructure/database/seeds/001_generate_map.ts` has been updated to remove `temple_guardian` references, but due to Docker layer caching, the compiled version in the container still has the old code.

### To Fix:
1. Delete the Docker volumes and rebuild from scratch:
   ```bash
   docker-compose -f docker-compose.prod.yml down -v
   docker system prune -a
   rm -rf dist
   npm run build
   docker-compose -f docker-compose.prod.yml build --no-cache
   docker-compose -f docker-compose.prod.yml up -d
   docker exec popverse_app node node_modules/.bin/knex seed:run --env production
   ```

2. Or manually insert some NPCs for testing:
   ```sql
   docker exec -it popverse_postgres psql -U popverse_user -d popverse_kingdoms
   
   INSERT INTO npcs (coord_x, coord_y, name, power, rewards, troops, type) VALUES
   (10, 10, 'Bandit Camp', 1000, '{"gold": 100, "resources": 50}', '{"infantry": 50}', 'bandit_camp'),
   (20, 20, 'Goblin Outpost', 2000, '{"gold": 200, "resources": 100}', '{"infantry": 100}', 'goblin_outpost'),
   (30, 30, 'Dragon Lair', 5000, '{"gold": 500, "resources": 250}', '{"infantry": 200}', 'dragon_lair');
   ```

## Workaround
For now, the app is deployed and functional for Discord commands that don't require NPCs. The map will be empty until the seed runs successfully.
