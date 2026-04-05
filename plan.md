# Golf Tee Time Platform — Master Build Plan

> **Superpowers workflow document.** This plan follows RED/GREEN TDD, YAGNI, and atomic task execution. Every task is sized for a single agent pass. Do not skip ahead. Do not build what is not listed. Verify each task before marking done.

---

## How to use this plan

1. Install Superpowers in Cursor before starting
2. Work tasks in order — each one unlocks the next
3. Every task follows RED/GREEN: write the failing test first, confirm it fails, then write the minimum code to pass it
4. Each task has a **Verify** section — do not move on until all checks pass
5. If a task feels large, stop and ask for decomposition before proceeding

---

## Architecture principles

This platform is built engine-first. The server is always the source of truth — the client is a display layer. Every constraint that matters (capacity, club scope, concurrency, cancellation windows) is enforced in the API or the DB, never trusted from the client. This means the frontend can be rebuilt, redesigned, or extended without touching the rules that govern how the system behaves.

The same principle applies to config: clubs evolve. Their hours, intervals, and pricing change over time. The system must be able to reproduce any historical tee sheet exactly, which means config is versioned rather than mutated.

---

## Non-negotiable constraints

Read these before touching any code. They apply to every task in every phase.

- **No overbooking**: slot capacity is enforced at the DB layer with an atomic `UPDATE ... WHERE booked_players + N <= max_players RETURNING *`. If 0 rows returned, reject. Never read-then-write.
- **No cross-club leakage**: every query on club-owned data must include a `club_id` guard derived from the authenticated user's scoped role, never from the request body.
- **No storing empty tee slots**: slots are generated in memory from config. Only bookings and blocks write to `tee_slots`.
- **UTC only in the DB**: store all datetimes as `timestamptz` UTC. Convert to club timezone at display time using `date-fns-tz`.
- **No inline Zod schemas**: all validators live in `packages/validators/`. Import, never redeclare.
- **No fire-and-forget async**: all email and job work goes through BullMQ queues.
- **Drizzle transactions for bookings**: slot update + booking insert are one transaction.
- **Soft deletes on bookings**: `deleted_at` column. Never hard-delete booking records.
- **Redis for availability cache**: use the existing Redis instance — not in-memory — so cache is shared across all Express instances from day one.
- **Rate limit all public endpoints**: `express-rate-limit` on every unauthenticated route before launch.

---

## System overview

```
Platform (super admin)
  └── Club (tenant)
        └── Course
              └── Tee Slots  ← generated in memory from versioned config; persisted only when booked/blocked
                    └── Bookings
                          └── Golfer
```

### Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) — Vercel |
| Backend | Express.js (separate Railway service) |
| Database | PostgreSQL — Railway |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | Auth.js v5 (NextAuth), JWT strategy |
| Email | Resend + React Email |
| Jobs | BullMQ + Redis (Railway plugin) |
| Cache | Redis (same instance as BullMQ) |
| Time | date-fns + date-fns-tz |
| Validation | Zod (shared via packages/validators) |
| UI | Tailwind CSS + shadcn/ui |

### Monorepo layout

```
/
├── apps/
│   ├── web/                  Next.js 14 (App Router)
│   └── api/                  Express
├── packages/
│   ├── db/                   Drizzle schema + migrations + client
│   ├── types/                shared TypeScript interfaces
│   └── validators/           shared Zod schemas
├── pnpm-workspace.yaml
└── turbo.json
```

### RBAC

| Role | Scope | What they can do |
|---|---|---|
| `platform_admin` | Global | Everything |
| `club_admin` | Club-scoped | Full club control |
| `staff` | Club-scoped | Tee sheet, bookings, check-in |
| `golfer` | Global | Own bookings only |

Roles live in a `user_roles` pivot table — never as an enum column on `users`. One user can be `club_admin` of multiple clubs simultaneously.

### JWT shape

```json
{
  "userId": "uuid",
  "roles": [
    { "role": "club_admin", "clubId": "uuid" },
    { "role": "platform_admin", "clubId": null }
  ]
}
```

---

## Full database schema

Reference this for every schema task. Do not deviate without updating this section.

```sql
-- ── Identity ──────────────────────────────────────────────────────────────

users
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  email         text UNIQUE NOT NULL
  password_hash text
  name          text
  created_at    timestamptz DEFAULT now()
  deleted_at    timestamptz

user_roles
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid()
  user_id uuid REFERENCES users(id) ON DELETE CASCADE
  role    text NOT NULL         -- platform_admin | club_admin | staff | golfer
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE  -- null = global scope

-- ── Tenant ────────────────────────────────────────────────────────────────

clubs
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
  name              text NOT NULL
  slug              text UNIQUE NOT NULL
  status            text DEFAULT 'active'    -- active | suspended
  subscription_type text DEFAULT 'trial'
  booking_fee       numeric(5,2) DEFAULT 0
  description       text                     -- shown on club profile page
  hero_image_url    text                     -- club photo for profile hero
  created_at        timestamptz DEFAULT now()

courses
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid()
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE
  name    text NOT NULL
  holes   int NOT NULL DEFAULT 18            -- 9 | 18

-- ── Club config (versioned) ───────────────────────────────────────────────
--
-- Multiple rows per club are allowed. Always query with:
--   WHERE club_id = ? AND effective_from <= target_date
--   ORDER BY effective_from DESC LIMIT 1
--
-- This means historical tee sheets are always reproducible even after a club
-- changes their interval, hours, or schedule.

club_config
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
  club_id               uuid REFERENCES clubs(id) ON DELETE CASCADE
  effective_from        date NOT NULL DEFAULT CURRENT_DATE
  slot_interval_minutes int DEFAULT 10       -- 8 | 10 | 12
  booking_window_days   int DEFAULT 14
  cancellation_hours    int DEFAULT 24
  open_time             time DEFAULT '06:00' -- fallback when schedule is null
  close_time            time DEFAULT '18:00' -- fallback when schedule is null
  schedule              jsonb                -- [{ dayOfWeek: 0-6, openTime: 'HH:mm', closeTime: 'HH:mm' }]
                                             -- null = use open_time/close_time flat values for all days
  timezone              text DEFAULT 'America/New_York'
  logo_url              text
  primary_color         text DEFAULT '#16a34a'
  UNIQUE (club_id, effective_from)

-- ── Tee slots ─────────────────────────────────────────────────────────────

tee_slots
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
  course_id      uuid REFERENCES courses(id) ON DELETE CASCADE
  datetime       timestamptz NOT NULL
  max_players    int DEFAULT 4
  booked_players int DEFAULT 0
  status         text DEFAULT 'open'         -- open | blocked
  price          numeric(8,2)
  slot_type      text DEFAULT '18hole'       -- 18hole | 9hole
  CONSTRAINT no_overbooking CHECK (booked_players <= max_players)

-- ── Bookings ──────────────────────────────────────────────────────────────

bookings
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
  booking_ref    text UNIQUE NOT NULL        -- e.g. 'PINE-A3F9K2' — human-readable, club-scoped
  tee_slot_id    uuid REFERENCES tee_slots(id)
  user_id        uuid REFERENCES users(id)   -- null = guest checkout
  guest_name     text
  guest_email    text
  players_count  int NOT NULL
  notes          text                        -- special requests (500 char max)
  status         text DEFAULT 'confirmed'    -- confirmed | cancelled | no_show
  payment_status text DEFAULT 'unpaid'       -- unpaid | paid | refunded
  created_at     timestamptz DEFAULT now()
  deleted_at     timestamptz

booking_players
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE
  name       text
  email      text
  checked_in boolean DEFAULT false
  no_show    boolean DEFAULT false

-- ── Observability ─────────────────────────────────────────────────────────

failed_jobs
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid()
  job_name   text NOT NULL
  job_data   jsonb NOT NULL
  error      text NOT NULL
  failed_at  timestamptz DEFAULT now()
```

### Key schema decisions

