# Accessing Grafana & Prometheus from Your PC

Since Grafana and Prometheus are running on your VPS (localhost), you need to create SSH tunnels to access them from your local PC.

## Option 1: SSH Tunnel (Recommended)

On your **local PC**, open a terminal and run:

```bash
# Tunnel both Grafana and Prometheus
ssh -L 3001:localhost:3001 -L 9090:localhost:9090 your-username@your-vps-ip

# Replace:
# - your-username: your VPS username
# - your-vps-ip: your VPS IP address
```

Keep this terminal open. Then open in your browser:
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

### Login Credentials
- **Grafana**: 
  - Username: `admin`
  - Password: Check `GRAFANA_PASSWORD` in your `.env.prod` file on the VPS

## Option 2: Individual Tunnels

If you prefer separate terminals:

```bash
# Terminal 1 - Grafana
ssh -L 3001:localhost:3001 your-username@your-vps-ip

# Terminal 2 - Prometheus  
ssh -L 9090:localhost:9090 your-username@your-vps-ip
```

## Option 3: Background Tunnel

To run the tunnel in the background:

```bash
ssh -f -N -L 3001:localhost:3001 -L 9090:localhost:9090 your-username@your-vps-ip
```

To close background tunnels later:
```bash
# Find the process
ps aux | grep "ssh -f -N -L"

# Kill it
kill <process-id>
```

## Troubleshooting

### "Port already in use"
Something on your PC is using port 3001 or 9090. Use different local ports:
```bash
ssh -L 3002:localhost:3001 -L 9091:localhost:9090 your-username@your-vps-ip
```
Then access: http://localhost:3002 and http://localhost:9091

### "Connection refused"
Make sure the services are running on the VPS:
```bash
docker ps | grep -E "grafana|prometheus"
```

### Can't connect to VPS
Check your SSH connection first:
```bash
ssh your-username@your-vps-ip
```

## Alternative: Expose Ports (Less Secure)

If you want direct access without SSH tunnels, you can expose the ports in docker-compose.monitoring.yml:

```yaml
# Change from:
ports:
  - "3001:3000"  # Only accessible from localhost

# To:
ports:
  - "0.0.0.0:3001:3000"  # Accessible from anywhere
```

⚠️ **Warning**: This exposes Grafana to the internet. Make sure to:
1. Use strong passwords
2. Set up a firewall
3. Consider using a VPN or IP whitelist

## Quick Test

After setting up the tunnel, test it:
```bash
curl http://localhost:3001/api/health
curl http://localhost:9090/-/healthy
```

Both should return success responses.
