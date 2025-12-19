# CLAUDE.md - AI Assistant Guide for ACS

**ACS (Asset Compliance System)** - A web application that supports organizational SOC2 compliance by tracking client assets with multi-factor authentication, role-based access control, and comprehensive audit logging.
-
This document provides AI assistants with comprehensive guidance for working with this codebase effectively.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Setup](#development-setup)
4. [Coding Standards](#coding-standards)
5. [Database Patterns](#database-patterns)
6. [Authentication & Security](#authentication--security)
7. [Frontend Patterns](#frontend-patterns)
8. [Backend Patterns](#backend-patterns)
9. [Testing Requirements](#testing-requirements)
10. [Deployment & CI/CD](#deployment--cicd)
11. [Common Tasks](#common-tasks)
12. [Important Conventions](#important-conventions)

---

## Project Overview

### Purpose
Web application that supports organizational SOC2 compliance by tracking client assets assigned to consultants with full authentication, role-based access control, and automated deployment.

### Tech Stack

**Backend:**
- Node.js 22 LTS (ES modules)
- Express.js
- Database: SQLite (default) / PostgreSQL (optional)
- Authentication: JWT, WebAuthn/Passkeys, TOTP MFA, OIDC/SSO
- Testing: Jest with supertest

**Frontend:**
- React 18 with functional components and hooks
- Vite (build tool)
- Tailwind CSS for styling
- shadcn/ui components (Radix UI primitives)
- React Router v7
- Testing: Vitest with @testing-library/react

**DevOps:**
- Docker multi-platform builds (AMD64, ARM64)
- GitHub Actions CI/CD
- Portainer deployment
- Cloudflare Tunnel for SSL

### Repository Structure

```
/home/user/kars/
├── backend/                    # Node.js Express API (21 files)
│   ├── server.js              # Main Express server (107k lines - comprehensive)
│   ├── database.js            # Database abstraction layer (69k lines)
│   ├── auth.js                # JWT authentication & RBAC
│   ├── mfa.js                 # TOTP/backup codes
│   ├── oidc.js                # SSO integration
│   ├── hubspot.js             # HubSpot integration
│   ├── *.test.js              # Jest test suites
│   └── package.json           # Backend dependencies
├── frontend/                   # React application (50 JSX files)
│   ├── src/
│   │   ├── App.jsx            # Main app component with routing
│   │   ├── main.jsx           # React entry point
│   │   ├── components/        # React components
│   │   │   ├── ui/            # shadcn/ui primitives (20 components)
│   │   │   ├── AssetTable.jsx
│   │   │   ├── UserManagement.jsx
│   │   │   ├── AdminSettings.jsx
│   │   │   └── ...
│   │   ├── contexts/          # React contexts
│   │   │   ├── AuthContext.jsx
│   │   │   └── UsersContext.jsx
│   │   ├── hooks/             # Custom React hooks
│   │   │   └── use-toast.js
│   │   ├── pages/             # Page components
│   │   │   └── AssetsPage.jsx
│   │   ├── utils/             # Utility functions
│   │   │   └── webauthn.js
│   │   └── test/              # Test setup and utilities
│   ├── vite.config.js         # Vite configuration
│   └── package.json           # Frontend dependencies
├── .github/workflows/         # CI/CD pipelines
│   ├── ci-tests.yml           # Automated testing
│   ├── deploy-portainer.yml   # Deployment automation
│   ├── verify-files.yml       # File verification
│   └── wiki-sync.yml          # Documentation sync
├── docker-compose*.yml        # Docker configurations
├── README.md                  # User-facing documentation
├── DEPLOYMENT.md              # Deployment guide
└── *.md                       # Additional documentation
```

---

## Architecture

### System Design

**Three-Tier Architecture:**
1. **Presentation Layer**: React SPA with shadcn/ui components
2. **Application Layer**: Express REST API with JWT auth
3. **Data Layer**: Dual database support (SQLite/PostgreSQL)

### Key Design Patterns

**Backend:**
- **Database Abstraction**: Single interface (`database.js`) supporting both SQLite and PostgreSQL
- **Middleware Chain**: Authentication → Authorization → Route Handler
- **Audit Logging**: Automatic tracking of all CRUD operations
- **Role-Based Access Control**: Four roles (employee, manager, attestation_coordinator, admin)

**Frontend:**
- **Context API**: Global state management (AuthContext, UsersContext)
- **Component Composition**: Reusable UI primitives from shadcn/ui
- **Protected Routes**: Authentication-gated navigation
- **Custom Hooks**: Encapsulated logic (use-toast)

### Data Model

**Core Entities:**
- **Users**: Authentication, roles, MFA settings, passkeys
- **Assets**: Multi-type support (laptop, mobile phone), ownership tracking
- **Companies**: Client organizations
- **Audit Logs**: Immutable action history
- **Settings**: OIDC, Passkeys, Branding, HubSpot

**Relationships:**
- Assets → Users (employee, manager)
- Assets → Companies
- Audit Logs → Users (actor)
- Passkeys → Users (multi-credential support)

---

## Development Setup

### Prerequisites
```bash
# Required
Node.js 22.x LTS (use nvm for version management)
npm 9.x or higher

# Optional (for PostgreSQL)
PostgreSQL 14+ with database created
```

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/humac/kars.git
cd kars

# 2. Backend setup
cd backend
npm install
cp ../.env.example .env
# Edit .env: Set JWT_SECRET and optional configs
npm run dev  # Starts on http://localhost:3001

# 3. Frontend setup (new terminal)
cd ../frontend
npm install
npm run dev  # Starts on http://localhost:5173
# Note: Vite proxies /api to backend:3001
```

### Environment Variables

**Backend (.env):**
```bash
# Required
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=3001
NODE_ENV=development

# Database (optional - defaults to SQLite in ./backend/data)
DATA_DIR=/app/data
DB_CLIENT=sqlite  # or 'postgres'
POSTGRES_URL=postgresql://user:pass@host:5432/dbname

# Authentication (optional)
ADMIN_EMAIL=admin@example.com
PASSKEY_RP_ID=localhost
PASSKEY_RP_NAME=ACS
PASSKEY_ORIGIN=http://localhost:3000
OIDC_ENABLED=false
# See .env.example for full OIDC configuration

# First user to register becomes admin automatically
```

**Frontend:**
- No .env needed (uses Vite proxy configuration)
- API calls automatically proxied to `http://localhost:3001`

---

## Coding Standards

### General Principles

1. **Preserve Existing Patterns**: Match the style and structure of surrounding code
2. **Security First**: Never introduce vulnerabilities (XSS, SQLi, auth bypass, etc.)
3. **Avoid Over-Engineering**: Only add what's requested; no speculative features
4. **Audit Everything**: All data mutations must create audit log entries
5. **Test Coverage**: Add/update tests for significant logic changes

### JavaScript/Node.js Standards

**ES Modules (Required):**
```javascript
// ✅ Correct - ES module syntax
import express from 'express';
export const myFunction = () => {};

// ❌ Wrong - No CommonJS
const express = require('express');
module.exports = myFunction;
```

**Async/Await (Preferred):**
```javascript
// ✅ Correct
const data = await database.query();

// ❌ Avoid - No callbacks or raw promises
database.query().then(data => {});
```

**Error Handling:**
```javascript
// ✅ Correct - Structured JSON responses
try {
  const result = await riskyOperation();
  res.json({ success: true, data: result });
} catch (err) {
  console.error('Operation failed:', err);
  res.status(500).json({
    success: false,
    message: 'User-friendly error message',
    // Never leak secrets or stack traces in production
  });
}
```

### Code Organization

**Imports Order:**
```javascript
// 1. Node.js built-ins
import { readFile } from 'fs/promises';

// 2. External packages
import express from 'express';
import jwt from 'jsonwebtoken';

// 3. Local modules
import { userDb, auditDb } from './database.js';
import { authenticate, authorize } from './auth.js';
```

**Function Structure:**
```javascript
// Pure functions preferred
export const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

// Async for I/O operations
export const fetchUserAssets = async (userId) => {
  const assets = await assetDb.getByEmployee(userId);
  return assets;
};
```

---

## Database Patterns

### Database Abstraction Layer

**Location**: `backend/database.js` (69KB, ~2000 lines)

**Key Concept**: Single API surface with dual engine support (SQLite/PostgreSQL)

### Database Objects

All database operations go through specialized objects:

```javascript
import {
  assetDb,      // Asset CRUD operations
  companyDb,    // Company management
  auditDb,      // Audit log operations
  userDb,       // User authentication & profiles
  passkeyDb,    // WebAuthn credentials
  oidcSettingsDb,      // SSO configuration
  brandingSettingsDb,  // Custom branding
  passkeySettingsDb,   // Passkey configuration
  hubspotSettingsDb,   // HubSpot integration
  hubspotSyncLogDb,    // Sync audit trail
  databaseSettings,    // Engine switching
  databaseEngine,      // Current engine ('sqlite' or 'postgres')
  syncAssetOwnership,  // Manager change propagation
  importSqliteDatabase // Migration helper
} from './database.js';
```

### Common Patterns

**Reading Data:**
```javascript
// Get all (with optional filtering)
const assets = await assetDb.getAll();
const userAssets = await assetDb.getByEmployee(email);
const teamAssets = await assetDb.getByManager(managerEmail);

// Get by ID
const asset = await assetDb.getById(assetId);

// Get user
const user = await userDb.getByEmail(email);
```

**Creating Data:**
```javascript
// Create asset
const newAsset = await assetDb.create({
  employee_first_name: 'John',
  employee_last_name: 'Doe',
  employee_email: 'john@example.com',
  manager_first_name: 'Jane',
  manager_last_name: 'Smith',
  manager_email: 'jane@example.com',
  company: 'Acme Corp',
  asset_type: 'laptop',
  make: 'Apple',
  model: 'MacBook Pro',
  serial_number: 'ABC123',
  asset_tag: 'ASSET-001',
  status: 'active',
  notes: 'Optional notes'
});

// Always create audit log after mutations
await auditDb.create({
  action: 'CREATE',
  resource_type: 'asset',
  resource_id: newAsset.id,
  user_email: req.user.email,
  details: 'Created laptop asset ASSET-001'
});
```

**Updating Data:**
```javascript
// Update asset
const updated = await assetDb.update(assetId, {
  status: 'returned',
  notes: 'Returned on 2025-01-15'
});

// Log the update
await auditDb.create({
  action: 'UPDATE',
  resource_type: 'asset',
  resource_id: assetId,
  user_email: req.user.email,
  details: 'Updated asset status to returned'
});
```

**Deleting Data:**
```javascript
// Check if deletion is allowed
const assets = await assetDb.getByCompany(companyName);
if (assets.length > 0) {
  return res.status(400).json({
    success: false,
    message: 'Cannot delete company with existing assets'
  });
}

// Delete and audit
await companyDb.delete(companyId);
await auditDb.create({
  action: 'DELETE',
  resource_type: 'company',
  resource_id: companyId,
  user_email: req.user.email,
  details: `Deleted company: ${companyName}`
});
```

### Security Considerations

**Column Name Validation:**
```javascript
// database.js includes validation for dynamic SQL
const isValidColumnName = (columnName) => {
  // Must be alphanumeric + underscore/hyphen only
  // 1-64 characters, starts with letter or underscore
  return /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(columnName);
};
```

**Path Validation (for SSL certs):**
```javascript
// database.js validates absolute paths for PostgreSQL SSL
const isValidCertPath = (filePath) => {
  // Must be absolute, no path traversal (..)
  // Protects against directory traversal attacks
};
```

### Manager Ownership Sync

**Critical Function**: `syncAssetOwnership(email)`

When a user's manager changes, ALL their assets must update:

```javascript
// After updating user's manager in userDb
await syncAssetOwnership(userEmail);

// This propagates manager changes to all assets owned by the user
```

---

## Authentication & Security

### Authentication Mechanisms

ACS supports **four authentication methods**:

1. **Password + JWT**: bcrypt hashing, 7-day tokens
2. **WebAuthn/Passkeys**: FIDO2 biometric authentication
3. **TOTP MFA**: Time-based one-time passwords with backup codes
4. **OIDC/SSO**: External identity providers (Auth0, Google, Azure AD, Okta)

### Role-Based Access Control (RBAC)

**Four Roles:**

| Role | Capabilities |
|------|-------------|
| **employee** | View/edit own assets only; view own audit logs; complete own attestations |
| **manager** | View all assets and audit logs; bulk import assets; read-only users access; help team with attestations |
| **attestation_coordinator** | Create/manage attestation campaigns; read-only access to assets, users, companies, audit logs |
| **admin** | Full access to all resources; system configuration; user management |

### Middleware Pattern

**backend/auth.js exports:**

```javascript
import { authenticate, authorize } from './auth.js';

// Protected route (any authenticated user)
app.get('/api/profile', authenticate, async (req, res) => {
  // req.user available here
  const user = await userDb.getByEmail(req.user.email);
  res.json({ user });
});

// Role-restricted route
app.post('/api/companies',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    // Only admins reach here
  }
);

// Multiple roles
app.get('/api/users',
  authenticate,
  authorize('admin', 'manager'),
  async (req, res) => {
    // Admins and managers reach here
  }
);
```

### Authorization Logic

**Asset Visibility:**
```javascript
// employees: only their own assets
if (user.role === 'employee') {
  assets = await assetDb.getByEmployee(user.email);
}

// managers: all assets (same as admins and attestation_coordinator)
else if (user.role === 'manager') {
  assets = await assetDb.getScopedForUser(user);
  // Returns: all assets
}

// attestation_coordinator: all assets (read-only)
else if (user.role === 'attestation_coordinator') {
  assets = await assetDb.getScopedForUser(user);
  // Returns: all assets (but cannot edit)
}

// admins: all assets
else if (user.role === 'admin') {
  assets = await assetDb.getScopedForUser(user);
  // Returns: all assets
}
```

**Asset Edit Authorization:**
```javascript
// Only admins and asset owners can edit
// attestation_coordinator cannot edit assets
if (user.role !== 'admin' && asset.employee_email !== user.email) {
  return res.status(403).json({
    success: false,
    message: 'You do not have permission to edit this asset'
  });
}
```

### Security Best Practices

**Password Security:**
```javascript
import { hashPassword, comparePassword } from './auth.js';

// Registration
const hashedPassword = await hashPassword(plainPassword);
await userDb.create({ email, password: hashedPassword, ... });

// Login
const user = await userDb.getByEmail(email);
const isValid = await comparePassword(plainPassword, user.password);
```

**JWT Tokens:**
```javascript
import { generateToken, verifyToken } from './auth.js';

// Login success
const token = generateToken({ email: user.email, role: user.role });
res.json({ token, user: { email, role, ... } });

// Middleware verification (in authenticate)
const decoded = verifyToken(token);
req.user = decoded; // { email, role }
```

**Never Leak Sensitive Data:**
```javascript
// ❌ Wrong - Leaks password hash
res.json({ user });

// ✅ Correct - Omit sensitive fields
res.json({
  user: {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    // No password, mfa_secret, etc.
  }
});
```

---

## Frontend Patterns

### Component Structure

**Functional Components with Hooks:**
```javascript
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function MyComponent() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        const result = await response.json();
        setData(result.data);
      } catch (err) {
        console.error('Fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="container mx-auto p-6">
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>{data.map(item => <li key={item.id}>{item.name}</li>)}</ul>
      )}
    </div>
  );
}
```

### State Management

**AuthContext (Global):**
```javascript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const {
    user,           // Current user object
    isAuthenticated, // Boolean
    loading,        // Auth check in progress
    login,          // (email, password) => Promise
    logout          // () => void
  } = useAuth();

  // Use user.role for conditional rendering
  const isAdmin = user?.role === 'admin';
}
```

**UsersContext (Admin/Manager):**
```javascript
import { useUsers } from '@/contexts/UsersContext';

function UserManagement() {
  const {
    users,          // All users
    loading,
    fetchUsers,     // Refresh data
    addUser,        // Create new user
    updateUser,     // Update existing user
    deleteUser      // Delete user
  } = useUsers();
}
```

### API Calls Pattern

**Standard Fetch:**
```javascript
const fetchAssets = async () => {
  try {
    setLoading(true);
    const response = await fetch('/api/assets', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    setAssets(data.assets);
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    // Show toast notification
  } finally {
    setLoading(false);
  }
};
```

**POST/PUT/DELETE:**
```javascript
const createAsset = async (assetData) => {
  const response = await fetch('/api/assets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(assetData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create asset');
  }

  return response.json();
};
```

### UI Component Usage

**shadcn/ui Components (Available):**

Located in `/frontend/src/components/ui/`:
- `button.jsx` - Button variants
- `card.jsx` - Card layouts
- `dialog.jsx` - Modal dialogs
- `alert-dialog.jsx` - Confirmation dialogs
- `dropdown-menu.jsx` - Context menus
- `select.jsx` - Dropdowns
- `table.jsx` - Data tables
- `input.jsx`, `textarea.jsx`, `label.jsx` - Form fields
- `checkbox.jsx`, `switch.jsx` - Toggles
- `tabs.jsx` - Tab navigation
- `toast.jsx`, `toaster.jsx` - Notifications
- `badge.jsx` - Status badges
- `avatar.jsx` - User avatars
- `separator.jsx` - Dividers

**Usage Example:**
```javascript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add New Asset</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <Label htmlFor="serial">Serial Number</Label>
        <Input
          id="serial"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />
      </div>
      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  </DialogContent>
</Dialog>
```

### Tailwind CSS Patterns

**Standard Classes:**
```javascript
// Container with padding
<div className="container mx-auto p-6">

// Card layout
<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">

// Flex layouts
<div className="flex items-center justify-between gap-4">

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Spacing
<div className="space-y-4">  {/* Vertical spacing */}
<div className="space-x-2">  {/* Horizontal spacing */}

// Responsive text
<h1 className="text-2xl md:text-3xl font-bold">
```

### Routing

**React Router v7:**
```javascript
import { Routes, Route, Navigate } from 'react-router-dom';

<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/assets" element={<AssetsPage />} />
  <Route path="/companies" element={<CompanyManagement />} />
  <Route path="/users" element={<UserManagement />} />
  <Route path="/audit" element={<AuditReporting />} />
  <Route path="/settings" element={<AdminSettings />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/auth/callback" element={<OIDCCallback />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

---

## Backend Patterns

### Express Route Structure

**Standard Pattern:**
```javascript
// Public routes (no auth)
app.post('/api/auth/register', async (req, res) => {
  // Registration logic
});

app.post('/api/auth/login', async (req, res) => {
  // Login logic
});

// Protected routes (authenticated)
app.get('/api/assets', authenticate, async (req, res) => {
  // Role-based filtering using getScopedForUser
  const user = req.user;
  const assets = await assetDb.getScopedForUser(user);
  // Admin and Manager see all assets, Employee sees only own

  res.json({ success: true, assets });
});

// Admin-only routes
app.post('/api/companies',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    const { name } = req.body;
    const company = await companyDb.create({ name });

    await auditDb.create({
      action: 'CREATE',
      resource_type: 'company',
      resource_id: company.id,
      user_email: req.user.email,
      details: `Created company: ${name}`
    });

    res.json({ success: true, company });
  }
);
```

### Input Validation

**Always Validate User Input:**
```javascript
app.post('/api/assets', authenticate, async (req, res) => {
  const {
    employee_email,
    company,
    asset_type,
    serial_number
  } = req.body;

  // Required field validation
  if (!employee_email || !company || !asset_type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(employee_email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Enum validation
  const validTypes = ['laptop', 'mobile phone'];
  if (!validTypes.includes(asset_type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid asset type'
    });
  }

  // Proceed with creation
  const asset = await assetDb.create(req.body);
  // ...
});
```

### Error Handling

**Consistent Error Responses:**
```javascript
try {
  // Operation
  const result = await someOperation();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Operation failed:', error);

  // Never leak stack traces or internal details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(isDevelopment && { error: error.message })
  });
}
```

### File Upload Handling

**Multer Pattern (for CSV imports, logo uploads):**
```javascript
import multer from 'multer';
import os from 'os';
import { readFile, unlink } from 'fs/promises';

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

app.post('/api/assets/import',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  async (req, res) => {
    const filePath = req.file.path;

    try {
      const content = await readFile(filePath, 'utf-8');
      const records = parseCSV(content);

      // Process records
      for (const record of records) {
        await assetDb.create(record);
      }

      res.json({ success: true, imported: records.length });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    } finally {
      // Always clean up temp files
      await unlink(filePath);
    }
  }
);
```

---

## Testing Requirements

### Backend Testing (Jest)

**Location**: `backend/*.test.js`

**Run Tests:**
```bash
cd backend
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from './server.js';

describe('Asset API', () => {
  let adminToken;
  let employeeToken;

  beforeEach(async () => {
    // Setup: Create test users, get tokens
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminRes.body.token;
  });

  afterEach(async () => {
    // Cleanup: Delete test data
  });

  it('should allow admins to create assets', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employee_email: 'test@example.com',
        company: 'Test Corp',
        asset_type: 'laptop',
        make: 'Apple',
        model: 'MacBook Pro',
        serial_number: 'TEST123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.asset).toHaveProperty('id');
  });

  it('should prevent employees from viewing other assets', async () => {
    const res = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    // Should only return own assets
    expect(res.body.assets.every(a => a.employee_email === 'employee@test.com')).toBe(true);
  });
});
```

### Frontend Testing (Vitest)

**Location**: `frontend/src/**/*.test.jsx`

**Run Tests:**
```bash
cd frontend
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

**Test Structure:**
```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssetTable from './AssetTable';

describe('AssetTable', () => {
  it('renders asset data correctly', () => {
    const assets = [
      { id: 1, employee_email: 'john@example.com', asset_type: 'laptop' }
    ];

    render(
      <BrowserRouter>
        <AssetTable assets={assets} />
      </BrowserRouter>
    );

    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('laptop')).toBeInTheDocument();
  });

  it('handles edit button click', async () => {
    const mockOnEdit = vi.fn();
    const assets = [
      { id: 1, employee_email: 'john@example.com' }
    ];

    render(
      <BrowserRouter>
        <AssetTable assets={assets} onEdit={mockOnEdit} />
      </BrowserRouter>
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(mockOnEdit).toHaveBeenCalledWith(assets[0]);
    });
  });
});
```

### Test Requirements

**When to Add/Update Tests:**
1. New API endpoints → Add integration tests
2. New components → Add component tests
3. Business logic changes → Update relevant tests
4. Bug fixes → Add regression tests

**Coverage Goals:**
- Critical paths: 100% (authentication, authorization, audit logging)
- Business logic: >80%
- UI components: >70%

---

## Deployment & CI/CD

### GitHub Actions Workflows

**Location**: `.github/workflows/`

**1. CI Tests (`ci-tests.yml`)**
- Triggers: PRs, pushes to main/develop (with path filtering)
- Runs: Frontend and backend tests in parallel
- Matrix strategy: Separate jobs for each project

**2. Deployment (`deploy-portainer.yml`)**
- Triggers: Push to develop (auto), manual dispatch
- Steps:
  1. Build multi-platform Docker images (AMD64, ARM64)
  2. Push to GitHub Container Registry
  3. Trigger Portainer webhook (auto-pull enabled)
  4. Verify deployment

**3. File Verification (`verify-files.yml`)**
- Ensures critical files exist

**4. Wiki Sync (`wiki-sync.yml`)**
- Syncs documentation to wiki

### Docker Architecture

**Multi-Stage Builds:**

Backend Dockerfile:
```dockerfile
# Uses Node 22 for native module compatibility
# Installs production dependencies
# Creates non-root user for security
# Exposes port 3001
```

Frontend Dockerfile:
```dockerfile
# Build stage: Vite production build
# Serve stage: Nginx with custom config
# Exposes port 80
```

**Docker Compose:**

```yaml
# docker-compose.yml - Production
services:
  backend:
    build: ./backend
    ports: ["3001:3001"]
    volumes: ["./data:/app/data"]  # Persistent database
    restart: unless-stopped
    healthcheck: /api/health endpoint

  frontend:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [backend]
    restart: unless-stopped
    healthcheck: port 80

# docker-compose.dev.yml - Development
# docker-compose.portainer.yml - Portainer deployment
# docker-compose.portainer-postgres.yml - Portainer + PostgreSQL
```

### Deployment Process

**Automatic (Staging):**
1. Push to `develop` branch
2. GitHub Actions builds images
3. Pushes to ghcr.io
4. Triggers Portainer webhook
5. Portainer pulls and redeploys

**Manual Production:**
1. Merge to `main` (or manual workflow dispatch)
2. Review deployment plan
3. Approve staging environment
4. Production deployment (TBD - may use Azure AKS)

### Environment Management

**Development:**
- Local: `npm run dev` (backend + frontend)
- Docker: `docker-compose -f docker-compose.dev.yml up`

**Staging:**
- Portainer deployment
- Domain: kars.jvhlabs.com
- Cloudflare Tunnel for SSL

**Production:**
- TBD (placeholder in workflow)

---

## Common Tasks

### Adding a New API Endpoint

1. **Define Route in `backend/server.js`:**
```javascript
app.get('/api/my-endpoint',
  authenticate,                    // Require authentication
  authorize('admin'),              // Restrict to admins
  async (req, res) => {
    try {
      const data = await myDb.getData();
      res.json({ success: true, data });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve data'
      });
    }
  }
);
```

2. **Add Database Methods (if needed) in `database.js`:**
```javascript
export const myDb = {
  getData: async () => {
    if (selectedEngine === 'sqlite') {
      return sqliteDb.prepare('SELECT * FROM my_table').all();
    } else {
      const result = await pgPool.query('SELECT * FROM my_table');
      return result.rows;
    }
  }
};
```

3. **Add Tests in `backend/*.test.js`:**
```javascript
describe('My Endpoint', () => {
  it('should return data for admin', async () => {
    const res = await request(app)
      .get('/api/my-endpoint')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
```

4. **Call from Frontend:**
```javascript
const fetchData = async () => {
  const response = await fetch('/api/my-endpoint', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  const result = await response.json();
  return result.data;
};
```

### Adding a New React Component

1. **Create Component File:**
```javascript
// frontend/src/components/MyComponent.jsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MyComponent() {
  const [data, setData] = useState([]);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">My Component</h2>
      {/* Component content */}
    </Card>
  );
}
```

2. **Add Route (if needed):**
```javascript
// frontend/src/App.jsx
import MyComponent from '@/components/MyComponent';

<Routes>
  <Route path="/my-component" element={<MyComponent />} />
</Routes>
```

3. **Add Navigation (if needed):**
```javascript
// frontend/src/App.jsx
const navItems = [
  // ... existing items
  {
    path: '/my-component',
    label: 'My Component',
    icon: MyIcon,
    roles: ['admin']
  }
];
```

4. **Add Tests:**
```javascript
// frontend/src/components/MyComponent.test.jsx
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders title', () => {
    render(<MyComponent />);
    expect(screen.getByText('My Component')).toBeInTheDocument();
  });
});
```

### Adding a Database Migration

**For Schema Changes:**

1. **Update Schema in `database.js`:**
```javascript
// In initialize() function for SQLite
db.exec(`
  CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// In initializePostgres() for PostgreSQL
await pgPool.query(`
  CREATE TABLE IF NOT EXISTS new_table (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
```

2. **Add Migration Logic (if existing data needs transformation):**
```javascript
// Check if migration needed
const needsMigration = // ... check logic

if (needsMigration) {
  // Perform migration
  // Update version tracker
}
```

3. **Test Both Engines:**
```bash
# Test SQLite (default)
cd backend
npm test

# Test PostgreSQL
DB_CLIENT=postgres POSTGRES_URL=postgresql://... npm test
```

4. **Document in SCHEMA-MIGRATION.md** if breaking changes

### Implementing Role-Based Feature

1. **Backend Authorization:**
```javascript
// Restrict endpoint
app.post('/api/admin-action',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    // Only admins reach here
  }
);
```

2. **Frontend Conditional Rendering:**
```javascript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  return (
    <div>
      {isAdmin && <AdminOnlyButton />}
      {(isAdmin || isManager) && <ManagerFeature />}
      <EmployeeContent />
    </div>
  );
}
```

3. **Navigation Filtering:**
```javascript
// App.jsx navItems
const navItems = [
  { path: '/admin', label: 'Admin', icon: Settings, roles: ['admin'] },
  { path: '/reports', label: 'Reports', icon: FileBarChart, roles: ['admin', 'manager'] },
  { path: '/profile', label: 'Profile', icon: User, roles: ['employee', 'manager', 'admin'] }
];

// Filter based on user role
const filteredNav = navItems.filter(item =>
  !item.roles || item.roles.includes(user.role)
);
```

---

## Important Conventions

### File Naming

- **Backend**: `kebab-case.js` (e.g., `asset-authorization.test.js`)
- **Frontend Components**: `PascalCase.jsx` (e.g., `AssetTable.jsx`)
- **Frontend Utilities**: `kebab-case.js` (e.g., `use-toast.js`)
- **UI Components**: `kebab-case.jsx` (e.g., `alert-dialog.jsx`)

### Import Aliases

**Frontend uses `@/` for `src/`:**
```javascript
// ✅ Correct
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

// ❌ Wrong - Relative paths
import { Button } from '../../components/ui/button';
```

### API Response Format

**Standard Success Response:**
```javascript
{
  "success": true,
  "data": { ... },        // or "assets", "users", etc.
  "message": "Optional success message"
}
```

**Standard Error Response:**
```javascript
{
  "success": false,
  "message": "User-friendly error message",
  "error": "Technical details (dev only)"
}
```

### Database Column Naming

- Use `snake_case` for all columns
- Separate first/last names: `employee_first_name`, `employee_last_name`
- Boolean flags: `is_*` or `has_*` (e.g., `mfa_enabled`)
- Timestamps: `created_at`, `updated_at`

### Audit Logging Actions

**Standard Actions:**
- `CREATE` - New resource created
- `UPDATE` - Resource modified
- `STATUS_CHANGE` - Status field changed (special case of UPDATE)
- `DELETE` - Resource deleted
- `LOGIN` - User authentication
- `REGISTER` - New user registration
- `MFA_ENABLE` / `MFA_DISABLE` - MFA toggled
- `PASSKEY_REGISTER` / `PASSKEY_DELETE` - Passkey operations

**Always Log:**
```javascript
await auditDb.create({
  action: 'ACTION_TYPE',
  resource_type: 'asset|user|company|setting',
  resource_id: id || 'N/A',
  user_email: req.user.email,
  details: 'Human-readable description of what happened'
});
```

### Git Workflow

**Branch Naming:**
- Feature: `feature/description`
- Bugfix: `bugfix/description`
- Hotfix: `hotfix/description`

**Commit Messages:**
```
Type: Brief description (50 chars max)

Optional detailed explanation of what changed and why.
Reference any issues or tickets.
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Pull Requests:**
- Target `develop` for features
- Target `main` for hotfixes
- Include description of changes
- Mention related issues
- Ensure tests pass

### Never Do This

❌ **Leak Secrets:**
```javascript
// Wrong
res.json({ user }); // Contains password hash, MFA secret
```

❌ **Skip Audit Logging:**
```javascript
// Wrong
await assetDb.delete(assetId);
res.json({ success: true });
// Missing audit log!
```

❌ **Bypass Authorization:**
```javascript
// Wrong
app.delete('/api/assets/:id', authenticate, async (req, res) => {
  // Missing authorization check!
  await assetDb.delete(req.params.id);
});
```

❌ **Use CommonJS:**
```javascript
// Wrong
const express = require('express');
module.exports = myFunction;
```

❌ **Hardcode Values:**
```javascript
// Wrong
const apiUrl = 'http://localhost:3001';

// Correct
const apiUrl = import.meta.env.VITE_API_URL || '/api';
```

❌ **Forget Error Handling:**
```javascript
// Wrong
const data = await riskyOperation();
res.json({ data });

// Correct
try {
  const data = await riskyOperation();
  res.json({ success: true, data });
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({ success: false, message: 'Operation failed' });
}
```

---

## Quick Reference

### Useful Commands

```bash
# Backend
cd backend
npm install              # Install dependencies
npm run dev              # Development server (auto-reload)
npm start                # Production server
npm test                 # Run tests
npm run test:coverage    # Coverage report

# Frontend
cd frontend
npm install              # Install dependencies
npm run dev              # Development server (Vite)
npm run build            # Production build
npm run preview          # Preview production build
npm test                 # Run tests

# Docker
docker-compose up -d                    # Start production
docker-compose -f docker-compose.dev.yml up  # Start development
docker-compose down                     # Stop containers
docker-compose logs -f backend          # View backend logs
docker-compose restart                  # Restart all

# Git
git checkout develop                    # Switch to develop
git checkout -b feature/my-feature      # Create feature branch
git add .                               # Stage changes
git commit -m "feat: Add new feature"   # Commit
git push origin feature/my-feature      # Push branch
```

### Common File Locations

| What | Where |
|------|-------|
| Backend server | `backend/server.js` |
| Database layer | `backend/database.js` |
| Authentication | `backend/auth.js` |
| MFA logic | `backend/mfa.js` |
| OIDC/SSO | `backend/oidc.js` |
| Frontend app | `frontend/src/App.jsx` |
| Auth context | `frontend/src/contexts/AuthContext.jsx` |
| UI components | `frontend/src/components/ui/*.jsx` |
| Page components | `frontend/src/components/*.jsx` |
| Tests (backend) | `backend/*.test.js` |
| Tests (frontend) | `frontend/src/**/*.test.jsx` |
| Environment config | `.env.example` |
| CI/CD workflows | `.github/workflows/*.yml` |
| Docker configs | `docker-compose*.yml` |

### Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `JWT_SECRET` | Token signing key | *Required* |
| `PORT` | Backend port | 3001 |
| `NODE_ENV` | Environment | development |
| `DATA_DIR` | Database directory | ./backend/data |
| `DB_CLIENT` | Database engine | sqlite |
| `POSTGRES_URL` | PostgreSQL connection | N/A |
| `ADMIN_EMAIL` | Auto-admin email | N/A |
| `PASSKEY_RP_ID` | WebAuthn domain | localhost |
| `OIDC_ENABLED` | Enable SSO | false |

### API Endpoint Summary

| Method | Endpoint | Auth | Roles | Purpose |
|--------|----------|------|-------|---------|
| POST | `/api/auth/register` | ❌ | - | User registration |
| POST | `/api/auth/login` | ❌ | - | Password login |
| GET | `/api/profile` | ✅ | All | Get current user |
| PUT | `/api/profile` | ✅ | All | Update profile |
| GET | `/api/assets` | ✅ | All | List assets (role-filtered) |
| POST | `/api/assets` | ✅ | All | Create asset |
| PUT | `/api/assets/:id` | ✅ | Admin, Owner | Update asset |
| DELETE | `/api/assets/:id` | ✅ | Admin | Delete asset |
| GET | `/api/companies` | ✅ | All | List companies |
| POST | `/api/companies` | ✅ | Admin | Create company |
| DELETE | `/api/companies/:id` | ✅ | Admin | Delete company |
| GET | `/api/users` | ✅ | Admin, Manager | List users |
| POST | `/api/users` | ✅ | Admin | Create user |
| PUT | `/api/users/:id` | ✅ | Admin | Update user |
| DELETE | `/api/users/:id` | ✅ | Admin | Delete user |
| GET | `/api/audit` | ✅ | All | Audit logs (role-filtered) |
| GET | `/api/settings/*` | ✅ | Admin | Various settings |

---

## Summary

This guide provides AI assistants with comprehensive context for working with ACS. Key takeaways:

1. **Security First**: Never skip authentication, authorization, or audit logging
2. **Dual Database Support**: Always implement for both SQLite and PostgreSQL
3. **Role-Based Everything**: Filter data and features by user role
4. **Test Coverage**: Add/update tests for all significant changes
5. **Consistent Patterns**: Follow existing code structure and naming conventions
6. **ES Modules**: Use modern JavaScript (import/export, async/await)
7. **Functional React**: Hooks-based components, context for state
8. **Audit Everything**: Log all mutations with user attribution
9. **Don't Over-Engineer**: Only add what's requested

When in doubt, **read existing code** for patterns and follow them consistently.

---

**Last Updated**: 2025-12-10
**Repository**: https://github.com/humac/kars
**Live Demo**: https://kars.jvhlabs.com
