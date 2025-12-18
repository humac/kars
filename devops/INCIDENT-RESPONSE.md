# KARS Incident Response Guide

This document outlines procedures for responding to incidents affecting KARS (KeyData Asset Registration System).

## Table of Contents

1. [Incident Severity Levels](#incident-severity-levels)
2. [Incident Response Team](#incident-response-team)
3. [Response Procedures](#response-procedures)
4. [Common Incident Scenarios](#common-incident-scenarios)
5. [Communication Protocols](#communication-protocols)
6. [Post-Incident Review](#post-incident-review)
7. [Escalation Matrix](#escalation-matrix)

---

## Incident Severity Levels

### P0 - Critical (Production Down)

**Definition:** Complete service outage or data loss affecting all users.

**Examples:**
- Application completely inaccessible
- Database corruption or data loss
- Security breach or data leak
- Authentication system failure

**Response Time:** 15 minutes  
**Resolution Target:** 2 hours  
**Escalation:** Immediate to DevOps Lead and Backend Lead

---

### P1 - High (Major Functionality Impaired)

**Definition:** Core functionality unavailable but service is partially accessible.

**Examples:**
- Asset registration not working
- Login failures for some users
- Admin functions unavailable
- Database performance severely degraded
- Email notifications failing

**Response Time:** 1 hour  
**Resolution Target:** 8 hours  
**Escalation:** DevOps Lead within 2 hours if unresolved

---

### P2 - Medium (Degraded Performance)

**Definition:** Service operational but with reduced performance or non-critical features unavailable.

**Examples:**
- Slow page load times (>5 seconds)
- Intermittent errors for specific features
- CSV export failures
- MFA/Passkey enrollment issues
- Search functionality slow

**Response Time:** 4 hours  
**Resolution Target:** 48 hours  
**Escalation:** Team lead if unresolved after 24 hours

---

### P3 - Low (Minor Issue)

**Definition:** Cosmetic issues or non-critical features with workarounds available.

**Examples:**
- UI display issues
- Typos in error messages
- Minor documentation errors
- Non-critical feature requests

**Response Time:** 1 business day  
**Resolution Target:** 1 week  
**Escalation:** Not required

---

## Incident Response Team

### Roles and Responsibilities

#### On-Call Engineer (Primary Responder)
**Responsibilities:**
- First point of contact for incidents
- Initial assessment and triage
- Execute immediate response procedures
- Escalate when necessary
- Document incident timeline

**Contact:** Via PagerDuty/on-call rotation

---

#### DevOps Lead
**Responsibilities:**
- Infrastructure and deployment issues
- Cloud platform management (Railway, Portainer)
- CI/CD pipeline issues
- Container orchestration
- Database infrastructure

**Escalation Path:** P0 incidents immediately, P1 within 2 hours

---

#### Backend Lead
**Responsibilities:**
- API and backend service issues
- Database schema and queries
- Authentication and security
- Integration issues (OIDC, Email, HubSpot)

**Escalation Path:** P0 incidents immediately, P1 if backend issue identified

---

#### Frontend Lead
**Responsibilities:**
- UI/UX issues
- Client-side JavaScript errors
- React component problems
- Browser compatibility issues

**Escalation Path:** P1 if frontend issue identified

---

#### Security Team
**Responsibilities:**
- Security incidents and vulnerabilities
- Data breach response
- Access control issues
- Compliance incidents

**Escalation Path:** Any suspected security incident immediately

---

## Response Procedures

### Initial Response (All Incidents)

#### Step 1: Acknowledge (Within Response Time SLA)

```bash
# Acknowledge incident in monitoring system
# Document:
# - Incident ID
# - Time reported
# - Reporter name/email
# - Initial severity assessment
```

#### Step 2: Assess Impact

```bash
# Quick assessment questions:
1. How many users are affected? (all / some / specific subset)
2. What functionality is impaired? (complete outage / specific features)
3. Is data at risk? (data loss / corruption / exposure)
4. Is there a security component? (breach / vulnerability / unauthorized access)
5. What is the current state? (down / degraded / intermittent)

# Check monitoring
curl https://kars.jvhlabs.com/api/health
railway status
docker ps  # if Portainer
```

#### Step 3: Initial Communication

```bash
# Notify stakeholders based on severity:
# P0/P1: Immediate notification to incident response team
# P2: Update in team chat
# P3: Create ticket, no immediate notification

# Communication template:
"""
INCIDENT ALERT - P[0-3]
Incident ID: INC-YYYYMMDD-NNN
Time Detected: YYYY-MM-DD HH:MM UTC
Severity: P[0-3] - [Critical/High/Medium/Low]
Impact: [Brief description]
Status: INVESTIGATING
Assigned To: [On-Call Engineer]
ETA for Update: [Time]
"""
```

#### Step 4: Begin Investigation

```bash
# Gather initial data
railway logs --tail=500 | grep -i error
docker logs asset-registration-backend --tail=500
docker logs asset-registration-frontend --tail=500

# Check recent changes
git log -n 10 --oneline

# Review GitHub Actions
# https://github.com/humac/kars/actions

# Check infrastructure status
railway status
docker ps
```

---

### P0 - Critical Response Procedure

#### Immediate Actions (0-15 minutes)

1. **Acknowledge and Alert**
   ```bash
   # Immediately notify:
   # - DevOps Lead
   # - Backend Lead
   # - Security Team (if security related)
   
   # Status page update (if applicable)
   ```

2. **Quick Health Check**
   ```bash
   # Backend health
   curl https://kars.jvhlabs.com/api/health
   
   # Container status
   railway status
   # OR
   docker ps | grep asset-registration
   
   # Database connectivity
   railway run psql $DATABASE_URL -c "SELECT 1;"
   ```

3. **Identify Root Cause Category**
   - Application crash (backend/frontend)
   - Database failure
   - Infrastructure outage (Railway/Portainer)
   - Network/DNS issue
   - Security breach
   - Deployment failure

#### Investigation and Remediation (15-60 minutes)

4. **Application Crash**
   ```bash
   # Check logs for crash
   railway logs | tail -100
   
   # Look for:
   # - Uncaught exceptions
   # - Memory errors (OOM)
   # - Database connection errors
   # - Port binding failures
   
   # Quick fix: Restart application
   railway restart
   # OR
   docker-compose restart
   
   # Monitor recovery
   watch -n 5 curl https://kars.jvhlabs.com/api/health
   ```

5. **Database Failure**
   ```bash
   # Check database status
   railway run psql $DATABASE_URL -c "SELECT version();"
   
   # Check disk space (SQLite)
   docker exec asset-registration-backend df -h
   
   # Check connections (PostgreSQL)
   railway run psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
   
   # If corrupted: Restore from backup
   # See RUNBOOK.md Database Operations section
   ```

6. **Infrastructure Outage**
   ```bash
   # Check Railway status
   railway status
   curl https://status.railway.app
   
   # Check Portainer status
   curl https://portainer.example.com
   
   # Check Cloudflare Tunnel
   curl https://www.cloudflarestatus.com
   
   # If platform issue: Switch to backup deployment (if available)
   # Or wait for platform recovery
   ```

7. **Deployment Failure**
   ```bash
   # Immediate rollback
   # See RUNBOOK.md Rollback Procedures section
   
   # Railway rollback
   railway rollback
   
   # OR Portainer rollback to previous image
   ```

#### Communication (Throughout)

```bash
# Update every 30 minutes during P0 incident
# Template:
"""
INCIDENT UPDATE - P0
Incident ID: INC-YYYYMMDD-NNN
Time: YYYY-MM-DD HH:MM UTC
Status: [INVESTIGATING / IDENTIFIED / FIXING / MONITORING]
Progress: [What we've found and done]
Next Steps: [What we're doing next]
ETA: [Expected resolution time]
Impact: [Current user impact]
"""
```

#### Resolution and Verification

8. **Verify Service Recovery**
   ```bash
   # Comprehensive health check
   curl https://kars.jvhlabs.com/api/health
   
   # Test critical paths
   # - Login
   # - Asset registration
   # - Asset retrieval
   # - Admin functions
   
   # Monitor error rates
   railway logs | grep -i error | wc -l
   
   # Check performance
   time curl https://kars.jvhlabs.com/api/assets
   ```

9. **Monitor Stability (30-60 minutes)**
   ```bash
   # Continuous monitoring
   watch -n 30 'curl -s https://kars.jvhlabs.com/api/health && echo "OK"'
   
   # Watch logs for errors
   railway logs --follow | grep -i error
   
   # Monitor resource usage
   railway status
   ```

10. **Final Communication**
    ```bash
    """
    INCIDENT RESOLVED - P0
    Incident ID: INC-YYYYMMDD-NNN
    Resolution Time: YYYY-MM-DD HH:MM UTC
    Duration: [X hours Y minutes]
    Root Cause: [Brief explanation]
    Resolution: [What was done]
    Verification: Service fully operational
    Next Steps: Post-incident review scheduled
    """
    ```

---

### P1 - High Response Procedure

#### Initial Response (0-60 minutes)

1. **Assess Scope**
   ```bash
   # Determine affected functionality
   # - Which features are broken?
   # - How many users affected?
   # - Is there a workaround?
   
   # Test specific features
   # Example: Asset registration
   curl -X POST https://kars.jvhlabs.com/api/assets \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $JWT_TOKEN" \
     -d '{"test":"data"}'
   ```

2. **Notify Team**
   ```bash
   # Alert relevant team lead
   # - Backend Lead (if API issue)
   # - Frontend Lead (if UI issue)
   # - DevOps Lead (if infrastructure)
   ```

3. **Investigation**
   ```bash
   # Detailed log analysis
   railway logs --tail=1000 | grep -i error
   
   # Check recent deployments
   git log -n 20 --oneline
   railway deployments
   
   # Test in isolation
   # Reproduce locally if possible
   ```

#### Remediation (1-8 hours)

4. **Apply Fix**
   ```bash
   # Option 1: Hot fix
   # - Create fix branch
   # - Test locally
   # - Deploy via PR to develop
   # - Monitor staging
   # - Deploy to production
   
   # Option 2: Rollback
   # - Rollback to last known good version
   # - See RUNBOOK.md Rollback section
   
   # Option 3: Configuration change
   # - Update environment variables
   # - Restart service
   railway restart
   ```

5. **Verify Fix**
   ```bash
   # Test affected functionality
   # Run integration tests
   # Verify in staging first (if possible)
   # Deploy to production
   # Monitor for 1 hour post-fix
   ```

---

### P2 - Medium Response Procedure

#### Standard Response (4-48 hours)

1. **Document Issue**
   ```bash
   # Create GitHub issue
   # - Detailed description
   # - Steps to reproduce
   # - Expected vs actual behavior
   # - Screenshots/logs
   # - Priority label
   ```

2. **Investigation and Fix**
   ```bash
   # Analyze root cause
   # Develop fix in feature branch
   # Write/update tests
   # Submit PR for review
   # Deploy via standard release process
   ```

3. **Verification**
   ```bash
   # Verify fix in staging
   # Deploy to production
   # Monitor for side effects
   ```

---

## Common Incident Scenarios

### Scenario 1: Complete Application Outage

**Symptoms:**
- Website returns 502/503 error
- Health endpoint unreachable
- Containers stopped

**Diagnosis:**
```bash
# Check container status
docker ps -a | grep asset-registration
railway status

# Check logs
docker logs asset-registration-backend --tail=100
railway logs --tail=100
```

**Resolution:**
```bash
# Quick fix: Restart application
railway restart
# OR
docker-compose restart

# If restart fails: Check logs for root cause
# Common causes:
# - Port binding failure
# - Database connection failure
# - Environment variable missing
# - Memory limit exceeded

# If configuration issue: Fix and redeploy
# If persistent: Rollback to previous version
```

---

### Scenario 2: Authentication System Failure

**Symptoms:**
- Users cannot log in
- JWT validation errors
- 401 Unauthorized errors

**Diagnosis:**
```bash
# Check JWT configuration
railway run env | grep JWT_SECRET

# Test login endpoint
curl -X POST https://kars.jvhlabs.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Check logs for auth errors
railway logs | grep -i "auth\|jwt\|token"
```

**Resolution:**
```bash
# If JWT_SECRET missing/changed:
# 1. Verify JWT_SECRET is set correctly
railway variables

# 2. If secret rotated accidentally:
# - Restore previous JWT_SECRET
# - OR inform users tokens are invalidated (requires re-login)

# If database issue:
# - Check users table exists
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# If code issue:
# - Review recent auth-related changes
# - Rollback if necessary
```

---

### Scenario 3: Database Performance Degradation

**Symptoms:**
- Slow API responses (>5 seconds)
- Timeout errors
- High database CPU/memory usage

**Diagnosis:**
```bash
# Check query performance (PostgreSQL)
railway run psql $DATABASE_URL -c "\
  SELECT query, calls, mean_exec_time \
  FROM pg_stat_statements \
  ORDER BY mean_exec_time DESC \
  LIMIT 10;"

# Check active connections
railway run psql $DATABASE_URL -c "\
  SELECT count(*) FROM pg_stat_activity;"

# Check database size
railway run psql $DATABASE_URL -c "\
  SELECT pg_size_pretty(pg_database_size(current_database()));"

# For SQLite: Check file size
docker exec asset-registration-backend ls -lh /app/data/assets.db
```

**Resolution:**
```bash
# Short-term:
# 1. Add missing indexes
# 2. Kill long-running queries (PostgreSQL)
railway run psql $DATABASE_URL -c "\
  SELECT pg_terminate_backend(pid) \
  FROM pg_stat_activity \
  WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"

# Medium-term:
# 1. Optimize slow queries
# 2. Add appropriate indexes
# 3. Implement query caching

# Long-term:
# 1. Scale database (Railway: upgrade plan)
# 2. Implement read replicas
# 3. Consider query optimization
```

---

### Scenario 4: Deployment Failure

**Symptoms:**
- GitHub Actions build fails
- Railway deployment fails
- New version not live after deploy

**Diagnosis:**
```bash
# Check GitHub Actions
# https://github.com/humac/kars/actions

# Check Railway deployment logs
railway logs --deployment latest

# Review build logs
# Look for:
# - npm install/build errors
# - Test failures
# - Docker build errors
```

**Resolution:**
```bash
# If tests failing:
# 1. Fix tests locally
# 2. Push fix to develop/main
# 3. CI will re-run

# If build errors:
# 1. Review package.json changes
# 2. Verify dependencies
# 3. Test build locally: npm run build
# 4. Push fix

# If Railway deployment stuck:
# 1. Check Railway status: https://status.railway.app
# 2. Cancel deployment if stuck
railway deployment cancel
# 3. Retry deployment
railway up

# If persistent issues:
# 1. Rollback to previous version
# 2. Investigate offline
# 3. Deploy fix when ready
```

---

### Scenario 5: Data Corruption or Loss

**Symptoms:**
- Missing records
- Incorrect data returned
- Database errors in logs

**Diagnosis:**
```bash
# Check database integrity
# SQLite:
docker exec asset-registration-backend \
  sqlite3 /app/data/assets.db "PRAGMA integrity_check;"

# PostgreSQL:
railway run psql $DATABASE_URL -c "SELECT * FROM pg_stat_database_conflicts;"

# Verify record counts
railway run psql $DATABASE_URL -c "\
  SELECT 'users' as table, COUNT(*) as count FROM users \
  UNION ALL \
  SELECT 'assets', COUNT(*) FROM assets \
  UNION ALL \
  SELECT 'companies', COUNT(*) FROM companies;"

# Check audit logs for deletions
railway run psql $DATABASE_URL -c "\
  SELECT * FROM audit_logs \
  WHERE action = 'DELETE' \
  ORDER BY timestamp DESC \
  LIMIT 50;"
```

**Resolution:**
```bash
# ⚠️ STOP APPLICATION IMMEDIATELY
railway scale web=0
# OR
docker-compose down

# Assess damage
# 1. Identify what data is affected
# 2. Determine when corruption occurred
# 3. Find last known good backup

# Restore from backup
# See RUNBOOK.md Database Operations

# If backup not available:
# 1. Attempt database recovery tools
# 2. Reconstruct from audit logs (if available)
# 3. Contact affected users

# Investigate root cause
# 1. Review code changes
# 2. Check for malicious activity
# 3. Implement safeguards
```

---

### Scenario 6: Security Breach

**Symptoms:**
- Unauthorized access detected
- Suspicious audit log entries
- External security report

**Response:**
```bash
# ⚠️ IMMEDIATE ACTIONS:

# 1. Verify breach
# Review audit logs
railway run psql $DATABASE_URL -c "\
  SELECT * FROM audit_logs \
  WHERE timestamp > NOW() - INTERVAL '24 hours' \
  ORDER BY timestamp DESC;"

# 2. Contain breach
# - Revoke compromised credentials
# - Rotate JWT_SECRET (invalidates all sessions)
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
railway restart

# 3. Alert security team IMMEDIATELY

# 4. Preserve evidence
# - Download all logs
railway logs > incident-logs-$(date +%Y%m%d).txt
# - Export audit logs
# - Take database snapshot

# 5. Assess impact
# - What data was accessed?
# - What data was modified?
# - Was data exfiltrated?

# 6. Notify affected parties
# - Internal stakeholders
# - Affected users (if PII exposed)
# - Legal team (if required by law)

# 7. Remediation
# - Patch vulnerability
# - Enhance security controls
# - Reset all user passwords (if necessary)

# 8. Post-incident
# - Security audit
# - Implement additional safeguards
# - Update security procedures
```

---

## Communication Protocols

### Internal Communication

#### Incident Channel
- **Platform:** Slack/Teams/Discord
- **Channel:** #incidents or #alerts
- **Format:** Structured updates every 30 minutes (P0/P1)

#### Update Template
```
🚨 INCIDENT UPDATE - P[0-3]
━━━━━━━━━━━━━━━━━━━━━━━━
📋 ID: INC-YYYYMMDD-NNN
⏰ Time: YYYY-MM-DD HH:MM UTC
📊 Status: [INVESTIGATING/IDENTIFIED/FIXING/MONITORING/RESOLVED]
━━━━━━━━━━━━━━━━━━━━━━━━
📝 Summary:
[Brief description of current state]

🔍 Progress:
[What we've found and done]

⏭️ Next Steps:
[What we're doing next]

⏱️ ETA: [Expected resolution time]
👥 Impact: [Number/type of users affected]
━━━━━━━━━━━━━━━━━━━━━━━━
```

### External Communication

#### For P0/P1 Incidents Affecting Users

**Status Page Update** (if applicable):
```
INVESTIGATING: We are aware of an issue affecting [service/feature].
Our team is actively investigating.
[Timestamp]

UPDATE: We have identified the cause and are implementing a fix.
Estimated resolution: [Time]
[Timestamp]

RESOLVED: The issue has been resolved. Service is fully operational.
[Timestamp]
```

**Email to Users** (if significant downtime):
```
Subject: [RESOLVED] Service Disruption - [Date]

Dear KARS Users,

We experienced a service disruption on [Date] from [Start Time] to [End Time] UTC.

What Happened:
[Brief, non-technical explanation]

Impact:
[What users experienced]

Resolution:
[What was done to fix it]

Prevention:
[What we're doing to prevent recurrence]

We apologize for any inconvenience caused.

KARS Team
```

---

## Post-Incident Review

### Conduct Within 48 Hours of Resolution

#### Post-Incident Review Template

**Incident Report: INC-YYYYMMDD-NNN**

**1. Incident Summary**
- **Date/Time:** YYYY-MM-DD HH:MM UTC
- **Duration:** X hours Y minutes
- **Severity:** P[0-3]
- **Service Affected:** [Component/Feature]
- **Users Impacted:** [Number/Percentage]

**2. Timeline**
- **Detection:** HH:MM - [How was it detected?]
- **Acknowledgment:** HH:MM - [Who acknowledged?]
- **Investigation Start:** HH:MM
- **Root Cause Identified:** HH:MM
- **Fix Applied:** HH:MM
- **Service Restored:** HH:MM
- **Verification Complete:** HH:MM

**3. Root Cause Analysis**
- **Primary Cause:** [Technical explanation]
- **Contributing Factors:** [What made it worse?]
- **Why Did It Happen:** [Process/procedure gaps]

**4. Resolution Details**
- **Immediate Fix:** [What was done to restore service?]
- **Verification:** [How was resolution confirmed?]

**5. Impact Assessment**
- **User Impact:** [What could users not do?]
- **Data Impact:** [Any data loss/corruption?]
- **Business Impact:** [Revenue/reputation impact?]

**6. What Went Well**
- [Positive aspects of response]

**7. What Could Be Improved**
- [Areas for improvement]

**8. Action Items**

| Action | Owner | Due Date | Priority | Status |
|--------|-------|----------|----------|--------|
| [Implement monitoring for X] | DevOps Lead | YYYY-MM-DD | High | Open |
| [Add automated test for Y] | Backend Lead | YYYY-MM-DD | Medium | Open |
| [Update runbook with Z] | On-Call Engineer | YYYY-MM-DD | Low | Open |

**9. Lessons Learned**
- [Key takeaways]
- [Process improvements]
- [Technical improvements]

---

## Escalation Matrix

### Escalation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INCIDENT DETECTED                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   On-Call Engineer            │
         │   (Primary Responder)         │
         │   Response Time: Immediate    │
         └───────────┬───────────────────┘
                     │
                     │ If P0 or Unable to
                     │ Resolve P1 in 2hr
                     ▼
         ┌───────────────────────────────┐
         │   Appropriate Team Lead       │
         │   - DevOps (infrastructure)   │
         │   - Backend (API/DB)          │
         │   - Frontend (UI)             │
         │   - Security (breach)         │
         └───────────┬───────────────────┘
                     │
                     │ If No Resolution
                     │ P0: 2hr, P1: 4hr
                     ▼
         ┌───────────────────────────────┐
         │   Engineering Manager         │
         │   (Cross-team coordination)   │
         └───────────┬───────────────────┘
                     │
                     │ If Prolonged P0
                     │ (>4 hours)
                     ▼
         ┌───────────────────────────────┐
         │   CTO / Executive Team        │
         │   (Business impact decisions) │
         └───────────────────────────────┘
```

### When to Escalate

| Scenario | Escalate To | When |
|----------|-------------|------|
| P0 incident | DevOps Lead + Backend Lead | Immediately |
| P0 unresolved | Engineering Manager | After 2 hours |
| P1 unresolved | Appropriate Team Lead | After 2 hours |
| P1 unresolved | Engineering Manager | After 4 hours |
| Security breach | Security Team | Immediately |
| Data loss | Backend Lead + Engineering Manager | Immediately |
| Extended outage | CTO/Executive Team | P0 >4 hours |

---

## Emergency Contacts

### Primary Contacts

**On-Call Engineer**
- Method: PagerDuty rotation
- Response Time: 15 minutes
- Availability: 24/7

**DevOps Lead**
- Contact: [Contact Info]
- Escalation: P0 immediate, P1 within 2hr
- Availability: 24/7 for P0

**Backend Lead**
- Contact: [Contact Info]
- Escalation: P0/P1 backend issues
- Availability: Business hours + on-call

**Security Team**
- Contact: security@company.com
- Escalation: Any security incident
- Availability: 24/7 for security

---

## Quick Reference

### Critical Commands

```bash
# Health check
curl https://kars.jvhlabs.com/api/health

# View logs
railway logs --tail=100
docker logs asset-registration-backend --tail=100

# Restart service
railway restart
docker-compose restart

# Rollback deployment
railway rollback
# Or deploy specific version
railway up --tag v1.x.x

# Database backup
railway run pg_dump > emergency-backup-$(date +%Y%m%d).sql

# Check service status
railway status
docker ps
```

---

**Last Updated:** December 2024  
**Maintained By:** DevOps Team  
**Next Review:** Q1 2025  
**Emergency Hotline:** [Contact Info]
