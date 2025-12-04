# KARS (KeyData Asset Registration System)

[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/humac/claude_app_poc/actions)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A comprehensive SOC2-compliant web application for tracking and managing client assets assigned to consultants, with full authentication, role-based access control, and automated deployment.

🌐 **Live Demo:** [https://kars.jvhlabs.com](https://kars.jvhlabs.com)

📖 **Documentation:** [View Wiki](../../wiki)

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** - Secure token-based auth with 7-day expiration
- **Passkey/WebAuthn Support** - Passwordless authentication with biometrics
  - FIDO2/WebAuthn standard compliance
  - Platform authenticators (Touch ID, Face ID, Windows Hello)
  - Security key support (YubiKey, etc.)
  - Register and manage multiple passkeys from profile
  - Passwordless sign-in option on login page
- **Multi-Factor Authentication (MFA/2FA)** - TOTP-based authentication with backup codes
  - QR code enrollment with authenticator apps (Google, Microsoft, Authy)
  - 10 backup codes for account recovery
  - User-controlled enable/disable from profile
- **OIDC/SSO Authentication** - External identity provider integration
  - Support for Auth0, Google Workspace, Azure AD, Okta
  - Just-In-Time (JIT) user provisioning
  - Role mapping from OIDC claims
  - Database-backed configuration (admin UI)
- **Password Security** - bcrypt hashing (10 rounds)
- **Password Management** - Change password from profile settings
- **Role-Based Access Control** - Three roles: Employee, Manager, Admin
- **Automatic Manager Promotion** - Users listed as a manager are auto-promoted to manager with audit logging
- **First Admin Setup** - Automatic admin promotion for first user
- **Profile Management** - Update first/last name, password, MFA settings, passkeys, and profile photos

### 📦 Asset Management
- **Self-Service Registration** - Consultants register client laptops
- **Status Tracking** - Active, Returned, Lost, Damaged, Retired
- **Advanced Search** - Filter by employee, manager, client, status
- **Role-Based Visibility**:
  - Employees: Own assets only
  - Managers: Own + team assets
  - Admins: All assets

### 🏢 Company Management (Admin Only)
- Create, edit, and delete client companies
- Company dropdown for asset registration
- Protection against deletion if assets exist

### 📊 Audit & Compliance
- **Complete Audit Trail** - All actions logged with user attribution
- **SOC2 Compliance** - Meets audit requirements
- **Comprehensive Logging** - CREATE, UPDATE, STATUS_CHANGE, DELETE
- **CSV Export** - Role-filtered audit log downloads for compliance
- **Summary Reports** - Asset statistics by status, company, manager
- **Secure Exports** - Role-based access control on all exports

### ⚙️ Admin Features
- **User Management** - View, edit roles, delete users
- **System Overview** - User statistics and system info
- **Application Settings** - Configuration and best practices
- **OIDC/SSO Configuration** - Database-backed SSO settings with admin UI
- **Audit Access** - View all system activity

### 🚀 Deployment & DevOps
- **Multi-Platform Docker Support** - ARM64 and AMD64 containers
- **GitHub Actions CI/CD** - Automated builds and deployment
- **Portainer Integration** - Webhook-based deployment with auto-pull
- **Cloudflare Tunnel** - Secure external access with SSL
- **Health Checks** - Automated container monitoring
- **Auto-Restart** - Self-healing containers
- **Modern Material-UI Interface** - Professional design with responsive layout

---

## 🖥️ Platform Support

This application supports multiple architectures:
- **x86_64/AMD64** - Intel/AMD processors (standard servers, desktop)
- **ARM64** - ARM processors (Raspberry Pi, AWS Graviton, Apple Silicon)

Docker images are automatically built for both platforms during CI/CD.

---

## 🎯 Quick Start

### For Users

```bash
# 1. Access the application
https://kars.jvhlabs.com

# 2. Register (first user becomes admin!)
Click "Register" → Fill form → Auto-login

# 3. Register an asset
Asset Management → + New Asset → Fill details → Register
```

### For Developers

```bash
# 1. Clone and setup
git clone https://github.com/humac/claude_app_poc.git
cd claude_app_poc

# 2. Backend
cd backend
npm install
cp .env.example .env
npm run dev

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev

# 4. Access: http://localhost:5173
```

### For Production (Portainer)

```bash
# 1. Create stack in Portainer
# 2. Use docker-compose.portainer.yml (SQLite) or
#    docker-compose.portainer-postgres.yml (PostgreSQL + Portainer UI)
# 3. Set environment variables
# 4. Deploy!

# See QUICKSTART-PORTAINER.md for details
# See "Portainer + PostgreSQL" section below for PostgreSQL setup
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[Wiki Home](../../wiki)** | Complete documentation hub |
| **[Features](../../wiki/Features)** | Detailed feature list |
| **[Quick Start](../../wiki/Quick-Start)** | 5-minute setup guide |
| **[Admin Guide](../../wiki/Admin-Guide)** | Administrator manual |
| **[API Reference](../../wiki/API-Reference)** | Complete API docs |
| **[Deployment Guide](../../wiki/Deployment-Guide)** | Production deployment |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Detailed deployment instructions |
| **[QUICKSTART-PORTAINER.md](QUICKSTART-PORTAINER.md)** | Fast Portainer setup |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Tunnel                      │
│              (SSL/TLS + DDoS Protection)                 │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React 18)                    │
│          Nginx → Port 80 (containerized)                 │
│                                                           │
│  Components:                                              │
│  • Login/Register/AuthPage (JWT + Passkey + SSO)         │
│  • Dashboard (Asset Overview)                            │
│  • Profile (MFA + Passkey Management)                    │
│  • AssetList + AssetRegistrationForm                     │
│  • AdminSettings (User + OIDC + Company Mgmt)            │
│  • AuditReporting (Compliance + Export)                  │
│                                                           │
│  Tech: Vite + Material-UI + Context API + React Router   │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP/REST API
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Node.js/Express)                   │
│                    Port 3001                             │
│                                                           │
│  Authentication:                                          │
│  • JWT (jsonwebtoken) - 7-day tokens                     │
│  • Passkeys (@simplewebauthn/server)                     │
│  • MFA/2FA (speakeasy + qrcode)                          │
│  • OIDC/SSO (openid-client)                              │
│                                                           │
│  Authorization: RBAC Middleware + Audit Logging          │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Database Layer                              │
│                                                           │
│  SQLite (default) OR PostgreSQL (production)             │
│         Persistent Docker Volume                         │
│                                                           │
│  Tables:                                                  │
│  • users (auth, roles, MFA, OIDC, profile)               │
│  • passkeys (WebAuthn credentials)                       │
│  • assets (laptop tracking)                              │
│  • companies (client orgs)                               │
│  • audit_logs (compliance)                               │
│  • oidc_settings (SSO config)                            │
│  • branding_settings (logo)                              │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 User Roles & Permissions

| Feature | Employee | Manager | Admin |
|---------|----------|---------|-------|
| View own assets | ✅ | ✅ | ✅ |
| View team assets | ❌ | ✅ | ✅ |
| View all assets | ❌ | ❌ | ✅ |
| Register assets | ✅ | ✅ | ✅ |
| Update asset status | ✅ | ✅ | ✅ |
| View own audit logs | ✅ | ✅ | ✅ |
| View team audit logs | ❌ | ✅ | ✅ |
| View all audit logs | ❌ | ❌ | ✅ |
| **Manage companies** | ❌ | ❌ | ✅ |
| **Manage users** | ❌ | ❌ | ✅ |
| **System settings** | ❌ | ❌ | ✅ |

---

## 💻 Technology Stack

**Frontend:**
- React 18 + Vite
- Material-UI (MUI) v5 - Component library
- Context API (state management)
- React Router v6
- Fetch API (HTTP client)

**Backend:**
- Node.js 18+
- Express.js 4
- SQLite3 (better-sqlite3) or PostgreSQL (pg)
- JWT (jsonwebtoken)
- bcrypt (password hashing)
- @simplewebauthn/server (WebAuthn/Passkey support)
- speakeasy (TOTP for MFA)
- qrcode (QR code generation)
- openid-client (OIDC/SSO integration)

**DevOps:**
- Docker & Docker Compose (ARM64 + AMD64)
- GitHub Actions (CI/CD)
- Portainer (container management with webhooks)
- Cloudflare Tunnel (secure access)
- GitHub Container Registry (multi-platform)

---

## 🚢 Deployment

### Docker Compose (Local)

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

### Portainer (Production)

1. **Create Stack** in Portainer
2. **Use** `docker-compose.portainer.yml`
3. **Set Environment:**
   ```env
   GITHUB_REPOSITORY=humac/claude_app_poc
   JWT_SECRET=your-64-char-random-string
   ADMIN_EMAIL=admin@jvhlabs.com
   APP_PORT=8080
   ```
4. **Deploy!**

### Portainer + PostgreSQL (Production with DB)

For production deployments with PostgreSQL and Portainer container management:

1. **Use** `docker-compose.portainer-postgres.yml`
2. **Copy environment template:** `cp .env.portainer-postgres.example .env`
3. **Edit `.env` file** and set your values:
   ```env
   # Application Settings
   GITHUB_REPOSITORY=humac/claude_app_poc
   JWT_SECRET=your-64-char-random-string
   ADMIN_EMAIL=admin@jvhlabs.com
   APP_PORT=8080

   # PostgreSQL Settings
   POSTGRES_DB=ars
   POSTGRES_USER=ars_app
   POSTGRES_PASSWORD=your-secure-postgres-password
   POSTGRES_PORT=5432
   POSTGRES_SSL=false

   ```
4. **Deploy Stack** in Portainer or via Docker Compose:
   ```bash
   docker-compose -f docker-compose.portainer-postgres.yml up -d
   ```
5. **Access Services:**
   - Application: `http://localhost:8080` (or your configured port)
   - Portainer UI: `https://localhost:9443` or `http://localhost:9000`
   - PostgreSQL: `localhost:5432`

**Note:** This setup includes:
- PostgreSQL 16 (Alpine) for production database
- Automatic health checks for all services
- Persistent volumes for data
- Network isolation with bridge networking

### GitHub Actions (CI/CD)

Automatically deploys on push to `main`:
1. Builds multi-platform Docker images (ARM64 + AMD64)
2. Pushes to GitHub Container Registry
3. Triggers Portainer webhook with auto-pull
4. Deploys updated containers with latest images

### Cloudflare Tunnel

Secure HTTPS access without open ports:
```yaml
# In docker-compose.portainer.yml
cloudflared:
  image: cloudflare/cloudflared:latest
  command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
```

**See:** [Deployment Guide](../../wiki/Deployment-Guide)

### PostgreSQL Configuration and Migration

SQLite remains the default for quick starts, but production deployments can point the backend at PostgreSQL for managed backups, monitoring, and high availability.

1. **Provision PostgreSQL** – Create a database and least-privilege user (for example `ars_app`) using your managed provider or a Docker service.
2. **Capture the connection string** – `postgresql://ars_app:<password>@<host>:<port>/ars` and configure the backend to use it before restarting the service.
3. **Back up SQLite first** – Copy `backend/data/assets.db` (or your mounted `DATA_DIR`) and store it safely.
4. **Migrate data with pgloader** – Run from the project root (adjust paths for your environment):

   ```bash
   docker run --rm -v $(pwd)/backend/data:/data dimitri/pgloader:latest \
     pgloader /data/assets.db postgresql://ars_app:<password>@<host>:<port>/ars
   ```

   `pgloader` will create matching tables and transfer `assets`, `companies`, `users`, and `audit_logs` while preserving indexes.

5. **Validate and cut over** –
   - Verify row counts per table in PostgreSQL match SQLite.
   - Spot-check a few assets/users and audit log entries.
   - Point the backend to PostgreSQL, restart, and monitor logs for connection or permission errors.

You can store the PostgreSQL connection string from **Admin → Application Settings → Data Management**. If `DB_CLIENT`/`POSTGRES_URL` are provided via environment variables, the admin form will display them as read-only and note that a restart is required after saving changes.

If you prefer a SQL-only path, export SQLite data with `sqlite3 assets.db .dump` and import into PostgreSQL with `psql`, ensuring autoincrement columns are converted to `SERIAL`/`BIGSERIAL` and indexes are recreated.

---

## 🔧 Environment Variables

### Backend (`backend/.env`)

```bash
# Required
JWT_SECRET=your-super-secret-64-char-random-string
JWT_EXPIRES_IN=7d

# Optional
ADMIN_EMAIL=admin@yourdomain.com  # Auto-promote this email to admin
PORT=3001                          # Server port
DATA_DIR=/app/data                 # Database directory
NODE_ENV=production                # Environment mode

# Database Configuration
DB_CLIENT=postgres                 # Override database engine (sqlite or postgres)
POSTGRES_URL=postgresql://user:pass@host:5432/ars  # Required when DB_CLIENT=postgres
POSTGRES_SSL=true                  # Set to 'true' to enable SSL when using PostgreSQL

# Passkey/WebAuthn Configuration
PASSKEY_RP_ID=localhost            # Relying Party ID (domain name)
PASSKEY_RP_NAME=KARS - KeyData Asset Registration System
PASSKEY_ORIGIN=http://localhost:5173  # Frontend origin for WebAuthn

# OIDC/SSO (configured via Admin UI - no env vars needed)
# MFA/2FA (no configuration needed - user-controlled)
```

### Portainer Stack

```bash
GITHUB_REPOSITORY=humac/claude_app_poc
APP_PORT=8080
JWT_SECRET=your-secret-here
ADMIN_EMAIL=admin@jvhlabs.com
```

---

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  first_name TEXT,
  last_name TEXT,
  created_at TEXT NOT NULL,
  last_login TEXT,
  oidc_sub TEXT,              -- OIDC subject identifier
  mfa_enabled INTEGER DEFAULT 0,
  mfa_secret TEXT,            -- TOTP secret
  mfa_backup_codes TEXT,      -- JSON array of backup codes
  manager_name TEXT,
  manager_email TEXT,
  profile_image TEXT
);
```

### Passkeys Table
```sql
CREATE TABLE passkeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,            -- JSON array of transport types
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Assets Table
```sql
CREATE TABLE assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_name TEXT NOT NULL,
  employee_email TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  client_name TEXT NOT NULL,
  laptop_serial_number TEXT NOT NULL UNIQUE,
  laptop_asset_tag TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  registration_date TEXT NOT NULL,
  last_updated TEXT NOT NULL,
  notes TEXT
);
```

