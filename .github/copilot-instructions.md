# GitHub Copilot Instructions for KARS

## Repository Overview

KARS (KeyData Asset Registration System) is a SOC2-compliant asset tracking web app with multi-factor authentication, role-based access control (RBAC), and comprehensive audit logging.

**Stack:** Node.js 22 LTS + Express + SQLite/PostgreSQL | React 18 + Vite + Tailwind + shadcn/ui | Jest/Vitest | Docker (ARM64/AMD64)

**Auth Methods:** JWT, WebAuthn/Passkeys, TOTP MFA, OIDC/SSO

**RBAC Roles:** employee (own assets), manager (own + team), admin (all access)

## Build & Test Commands

### Backend (`/backend`)

**⚠️ CRITICAL: Node 22 LTS required** (`>=22 <23` in package.json) for native modules (better-sqlite3).

```bash
npm ci                # Install (ALWAYS use ci, not install)
npm test              # Jest tests
npm run dev           # Dev with auto-restart (port 3001)
npm start             # Production
```

**Requirements:** `.env` file with `JWT_SECRET` (copy from `.env.example`)

**Issues:** Missing .env → copy example | Native errors → use Node 22 | DB locked → delete `backend/data/*.db`

### Frontend (`/frontend`)

```bash
npm ci                # Install (use ci, not install)
npm test              # Vitest tests
npm run dev           # Dev server (port 3000, proxies /api to :3001)
npm run build         # Production build
```

**Issues:** API errors → ensure backend running | Build chunk warnings are normal

### Full Stack Development

```bash
cd backend && npm run dev     # Terminal 1
cd frontend && npm run dev    # Terminal 2
# Access: http://localhost:3000
```

## Project Architecture

### Repository Structure

```
/
├── backend/                    # Node.js Express API
│   ├── server.js              # Main server - all API routes
│   ├── database.js            # DB abstraction - SQLite/Postgres adapters
│   ├── auth.js                # JWT/password auth & RBAC
│   ├── mfa.js                 # TOTP 2FA & backup codes
│   ├── oidc.js                # SSO/OIDC integration
│   ├── hubspot.js             # HubSpot integration
│   ├── *.test.js              # Jest test files
│   └── package.json           # Dependencies
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── App.jsx            # Main app with routing (React Router v7)
│   │   ├── components/        # React components
│   │   │   ├── ui/            # shadcn/ui primitives (20+ components)
│   │   │   └── *.jsx          # Feature components
│   │   ├── contexts/          # AuthContext, UsersContext
│   │   ├── hooks/             # Custom React hooks (use-toast)
│   │   ├── pages/             # Page-level components
│   │   └── utils/             # Helper functions (webauthn.js)
│   ├── vite.config.js         # Vite config with API proxy
│   └── package.json           # Dependencies
│
├── .github/workflows/
│   ├── ci-tests.yml           # Runs on PR/push (frontend + backend tests)
│   ├── verify-files.yml       # Validates critical files exist
│   └── deploy-portainer.yml   # Multi-arch builds, deployment
│
├── docker-compose*.yml        # Various deployment configs
├── CLAUDE.md                  # Comprehensive AI assistant guide
├── AGENTS.md                  # Agent-specific guidance
└── README.md                  # User-facing documentation
```

### Key Patterns

**Backend:**
- ES modules only (`import`/`export`, no CommonJS)
- Routes: `/api/*` in `server.js`
- DB: `database.js` exports (assetDb, userDb, companyDb, auditDb, passkeyDb, etc.)
- Auth middleware: `authenticate`, `authorize('admin')`, `authorize('admin', 'manager')`
- Audit: `auditDb.create()` for ALL mutations

**Frontend:**
- Functional components + hooks only
- Router: React Router v7
- Auth: `useAuth()` from `AuthContext`
- Users: `useUsers()` from `UsersContext`
- UI: shadcn/ui from `@/components/ui/`
- Style: Tailwind CSS
- API: `/api/*` (proxied in dev)
- Imports: Use `@/` alias for `src/`

