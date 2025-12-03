# ARS (Asset Registration System)

[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/humac/claude_app_poc/actions)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A comprehensive SOC2-compliant web application for tracking and managing client assets assigned to consultants, with full authentication, role-based access control, and automated deployment.

🌐 **Live Demo:** [https://ars.jvhlabs.com](https://ars.jvhlabs.com)

📖 **Documentation:** [View Wiki](../../wiki)

---

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** - Secure token-based auth with 7-day expiration
- **Password Security** - bcrypt hashing (10 rounds)
- **Password Management** - Change password from profile settings
- **Role-Based Access Control** - Three roles: Employee, Manager, Admin
- **First Admin Setup** - Automatic admin promotion for first user
- **Profile Management** - Update first/last name and password

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
- **Audit Access** - View all system activity

### 🚀 Deployment & DevOps
- **Multi-Platform Docker Support** - ARM64 and AMD64 containers
- **GitHub Actions CI/CD** - Automated builds and deployment
- **Portainer Integration** - Webhook-based deployment with auto-pull
- **Cloudflare Tunnel** - Secure external access with SSL
- **Health Checks** - Automated container monitoring
- **Auto-Restart** - Self-healing containers
- **Modern UI** - KeyData Cyber branded interface

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
https://ars.jvhlabs.com

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
# 2. Use docker-compose.portainer.yml
# 3. Set environment variables
# 4. Deploy!

# See QUICKSTART-PORTAINER.md for details
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
│                   Frontend (React)                       │
│          Nginx → Port 80 (containerized)                 │
│     Vite Build + Context API + React Router              │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend (Node.js/Express)                   │
│                    Port 3001                             │
│      JWT Auth + RBAC + Audit Logging                     │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Database (SQLite)                           │
│         Persistent Docker Volume                         │
│   Users + Assets + Companies + Audit Logs               │
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
- Context API (state management)
- Fetch API (HTTP client)
- Modern CSS (responsive design)

**Backend:**
- Node.js 18+
- Express.js 4
- SQLite3 (better-sqlite3)
- JWT (jsonwebtoken)
- bcrypt (password hashing)

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
DB_CLIENT=postgres                 # Override database engine (sqlite or postgres)
POSTGRES_URL=postgresql://user:pass@host:5432/ars  # Required when DB_CLIENT=postgres
POSTGRES_SSL=true                  # Set to 'true' to enable SSL when using PostgreSQL
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
  last_login TEXT
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

### Companies & Audit Logs Tables
- See [Database Schema](../../wiki/Database-Schema) for complete schema

---

## 🔐 Security Features

✅ **Password Security** - bcrypt hashing (10 rounds)
✅ **JWT Tokens** - Secure authentication with 7-day expiration
✅ **Role-Based Access** - Granular permission control
✅ **Audit Trails** - Complete activity logging
✅ **HTTPS** - Cloudflare SSL/TLS
✅ **Input Validation** - Backend validation on all endpoints
✅ **XSS Protection** - React sanitization
✅ **SQL Injection** - Parameterized queries

---

## 📈 API Endpoints

### Authentication
```
POST   /api/auth/register        Register new user
POST   /api/auth/login           Login and get token
GET    /api/auth/me              Get current user info
PUT    /api/auth/profile         Update user profile (name)
PUT    /api/auth/change-password Change user password
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
- [x] Modern UI with KeyData Cyber Branding
- [x] Cloudflare Tunnel Support
- [ ] Multi-factor Authentication
- [ ] Email Notifications
- [ ] Advanced Reporting Dashboard
- [ ] Mobile App
- [ ] API Rate Limiting
- [ ] Database Encryption

---

**Ready to get started?** See the [Quick Start Guide](../../wiki/Quick-Start)!

**Deploying to production?** Check [QUICKSTART-PORTAINER.md](QUICKSTART-PORTAINER.md)!