### OIDC Settings Table
```sql
CREATE TABLE oidc_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  issuer_url TEXT,
  client_id TEXT,
  client_secret TEXT,
  redirect_uri TEXT,
  scope TEXT DEFAULT 'openid email profile',
  role_claim_path TEXT DEFAULT 'roles',
  default_role TEXT DEFAULT 'employee',
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
```

### Companies & Audit Logs Tables
- See [Database Schema](../../wiki/Database-Schema) for complete schema

---

## 🔐 Security Features

✅ **Password Security** - bcrypt hashing (10 rounds)
✅ **JWT Tokens** - Secure authentication with 7-day expiration
✅ **Passkey/WebAuthn Support** - FIDO2 passwordless authentication
✅ **Multi-Factor Authentication** - TOTP-based 2FA with backup codes
✅ **OIDC/SSO Integration** - Enterprise identity provider support
✅ **Role-Based Access** - Granular permission control
✅ **Audit Trails** - Complete activity logging for compliance
✅ **HTTPS** - Cloudflare SSL/TLS encryption
✅ **Input Validation** - Backend validation on all endpoints
✅ **XSS Protection** - React sanitization
✅ **SQL Injection** - Parameterized queries
✅ **CSRF Protection** - State tokens for OAuth flows
✅ **Session Security** - Automatic cleanup of expired sessions

