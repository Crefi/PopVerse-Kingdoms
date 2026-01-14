# PopVerse Kingdoms - Deployment Guide

## 🚀 Deployment Status: LIVE

All services are deployed and running successfully!

## 📍 Access URLs

### Main Application
- **Web API**: http://localhost:8082/api/
- **Health Check**: http://localhost:8082/health
- **Discord Bot**: Connected and running in your server

### Monitoring & Metrics
- **Grafana Dashboard**: http://localhost:3001
  - Username: `admin`
  - Password: Check `GRAFANA_PASSWORD` in `.env.prod`
  
- **Prometheus**: http://localhost:9090
- **Node Exporter**: http://localhost:9100/metrics
- **Redis Exporter**: http://localhost:9121/metrics
- **Postgres Exporter**: http://localhost:9187/metrics

## 🐳 Running Containers

```
popverse_app                 - Discord bot + Web API
popverse_postgres            - PostgreSQL database
popverse_redis               - Redis cache
popverse_nginx               - Reverse proxy
popverse_grafana             - Grafana dashboards
popverse_prometheus          - Metrics collection
popverse_node_exporter       - System metrics
popverse_redis_exporter      - Redis metrics
popverse_postgres_exporter   - Database metrics
```

## 🔧 Management Commands

### View Logs
```bash
# Application logs
docker logs -f popverse_app

# All services
docker-compose -f docker-compose.prod.yml logs -f

# Monitoring stack
docker-compose -f docker-compose.monitoring.yml logs -f
```

### Restart Services
```bash
# Restart app
docker restart popverse_app

# Restart all production services
docker-compose -f docker-compose.prod.yml restart

# Restart monitoring
docker-compose -f docker-compose.monitoring.yml restart
```

### Stop/Start
```bash
# Stop everything
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.monitoring.yml down

# Start everything
./scripts/deploy-prod.sh
docker-compose -f docker-compose.monitoring.yml up -d
```

### Database Operations
```bash
# Backup database
./scripts/backup-db.sh

# Restore database
./scripts/restore-db.sh <backup-file>

# Run migrations
docker exec popverse_app npm run db:migrate:prod

# Access database
docker exec -it popverse_postgres psql -U popverse_user -d popverse_kingdoms
```

## 🌐 Domain Setup (Optional)

### Do You Need a Domain?

**For local/testing**: No domain needed, use localhost URLs above

**For public access**: Yes, you'll need:
1. A domain name (e.g., popverse-kingdoms.com)
2. SSL certificate (free with Let's Encrypt)
3. Update nginx configuration for your domain
4. Point domain DNS to your server IP

### Benefits of a Domain:
- ✅ Professional URL for players
- ✅ HTTPS/SSL security
- ✅ Easier to share and remember
- ✅ Required for OAuth/Discord login on web dashboard

### Cost:
- Domain: ~$10-15/year
- SSL: Free (Let's Encrypt)

### If You Want a Domain:
1. Buy domain from Namecheap, Google Domains, etc.
2. Point A record to your server IP
3. Update nginx config with your domain
4. Run certbot for SSL certificate

**Recommendation**: Start without a domain for testing. Add one later if you want public web access.

## 🎮 Discord Bot Setup

### Current Status
✅ Bot is connected and running
⚠️ Command registration has permission warnings

### Fix Command Registration
If slash commands don't appear:
1. Go to Discord Developer Portal
2. Your application → OAuth2 → URL Generator
3. Select scopes: `bot` + `applications.commands`
4. Select bot permissions: Administrator (or specific permissions)
5. Use generated URL to re-invite bot to your server

### Test the Bot
Try these commands in your Discord server:
- `/help` - Show all commands
- `/profile` - View your player profile
- `/map` - View the game map
- `/leaderboard` - View top players

## 📊 Monitoring Setup

### Grafana First-Time Setup
1. Go to http://localhost:3001
2. Login with admin credentials
3. Prometheus datasource is auto-configured
4. Import dashboards from `monitoring/grafana/dashboards/`

### Key Metrics to Monitor
- Application response times
- Database connections
- Redis cache hit rate
- System CPU/Memory usage
- Discord bot events

## 🔒 Security Notes

1. **Change default passwords** in `.env.prod`
2. **Restrict Prometheus access** (uncomment allow/deny in nginx.conf)
3. **Enable firewall** to only allow necessary ports
4. **Regular backups** of database
5. **Keep Docker images updated**

## 🐛 Troubleshooting

### App won't start
```bash
docker logs popverse_app
# Check for database connection errors
```

### Database issues
```bash
docker exec popverse_postgres pg_isready -U popverse_user
```

### Redis issues
```bash
docker exec popverse_redis redis-cli -a "$REDIS_PASSWORD" ping
```

### Nginx 502 errors
```bash
docker logs popverse_nginx
# Check if app container is running
docker ps | grep popverse_app
```

## 📝 Next Steps

1. ✅ Test Discord bot commands in your server
2. ✅ Set up Grafana dashboards
3. ⏳ Decide on domain name (optional)
4. ⏳ Configure automated backups
5. ⏳ Set up monitoring alerts
6. ⏳ Invite players to test!

## 🆘 Support

Check logs first:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

Common issues are usually:
- Environment variables not set
- Port conflicts
- Database not migrated
- Discord bot permissions
