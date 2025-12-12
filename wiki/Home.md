# KARS (KeyData Asset Registration System) Wiki

Welcome to the documentation for the **KeyData Asset Registration System (KARS)** — a SOC2-focused web app for tracking client assets with strong authentication, imports/exports, and admin controls.

## 🎯 Overview
- **Asset visibility by role** with employee, manager, and admin scopes (see [Role/Permissions Matrix](Features#role-based-access-control-rbac))
- **Modern authentication**: passwords, TOTP MFA, passkeys/WebAuthn, and OIDC/SSO
- **Bulk operations**: CSV imports for assets/companies and CSV exports for audits
- **Configurable platform**: branding controls, passkey relying-party settings, and database engine selection (SQLite or PostgreSQL)
- **Audit-ready reporting** with status summaries, manager/company rollups, and download-ready CSVs

## 📚 Documentation
- **[Features](Features)** – Detailed feature reference (auth, RBAC, audits, UI)
- **[Quick Start](Quick-Start)** – 5-minute setup for users, admins, developers, and operators
- **[Admin Guide](Admin-Guide)** – User management, companies, audits, and security best practices
- **[API Reference](API-Reference)** – REST endpoints for auth, assets, companies, audits, OIDC, passkeys, and MFA
- **[Deployment Guide](Deployment-Guide)** – Portainer/Docker setup, GitHub Actions, Cloudflare Tunnel, and environment config
- **[Schema Migration Guide](../SCHEMA-MIGRATION.md)** – ⚠️ **Important**: Asset name fields now separated (first_name/last_name)
- **[Wiki README](README)** – Tips for syncing these pages to the GitHub Wiki

## 🚀 Quick Links
- **Getting started:** [Quick Start → For Users](Quick-Start#for-users)
- **Admin essentials:** [Admin Guide → First Admin Setup](Admin-Guide#first-admin-setup)
- **Security:** [Features → Authentication](Features#user-authentication) and [Admin Guide → Security Best Practices](Admin-Guide#security-best-practices)
- **APIs:** [API Reference → Assets](API-Reference#assets)
- **Deploy:** [Deployment Guide → Portainer Deployment](Deployment-Guide#portainer-deployment)

## 🏗️ Architecture
```
┌─────────────────┐
│   Frontend      │  React + Vite + Shadcn UI
└────────┬────────┘
         │
    HTTP/REST
         │
┌────────▼────────┐
│   Backend       │  Node.js + Express
└────────┬────────┘
         │
┌────────▼────────┐
│   Database      │  SQLite (default) or PostgreSQL
└─────────────────┘
```

## 🔐 Security Highlights
- JWT sessions with 7-day expiry and bcrypt-hashed credentials
- Passkey/WebAuthn with configurable RP ID/name and origin
- TOTP MFA with backup codes and login verification flow
- Role-based authorization on every endpoint and export
- Full audit trail of create/update/status/delete actions

## 📞 Support
- Open an issue in GitHub for bugs or requests
- Check the [Deployment Guide](Deployment-Guide) for operations help
- Review the [API Reference](API-Reference) for integration details

---

**Want to dive in?** Start with the [Quick Start](Quick-Start) to register your first admin and asset.
