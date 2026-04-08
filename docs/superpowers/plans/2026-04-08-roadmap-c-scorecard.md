# Roadmap C + Scorecard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add golfer profile, calendar export, hole-by-hole scorecards, club scorecard reports, booking modification, reminder opt-out, and automated no-show detection to the TeeTimes platform.

**Architecture:** All schema changes land in one Drizzle migration; each subsequent task is self-contained. The API follows existing Express Router patterns with Zod validators in `packages/validators/src/`. The frontend follows the existing Next.js App Router pattern: server page fetches data, client component owns interactivity.

**Tech Stack:** Drizzle ORM (PostgreSQL), Express.js, Next.js 14 App Router, BullMQ (Redis), `ical-generator` (client-side), Zod, Tailwind CSS, Radix UI Dialog, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-08-roadmap-c-scorecard-design.md`

---

## File Map

New files:
- `packages/db/src/schema/scorecards.ts` — `courseHoles`, `roundScorecards`, `roundScorecardHoles` tables + relations
- `packages/validators/src/scorecards.ts` — Zod schemas for scorecard API inputs
- `packages/validators/src/profile.ts` — Zod schema for `PATCH /api/me/profile`
- `apps/api/src/routes/courseHoles.ts` — GET course holes handler (mounted in app.ts)
- `apps/api/src/routes/scorecards.ts` — me scorecard routes (`POST /api/me/scorecards`, `GET /api/me/scorecards`)
- `apps/api/src/workers/bookingWorker.ts` — BullMQ worker for `"booking"` queue
- `apps/web/app/(golfer)/account/page.tsx` — golfer account server page
- `apps/web/app/(golfer)/account/AccountClient.tsx` — profile form + scorecard history
- `apps/web/components/booking/DownloadCalendarButton.tsx` — client calendar export
- `apps/web/components/golfer/ScorecardEntryModal.tsx` — hole-by-hole score entry dialog
- `apps/web/components/club/CourseHolesEditor.tsx` — hole par config section for courses admin

Modified files:
- `packages/db/src/schema/clubs.ts` — add `courseHoles` table
- `packages/db/src/schema/users.ts` — add `phone` + `notification_prefs` columns
- `packages/db/src/schema/index.ts` — export scorecards schema
- `packages/validators/src/index.ts` — export new validator files
- `apps/api/src/app.ts` — mount GET holes + scorecard routes
- `apps/api/src/routes/me.ts` — add `GET/PATCH /api/me/profile`, `GET /api/me/scorecards`
- `apps/api/src/routes/clubs.ts` — add `GET /reports/scorecards`
- `apps/api/src/routes/clubResources.ts` — add `PUT /courses/:courseId/holes`
- `apps/api/src/routes/bookingOperations.ts` — extend PATCH for `playersCount` + golfer auth; enqueue no-show job
- `apps/api/src/routes/publicClub.ts` — enqueue no-show job in both confirmation paths
- `apps/api/src/lib/queue.ts` — add `getBookingQueue()` + `enqueueBookingJob()`
- `apps/api/src/workers/emailWorker.ts` — fix `sendReminderEmail` user email lookup + opt-out
- `apps/api/src/index.ts` — start booking worker
- `apps/api/src/__tests__/publicApiInvariants.test.ts` — add new route invariant tests
- `apps/web/app/book/[slug]/success/page.tsx` — add `DownloadCalendarButton`
- `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx` — add calendar + Log Score buttons
- `apps/web/app/(club)/club/[clubId]/courses/CoursesClient.tsx` — add `CourseHolesEditor`
- `apps/web/app/(club)/club/[clubId]/reports/ReportsClient.tsx` — add scorecard tab

---

## Task 1: DB Schema Migrations

**Files:**
- Create: `packages/db/src/schema/scorecards.ts`
- Modify: `packages/db/src/schema/clubs.ts`
- Modify: `packages/db/src/schema/users.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Add `courseHoles` to `packages/db/src/schema/clubs.ts`**

Add after the `courses` table definition (around line 48). Add `unique` to the existing imports:

```typescript
// At top of file, add `unique` to pg-core imports if not already there
import { ..., unique } from "drizzle-orm/pg-core";

export const courseHoles = pgTable(
  "course_holes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    holeNumber: integer("hole_number").notNull(),
    par: integer("par").notNull(),
    handicapIndex: integer("handicap_index"),
    yardage: integer("yardage"),
  },
  (table) => [unique().on(table.courseId, table.holeNumber)]
);

export const courseHolesRelations = relations(courseHoles, ({ one }) => ({
  course: one(courses, { fields: [courseHoles.courseId], references: [courses.id] }),
}));
```

Also extend `coursesRelations` to include `holes`:
```typescript
export const coursesRelations = relations(courses, ({ one, many }) => ({
  club: one(clubs, { fields: [courses.clubId], references: [clubs.id] }),
  holes: many(courseHoles),
}));
```

- [ ] **Step 2: Add `phone` and `notification_prefs` to `packages/db/src/schema/users.ts`**

Add `jsonb` to the pg-core imports, then add two columns to the `users` table after `name`:

```typescript
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// Inside users pgTable definition, after `name`:
phone: text("phone"),
notificationPrefs: jsonb("notification_prefs"),
```

- [ ] **Step 3: Create `packages/db/src/schema/scorecards.ts`**

```typescript
import {
  pgTable,
  uuid,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { bookings } from "./bookings";
import { users } from "./users";
import { courses } from "./clubs";

export const roundScorecards = pgTable("round_scorecards", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .references(() => bookings.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  courseId: uuid("course_id").references(() => courses.id, {
    onDelete: "set null",
  }),
  totalScore: integer("total_score").notNull(),
  completedHoles: integer("completed_holes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const roundScorecardHoles = pgTable(
  "round_scorecard_holes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scorecardId: uuid("scorecard_id")
      .references(() => roundScorecards.id, { onDelete: "cascade" })
      .notNull(),
    holeNumber: integer("hole_number").notNull(),
    score: integer("score").notNull(),
  },
  (table) => [unique().on(table.scorecardId, table.holeNumber)]
);

export const roundScorecardsRelations = relations(
  roundScorecards,
  ({ one, many }) => ({
    booking: one(bookings, {
      fields: [roundScorecards.bookingId],
      references: [bookings.id],
    }),
    user: one(users, {
      fields: [roundScorecards.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [roundScorecards.courseId],
      references: [courses.id],
    }),
    holes: many(roundScorecardHoles),
  })
);

export const roundScorecardHolesRelations = relations(
  roundScorecardHoles,
  ({ one }) => ({
    scorecard: one(roundScorecards, {
      fields: [roundScorecardHoles.scorecardId],
      references: [roundScorecards.id],
    }),
  })
);
```

