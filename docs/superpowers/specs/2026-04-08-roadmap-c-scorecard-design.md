# TeeTimes — Roadmap C + Scorecard Design Spec

**Date:** 2026-04-08  
**Status:** Draft  
**Scope:** Golfer experience, club operations depth, and a new scorecard system

---

## Overview

This spec covers the next phase of feature work for the TeeTimes platform. The six workstreams below close the most impactful gaps in the golfer lifecycle and club operational day, plus add a scorecard system that bridges both sides without exposing any individual PII to clubs.

---

## Workstream 1 — Booking Modification

### Problem
Golfers can only cancel a booking. There is no way to change the date, time, or player count without cancelling and rebooking. Staff have the same limitation in the booking drawer.

### Design
- Golfers can modify an upcoming booking from My Bookings within the club's cancellation window.
- Staff can modify any booking from the booking drawer (no cancellation-window restriction for staff).
- Modification accepts: new `teeSlotId` (different datetime or course) and/or new `playersCount`.
- The existing `PATCH /api/bookings/:bookingId` endpoint in `bookingOperations.ts` already implements slot moves (`teeSlotId` swaps) including capacity checks, add-on recomputation via `recomputeBookingAddonsAfterMove`, and cache invalidation for both slots. Two gaps remain:
  1. **`playersCount` mutation** is not currently handled — add it alongside the existing slot-move logic.
  2. **Auth** — the handler currently gates on `canAccessClub(auth.roles, clubId)` (staff only). Relax to also allow the booking's `userId` owner to call the endpoint. For golfer-owned calls, enforce the club's cancellation window (`cancellationHours`) before applying the change; staff calls bypass the window check.
- If the new slot has insufficient capacity, a 409 is returned and the booking is unchanged.
- A new "Modify booking" modal on the golfer side surfaces a tee time picker (date chips + time grid, same UI as the booking flow) scoped to the same club and course.

### API change
`PATCH /api/bookings/:bookingId` — extend accepted body with:
```json
{ "teeSlotId": "uuid", "playersCount": 2 }
```
At least one of the two fields must be present. Golfer-originated calls must be within the club's cancellation window or receive `403 OUTSIDE_WINDOW`. Existing player check-in and no-show toggle paths are unchanged.

---

## Workstream 2 — Scheduled Reminders

### Problem
The `BookingReminder` email template and BullMQ worker handler exist, and a reminder job is already enqueued with a `delay` at booking time in `publicClub.ts`. However, reminder delivery is not opted-out-aware and there is no golfer control.

### Design
- A reminder job is already enqueued at booking confirmation time in `publicClub.ts`. There are **two confirmation paths** in that file (online booking and waitlist claim) — both must be audited to ensure the delay calculation is correct.
- The existing guard threshold is `delay > 60 * 60 * 1000` (1 hour, not zero). Do not change this threshold — if the tee time is less than 1 hour away, no reminder is sent.
- Before sending, `sendReminderEmail` in `emailWorker.ts` must be updated to:
  1. For user bookings (`booking.userId` is not null): fetch the user's email from the `users` table and use it as the `to` address. The current code reads `booking.guestEmail ?? ""` and silently drops reminders for user bookings — this must be fixed as part of this workstream.
  2. Check `notification_prefs.reminders` on the fetched user. If explicitly `false`, exit without sending.
- Guest bookings (`userId` is null) always receive reminders at `booking.guestEmail`; no opt-out check needed.
- No second reminder at 1h is added in this phase.

### Changes
- `emailWorker.ts` `sendReminderEmail` — fix user-booking email lookup; add opt-out guard.
- `publicClub.ts` — audit both confirmation paths for correct `delay` calculation. No new enqueue logic needed.

---

## Workstream 3 — Golfer Profile

### Problem
The golfer area is limited to My Bookings. There is no profile page, no way to set a phone number, and no notification preference controls.

### Design
- New route `/account` under the `(golfer)` layout.
- Displays: name (editable), email (read-only), phone (editable, optional), reminder opt-in toggle.
- Data stored on the `users` table via two new nullable columns: `phone text` and `notification_prefs jsonb`.
- Score history (from Workstream 6) is also displayed on this page as a secondary section.

### API
- `GET /api/me/profile` — returns `{ name, email, phone, notificationPrefs }`.
- `PATCH /api/me/profile` — accepts `{ name, phone, notificationPrefs }`. Email is immutable.

### Schema change
Add to `users` table (Drizzle migration):
```
phone            text (nullable)
notification_prefs jsonb (nullable)
```

---

## Workstream 4 — Calendar Export

### Problem
After booking, golfers have no way to add the tee time to their calendar without manually entering the details.

