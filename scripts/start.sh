#!/bin/bash

echo "🚀 Starting PopVerse Kingdoms..."

cd "$(dirname "$0")/.."

if docker ps | grep -q "popverse_app"; then
  echo "⚠️  Game is already running."
  docker ps | grep "popverse"
else
  docker compose -f docker-compose.prod.yml up -d
  echo "✅ Game started successfully!"
fi