**`club_config` versioning**: the `effective_from` + `UNIQUE(club_id, effective_from)` constraint means config changes are additive. To change a club's interval, insert a new row — never update the existing one. The slot generator always resolves config as `WHERE club_id = ? AND effective_from <= slotDate ORDER BY effective_from DESC LIMIT 1`.

**`schedule` JSONB**: when set, overrides `open_time`/`close_time` per day of week. When null, the flat values apply to all days. The slot generator checks for a matching `dayOfWeek` entry first, falls back to flat values.

**`booking_ref`**: generated at insert time as `[CLUB_SLUG_UPPERCASE]-[6 random alphanumeric]`. Checked for uniqueness before insert; retry on collision (rare). Safe for phone calls, printouts, and check-in lookup. Do not use UUIDs on customer-facing surfaces.

**`failed_jobs`**: written by the BullMQ worker's `failed` event handler. Acts as a lightweight dead-letter log. No automation — just visibility. Queryable from the platform admin panel in v1.1.

---

## Concurrency safety — mandatory pattern

Never use read-then-write for `booked_players`. Always use:

```sql
UPDATE tee_slots
SET booked_players = booked_players + :count
WHERE id = :slotId
  AND booked_players + :count <= max_players
  AND status = 'open'
RETURNING *;
```

If 0 rows returned → reject with 409 `SLOT_FULL`. This is enforced at the DB layer and backed by the `no_overbooking` CHECK constraint as a second line of defence.

---

## Phase 0 — Foundation

> Goal: running monorepo, connected DB, working auth, RBAC middleware, Redis connected. An agent should complete all of Phase 0 in one focused session.

---

### Task 0.1 — Scaffold monorepo

**What to build**

```
/
├── apps/web/             (Next.js 14, App Router, TypeScript)
├── apps/api/             (Express, TypeScript, ts-node-dev)
├── packages/db/          (empty for now — scaffold only)
├── packages/types/       (empty for now — scaffold only)
├── packages/validators/  (empty for now — scaffold only)
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
    DATABASE_URL=
    REDIS_URL=
    RESEND_API_KEY=
    NEXTAUTH_SECRET=
    RATE_LIMIT_WINDOW_MS=60000
    RATE_LIMIT_MAX=60
```

Each app and package has its own `package.json` with name prefixed `@teetimes/`.

**RED first**

```ts
// apps/api/src/__tests__/health.test.ts
it('GET /health returns 200', async () => {
  const res = await request(app).get('/health')
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)
})
```

**GREEN**

Create `apps/api/src/app.ts` with `GET /health`. Wire `index.ts` to start server on `PORT`.

**Verify**

- [ ] `pnpm install` from root with no errors
- [ ] `pnpm turbo dev` starts web (3000) and api (3001)
- [ ] `curl localhost:3001/health` → `{"ok":true}`
- [ ] Health test passes

---

### Task 0.2 — Drizzle schema + migration

**What to build**

`packages/db/src/schema/`:
- `users.ts` — `users`, `userRoles`
- `clubs.ts` — `clubs`, `clubConfig`, `courses`
- `bookings.ts` — `teeSlots`, `bookings`, `bookingPlayers`
- `observability.ts` — `failedJobs`

`packages/db/src/index.ts` — exports `db` client (drizzle + postgres.js)
`packages/db/drizzle.config.ts` — reads `DATABASE_URL`

Implement the full schema as specified above including:
- `club_config.effective_from` + `UNIQUE(club_id, effective_from)`
- `club_config.schedule jsonb`
- `bookings.booking_ref text UNIQUE NOT NULL`
- `bookings.notes text`
- `failed_jobs` table
- `no_overbooking` CHECK constraint on `tee_slots`

**RED first**

```ts
it('can insert and retrieve a user', async () => {
  const [user] = await db.insert(users).values({
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
  }).returning()
  expect(user.id).toBeDefined()
})

it('no_overbooking constraint rejects booked_players > max_players', async () => {
  await expect(
    db.insert(teeSlots).values({
      courseId: testCourseId,
      datetime: new Date(),
      maxPlayers: 4,
      bookedPlayers: 5,   // violates CHECK
    })
  ).rejects.toThrow()
})

it('club_config unique constraint rejects duplicate effective_from', async () => {
  await db.insert(clubConfig).values({ clubId, effectiveFrom: '2025-01-01', ... })
  await expect(
    db.insert(clubConfig).values({ clubId, effectiveFrom: '2025-01-01', ... })
  ).rejects.toThrow()
})
```

**GREEN**

Implement schema files. `drizzle-kit generate` + `drizzle-kit migrate`.

**Verify**

- [ ] All schema tests pass
- [ ] Migration runs clean with zero errors
- [ ] `\dt` shows all tables including `failed_jobs`
- [ ] `no_overbooking` CHECK confirmed: `psql $DATABASE_URL -c "\d tee_slots"`
- [ ] `UNIQUE(club_id, effective_from)` confirmed on `club_config`
- [ ] `booking_ref` has `UNIQUE` constraint on `bookings`

---

### Task 0.3 — Seed: base users and club

**What to build**

`packages/db/src/seed.ts` — idempotent base seed. Creates the minimum needed to log in and navigate the system.

```
Users:
  admin@teetimes.dev     / dev-only  → platform_admin
  owner@testclub.dev     / dev-only  → club_admin  (test-club)
  staff@testclub.dev     / dev-only  → staff        (test-club)

Club:
  name: 'Pinebrook Golf Club'
  slug: 'pinebrook'
  description: 'A classic 18-hole parkland layout with four distinct courses.'
  timezone: 'America/New_York'

club_config (effective_from: 2024-01-01):
  slot_interval_minutes: 10
  booking_window_days: 14
  cancellation_hours: 24
  open_time: '06:00'
  close_time: '18:00'
  schedule: [
    { dayOfWeek: 0, openTime: '05:30', closeTime: '19:00' },  -- Sunday
    { dayOfWeek: 6, openTime: '05:30', closeTime: '19:00' },  -- Saturday
  ]
  timezone: 'America/New_York'
```

Use `onConflictDoNothing()` on all inserts. All passwords hashed with bcrypt.

**RED first**

```ts
it('creates all seed users with correct roles', async () => {
  await runSeed()
  const admin = await db.query.users.findFirst({ where: eq(users.email, 'admin@teetimes.dev'), with: { roles: true } })
  expect(admin!.roles[0].role).toBe('platform_admin')
  expect(admin!.roles[0].clubId).toBeNull()

  const owner = await db.query.users.findFirst({ where: eq(users.email, 'owner@testclub.dev'), with: { roles: true } })
  expect(owner!.roles[0].role).toBe('club_admin')
  expect(owner!.roles[0].clubId).toBeDefined()
})

it('seed is idempotent — running twice produces no duplicates', async () => {
  await runSeed()
  await runSeed()
  const count = await db.$count(users, eq(users.email, 'admin@teetimes.dev'))
  expect(count).toBe(1)
})

it('club_config has schedule JSONB with weekend overrides', async () => {
  await runSeed()
  const club = await db.query.clubs.findFirst({ where: eq(clubs.slug, 'pinebrook'), with: { configs: true } })
  const config = club!.configs[0]
  expect(config.schedule).toBeInstanceOf(Array)
  expect(config.schedule.find(s => s.dayOfWeek === 0)?.openTime).toBe('05:30')
})
```

**Verify**

- [ ] All seed tests pass
- [ ] `pnpm seed` runs without errors
- [ ] Running twice produces no duplicates
- [ ] All three users can log in (manual browser check)

---

### Task 0.4 — Seed: four test courses with booking density

**What to build**

`packages/db/src/seedBookings.ts` — separate script, safe to run independently. Creates four courses on `pinebrook` with distinct booking densities for rapid UI testing.

