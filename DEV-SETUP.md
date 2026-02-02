# Development Setup Guide

Quick guide to get PopVerse Kingdoms running locally on your machine.

## Prerequisites

- Node.js 20+ (you have v22.15.0 ✓)
- Docker and Docker Compose
- System libraries for canvas (Fedora/RHEL):
  ```bash
  sudo dnf install cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel
  ```

## First Time Setup

### 1. Install Dependencies

```bash
npm install
```

If you get canvas build errors, make sure you installed the system libraries above.

### 2. Configure Environment

The app uses `.env.dev` for development (not `.env`):

```bash
# Copy the example
cp .env.example .env.dev
```

Edit `.env.dev` with your settings:

```env
NODE_ENV=development

# Get these from Discord Developer Portal
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_test_server_id_here

# Database (matches docker-compose.dev.yml)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=popverse_kingdoms_dev
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis (matches docker-compose.dev.yml)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Web Dashboard (optional)
WEB_ENABLED=true
WEB_PORT=3000
JWT_SECRET=your_random_secret_here
JWT_EXPIRES_IN=7d

# Game Settings
MAP_SIZE=100
SEASON_DURATION_DAYS=90
CONQUEST_DAY=saturday
CONQUEST_HOUR=20
```

### 3. Start Docker Services

```bash
npm run docker:dev
```

This starts PostgreSQL (port 5433), Redis (port 6379), and Adminer (port 8080).

Wait a few seconds for containers to be ready, then verify:
```bash
docker ps
```

### 4. Setup Database

```bash
# Run migrations (creates tables)
npm run db:migrate:dev

# Seed data (creates map, heroes, NPCs)
npm run db:seed:dev
```

### 5. Start Development Server

```bash
npm run dev
```

The bot should now connect to Discord and register slash commands.

## Daily Development

After initial setup, you only need:

```bash
# Start Docker (if not running)
npm run docker:dev

# Start dev server
npm run dev
```

## Troubleshooting

### Docker Container Conflicts

If you get "container name already in use":

```bash
# Remove old containers
docker rm -f popverse_postgres_dev popverse_redis_dev popverse_adminer_dev

# Or use compose down
docker compose -f docker-compose.dev.yml down

# Start fresh
npm run docker:dev
```

### Database Connection Refused

Make sure:
1. Docker containers are running: `docker ps`
2. You're using `.env.dev` (not `.env`)
3. DB_PORT is `5433` (not 5432)
4. DB_HOST is `localhost` (not `postgres`)

### Missing Discord Token Error

The app requires valid Discord credentials. Get them from:
https://discord.com/developers/applications

Create a bot, copy the token, and add it to `.env.dev`.

### Canvas Build Errors

Install system dependencies:
```bash
sudo dnf install cairo-devel pango-devel libjpeg-turbo-devel giflib-devel pixman-devel
```

Then reinstall:
```bash
rm -rf node_modules
npm install
```

## Useful Commands

```bash
# Database
npm run db:migrate:dev      # Run migrations
npm run db:seed:dev         # Seed data
npm run db:rollback         # Rollback last migration

# Docker
npm run docker:dev          # Start containers
npm run docker:dev:down     # Stop containers
docker logs -f popverse_postgres_dev  # View logs

# Development
npm run dev                 # Start with hot reload
npm run build               # Compile TypeScript
npm test                    # Run tests

# Map Analysis & Debugging
npx tsx scripts/analyze-map-distribution.ts  # Analyze map distribution
npx tsx scripts/check-map-data.ts            # Quick map status check
npx tsx scripts/regenerate-map.ts            # Regenerate entire map
npx tsx scripts/clear-cache.ts               # Clear Redis cache

# Database Access
# Via Adminer: http://localhost:8080
# Server: popverse_postgres_dev
# Username: postgres
# Password: postgres
# Database: popverse_kingdoms_dev

# Via psql:
docker exec -it popverse_postgres_dev psql -U postgres -d popverse_kingdoms_dev
```

## Project Structure

```
src/
├── domain/              # Business logic
├── infrastructure/      # Database, Redis, Discord
├── presentation/        # Discord commands
└── shared/             # Config, types, utilities
```

## Next Steps

- Invite your bot to a test Discord server
- Run `/begin` to start playing
- Check DEVELOPMENT.md for more detailed documentation
