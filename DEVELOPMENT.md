# PopVerse Kingdoms - Development Guide

## Quick Start

```bash
# 1. Start Docker containers (PostgreSQL, Redis, Adminer)
docker-compose -f docker-compose.dev.yml up -d

# 2. Run database migrations
npm run migrate

# 3. Seed the database (map, heroes, etc.)
npm run seed

# 4. Start the development server
npm run dev
```

## Environment Setup

### Required Files
- `.env.dev` - Development environment variables
- `.env.prod` - Production environment variables

### Environment Variables
```env
NODE_ENV=development
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_test_server_id
DATABASE_URL=postgresql://popverse:popverse_dev@localhost:5432/popverse_dev
REDIS_URL=redis://localhost:6379
```

## Docker Commands

### Start Services
```bash
# Start all dev containers (PostgreSQL, Redis, Adminer)
docker-compose -f docker-compose.dev.yml up -d

# Start with logs visible
docker-compose -f docker-compose.dev.yml up
```

### Stop Services
```bash
# Stop containers (keeps data)
docker-compose -f docker-compose.dev.yml stop

# Stop and remove containers (keeps volumes/data)
docker-compose -f docker-compose.dev.yml down

# Stop and remove everything including data
docker-compose -f docker-compose.dev.yml down -v
```

### View Container Status
```bash
docker ps
docker-compose -f docker-compose.dev.yml ps
```

### View Logs
```bash
# All containers
docker-compose -f docker-compose.dev.yml logs

# Specific container
docker logs popverse_postgres_dev
docker logs popverse_redis_dev

# Follow logs in real-time
docker logs -f popverse_postgres_dev
```

## Database Commands

### Migrations
```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Check migration status
npx knex migrate:status
```

### Seeds
```bash
# Run all seeds
npm run seed

# Run specific seed
npx knex seed:run --specific=001_generate_map.ts
npx knex seed:run --specific=002_hero_templates.ts
```

### Database Access
```bash
# Connect via psql
docker exec -it popverse_postgres_dev psql -U popverse -d popverse_dev

# Or use Adminer web UI
# Open http://localhost:8080
# System: PostgreSQL
# Server: popverse_postgres_dev
# Username: popverse
# Password: popverse_dev
# Database: popverse_dev
```

### Useful SQL Queries
```sql
-- Check all tables
\dt

-- View players
SELECT id, username, faction, coord_x, coord_y FROM players;

-- View map tiles with occupants
SELECT x, y, terrain, occupant_id FROM map_tiles WHERE occupant_id IS NOT NULL;

-- View NPCs
SELECT id, name, type, power, coord_x, coord_y FROM npcs;

-- View heroes
SELECT id, name, faction, element, level FROM heroes;

-- Reset a player's resources
UPDATE players SET resources = '{"food":10000,"iron":5000,"gold":2000}' WHERE discord_id = 'YOUR_DISCORD_ID';

-- Delete a player (for testing)
DELETE FROM players WHERE discord_id = 'YOUR_DISCORD_ID';
```

## NPM Scripts

### Development
```bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript
npm run start        # Run compiled code
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Run Prettier
```

### Database
```bash
npm run migrate      # Run migrations
npm run migrate:rollback  # Rollback migrations
npm run seed         # Run seeds
```

### Utilities
```bash
# Generate test players (for development)
npx tsx scripts/generate-test-players.ts

# Reset development database
npx tsx scripts/reset-dev.ts

# Setup a test user with max everything (resources, heroes, buildings, etc.)
npx tsx scripts/setup-test-user.ts YOUR_DISCORD_ID

# Check map data status (terrain distribution, NPCs, etc.)
npx tsx scripts/check-map-data.ts

# Regenerate map with terrain and NPCs (preserves player positions)
npx tsx scripts/regenerate-map.ts

# Respawn NPCs only (without regenerating terrain)
npx tsx scripts/respawn-npcs.ts

# Clear Redis cache (map images, etc.)
npx tsx scripts/clear-cache.ts
```

