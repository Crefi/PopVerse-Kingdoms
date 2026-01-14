#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore-db.sh <backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will restore the database from backup!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Load environment variables
export $(cat .env.prod | grep -v '^#' | xargs)

echo "Decompressing backup..."
gunzip -c $BACKUP_FILE > /tmp/restore.sql

echo "Restoring database..."
docker exec -i popverse_postgres psql -U $DB_USER $DB_NAME < /tmp/restore.sql

rm /tmp/restore.sql

echo "✓ Database restored successfully!"
