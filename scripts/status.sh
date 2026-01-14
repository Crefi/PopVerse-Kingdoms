#!/bin/bash

echo "🎮 PopVerse Kingdoms - Status Check"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if services are running
echo -e "${BLUE}Service Status:${NC}"

if docker ps --format '{{.Names}}' | grep -q "popverse_app"; then
    echo -e "${GREEN}✓${NC} Application: Running"
    APP_STATUS=$(docker inspect popverse_app --format='{{.State.Status}}')
    echo "  Status: $APP_STATUS"
else
    echo -e "${RED}✗${NC} Application: Not running"
fi

if docker ps --format '{{.Names}}' | grep -q "popverse_postgres"; then
    echo -e "${GREEN}✓${NC} PostgreSQL: Running"
else
    echo -e "${RED}✗${NC} PostgreSQL: Not running"
fi

if docker ps --format '{{.Names}}' | grep -q "popverse_redis"; then
    echo -e "${GREEN}✓${NC} Redis: Running"
else
    echo -e "${RED}✗${NC} Redis: Not running"
fi

if docker ps --format '{{.Names}}' | grep -q "popverse_nginx"; then
    echo -e "${GREEN}✓${NC} Nginx: Running"
else
    echo -e "${RED}✗${NC} Nginx: Not running"
fi

if docker ps --format '{{.Names}}' | grep -q "popverse_grafana"; then
    echo -e "${GREEN}✓${NC} Grafana: Running"
else
    echo -e "${YELLOW}⚠${NC} Grafana: Not running (monitoring not started)"
fi

if docker ps --format '{{.Names}}' | grep -q "popverse_prometheus"; then
    echo -e "${GREEN}✓${NC} Prometheus: Running"
else
    echo -e "${YELLOW}⚠${NC} Prometheus: Not running (monitoring not started)"
fi

echo ""
echo -e "${BLUE}Health Checks:${NC}"

# Check application health
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Application health: OK"
else
    echo -e "${RED}✗${NC} Application health: Failed"
fi

# Check database
if docker exec popverse_postgres pg_isready -U popverse_user > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database connection: OK"
else
    echo -e "${RED}✗${NC} Database connection: Failed"
fi

# Check Redis
if [ -f .env.prod ]; then
    REDIS_PASSWORD=$(grep REDIS_PASSWORD .env.prod | cut -d'=' -f2)
    if docker exec popverse_redis redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis connection: OK"
    else
        echo -e "${RED}✗${NC} Redis connection: Failed"
    fi
fi

echo ""
echo -e "${BLUE}Resource Usage:${NC}"

# CPU and Memory
if command -v docker &> /dev/null; then
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep popverse || echo "No containers running"
fi

echo ""
echo -e "${BLUE}Recent Logs (last 10 lines):${NC}"
if docker ps --format '{{.Names}}' | grep -q "popverse_app"; then
    docker logs popverse_app --tail 10 2>&1 | sed 's/^/  /'
else
    echo "  Application not running"
fi

echo ""
echo -e "${BLUE}Quick Actions:${NC}"
echo "  View logs:    docker-compose -f docker-compose.prod.yml logs -f app"
echo "  Restart app:  docker-compose -f docker-compose.prod.yml restart app"
echo "  Stop all:     docker-compose -f docker-compose.prod.yml down"
echo "  Grafana:      http://localhost:3001"
echo "  Prometheus:   http://localhost:9090"
echo ""