```
Course 1 — "The Championship" (18 holes)
  Pattern: FULLY BOOKED all day
  Purpose: Test full slots, faded/disabled UI states, 409 SLOT_FULL path
  Implementation: generate all slots for today + next 7 days,
                  insert tee_slots with booked_players = max_players = 4

Course 2 — "The Meadows" (18 holes)
  Pattern: LIGHTLY BOOKED (~10–15% utilisation)
  Purpose: Test happy path — plenty of availability, soonest pills show many options
  Implementation: insert 2–3 tee_slot rows per day, booked_players = 1–2

Course 3 — "The Pines" (18 holes)
  Pattern: MORNING RUSH — full before 10am, open afternoons
  Purpose: Test morning/afternoon grouping, soonest pills skip to afternoon,
           party-size filter (a 1-spot slot disappears when party = 2)
  Implementation: morning slots booked_players = 4 (full),
                  afternoon slots booked_players = 0–1

Course 4 — "The Lakes" (9 holes)
  Pattern: RANDOM SCATTER (~50% utilisation, mixed states)
  Purpose: Test pip dot rendering at all fill levels, mixed available/unavailable,
           9-hole slot_type display
  Implementation: random booked_players 0–4 across slots,
                  slot_type = '9hole'
```

All slot datetimes cover today through today + 7 days. Use `date-fns` to generate dates relative to `new Date()` so the seed is always current.

**RED first**

```ts
it('Championship course has no available slots today', async () => {
  await runSeedBookings()
  const championship = await getCourseByName('The Championship')
  const slots = await db.query.teeSlots.findMany({
    where: and(
      eq(teeSlots.courseId, championship.id),
      gte(teeSlots.datetime, startOfDay(new Date())),
      lte(teeSlots.datetime, endOfDay(new Date()))
    )
  })
  expect(slots.length).toBeGreaterThan(0)
  expect(slots.every(s => s.bookedPlayers >= s.maxPlayers)).toBe(true)
})

it('Meadows course has available slots for a party of 4', async () => {
  await runSeedBookings()
  const meadows = await getCourseByName('The Meadows')
  const slots = await db.query.teeSlots.findMany({
    where: and(
      eq(teeSlots.courseId, meadows.id),
      gte(teeSlots.datetime, startOfDay(new Date()))
    )
  })
  const available = slots.filter(s => s.maxPlayers - s.bookedPlayers >= 4)
  expect(available.length).toBeGreaterThan(0)
})

it('Pines course has full morning slots and open afternoon slots', async () => {
  await runSeedBookings()
  const pines = await getCourseByName('The Pines')
  const slots = await db.query.teeSlots.findMany({
    where: and(eq(teeSlots.courseId, pines.id), gte(teeSlots.datetime, startOfDay(new Date())))
  })
  const morning = slots.filter(s => new Date(s.datetime).getUTCHours() < 14)  // before 10am ET
  const afternoon = slots.filter(s => new Date(s.datetime).getUTCHours() >= 14)
  expect(morning.every(s => s.bookedPlayers === s.maxPlayers)).toBe(true)
  expect(afternoon.some(s => s.bookedPlayers < s.maxPlayers)).toBe(true)
})

it('Lakes course has 9hole slot_type', async () => {
  await runSeedBookings()
  const lakes = await getCourseByName('The Lakes')
  const slots = await db.query.teeSlots.findMany({ where: eq(teeSlots.courseId, lakes.id) })
  expect(slots.every(s => s.slotType === '9hole')).toBe(true)
})
```

**GREEN**

Implement `runSeedBookings()`. Use `date-fns` `eachDayOfInterval`, `setHours`, `addMinutes` to generate slot datetimes. Use `date-fns-tz` `zonedTimeToUtc` to store as UTC.

**Verify**

- [ ] All density tests pass
- [ ] `pnpm seed:bookings` runs without errors
- [ ] Championship: all slots full in browser — every slot row faded
- [ ] Meadows: soonest pills show times immediately — happy path works
- [ ] Pines: morning pills absent or all full, afternoon pills show available times
- [ ] Lakes: pip dots show at all fill levels (0, 1, 2, 3, 4 taken)

---

### Task 0.5 — Auth.js setup

**What to build**

`apps/web/auth.ts` — Auth.js v5 with `CredentialsProvider` (email + bcrypt).
JWT callback: query `user_roles`, attach as `token.roles`.
Session callback: forward `token.roles` to `session.user.roles`.
`apps/web/middleware.ts` — protect `/platform`, `/club` route groups.

**RED first**

```ts
it('returns error for invalid credentials', async () => {
  const result = await signIn('credentials', { email: 'wrong@example.com', password: 'wrong', redirect: false })
  expect(result?.error).toBeDefined()
})

it('JWT contains scoped roles after valid login', async () => {
  const token = await getTestJWT('admin@teetimes.dev', 'dev-only')
  expect(token.roles).toContainEqual({ role: 'platform_admin', clubId: null })
})
```

**Verify**

- [ ] Auth tests pass
- [ ] `/platform` without login redirects to `/login`
- [ ] Login with seeded `admin@teetimes.dev` / `dev-only` succeeds
- [ ] `session.user.roles` includes correct scoped roles
- [ ] Wrong password → auth error, not 500

---

### Task 0.6 — Express auth + rate limit middleware

**What to build**

`apps/api/src/middleware/auth.ts`:
```ts
export const authenticate: RequestHandler       // validates JWT, attaches req.user + req.roles
export const requireRole: (role: string) => RequestHandler
export const requireClubRole: (roles: string[]) => RequestHandler
```

`apps/api/src/middleware/rateLimit.ts`:
```ts
// Public endpoints: 60 req/min per IP
export const publicRateLimit = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS),
  max: Number(process.env.RATE_LIMIT_MAX),
  standardHeaders: true,
  legacyHeaders: false,
})

// Stricter limit for booking creation: 10 req/min per IP
export const bookingRateLimit = rateLimit({ windowMs: 60_000, max: 10, ... })
```

Apply `publicRateLimit` to all routes under `/api/clubs/public/` and `/api/clubs/:clubId/availability`.
Apply `bookingRateLimit` to `POST /api/bookings/public`.

**RED first**

```ts
describe('requireRole', () => {
  it('calls next() when role matches', () => { ... })
  it('returns 403 when role does not match', () => { ... })
})

describe('requireClubRole', () => {
  it('allows when user has matching club role', () => { ... })
  it('rejects when clubId does not match route param', () => { ... })
})

describe('publicRateLimit', () => {
  it('returns 429 after exceeding limit', async () => {
    // Send 61 requests in rapid succession
    const responses = await Promise.all(
      Array.from({ length: 61 }, () => api.get('/api/clubs/public/pinebrook'))
    )
    expect(responses.some(r => r.status === 429)).toBe(true)
  })
})
```

**Verify**

- [ ] All middleware tests pass
- [ ] `GET /health` works unauthenticated, no rate limit applied
- [ ] Public availability route returns 429 after limit exceeded (in test)
- [ ] `GET /api/platform/clubs` with no token → 401
- [ ] `GET /api/platform/clubs` with staff token → 403

---

### Task 0.7 — Redis client + availability cache helper

**What to build**

`apps/api/src/lib/redis.ts` — exports a single shared `redis` client (ioredis).

`apps/api/src/lib/availabilityCache.ts`:

```ts
const CACHE_TTL_SECONDS = 30
const cacheKey = (clubId: string, courseId: string, date: string) =>
  `availability:${clubId}:${courseId}:${date}`

export async function getCachedAvailability(clubId, courseId, date): Promise<Slot[] | null>
export async function setCachedAvailability(clubId, courseId, date, slots: Slot[]): Promise<void>
export async function invalidateAvailabilityCache(clubId, courseId, date): Promise<void>
```

`invalidateAvailabilityCache` is called after every successful booking or cancellation for the affected date. This ensures the cache never serves stale data after a slot fills or frees up.

**RED first**

