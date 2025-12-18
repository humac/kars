# KARS Weekly Release Checklist

This checklist ensures consistent, safe, and high-quality releases of KARS to production.

## Release Overview

- **Frequency:** Weekly (every Friday)
- **Time Window:** 2:00 PM - 4:00 PM EST (off-peak hours)
- **Duration:** ~30 minutes (excluding monitoring)
- **Rollback Window:** Prepared for immediate rollback if issues detected

---

## Pre-Release Phase (Thursday - Friday Morning)

### Code Freeze (Thursday 5:00 PM EST)

- [ ] **Announce Code Freeze**
  - Post in team chat: "Code freeze for weekly release active. No merges to `develop` until release complete."
  - Update #releases channel with release notes draft

- [ ] **Verify Develop Branch Status**
  ```bash
  git checkout develop
  git pull origin develop
  git log main..develop --oneline
  ```
  - [ ] Review commits since last release
  - [ ] Confirm all intended features merged
  - [ ] No work-in-progress commits

- [ ] **Check CI/CD Pipeline**
  - [ ] All tests passing on `develop`: https://github.com/humac/kars/actions
  - [ ] Frontend build successful
  - [ ] Backend build successful
  - [ ] No security audit failures (npm audit)
  - [ ] Code coverage meets threshold (>80%)

### Testing Phase (Friday Morning)

- [ ] **Staging Environment Verification**
  ```bash
  # Verify staging deployment
  curl https://staging.kars.jvhlabs.com/api/health
  ```
  - [ ] Staging deployed from latest `develop`
  - [ ] All containers running healthy
  - [ ] No error spikes in logs

- [ ] **Functional Testing on Staging**
  - [ ] **Authentication**
    - [ ] User registration works
    - [ ] Login with email/password works
    - [ ] JWT token issued and validated
    - [ ] Logout works
  
  - [ ] **Asset Management**
    - [ ] Create new asset
    - [ ] View asset list
    - [ ] Edit asset
    - [ ] Delete asset
    - [ ] Search/filter assets
    - [ ] CSV export works
  
  - [ ] **User Management (Admin)**
    - [ ] View users list
    - [ ] Add new user
    - [ ] Edit user role
    - [ ] Delete user
  
  - [ ] **Company Management (Admin)**
    - [ ] View companies
    - [ ] Add new company
    - [ ] Edit company
    - [ ] Delete company
  
  - [ ] **MFA/Security Features**
    - [ ] MFA enrollment works
    - [ ] TOTP verification works
    - [ ] Passkey registration works
    - [ ] Passkey authentication works
  
  - [ ] **Admin Settings**
    - [ ] OIDC configuration
    - [ ] Email/SMTP settings
    - [ ] Branding customization
    - [ ] Passkey settings
  
  - [ ] **Audit Logging**
    - [ ] Audit logs capturing events
    - [ ] CSV export works
    - [ ] Role-based filtering works

- [ ] **Performance Testing**
  ```bash
  # Test response times
  time curl https://staging.kars.jvhlabs.com/api/assets
  time curl https://staging.kars.jvhlabs.com/api/users
  time curl https://staging.kars.jvhlabs.com/api/companies
  ```
  - [ ] API response times < 500ms
  - [ ] Page load times < 3 seconds
  - [ ] No memory leaks in containers

- [ ] **Security Scan**
  ```bash
  # Run security audit
  cd backend && npm audit --audit-level=high
  cd frontend && npm audit --audit-level=high
  ```
  - [ ] No high or critical vulnerabilities
  - [ ] Dependencies up to date (or known safe versions)

- [ ] **Database Migration Testing (if applicable)**
  - [ ] Migration scripts tested on staging
  - [ ] Rollback scripts prepared
  - [ ] Data integrity verified post-migration
  - [ ] Backup taken before migration