---

## 📈 API Endpoints

### Authentication
```
POST   /api/auth/register             Register new user
POST   /api/auth/login                Login (returns token or MFA challenge)
GET    /api/auth/me                   Get current user info
PUT    /api/auth/profile              Update user profile (name)
PUT    /api/auth/change-password      Change user password
```

### Passkey Authentication (WebAuthn)
```
GET    /api/auth/passkeys                      List user's passkeys
POST   /api/auth/passkeys/registration-options Generate passkey registration challenge
POST   /api/auth/passkeys/verify-registration  Verify and save new passkey
POST   /api/auth/passkeys/auth-options         Generate passkey authentication challenge
POST   /api/auth/passkeys/verify-authentication Verify passkey and login
DELETE /api/auth/passkeys/:id                  Delete a passkey
```

### Multi-Factor Authentication (MFA)
```
GET    /api/auth/mfa/status           Get MFA enrollment status
POST   /api/auth/mfa/enroll           Start MFA enrollment (get QR code)
POST   /api/auth/mfa/verify-enrollment Complete MFA enrollment
POST   /api/auth/mfa/disable          Disable MFA (requires password)
POST   /api/auth/mfa/verify-login     Verify MFA code during login
```

### OIDC/SSO Authentication
```
GET    /api/auth/oidc/config          Check if OIDC is enabled
GET    /api/auth/oidc/login           Initiate OIDC login
GET    /api/auth/oidc/callback        OIDC callback handler
GET    /api/admin/oidc-settings       Get OIDC settings (admin)
PUT    /api/admin/oidc-settings       Update OIDC settings (admin)
```