- [ ] **Step 4: Export from `packages/db/src/schema/index.ts`**

Add to the end:
```typescript
export * from "./scorecards";
```

- [ ] **Step 5: Generate the Drizzle migration**

```bash
cd /path/to/repo && pnpm db:generate
```

Expected: A new file appears in `packages/db/drizzle/` containing `CREATE TABLE course_holes`, `CREATE TABLE round_scorecards`, `CREATE TABLE round_scorecard_holes`, and `ALTER TABLE users ADD COLUMN phone`, `ALTER TABLE users ADD COLUMN notification_prefs`.

- [ ] **Step 6: Apply the migration**

```bash
pnpm db:migrate
```

Expected: `Migrations applied` (or similar). No errors.

- [ ] **Step 7: Typecheck to verify schema compiles**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/ packages/db/drizzle/
git commit -m "feat(db): add course_holes, round_scorecards, scorecard_holes tables; add phone + notification_prefs to users"
```

---

## Task 2: Golfer Profile API

**Files:**
- Create: `packages/validators/src/profile.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/routes/me.ts`
- Modify: `apps/api/src/__tests__/publicApiInvariants.test.ts`

- [ ] **Step 1: Write failing invariant test**

In `apps/api/src/__tests__/publicApiInvariants.test.ts`, add:

```typescript
it("GET /api/me/profile returns 401 without auth", async () => {
  const res = await request(app).get("/api/me/profile");
  expect(res.status).toBe(401);
});

it("PATCH /api/me/profile returns 401 without auth", async () => {
  const res = await request(app).patch("/api/me/profile").send({ name: "Test" });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && pnpm test
```

Expected: 2 new tests fail with "expected 404, got 401" or similar (route doesn't exist yet).

- [ ] **Step 3: Create `packages/validators/src/profile.ts`**

```typescript
import { z } from "zod";

export const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).nullable().optional(),
  notificationPrefs: z
    .object({ reminders: z.boolean() })
    .nullable()
    .optional(),
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
```

- [ ] **Step 4: Export from `packages/validators/src/index.ts`**

Add:
```typescript
export * from "./profile";
```

- [ ] **Step 5: Add profile routes to `apps/api/src/routes/me.ts`**

Add imports at top (alongside existing ones):
```typescript
import { db, users } from "@teetimes/db";
import { ProfileUpdateSchema } from "@teetimes/validators";
import { eq } from "drizzle-orm";
```

Add routes before `export default router`:

```typescript
router.get("/profile", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.userId),
    columns: { id: true, name: true, email: true, phone: true, notificationPrefs: true },
  });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json({
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    notificationPrefs: (user.notificationPrefs as { reminders?: boolean } | null) ?? null,
  });
});

router.patch("/profile", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { name, phone, notificationPrefs } = parsed.data;
  const updates: Partial<typeof users.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (notificationPrefs !== undefined) updates.notificationPrefs = notificationPrefs;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, auth.userId))
    .returning({ name: users.name, email: users.email, phone: users.phone, notificationPrefs: users.notificationPrefs });

  res.json({
    name: updated.name,
    email: updated.email,
    phone: updated.phone ?? null,
    notificationPrefs: (updated.notificationPrefs as { reminders?: boolean } | null) ?? null,
  });
});
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass including the 2 new invariant tests.

- [ ] **Step 7: Commit**

```bash
git add packages/validators/src/ apps/api/src/routes/me.ts apps/api/src/__tests__/
git commit -m "feat(api): add GET/PATCH /api/me/profile with notification prefs"
```

---

## Task 3: Golfer Profile UI

**Files:**
- Create: `apps/web/app/(golfer)/account/page.tsx`
- Create: `apps/web/app/(golfer)/account/AccountClient.tsx`

- [ ] **Step 1: Create `apps/web/app/(golfer)/account/page.tsx`**

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { apiBaseUrl, getSessionToken } from "@/lib/server-session";
import AccountClient from "./AccountClient";

export type ProfileData = {
  name: string | null;
  email: string;
  phone: string | null;
  notificationPrefs: { reminders: boolean } | null;
};

export default async function AccountPage() {
  const session = await auth();
  const token = await getSessionToken();
  if (!session?.user || !token) {
    redirect("/login?redirect=/account");
  }

  const res = await fetch(`${apiBaseUrl()}/api/me/profile`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) redirect("/login?redirect=/account");
  if (!res.ok) throw new Error("Could not load profile");

  const profile = (await res.json()) as ProfileData;
  return <AccountClient profile={profile} accessToken={token} />;
}
```

- [ ] **Step 2: Create `apps/web/app/(golfer)/account/AccountClient.tsx`**

Create a client component with:
- A page header matching My Bookings style (gold eyebrow label "Golfer", display heading "Account")
- A form section "Profile" with fields: Name (text input), Phone (text input, optional), Reminders toggle (checkbox or toggle), Email shown as read-only text
- Save button that calls `PATCH /api/me/profile` with the changed fields; shows a toast on success using `sonner`
- A placeholder "Score history" section (empty state: "Your round scores will appear here once you log them.") — this section is wired up in Task 6
- A "← My bookings" back link at the bottom

Reference `MyBookingsClient.tsx` for the exact Tailwind class patterns (`ds-warm-white`, `ds-ink`, `ds-gold`, `font-display`, etc.).

- [ ] **Step 3: Add "Account" link in `MyBookingsClient.tsx`**

In `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx`, add a link to `/account` near the existing "← Back to home" link:

```typescript
<Link
  href="/account"
  className="mt-4 inline-block text-sm font-medium text-ds-fairway underline-offset-4 hover:underline"
