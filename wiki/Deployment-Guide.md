# Deployment Guide

Complete production deployment guide for the KeyData Asset Registration System (KARS).

> **Quick Start:** For a condensed version, see [QUICKSTART-PORTAINER.md](../QUICKSTART-PORTAINER.md) in the repository.

## 📋 Table of Contents

1. [Deployment Options](#deployment-options)
2. [Portainer Deployment](#portainer-deployment)
3. [GitHub Actions Setup](#github-actions-setup)
4. [Cloudflare Tunnel](#cloudflare-tunnel)
5. [Environment Configuration](#environment-configuration)
6. [SSL/TLS Setup](#ssltls-setup)
7. [Post-Deployment](#post-deployment)
8. [Monitoring](#monitoring)

## Deployment Options

### Option 1: Portainer + GitHub Actions (Recommended)

**Best for:**
- Production deployments
- Automated CI/CD
- Collaborative environments

**Features:**
- Automated builds on git push
- Container registry integration
- One-click rollback
- Health monitoring

**Time:** 15-20 minutes

### Option 2: Docker Compose

**Best for:**
- Small deployments
- Testing environments
- Single server setups

**Features:**
- Simple configuration
- Manual deployment
- Quick setup

**Time:** 5-10 minutes

### Option 3: Manual Deployment

**Best for:**
- Development
- Learning
- Custom setups

**Time:** 30+ minutes

---

## Portainer Deployment

### Prerequisites

- Portainer CE or BE running
- Docker host accessible
- GitHub account
- Cloudflare account (for custom domain)

### Step 1: Prepare Repository

1. **Fork or clone the repository**
   ```bash
   git clone https://github.com/humac/kars.git
   ```

2. **Enable GitHub Actions**
   - Go to repository **Settings**
   - **Actions** → **General**
   - Set "Workflow permissions" to "Read and write permissions"
   - Save

### Step 2: Create Portainer Stack

1. **Log in to Portainer**
2. **Select your environment**
3. **Go to Stacks** → **Add stack**
4. **Configure:**
   - **Name:** `asset-registration`
   - **Build method:** Web editor (or Git repository)

5. **Paste stack configuration:**
   - Copy content from `docker-compose.portainer.yml`
   - Or use Git repository method pointing to the file

6. **Set Environment Variables:**
   ```env
   GITHUB_REPOSITORY=humac/kars
   APP_PORT=8080
   JWT_SECRET=your-super-secret-random-string-minimum-32-chars
   ADMIN_EMAIL=admin@jvhlabs.com
   ```

   **Generate strong JWT_SECRET:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

7. **Deploy the stack**

8. **Verify containers are running:**
   - `asset-registration-backend` - Status: Running
   - `asset-registration-frontend` - Status: Running

### Step 3: Configure Webhook

1. **In your Portainer stack:**
   - Scroll to "Webhook" section
   - Click "Create a webhook"
   - Copy the webhook URL

2. **Add to GitHub:**
   - Go to repository **Settings**
   - **Secrets and variables** → **Actions**
   - **New repository secret:**
     - Name: `PORTAINER_WEBHOOK_URL`
     - Value: Paste webhook URL
   - Save

---

## GitHub Actions Setup

### Workflow Overview

The GitHub Actions workflow (`.github/workflows/deploy-portainer.yml`) automatically:

1. Builds Docker images for frontend and backend
2. Pushes images to GitHub Container Registry
3. Triggers Portainer webhook to deploy

### Manual Trigger

You can manually trigger deployment:

1. Go to **Actions** tab
2. Select "Deploy to Portainer"
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Run

### Automatic Deployment

Every push to `main` branch triggers automatic deployment:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Deployment starts automatically
```

### Monitor Deployment

1. **GitHub:** Actions tab → Watch workflow progress
2. **Portainer:** Stacks → asset-registration → View logs

---

## Cloudflare Tunnel

### Why Cloudflare Tunnel?

- **Zero-config SSL/TLS** - Automatic HTTPS
- **DDoS protection** - Enterprise-grade security
- **No open ports** - No inbound firewall rules needed
- **Global CDN** - Fast worldwide access

### Option 1: Dashboard Setup (Easiest)

1. **Go to Cloudflare Zero Trust**
   - Navigate to: https://one.dash.cloudflare.com/
   - **Networks** → **Tunnels**

2. **Create tunnel**
   - Click "Create a tunnel"
   - Name: `asset-registration`
   - Select "Cloudflared"
   - Save tunnel
   - **Copy the tunnel token**

3. **Add to Portainer stack**

   Edit your stack, add this service:
   ```yaml
   cloudflared:
     image: cloudflare/cloudflared:latest
     container_name: cloudflared-tunnel
     restart: unless-stopped
     command: tunnel --no-autoupdate run --token YOUR_TUNNEL_TOKEN_HERE
     networks:
       - asset-network
   ```

4. **Configure public hostname**
   - In Cloudflare tunnel settings
   - Click "Public Hostname" → "Add a public hostname"
   - **Subdomain:** `assets`
   - **Domain:** `jvhlabs.com`
   - **Service Type:** HTTP
   - **URL:** `asset-registration-frontend:80`
   - Save

5. **Update stack** in Portainer
   - Pull and redeploy

6. **Test access**
   - Visit: https://assets.jvhlabs.com
   - Should see the application

### Option 2: CLI Setup

1. **Install cloudflared**
   ```bash
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
   sudo chmod +x /usr/local/bin/cloudflared
   ```

2. **Authenticate**
   ```bash
   cloudflared tunnel login
   ```

3. **Create tunnel**
   ```bash
   cloudflared tunnel create asset-registration
   # Note the Tunnel ID
   ```

4. **Configure tunnel**
   - Edit `cloudflare-tunnel.yml`
   - Replace `YOUR_TUNNEL_ID_HERE` with actual ID
   - Update credentials path

5. **Create DNS record**
   ```bash
   cloudflared tunnel route dns asset-registration assets.jvhlabs.com
   ```

6. **Run as service**
   ```bash
   sudo cloudflared service install
   sudo systemctl start cloudflared
   sudo systemctl enable cloudflared
   ```

---

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_REPOSITORY` | Your GitHub repo | `humac/kars` |
| `APP_PORT` | Host port to expose | `8080` |
| `JWT_SECRET` | Secret for JWT tokens | (64+ char random string) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_EMAIL` | Email for auto-admin | None |
| `JWT_EXPIRES_IN` | Token expiration | `7d` |
| `NODE_ENV` | Environment mode | `production` |
| `DATA_DIR` | Database directory | `/app/data` |

### Setting in Portainer

1. Go to your stack
2. Scroll to "Environment variables"
3. Add/edit variables
4. Update stack

### Setting for Development

1. Copy `.env.example` to `.env`
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` with your values
   ```env
   JWT_SECRET=your-secret-here
   ADMIN_EMAIL=admin@example.com
   ```

---

## SSL/TLS Setup

### Via Cloudflare Tunnel (Recommended)

SSL/TLS is **automatic** with Cloudflare Tunnel:
- Cloudflare provides SSL certificate
- Automatic renewal
- A+ SSL rating
- Zero configuration needed

### Via Reverse Proxy

If not using Cloudflare Tunnel:

1. **Install Nginx** (on host)
2. **Get SSL certificate** (Let's Encrypt)
3. **Configure proxy:**
   ```nginx
   server {
       listen 443 ssl;
       server_name assets.jvhlabs.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

---

## Post-Deployment

### 1. Verify Application

**Check health:**
```bash
curl http://localhost:8080
# Should return frontend
```

```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok","message":"Asset Registration API is running"}
```

### 2. Create First Admin

**Option A: Register first**
1. Go to https://assets.jvhlabs.com
2. Click "Register"
3. Create account
4. First user = admin automatically

**Option B: Use ADMIN_EMAIL**
1. Set `ADMIN_EMAIL` in environment
2. Register with that email
3. Assigned admin role

### 3. Add Companies

Before users can register assets:

1. Login as admin
2. Go to **Company Management**
3. Add all client companies
4. Users can now select from dropdown

### 4. Setup Backups

**Automated backup script:**
```bash
#!/bin/bash
# Save as /opt/backups/backup-assets.sh

BACKUP_DIR="/opt/backups/asset-registration"
DATE=$(date +%Y%m%d)

# Create backup
docker run --rm \
  -v asset-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/asset-data-$DATE.tar.gz -C /data .

# Keep only last 30 days
find $BACKUP_DIR -name "asset-data-*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/asset-data-$DATE.tar.gz"
```

**Schedule with cron:**
```bash
# Run daily at 2 AM
0 2 * * * /opt/backups/backup-assets.sh
```

### 5. Configure Monitoring

**Health checks** (already configured):
- Backend: HTTP check on port 3001
- Frontend: HTTP check on port 80
- Interval: 30 seconds

**Portainer notifications:**
1. Go to Settings → Notifications
2. Add webhook or email
3. Configure for container status changes

---

## Monitoring

### Container Health

**Via Portainer:**
1. Go to Containers
2. Check status icons (green = healthy)
3. View resource usage

**Via Command Line:**
```bash
# Container status
docker ps | grep asset-registration

# Backend logs
docker logs asset-registration-backend

# Frontend logs
docker logs asset-registration-frontend

# Follow logs
docker logs -f asset-registration-backend
```

### Application Metrics

**Check user count:**
- Login as admin
- Admin Settings → System Overview
- View user statistics

**Check asset count:**
- Asset Management tab
- Count displayed in header

**Review audit logs:**
- Audit & Reporting → Audit Logs
- Filter by date range
- Monitor system activity

### Cloudflare Analytics

1. Go to Cloudflare Dashboard
2. Select your domain
3. Analytics → Traffic
4. View:
   - Requests per day
   - Bandwidth usage
   - Top paths
   - Geographic distribution

---

## Troubleshooting

### Containers Won't Start

**Check logs:**
```bash
docker logs asset-registration-backend
docker logs asset-registration-frontend
```

**Common issues:**
- Missing environment variables
- Port already in use
- Volume permission issues

**Solution:**
```bash
# Check ports
netstat -tlnp | grep 8080

# Check volumes
docker volume inspect asset-data

# Restart containers
docker-compose restart
```

### Can't Access Application

**Check:**
1. Containers running: `docker ps`
2. Cloudflare tunnel status
3. DNS propagation (can take 5-10 min)
4. Firewall rules (if not using tunnel)

**Test locally:**
```bash
curl http://localhost:8080
```

### Database Issues

**Reset database** (⚠️ Deletes all data):
```bash
docker-compose down
docker volume rm asset-data
docker-compose up -d
```

**Restore from backup:**
```bash
docker-compose down
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/asset-data-YYYYMMDD.tar.gz -C /data
docker-compose up -d
```

---

## Scaling Considerations

### Current Limitations

- SQLite (single file database)
- Single server deployment
- No load balancing

### For High Traffic

Consider upgrading to:
- **PostgreSQL** or **MySQL** for database
- **Multiple backend instances** with load balancer
- **Redis** for session storage
- **S3** for file storage (if adding file uploads)

---

## Security Checklist

✅ Strong JWT_SECRET (64+ characters)
✅ HTTPS enabled (via Cloudflare)
✅ Regular backups scheduled
✅ Admin accounts limited (2-3 max)
✅ Audit logs reviewed monthly
✅ Inactive users removed
✅ Container images updated regularly

---

**Need help?** See [Troubleshooting Guide](Troubleshooting) or check the [FAQ](FAQ).

**For full deployment details:** See [DEPLOYMENT.md](../DEPLOYMENT.md) in the repository.