```ts
it('returns null on cache miss', async () => {
  const result = await getCachedAvailability('club-1', 'course-1', '2025-06-15')
  expect(result).toBeNull()
})

it('round-trips slots through Redis', async () => {
  const slots = [{ id: 'slot-1', datetime: '2025-06-15T11:00:00Z', bookedPlayers: 0, maxPlayers: 4 }]
  await setCachedAvailability('club-1', 'course-1', '2025-06-15', slots)
  const cached = await getCachedAvailability('club-1', 'course-1', '2025-06-15')
  expect(cached).toEqual(slots)
})

it('invalidation removes the cache entry', async () => {
  await setCachedAvailability('club-1', 'course-1', '2025-06-15', [])
  await invalidateAvailabilityCache('club-1', 'course-1', '2025-06-15')
  const result = await getCachedAvailability('club-1', 'course-1', '2025-06-15')
  expect(result).toBeNull()
})
```

**Verify**

- [ ] All cache tests pass against real Redis (test env)
- [ ] TTL of 30 seconds confirmed: `redis-cli TTL availability:*`
- [ ] `redis` client shared singleton — not re-instantiated per request

---

## Phase 1 — Club Operations

> Goal: club admin can configure their club and courses, staff can view and operate the tee sheet, manual bookings work, player check-in works.

---

### Task 1.1 — Shared Zod validators

**What to build**

`packages/validators/src/clubs.ts`:

```ts
export const CreateClubSchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  timezone: z.string(),
  description: z.string().max(500).optional(),
})

export const ScheduleDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
})

export const ClubConfigSchema = z.object({
  slotIntervalMinutes: z.union([z.literal(8), z.literal(10), z.literal(12)]),
  bookingWindowDays: z.number().int().min(1).max(90),
  cancellationHours: z.number().int().min(0),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  schedule: z.array(ScheduleDaySchema).max(7).optional(),
  timezone: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // YYYY-MM-DD
})
```

`packages/validators/src/courses.ts`:

```ts
export const CourseSchema = z.object({
  name: z.string().min(1),
  holes: z.union([z.literal(9), z.literal(18)]),
})
```

`packages/validators/src/bookings.ts`:

```ts
export const CreateBookingSchema = z.object({
  teeSlotId: z.string().uuid(),
  playersCount: z.number().int().min(1).max(4),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  notes: z.string().max(500).optional(),
  players: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
  })).optional(),
})

export const PublicCreateBookingSchema = CreateBookingSchema
```

**RED first**

```ts
it('rejects invalid slug', () => {
  expect(CreateClubSchema.safeParse({ name: 'X', slug: 'Has Spaces!', timezone: 'UTC' }).success).toBe(false)
})
it('rejects interval not in allowed set', () => {
  expect(ClubConfigSchema.safeParse({ slotIntervalMinutes: 7, ... }).success).toBe(false)
})
it('rejects schedule with invalid dayOfWeek', () => {
  const result = ClubConfigSchema.safeParse({ ..., schedule: [{ dayOfWeek: 8, openTime: '06:00', closeTime: '18:00' }] })
  expect(result.success).toBe(false)
})
```

**Verify**

- [ ] All validator tests pass
- [ ] Importable from `@teetimes/validators` in both `apps/api` and `apps/web`

---

### Task 1.2 — Club config resolver

**What to build**

`apps/api/src/lib/configResolver.ts` — pure function that resolves the correct `club_config` for a given date and returns the effective open/close times for a specific day of week.

```ts
export function resolveConfig(configs: ClubConfig[], targetDate: Date): ClubConfig
// Returns the config row with the highest effective_from <= targetDate

export function resolveHours(config: ClubConfig, dayOfWeek: number): { openTime: string, closeTime: string }
// If config.schedule has an entry for dayOfWeek, return those times.
// Otherwise return config.open_time / config.close_time.
```

**RED first**

```ts
describe('resolveConfig', () => {
  it('returns the most recent config before or on the target date', () => {
    const configs = [
      { effectiveFrom: '2024-01-01', slotIntervalMinutes: 10 },
      { effectiveFrom: '2025-06-01', slotIntervalMinutes: 8 },
    ]
    const result = resolveConfig(configs, new Date('2025-07-01'))
    expect(result.slotIntervalMinutes).toBe(8)
  })

  it('does not return a config effective in the future', () => {
    const configs = [
      { effectiveFrom: '2024-01-01', slotIntervalMinutes: 10 },
      { effectiveFrom: '2099-01-01', slotIntervalMinutes: 8 },
    ]
    const result = resolveConfig(configs, new Date('2025-06-01'))
    expect(result.slotIntervalMinutes).toBe(10)
  })
})

describe('resolveHours', () => {
  it('returns schedule override for matching dayOfWeek', () => {
    const config = {
      openTime: '06:00', closeTime: '18:00',
      schedule: [{ dayOfWeek: 0, openTime: '05:30', closeTime: '19:00' }]
    }
    expect(resolveHours(config, 0)).toEqual({ openTime: '05:30', closeTime: '19:00' })
  })

  it('falls back to flat values when no schedule match', () => {
    const config = { openTime: '06:00', closeTime: '18:00', schedule: [] }
    expect(resolveHours(config, 2)).toEqual({ openTime: '06:00', closeTime: '18:00' })
  })

  it('falls back when schedule is null', () => {
    const config = { openTime: '06:00', closeTime: '18:00', schedule: null }
    expect(resolveHours(config, 3)).toEqual({ openTime: '06:00', closeTime: '18:00' })
  })
})
```

**Verify**

- [ ] All resolver tests pass
- [ ] Both functions are pure — no DB, no side effects

---

### Task 1.3 — Club + course API

**What to build**

```
POST   /api/platform/clubs                          platform_admin
GET    /api/platform/clubs                          platform_admin (paginated)
GET    /api/clubs/:clubId/config                    club_admin | staff
POST   /api/clubs/:clubId/config                    club_admin  ← creates new versioned config row
GET    /api/clubs/:clubId/courses                   club_admin | staff
POST   /api/clubs/:clubId/courses                   club_admin
PATCH  /api/clubs/:clubId/courses/:courseId         club_admin
```

`POST /api/platform/clubs` — creates club + initial `club_config` in a single Drizzle transaction.

`POST /api/clubs/:clubId/config` — does NOT update the existing row. Inserts a new `club_config` row with a new `effective_from`. Validates that `effective_from` is not before the current latest config's `effective_from`.

**RED first**

```ts
it('creates club with initial versioned config', async () => {
  const res = await api.post('/api/platform/clubs')
    .set('Authorization', `Bearer ${platformAdminToken}`)
    .send({ name: 'Pine Valley', slug: 'pine-valley', timezone: 'America/Chicago' })
  expect(res.status).toBe(201)

  const configs = await db.query.clubConfig.findMany({ where: eq(clubConfig.clubId, res.body.id) })
  expect(configs.length).toBe(1)
  expect(configs[0].slotIntervalMinutes).toBe(10)
})

it('adding new config creates a new row, not an update', async () => {
  const before = await getConfigCount(clubId)
  await api.post(`/api/clubs/${clubId}/config`)
    .set('Authorization', `Bearer ${clubAdminToken}`)
    .send({ ...validConfig, effectiveFrom: '2025-09-01' })
  const after = await getConfigCount(clubId)
  expect(after).toBe(before + 1)
})

it('rejects new config with effective_from in the past', async () => {
  const res = await api.post(`/api/clubs/${clubId}/config`)
    .set('Authorization', `Bearer ${clubAdminToken}`)
    .send({ ...validConfig, effectiveFrom: '2020-01-01' })
  expect(res.status).toBe(400)
})
```

**Verify**

- [ ] All route tests pass
- [ ] Config changes create new rows — existing rows never mutated
- [ ] Slug uniqueness enforced at DB level
- [ ] Cross-club access returns 403

---

### Task 1.4 — Tee slot generator (pure function)

**What to build**

`apps/api/src/lib/slotGenerator.ts` — pure function, zero DB calls.

