# AGENTS.md

## Cursor Cloud specific instructions

### Architecture
This is a **pnpm + Turborepo monorepo** for a golf tee time booking platform ("TeeTimes"). See `plan.md` for the full specification.

- `apps/api` — Express.js backend (port 3001)
- `apps/web` — Next.js 14 App Router frontend (port 3000)
- `packages/db` — Drizzle ORM schema + migrations (PostgreSQL)
- `packages/types` — Shared TypeScript interfaces
- `packages/validators` — Shared Zod schemas

### Required services
| Service | How to start | Notes |
|---|---|---|
| PostgreSQL | `pnpm docker:up` | Docker Compose (`docker-compose.yml`): Postgres 16 on `localhost:5432`, DB `teetimes`, user `ubuntu`, password `devpass` |
| Redis | `pnpm docker:up` | Same compose file: Redis on `localhost:6379` |
| Express API | `cd apps/api && pnpm dev` | Runs on port 3001 |
| Next.js Web | `cd apps/web && pnpm dev` | Runs on port 3000 |

*(If you use a host-installed Postgres instead of Docker, point `DATABASE_URL` at it; commands below assume the Docker URL from `.env.example`.)*

### Common commands
- **Install deps**: `pnpm install` (from repo root)
- **Rebuild bcrypt native**: `cd node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt && npm run install` (needed after fresh `pnpm install` since pnpm 10 blocks build scripts by default)
- **Dev (all services)**: `pnpm dev` (runs Turborepo `dev` task for both apps)
- **Lint**: `pnpm lint` or per-app (`cd apps/api && pnpm lint`, `cd apps/web && pnpm lint`)
- **Test**: `pnpm test` or per-app (`cd apps/api && pnpm test`)
- **Typecheck**: `pnpm typecheck`
- **DB migration generate**: `pnpm db:generate`
- **DB migration run**: `pnpm db:migrate` (with `DATABASE_URL` in `.env`; after `pnpm docker:up`)
- **One-off Pinebrook duplicate courses cleanup** (SQL merge/delete): `pnpm db:cleanup-pinebrook`

### Seeding the database
- **Base seed** (users + club + config): `pnpm seed`
- The seed script is idempotent (uses `onConflictDoNothing`).

### Key gotchas
- **bcrypt build scripts**: pnpm 10.x blocks native build scripts by default. After `pnpm install`, bcrypt won't have its native bindings. You must manually run its install script (see above) or use `pnpm rebuild bcrypt` won't work because pnpm considers it already installed.
- **Drizzle config paths**: The `drizzle.config.ts` uses paths relative to the workspace root (not the `packages/db/` directory) because it's invoked from root via `pnpm db:generate`/`pnpm db:migrate`.
- **Environment variables**: Copy `.env.example` to `.env` at the repo root. The `DATABASE_URL` must be set for DB operations.
- **Next.js ESLint**: The web app uses `.eslintrc.json` with `next/core-web-vitals`. The API uses flat ESLint config (`eslint.config.mjs`) with `typescript-eslint`.
- **API server must be running for web pages**: The club profile and booking pages are server components / client components that fetch from the API at `http://localhost:3001`. Start the API before testing web pages.
- **Slot generation**: Tee slots are generated in-memory from club config (not pre-stored in DB). Only booked/blocked slots persist in the `tee_slots` table. The availability endpoint merges generated slots with DB rows.

### E2E booking flow
The full booking flow is: landing page (`/`) → club profile (`/book/pinebrook`) → times picker (`/book/pinebrook/times`) → confirm (`/book/pinebrook/confirm`) → success (`/book/pinebrook/success`). All pages must be tested in sequence to verify the flow works end-to-end.