### Clear Old Discord Commands
If you see old commands from another bot, clear them:
```bash
# Add this to a file called scripts/clear-commands.ts and run it
# Or run directly in Node REPL with your bot token
```

## Troubleshooting

### "ECONNREFUSED" - Database Connection Failed
**Cause:** Docker containers not running

**Solution:**
```bash
docker-compose -f docker-compose.dev.yml up -d
# Wait a few seconds for containers to initialize
sleep 5
npm run dev
```

### "relation does not exist" - Missing Tables
**Cause:** Migrations haven't been run

**Solution:**
```bash
npm run migrate
npm run seed
```

### "Invalid token" - Discord Bot Won't Start
**Cause:** Missing or invalid Discord token

**Solution:**
1. Check `.env.dev` has correct `DISCORD_TOKEN`
2. Verify token at Discord Developer Portal
3. Regenerate token if needed

### "Missing Access" - Bot Can't See Server
**Cause:** Bot not invited or missing permissions

**Solution:**
1. Invite bot with proper permissions (Administrator recommended for dev)
2. Check `DISCORD_GUILD_ID` matches your test server

### Port Already in Use
**Cause:** Another process using the port

**Solution:**
```bash
# Find what's using port 5432 (PostgreSQL)
lsof -i :5432

# Kill the process
kill -9 <PID>

# Or change ports in docker-compose.dev.yml
```

### Redis Connection Issues
```bash
# Test Redis connection
docker exec -it popverse_redis_dev redis-cli ping
# Should return: PONG

# Clear Redis cache
docker exec -it popverse_redis_dev redis-cli FLUSHALL
```

### Map Not Showing Terrain/NPCs/Resources (Plain Green Tiles)
**Cause:** Map data in database is missing or corrupted. The map only has plain tiles without terrain variety, NPCs, or resources.

**Diagnosis:**
```bash
# Check map data status
npx tsx scripts/check-map-data.ts
```

If you see only "plains" terrain or "Tiles with NPCs: 0", the map needs regeneration.

**Solution:**
```bash
# 1. Regenerate the map (preserves player positions)
npx tsx scripts/regenerate-map.ts

# 2. Clear the image cache
npx tsx scripts/clear-cache.ts

# 3. Restart the bot
npm run dev
```

After running `/map`, you should see varied terrain (forests, mountains, lakes, gold mines) and NPCs (monsters).

### TypeScript Compilation Errors
```bash
# Clean and rebuild
rm -rf dist
npm run build

# Check for type errors
npx tsc --noEmit
```

### Slash Commands Not Showing
**Cause:** Commands not registered with Discord

**Solution:**
1. Restart the bot (commands register on startup)
2. Wait up to 1 hour for global commands
3. For guild commands, they should appear immediately

## Project Structure

```
├── src/
│   ├── domain/           # Business logic
│   │   ├── entities/     # Domain models (Player, Hero, etc.)
│   │   └── services/     # Business services
│   ├── infrastructure/   # External integrations
│   │   ├── database/     # PostgreSQL (migrations, seeds)
│   │   ├── cache/        # Redis caching
│   │   └── discord/      # Discord.js client
│   ├── presentation/     # User interface
│   │   └── discord/      # Discord commands
│   └── shared/           # Shared utilities
│       ├── config/       # Configuration
│       ├── constants/    # Game constants
│       ├── errors/       # Error types
│       └── types/        # TypeScript types
├── tests/                # Test files
├── scripts/              # Utility scripts
└── .kiro/specs/          # Feature specifications
```

## Discord Commands Reference

