# DevOps Documentation - KARS

**KARS (KeyData Asset Registration System)** - DevOps documentation hub for deployment, operations, and incident response.

## 📚 Documentation Index

### 🚀 Deployment & Operations

- **[Runbook](RUNBOOK.md)** - Step-by-step deployment procedures for all environments
- **[Release Checklist](RELEASE-CHECKLIST.md)** - Weekly release process and verification steps
- **[Incident Response](INCIDENT-RESPONSE.md)** - Emergency response procedures and escalation paths

### 🏗️ Platform-Specific Guides

- **[Railway Platform](railway/)** - Railway.app deployment and configuration guides
  - [Setup Guide](railway/SETUP.md)
  - [Configuration](railway/CONFIGURATION.md)
  - [Database Setup](railway/DATABASE.md)
  - [Deployment Process](railway/DEPLOYMENT.md)
  - [Troubleshooting](railway/TROUBLESHOOTING.md)

### 📊 Architecture Diagrams

All workflow diagrams are available in the [diagrams](diagrams/) folder:

1. **[CI/CD Overview](diagrams/ci-cd-overview.md)** - Complete CI/CD pipeline architecture
2. **[GitHub Actions Workflow](diagrams/github-actions-workflow.md)** - GitHub Actions pipeline details
3. **[Docker Build Process](diagrams/docker-build-process.md)** - Multi-platform Docker builds
4. **[Portainer Deployment](diagrams/portainer-deployment.md)** - Portainer deployment workflow
5. **[Railway Deployment](diagrams/railway-deployment.md)** - Railway deployment workflow
6. **[Cloudflare Tunnel](diagrams/cloudflare-tunnel.md)** - Cloudflare Tunnel architecture
7. **[Database Backup & Restore](diagrams/database-backup-restore.md)** - Backup/restore procedures
8. **[Monitoring & Health Checks](diagrams/monitoring-health-checks.md)** - Monitoring architecture
9. **[Incident Escalation](diagrams/incident-escalation.md)** - Incident escalation flow
10. **[Release Process](diagrams/release-process.md)** - Release workflow
11. **[Security Scanning](diagrams/security-scanning.md)** - Security scanning pipeline

---

## 🎯 Quick Links

### For Developers
- **Local Development:** See main [README.md](../README.md#-quick-start)
- **Running Tests:** `cd backend && npm test` / `cd frontend && npm test`
- **Build Verification:** [CI Tests Workflow](../.github/workflows/ci-tests.yml)

### For DevOps Engineers
- **Deployment:** [Runbook](RUNBOOK.md)
- **Monitoring:** [Monitoring Diagram](diagrams/monitoring-health-checks.md)
- **Troubleshooting:** [Incident Response](INCIDENT-RESPONSE.md)

### For On-Call Engineers
- **Incident Response:** [Emergency Procedures](INCIDENT-RESPONSE.md)
- **Escalation Path:** [Incident Escalation Diagram](diagrams/incident-escalation.md)
- **Health Checks:** Backend `/api/health`, Frontend at root

---

## 🏗️ Infrastructure Overview

### Current Deployment Platforms

| Platform | Environment | Purpose | Status |
|----------|-------------|---------|--------|
| **Portainer** | Staging | Container orchestration on develop branch | ✅ Active |
| **Railway** | Production | Cloud deployment with managed PostgreSQL | 🟡 Planned |
| **GitHub Actions** | CI/CD | Automated testing and deployment | ✅ Active |
| **Cloudflare** | Edge | SSL termination and tunnel access | ✅ Active |

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Node.js | 22 LTS |
| **Frontend** | React + Vite | 18 / 6.x |
| **Backend** | Express.js | 4.x |
| **Database** | SQLite / PostgreSQL | - |
| **Container** | Docker | Multi-arch (AMD64/ARM64) |
| **CI/CD** | GitHub Actions | - |

---

## 📋 Common Operations

### Deployment Commands

```bash
# Local development
cd backend && npm run dev
cd frontend && npm run dev

# Docker deployment
docker compose up -d

# Portainer deployment (via webhook)
curl -X POST "$PORTAINER_WEBHOOK_URL"

# Manual Docker rebuild
docker compose up -d --build
```

### Health Check Endpoints

```bash
# Backend health check
curl http://localhost:3001/api/health

# Frontend health check
curl http://localhost:3000

# Production health check
curl https://kars.jvhlabs.com/api/health
```

### Database Operations

```bash
# Backup SQLite database
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/asset-data-$(date +%Y%m%d).tar.gz -C /data .

# Restore SQLite database
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/asset-data-YYYYMMDD.tar.gz -C /data
```

---

## 🔐 Security & Compliance

### SOC2 Compliance Features
- Complete audit logging for all data mutations
- Role-based access control (RBAC)
- Multi-factor authentication (MFA/TOTP)
- WebAuthn/Passkey support
- OIDC/SSO integration
- Encrypted password storage (bcrypt)
- AES-256-GCM encryption for sensitive configs

### Security Scanning
- **npm audit** - Runs on every CI build
- **Code Review** - Required for all PRs
- **Dependency Updates** - Monitored via GitHub Dependabot
- **Container Scanning** - Automated via GitHub Container Registry

---

## 📊 Metrics & Monitoring

### Key Performance Indicators (KPIs)

| Metric | Target | Monitoring |
|--------|--------|------------|
| **Uptime** | 99.9% | Health checks every 30s |
| **Response Time** | < 500ms | API endpoint monitoring |
| **Build Time** | < 5 min | GitHub Actions metrics |
| **Test Coverage** | > 80% | CI coverage reports |
| **Security Vulnerabilities** | 0 high/critical | npm audit in CI |

### Monitoring Tools

- **Container Health:** Docker health checks (backend & frontend)
- **Application Health:** `/api/health` endpoint
- **CI/CD:** GitHub Actions workflow status
- **Logs:** Docker logs via `docker logs` or Portainer

---

## 🚨 Emergency Contacts

### Escalation Path

1. **On-Call Engineer** - First responder for incidents
2. **DevOps Lead** - Infrastructure and deployment issues
3. **Backend Lead** - API and database issues
4. **Frontend Lead** - UI and client-side issues
5. **Security Team** - Security incidents and vulnerabilities

### Response Time SLAs

| Severity | Response Time | Resolution Target |
|----------|---------------|-------------------|
| **P0 - Critical** | 15 minutes | 2 hours |
| **P1 - High** | 1 hour | 8 hours |
| **P2 - Medium** | 4 hours | 48 hours |
| **P3 - Low** | 1 business day | 1 week |

---

## 📚 Additional Resources

### External Documentation
- **Docker:** https://docs.docker.com/
- **Portainer:** https://docs.portainer.io/
- **Railway:** https://docs.railway.app/
- **GitHub Actions:** https://docs.github.com/en/actions
- **Cloudflare Tunnel:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

### Repository Documentation
- **Main README:** [../README.md](../README.md)
- **Deployment Guide:** [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Quick Start:** [../QUICKSTART-PORTAINER.md](../QUICKSTART-PORTAINER.md)
- **Claude AI Guide:** [../CLAUDE.md](../CLAUDE.md)

---

## 🔄 Document Maintenance

This documentation is maintained by the DevOps team and should be updated when:
- New deployment platforms are added
- Infrastructure changes are made
- Incident response procedures are updated
- New monitoring tools are implemented
- Security policies change

**Last Updated:** December 2024  
**Next Review:** Q1 2025
