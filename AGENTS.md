# Agent Guide

This repository contains the KARS (KeyData Asset Registration System) application. These instructions apply to the entire repository unless a nested `AGENTS.md` overrides them.

## Project Overview
- **Backend (`backend/`)**: Node.js (ES modules) + Express API with authentication (JWT, passkeys, OIDC) and persistence via SQLite/PostgreSQL adapters in `database.js`.
- **Frontend (`frontend/`)**: React 18 with Vite, Material UI, Radix UI primitives, Tailwind utilities, and custom UI components under `src/components`.
- **Docs & Ops**: Docker-based dev/prod setups (`docker-compose*.yml`), wiki docs, and various quick-start guides.

## General Conventions
- Preserve existing patterns and naming; prefer small, focused modules and pure functions where practical.
- Keep imports at top level (no try/catch around imports).
- Use `async/await` consistently; return structured JSON responses from the API and include informative error messages without leaking secrets.
- Update validation/audit logic when adding or changing data flows; maintain consistent logging/auditing in `backend/`.
- Keep styling/theming consistent on the frontend (use existing MUI theme utilities, Tailwind classes, and shared UI primitives where possible).

## Testing & Quality
- Run and update relevant tests:
  - Backend: `npm test` (from `backend/`) for Jest suites.
  - Frontend: `npm test` (from `frontend/`) for Vitest suites.
- Add or adjust tests alongside significant logic changes.
- Ensure Docker-related changes keep compose files in sync when needed.

## Frontend Guidance
- Use functional components and React hooks; colocate component styles with the component file.
- Prefer existing UI components/utilities in `src/components` and shared helpers before adding new dependencies.
- Keep routing consistent with `react-router-dom` usage in `src`.

## Backend Guidance
- Keep the API surface under `/api/...` routes; follow existing controller/utility patterns in `server.js`, `auth.js`, `mfa.js`, and `oidc.js`.
- When modifying database interactions, use the helpers in `database.js` and maintain parity between SQLite and Postgres paths.
- Preserve security-sensitive flows (MFA, OIDC, passkeys); ensure new behavior respects feature flags/env configuration documented in `.env.example` references.

## Documentation & PRs
- Update relevant README or wiki-adjacent docs when user-facing behavior or setup changes.
- Summaries/PR bodies should note key changes and tests executed.
