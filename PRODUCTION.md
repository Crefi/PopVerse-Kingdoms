# PopVerse Kingdoms - Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Ubuntu/Debian VPS (2GB+ RAM recommended)
- Docker & Docker Compose installed
- Node.js 20+ installed
- Domain name (optional, for SSL)

### 1. Initial Setup

```bash
# Clone repository (if not already done)
git clone <your-repo-url>
cd PopVerse-Kingdoms

# Install dependencies
npm install

# Create production environment file
cp .env.prod.example .env.prod
nano .env.prod  # Edit with your configuration
```

### 2. Configure Environment

Edit `.env.prod` and set:

**Critical Settings:**
- `DISCORD_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_GUILD_ID` - Your Discord server ID
- `DB_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Strong Redis password
- `JWT_SECRET` - Random 32+ character string
- `GRAFANA_PASSWORD` - Grafana admin password

**Generate secure passwords:**
```bash
# Generate random passwords
openssl rand -base64 32
```

### 3. Run Production Readiness Check

```bash
./scripts/check-prod-ready.sh
```

Fix any errors before proceeding.

### 4. Deploy to Production

```bash
./scripts/deploy-prod.sh
```

This will:
- Build the application
- Start all services (PostgreSQL, Redis, App, Nginx)
- Run database migrations
- Start monitoring stack (Prometheus, Grafana)
- Perform health checks

## 📊 Monitoring & Observability

### Access Monitoring Tools

- **Grafana Dashboard**: http://your-server:3001
  - Username: `admin`
  - Password: (from `.env.prod` GRAFANA_PASSWORD)
  
- **Prometheus**: http://your-server:9090

- **Application API**: http://your-server/api

### Key Metrics to Monitor

1. **Application Metrics** (`/metrics` endpoint)
   - Command execution rate and duration
   - Battle resolution times
   - Active players and guilds
   - Error rates

2. **System Metrics** (Node Exporter)
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network traffic

3. **Database Metrics** (Postgres Exporter)
   - Query performance
   - Connection pool usage
   - Transaction rates

4. **Cache Metrics** (Redis Exporter)
   - Hit/miss rates
   - Memory usage
   - Key evictions

### Setting Up Grafana Dashboards

1. Login to Grafana (http://your-server:3001)
2. Go to Dashboards → Import
3. Import these dashboard IDs:
   - **1860** - Node Exporter Full
   - **763** - Redis Dashboard
   - **9628** - PostgreSQL Database

## 🔒 Security Best Practices

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (if using SSL)
sudo ufw enable
```

### SSL/TLS Setup (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Update nginx/nginx.conf to use SSL
```

### Regular Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.monitoring.yml pull
```

## 💾 Backup & Recovery

### Automated Backups

Set up daily backups with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /home/alexlv/PopVerse-Kingdoms && ./scripts/backup-db.sh
```

### Manual Backup

```bash
./scripts/backup-db.sh
```

Backups are stored in `./backups/` and kept for 7 days.

### Restore from Backup

```bash
./scripts/restore-db.sh backups/db_backup_YYYYMMDD_HHMMSS.sql.gz
```

## 🔧 Maintenance Commands

### View Logs

```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f app

# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### Restart Services

```bash
# Restart application only
docker-compose -f docker-compose.prod.yml restart app

# Restart all services
docker-compose -f docker-compose.prod.yml restart

# Restart monitoring
docker-compose -f docker-compose.monitoring.yml restart
```

### Stop Services

```bash
# Stop application
docker-compose -f docker-compose.prod.yml down

# Stop monitoring
docker-compose -f docker-compose.monitoring.yml down

# Stop everything
docker-compose -f docker-compose.prod.yml down && \
docker-compose -f docker-compose.monitoring.yml down
```

### Database Migrations

```bash
# Run new migrations
npm run db:migrate:prod

# Rollback last migration
npm run db:rollback
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Restart services
docker-compose -f docker-compose.prod.yml restart app
```

## 📈 Performance Optimization

### Database Optimization

```bash
# Connect to database
docker exec -it popverse_postgres psql -U popverse_user popverse_kingdoms

# Analyze tables
ANALYZE;

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### Redis Optimization

```bash
# Connect to Redis
docker exec -it popverse_redis redis-cli -a YOUR_REDIS_PASSWORD

# Check memory usage
INFO memory

# Check hit rate
INFO stats
```

### Application Scaling

Edit `ecosystem.config.cjs` to adjust PM2 clustering:

```javascript
instances: 'max',  // Use all CPU cores
// or
instances: 4,      // Use specific number
```

## 🚨 Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs app

# Check database connection
docker exec popverse_postgres pg_isready -U popverse_user

# Check Redis connection
docker exec popverse_redis redis-cli -a YOUR_REDIS_PASSWORD ping
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart application
docker-compose -f docker-compose.prod.yml restart app
```

### Database Connection Issues

```bash
# Check database is running
docker ps | grep postgres

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Restart database
docker-compose -f docker-compose.prod.yml restart postgres
```

### Discord Bot Not Responding

```bash
# Check bot logs
docker-compose -f docker-compose.prod.yml logs app | grep -i discord

# Verify Discord token in .env.prod
# Restart application
docker-compose -f docker-compose.prod.yml restart app
```

## 📞 Support & Monitoring Alerts

### Set Up Alerts

Configure Grafana alerts for:
- High CPU usage (>80%)
- High memory usage (>90%)
- High error rate (>10 errors/min)
- Database connection failures
- Redis connection failures

### Health Check Endpoint

```bash
# Check application health
curl http://localhost/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-14T12:00:00.000Z"}
```

## 🎯 Production Checklist

Before going live:

- [ ] All passwords changed from defaults
- [ ] Discord bot token configured
- [ ] Database backups scheduled
- [ ] Monitoring dashboards configured
- [ ] Firewall rules applied
- [ ] SSL certificate installed (if using domain)
- [ ] Health checks passing
- [ ] Logs being collected
- [ ] Alerts configured
- [ ] Documentation reviewed

## 📚 Additional Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Docker Documentation](https://docs.docker.com/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)

---

**Need Help?** Check the logs first, then review this guide. Most issues are related to configuration or resource constraints.
