# Quick Start Guide

Get the KeyData Asset Registration System (KARS) running in minutes. Pick the section that matches your role.

## For Users

### First Time Setup
1. **Access the Application**  
   Go to your deployment URL (e.g., `https://kars.jvhlabs.com`).
2. **Register Your Account**  
   - Provide first/last name, email, manager name, and manager email.  
   - The first account created becomes **Admin** automatically (or the email configured in `ADMIN_EMAIL`).
3. **Login & Secure Your Account**  
   - Sign in with your email/password.  
   - Optional: Enable **MFA** from Profile → Security.  
   - Optional: Register a **passkey** (Touch ID/Face ID/Windows Hello/YubiKey) for passwordless sign-in.
4. **Register Your First Asset**  
   Asset Management → **+ New Asset** → fill in details (employee/manager info, company, serial, asset tag, notes) → **Register Asset**.

### Daily Use
- Update asset status (Active, Returned, Lost, Damaged, Retired) when equipment changes hands.
- Use table filters to find assets by employee, manager, company, or status.

---

## For Administrators

### First Admin Checklist
1. **Add Companies** – Company Management → **+ Add Company** (required before users can register assets).  
2. **Confirm Roles** – Admin Settings → User Management → adjust Employee/Manager/Admin roles.  
3. **Configure Security** – Profile → enable MFA; Admin Settings → Passkey Settings to set RP ID/name/origin if using a custom domain.
4. **Optional SSO** – Admin Settings → SSO/OIDC: add issuer URL, client credentials, scopes, and role mapping.  
5. **Branding** – Admin Settings → Branding: upload a logo or reset to defaults.  
6. **Database Engine** – Admin Settings → Database: stay on SQLite or enter a PostgreSQL URL and import existing SQLite data.
7. **Bulk Imports** – Use CSV importers in Asset Management and Company Management to seed existing data.
8. **Audit & Reporting** – Audit & Reporting → export CSV logs and review status summaries.

---

## For Developers

### Local Development
```bash
# Clone repository
git clone https://github.com/humac/kars.git
cd kars

# Backend
cd backend
npm install
cp .env.example .env
# Set JWT_SECRET and adjust PASSKEY_* or OIDC_* values if needed
npm run dev   # API on http://localhost:3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev   # UI on http://localhost:5173
```

- Passkeys require the browser origin to match `PASSKEY_ORIGIN` (default `http://localhost:5173`).
- Use the **API Reference** page for endpoints and payloads.
- First registered account is promoted to admin; `ADMIN_EMAIL` in `.env` can preselect an admin.

---

## For DevOps

1. **Deploy with Portainer** – Create a stack using `docker-compose.portainer.yml` (see [Deployment Guide](Deployment-Guide#portainer-deployment)).
2. **Set Environment Variables** – `JWT_SECRET`, `ADMIN_EMAIL`, `APP_PORT`, optional `POSTGRES_URL`, and OIDC/passkey values.
3. **Enable CI/CD** – Configure GitHub Actions secrets and Portainer webhook for auto-deploys.
4. **Cloudflare Tunnel (optional)** – Expose the app securely with TLS via the provided `cloudflare-tunnel.yml` example.
5. **Monitoring** – Containers include health checks; verify via Portainer and `/api/health`.

---

## Common First Tasks
- **Employees** – Register assets and keep statuses current.
- **Managers** – Review team assets and export filtered audit logs for your reports.
- **Admins** – Seed companies, set up SSO/passkeys, and schedule database backups (see repository README for backup commands).

---

## Next Steps
- Explore the full [Features](Features) list.
- Deep dive into administration via the [Admin Guide](Admin-Guide).
- Integrate with external systems using the [API Reference](API-Reference).
- Ready for production? Follow the [Deployment Guide](Deployment-Guide).
