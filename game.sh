#!/bin/bash

# PopVerse Kingdoms - Game Management Helper

show_help() {
  cat << EOF
╔════════════════════════════════════════╗
║   PopVerse Kingdoms - Game Manager    ║
╚════════════════════════════════════════╝

Usage: ./game.sh [command]

Commands:
  start          Start the game
  stop           Stop the game
  restart        Restart the game
  status         Show game status
  logs           Show game logs
  reset-players  Reset player data (keep NPCs & map)
  reset-all      Reset everything (dev only)
  help           Show this help message

Examples:
  ./game.sh start
  ./game.sh logs
  ./game.sh reset-players

EOF
}

case "$1" in
  start)
    ./scripts/start.sh
    ;;
  stop)
    ./scripts/stop.sh
    ;;
  restart)
    ./scripts/stop.sh
    sleep 2
    ./scripts/start.sh
    ;;
  status)
    docker ps | grep "popverse"
    ;;
  logs)
    docker logs -f popverse_app
    ;;
  reset-players)
    echo "⚠️  This will delete all player data but keep NPCs and map!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      docker exec popverse_app npm run reset:players
    else
      echo "Cancelled."
    fi
    ;;
  reset-all)
    echo "⚠️  This will delete EVERYTHING including NPCs and map!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      docker exec popverse_app npm run reset:full
    else
      echo "Cancelled."
    fi
    ;;
  help|--help|-h|"")
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run './game.sh help' for usage information"
    exit 1
    ;;
esac