>
  Account settings →
</Link>
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(golfer)/account/ apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx
git commit -m "feat(web): add golfer account page with profile form and notification prefs"
```

---

## Task 4: Calendar Export

**Files:**
- Modify: `apps/web/package.json` (add dependency)
- Create: `apps/web/components/booking/DownloadCalendarButton.tsx`
- Modify: `apps/web/app/book/[slug]/success/page.tsx`
- Modify: `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx`

- [ ] **Step 1: Install `ical-generator` in the web app**

```bash
cd apps/web && pnpm add ical-generator
```

Expected: package added to `apps/web/package.json`.

- [ ] **Step 2: Create `apps/web/components/booking/DownloadCalendarButton.tsx`**

```typescript
"use client";

import { useCallback } from "react";
import ICalCalendar from "ical-generator";

interface Props {
  bookingRef: string;
  clubName: string;
  courseName: string;
  datetimeIso: string;
  timezone: string;
  playersCount: number;
}

export function DownloadCalendarButton({
  bookingRef,
  clubName,
  courseName,
  datetimeIso,
  timezone,
  playersCount,
}: Props) {
  const download = useCallback(() => {
    const start = new Date(datetimeIso);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // +2h

    const cal = new ICalCalendar();
    cal.createEvent({
      summary: `Tee time at ${clubName}`,
      start,
      end,
      timezone,
      location: clubName,
      description: `Course: ${courseName}\nPlayers: ${playersCount}\nRef: ${bookingRef}`,
      uid: `teetimes-${bookingRef}`,
    });

    const content = cal.toString();
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tee-time-${bookingRef}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [bookingRef, clubName, courseName, datetimeIso, timezone, playersCount]);

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ds-stone bg-white px-4 py-2 text-sm font-medium text-ds-ink hover:bg-ds-cream/60"
    >
      Add to calendar
    </button>
  );
}
```

- [ ] **Step 3: Add button to the success page**

In `apps/web/app/book/[slug]/success/page.tsx`, import the component with `dynamic` to ensure client-only:

```typescript
import dynamic from "next/dynamic";
const DownloadCalendarButton = dynamic(
  () => import("@/components/booking/DownloadCalendarButton").then(m => m.DownloadCalendarButton),
  { ssr: false }
);
```

Add below the ticket card (after the "Book another tee time" link):

```typescript
{datetime && club && (
  <div className="mt-4 flex justify-center">
    <DownloadCalendarButton
      bookingRef={bookingRef}
      clubName={club.name}
      courseName=""  // not in search params; omit or add courseName to URL
      datetimeIso={datetime}
      timezone={timezone}
      playersCount={Number(players)}
    />
  </div>
)}
```

- [ ] **Step 4: Add button to each `BookingCard` in `MyBookingsClient.tsx`**

In `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx`, import `DownloadCalendarButton` with `dynamic` (same pattern as above). Add the button inside `BookingCard` in the cancel row area, using `booking.teeSlot` data as props.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add client-side iCal calendar export to success page and My Bookings"
```

---

## Task 5: Course Hole Configuration — API

**Files:**
- Create: `apps/api/src/routes/courseHoles.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/clubResources.ts`
- Create: `packages/validators/src/holes.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/__tests__/publicApiInvariants.test.ts`

- [ ] **Step 1: Write failing invariant test**

In `publicApiInvariants.test.ts`, add:

```typescript
it("GET /api/clubs/:clubId/courses/:courseId/holes returns 401 without auth", async () => {
  const res = await request(app)
    .get("/api/clubs/00000000-0000-0000-0000-000000000001/courses/00000000-0000-0000-0000-000000000002/holes");
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && pnpm test
```

Expected: new test fails (route returns 404 currently).

- [ ] **Step 3: Create `packages/validators/src/holes.ts`**

```typescript
import { z } from "zod";

export const HoleUpsertSchema = z.array(
  z.object({
    holeNumber: z.number().int().min(1).max(18),
    par: z.number().int().min(3).max(5),
    handicapIndex: z.number().int().min(1).max(18).nullable().optional(),
    yardage: z.number().int().min(1).max(1000).nullable().optional(),
  })
).min(1).max(18);

export type HoleUpsert = z.infer<typeof HoleUpsertSchema>;
```

Export from `packages/validators/src/index.ts`:
```typescript
export * from "./holes";
```

- [ ] **Step 4: Create `apps/api/src/routes/courseHoles.ts`**

This file exports only the GET handler (called by app.ts directly):

```typescript
import { Router } from "express";
import { db, courseHoles, courses } from "@teetimes/db";
import { eq, asc, and } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router({ mergeParams: true });

// GET /api/clubs/:clubId/courses/:courseId/holes
// Auth: any authenticated user (golfers need this for scorecard par display)
router.get(
  "/api/clubs/:clubId/courses/:courseId/holes",
  authenticate,
  async (req, res) => {
    const { clubId, courseId } = req.params;

    // Verify course belongs to club
    const course = await db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.clubId, clubId)),
      columns: { id: true, holes: true },
    });
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const holes = await db
      .select()
      .from(courseHoles)
      .where(eq(courseHoles.courseId, courseId))
      .orderBy(asc(courseHoles.holeNumber));

    res.json(holes);
  }
);

export default router;
```

- [ ] **Step 5: Mount GET holes in `apps/api/src/app.ts`**

Add import:
```typescript
import courseHolesRoutes from "./routes/courseHoles";
```

Add before `app.use("/api/clubs/:clubId", clubResources)`:
```typescript
// GET holes is open to all authenticated users (golfers need par data for scorecards).
// Must be before the /api/clubs/:clubId clubResources mount to avoid requireClubAccess.
app.use(courseHolesRoutes);
```

- [ ] **Step 6: Add PUT holes to `apps/api/src/routes/clubResources.ts`**

Add import at top:
```typescript
import { courseHoles, courses } from "@teetimes/db";
import { HoleUpsertSchema } from "@teetimes/validators";
import { eq, and, inArray } from "drizzle-orm";
```

Add route (gated by existing `requireClubAccess` router-level middleware):