### Assets (Authenticated)
```
GET    /api/assets            List assets (role-filtered)
POST   /api/assets            Create asset
PATCH  /api/assets/:id/status Update status
```

### Companies (Admin Only)
```
GET    /api/companies         List all companies
GET    /api/companies/names   Get names (all users)
POST   /api/companies         Create company
PUT    /api/companies/:id     Update company
DELETE /api/companies/:id     Delete company
```

### Audit & Reports
```
GET    /api/audit/logs        Get audit logs (role-filtered)
GET    /api/audit/export      Export logs to CSV
GET    /api/audit/stats       Get statistics
GET    /api/reports/summary   Get asset summary
```

**Full API docs:** [API Reference](../../wiki/API-Reference)

---

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker (optional)

### Local Setup

```bash
# Clone
git clone https://github.com/humac/claude_app_poc.git
cd claude_app_poc

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env - set JWT_SECRET
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# Access
Frontend: http://localhost:5173
Backend:  http://localhost:3001
```

### With Docker

```bash
# Development (hot-reload)
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d

# Rebuild
docker-compose up -d --build
```

---

## 🧪 Testing

```bash
# Backend tests (when implemented)
cd backend
npm test

# Frontend tests (when implemented)
cd frontend
npm test

# E2E tests (when implemented)
npm run test:e2e
```

