#!/bin/bash

echo "🛑 Stopping PopVerse Kingdoms..."

cd "$(dirname "$0")/.."

if docker ps | grep -q "popverse_app"; then
  docker compose -f docker-compose.prod.yml down
  echo "✅ Game stopped successfully!"
else
  echo "⚠️  Game is not running."
fi
