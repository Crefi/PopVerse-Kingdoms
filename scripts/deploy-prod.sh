#!/bin/bash
set -e

echo "🚀 PopVerse Kingdoms - Production Deployment Script"
echo "=================================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo -e "${RED}Error: .env.prod file not found!${NC}"
    echo "Please copy .env.prod.example to .env.prod and configure it."
    exit 1
fi

# Load environment variables
export $(cat .env.prod | grep -v '^#' | xargs)

echo -e "${YELLOW}Step 1: Building application...${NC}"
npm run build

echo -e "${YELLOW}Step 2: Creating Docker network...${NC}"
docker network create popverse_network 2>/dev/null || echo "Network already exists"

echo -e "${YELLOW}Step 3: Starting production services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}Step 4: Waiting for database to be ready...${NC}"
sleep 10

echo -e "${YELLOW}Step 5: Running database migrations...${NC}"
docker exec popverse_app npm run db:migrate:prod

echo -e "${YELLOW}Step 6: Starting monitoring stack...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d

echo -e "${YELLOW}Step 7: Health check...${NC}"
sleep 5
if curl -f http://localhost:8082/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is healthy!${NC}"
else
    echo -e "${RED}✗ Health check failed!${NC}"
    echo "Check logs with: docker-compose -f docker-compose.prod.yml logs app"
    exit 1
fi

echo ""
echo -e "${GREEN}=================================================="
echo "✓ Deployment completed successfully!"
echo "==================================================${NC}"
echo ""
echo "Services:"
echo "  - Application: http://localhost:8082"
echo "  - Grafana: http://localhost:3001 (admin / \$GRAFANA_PASSWORD)"
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f app"
echo "  - Stop services: docker-compose -f docker-compose.prod.yml down"
echo "  - Restart app: docker-compose -f docker-compose.prod.yml restart app"
echo "  - Database backup: ./scripts/backup-db.sh"
echo ""