```ts
type SlotConfig = {
  openTime: string            // resolved by resolveHours() for the specific day
  closeTime: string
  slotIntervalMinutes: number
  timezone: string
}

export function generateSlots(config: SlotConfig, localDate: string): GeneratedSlot[]
```

The caller (tee sheet route) is responsible for calling `resolveConfig()` then `resolveHours()` before passing into `generateSlots()`. The generator itself knows nothing about versioning or schedules — it just takes open/close times and steps through them.

**RED first**

```ts
it('generates 60 slots for a 07:00–17:00 10-min day', () => {
  const slots = generateSlots({ openTime: '07:00', closeTime: '17:00', slotIntervalMinutes: 10, timezone: 'America/New_York' }, '2025-06-15')
  expect(slots.length).toBe(60)
})

it('first slot converts 07:00 ET to UTC correctly', () => {
  const slots = generateSlots({ openTime: '07:00', closeTime: '17:00', slotIntervalMinutes: 10, timezone: 'America/New_York' }, '2025-06-15')
  expect(slots[0].datetime.toISOString()).toBe('2025-06-15T11:00:00.000Z')
})

it('handles DST spring-forward boundary without throwing', () => {
  const slots = generateSlots({ openTime: '07:00', closeTime: '17:00', slotIntervalMinutes: 10, timezone: 'America/New_York' }, '2025-03-09')
  expect(slots.length).toBeGreaterThan(0)
})
```

**Verify**

- [ ] All generator tests pass including DST boundary
- [ ] Pure function — no imports of DB or Redis

---

### Task 1.5 — Tee sheet API

**What to build**

```
GET  /api/clubs/:clubId/courses/:courseId/teesheet?date=YYYY-MM-DD   club_admin | staff
POST /api/clubs/:clubId/teesheet/block                                club_admin | staff
```

`GET` logic:
1. Load all `club_config` rows for the club, call `resolveConfig(configs, targetDate)`
2. Call `resolveHours(config, dayOfWeek)` for the target date's day of week
3. `generateSlots(resolvedHours, date)` → full grid
4. Query `tee_slots` from DB for that `courseId` + date range
5. Merge: overlay DB rows by matching `datetime` UTC equality
6. Return sorted by datetime

**RED first**

```ts
it('returns full day grid respecting weekend schedule override', async () => {
  // Pinebrook has 05:30 open on Sunday — seed provides this
  const sunday = nextSunday(new Date())
  const res = await api
    .get(`/api/clubs/${clubId}/courses/${courseId}/teesheet?date=${format(sunday, 'yyyy-MM-dd')}`)
    .set('Authorization', `Bearer ${staffToken}`)
  expect(res.status).toBe(200)
  // First slot should be 05:30 ET, not 06:00
  expect(res.body[0].datetime).toContain('T09:30:00') // 05:30 ET = 09:30 UTC
})

it('overlays blocked slot onto the grid', async () => { ... })
it('missing date param returns 400', async () => { ... })
```

**Verify**

- [ ] Weekend schedule override reflected in tee sheet
- [ ] Blocked slots appear with `status: 'blocked'`
- [ ] Staff from another club returns 403

---

### Task 1.6 — Booking ref generator

**What to build**

`apps/api/src/lib/bookingRef.ts`:

```ts
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no I/O/1/0 — avoids confusion in phone/print

export function generateBookingRef(clubSlug: string): string {
  // Returns e.g. 'PINE-A3F9K2'
  // clubSlug uppercased + hyphen + 6 random chars from CHARSET
}

export async function generateUniqueBookingRef(clubSlug: string, db: DrizzleDB): Promise<string> {
  // Retries up to 5 times on unique violation
  // Throws if still colliding after 5 attempts (astronomically unlikely)
}
```

**RED first**

```ts
it('generates ref with correct format', () => {
  const ref = generateBookingRef('pine-valley')
  expect(ref).toMatch(/^PINE-[A-Z2-9]{6}$/)
})

it('long slug is truncated to first 4 chars', () => {
  const ref = generateBookingRef('championship-course')
  expect(ref).toMatch(/^CHAM-[A-Z2-9]{6}$/)
})

it('generates unique refs across 10000 calls', () => {
  const refs = new Set(Array.from({ length: 10_000 }, () => generateBookingRef('test')))
  expect(refs.size).toBeGreaterThan(9990)  // collision rate < 0.1%
})
```

**Verify**

- [ ] All ref tests pass
- [ ] Format is human-readable — no lowercase, no confusable chars

---

### Task 1.7 — Manual booking (staff)

**What to build**

`POST /api/bookings` — staff-only.

Single Drizzle transaction:
1. Atomic `UPDATE tee_slots SET booked_players = booked_players + :count WHERE ... RETURNING *`
2. If 0 rows → 409 `SLOT_FULL`
3. `booking_ref = await generateUniqueBookingRef(clubSlug, db)`
4. `INSERT INTO bookings` (with `booking_ref`)
5. `INSERT INTO booking_players`
6. `invalidateAvailabilityCache(clubId, courseId, slotDate)` — after commit
7. Enqueue `email:booking-confirmation`

**RED first**

```ts
it('creates booking with a unique readable ref', async () => {
  const res = await api.post('/api/bookings')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ teeSlotId, playersCount: 2, guestName: 'Jane', guestEmail: 'jane@example.com' })
  expect(res.status).toBe(201)
  expect(res.body.bookingRef).toMatch(/^[A-Z]+-[A-Z2-9]{6}$/)
})

it('invalidates availability cache after booking', async () => {
  await setCachedAvailability(clubId, courseId, slotDate, [mockSlot])
  await api.post('/api/bookings').set('Authorization', `Bearer ${staffToken}`).send({ ... })
  const cached = await getCachedAvailability(clubId, courseId, slotDate)
  expect(cached).toBeNull()
})

it('concurrent bookings never overbook', async () => {
  const [r1, r2] = await Promise.all([
    api.post('/api/bookings').set('Authorization', `Bearer ${staffToken}`).send({ teeSlotId, playersCount: 2, ... }),
    api.post('/api/bookings').set('Authorization', `Bearer ${staffToken}`).send({ teeSlotId, playersCount: 2, ... }),
  ])
  expect([r1.status, r2.status].sort()).toEqual([201, 409])
  const slot = await getSlot(teeSlotId)
  expect(slot.bookedPlayers).toBeLessThanOrEqual(slot.maxPlayers)
})
```

**Verify**

- [ ] All booking tests pass including concurrency
- [ ] `booking_ref` present and readable in response
- [ ] Cache invalidated after booking
- [ ] Email job enqueued

---

### Task 1.8 — Player check-in

**What to build**

`PATCH /api/bookings/:bookingId/players/:playerId`

Body: `{ checkedIn?: boolean, noShow?: boolean }`

Staff-only. Validates booking belongs to staff's club (chain: `booking_players → bookings → tee_slots → courses → clubs`).

**RED first**

```ts
it('marks player as checked in', async () => { ... })
it('cross-club staff returns 403', async () => { ... })
it('checkedIn and noShow are independent booleans', async () => { ... })
```

**Verify**

- [ ] All check-in tests pass
- [ ] Cross-club access returns 403

---

### Task 1.9 — Failed job logger

**What to build**

In `apps/api/src/workers/emailWorker.ts`, add a `failed` event listener on the BullMQ worker:

```ts
worker.on('failed', async (job, error) => {
  if (!job) return
  await db.insert(failedJobs).values({
    jobName: job.name,
    jobData: job.data,
    error: error.message,
  }).catch(console.error)  // never throw from error handler
})
```

**RED first**

```ts
it('writes to failed_jobs table when a job exhausts retries', async () => {
  // Mock Resend to always throw
  jest.spyOn(resend.emails, 'send').mockRejectedValue(new Error('Resend unavailable'))

  // Add a job and let it exhaust retries (configure attempts: 1 for test speed)
  await emailQueue.add('email:booking-confirmation', { to: 'x@x.com', ... }, { attempts: 1 })
  await waitForQueueDrain(emailQueue)

  const failures = await db.query.failedJobs.findMany()
  expect(failures.length).toBeGreaterThan(0)
  expect(failures[0].jobName).toBe('email:booking-confirmation')
  expect(failures[0].error).toContain('Resend unavailable')
})
```