### Design
- A `DownloadCalendarButton` client component is added.
- It accepts booking props (date/time, club name, course name, booking ref, player count) already available on both the success page and the `BookingCard` in My Bookings.
- On click, it uses `ical-generator` (client-compatible npm package) to construct a single-event `.ics` string and triggers a file download via `URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar' }))`.
- No server endpoint or API key required.
- The event includes: title (`Tee time at {clubName}`), start/end time (tee time + 2h estimate), location (club name), description (booking ref + players), and a UID derived from the booking ref.

### Placement
- Success page: button below the ticket card.
- My Bookings: added to each `BookingCard` in both upcoming and past sections.

---

## Workstream 5 — Check-in and No-show Flow

### Problem
The `bookingPlayers` table already has `checked_in` and `no_show` boolean columns, and the booking drawer exposes per-player toggles. However:
- No-show detection is manual only — staff must actively mark it.
- No-show data is not surfaced in reports.

### Design
- **Automated no-show flagging:** A scheduled BullMQ job is enqueued at booking confirmation time with a delay of `teeSlotDatetime + 15min - now`. When the job fires, it checks if `checked_in` is false for all players on the booking. If so, the booking's status is set to `no_show` and a record is logged to the audit log.
- **Waitlist trigger:** On auto no-show, the existing waitlist notification logic is called (slot capacity restored, next waitlist entry notified), same as manual cancellation.
- **Reports:** The `GET /api/clubs/:clubId/manage/reports` endpoint adds a `noShowRate` field to `totals` and a `noShows` count to each daily series entry.
- **No new UI required** — the existing per-player check-in toggle in the booking drawer is sufficient. The no-show automation runs server-side.

### New BullMQ job
- Job name: `booking:auto-noshow`
- Data: `{ bookingId: string }`
- Queue name: `"booking"` (separate from the existing `"email"` queue). A new `getBookingQueue()` helper and `enqueueBookingJob()` function are added in `apps/api/src/lib/queue.ts`, mirroring the existing `getEmailQueue()` / `enqueueEmail()` pattern.
- A new `apps/api/src/workers/bookingWorker.ts` handles this queue. It is started alongside `startEmailWorker()` in `apps/api/src/index.ts`.
- **Enqueue locations** — the job must be enqueued in **both** booking confirmation paths:
  1. `publicClub.ts` — online/waitlist-claim confirmation (alongside the existing reminder enqueue).
  2. `bookingOperations.ts` — staff-created booking confirmation path (around the `email:booking-confirmation` enqueue at line ~744).
- Worker handler: on fire, check if booking status is already `cancelled` or `no_show` — if so, exit silently. Otherwise check `bookingPlayers.checked_in` for all players; if none are checked in, update booking status to `no_show`, restore slot capacity, and trigger the existing waitlist notification logic.

---

## Workstream 6 — Scorecard System

### Problem
There is no way for golfers to record or track their scores. Clubs have no insight into course difficulty or round completion patterns.

### Design split: Club config side, Golfer entry side, Club reports side.

---

### 6a — Course Hole Configuration (Club Admin)

Club admins configure par per hole for each course. This is optional — a course without hole config simply won't offer scorecard entry to golfers.

**Schema — `course_holes` table:**
```
id              uuid PK
course_id       uuid FK → courses.id CASCADE
hole_number     integer        (1–9 or 1–18, must not exceed courses.holes)
par             integer        (3, 4, or 5)
handicap_index  integer?       (stroke index, 1–18, optional)
yardage         integer?       (optional)
UNIQUE(course_id, hole_number)
```

**API:**
- `GET /api/clubs/:clubId/courses/:courseId/holes` — returns hole array sorted by `hole_number`. Auth: any authenticated user (golfers need this to render par in the scorecard modal). Because `clubResources.ts` applies `requireClubAccess` at the router level to all routes, this endpoint must be registered directly on the **main app router** in `app.ts` (before the `clubResources` sub-router is mounted) using only the `authenticate` middleware. This avoids the club-staff restriction on `clubResources`.
- `PUT /api/clubs/:clubId/courses/:courseId/holes` — accepts `[{ holeNumber, par, handicapIndex?, yardage? }]`. Upserts all provided holes in a single transaction. Auth: club admin. Can be registered on the `clubResources` router as normal, gated by `requireClubAccess` with a `club_admin` role check.

**UI — `CourseHolesEditor`:**
- Added as a collapsible section below each course row in `CoursesClient.tsx`.
- Shows a grid: hole number | par (3/4/5 pill selector) | handicap index (optional number input) | yardage (optional number input).
- "Set up holes" CTA on unconfigured courses. "Edit" on configured ones.
- Saves via `PUT` on submit. Shows total par as a summary.

---

### 6b — Golfer Scorecard Entry

After playing a round, the golfer can log their score from My Bookings.

**Schema — `round_scorecards` table:**
```
id               uuid PK
booking_id       uuid FK → bookings.id CASCADE UNIQUE
user_id          uuid NOT NULL FK → users.id CASCADE
course_id        uuid FK → courses.id
total_score      integer
completed_holes  integer
created_at       timestamp
updated_at       timestamp
```

