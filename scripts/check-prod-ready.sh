#!/bin/bash

echo "🔍 PopVerse Kingdoms - Production Readiness Checklist"
echo "====================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

ERRORS=0
WARNINGS=0

# 1. Check .env.prod file
echo "1. Environment Configuration"
if [ -f .env.prod ]; then
    check_pass ".env.prod file exists"
    
    # Check for default passwords
    if grep -q "CHANGE_THIS" .env.prod; then
        check_fail "Default passwords found in .env.prod - MUST CHANGE!"
        ERRORS=$((ERRORS + 1))
    else
        check_pass "No default passwords found"
    fi
    
    # Check Discord token
    if grep -q "your_production_discord_bot_token" .env.prod; then
        check_fail "Discord token not configured"
        ERRORS=$((ERRORS + 1))
    else
        check_pass "Discord token configured"
    fi
else
    check_fail ".env.prod file missing"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Check Docker
echo "2. Docker Environment"
if command -v docker &> /dev/null; then
    check_pass "Docker installed"
    
    if docker ps &> /dev/null; then
        check_pass "Docker daemon running"
    else
        check_fail "Docker daemon not running"
        ERRORS=$((ERRORS + 1))
    fi
else
    check_fail "Docker not installed"
    ERRORS=$((ERRORS + 1))
fi

if command -v docker-compose &> /dev/null; then
    check_pass "Docker Compose installed"
else
    check_fail "Docker Compose not installed"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Check Node.js
echo "3. Node.js Environment"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        check_pass "Node.js version $(node -v) (>= 20 required)"
    else
        check_fail "Node.js version $(node -v) is too old (>= 20 required)"
        ERRORS=$((ERRORS + 1))
    fi
else
    check_fail "Node.js not installed"
    ERRORS=$((ERRORS + 1))
fi

if [ -d node_modules ]; then
    check_pass "Dependencies installed"
else
    check_warn "Dependencies not installed - run 'npm install'"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 4. Check build
echo "4. Application Build"
if [ -d dist ]; then
    check_pass "Build directory exists"
    
    if [ -f dist/index.js ]; then
        check_pass "Main entry point built"
    else
        check_warn "Build may be incomplete - run 'npm run build'"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    check_warn "Application not built - run 'npm run build'"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 5. Check directories
echo "5. Required Directories"
for dir in logs backups nginx monitoring; do
    if [ -d "$dir" ]; then
        check_pass "$dir/ directory exists"
    else
        check_warn "$dir/ directory missing - will be created on deployment"
        WARNINGS=$((WARNINGS + 1))
    fi
done
echo ""

# 6. Check scripts
echo "6. Deployment Scripts"
for script in scripts/deploy-prod.sh scripts/backup-db.sh scripts/restore-db.sh; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            check_pass "$script is executable"
        else
            check_warn "$script exists but not executable"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        check_fail "$script missing"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# 7. Check ports
echo "7. Port Availability"
for port in 80 3000 5432 6379 9090 3001; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        check_warn "Port $port is already in use"
        WARNINGS=$((WARNINGS + 1))
    else
        check_pass "Port $port is available"
    fi
done
echo ""

# 8. Check disk space
echo "8. System Resources"
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk space: ${DISK_USAGE}% used"
else
    check_warn "Disk space: ${DISK_USAGE}% used (consider cleanup)"
    WARNINGS=$((WARNINGS + 1))
fi

MEMORY=$(free -m | awk 'NR==2{printf "%.0f", $7*100/$2 }')
if [ "$MEMORY" -gt 20 ]; then
    check_pass "Available memory: ${MEMORY}%"
else
    check_warn "Low available memory: ${MEMORY}%"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "====================================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready for production deployment.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review and configure .env.prod"
    echo "  2. Run: ./scripts/deploy-prod.sh"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s) found. Review before deployment.${NC}"
    exit 0
else
    echo -e "${RED}✗ ${ERRORS} error(s) and ${WARNINGS} warning(s) found.${NC}"
    echo "Please fix errors before deploying to production."
    exit 1
fi
