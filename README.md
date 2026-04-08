# TeeTimes (golf)

Monorepo for a tee-time booking product: **Next.js** app (`apps/web`), **Express** API (`apps/api`), shared **Drizzle** schema and seeds (`packages/db`), **Zod** validators (`packages/validators`), and shared types (`packages/types`). Postgres holds clubs, courses, tee slots, bookings, and users; **Redis** backs BullMQ email jobs and short-lived availability cache.

This README covers **local development**, **production deployment** (Railway + Vercel), and points to **[FEATURES.md](FEATURES.md)** for a full feature inventory.

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

## Deployment (production)

Production uses two services: the **Express API** on **Railway** and the **Next.js** app on **Vercel**. The monorepo **root** is the install/build context so `pnpm --filter …` resolves workspace packages.

### Railway (API)

| Setting | Value |
|--------|--------|
| **Runtime** | Node (e.g. **Node 22** via Railpack) |
| **Custom build command** | `pnpm install && pnpm --filter @teetimes/api build` |
| **Start** | Use the API package start script (e.g. `pnpm --filter @teetimes/api start` → `node dist/index.js`) — align with Railway’s **Start Command** if you override it |
| **Watch paths** (optional) | `/apps/api/**` — redeploy only when the API app changes |

That build runs **`@teetimes/db`** and **`@teetimes/validators`** `tsc` output, then compiles the API — same chain as `apps/api` `package.json` **`build`**. You do **not** run those steps manually on deploy; Railway runs the build command each time. Set **`DATABASE_URL`**, **`JWT_SECRET`**, Redis, email keys, and other vars in Railway’s environment.

### Vercel (web)

Vercel needs a full **pnpm workspace install** from the monorepo root so `workspace:*` dependencies resolve. Two setups are equivalent — **pick one** and keep **Root Directory**, install, and build aligned.

| Approach | **Root Directory** (Vercel project) | Install | Build |
|----------|-------------------------------------|---------|--------|
| **A — App folder** | `apps/web` | `cd ../.. && pnpm install` | `next build` |
| **B — Repo root** | *(empty / repository root)* | `pnpm install` | `pnpm --filter @teetimes/web build` (runs `next build` in that package) |

The repo includes **`apps/web/vercel.json`**, which matches **approach A**.

**Production Overrides** in the dashboard (`next build` + `cd ../.. && pnpm install`) match **A** — i.e. Vercel’s working directory is **`apps/web`** for that deployment. **Project Settings** (`pnpm install` + `pnpm --filter @teetimes/web build`) match **B** — i.e. root is the **repository root**. Both are valid; the yellow warning appears because those two rows are mixed across “what shipped” vs “what the UI says now.”

The web app lists **`@teetimes/types`** and **`@teetimes/validators`** in **`transpilePackages`** (`apps/web/next.config.mjs`), so the Next.js production build can compile those workspace packages without a separate library build step for the frontend.

To align and clear the warning: choose **A** or **B**, set **Root Directory** and install/build overrides to match that row, save, and run a **new production deploy**.

### Database: migrations and seeds (deployed environments)

**Migrations** (`pnpm db:migrate` from the repo root, **Drizzle** + `DATABASE_URL`) are **not** part of `pnpm build` or the Vercel/Railway build. They change the live database schema. **Ship migration files in git** with the PR that needs them; after deploy (or before, depending on your process), **run migrations against that environment’s Postgres** so the schema matches the new code.

Typical patterns:

| Situation | What to do |
|-----------|------------|
| **New empty DB** (new Railway Postgres, fresh instance) | Point `DATABASE_URL` at it, then run **`pnpm db:migrate`** once. Then optionally seed (below). |
| **Release with schema changes** | Deploy code, then run **`pnpm db:migrate`** against staging/production **before** or **as** traffic hits the new API (order matters for zero-downtime — often migrate first, then deploy, or use expand/contract patterns for risky changes). |
| **Demo / staging** | Same migrations as prod. For **fake data** (clubs, demo users), run **`pnpm seed`** (and optionally **`pnpm seed:bookings`**) from a machine with `DATABASE_URL` set to that database — **not** usually wired into the Railway build step. |

**Seeds** are for **development and demos**: idempotent base data (`pnpm seed`), optional booking density (`pnpm seed:bookings`), etc. **Do not** auto-run destructive or demo seeds on **real production** unless you explicitly intend that. For **testing and demo** environments, running seeds after migrate is normal.

**Practical ways to run migrate/seed against Railway:**

- **One-off locally:** `DATABASE_URL='postgresql://…' pnpm db:migrate` then `pnpm seed` (repo root, same as local but with remote URL).
- **Railway CLI / shell:** Open a shell attached to the service or use `railway run` with env injected, then the same commands (ensure the repo or `drizzle` config path is available).
- **CI job** (optional): on merge to `main`, run migrations against a staging DB URL from secrets.

**Vercel** does not run Postgres migrations; only the **API** (or any worker) needs a DB, and migrations are a **separate operational step** tied to `DATABASE_URL`.

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

## Feature inventory

See **[FEATURES.md](FEATURES.md)** for a full, categorized list of everything that's built and working: public booking flow, club staff dashboard, platform admin, API services, email system, database schema, shared packages, UI design system, and infrastructure.
