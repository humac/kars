# Railway Setup Guide

Complete guide for initial Railway setup and KARS deployment.

## Prerequisites

- Railway account (sign up at railway.app)
- GitHub account with repository access
- Railway CLI installed
- Node.js 22 LTS (local development)

## Initial Setup

### 1. Install Railway CLI

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr https://railway.app/install.ps1 | iex

# Verify
railway --version
```

### 2. Create Railway Project

**Via Dashboard:**
1. Login to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `humac/kars`
5. Select `main` branch

**Via CLI:**
```bash
cd /path/to/kars
railway login
railway init
railway link
```

### 3. Add PostgreSQL Database

1. In Railway Dashboard → Add Service
2. Select "Database" → "PostgreSQL"
3. Database automatically provisions
4. `DATABASE_URL` automatically injected into services

### 4. Configure Environment Variables

```bash
# Required variables
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
railway variables set NODE_ENV=production
railway variables set ADMIN_EMAIL=admin@jvhlabs.com
railway variables set BASE_URL=https://kars.jvhlabs.com
railway variables set FRONTEND_URL=https://kars.jvhlabs.com

# Database (auto-injected by Railway)
# DATABASE_URL=postgresql://...

# Optional
railway variables set DB_CLIENT=postgres
railway variables set ACS_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### 5. Configure Custom Domain

1. Railway Dashboard → Frontend Service → Settings
2. Domains → Add Custom Domain
3. Enter: `kars.jvhlabs.com`
4. Add CNAME record in Cloudflare DNS:
   - Name: `kars`
   - Target: `[service-name].up.railway.app`
5. SSL automatically provisioned

## Service Configuration

### Backend Service

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Frontend Service

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "npx serve -s dist -l 80"
  }
}
```

## Verification

```bash
# Check deployment status
railway status

# View logs
railway logs

# Test health endpoint
curl https://kars.jvhlabs.com/api/health

# Test database
railway run psql $DATABASE_URL -c "SELECT 1;"
```

## Next Steps

- [Configuration](CONFIGURATION.md) - Customize settings
- [Database](DATABASE.md) - Database management
- [Deployment](DEPLOYMENT.md) - Deploy updates

---

**Last Updated:** December 2024
