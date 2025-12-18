# KARS Deployment Runbook

This runbook provides step-by-step procedures for deploying and managing KARS across all environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Overview](#environment-overview)
3. [Local Development Deployment](#local-development-deployment)
4. [Staging Deployment (Portainer)](#staging-deployment-portainer)
5. [Production Deployment (Railway)](#production-deployment-railway)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Rollback Procedures](#rollback-procedures)
8. [Database Operations](#database-operations)
9. [Configuration Management](#configuration-management)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Access
- [ ] GitHub repository access (read/write)
- [ ] GitHub Actions secrets management access
- [ ] Portainer admin access (staging)
- [ ] Railway admin access (production)
- [ ] Cloudflare account access (tunnel/DNS)
- [ ] SMTP credentials (for email notifications)

### Required Tools
- [ ] Git (version control)
- [ ] Node.js 22 LTS (local development)
- [ ] Docker & Docker Compose (local testing)
- [ ] curl or Postman (API testing)

### Required Knowledge
- [ ] Familiarity with GitHub Actions workflows
- [ ] Understanding of Docker containerization
- [ ] Basic PostgreSQL/SQLite administration
- [ ] JWT and environment variable configuration

---

## Environment Overview

### Environment Matrix

| Environment | Branch | Platform | Database | URL | Auto-Deploy |
|-------------|--------|----------|----------|-----|-------------|
| **Development** | feature/* | Local | SQLite | localhost:3000 | No |
| **Staging** | develop | Portainer | SQLite/PostgreSQL | staging.kars.jvhlabs.com | Yes |
| **Production** | main | Railway | PostgreSQL | kars.jvhlabs.com | Manual |

### Environment Variables

Each environment requires the following variables (see `.env.example`):

**Required:**
- `JWT_SECRET` - JWT signing key (64+ characters)
- `NODE_ENV` - Environment name (development/staging/production)

**Optional but Recommended:**
- `DB_CLIENT` - Database type (sqlite/postgres)
- `POSTGRES_URL` - PostgreSQL connection string
- `ADMIN_EMAIL` - Auto-promote email to admin role
- `PASSKEY_RP_ID` - WebAuthn relying party ID
- `PASSKEY_RP_NAME` - WebAuthn relying party name
- `PASSKEY_ORIGIN` - WebAuthn origin URL
- `OIDC_*` - OIDC/SSO configuration
- `ACS_MASTER_KEY` - Email encryption key
- `BASE_URL` - Application base URL
- `FRONTEND_URL` - Frontend URL for email links
- `RUN_ATTESTATION_SCHEDULER` - Enable attestation scheduler

---

## Local Development Deployment

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/humac/kars.git
cd kars

# Install Node.js 22 LTS (if not installed)
nvm install 22
nvm use 22

# Verify Node version
node --version  # Should be v22.x.x
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies (ALWAYS use 'ci' not 'install')
npm ci

# Copy environment template
cp .env.example .env

# Edit .env file and set:
# - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
# - ADMIN_EMAIL (optional)

# Start backend in development mode
npm run dev

# Backend will start on http://localhost:3001
```

### 3. Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm ci

# Start frontend development server
npm run dev

# Frontend will start on http://localhost:5173 (Vite default)
# Note: Vite proxies /api/* requests to backend at :3001
```

### 4. Verify Local Deployment

```bash
# Test backend health
curl http://localhost:3001/api/health

# Test frontend (open browser)
open http://localhost:5173

# Register first user (becomes admin automatically)
# Navigate to http://localhost:5173 and click "Register"
```

### 5. Run Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Frontend build verification
npm run build
```

---

## Staging Deployment (Portainer)

### Overview
Staging deploys automatically when changes are pushed to the `develop` branch via GitHub Actions.

### Pre-Deployment Checklist

- [ ] All tests passing on develop branch
- [ ] Code reviewed and approved
- [ ] Environment variables configured in Portainer
- [ ] Portainer webhook configured with `pullImage=true`
- [ ] Cloudflare tunnel active

### Deployment Steps

#### Option 1: Automatic Deployment (Recommended)

```bash
# 1. Merge feature branch to develop
git checkout develop
git pull origin develop
git merge feature/your-feature
git push origin develop

# 2. Monitor GitHub Actions
# Go to: https://github.com/humac/kars/actions
# Watch "Deploy (Staging)" workflow

# 3. Verify build completion
# - Frontend image builds (linux/amd64, linux/arm64)
# - Backend image builds (linux/amd64, linux/arm64)
# - Images pushed to ghcr.io
# - Portainer webhook triggered

# 4. Verify deployment in Portainer
# - Check stack status: Stacks → asset-registration
# - Verify containers running: Containers view
# - Check logs for errors
```

#### Option 2: Manual Deployment

```bash
# 1. Trigger GitHub Actions manually
# Go to: https://github.com/humac/kars/actions
# Click "Deploy (Staging)" → "Run workflow" → Select "develop"

# 2. Or trigger Portainer webhook directly
curl -X POST "$PORTAINER_WEBHOOK_URL"
```

### Portainer Stack Configuration

#### Initial Setup (One-Time)

1. **Create Stack in Portainer**
   - Navigate to: Stacks → Add stack
   - Name: `asset-registration`
   - Build method: Git repository or Web editor

2. **Configure Git Repository** (if using Git method)
   - Repository URL: `https://github.com/humac/kars`
   - Reference: `refs/heads/develop`
   - Compose path: `docker-compose.portainer.yml`

3. **Set Environment Variables**
   ```env
   GITHUB_REPOSITORY=humac/kars
   APP_PORT=8080
   JWT_SECRET=<generate-strong-secret>
   ADMIN_EMAIL=admin@jvhlabs.com
   DB_CLIENT=sqlite
   ```

4. **Create Webhook**
   - In stack settings → Webhooks → Create webhook
   - ✅ Enable "Pull latest image version"
   - Copy webhook URL
   - Add to GitHub Secrets as `PORTAINER_WEBHOOK_URL`

#### Stack Update

```bash
# Update stack with new environment variables
# 1. In Portainer: Stacks → asset-registration → Editor
# 2. Modify environment variables
# 3. Click "Update the stack"
# 4. Enable "Pull and redeploy"
```

### Post-Deployment Verification

```bash
# 1. Check container health
docker ps | grep asset-registration

# 2. Test backend health
curl https://staging.kars.jvhlabs.com/api/health

# 3. Test frontend
curl -I https://staging.kars.jvhlabs.com

# 4. Verify logs
docker logs asset-registration-backend
docker logs asset-registration-frontend

# 5. Test authentication
# - Navigate to staging URL
# - Try login/registration
# - Verify JWT token issuance
```

---

## Production Deployment (Railway)

### Overview
Production deployment uses Railway.app with managed PostgreSQL. Deployment is manual from the `main` branch.

### Pre-Deployment Checklist

- [ ] All tests passing on main branch
- [ ] Staging deployment verified and tested
- [ ] Database migration plan prepared (if applicable)
- [ ] Rollback plan documented
- [ ] Environment variables configured in Railway
- [ ] Email notification configured (SMTP)
- [ ] Monitoring and alerts configured
- [ ] Stakeholders notified of deployment window

### Initial Railway Setup

See [railway/SETUP.md](railway/SETUP.md) for detailed first-time setup instructions.

### Deployment Steps

#### 1. Pre-Deployment Tasks

```bash
# Verify main branch is ready
git checkout main
git pull origin main

# Check CI status
# All tests must pass: https://github.com/humac/kars/actions

# Create release tag
git tag -a v1.x.x -m "Release v1.x.x - Description"
git push origin v1.x.x

# Backup production database (if upgrading)
# See railway/DATABASE.md for backup procedures
```

#### 2. Deploy to Railway

```bash
# Option 1: GitHub Integration (Recommended)
# 1. Push to main branch triggers Railway deployment
# 2. Railway automatically builds and deploys

# Option 2: Railway CLI
railway login
railway link  # Link to project
railway up    # Deploy current directory

# Option 3: Railway Dashboard
# 1. Navigate to Railway project
# 2. Go to Deployments → Deploy
# 3. Select commit or branch
# 4. Click "Deploy"
```

#### 3. Monitor Deployment

```bash
# Watch Railway deployment logs
railway logs

# Or in Railway Dashboard:
# Project → Service → Deployments → View logs

# Monitor deployment status
# Status should change: Building → Deploying → Active
```

#### 4. Database Migration (if required)

```bash
# If schema changes exist:
# 1. Backup database first (see railway/DATABASE.md)
# 2. Railway will auto-run migrations on deploy
# 3. Verify migration success in logs

# Manual verification:
railway run bash
# Inside container:
sqlite3 /app/data/assets.db ".tables"
# Or for PostgreSQL:
psql $DATABASE_URL -c "\dt"
```

### Post-Deployment Verification

```bash
# 1. Verify Railway deployment status
railway status

# 2. Check application health
curl https://kars.jvhlabs.com/api/health

# 3. Test critical paths
curl -X POST https://kars.jvhlabs.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# 4. Verify database connectivity
railway logs | grep -i "database"

# 5. Test frontend
# - Open https://kars.jvhlabs.com
# - Verify login works
# - Check asset registration
# - Verify audit logs
# - Test admin functions

# 6. Monitor error rates
railway logs --tail=100 | grep -i "error"

# 7. Verify email notifications (if configured)
# - Test password reset
# - Test attestation emails
```

### Production Health Checks

```bash
# Automated health checks
# Backend: Every 30 seconds via Docker health check
# Railway: Built-in health check monitoring

# Manual verification
curl https://kars.jvhlabs.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-12-18T15:30:00.000Z"}
```

---

## Post-Deployment Verification

### Verification Checklist

Use this checklist after any deployment:

#### Backend Verification
- [ ] Health endpoint returns 200 OK
- [ ] Database connection established
- [ ] JWT authentication working
- [ ] API endpoints responding
- [ ] Audit logging functional
- [ ] Error logs clean (no critical errors)

#### Frontend Verification
- [ ] Application loads successfully
- [ ] Login/registration functional
- [ ] Asset CRUD operations work
- [ ] User management accessible (admin)
- [ ] Admin settings accessible (admin)
- [ ] Navigation routing works
- [ ] No console errors in browser

#### Security Verification
- [ ] HTTPS enabled and valid
- [ ] JWT tokens issued correctly
- [ ] RBAC enforcing permissions
- [ ] CORS configured properly
- [ ] Sensitive data not exposed
- [ ] Audit logs capturing events

#### Integration Verification
- [ ] Email notifications sending (if configured)
- [ ] OIDC/SSO working (if configured)
- [ ] MFA/TOTP functional (if enabled)
- [ ] Passkeys/WebAuthn working (if enabled)
- [ ] HubSpot sync functional (if configured)

### Automated Verification Script

```bash
#!/bin/bash
# verify-deployment.sh

BASE_URL="${1:-https://kars.jvhlabs.com}"

echo "Verifying deployment at $BASE_URL..."

# Health check
echo "1. Checking backend health..."
curl -f "$BASE_URL/api/health" || exit 1

# Frontend check
echo "2. Checking frontend..."
curl -f -I "$BASE_URL" || exit 1

# API response check
echo "3. Checking API response..."
curl -f "$BASE_URL/api/companies" || echo "API requires auth (expected)"

echo "✅ Deployment verification complete!"
```

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:
- Critical functionality is broken
- Security vulnerability introduced
- Database corruption detected
- Severe performance degradation
- Data loss occurring

### Staging Rollback (Portainer)

#### Option 1: Git Revert

```bash
# 1. Revert commit on develop branch
git checkout develop
git revert <commit-hash>
git push origin develop

# 2. GitHub Actions will auto-deploy reverted version
# Monitor: https://github.com/humac/kars/actions
```

#### Option 2: Portainer Manual Rollback

```bash
# 1. In Portainer: Stacks → asset-registration
# 2. Editor → Change image tags to previous version
# Example: ghcr.io/humac/kars/backend:develop-sha-abc123
# 3. Update stack with "Pull and redeploy"
```

#### Option 3: Stack Re-deployment

```bash
# 1. In Portainer: Stacks → asset-registration
# 2. Stop stack
# 3. Restore database from backup (if needed)
# 4. Start stack
```

### Production Rollback (Railway)

#### Option 1: Railway Dashboard Rollback

```bash
# 1. Navigate to Railway project → Deployments
# 2. Find last known good deployment
# 3. Click "..." menu → "Redeploy"
# 4. Confirm deployment
# 5. Monitor logs for successful rollback
```

#### Option 2: Git Rollback

```bash
# 1. Revert commit on main branch
git checkout main
git revert <commit-hash>
git push origin main

# 2. Railway auto-deploys the revert
# Or manually trigger: railway up

# 3. Verify rollback
curl https://kars.jvhlabs.com/api/health
```

#### Option 3: Tag-Based Rollback

```bash
# 1. Find last good release tag
git tag -l

# 2. Deploy specific tag via Railway
railway up --tag v1.x.x

# 3. Or push tag to main
git checkout main
git reset --hard v1.x.x
git push origin main --force  # Use with caution!
```

### Database Rollback

```bash
# If database migration caused issues:

# 1. Stop application
railway scale web=0  # Railway
# Or in Portainer: Stop containers

# 2. Restore database from backup
# See railway/DATABASE.md or section below

# 3. Restart application
railway scale web=1  # Railway
# Or in Portainer: Start containers

# 4. Verify data integrity
```

---

## Database Operations

### Backup Procedures

#### SQLite Backup (Portainer/Local)

```bash
# Manual backup
docker run --rm \
  -v asset-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/asset-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .

# Automated daily backup (add to crontab)
0 2 * * * /path/to/backup-script.sh
```

#### PostgreSQL Backup (Railway)

```bash
# Using Railway CLI
railway run pg_dump > backup-$(date +%Y%m%d).sql

# Using direct connection
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated backup (Railway plugin)
# Railway offers automated daily backups
# Check: Project → PostgreSQL → Backups
```

### Restore Procedures

#### SQLite Restore

```bash
# 1. Stop application
docker-compose down

# 2. Restore volume
docker run --rm \
  -v asset-data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/asset-data-YYYYMMDD-HHMMSS.tar.gz -C /data"

# 3. Restart application
docker-compose up -d

# 4. Verify data
docker exec -it asset-registration-backend sh
sqlite3 /app/data/assets.db "SELECT COUNT(*) FROM users;"
```

#### PostgreSQL Restore

```bash
# 1. Scale down application
railway scale web=0

# 2. Restore database
psql $DATABASE_URL < backup-YYYYMMDD.sql

# 3. Scale up application
railway scale web=1

# 4. Verify data
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Database Migration

See [railway/DATABASE.md](railway/DATABASE.md) for detailed migration procedures.

---

## Configuration Management

### Environment Variables

#### Adding New Environment Variables

1. **Add to `.env.example`** (documentation)
   ```bash
   # New feature configuration
   NEW_FEATURE_ENABLED=false
   NEW_FEATURE_API_KEY=your-api-key-here
   ```

2. **Update Backend Code** (if backend variable)
   ```javascript
   // backend/server.js or relevant file
   const NEW_FEATURE_ENABLED = process.env.NEW_FEATURE_ENABLED === 'true';
   ```

3. **Update Portainer Stack**
   - Stacks → asset-registration → Editor
   - Add environment variable
   - Update stack

4. **Update Railway Configuration**
   ```bash
   # Via Railway CLI
   railway variables set NEW_FEATURE_ENABLED=true

   # Or via Railway Dashboard:
   # Project → Variables → Add Variable
   ```

5. **Document in Runbook** (this file)

### Secret Rotation

#### JWT Secret Rotation

```bash
# 1. Generate new secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Update in deployment platform
# Portainer: Stack environment variables
# Railway: railway variables set JWT_SECRET=new-secret

# 3. Restart application (invalidates all existing tokens)
# Users will need to log in again

# 4. Verify new secret is active
# Test login flow
```

#### Database Credential Rotation

```bash
# PostgreSQL (Railway)
# 1. Railway handles automatic credential rotation
# 2. Check: Project → PostgreSQL → Settings

# SQLite
# No credentials to rotate (file-based)
```

#### SMTP Password Rotation

```bash
# 1. Update SMTP password via Admin Settings UI
# 2. Password is automatically encrypted with ACS_MASTER_KEY
# 3. Test email functionality
```

---

## Troubleshooting

### Common Issues

#### Issue: Containers Won't Start

```bash
# Check logs
docker logs asset-registration-backend
docker logs asset-registration-frontend

# Check port conflicts
netstat -tlnp | grep 8080

# Verify environment variables
docker exec asset-registration-backend env | grep JWT_SECRET

# Solution: Fix configuration and restart
docker-compose restart
```

#### Issue: Database Connection Failed

```bash
# SQLite: Check file permissions
docker exec asset-registration-backend ls -la /app/data/

# PostgreSQL: Verify connection string
docker exec asset-registration-backend env | grep POSTGRES_URL

# Test connection
railway run psql $DATABASE_URL -c "SELECT 1;"

# Solution: Check DB_CLIENT and POSTGRES_URL settings
```

#### Issue: GitHub Actions Build Failure

```bash
# Check workflow logs
# Go to: https://github.com/humac/kars/actions

# Common causes:
# - npm audit failures (high/critical vulnerabilities)
# - Test failures
# - Node version mismatch (must be 22 LTS)
# - Build errors

# Solution: Fix issues locally first
npm ci && npm test && npm run build
```

#### Issue: Portainer Webhook Not Triggering

```bash
# Test webhook manually
curl -X POST "$PORTAINER_WEBHOOK_URL"

# Check webhook configuration
# Portainer → Stack → Webhooks
# Ensure "Pull latest image version" is enabled

# Verify GitHub secret
# Settings → Secrets → PORTAINER_WEBHOOK_URL

# Solution: Recreate webhook with pullImage=true
```

#### Issue: Railway Deployment Stuck

```bash
# Check deployment logs
railway logs

# Common causes:
# - Build errors
# - Start command failures
# - Port binding issues
# - Environment variable missing

# Solution: Check logs and fix issues
railway status
railway logs | grep -i error
```

### Debug Mode

#### Enable Verbose Logging (Development)

```bash
# Backend
DEBUG=* npm run dev

# Frontend
VITE_DEBUG=true npm run dev
```

#### Production Logging

```bash
# Railway: View logs
railway logs --tail=100

# Portainer: View container logs
docker logs asset-registration-backend --tail=100 --follow

# Filter errors only
railway logs | grep -i "error"
```

### Performance Issues

```bash
# Check container resource usage
docker stats asset-registration-backend asset-registration-frontend

# Check database size
# SQLite:
docker exec asset-registration-backend ls -lh /app/data/

# PostgreSQL:
railway run psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Check slow queries (if using PostgreSQL)
railway run psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

---

## Additional Resources

- **Incident Response:** [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md)
- **Release Checklist:** [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md)
- **Railway Setup:** [railway/SETUP.md](railway/SETUP.md)
- **Deployment Guide:** [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Main README:** [../README.md](../README.md)

---

**Last Updated:** December 2024  
**Maintained By:** DevOps Team  
**Next Review:** Q1 2025
