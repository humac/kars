# Deployment Guide - KeyData Asset Registration System (KARS)

This guide explains how to deploy KARS to Portainer using GitHub Actions with Cloudflare tunnel support for hosting at `kars.jvhlabs.com`.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [GitHub Container Registry Setup](#github-container-registry-setup)
3. [Portainer Stack Setup](#portainer-stack-setup)
4. [GitHub Actions Secrets](#github-actions-secrets)
5. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
6. [Deployment Process](#deployment-process)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- GitHub account with repository access
- Portainer instance running and accessible
- Cloudflare account with domain (jvhlabs.com)
- Docker host accessible by Portainer

### Node.js for local development

- The backend depends on native modules (e.g., `better-sqlite3`) which must be built against a compatible Node.js ABI. To avoid native build failures, use Node 18 (LTS) for local development and CI when building the backend image.

- Recommended: use `nvm` to install and switch Node versions:

```bash
# Install nvm (if not present)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash
source ~/.nvm/nvm.sh
# Install and use Node 18
nvm install 18
nvm use 18
```

- You can also pin Node 18 for the backend by adding `"engines": { "node": ">=18 <19" }` to `backend/package.json`. The repo maintainer has added this pin to reduce surprises when building native modules.

## GitHub Container Registry Setup

### 1. Enable GitHub Packages

1. Go to your repository settings
2. Navigate to "Actions" → "General"
3. Scroll to "Workflow permissions"
4. Select "Read and write permissions"
5. Check "Allow GitHub Actions to create and approve pull requests"
6. Save changes

### 2. Make Container Registry Public (Optional)

To avoid authentication issues with Portainer:

1. Go to your repository packages: `https://github.com/YOUR_USERNAME/kars/packages`
2. Click on each package (frontend and backend)
3. Go to "Package settings"
4. Scroll to "Danger Zone"
5. Click "Change visibility" → "Public"

Alternatively, configure Portainer with GitHub Container Registry credentials.

## Portainer Stack Setup

### 1. Create New Stack

1. Log in to Portainer
2. Select your environment
3. Go to "Stacks" → "Add stack"
4. Choose "Git Repository" or "Web editor"

### 2. Configure Stack

**Stack Name:** `asset-registration`

**Method 1: Using Git Repository**
- Repository URL: `https://github.com/YOUR_USERNAME/kars`
- Repository reference: `refs/heads/main`
- Compose path: `docker-compose.portainer.yml`

**Method 2: Using Web Editor**
- Copy content from `docker-compose.portainer.yml`
- Paste into the web editor

### 3. Set Environment Variables

In Portainer stack configuration, add these environment variables:

```env
GITHUB_REPOSITORY=YOUR_USERNAME/kars
APP_PORT=8080
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ADMIN_EMAIL=admin@jvhlabs.com
```

**IMPORTANT:** Generate a strong JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Deploy Stack

1. Click "Deploy the stack"
2. Wait for containers to start
3. Verify deployment in "Containers" section

### 5. Setup Webhook for Auto-Deploy

1. In Portainer, go to your stack
2. Scroll to "Webhook" section
3. Click "Create a webhook"
4. Copy the webhook URL (you'll need this for GitHub Secrets)

## GitHub Actions Secrets

### 1. Add Repository Secrets

Go to your repository: Settings → Secrets and variables → Actions → New repository secret

Add the following secret:

**PORTAINER_WEBHOOK_URL**
- Value: The webhook URL from Portainer (e.g., `https://portainer.example.com/api/stacks/webhooks/xxxx-xxxx-xxxx`)

### 2. Verify Secrets

Ensure these secrets are set:
- ✅ `PORTAINER_WEBHOOK_URL` - Portainer webhook for auto-deployment
- ✅ `GITHUB_TOKEN` - Automatically provided by GitHub Actions

## Cloudflare Tunnel Setup

### Option 1: Using Docker (Recommended for Portainer)

1. **Add Cloudflare Tunnel to Stack**

Create a new stack or add to existing `docker-compose.portainer.yml`:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - asset-network
```

2. **Create Cloudflare Tunnel**

Via Cloudflare Dashboard:
- Go to Zero Trust → Networks → Tunnels
- Click "Create a tunnel"
- Choose "Cloudflared"
- Name it "asset-registration"
- Click "Save tunnel"
- Copy the tunnel token

3. **Configure Public Hostname**

In tunnel settings:
- Click "Public Hostname" → "Add a public hostname"
- Subdomain: `assets`
- Domain: `jvhlabs.com`
- Service: `http://asset-registration-frontend:80`
- Save hostname

4. **Add Token to Portainer**

In your Portainer stack environment variables:
```env
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token-here
```

### Option 2: Using cloudflared CLI (Direct on host)

1. **Install cloudflared**
```bash
# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

2. **Authenticate**
```bash
cloudflared tunnel login
```

3. **Create Tunnel**
```bash
cloudflared tunnel create asset-registration
```

4. **Configure Tunnel**

Edit the provided `cloudflare-tunnel.yml` file:
- Replace `YOUR_TUNNEL_ID_HERE` with your actual tunnel ID
- Update credentials file path

5. **Create DNS Record**
```bash
cloudflared tunnel route dns asset-registration assets.jvhlabs.com
```

6. **Run Tunnel as Service**
```bash
# Install as systemd service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## Deployment Process

### Automatic Deployment

1. **Push to Main Branch**
```bash
git push origin main
```

2. **GitHub Actions will automatically:**
   - Build frontend Docker image
   - Build backend Docker image
   - Push images to GitHub Container Registry
   - Trigger Portainer webhook to redeploy stack

3. **Monitor Deployment**
   - GitHub: Actions tab → Watch workflow progress
   - Portainer: Stacks → asset-registration → Check container status

### Manual Deployment

1. **Via GitHub Actions**
   - Go to Actions tab
   - Select "Deploy to Portainer" workflow
   - Click "Run workflow"
   - Select branch (main)
   - Run workflow

2. **Via Portainer Webhook**
```bash
curl -X POST "YOUR_PORTAINER_WEBHOOK_URL"
```

3. **Via Portainer UI**
   - Go to Stacks → asset-registration
   - Click "Update the stack"
   - Enable "Pull latest image"
   - Click "Update"

## Post-Deployment

### 1. Verify Application

Access your application at: `https://assets.jvhlabs.com`

### 2. Create First Admin User

1. Navigate to `https://assets.jvhlabs.com`
2. Click "Register"
3. Create your account
4. **First user automatically becomes admin**

### 3. Add Companies

1. Log in as admin
2. Go to "Company Management" tab
3. Add your companies
4. Users can now register assets with company dropdown

### 4. Configure Additional Admins (Optional)

**Method 1: Via Admin UI**
1. Go to "Admin Settings" → "User Management"
2. Find user and change role to "Admin"

**Method 2: Via Environment Variable**
1. Update `ADMIN_EMAIL` in Portainer stack env vars
2. Users with that email will be admin upon registration

## Troubleshooting

### SPA Routes & Browser Refresh

If your frontend is a single-page application (SPA) and users can navigate to client-side routes such as `/assets/`, a direct browser refresh on such a route can return a `403`/`404` from the server when there is no `index.html` in that directory. To avoid this, ensure your server returns the SPA entrypoint for unknown paths so the client router can resolve the route.

Recommended `nginx` configuration (the project includes `frontend/nginx.conf`):

```nginx
   # SPA fallback: serve index.html for 404/403 so client-side routes load on refresh
   error_page 404 403 = /index.html;

   # Generic SPA root handler
   location / {
      try_files $uri $uri/ /index.html;
   }
```

Why this helps:
- If a directory like `/assets/` exists but has no `index.html`, Nginx would normally return `403` and the SPA would not load. The `error_page` directive forces Nginx to internally serve `/index.html` instead, allowing the SPA to handle routing.

Alternatives:
- Add an `index.html` in the directory you want to serve (not recommended for SPA routes).
- Enable directory listings with `autoindex on;` (only if you intentionally want directory listing pages).

Deploy & test steps (from repo root):

```powershell
# Rebuild and start frontend (Docker Compose)
docker compose up -d --build frontend

# Follow frontend logs
docker compose logs -f asset-frontend

# Verify directory route returns the SPA index (should be HTML, not a 403)
curl -v http://localhost/assets/ | head -n 20
```

If you use a reverse proxy or Cloudflare in front of Nginx, ensure it doesn't rewrite or block `/assets/` requests.

### Containers Not Starting

**Check logs:**
```bash
docker logs asset-registration-backend
docker logs asset-registration-frontend
```

**Common issues:**
- Missing environment variables
- Port conflicts (change APP_PORT)
- Volume permission issues

### Cannot Pull Images

**If using private GitHub Container Registry:**

1. Create GitHub Personal Access Token (PAT):
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `read:packages` scope

2. Add registry credentials to Portainer:
   - Portainer → Registries → Add registry
   - Type: Custom
   - Name: GitHub Container Registry
   - Registry URL: `ghcr.io`
   - Username: Your GitHub username
   - Password: Your PAT

3. Update stack to use authenticated registry

### Cloudflare Tunnel Issues

**Tunnel not connecting:**
```bash
# Check tunnel status
cloudflared tunnel info asset-registration

# Test connection
cloudflared tunnel run asset-registration
```

**DNS not resolving:**
- Verify CNAME record in Cloudflare DNS
- Ensure proxy status is "Proxied" (orange cloud)
- Wait 5-10 minutes for DNS propagation

### Database Issues

**Data not persisting:**
- Verify volume is created: `docker volume ls | grep asset-data`
- Check volume mount in container: `docker inspect asset-registration-backend`

**Reset database:**
```bash
# WARNING: This deletes all data
docker volume rm asset-data
# Redeploy stack
```

### GitHub Actions Failures

**Build failures:**
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Check build logs in GitHub Actions

**Deployment failures:**
- Verify PORTAINER_WEBHOOK_URL is correct
- Test webhook manually: `curl -X POST "$WEBHOOK_URL"`
- Check Portainer logs

## Security Recommendations

1. **Change JWT_SECRET** - Use a strong, random secret (64+ characters)
2. **Use HTTPS** - Cloudflare automatically provides SSL
3. **Regular Updates** - Pull latest images regularly
4. **Backup Database** - Schedule regular backups of the `asset-data` volume
5. **Monitor Logs** - Set up log aggregation for security monitoring
6. **Restrict Access** - Use Cloudflare Access policies if needed
7. **PostgreSQL SSL** - When using PostgreSQL, configure secure SSL connections (see below)

### PostgreSQL SSL Configuration

When using PostgreSQL instead of SQLite, configure SSL for secure database connections:

**Basic SSL (Secure Default):**
```env
DB_CLIENT=postgres
POSTGRES_URL=postgresql://username:password@hostname:5432/database
POSTGRES_SSL=true
# Certificate validation is ENABLED by default (secure)
```

**Custom CA Certificate (Recommended for Production):**
```env
DB_CLIENT=postgres
POSTGRES_URL=postgresql://username:password@hostname:5432/database
POSTGRES_SSL=true
POSTGRES_SSL_CA=/path/to/ca-certificate.crt
# Certificate validation is ENABLED by default (secure)
```

**Mutual TLS (Client Certificate Authentication):**
```env
DB_CLIENT=postgres
POSTGRES_URL=postgresql://username:password@hostname:5432/database
POSTGRES_SSL=true
POSTGRES_SSL_CA=/path/to/ca-certificate.crt
POSTGRES_SSL_CERT=/path/to/client-certificate.crt
POSTGRES_SSL_KEY=/path/to/client-key.key
```

**Development/Testing Only (Self-Signed Certificates):**
```env
DB_CLIENT=postgres
POSTGRES_URL=postgresql://username:password@hostname:5432/database
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false  # ⚠️ INSECURE - Development only!
```

**⚠️ SECURITY WARNING:**
- **NEVER** set `POSTGRES_SSL_REJECT_UNAUTHORIZED=false` in production
- This disables certificate validation and enables Man-in-the-Middle (MITM) attacks
- Always use proper certificates with certificate validation enabled
- By default, certificate validation is **enabled** for security

## Backup and Restore

### Backup Database

```bash
# Create backup
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/asset-data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Database

```bash
# Restore from backup
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/asset-data-backup-YYYYMMDD.tar.gz -C /data
```

## Monitoring

### Health Checks

Both containers have health checks configured:

**Backend:** `http://localhost:3001/api/health`
**Frontend:** `http://localhost:80`

### Portainer Monitoring

- View container stats in Portainer dashboard
- Set up webhooks for container status notifications
- Enable logging drivers for centralized logs

## Updating the Application

### Via Git Push (Automatic)

```bash
git add .
git commit -m "Update application"
git push origin main
```

GitHub Actions will automatically rebuild and redeploy.

### Manual Update

1. Pull latest images in Portainer
2. Or trigger webhook manually
3. Containers will restart with new images

---

## Quick Reference

**Application URL:** https://assets.jvhlabs.com
**Default Port:** 8080
**Backend API:** http://localhost:3001/api
**Docker Volume:** asset-data
**Network:** asset-network

## Support

For issues or questions:
1. Check logs in Portainer
2. Review GitHub Actions workflow runs
3. Verify Cloudflare tunnel status
4. Check this documentation