---

## 📦 Backup & Restore

### Backup Database

```bash
# Manual backup
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/asset-data-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore Database

```bash
# Restore from backup
docker run --rm \
  -v asset-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/asset-data-YYYYMMDD.tar.gz -C /data
```

**See:** [Backup Guide](../../wiki/Backup-And-Restore)

---

## 🐛 Troubleshooting

### Containers Won't Start
```bash
# Check logs
docker logs asset-registration-backend
docker logs asset-registration-frontend

# Check ports
netstat -tlnp | grep 8080

# Restart
docker-compose restart
```

### Can't Access Application
- Check containers are running: `docker ps`
- Verify Cloudflare tunnel status
- Test locally: `curl http://localhost:8080`

### Database Issues
```bash
# View database
docker exec -it asset-registration-backend sh
cd /app/data
ls -la

# Reset (⚠️ deletes all data)
docker-compose down -v
docker-compose up -d
```

**More:** [Troubleshooting Guide](../../wiki/Troubleshooting)

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

See [Contributing Guide](CONTRIBUTING.md) for details.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built for SOC2 compliance requirements
- Designed for consulting firms managing client assets
- Automated deployment via GitHub Actions
- Secure access via Cloudflare Tunnel

---

## 📞 Support

- **Documentation:** [Wiki](../../wiki)
- **Issues:** [GitHub Issues](https://github.com/humac/claude_app_poc/issues)
- **Deployment Help:** See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Quick Start:** See [QUICKSTART-PORTAINER.md](QUICKSTART-PORTAINER.md)

---

## 🗺️ Roadmap

- [x] User Authentication (JWT)
- [x] Role-Based Access Control
- [x] Audit Logging
- [x] Company Management
- [x] Profile Management
- [x] Password Change Functionality
- [x] Automated Deployment
- [x] Multi-Platform Support (ARM64 + AMD64)
- [x] Portainer Webhook Auto-Pull
- [x] Modern Material-UI Interface
- [x] Cloudflare Tunnel Support
- [x] Multi-Factor Authentication (MFA/2FA)
- [x] OIDC/SSO Integration
- [x] Database-Backed SSO Configuration
- [x] WebAuthn/Passkey Support
- [x] PostgreSQL Database Support
- [ ] Email Notifications
- [ ] Advanced Reporting Dashboard
- [ ] Mobile App
- [ ] API Rate Limiting
- [ ] Database Encryption at Rest

---

**Ready to get started?** See the [Quick Start Guide](../../wiki/Quick-Start)!

**Deploying to production?** Check [QUICKSTART-PORTAINER.md](QUICKSTART-PORTAINER.md)!
