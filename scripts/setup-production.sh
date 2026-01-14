#!/bin/bash
set -e

echo "🎮 PopVerse Kingdoms - Production Setup Wizard"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run as root${NC}"
    exit 1
fi

echo -e "${BLUE}This wizard will help you set up PopVerse Kingdoms for production.${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
./scripts/check-prod-ready.sh || {
    echo -e "${RED}Prerequisites check failed. Please fix the issues above.${NC}"
    exit 1
}
echo ""

# Step 2: Configure environment
echo -e "${YELLOW}Step 2: Environment Configuration${NC}"
if [ ! -f .env.prod ]; then
    echo "Creating .env.prod from template..."
    cp .env.prod.example .env.prod
    echo -e "${GREEN}✓ Created .env.prod${NC}"
else
    echo -e "${GREEN}✓ .env.prod already exists${NC}"
fi

echo ""
echo -e "${BLUE}Please configure the following in .env.prod:${NC}"
echo "  1. DISCORD_TOKEN - Your Discord bot token"
echo "  2. DISCORD_CLIENT_ID - Your Discord application client ID"
echo "  3. DISCORD_GUILD_ID - Your Discord server ID"
echo "  4. DB_PASSWORD - Database password"
echo "  5. REDIS_PASSWORD - Redis password"
echo "  6. JWT_SECRET - JWT secret (32+ characters)"
echo "  7. GRAFANA_PASSWORD - Grafana admin password"
echo ""

read -p "Open .env.prod in editor now? (y/n): " edit_env
if [ "$edit_env" = "y" ]; then
    ${EDITOR:-nano} .env.prod
fi

echo ""
read -p "Have you configured all required values in .env.prod? (y/n): " configured
if [ "$configured" != "y" ]; then
    echo -e "${YELLOW}Please configure .env.prod and run this script again.${NC}"
    exit 0
fi

# Step 3: Generate secure passwords if needed
echo ""
echo -e "${YELLOW}Step 3: Security Setup${NC}"
read -p "Generate secure random passwords? (y/n): " gen_passwords
if [ "$gen_passwords" = "y" ]; then
    echo ""
    echo "Copy these passwords to your .env.prod:"
    echo "----------------------------------------"
    echo "DB_PASSWORD=$(openssl rand -base64 32)"
    echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
    echo "JWT_SECRET=$(openssl rand -base64 48)"
    echo "GRAFANA_PASSWORD=$(openssl rand -base64 16)"
    echo "----------------------------------------"
    echo ""
    read -p "Press Enter after updating .env.prod..."
fi

# Step 4: Build application
echo ""
echo -e "${YELLOW}Step 4: Building application...${NC}"
npm install
npm run build
echo -e "${GREEN}✓ Application built${NC}"

# Step 5: Create required directories
echo ""
echo -e "${YELLOW}Step 5: Creating directories...${NC}"
mkdir -p logs backups nginx/ssl
echo -e "${GREEN}✓ Directories created${NC}"

# Step 6: Docker network
echo ""
echo -e "${YELLOW}Step 6: Setting up Docker network...${NC}"
docker network create popverse_network 2>/dev/null || echo "Network already exists"
echo -e "${GREEN}✓ Docker network ready${NC}"

# Step 7: Firewall setup
echo ""
echo -e "${YELLOW}Step 7: Firewall Configuration${NC}"
read -p "Configure firewall (ufw)? (y/n): " setup_firewall
if [ "$setup_firewall" = "y" ]; then
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ Skipped firewall setup${NC}"
fi

# Step 8: SSL Setup
echo ""
echo -e "${YELLOW}Step 8: SSL/TLS Setup${NC}"
read -p "Do you have a domain name for SSL? (y/n): " has_domain
if [ "$has_domain" = "y" ]; then
    read -p "Enter your domain name: " domain
    read -p "Install SSL certificate with Certbot? (y/n): " install_ssl
    if [ "$install_ssl" = "y" ]; then
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
        echo -e "${GREEN}✓ Certbot installed${NC}"
        echo ""
        echo "After deployment, run:"
        echo "  sudo certbot --nginx -d $domain"
    fi
else
    echo -e "${YELLOW}⚠ Skipped SSL setup - you can set this up later${NC}"
fi

# Step 9: Backup cron job
echo ""
echo -e "${YELLOW}Step 9: Automated Backups${NC}"
read -p "Set up daily database backups? (y/n): " setup_backups
if [ "$setup_backups" = "y" ]; then
    CRON_JOB="0 2 * * * cd $(pwd) && ./scripts/backup-db.sh"
    (crontab -l 2>/dev/null | grep -v "backup-db.sh"; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}✓ Daily backups scheduled at 2 AM${NC}"
else
    echo -e "${YELLOW}⚠ Skipped backup setup${NC}"
fi

# Step 10: Final check
echo ""
echo -e "${YELLOW}Step 10: Final readiness check...${NC}"
./scripts/check-prod-ready.sh

# Summary
echo ""
echo "=============================================="
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Review your configuration in .env.prod"
echo "  2. Deploy to production:"
echo "     ${BLUE}./scripts/deploy-prod.sh${NC}"
echo ""
echo "After deployment:"
echo "  - Access Grafana: http://your-server:3001"
echo "  - Access Prometheus: http://your-server:9090"
echo "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "Documentation:"
echo "  - Production Guide: PRODUCTION.md"
echo "  - Development Guide: DEVELOPMENT.md"
echo ""