| Command | Description |
|---------|-------------|
| `/begin` | Start playing, choose faction |
| `/city` | View your city status |
| `/map` | View the world map |
| `/build` | Construct/upgrade buildings |
| `/train` | Train troops |
| `/attack` | Attack a location |
| `/scout` | Scout a location |
| `/heroes` | Manage your heroes |
| `/arena` | Arena PvP battles |
| `/guild` | Guild management |
| `/rally` | Guild rally attacks |
| `/guildquests` | Guild daily quests |
| `/land` | Land management |
| `/research` | Research technologies |
| `/daily` | Daily rewards and quests |
| `/tutorial` | Tutorial system |
| `/help` | Show help |

## Useful Links

- **Adminer (DB UI):** http://localhost:8080
- **Web Dashboard API:** http://localhost:3000 (when enabled)
- **Discord Developer Portal:** https://discord.com/developers/applications
- **Discord.js Docs:** https://discord.js.org
- **Knex.js Docs:** https://knexjs.org

## Web Dashboard

The web dashboard provides a React frontend with an interactive map, player stats, leaderboards, and real-time updates via WebSocket.

### Running the Web Dashboard

1. Start the backend API server (ensure `WEB_ENABLED=true` in `.env.dev`):
```bash
npm run dev
```

2. In a separate terminal, start the React frontend:
```bash
cd web-dashboard
npm install  # First time only
npm run dev
```

3. Open http://localhost:5173 in your browser

4. Login using:
   - Discord OAuth (click "Login with Discord")
   - Dev Login (enter your Discord ID - you must have registered via `/begin` first)

### Enabling the Web Dashboard

Set `WEB_ENABLED=true` in your `.env.dev` file:

```env
WEB_PORT=3000
WEB_ENABLED=true
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
```

### API Endpoints

#### Authentication
- `GET /api/auth/discord` - Get Discord OAuth URL
- `GET /api/auth/discord/callback` - Discord OAuth callback
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/dev-login` - Development-only login with Discord ID

#### Map Data
- `GET /api/map/region/:x/:y/:size` - Get map tiles in a region
- `GET /api/map/tile/:x/:y` - Get single tile details
- `GET /api/map/cities` - Get all player cities
- `GET /api/map/lands` - Get all land parcels
- `GET /api/map/npcs` - Get all NPCs
- `GET /api/map/search/player/:name` - Search players by name

#### Player Data
- `GET /api/player/me` - Get current player's full profile
- `GET /api/player/:id` - Get another player's public profile
- `GET /api/player/me/battles` - Get battle history
- `GET /api/player/me/arena` - Get arena stats

#### Marches
- `GET /api/marches/active` - Get all active marches (for map visualization)
- `GET /api/marches/me` - Get current player's marches
- `GET /api/marches/incoming` - Get incoming attacks
- `GET /api/marches/:id` - Get march details

#### Leaderboards
- `GET /api/leaderboard/arena` - Arena rankings
- `GET /api/leaderboard/power` - Power rankings
- `GET /api/leaderboard/guilds` - Guild rankings
- `GET /api/leaderboard/conquest` - Conquest event rankings
- `GET /api/leaderboard/factions` - Faction statistics

### WebSocket Events

Connect to the WebSocket server with a JWT token:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your_jwt_token' }
});

// Subscribe to map updates
socket.emit('subscribe:map', { x: 50, y: 50, size: 15 });

// Subscribe to march tracking
socket.emit('subscribe:marches');

// Subscribe to conquest updates
socket.emit('subscribe:conquest');

// Listen for events
socket.on('march:update', (data) => console.log('March update:', data));
socket.on('conquest:point:update', (data) => console.log('Control point:', data));
socket.on('map:tile:update', (data) => console.log('Tile update:', data));
```

### Testing the API

```bash
# Development login (get a token)
curl -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"discordId": "YOUR_DISCORD_ID"}'

# Use the token for authenticated requests
curl http://localhost:3000/api/player/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get map region
curl http://localhost:3000/api/map/region/50/50/15 \
  -H "Authorization: Bearer YOUR_TOKEN"
```
