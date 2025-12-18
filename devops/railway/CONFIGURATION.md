# Railway Configuration

Detailed configuration options for KARS on Railway.

## Environment Variables

### Required

| Variable | Example | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `<64-char-hex>` | JWT signing key |
| `NODE_ENV` | `production` | Environment name |
| `DATABASE_URL` | Auto-injected | PostgreSQL connection |

### Recommended

| Variable | Example | Description |
|----------|---------|-------------|
| `ADMIN_EMAIL` | `admin@example.com` | Auto-admin email |
| `BASE_URL` | `https://kars.jvhlabs.com` | App base URL |
| `FRONTEND_URL` | `https://kars.jvhlabs.com` | Frontend URL |
| `ACS_MASTER_KEY` | `<base64>` | Email encryption |

### Optional Features

```bash
# WebAuthn/Passkeys
railway variables set PASSKEY_RP_ID=kars.jvhlabs.com
railway variables set PASSKEY_RP_NAME="KARS"
railway variables set PASSKEY_ORIGIN=https://kars.jvhlabs.com

# OIDC/SSO (configure via admin UI after deployment)
railway variables set OIDC_ENABLED=false

# Attestation Scheduler
railway variables set RUN_ATTESTATION_SCHEDULER=true
```

## Service Settings

### Build Configuration

**Backend:**
- Builder: Nixpacks (auto-detected)
- Install: `npm ci --only=production`
- Start: `node server.js`

**Frontend:**
- Builder: Nixpacks
- Build: `npm ci && npm run build`
- Start: `npx serve -s dist -l 80`

### Health Checks

**Backend:**
- Path: `/api/health`
- Interval: 30s
- Timeout: 5s

**Frontend:**
- HTTP 200 on port 80

### Resource Limits

**Recommended:**
- Backend: 512 MB RAM, 0.5 vCPU
- Frontend: 256 MB RAM, 0.25 vCPU
- Database: 1 GB storage

## Scaling

```bash
# Vertical scaling (increase resources)
# Via Dashboard: Service → Settings → Resources

# Horizontal scaling (add replicas)
railway scale web=3
```

---

**Last Updated:** December 2024