```typescript
router.put("/courses/:courseId/holes", async (req, res) => {
  const clubId = req.params.clubId;
  const courseId = req.params.courseId;

  const course = await db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.clubId, clubId)),
    columns: { id: true, holes: true },
  });
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  const parsed = HoleUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const holeNumbers = parsed.data.map(h => h.holeNumber);
  const maxHole = Math.max(...holeNumbers);
  if (maxHole > course.holes) {
    res.status(400).json({ error: `Hole number ${maxHole} exceeds course length (${course.holes} holes)` });
    return;
  }

  await db.transaction(async (tx) => {
    // Delete removed holes
    const existing = await tx.select({ holeNumber: courseHoles.holeNumber })
      .from(courseHoles)
      .where(eq(courseHoles.courseId, courseId));
    const existingNums = existing.map(h => h.holeNumber);
    const toDelete = existingNums.filter(n => !holeNumbers.includes(n));
    if (toDelete.length > 0) {
      await tx.delete(courseHoles).where(
        and(eq(courseHoles.courseId, courseId), inArray(courseHoles.holeNumber, toDelete))
      );
    }
    // Upsert provided holes
    for (const hole of parsed.data) {
      await tx.insert(courseHoles)
        .values({ courseId, holeNumber: hole.holeNumber, par: hole.par, handicapIndex: hole.handicapIndex ?? null, yardage: hole.yardage ?? null })
        .onConflictDoUpdate({
          target: [courseHoles.courseId, courseHoles.holeNumber],
          set: { par: hole.par, handicapIndex: hole.handicapIndex ?? null, yardage: hole.yardage ?? null },
        });
    }
  });

  const updated = await db.select().from(courseHoles)
    .where(eq(courseHoles.courseId, courseId))
    .orderBy(courseHoles.holeNumber);
  res.json(updated);
});
```

- [ ] **Step 7: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: new invariant test passes; all others pass.

- [ ] **Step 8: Commit**

```bash
git add packages/validators/src/ apps/api/src/routes/ apps/api/src/app.ts apps/api/src/__tests__/
git commit -m "feat(api): add GET/PUT course holes endpoints for hole par configuration"
```

---

## Task 6: Course Hole Configuration — Club Admin UI

**Files:**
- Create: `apps/web/components/club/CourseHolesEditor.tsx`
- Modify: `apps/web/app/(club)/club/[clubId]/courses/CoursesClient.tsx`

- [ ] **Step 1: Create `apps/web/components/club/CourseHolesEditor.tsx`**

A client component that:
- Accepts `{ clubId: string; course: { id: string; name: string; holes: number } }`
- Fetches `GET /api/clubs/:clubId/courses/:courseId/holes` on mount (using the Next.js BFF proxy pattern or direct API call with session token via `useSession`)
- Shows a loading state while fetching
- If no holes configured: shows "Set up holes" button that reveals the editor
- If holes exist: shows "Edit holes" button
- The editor is a grid with `course.holes` rows: hole # (read-only), par picker (3/4/5 buttons), handicap index (number input, optional), yardage (number input, optional)
- "Save" button calls `PUT /api/clubs/:clubId/courses/:courseId/holes` with all rows; shows toast on success
- "Cancel" discards changes
- Shows total par at the bottom of the grid as a summary line

Use the same Tailwind class patterns as `CoursesClient.tsx` for consistency.

- [ ] **Step 2: Add `CourseHolesEditor` below each course row in `CoursesClient.tsx`**

Import the new component and render it below each course row in the course list, passing `clubId` and the course row object.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add CourseHolesEditor to courses admin for per-hole par configuration"
```

---

## Task 7: Scorecard API

**Files:**
- Create: `packages/validators/src/scorecards.ts`
- Modify: `packages/validators/src/index.ts`
- Create: `apps/api/src/routes/scorecards.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/me.ts`

- [ ] **Step 1: Create `packages/validators/src/scorecards.ts`**

```typescript
import { z } from "zod";

export const ScorecardSubmitSchema = z.object({
  bookingId: z.string().uuid(),
  holes: z
    .array(
      z.object({
        holeNumber: z.number().int().min(1).max(18),
        score: z.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(18),
});

export type ScorecardSubmit = z.infer<typeof ScorecardSubmitSchema>;
```

Export from `packages/validators/src/index.ts`:
```typescript
export * from "./scorecards";
```

- [ ] **Step 2: Create `apps/api/src/routes/scorecards.ts`**

```typescript
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  bookings,
  teeSlots,
  courses,
  clubs,
  roundScorecards,
  roundScorecardHoles,
} from "@teetimes/db";
import { ScorecardSubmitSchema } from "@teetimes/validators";
import { authenticate } from "../middleware/auth";

const router = Router();

// POST /api/me/scorecards — upsert scorecard for a past booking
router.post("/", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = ScorecardSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { bookingId, holes } = parsed.data;

  // Verify booking ownership and that the round is in the past
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: { teeSlot: { with: { course: { with: { club: true } } } } },
  });

  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  if (booking.userId !== auth.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!booking.teeSlot) { res.status(400).json({ error: "Booking has no tee slot" }); return; }
  if (new Date(booking.teeSlot.datetime) > new Date()) {
    res.status(400).json({ error: "Round not yet played", code: "ROUND_NOT_YET_PLAYED" });
    return;
  }

  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
  const completedHoles = holes.length;
  const courseId = booking.teeSlot.courseId;

  const scorecard = await db.transaction(async (tx) => {
    // Upsert the scorecard header
    const [sc] = await tx
      .insert(roundScorecards)
      .values({
        bookingId,
        userId: auth.userId,
        courseId,
        totalScore,
        completedHoles,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [roundScorecards.bookingId],
        set: { totalScore, completedHoles, updatedAt: new Date() },
      })
      .returning();

    // Delete existing hole scores and reinsert
    await tx.delete(roundScorecardHoles).where(eq(roundScorecardHoles.scorecardId, sc.id));
    await tx.insert(roundScorecardHoles).values(
      holes.map((h) => ({ scorecardId: sc.id, holeNumber: h.holeNumber, score: h.score }))
    );

    return sc;
  });

  res.status(201).json({ id: scorecard.id, totalScore, completedHoles });
});

