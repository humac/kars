# Critical Files Verification

This document describes the verification system for critical files in the KARS repository.

## Background

During a code review, it was reported that `backend/server.js` appeared truncated with only the first line visible. After thorough investigation, we determined this was a false alarm - the file is complete and functional. This verification system was added to prevent similar false alarms in the future.

## Verification Results (as of 2025-12-07)

### backend/server.js Status
- ✅ **Complete**: 3,067 lines (97KB)
- ✅ **Git Tracked**: Properly tracked in version control
- ✅ **Functional**: Server starts successfully
- ✅ **Tested**: All 58 backend tests pass
- ✅ **Integrity**: No encoding issues or corruption

### File Details
```
Size: 97,190 bytes
Lines: 3,067
Type: JavaScript source, ASCII text
MD5: 9cf1c591dc7dce04a54a1d218c97f1f4
```

## Automated Verification

We've implemented automated verification to ensure critical files remain complete:

### 1. Verification Script
Location: `.github/verify-critical-files.sh`

This script checks that critical files:
- Exist in the repository
- Are tracked by Git
- Have the expected minimum line count
- Are readable text files (not corrupted)

### 2. GitHub Actions Workflow
Location: `.github/workflows/verify-files.yml`

Automatically runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

## Manual Verification

To manually verify critical files, run:

```bash
chmod +x .github/verify-critical-files.sh
.github/verify-critical-files.sh
```

Expected output:
```
=== Critical Files Verification ===

Checking: Backend Server (backend/server.js)
  ✅ OK (3067 lines)
Checking: Database Module (backend/database.js)
  ✅ OK (1538 lines)
...
=== ✅ All critical files verified successfully ===
```

## Critical Files Monitored

1. **Backend Files**
   - `backend/server.js` - Main server file (min 2400 lines, currently ~3067)
   - `backend/database.js` - Database abstraction layer (min 1200 lines, currently ~1538)
   - `backend/auth.js` - Authentication module (min 50 lines)
   - `backend/oidc.js` - OIDC integration (min 50 lines)
   - `backend/mfa.js` - Multi-factor authentication (min 50 lines)
   - `backend/package.json` - Backend dependencies (min 30 lines)

2. **Frontend Files**
   - `frontend/package.json` - Frontend dependencies (min 30 lines)
   - `frontend/src/App.jsx` - Main React application (min 50 lines)

## Troubleshooting

### If verification fails:

1. **File missing**: Ensure you're in the correct branch and have pulled latest changes
2. **Not tracked by git**: Check `.gitignore` to ensure the file isn't excluded
3. **Too few lines**: The file may be corrupted or incomplete - check git history
4. **Not a text file**: File may be corrupted or binary - restore from git

### Common Issues

**Issue**: Code review tools report file as truncated
**Solution**: Verify the file manually using the commands above. The issue is likely with the review tool, not the file itself.

**Issue**: Git shows the file but it appears empty
**Solution**: Check for:
- Git LFS configuration (files might be stored externally)
- Symbolic links pointing to wrong locations
- Line ending issues (CRLF vs LF)

## Testing Backend Server

To verify the backend server is functional:

```bash
cd backend
npm install
npm test
```

Expected output:
```
Test Suites: 4 passed, 4 total
Tests:       58 passed, 58 total
```

To start the server:
```bash
npm start
```

Expected output:
```
Database initialized using SQLite
Using SQLITE database backend
KARS API running on http://localhost:3001
Health check: http://localhost:3001/api/health
```

## Resolution of Original Issue

**Issue**: Incomplete backend/server.js reference in code review

**Root Cause**: Code review tool error or transient issue  
**Resolution**: File verified to be complete and functional  
**Prevention**: Automated verification workflow added

**Status**: ✅ RESOLVED - No action needed on the file itself