## Database Objects

```javascript
import {
  assetDb,              // Asset CRUD
  companyDb,            // Company management
  auditDb,              // Audit logs
  userDb,               // User auth & profiles
  passkeyDb,            // WebAuthn credentials
  oidcSettingsDb,       // SSO configuration
  brandingSettingsDb,   // Custom branding
  passkeySettingsDb,    // Passkey settings
  hubspotSettingsDb,    // HubSpot integration
  hubspotSyncLogDb,     // Sync audit trail
  syncAssetOwnership,   // Manager change propagation
} from './database.js';
```

## CI/CD & Validation

### GitHub Workflows

**ci-tests.yml** - Triggers: Push/PR to main/develop/claude/** | Runs tests in both modules | **MUST pass**

**verify-files.yml** - Validates critical files exist and are complete

**deploy-portainer.yml** - Builds multi-platform Docker images → GHCR → Portainer webhook

### Before Committing

1. Run `npm test` in changed module(s)
2. Backend: verify server starts
3. Frontend: run `npm run build`
4. Full stack: test integration manually

## Common Tasks

**New API Endpoint:**
```javascript
app.get('/api/my-endpoint',
  authenticate,
  authorize('admin'),  // Optional: restrict to roles
  async (req, res) => {
    const data = await myDb.getData();
    await auditDb.create({
      action: 'READ',
      resource_type: 'my_resource',
      resource_id: 'N/A',
      user_email: req.user.email,
      details: 'Retrieved data'
    });
    res.json({ success: true, data });
  }
);
```

**New Component:**
```javascript
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function MyComponent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // ...
}
```

**DB Changes:** Update `database.js` (both SQLite & PostgreSQL paths) → add migrations in init functions

## Environment Variables

**Backend `.env`** (copy from `.env.example`):
- `JWT_SECRET` **REQUIRED**
- `PORT` (default 3001)
- `DB_CLIENT` (sqlite/postgres)
- `POSTGRES_URL` (if using postgres)
- `ADMIN_EMAIL` (auto-admin on registration)
- `PASSKEY_RP_ID`, `PASSKEY_RP_NAME`, `PASSKEY_ORIGIN` (WebAuthn)
- `OIDC_ENABLED` and related OIDC settings (SSO)

## Authorization Quick Reference

```javascript
// Role-based data filtering
if (user.role === 'employee') {
  assets = await assetDb.getByEmployee(user.email);
} else if (user.role === 'manager') {
  const own = await assetDb.getByEmployee(user.email);
  const team = await assetDb.getByManager(user.email);
  assets = [...own, ...team];
} else if (user.role === 'admin') {
  assets = await assetDb.getAll();
}
```

## Security & Best Practices

- **Never commit:** .env, secrets, password hashes
- **Always use:** `npm ci` (not install), ES modules, async/await
- **DB changes:** Test both SQLite & PostgreSQL
- **Audit:** Log ALL mutations with `auditDb.create()`
- **Auth:** Use `authorize()` for protected routes
- **Validation:** Sanitize inputs, never leak sensitive data
- **Responses:** Always return `{ success: true/false, ... }` format

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check `.env` has JWT_SECRET, use Node 22, delete `backend/data/*.db` |
| Frontend API fails | Ensure backend on :3001, check vite proxy, browser console for CORS |
| Tests fail | Run `npm ci`, use Node 22 (backend), delete test DBs |
| Docker fails | Use Node 22 base, test `npm run build` locally |
| CI fails | Check Actions logs, test locally with `npm ci && npm test` |

## Tips for Coding Agents

1. **Node 22 LTS for backend** - Most common build failure cause
2. **Use `npm ci`** - Not `npm install`
3. **Test incrementally** - Run tests after each change
4. **Check both modules** - API changes affect backend AND frontend
5. **Follow existing patterns** - Code consistency is critical
6. **Read CLAUDE.md** - Comprehensive guide with all details
7. **Audit everything** - All data mutations need audit logs
8. **Never skip auth** - Always use authenticate/authorize middleware