// GET /api/me/scorecards — list golfer's scorecards
router.get("/", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.query.roundScorecards.findMany({
    where: eq(roundScorecards.userId, auth.userId),
    orderBy: [desc(roundScorecards.createdAt)],
    with: {
      holes: true,
      booking: {
        with: {
          teeSlot: {
            with: { course: { with: { club: true } } },
          },
        },
      },
      course: true,
    },
  });

  res.json(
    rows.map((sc) => ({
      id: sc.id,
      totalScore: sc.totalScore,
      completedHoles: sc.completedHoles,
      createdAt: sc.createdAt?.toISOString(),
      holes: sc.holes.map((h) => ({ holeNumber: h.holeNumber, score: h.score })),
      booking: sc.booking
        ? {
            bookingRef: sc.booking.bookingRef,
            teeSlot: sc.booking.teeSlot
              ? {
                  datetime: sc.booking.teeSlot.datetime.toISOString(),
                  courseName: sc.booking.teeSlot.course?.name ?? "",
                  clubName: sc.booking.teeSlot.course?.club?.name ?? "",
                  clubId: sc.booking.teeSlot.course?.club?.id ?? "",
                  courseId: sc.booking.teeSlot.courseId,
                }
              : null,
          }
        : null,
    }))
  );
});

export default router;
```

- [ ] **Step 3: Mount scorecard routes in `apps/api/src/app.ts`**

Add import:
```typescript
import scorecardRoutes from "./routes/scorecards";
```

Add after `app.use("/api/me", meRoutes)`:
```typescript
app.use("/api/me/scorecards", scorecardRoutes);
```

- [ ] **Step 4: Typecheck and run tests**

```bash
pnpm typecheck && cd apps/api && pnpm test
```

Expected: 0 typecheck errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/ apps/api/src/routes/scorecards.ts apps/api/src/app.ts
git commit -m "feat(api): add POST/GET /api/me/scorecards for hole-by-hole round scoring"
```

---

## Task 8: Scorecard Entry UI

**Files:**
- Create: `apps/web/components/golfer/ScorecardEntryModal.tsx`
- Modify: `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx`
- Modify: `apps/web/app/(golfer)/account/AccountClient.tsx`
- Modify: `apps/web/app/(golfer)/account/page.tsx`

- [ ] **Step 1: Create `apps/web/components/golfer/ScorecardEntryModal.tsx`**

A client component using `@radix-ui/react-dialog` (already a dependency). Props:

```typescript
interface Props {
  booking: {
    id: string;
    bookingRef: string;
    teeSlot: { datetime: string; courseName: string; clubName: string; clubId: string; courseId: string; holes: number };
  };
  accessToken: string;
  existingScorecard?: { holes: { holeNumber: number; score: number }[] } | null;
  onSaved: () => void;
  trigger: React.ReactNode;
}
```

Behavior:
1. On open, fetches `GET /api/clubs/:clubId/courses/:courseId/holes` using `fetch` with Bearer token. If response is empty array or 404, falls back to a simple mode showing `booking.teeSlot.holes` rows without par.
2. State: array of `{ holeNumber, par: number | null, score: number | null }` — one entry per hole.
3. Grid: `hole # | par | score input`. Score input is `<input type="number" min="1" max="20">`.
4. Pre-populates from `existingScorecard` if provided.
5. Running total displayed below the grid.
6. Submit button calls `POST /api/me/scorecards`. On 201, calls `onSaved()`, closes dialog, shows toast.
7. On `ROUND_NOT_YET_PLAYED` 400, shows inline error.

- [ ] **Step 2: Wire "Log Score" button into `MyBookingsClient.tsx`**

