# Railway Deployment

Deployment procedures for KARS on Railway.

## Automatic Deployment

**Trigger:** Push to `main` branch

**Process:**
1. Push code → GitHub
2. Railway detects change
3. Builds services
4. Runs health checks
5. Zero-downtime deployment

```bash
git push origin main
# Railway auto-deploys
```

## Manual Deployment

```bash
# Via CLI
railway up

# Via Dashboard
# Project → Service → Deploy → Trigger Deploy
```

## Rollback

```bash
# Via CLI
railway rollback

# Via Dashboard
# Deployments → Previous → Redeploy
```

## Health Checks

```bash
# Verify deployment
curl https://kars.jvhlabs.com/api/health

# Check logs
railway logs --tail=100

# Monitor metrics
railway status
```

---

**Last Updated:** December 2024
