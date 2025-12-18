# Railway Platform Documentation

Railway.app is KARS's production deployment platform, providing managed infrastructure with zero-configuration deployment.

## Table of Contents

1. [Overview](#overview)
2. [Quick Links](#quick-links)
3. [Documentation Structure](#documentation-structure)
4. [Getting Started](#getting-started)
5. [Platform Benefits](#platform-benefits)

---

## Overview

**Railway** is a modern Platform-as-a-Service (PaaS) that simplifies application deployment and infrastructure management.

### KARS on Railway

- **Environment:** Production
- **Services:** Frontend, Backend, PostgreSQL
- **Deployment:** Automatic from `main` branch
- **Database:** Managed PostgreSQL with daily backups
- **Domain:** kars.jvhlabs.com (custom domain with SSL)
- **Scaling:** Vertical and horizontal scaling available

---

## Quick Links

### Railway Platform
- **Dashboard:** https://railway.app/
- **Project:** https://railway.app/project/[project-id]
- **Documentation:** https://docs.railway.app/

### KARS Production
- **Application:** https://kars.jvhlabs.com
- **API Health:** https://kars.jvhlabs.com/api/health
- **Repository:** https://github.com/humac/kars

### Internal Documentation
- **Setup Guide:** [SETUP.md](SETUP.md)
- **Configuration:** [CONFIGURATION.md](CONFIGURATION.md)
- **Database:** [DATABASE.md](DATABASE.md)
- **Deployment:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Troubleshooting:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Documentation Structure

### [SETUP.md](SETUP.md)
**Purpose:** Initial Railway setup and project creation

**Contents:**
- Railway account setup
- Project initialization
- Service configuration
- GitHub integration
- Custom domain setup
- Environment variables

**When to use:** First-time Railway deployment

---

### [CONFIGURATION.md](CONFIGURATION.md)
**Purpose:** Detailed configuration options and settings

**Contents:**
- Service settings
- Build configuration
- Runtime settings
- Networking
- Resource allocation
- Environment management

**When to use:** Customizing deployment configuration

---

### [DATABASE.md](DATABASE.md)
**Purpose:** PostgreSQL database management

**Contents:**
- Database setup
- Connection configuration
- Backup and restore
- Migrations
- Performance tuning
- Monitoring

**When to use:** Database operations and maintenance

---

### [DEPLOYMENT.md](DEPLOYMENT.md)
**Purpose:** Deployment procedures and best practices

**Contents:**
- Deployment workflow
- Automatic deployment
- Manual deployment
- Rollback procedures
- Zero-downtime deployment
- Health checks

**When to use:** Deploying updates to production

---

### [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
**Purpose:** Common issues and solutions

**Contents:**
- Deployment failures
- Runtime errors
- Database issues
- Performance problems
- Network issues
- Debugging guide

**When to use:** Resolving production issues

---

## Getting Started

### Prerequisites

1. **Railway Account**
   - Sign up at https://railway.app/
   - GitHub account for authentication
   - Credit card for paid plans (optional)

2. **GitHub Repository**
   - Repository access to humac/kars
   - Push access to main branch

3. **Local Development**
   - Railway CLI installed
   - Node.js 22 LTS
   - Git

### Quick Start Guide

**Step 1: Install Railway CLI**
```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Verify installation
railway --version
```

**Step 2: Login to Railway**
```bash
railway login
```

**Step 3: Link to Project**
```bash
cd /path/to/kars
railway link
```

**Step 4: View Project Status**
```bash
railway status
```

**Step 5: View Logs**
```bash
railway logs
```

---

## Platform Benefits

### 1. Zero Configuration Deployment

**Automatic Detection:**
- Detects Node.js applications
- Auto-configures build commands
- Sets up environment automatically

**No Docker Required:**
- Railway builds containers automatically
- Nixpacks builder (similar to Heroku buildpacks)
- No Dockerfile needed (though supported)

---

### 2. Managed Database

**PostgreSQL:**
- One-click database provisioning
- Automatic daily backups (7-day retention)
- Connection pooling
- Performance monitoring
- Point-in-time recovery (paid plans)

**Database URL Auto-Injection:**
```javascript
// Automatically available
const DATABASE_URL = process.env.DATABASE_URL;
```

---

### 3. Automatic SSL/TLS

**Free SSL Certificates:**
- Let's Encrypt certificates
- Automatic renewal
- Custom domain support
- HTTPS by default

---

### 4. Git Integration

**Automatic Deployment:**
- Push to `main` → automatic deploy
- Create tag → versioned deployment
- Branch preview deployments (paid plans)

**GitHub Actions Compatible:**
- Works with existing CI/CD
- Can trigger builds via API
- Deployment status updates

---

### 5. Built-in Monitoring

**Metrics Dashboard:**
- CPU usage
- Memory usage
- Network I/O
- Request metrics
- Error tracking

**Logs:**
- Real-time log streaming
- 7-day log retention
- Filter and search
- Download logs

---

### 6. Scalability

**Vertical Scaling:**
- Increase CPU/memory
- Simple slider in UI
- No code changes

**Horizontal Scaling:**
- Multiple replicas
- Automatic load balancing
- Session affinity

---

### 7. Developer Experience

**Railway CLI:**
```bash
# Deploy from command line
railway up

# Run commands in Railway environment
railway run npm test

# Open shell in deployment
railway run bash

# View logs
railway logs --follow
```

**Local Development:**
```bash
# Use Railway environment variables locally
railway run npm start
```

---

## Architecture Overview

### Service Structure

```
Railway Project: KARS Production
├── Backend Service
│   ├── Build: Nixpacks (Node.js 22)
│   ├── Start: node server.js
│   ├── Port: 3001
│   ├── Health: /api/health
│   └── Environment: Production
├── Frontend Service
│   ├── Build: npm ci && npm run build
│   ├── Start: nginx (static)
│   ├── Port: 80
│   └── Domain: kars.jvhlabs.com
└── PostgreSQL Plugin
    ├── Version: 15
    ├── Storage: 1 GB
    ├── Backups: Daily (automated)
    └── Connection: Internal network
```

### Network Flow

```
Internet
  ↓
Railway Edge (SSL Termination)
  ↓
Frontend Service (kars.jvhlabs.com)
  ↓
Backend Service (internal)
  ↓
PostgreSQL Database (internal)
```

---

## Cost Structure

### Starter Plan (Free)

- $5 credit per month
- Sufficient for light usage
- All core features included
- Community support

### Developer Plan ($20/month)

- $20 credit per month
- Priority support
- Longer log retention
- Branch deployments

### Team Plan ($50/month)

- $50 credit per month
- Team collaboration
- Advanced metrics
- Custom limits

### Resource Usage

**Typical KARS Usage:**
- Backend: ~512 MB RAM, 0.5 vCPU
- Frontend: ~128 MB RAM (nginx)
- Database: ~256 MB RAM, 1 GB storage
- **Estimated Cost:** ~$10-15/month

---

## Support & Resources

### Railway Support

- **Documentation:** https://docs.railway.app/
- **Discord Community:** https://discord.gg/railway
- **Twitter:** @railway
- **Email:** team@railway.app

### KARS Team

- **DevOps Lead:** [Contact]
- **On-Call:** PagerDuty rotation
- **Emergency:** See [Incident Response](../INCIDENT-RESPONSE.md)

---

## Next Steps

1. **New to Railway?** → Start with [SETUP.md](SETUP.md)
2. **Need to configure?** → See [CONFIGURATION.md](CONFIGURATION.md)
3. **Database operations?** → Check [DATABASE.md](DATABASE.md)
4. **Deploying updates?** → Read [DEPLOYMENT.md](DEPLOYMENT.md)
5. **Having issues?** → Try [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## Quick Commands Reference

```bash
# Login
railway login

# Link project
railway link

# View status
railway status

# View logs
railway logs
railway logs --follow
railway logs --service backend

# Run commands
railway run psql $DATABASE_URL
railway run npm test

# Deploy
railway up

# Rollback
railway rollback

# Environment variables
railway variables
railway variables set KEY=value
railway variables delete KEY
```

---

**Last Updated:** December 2024  
**Maintained By:** DevOps Team  
**Platform:** Railway.app