In `BookingCard`, add a "Log Score" button that appears only when `section === "past"` and the booking has a `teeSlot` with `courseId` (i.e., it's a user booking, not guest). Render `<ScorecardEntryModal>` with the booking data.

Add a `scorecard` prop to `BookingCard` and `MyBookingsClient` to pass existing scorecard data — fetch scorecards from `GET /api/me/scorecards` in `MyBookingsPage` (server component) and pass down.

Update `apps/web/app/(golfer)/my-bookings/page.tsx` to also fetch scorecards:

```typescript
const scRes = await fetch(`${apiBaseUrl()}/api/me/scorecards`, {
  cache: "no-store",
  headers: { Authorization: `Bearer ${token}` },
});
const scorecards = scRes.ok ? (await scRes.json()) as ScorecardItem[] : [];
```

Pass a `scorecardsByBookingId` map to `MyBookingsClient`.

- [ ] **Step 3: Update account page to show scorecard history**

Update `apps/web/app/(golfer)/account/page.tsx` to also fetch scorecards and pass to `AccountClient`.

In `AccountClient.tsx`, add a "Score history" section below the profile form:
- List of scorecards: date, club, course, total score, score vs par (show `+N` / `-N` / `E` if par data available)
- Empty state: "Log your first round score from My Bookings."

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add ScorecardEntryModal to My Bookings and score history to account page"
```

---

## Task 9: Club Scorecard Reports

**Files:**
- Modify: `apps/api/src/routes/clubs.ts`
- Modify: `apps/web/app/(club)/club/[clubId]/reports/page.tsx`
- Modify: `apps/web/app/(club)/club/[clubId]/reports/ReportsClient.tsx`

- [ ] **Step 1: Add `GET /reports/scorecards` to `apps/api/src/routes/clubs.ts`**

This route is mounted at `/api/clubs/:clubId/manage` and protected by `requireClubAccess`. Add before `export default router`:

```typescript
router.get("/reports/scorecards", async (req, res) => {
  const clubId = paramClubId(req);
  if (!clubId) { res.status(400).json({ error: "clubId required" }); return; }

  const courseRows = await db.query.courses.findMany({
    where: eq(courses.clubId, clubId),
    columns: { id: true },
  });
  const courseIds = courseRows.map(c => c.id);
  if (courseIds.length === 0) {
    return res.json({ completionRate: 0, totalRounds: 0, holeAverages: [], scoreDistribution: { underPar: 0, atPar: 0, overPar1: 0, overPar2plus: 0 } });
  }

  // Total confirmed bookings for this club (denominator for completion rate)
  const [totalBookingsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(and(
      isNull(bookings.deletedAt),
      eq(bookings.status, "confirmed"),
      inArray(teeSlots.courseId, courseIds),
      lt(teeSlots.datetime, new Date()),
    ));

  const [totalRoundsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(roundScorecards)
    .innerJoin(bookings, eq(roundScorecards.bookingId, bookings.id))
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(inArray(teeSlots.courseId, courseIds));

  const totalBookings = totalBookingsRow?.c ?? 0;
  const totalRounds = totalRoundsRow?.c ?? 0;
  const completionRate = totalBookings === 0 ? 0 : Math.round((totalRounds / totalBookings) * 100) / 100;

  // Hole averages — join scorecards → holes → course_holes for par
  const holeAvgRows = await db
    .select({
      holeNumber: roundScorecardHoles.holeNumber,
      par: courseHoles.par,
      avgScore: sql<number>`round(avg(${roundScorecardHoles.score})::numeric, 2)::float`,
      sampleSize: sql<number>`count(*)::int`,
    })
    .from(roundScorecardHoles)
    .innerJoin(roundScorecards, eq(roundScorecardHoles.scorecardId, roundScorecards.id))
    .innerJoin(courseHoles, and(
      eq(courseHoles.courseId, roundScorecards.courseId),
      eq(courseHoles.holeNumber, roundScorecardHoles.holeNumber),
    ))
    .innerJoin(bookings, eq(roundScorecards.bookingId, bookings.id))
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(inArray(teeSlots.courseId, courseIds))
    .groupBy(roundScorecardHoles.holeNumber, courseHoles.par)
    .orderBy(roundScorecardHoles.holeNumber);

  // Score distribution vs par
  const distRows = await db
    .select({
      delta: sql<number>`(${roundScorecardHoles.score} - ${courseHoles.par})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(roundScorecardHoles)
    .innerJoin(roundScorecards, eq(roundScorecardHoles.scorecardId, roundScorecards.id))
    .innerJoin(courseHoles, and(
      eq(courseHoles.courseId, roundScorecards.courseId),
      eq(courseHoles.holeNumber, roundScorecardHoles.holeNumber),
    ))
    .innerJoin(bookings, eq(roundScorecards.bookingId, bookings.id))
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(inArray(teeSlots.courseId, courseIds))
    .groupBy(sql`(${roundScorecardHoles.score} - ${courseHoles.par})::int`);

  let underPar = 0, atPar = 0, overPar1 = 0, overPar2plus = 0;
  for (const row of distRows) {
    if (row.delta < 0) underPar += row.count;
    else if (row.delta === 0) atPar += row.count;
    else if (row.delta === 1) overPar1 += row.count;
    else overPar2plus += row.count;
  }

  res.json({
    completionRate,
    totalRounds,
    holeAverages: holeAvgRows.map(r => ({ holeNumber: r.holeNumber, par: r.par, avgScore: r.avgScore, sampleSize: r.sampleSize })),
    scoreDistribution: { underPar, atPar, overPar1, overPar2plus },
  });
});
```

Add required imports to `clubs.ts`:
```typescript
import { db, ..., roundScorecards, roundScorecardHoles, courseHoles } from "@teetimes/db";
import { ..., inArray } from "drizzle-orm";
```

- [ ] **Step 2: Update `ReportsClient.tsx` to add a scorecard tab**

Add a new `ScorecardReportsPayload` type and a tab switcher. The scorecard tab shows:
- KPI cards: "Completion rate" (percentage) and "Rounds scored" (count)
- Table: hole # | par | avg score | delta vs par (color: green if ≤0, amber if +1, red if +2+)
- Score distribution row: under par / at par / bogey / double+

Load data lazily when the tab is selected using `fetch` with the session token.

- [ ] **Step 3: Update the reports server page to pass clubId to client**

The current `ReportsClient` already receives `clubId` — no change needed.

- [ ] **Step 4: Typecheck and test**

```bash
pnpm typecheck && cd apps/api && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/clubs.ts apps/web/app/(club)/club/[clubId]/reports/
git commit -m "feat: add non-PII scorecard aggregate reports for club dashboard"
```

---

## Task 10: Booking Modification — API

**Files:**
- Modify: `apps/api/src/routes/bookingOperations.ts`
- Modify: `apps/api/src/__tests__/publicApiInvariants.test.ts`

The `PATCH /api/bookings/:bookingId` endpoint already handles `teeSlotId` slot moves with full add-on recomputation and cache invalidation. This task extends it with:
1. `playersCount` mutation support
2. Relaxed auth to also allow the booking owner
3. Cancellation-window enforcement for golfer-originated calls

- [ ] **Step 1: Read `apps/api/src/routes/bookingOperations.ts`**

Find the PATCH handler (around line 216). Read the existing auth check (`canAccessClub`) and the slot-move logic block.

- [ ] **Step 2: Write failing test**

In `publicApiInvariants.test.ts`, add:

```typescript
it("PATCH /api/bookings/:id returns 401 without auth", async () => {
  const res = await request(app)
    .patch("/api/bookings/00000000-0000-0000-0000-000000000001")
    .send({ playersCount: 2 });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 3: Extend PATCH handler to allow `playersCount`-only requests and relax auth**

The handler currently has an early guard (around line 238) that requires `teeSlotId` or `courseId+datetime` in the body and returns 400 if neither is present. This blocks `playersCount`-only requests. Locate that guard and update it:

```typescript
// Before change:
if (!hasTeeSlotId && !hasCourseDatetime) {
  res.status(400).json({ error: "Provide teeSlotId or courseId and datetime" });
  return;
}

// After change — also allow playersCount alone:
const hasPlayersCount = typeof req.body.playersCount === "number";
if (!hasTeeSlotId && !hasCourseDatetime && !hasPlayersCount) {
  res.status(400).json({ error: "Provide teeSlotId, courseId+datetime, or playersCount" });
  return;
}
```

Then locate the auth guard block (around line 265):
```typescript
if (!canAccessClub(auth.roles, booking.teeSlot.course.club.id)) {
  return res.status(403).json({ error: "Forbidden" });
}
```

Replace with:

```typescript
const isOwner = booking.userId === auth.userId;
const isStaff = canAccessClub(auth.roles, booking.teeSlot.course.club.id);

if (!isOwner && !isStaff) {
  res.status(403).json({ error: "Forbidden" });
  return;
}

// Golfer-owners must be within the cancellation window
if (isOwner && !isStaff) {
  const cfgRows = await db.query.clubConfig.findMany({
    where: eq(clubConfig.clubId, booking.teeSlot.course.club.id),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });
  const mapped = cfgRows.map(c => ({ ...c, effectiveFrom: c.effectiveFrom instanceof Date ? c.effectiveFrom.toISOString().slice(0,10) : String(c.effectiveFrom).slice(0,10) }));
  const cfg = resolveConfig(mapped, new Date(booking.teeSlot.datetime));
  const hours = cfg?.cancellationHours ?? 24;
  if (!isCancellable(booking.teeSlot.datetime, hours)) {
    res.status(403).json({ error: "Outside cancellation window", code: "OUTSIDE_WINDOW" });
    return;
  }
}
```

Add imports if not already present:
```typescript
import { isCancellable } from "../lib/cancellation";
import { resolveConfig } from "../lib/configResolver";
import { clubConfig } from "@teetimes/db";
import { desc } from "drizzle-orm";
```

- [ ] **Step 4: Add `playersCount` mutation support**

In the PATCH handler body, after the slot-move block (or alongside it), add:

```typescript
const { teeSlotId, playersCount, checkedIn, noShow } = req.body; // checkedIn/noShow are existing fields

if (playersCount !== undefined && typeof playersCount === "number" && playersCount !== booking.playersCount) {
  const maxPlayers = booking.teeSlot.maxPlayers ?? 4;
  const currentOthers = (booking.teeSlot.bookedPlayers ?? 0) - booking.playersCount;
  if (currentOthers + playersCount > maxPlayers) {
    res.status(409).json({ error: "Not enough capacity for this player count", code: "SLOT_FULL" });
    return;
  }
  await db.update(bookings).set({ playersCount }).where(eq(bookings.id, bookingId));
  await db.update(teeSlots).set({ bookedPlayers: currentOthers + playersCount }).where(eq(teeSlots.id, booking.teeSlotId!));
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/bookingOperations.ts apps/api/src/__tests__/
git commit -m "feat(api): extend booking PATCH to allow golfer-owned modifications with window enforcement"
```

---

## Task 11: Booking Modification — UI

**Files:**
- Create: `apps/web/components/golfer/ModifyBookingModal.tsx`
- Modify: `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx`

- [ ] **Step 1: Create `apps/web/components/golfer/ModifyBookingModal.tsx`**

A Radix Dialog client component. Props:

```typescript
interface Props {
  booking: MeBookingItem & { teeSlot: MeBookingTeeSlot & { courseId: string } };
  accessToken: string;
  onModified: () => void;
  trigger: React.ReactNode;
}
```

Behavior:
1. Opens a dialog with a heading "Modify booking".
2. Shows two sections:
   - **Player count:** stepper (1–4) showing current count. User can increment/decrement.
   - **Change time:** a link/button "Pick a different time →" that opens `/book/[slug]/times?bookingId=...` (or shows an inline simplified date picker). For MVP simplicity, just expose the player count change in this modal. The "change time" path can be: navigate to the times page with a `modifyBookingId` query param; the times page can detect this and call `PATCH` instead of `POST`.
3. "Save changes" button: calls `PATCH /api/bookings/:bookingId` with `{ playersCount }`. On success, calls `onModified()` and closes.
4. Shows error inline if 403 `OUTSIDE_WINDOW` (outside window message).

- [ ] **Step 2: Add "Modify" button to `BookingCard` in `MyBookingsClient.tsx`**

Add `<ModifyBookingModal>` trigger button alongside the existing Cancel button in the `showCancelRow` section. Only show when `booking.isCancellable` is true (same condition as cancel being available).

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add ModifyBookingModal to My Bookings for player count changes"
```

---

## Task 12: Scheduled Reminder Fix

**Files:**
- Modify: `apps/api/src/workers/emailWorker.ts`
- Modify: `apps/api/src/routes/publicClub.ts` (audit only — no logic change expected)

- [ ] **Step 1: Fix `sendReminderEmail` in `emailWorker.ts`**

The current implementation (around line 207):
```typescript
const to = booking.guestEmail ?? "";
if (!to) return;
```

Replace with:

```typescript
let to: string;
let sendReminder = true;

if (booking.userId) {
  // User booking — fetch email from users table; check opt-out
  const user = await db.query.users.findFirst({
    where: eq(users.id, booking.userId),
    columns: { email: true, notificationPrefs: true },
  });
  if (!user) return;
  const prefs = user.notificationPrefs as { reminders?: boolean } | null;
  if (prefs?.reminders === false) return; // opted out
  to = user.email;
} else {
  // Guest booking — use guestEmail; no opt-out check
  to = booking.guestEmail ?? "";
  if (!to) return;
}
```

Also add `users` to the existing `emailWorker.ts` import from `@teetimes/db`:
```typescript
import { db, ..., users } from "@teetimes/db";
```

- [ ] **Step 2: Audit reminder enqueue in `publicClub.ts`**

Search for `email:booking-reminder` in `apps/api/src/routes/publicClub.ts`. Verify:
- The delay is calculated as `slotDatetime.getTime() - Date.now() - 24 * 60 * 60 * 1000`
- The guard is `delay > 60 * 60 * 1000` (1 hour, not zero)
- Both the online booking confirmation path AND the waitlist claim path enqueue the job

If the delay formula is correct, no change is needed. If the 24h offset is missing, add it.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/workers/emailWorker.ts apps/api/src/routes/publicClub.ts
git commit -m "fix(api): fix reminder emails for user bookings and add notification prefs opt-out"
```

---

## Task 13: No-show Automation

**Files:**
- Modify: `apps/api/src/lib/queue.ts`
- Create: `apps/api/src/workers/bookingWorker.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/publicClub.ts`
- Modify: `apps/api/src/routes/bookingOperations.ts`
- Modify: `apps/api/src/routes/clubs.ts`

- [ ] **Step 1: Add booking queue helpers to `apps/api/src/lib/queue.ts`**

```typescript
import { Queue } from "bullmq";

let bookingQueue: Queue | null = null;

export function getBookingQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!bookingQueue) {
    bookingQueue = new Queue("booking", { connection: createBullConnection() });
  }
  return bookingQueue;
}

export async function enqueueBookingJob(
  name: string,
  data: Record<string, unknown>,
  opts?: { delay?: number }
): Promise<void> {
  const q = getBookingQueue();
  if (!q) return;
  await q.add(name, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    delay: opts?.delay,
  });
}
```

(`createBullConnection` is already defined in this file — reuse it.)

- [ ] **Step 2: Create `apps/api/src/workers/bookingWorker.ts`**

```typescript
import { Worker } from "bullmq";
import Redis from "ioredis";
import { eq, and, isNull } from "drizzle-orm";
import {
  db,
  bookings,
  bookingPlayers,
  teeSlots,
  waitlistEntries,
  failedJobs,
} from "@teetimes/db";
import { enqueueEmail } from "../lib/queue";

function bullConnection(): Redis {
  return new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

async function handleAutoNoShow(bookingId: string): Promise<void> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: {
      players: true,
      teeSlot: { with: { course: { with: { club: true } } } },
    },
  });

  if (!booking) return;
  if (booking.status === "cancelled" || booking.status === "no_show") return;

  const anyCheckedIn = booking.players.some((p) => p.checkedIn);
  if (anyCheckedIn) return;

  // Mark as no-show
  await db
    .update(bookings)
    .set({ status: "no_show" })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "confirmed")));

  // Restore slot capacity
  if (booking.teeSlotId) {
    await db
      .update(teeSlots)
      .set({
        bookedPlayers: Math.max(0, (booking.teeSlot?.bookedPlayers ?? booking.playersCount) - booking.playersCount),
      })
      .where(eq(teeSlots.id, booking.teeSlotId));

    // Notify next waitlist entry if one exists
    const nextEntry = await db.query.waitlistEntries.findFirst({
      where: and(
        eq(waitlistEntries.teeSlotId, booking.teeSlotId),
        isNull(waitlistEntries.claimedAt)
      ),
      orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
    if (nextEntry) {
      await enqueueEmail("email:waitlist-notify", { waitlistEntryId: nextEntry.id });
    }
  }
}

export function startBookingWorker(): void {
  if (!process.env.REDIS_URL) {
    console.warn("Booking worker disabled: REDIS_URL not set");
    return;
  }

  const worker = new Worker(
    "booking",
    async (job) => {
      if (job.name === "booking:auto-noshow") {
        await handleAutoNoShow(String(job.data.bookingId));
      }
    },
    { connection: bullConnection(), concurrency: 5 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    try {
      await db.insert(failedJobs).values({
        jobName: job.name,
        jobData: job.data as object,
        error: err?.message ?? "unknown error",
      });
    } catch {}
  });

  worker.on("error", (err) => console.error("booking worker error", err));
  console.log("Booking worker started");
}
```

- [ ] **Step 3: Start booking worker in `apps/api/src/index.ts`**

```typescript
import { startBookingWorker } from "./workers/bookingWorker";

// Inside the app.listen callback, after startEmailWorker():
if (process.env.DISABLE_EMAIL_WORKER !== "1") {
  startEmailWorker();
  startBookingWorker();
}
```

- [ ] **Step 4: Enqueue no-show job in both booking confirmation paths**

In `apps/api/src/routes/publicClub.ts`, find the two places where `email:booking-confirmation` is enqueued. After each, add:

```typescript
import { enqueueBookingJob } from "../lib/queue";

// After enqueueEmail("email:booking-confirmation", ...):
const noShowDelay = new Date(teeSlot.datetime).getTime() + 15 * 60 * 1000 - Date.now();
if (noShowDelay > 0) {
  await enqueueBookingJob("booking:auto-noshow", { bookingId: booking.id }, { delay: noShowDelay });
}
```

In `apps/api/src/routes/bookingOperations.ts`, find the staff-created booking confirmation path (search for `email:booking-confirmation` enqueue). Add the same no-show enqueue after it.

- [ ] **Step 5: Add `noShowRate` to reports in `apps/api/src/routes/clubs.ts`**

In `GET /reports`, add a count of no-show bookings per day to the daily loop and totals:

```typescript
// Inside the per-day loop, after the existing `[row]` query:
const [noShowRow] = await db
  .select({ c: sql<number>`count(*)::int` })
  .from(bookings)
  .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
  .innerJoin(courses, eq(teeSlots.courseId, courses.id))
  .where(and(
    eq(courses.clubId, clubId),
    eq(bookings.status, "no_show"),
    gte(teeSlots.datetime, dayStart),
    lt(teeSlots.datetime, dayEnd),
  ));

// Add noShows to the series entry and to totals
```

Update `ReportsPayload` type in `ReportsClient.tsx` to include `noShows` in series and `noShowRate` in totals.

- [ ] **Step 6: Typecheck and test**

```bash
pnpm typecheck && cd apps/api && pnpm test
```

Expected: 0 errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/
git commit -m "feat(api): add automated no-show detection via BullMQ booking worker"
```

---

## Final Verification

- [ ] **Run full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors across all packages.

- [ ] **Run all tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Run linting**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Start services and smoke-test the booking flow**

```bash
pnpm docker:up && pnpm db:migrate && pnpm dev
```

Verify manually:
1. Log in as golfer → navigate to `/account` → update name and phone → save
2. Navigate to `/book/pinebrook` → complete a booking → click "Add to calendar" on success page → `.ics` file downloads
3. Log in as club admin → navigate to club Courses → expand a course → set par for 18 holes → save
4. Navigate to `/my-bookings` → past booking → click "Log Score" → enter scores → save
5. Navigate to club Reports → Scorecard tab → verify hole averages appear
6. As golfer, click "Modify" on an upcoming booking → change player count → save