**Verify**

- [ ] Failed job test passes
- [ ] `failed_jobs` table queryable: `psql $DATABASE_URL -c 'SELECT * FROM failed_jobs LIMIT 5'`
- [ ] Worker does not crash when `failed_jobs` insert itself fails (catch is in place)

---

### Task 1.10 — Staff account invite

**What to build**

```
POST /api/clubs/:clubId/staff/invite    club_admin
POST /api/auth/set-password             public (signed JWT token)
```

- Existing user → add `user_roles` row only
- New user → create with `password_hash = null`, enqueue invite email
- Set-password → verify signed JWT, bcrypt hash, set `password_hash`

**RED first**

```ts
it('adds role to existing user', async () => { ... })
it('creates new user for unknown email', async () => { ... })
it('set-password with expired token returns 400', async () => { ... })
```

**Verify**

- [ ] All invite tests pass
- [ ] Invite email job enqueued
- [ ] Expired token correctly rejected

---

## Phase 2 — Golfer Booking

> Goal: full OpenTable-style public booking experience. Four screens, no account required. A golfer arriving at the club URL should be booked within 60 seconds.

### The four screens

| Screen | Route | Purpose |
|---|---|---|
| 1. Club profile | `/book/[slug]` | Club identity, quick-pick time pills, course info, hours |
| 2. Tee time picker | `/book/[slug]/times` | Date bar, soonest pills, full slot list by morning/afternoon |
| 3. Confirm sheet | `/book/[slug]/confirm` | Summary, cancellation policy, name/email/notes, Reserve button |
| 4. Success | `/book/[slug]/success` | Booking card with ref, account creation prompt, cancel link |

**Design rules for all golfer-facing screens:**
- Mobile-first, 390px base width
- All times in club's configured timezone — never UTC
- Players selector persists across screens — changing it re-filters instantly
- Full slots shown faded, not hidden
- 409 SLOT_FULL returns to Screen 2 with inline error banner, form data preserved
- No login wall in the booking flow

---

### Task 2.1 — Availability API (public)

**What to build**

`GET /api/clubs/:clubId/availability?date=YYYY-MM-DD&courseId=...&players=2`

No auth. Apply `publicRateLimit`.

Logic:
1. Check Redis cache (`getCachedAvailability`) — return immediately on hit
2. Resolve config for date using `resolveConfig` + `resolveHours`
3. `generateSlots(resolvedConfig, date)`
4. Query `tee_slots` from DB for courseId + date range
5. Merge and filter: `status = 'open'` AND `booked_players + players <= max_players` AND `datetime > now()`
6. `setCachedAvailability(...)` — cache the filtered result
7. Return

**RED first**

```ts
it('returns available slots for party of 2', async () => {
  const res = await api.get(`/api/clubs/${clubId}/availability`).query({ date: futureDate, courseId, players: 2 })
  expect(res.status).toBe(200)
  res.body.forEach(s => expect(s.maxPlayers - s.bookedPlayers).toBeGreaterThanOrEqual(2))
})

it('serves from cache on second call', async () => {
  await api.get(`/api/clubs/${clubId}/availability`).query({ date: futureDate, courseId, players: 2 })
  const spy = jest.spyOn(db, 'select')
  await api.get(`/api/clubs/${clubId}/availability`).query({ date: futureDate, courseId, players: 2 })
  expect(spy).not.toHaveBeenCalled()
})

it('Championship course returns zero available slots', async () => {
  const res = await api.get(`/api/clubs/${clubId}/availability`).query({ date: today, courseId: championshipId, players: 1 })
  expect(res.body.length).toBe(0)
})

it('Pines course returns no morning slots, only afternoon', async () => {
  const res = await api.get(`/api/clubs/${clubId}/availability`).query({ date: today, courseId: pinesId, players: 1 })
  res.body.forEach(s => {
    const hour = new Date(s.datetime).getUTCHours()
    expect(hour).toBeGreaterThanOrEqual(14)  // after 10am ET
  })
})
```

**Verify**

- [ ] All availability tests pass including the four course density tests
- [ ] Cache hit confirmed — second call does not query DB
- [ ] Cache is invalidated after a booking is made for that date
- [ ] Unauthenticated request returns 200

---

### Task 2.2 — Public booking endpoint

**What to build**

`POST /api/bookings/public` — no auth. Apply `bookingRateLimit`.

Same atomic transaction as Task 1.7 plus:
- `notes` saved from request body
- `booking_ref` generated via `generateUniqueBookingRef`
- Cache invalidated after commit
- Enqueue `email:booking-confirmation` (immediate)
- Enqueue `email:booking-reminder` (delayed: `teeTime - 24h - now()`, skip if < 1h away)
- Response includes `bookingRef` field

**RED first**

```ts
it('guest books without account', async () => {
  const res = await api.post('/api/bookings/public').send({ teeSlotId, playersCount: 1, guestName: 'Bob', guestEmail: 'bob@example.com' })
  expect(res.status).toBe(201)
  expect(res.body.bookingRef).toMatch(/^[A-Z]+-[A-Z2-9]{6}$/)
})

it('saves special request notes', async () => {
  const res = await api.post('/api/bookings/public').send({ teeSlotId, playersCount: 1, guestName: 'X', guestEmail: 'x@x.com', notes: 'Left-handed clubs please' })
  const booking = await db.query.bookings.findFirst({ where: eq(bookings.id, res.body.id) })
  expect(booking?.notes).toBe('Left-handed clubs please')
})

it('enqueues both confirmation and reminder jobs', async () => { ... })
it('concurrent bookings never overbook', async () => { ... })
```

**Verify**

- [ ] All public booking tests pass
- [ ] `bookingRef` in response is human-readable
- [ ] `notes` persisted correctly
- [ ] Cache invalidated after booking

---

### Task 2.3 — Cancellation

**What to build**

`DELETE /api/bookings/:bookingId` — staff JWT or signed guest token (from email link).

`apps/api/src/lib/cancellation.ts`:

```ts
export function isCancellable(slotDatetime: Date, cancellationHours: number): boolean {
  return differenceInHours(slotDatetime, new Date()) >= cancellationHours
}
```

On cancellation:
1. Load booking + tee_slot + resolve club_config for slot date
2. If golfer-initiated and `!isCancellable(...)` → 403 with `{ code: 'OUTSIDE_WINDOW', hoursRequired: N }`
3. Set `status = 'cancelled'`, `deleted_at = now()`
4. Atomic decrement `booked_players`
5. `invalidateAvailabilityCache` for the slot date
6. Enqueue `email:booking-cancellation`

**RED first**

```ts
describe('isCancellable', () => {
  it('true when outside window', () => { expect(isCancellable(addHours(new Date(), 48), 24)).toBe(true) })
  it('false when inside window', () => { expect(isCancellable(addHours(new Date(), 12), 24)).toBe(false) })
})

it('staff cancels and capacity is restored', async () => { ... })
it('golfer blocked inside window — gets OUTSIDE_WINDOW code', async () => {
  const res = await api.delete(`/api/bookings/${bookingId}`).set('Authorization', `Bearer ${golferToken}`)
  expect(res.status).toBe(403)
  expect(res.body.code).toBe('OUTSIDE_WINDOW')
})
it('staff can cancel inside window', async () => { ... })
it('booking has deleted_at set after cancel', async () => { ... })
it('cache invalidated after cancel', async () => { ... })
```

**Verify**

- [ ] All cancellation tests pass
- [ ] `booked_players` decremented correctly
- [ ] Soft delete — row still in DB with `deleted_at` set
- [ ] Cache invalidated after cancel
- [ ] Cancellation email job enqueued

---

### Task 2.4 — Email worker