- [ ] **Browser Compatibility**
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)
  - [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Release Preparation (Friday 1:00 PM EST)

- [ ] **Create Release Branch**
  ```bash
  git checkout develop
  git pull origin develop
  git checkout -b release/v1.x.x
  git push origin release/v1.x.x
  ```

- [ ] **Update Version Numbers**
  ```bash
  # Update package.json versions
  cd backend
  npm version patch  # or minor/major
  cd ../frontend
  npm version patch
  git add .
  git commit -m "chore: bump version to v1.x.x"
  git push origin release/v1.x.x
  ```

- [ ] **Generate Release Notes**
  ```bash
  # Review commits
  git log main..develop --oneline --no-merges
  
  # Create CHANGELOG.md entry
  # Format:
  ## [1.x.x] - YYYY-MM-DD
  ### Added
  - Feature A
  - Feature B
  
  ### Changed
  - Updated X
  
  ### Fixed
  - Bug Y
  - Issue Z
  
  ### Security
  - Security improvement W
  ```

- [ ] **Create Pull Request**
  - [ ] PR from `release/v1.x.x` to `main`
  - [ ] Title: "Release v1.x.x"
  - [ ] Include release notes in description
  - [ ] Request review from team lead

- [ ] **Notify Stakeholders**
  ```
  📢 RELEASE NOTIFICATION
  
  Release: v1.x.x
  Scheduled: Friday, [Date] at 2:00 PM EST
  Duration: ~30 minutes
  Expected Downtime: None (rolling deployment)
  
  Release Notes: [Link to PR]
  
  Features:
  - [Feature 1]
  - [Feature 2]
  
  Bug Fixes:
  - [Fix 1]
  - [Fix 2]
  
  Please report any issues in #support channel.
  ```

---

## Release Phase (Friday 2:00 PM EST)

### Pre-Deployment Checks

- [ ] **Verify Production Health**
  ```bash
  curl https://kars.jvhlabs.com/api/health
  railway status
  ```
  - [ ] Production running stable
  - [ ] No ongoing incidents
  - [ ] Recent error rates normal

- [ ] **Backup Production Database**
  ```bash
  # PostgreSQL backup
  railway run pg_dump > backup-pre-release-$(date +%Y%m%d-%H%M).sql
  
  # Verify backup
  ls -lh backup-pre-release-*.sql
  ```
  - [ ] Backup created successfully
  - [ ] Backup file size reasonable
  - [ ] Backup stored securely

- [ ] **Review Rollback Plan**
  - [ ] Previous version tag identified: `v1.x.x-previous`
  - [ ] Rollback procedure reviewed
  - [ ] Team on standby for monitoring

### Deployment Execution

- [ ] **Merge Release PR**
  ```bash
  # After PR approval
  # Merge release branch to main
  git checkout main
  git pull origin main
  git merge --no-ff release/v1.x.x
  git push origin main
  ```

- [ ] **Create Release Tag**
  ```bash
  git tag -a v1.x.x -m "Release v1.x.x - [Brief description]"
  git push origin v1.x.x
  ```

- [ ] **Merge Back to Develop**
  ```bash
  git checkout develop
  git pull origin develop
  git merge --no-ff main
  git push origin develop
  ```

- [ ] **Delete Release Branch**
  ```bash
  git branch -d release/v1.x.x
  git push origin --delete release/v1.x.x
  ```

- [ ] **Deploy to Railway**
  ```bash
  # Railway auto-deploys from main branch
  # OR manually trigger:
  railway up
  
  # Monitor deployment
  railway logs --follow
  ```
  - [ ] Build started
  - [ ] Build completed successfully
  - [ ] Deployment started
  - [ ] Deployment active

### Post-Deployment Verification (2:15 PM - 2:30 PM EST)

- [ ] **Verify Deployment Success**
  ```bash
  # Check health
  curl https://kars.jvhlabs.com/api/health
  
  # Check version (if version endpoint exists)
  curl https://kars.jvhlabs.com/api/version
  
  # Check Railway status
  railway status
  ```

- [ ] **Smoke Tests**
  ```bash
  # Test critical endpoints
  curl -I https://kars.jvhlabs.com
  curl https://kars.jvhlabs.com/api/health
  curl https://kars.jvhlabs.com/api/companies  # Should require auth
  ```
  - [ ] Frontend loads
  - [ ] Backend responds
  - [ ] Database connected

- [ ] **Critical Path Testing**
  - [ ] **Login Flow**
    - [ ] Navigate to https://kars.jvhlabs.com
    - [ ] Login with test account
    - [ ] JWT token received
    - [ ] Dashboard loads
  
  - [ ] **Asset Operations**
    - [ ] View asset list
    - [ ] Create test asset
    - [ ] Edit test asset
    - [ ] Delete test asset
  
  - [ ] **Admin Functions**
    - [ ] Access admin settings
    - [ ] View users list
    - [ ] View companies list
    - [ ] Check audit logs

- [ ] **Performance Check**
  ```bash
  # Response time verification
  time curl https://kars.jvhlabs.com/api/assets
  # Should be < 500ms
  
  # Load test (optional)
  ab -n 100 -c 10 https://kars.jvhlabs.com/
  ```

- [ ] **Error Monitoring**
  ```bash
  # Check logs for errors
  railway logs --tail=500 | grep -i error
  railway logs --tail=500 | grep -i exception
  railway logs --tail=500 | grep -i fatal
  ```
  - [ ] No new error patterns
  - [ ] No critical errors
  - [ ] Error rate normal

- [ ] **Database Integrity**
  ```bash
  # Verify record counts
  railway run psql $DATABASE_URL -c "\
    SELECT 'users' as table, COUNT(*) FROM users \
    UNION ALL \
    SELECT 'assets', COUNT(*) FROM assets \
    UNION ALL \
    SELECT 'companies', COUNT(*) FROM companies;"
  
  # Check recent audit logs
  railway run psql $DATABASE_URL -c "\
    SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 5;"
  ```

---

## Post-Release Phase (2:30 PM - 4:00 PM EST)

### Monitoring Period

- [ ] **Active Monitoring (First 30 Minutes)**
  ```bash
  # Continuous log monitoring
  railway logs --follow | grep -i "error\|exception\|fatal"
  
  # Watch health endpoint
  watch -n 30 'curl -s https://kars.jvhlabs.com/api/health && echo OK'
  ```

- [ ] **User Feedback Monitoring**
  - [ ] Monitor #support channel for issues
  - [ ] Check error reporting system
  - [ ] Review user-reported issues

- [ ] **Metrics Review** (30 minutes post-deploy)
  ```bash
  # Check error rates
  railway logs --since=30m | grep -c error
  
  # Check response times
  # Monitor via Railway dashboard or APM tool
  ```
  - [ ] Error rate stable or decreased
  - [ ] Response times within normal range
  - [ ] No user complaints

### Release Completion

- [ ] **Update Documentation**
  - [ ] Update README.md if needed
  - [ ] Update CHANGELOG.md
  - [ ] Update wiki if major features
  - [ ] Update API documentation if endpoints changed

- [ ] **Create GitHub Release**
  - [ ] Go to: https://github.com/humac/kars/releases
  - [ ] Click "Draft a new release"
  - [ ] Select tag: v1.x.x
  - [ ] Release title: "v1.x.x - [Brief description]"
  - [ ] Copy release notes from CHANGELOG.md
  - [ ] Publish release

- [ ] **Notify Stakeholders - Success**
  ```
  ✅ RELEASE COMPLETE - v1.x.x
  
  Status: Successful
  Deployed: Friday, [Date] at 2:00 PM EST
  Duration: 15 minutes
  Downtime: None
  
  New Features:
  - [Feature 1]
  - [Feature 2]
  
  Bug Fixes:
  - [Fix 1]
  - [Fix 2]
  
  Monitoring: All systems normal
  
  Thank you for your patience during the release!
  ```

- [ ] **Lift Code Freeze**
  - Post in team chat: "Code freeze lifted. Normal development can resume."

- [ ] **Archive Release Branch** (if not already deleted)
  ```bash
  git branch -d release/v1.x.x
  git push origin --delete release/v1.x.x
  ```

---

## Rollback Procedure (If Needed)

### When to Rollback

Rollback immediately if:
- [ ] Critical functionality broken
- [ ] Data corruption detected
- [ ] Security vulnerability introduced
- [ ] Error rate spike (>5x normal)
- [ ] Performance degradation (>50% slower)
- [ ] Database migration failure

### Rollback Steps

1. **Announce Rollback**
   ```
   🚨 ROLLBACK INITIATED - v1.x.x
   
   Reason: [Brief description]
   Action: Rolling back to v1.x.x-previous
   ETA: 10 minutes
   ```

2. **Execute Rollback**
   ```bash
   # Option 1: Railway Dashboard
   # Go to Deployments → Find previous successful deployment → Redeploy
   
   # Option 2: Railway CLI
   railway rollback
   
   # Option 3: Git revert
   git revert HEAD
   git push origin main
   
   # Option 4: Deploy previous tag
   git checkout v1.x.x-previous
   railway up
   ```

3. **Rollback Database (if migration failed)**
   ```bash
   # Stop application
   railway scale web=0
   
   # Restore backup
   railway run psql $DATABASE_URL < backup-pre-release-*.sql
   
   # Restart application
   railway scale web=1
   ```

4. **Verify Rollback**
   ```bash
   curl https://kars.jvhlabs.com/api/health
   railway logs --tail=100
   
   # Test critical paths
   # Verify functionality restored
   ```

5. **Notify Stakeholders**
   ```
   ✅ ROLLBACK COMPLETE
   
   Status: Service restored
   Version: Rolled back to v1.x.x-previous
   Impact: [Duration and scope]
   
   Next Steps:
   - Investigation underway
   - Fix in progress
   - New release scheduled
   ```

6. **Post-Rollback**
   - [ ] Incident report created
   - [ ] Root cause investigation started
   - [ ] Fix planned for next release
   - [ ] Post-mortem scheduled

---

## Emergency Release Procedure

### For Critical Hotfixes

When a critical bug is discovered in production that requires immediate fix:

1. **Create Hotfix Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/v1.x.y
   ```

2. **Apply Fix**
   ```bash
   # Make minimal fix
   # Add test for the fix
   # Verify fix locally
   npm test
   ```

3. **Fast-Track Testing**
   - [ ] Deploy to staging
   - [ ] Test fix specifically
   - [ ] Verify no side effects

4. **Emergency Deployment**
   ```bash
   # Merge to main
   git checkout main
   git merge --no-ff hotfix/v1.x.y
   git tag -a v1.x.y -m "Hotfix: [Description]"
   git push origin main --tags
   
   # Merge back to develop
   git checkout develop
   git merge --no-ff hotfix/v1.x.y
   git push origin develop
   
   # Deploy
   railway up
   ```

5. **Accelerated Verification**
   - [ ] Test fix in production
   - [ ] Monitor for 15 minutes
   - [ ] Notify stakeholders

---

## Release Metrics

### Track After Each Release

```markdown
## Release v1.x.x Metrics

**Deployment:**
- Start Time: YYYY-MM-DD HH:MM:SS EST
- End Time: YYYY-MM-DD HH:MM:SS EST
- Duration: XX minutes
- Downtime: 0 minutes (rolling deployment)

**Testing:**
- Tests Passed: XXX/XXX (100%)
- Code Coverage: XX%
- Security Vulnerabilities: 0 high/critical

**Performance:**
- Build Time: X minutes
- Deployment Time: X minutes
- First Response Time: XXXms
- Error Rate: X.XX%

**Scope:**
- Commits: XX
- Files Changed: XX
- Lines Added: XXX
- Lines Removed: XXX

**Issues:**
- Rollbacks Required: 0
- Post-Deploy Bugs: 0
- User-Reported Issues: 0

**Team:**
- Release Manager: [Name]
- Deployer: [Name]
- Reviewers: [Names]
```

---

## Continuous Improvement

### Post-Release Retrospective

After each release, review:

- [ ] **What went well?**
  - Successful aspects
  - Smooth processes
  - Effective communication

- [ ] **What could be improved?**
  - Pain points
  - Delays encountered
  - Communication gaps

- [ ] **Action items**
  - Process improvements
  - Tool enhancements
  - Documentation updates

- [ ] **Update this checklist**
  - Add new steps as needed
  - Remove obsolete steps
  - Clarify ambiguous steps

---

## Quick Reference

### Key Commands

```bash
# Health check
curl https://kars.jvhlabs.com/api/health

# Deploy to Railway
railway up

# Rollback
railway rollback

# View logs
railway logs --follow

# Database backup
railway run pg_dump > backup-$(date +%Y%m%d).sql

# Check status
railway status
```

### Key URLs

- **Production:** https://kars.jvhlabs.com
- **Staging:** https://staging.kars.jvhlabs.com
- **GitHub Actions:** https://github.com/humac/kars/actions
- **Railway Dashboard:** https://railway.app/project/[project-id]

### Contacts

- **Release Manager:** [Contact]
- **DevOps Lead:** [Contact]
- **Backend Lead:** [Contact]
- **On-Call Engineer:** PagerDuty rotation

---

**Last Updated:** December 2024  
**Release Schedule:** Weekly (Fridays, 2:00 PM EST)  
**Next Review:** Q1 2025
