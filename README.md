# TeeTimes (golf)

Monorepo for a tee-time booking product: **Next.js** app (`apps/web`), **Express** API (`apps/api`), shared **Drizzle** schema and seeds (`packages/db`), **Zod** validators (`packages/validators`), and shared types (`packages/types`). Postgres holds clubs, courses, tee slots, bookings, and users; **Redis** backs BullMQ email jobs and short-lived availability cache.

This README summarizes **current state** for local development. Detailed build/test checklists live in `plan.md` (many items there are manual QA, not all are automated yet).

## Prerequisites

- **Node.js** (see repo’s typical LTS use) and **pnpm** (`packageManager` in root `package.json`)
- **Docker Desktop** (or compatible engine) for Postgres and Redis

## Environment

Copy `.env.example` to `.env` at the repo root and adjust if needed. The Next.js app loads that root `.env` (via `apps/web/next.config.mjs`) so `NEXTAUTH_SECRET` and `API_URL` are available when you run `pnpm dev` from the monorepo root without a separate `apps/web/.env`. You can still add `apps/web/.env.local` for overrides.

The example assumes:

- **Postgres**: `postgresql://ubuntu:devpass@localhost:5432/teetimes` (database user password — not the same as app login passwords)
- **API**: `PORT=3001`
- **Web**: `NEXTAUTH_URL=http://localhost:3000` and `NEXTAUTH_SECRET` / `JWT_SECRET` aligned for dev

Optional: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001` in code).

## Local setup

1. Start infra: `pnpm docker:up` (Postgres 16 + Redis 7 — see `docker-compose.yml`).
2. Apply migrations: `pnpm db:migrate`
3. Seed clubs, config, courses, and users: `pnpm seed`
4. Optional — demo tee slots + bookings (four-course density scenarios): `pnpm seed:bookings`
5. Reset bookings/slots only and re-seed: `pnpm seed:reset` (truncates booking-related tables, then runs `seed` + `seed:bookings`)

Run everything in dev (Turbo):

```bash
pnpm dev
```

- **Web**: http://localhost:3000  
- **API**: http://localhost:3001 (e.g. `GET /health` → `{ "ok": true }`)

## CI and automated checks

On push and pull requests, **GitHub Actions** (`.github/workflows/ci.yml`) runs:

- `pnpm typecheck` — TypeScript across packages  
- `pnpm test` — Vitest (unit tests + **public API invariants**: routes like `GET /api/clubs/public/:slug` and `POST /api/bookings/public` must not return **401** from staff JWT middleware)  
- `pnpm build` — production builds (requires `NEXTAUTH_SECRET` / `JWT_SECRET` in the workflow env; runners do not load your local `.env`)

That catches **routing/wiring mistakes** and **broken builds** before merge. It does **not** spin up Postgres in CI yet, so DB-dependent handlers may log errors in tests while still asserting the right status codes. Optional next steps: add a **Postgres service** in CI and a small **migration + seed** step for deeper API tests, plus **Playwright** (or similar) for login and public booking flows.

## Demo credentials (seeded users)

All seeded accounts share the **same app password** (bcrypt hash is in `packages/db/src/seed.ts`):

| Email | Role | Use |
|--------|------|-----|
| `admin@teetimes.dev` | Platform admin | `/platform`, manage clubs |
| `owner@testclub.dev` | Club admin (Pinebrook) | Club-scoped staff flows |
| `staff@testclub.dev` | Staff (Pinebrook) | Club dashboard / operations |

**Password (all three):** `devpass`

**Public booking demo:** seeded club slug **`pinebrook`** — e.g. http://localhost:3000/book/pinebrook

> These accounts are for **local/demo only**. Change secrets and passwords before any real deployment.

## Useful scripts (root)

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Turbo dev (web + api as configured) |
| `pnpm build` | Production builds |
| `pnpm typecheck` | TypeScript across packages |
| `pnpm test` | Vitest (validators + API unit/integration where present) |
| `pnpm docker:up` / `pnpm docker:down` | Start/stop Postgres + Redis |
| `pnpm db:migrate` | Run Drizzle migrations |
| `pnpm seed` | Base seed (no tee slots/bookings beyond schema needs) |
| `pnpm seed:bookings` | Extra slots + bookings for UI density demos |
| `pnpm seed:reset` | Clear bookings/slots and re-run seed + seed:bookings |

## Email and background work

- **BullMQ** worker in the API processes `email` queue jobs (confirmation, reminder, cancellation, staff invite).
- With **`RESEND_API_KEY`** unset, sends are skipped and a log line is printed (safe for local dev).
- Staff invites link to **`/set-password?token=...`** on the web app; completion hits the API `POST /api/auth/set-password`.

## Auth model (high level)

- **NextAuth (v5 beta)** on the web: credentials provider posts to the API login route; session carries a JWT **`accessToken`** used as Bearer token for platform/club server routes and BFF-style `app/api/platform/*` handlers.
- **Express** validates JWTs via shared secret (`JWT_SECRET` / `NEXTAUTH_SECRET`).

## Current state (honest snapshot)

- **Implemented:** Dockerized Postgres/Redis, migrations, seeds, booking density seed, availability API with optional full grid + Redis cache invalidation, public booking flow, club/platform routes with RBAC, rate limits on public endpoints, email queue + React Email templates, set-password flow, Vitest coverage for health, some validators, and pure lib helpers (`configResolver`, `slotGenerator`).
- **Not exhaustive:** `plan.md` still lists broader integration tests (cache TTL proofs, concurrency, full route matrices, worker failure modes, etc.). Treat those as a roadmap / QA list unless you expand automated tests.

For deep task-by-task status, keep using **`plan.md`**.