**What to build**

`apps/api/src/workers/emailWorker.ts` — BullMQ worker, `attempts: 3, backoff: { type: 'exponential', delay: 2000 }`.

`apps/api/src/emails/`:
- `BookingConfirmation.tsx` — club name, tee time (club tz), players, notes if present, `booking_ref`, cancel link
- `BookingReminder.tsx` — same + "manage booking" CTA
- `BookingCancellation.tsx` — confirmation of cancellation

Cancel link in emails: signed URL `GET /api/bookings/:bookingId/cancel-token` → generates a short-lived (48h) signed JWT, passed as query param to the confirm-cancel page.

`failed` event handler writes to `failed_jobs` table (Task 1.9).

**RED first**

```ts
it('sends confirmation email with booking ref and cancel link', async () => {
  const mockSend = jest.spyOn(resend.emails, 'send').mockResolvedValue({ id: 'mock', error: null })
  await processJob({ name: 'email:booking-confirmation', data: { bookingId, clubName: 'Pinebrook', ... } })
  expect(mockSend).toHaveBeenCalledOnce()
  const html = mockSend.mock.calls[0][0].html
  expect(html).toContain('PINE-')    // booking ref present
  expect(html).toContain('cancel')   // cancel link present
})
```

**Verify**

- [ ] Worker tests pass
- [ ] BullMQ retry config confirmed: `attempts: 3, backoff: exponential`
- [ ] `failed_jobs` written on exhaustion
- [ ] No real emails sent in test environment

---

### Task 2.5 — Club profile API (public)

**What to build**

`GET /api/clubs/public/:slug` — no auth. Apply `publicRateLimit`.

Returns club profile for Screen 1. Resolves current config with `resolveConfig(configs, today)`.

Response shape:
```ts
{
  id, name, slug, description, heroImageUrl, primaryColor,
  courses: [{ id, name, holes }],
  config: {
    slotIntervalMinutes, bookingWindowDays, cancellationHours,
    openTime, closeTime, schedule, timezone
  }
}
```

Does NOT return: `bookingFee`, `subscriptionType`, `status`, any billing fields.

Suspended clubs → 404.

**RED first**

```ts
it('returns club profile without billing fields', async () => {
  const res = await api.get('/api/clubs/public/pinebrook')
  expect(res.status).toBe(200)
  expect(res.body.name).toBe('Pinebrook Golf Club')
  expect(res.body.courses.length).toBe(4)  // all four seed courses
  expect(res.body).not.toHaveProperty('bookingFee')
  expect(res.body).not.toHaveProperty('subscriptionType')
})

it('suspended club returns 404', async () => {
  await suspendClub(clubId)
  const res = await api.get('/api/clubs/public/pinebrook')
  expect(res.status).toBe(404)
})

it('config resolves correctly for today', async () => {
  const res = await api.get('/api/clubs/public/pinebrook')
  expect(res.body.config.schedule).toBeInstanceOf(Array)
  expect(res.body.config.slotIntervalMinutes).toBe(10)
})
```

**Verify**

- [ ] Profile returns four courses (seed verification)
- [ ] No billing data exposed
- [ ] Suspended club returns 404
- [ ] Config is resolved (not raw array) — single effective config for today

---

### Task 2.6 — Club profile page (Screen 1)

**What to build**

`apps/web/app/book/[slug]/page.tsx`

Fetches from `GET /api/clubs/public/:slug` on load. Also fetches `GET /api/clubs/:clubId/availability` for today to populate the soonest-available pills.

**Layout (top to bottom):**
1. Hero image (club photo or green gradient fallback)
2. Quick-facts strip: holes, yards, par, hours (from resolved config)
3. Players selector (1–4)
4. Quick-pick pills: next 5 available slots for today. Tapping a pill goes directly to Screen 3
5. "See all tee times →" pill — goes to Screen 2
6. About section (`club.description`)
7. Hours block (weekday + weekend from `schedule`, club timezone)
8. "Book a tee time" CTA → Screen 2

**RED first**

```ts
it('renders four courses in the course selector', async () => {
  server.use(http.get('/api/clubs/public/pinebrook', () => HttpResponse.json(mockClubWithFourCourses)))
  render(<ClubProfilePage params={{ slug: 'pinebrook' }} />)
  expect(await screen.findByText('The Championship')).toBeInTheDocument()
  expect(screen.getByText('The Meadows')).toBeInTheDocument()
  expect(screen.getByText('The Pines')).toBeInTheDocument()
  expect(screen.getByText('The Lakes')).toBeInTheDocument()
})

it('quick-pick pills show zero pills for Championship (fully booked)', async () => {
  server.use(http.get('/api/clubs/*/availability', () => HttpResponse.json([])))
  render(<ClubProfilePage params={{ slug: 'pinebrook' }} />)
  await screen.findByText('The Championship')
  // Select Championship course
  expect(screen.queryByTestId('time-pill')).not.toBeInTheDocument()
  expect(screen.getByText(/no times available/i)).toBeInTheDocument()
})
```

**Verify**

- [ ] All four seed courses visible in course selector
- [ ] Championship shows "no times available" — no pills rendered
- [ ] Meadows shows up to 5 pills immediately
- [ ] Players selector state carries to Screen 2
- [ ] Mobile layout correct at 390px viewport

---

### Task 2.7 — Tee time picker (Screen 2)

**What to build**

`apps/web/app/book/[slug]/times/page.tsx`

**Layout:**
1. Nav bar (back to Screen 1)
2. Players selector
3. Date bar — 7 day chips, today pre-selected
4. Course selector (if club has multiple courses)
5. "Soonest available" pills — top 5 slots for selected date/course/players
6. Full slot list — Morning / Afternoon sections. Each row: time, pip dots (green = open, grey = taken), spots label, price. Faded rows = full for current party size.

Changing date re-fetches availability. Changing players re-filters client-side from cached response (no re-fetch). Tapping any slot (pill or row) → Screen 3.

**RED first**

```ts
it('shows soonest pills for Meadows but not Championship', async () => {
  // Meadows has availability, Championship does not
  // Select Meadows → pills appear; select Championship → pills empty
})

it('fades slots where party size exceeds remaining spots', async () => {
  // Slot with 1 spot left, party of 2 → faded + non-tappable
})

it('re-filters without re-fetching when player count changes', async () => {
  const spy = jest.spyOn(global, 'fetch')
  render(<TimesPage ... />)
  // Change player count
  fireEvent.click(screen.getByText('+'))
  // fetch should not be called again
  expect(spy).toHaveBeenCalledTimes(1)  // only the initial load
})
```

**Verify**

- [ ] UI tests pass
- [ ] Championship course: all slots faded, no soonest pills
- [ ] Pines course: morning slots faded, afternoon pills/rows available
- [ ] Lakes course: pip dots render at all fill levels (0–4)
- [ ] Changing players re-filters without network call

---

### Task 2.8 — Confirm sheet (Screen 3)

**What to build**

`apps/web/app/book/[slug]/confirm/page.tsx` — bottom sheet over dimmed Screen 2.

**Sheet contents:**
1. Drag handle
2. Club name + summary line: `2 players · Today · 7:00 AM · $65/player`
3. Cancellation policy block (from `config.cancellationHours`): "Free cancellation up to N hours before your tee time."
4. Name field (required), Email field (required), Special requests textarea (optional, 500 char max)
5. "Reserve tee time" button — disabled + loading spinner on submit
6. "Back to tee times" text link

On submit:
1. Disable button immediately (prevents double-submit)
2. `POST /api/bookings/public`
3. 201 → Screen 4
4. 409 `SLOT_FULL` → close sheet, show error banner on Screen 2: "That slot just filled — please choose another time"
5. Other error → inline error in sheet, form data intact, button re-enabled

**RED first**