**Schema — `round_scorecard_holes` table:**
```
id              uuid PK
scorecard_id    uuid FK → round_scorecards.id CASCADE
hole_number     integer
score           integer    (strokes played on this hole)
UNIQUE(scorecard_id, hole_number)
```

**API:**
- `POST /api/me/scorecards` — create or upsert scorecard for a booking. Body: `{ bookingId, holes: [{ holeNumber, score }] }`. Computes and stores `total_score` and `completed_holes`. Auth: golfer (must own the booking).
- `GET /api/me/scorecards` — list golfer's scorecards with booking tee slot info and per-round summary. Auth: golfer.

**UI — `ScorecardEntryModal`:**
- Radix Dialog triggered by "Log Score" button on past booking cards in My Bookings.
- Only shown on past bookings for the authenticated user (not guest bookings).
- Fetches hole par config for the course from `GET /api/clubs/:clubId/courses/:courseId/holes`.
- If no hole config exists, shows a simplified total-score fallback (still uses the same API — just submits all holes as hole_number:score pairs for however many holes the course has without par display).
- Grid layout: one row per hole — hole number | par | score input (numeric, min 1). Running total shown at bottom.
- On submit, calls `POST /api/me/scorecards`. Toast on success.
- Re-opening a submitted scorecard pre-populates the inputs (upsert-safe).

**UI — Score history on `/account`:**
- Secondary section listing past scorecards: date, course, club, total score, score vs par (+/- indicator).

---

### 6c — Club Aggregate Reports (Non-PII)

Clubs see aggregated scoring data — no individual golfer is identifiable.

**API — `GET /api/clubs/:clubId/manage/reports/scorecards`:**
Returns:
```json
{
  "completionRate": 0.42,
  "totalRounds": 120,
  "holeAverages": [
    { "holeNumber": 1, "par": 4, "avgScore": 4.3, "sampleSize": 88 }
  ],
  "scoreDistribution": {
    "underPar": 12,
    "atPar": 45,
    "overPar1": 38,
    "overPar2plus": 25
  }
}
```
The `holeAverages` query uses `AVG(score)` grouped by `hole_number` across all scorecards for the club — no user identity in the query or response.

**UI — Scorecard tab in `ReportsClient.tsx`:**
- New tab alongside the existing daily breakdown.
- KPI cards: completion rate %, total rounds scored.
- Course difficulty table: hole number | par | avg score | difficulty indicator (color-coded delta vs par).
- Score distribution bar (birdie/eagle, par, bogey, double+).

---

## Error Handling

| Scenario | Handling |
|---|---|
| Modification target slot at capacity | 409 with `code: SLOT_FULL`; client shows inline error, no state change |
| Modification outside cancellation window | 403 with `code: OUTSIDE_WINDOW` |
| Scorecard for booking not owned by user | 403 |
| Scorecard submitted for future booking | 400 with `code: ROUND_NOT_YET_PLAYED` |
| No-show job fires after booking is already cancelled | Job exits silently (checks status before acting) |
| `ical-generator` unavailable client-side | Button hidden via `dynamic(..., { ssr: false })` with a fallback text link |

---

## Testing

- **Unit:** Drizzle schema migration validates UNIQUE constraints. `configResolver` and `slotGenerator` unit tests already exist; scorecard aggregate query gets its own unit test.
- **API invariants:** Extend `publicApiInvariants.test.ts` to assert `GET /api/me/profile` returns 401 for unauthenticated requests; `GET /api/clubs/:clubId/courses/:courseId/holes` returns 401 for completely unauthenticated requests (but must return 200 for a golfer JWT, not just staff).
- **E2E (Playwright — out of scope for this phase):** Booking modification flow and scorecard entry flow are candidates for the first Playwright tests in a follow-on phase.

---

## Implementation Order

Suggested build sequence to minimise blocking dependencies:

1. **Schema migrations** — `course_holes`, `round_scorecards`, `round_scorecard_holes`, `users` columns. Unblocks everything.
2. **Golfer Profile** (Workstream 3) — small, self-contained, no new schema beyond step 1.
3. **Calendar Export** (Workstream 4) — completely independent, pure client.
4. **Hole Configuration** (Workstream 6a) — enables scorecard entry.
5. **Scorecard Entry + Stats** (Workstream 6b/c) — depends on 6a.
6. **Booking Modification** (Workstream 1) — complex, independent of scorecard.
7. **Scheduled Reminders opt-out** (Workstream 2) — depends on profile (step 2).
8. **Check-in / No-show automation** (Workstream 5) — independent of scorecard, can be parallelised with 4–6.

---

## Out of Scope (this phase)

- Handicap calculation (World Handicap System / GHIN integration)
- SMS notifications
- Playwright E2E tests (noted as follow-on)
- Booking PDF receipt download
- Social / book-with-friends feature
- Yield / dynamic pricing
