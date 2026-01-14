#!/bin/bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

echo "🗄️  Creating database backup..."

# Load environment variables
export $(cat .env.prod | grep -v '^#' | xargs)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
docker exec popverse_postgres pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo "✓ Backup created: ${BACKUP_FILE}.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "✓ Old backups cleaned up"