```ts
it('shows correct cancellation hours from config', async () => {
  render(<ConfirmSheet slot={mockSlot} config={{ cancellationHours: 24, ... }} />)
  expect(screen.getByText(/24 hours/i)).toBeInTheDocument()
})

it('disables button during submission', async () => {
  server.use(http.post('/api/bookings/public', async () => { await delay(500); return HttpResponse.json({}) }))
  render(<ConfirmSheet ... />)
  fireEvent.click(screen.getByText('Reserve tee time'))
  expect(screen.getByRole('button', { name: /reserve/i })).toBeDisabled()
})

it('shows SLOT_FULL error and returns to Screen 2', async () => {
  server.use(http.post('/api/bookings/public', () => HttpResponse.json({ code: 'SLOT_FULL' }, { status: 409 })))
  // submit, expect navigation back + error banner
  expect(await screen.findByText(/just filled/i)).toBeInTheDocument()
})
```

**Verify**

- [ ] All confirm sheet tests pass
- [ ] Double-submit impossible — button disabled on first tap
- [ ] 409 → returns to Screen 2 with inline error, no data lost
- [ ] Notes field enforces 500 char max client-side

---

### Task 2.9 — Success screen (Screen 4)

**What to build**

`apps/web/app/book/[slug]/success/page.tsx`

**Layout:**
1. Green checkmark icon
2. "You're booked" heading
3. "Confirmation sent to [email]. We'll remind you 24 hours before."
4. Booking summary card: Club, Date (club timezone), Time (club timezone), Players, Ref (`PINE-A3F9K2`)
5. Soft account creation prompt (secondary style — not a CTA)
6. "Cancel this booking" small text link

Navigating back from this page → Screen 1.

**RED first**

```ts
it('displays tee time in club timezone not UTC', async () => {
  // datetime: 2025-06-15T11:00:00Z, timezone: America/New_York
  render(<SuccessPage booking={{ ...mock, teeTime: '2025-06-15T11:00:00Z' }} club={{ timezone: 'America/New_York' }} />)
  expect(screen.getByText('7:00 AM')).toBeInTheDocument()
  expect(screen.queryByText('11:00 AM')).not.toBeInTheDocument()
})

it('shows booking ref in readable format', async () => {
  render(<SuccessPage booking={{ ...mock, bookingRef: 'PINE-A3F9K2' }} ... />)
  expect(screen.getByText('PINE-A3F9K2')).toBeInTheDocument()
})
```

**Verify**

- [ ] Time in club timezone — never UTC
- [ ] Booking ref visible and correctly formatted
- [ ] Account creation prompt present but secondary
- [ ] Back navigation goes to Screen 1

---

## Phase 3 — Platform Admin

> Goal: internal ops panel. Minimal UI. Platform admin can provision clubs and see system health.

---

### Task 3.1 — Platform stats + club management API

**What to build**

```
GET   /api/platform/stats             platform_admin
GET   /api/platform/clubs             platform_admin (paginated)
PATCH /api/platform/clubs/:clubId     platform_admin (status only)
```

Stats:
```json
{ "totalClubs": 4, "activeClubs": 3, "totalBookingsToday": 47, "totalBookingsThisMonth": 312 }
```

**RED first**

```ts
it('returns stats reflecting seeded data', async () => {
  const res = await api.get('/api/platform/stats').set('Authorization', `Bearer ${platformAdminToken}`)
  expect(res.body.totalClubs).toBeGreaterThanOrEqual(1)
})

it('suspending club causes public profile to return 404', async () => {
  await api.patch(`/api/platform/clubs/${clubId}`).set('Authorization', `Bearer ${platformAdminToken}`).send({ status: 'suspended' })
  const res = await api.get('/api/clubs/public/pinebrook')
  expect(res.status).toBe(404)
})
```

**Verify**

- [ ] Stats tests pass
- [ ] Suspend/activate correctly blocks/restores public access
- [ ] Staff cannot access platform stats (403)

---

### Task 3.2 — Platform admin UI

**What to build**

`apps/web/app/(platform)/` — protected by `platform_admin` role check in Next.js middleware.

- `clubs/page.tsx` — table: name, slug, status badge, courses count, created date
- `clubs/new/page.tsx` — create club form
- `clubs/[clubId]/page.tsx` — club detail: config history, courses, staff list, suspend toggle

**Verify**

- [ ] Non-platform_admin redirected to login
- [ ] Slug validated client-side before submit
- [ ] Suspended club has visually distinct badge
- [ ] Config history shows all versioned rows in date order

---

## v1.1 — Revenue layer

> Start only after anchor client is live and actively using the system.

- **Stripe payments**: `POST /api/bookings/public` returns `clientSecret`. Booking status `pending_payment` until webhook. Slot held 10 min — BullMQ job releases on timeout. Only trust `payment_intent.succeeded` webhook.
- **Member gating**: CSV import of member emails, priority booking window, invite-code registration.
- **Embed widget**: `/embed/:clubSlug` — minimal page, iframe-safe, configurable allowed origins.
- **Waitlist**: join waitlist for full slot, BullMQ notifies on cancellation, 2h claim window.
- **SMS reminders**: Twilio opt-in during booking, 24h + 2h reminders.
- **Platform billing**: monthly invoice records, manual Stripe Invoice API charges.
- **Failed jobs dashboard**: query `failed_jobs` table from platform admin panel.

---

## v2 — Scale

> Only after multiple paying clubs and validated PMF.

- Marketplace: browse clubs by location
- AI features: recommendations + group pairing (needs real usage data first)
- Dynamic pricing: peak/off-peak yield management
- Stripe Connect: direct club payouts
- Native mobile: Expo wrapper initially
- Tournaments: shotgun starts, draws (separate product module)

---

## File reference

```
apps/
  web/
    app/
      (auth)/                   login, register, set-password
      (platform)/               platform admin panel
      (club)/                   club admin + staff dashboard
      book/[slug]/              Screen 1: club profile
      book/[slug]/times/        Screen 2: tee time picker
      book/[slug]/confirm/      Screen 3: confirm sheet
      book/[slug]/success/      Screen 4: success
      account/bookings/         golfer booking history
    components/
      teesheet/                 TeeSheet, SlotCard, BookingDrawer
      booking/                  TimePickerScreen, ConfirmSheet, SuccessPage
      ui/                       shadcn/ui re-exports

  api/
    src/
      routes/
        platform.ts
        clubs.ts
        courses.ts
        teeSlots.ts             teesheet + availability
        bookings.ts             staff + public endpoints
      middleware/
        auth.ts                 authenticate, requireRole, requireClubRole
        rateLimit.ts            publicRateLimit, bookingRateLimit
        validate.ts             Zod middleware wrapper
      workers/
        emailWorker.ts          BullMQ consumer + failed event handler
      emails/
        BookingConfirmation.tsx
        BookingReminder.tsx
        BookingCancellation.tsx
      lib/
        slotGenerator.ts        pure function
        configResolver.ts       resolveConfig, resolveHours — pure functions
        cancellation.ts         isCancellable — pure function
        bookingRef.ts           generateBookingRef, generateUniqueBookingRef
        availabilityCache.ts    getCached, setCached, invalidate — Redis
        redis.ts                shared ioredis client singleton
        queue.ts                BullMQ queue instances

packages/
  db/
    src/
      schema/
        users.ts
        clubs.ts
        bookings.ts
        observability.ts        failedJobs table
      index.ts
      seed.ts                   base users + club + config
      seedBookings.ts           four courses with density patterns
    drizzle.config.ts
  types/
    src/index.ts
  validators/
    src/
      clubs.ts                  CreateClubSchema, ClubConfigSchema, ScheduleDaySchema
      courses.ts
      bookings.ts
```

---

## pnpm scripts

```json
{
  "seed": "tsx packages/db/src/seed.ts",
  "seed:bookings": "tsx packages/db/src/seedBookings.ts",
  "seed:reset": "pnpm seed && pnpm seed:bookings"
}
```

`pnpm seed:reset` wipes booking density data and re-seeds from scratch — useful during development when you need a clean known state.
