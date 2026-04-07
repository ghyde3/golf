# Plan 2 — Booking Features & Platform Enhancements

> **Scope:** All features outside of inventory management. Feature D (Add-On Catalog) depends on Plan 1 being complete. All other features are independent of Plan 1 and of each other unless noted.

---

## Dependency Map

```
Feature A — Booking Source Tracking    (no dependencies)
  └── also fixes userId population bug, which unblocks Feature B

Feature B — Golfer "My Bookings" Portal
  └── requires userId fix from Feature A

Feature C — Waitlist for Fully-Booked Slots    (no dependencies)

Feature D — Add-On / Upsell Catalog
  └── requires Plan 1 (Inventory) to be complete
  └── introduces bookingAddonLines with bookingStart/bookingEnd columns
      (these are the indexed columns Plan 1's overlap query depends on)
  └── concurrency: all rental availability checks use SELECT...FOR UPDATE
      on the resourceTypes row

Feature E — Revenue & Occupancy in Reports    (no dependencies for revenue)
  └── occupancy denominator requires slot generator call per day
  └── add-on revenue column requires Feature D

Feature F — Dashboard Weekly Trend Sparkline    (no dependencies)
```

---

## Feature A — Booking Source Tracking

> **Priority: Build first.** Pure additive migration, fixes a data quality bug as a side effect, and unblocks Feature B.

### Gap

No way to distinguish how a booking was created: public guest, authenticated user, or staff. The `bookings.userId` column exists in the schema but is never populated in any booking creation path — all three paths leave it `null`.

### DB Change

Add `source text default 'online_guest'` to the `bookings` table.

Valid values: `"online_guest"` | `"online_user"` | `"staff"`

Migration is additive — the default value of `"online_guest"` keeps all existing rows valid.

### `userId` Population Fix

This is a correctness bug independent of source tracking. All three booking creation paths currently ignore the Authorization header when setting `userId`. Fix:

- `publicClub.ts` free booking path: call `getAuthPayload(req)`. If a valid JWT is present, set `userId = auth.userId` and `source = "online_user"`. If no JWT, `userId = null` and `source = "online_guest"`.
- `publicClub.ts` payment-intent + confirm path: same check.
- `bookingOperations.ts` `POST /` (staff create): `userId` is already from the authenticated staff member; set `source = "staff"`.

### API Changes

**Three insertion points** in existing route files:

| File | Booking path | Source value set |
|---|---|---|
| `apps/api/src/routes/publicClub.ts` | Free booking, no JWT | `"online_guest"` |
| `apps/api/src/routes/publicClub.ts` | Free booking, valid JWT | `"online_user"` |
| `apps/api/src/routes/publicClub.ts` | Payment confirm, no JWT | `"online_guest"` |
| `apps/api/src/routes/publicClub.ts` | Payment confirm, valid JWT | `"online_user"` |
| `apps/api/src/routes/bookingOperations.ts` | Staff `POST /api/bookings` | `"staff"` |

The `GET /api/bookings/:bookingId` response (lines 93–117 of `bookingOperations.ts`) must include `source` in its response object. The `BookingDetail` type in `apps/web/components/teesheet/types.ts` must add `source`.

**Reports endpoint extension** (`apps/api/src/routes/clubs.ts` `GET /reports`):

Add a `sources` object to the `totals` response:

```json
{
  "totals": {
    "bookings": 42,
    "players": 98,
    "sources": { "online": 35, "staff": 7 }
  }
}
```

`online` = count of `"online_guest"` + `"online_user"`. `staff` = count of `"staff"`.

### UI Changes

**`BookingDrawer`** — below the booking ref line, add a small badge:

- `"online_guest"` or `"online_user"` → "Online" (subtle grey pill)
- `"staff"` → "Staff entry" (subtle grey pill)

**`ReportsClient`** — below the two existing stat cards (Bookings, Player spots), add a simple two-cell row showing "Online bookings: N" and "Staff entries: N."

### Critical Files

| File | Change |
|---|---|
| `packages/db/src/schema/bookings.ts` | Add `source` column |
| `packages/db/drizzle/` | Generate + apply migration |
| `apps/api/src/routes/publicClub.ts` | Set `source` and `userId` in both booking creation paths |
| `apps/api/src/routes/bookingOperations.ts` | Set `source = "staff"` in `POST /`; add `source` to `GET /:bookingId` response |
| `apps/api/src/routes/clubs.ts` | Add `sources` to reports totals |
| `apps/web/components/teesheet/types.ts` | Add `source` to `BookingDetail` |
| `apps/web/components/teesheet/BookingDrawer.tsx` | Render source badge |
| `apps/web/app/(club)/club/[clubId]/reports/ReportsClient.tsx` | Render source breakdown row |

### Verification

| Scenario | Expected result |
|---|---|
| Submit booking via public flow (no login) | `source = "online_guest"`, `userId = null` |
| Submit booking via public flow while logged in | `source = "online_user"`, `userId` populated |
| Staff creates booking via AddBookingModal | `source = "staff"`, `userId` = staff member's id |
| Open BookingDrawer on a guest booking | "Online" badge visible below booking ref |
| Open BookingDrawer on a staff booking | "Staff entry" badge visible |
| Visit Reports page | Source breakdown row shows correct online/staff split |

---

## Feature B — Golfer "My Bookings" Portal

> **Requires:** `userId` fix from Feature A.

### Gap

Authenticated golfers have no page to view or manage their own bookings. The `bookings.userId` FK exists but was never populated (fixed in Feature A). The only golfer interface is the anonymous public booking flow.

### New API Route

Create `apps/api/src/routes/me.ts` and mount it at `/api/me` in `app.ts` (before `publicClubRoutes`).

**`GET /api/me/bookings`** — requires `authenticate` middleware.

Query parameters:
- `upcoming`: `"true"` | `"false"` — if not provided, returns both sections
- `page`: int, default 1
- `limit`: int, max 50, default 20

Response:

```jsonc
{
  "upcoming": [
    {
      "id": "uuid",
      "bookingRef": "PIN-0042",
      "status": "confirmed",
      "playersCount": 2,
      "createdAt": "ISO",
      "isCancellable": true,          // computed: teeSlot.datetime - now > cancellationHours
      "teeSlot": {
        "datetime": "ISO",
        "courseName": "Championship Course",
        "clubName": "Pinebrook Golf Club",
        "clubSlug": "pinebrook"
      }
    }
  ],
  "past": [ /* same shape, isCancellable always false */ ],
  "total": 14
}
```

`isCancellable` is computed server-side using the same `isCancellable()` utility from `apps/api/src/lib/cancellation.ts` that the guest cancel path already uses.

### New Route Group + Page

Create a `(golfer)` route group.

**`apps/web/app/(golfer)/layout.tsx`** — checks for an authenticated session via `auth()`. Redirects to `/login?redirect=/my-bookings` if unauthenticated.

**`apps/web/app/(golfer)/my-bookings/page.tsx`** — server component that fetches from `/api/me/bookings` with the session token. Passes data to `MyBookingsClient`.

**`apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx`** — client component.

Two sections: "Upcoming" and "Past." Each booking card shows:
- Date + time (formatted in the club's timezone from `teeSlot.datetime`)
- Course name and club name
- Player count
- Booking ref (monospace)
- Status badge
- For upcoming bookings: a "Cancel" button

**Cancel flow:**
1. Client calls `GET /api/bookings/:id/cancel-token?email=` with the golfer's email (from session).
2. On success, calls `DELETE /api/bookings/:id?token=` with the received token.
3. On 403 `OUTSIDE_WINDOW`: shows an inline message "Cancellation window has passed — please contact the club." Button is disabled.
4. On success: booking moves from Upcoming to Past section with status "Cancelled."

**Nav link:** The public booking success page (`apps/web/app/book/[slug]/success/page.tsx`) gains a "View my bookings →" link, shown only when `useSession()` returns an authenticated session.

### Critical Files

| File | Change |
|---|---|
| `apps/api/src/routes/me.ts` | New file |
| `apps/api/src/app.ts` | Mount `me` router at `/api/me` |
| `apps/web/app/(golfer)/layout.tsx` | New auth guard layout |
| `apps/web/app/(golfer)/my-bookings/page.tsx` | New server page |
| `apps/web/app/(golfer)/my-bookings/MyBookingsClient.tsx` | New client component |
| `apps/web/app/book/[slug]/success/page.tsx` | Add "View my bookings" link for authenticated users |

### Verification

| Scenario | Expected result |
|---|---|
| Visit `/my-bookings` while logged out | Redirected to `/login?redirect=/my-bookings` |
| Log in as a golfer with past bookings | Upcoming and Past sections populated |
| Click Cancel on an upcoming booking within window | Booking moves to Past with "Cancelled" status |
| Click Cancel outside the cancellation window | Inline message: "Cancellation window has passed" |
| Complete a booking while logged in, then visit success page | "View my bookings" link visible |

---

## Feature C — Waitlist for Fully-Booked Slots

> **Priority: Independent.** Can be built in parallel with Feature B.

### Gap

`features.waitlist` flag exists in the platform feature flags UI but has zero backend implementation. When a slot is full, golfers have no recourse.

### New DB Table

`waitlistEntries`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `teeSlotId` | uuid FK → teeSlots | |
| `email` | text | |
| `name` | text | |
| `playersCount` | int | |
| `token` | uuid unique | Claim token — generated on insert |
| `notifiedAt` | timestamptz nullable | Set when claim email is sent |
| `createdAt` | timestamptz defaultNow | |

Index on `(teeSlotId, createdAt)` for ordered queue queries.
Unique constraint on `(teeSlotId, email)` to prevent duplicate entries per slot.

### API — Join Waitlist

**`POST /api/clubs/public/:slug/waitlist`** — rate-limited with existing `publicRateLimit`.

Validation:
1. Club exists and slug resolves.
2. `features.waitlist` platform setting is `true`. Return 403 with `{ code: "WAITLIST_DISABLED" }` if not.
3. Target slot is full (`bookedPlayers >= maxPlayers`) and `status = "open"`. Return 409 with `{ code: "SLOT_NOT_FULL" }` if there is space (golfer should book normally).
4. No existing entry for this `(teeSlotId, email)` combination. Return 409 with `{ code: "ALREADY_ON_WAITLIST", position: N }` if duplicate.

Request body (validated by `JoinWaitlistSchema` in validators):
```json
{ "teeSlotId": "uuid", "email": "string", "name": "string", "playersCount": 1–4 }
```

Response:
```json
{ "position": 3 }
```

Position is computed as `COUNT(*) WHERE teeSlotId = X AND notifiedAt IS NULL AND createdAt < entry.createdAt + 1`.

### API — Claim

**`GET /api/waitlist/claim?token=…`** — mounted directly under `/api` in `app.ts`.

Steps:
1. Find `waitlistEntry` by `token`. Return 404 if not found.
2. Check `createdAt` is within the last 24 hours. Return 410 `{ code: "TOKEN_EXPIRED" }` if stale.
3. Check `notifiedAt IS NOT NULL` (entry was notified). Return 409 `{ code: "ALREADY_CLAIMED" }` if already used.
4. Load the associated `teeSlot`. Check `status = "open"` and `bookedPlayers + entry.playersCount <= maxPlayers`. Return 409 `{ code: "SLOT_FULL_AGAIN" }` if no space opened up.
5. Create a booking inside a transaction: same logic as the public free booking path. Use `entry.email`, `entry.name`, `entry.playersCount`. Set `source = "online_guest"`.
6. Mark `waitlistEntry.notifiedAt = NOW()` (prevents re-use).
7. Redirect to `/book/:slug/success?bookingRef=...&datetime=...&players=...&slotType=...` — passing all query params the success page reads.

### Cancel Trigger

In `bookingOperations.ts`, in the `DELETE /:bookingId` handler, **after** the cancellation transaction commits:

```ts
// After invalidateAvailabilityCache call, before sending response:
const firstWaiting = await db.query.waitlistEntries.findFirst({
  where: and(
    eq(waitlistEntries.teeSlotId, slot.id),
    isNull(waitlistEntries.notifiedAt)
  ),
  orderBy: [asc(waitlistEntries.createdAt)],
});

if (firstWaiting) {
  await enqueueEmail("email:waitlist-notify", {
    waitlistEntryId: firstWaiting.id,
    clubName: club.name,
    clubSlug: club.slug,
    whenLabel: slot.datetime.toISOString(),
  });
}
```

The email worker sets `notifiedAt` on the entry after successfully sending. If the email fails (job fails), `notifiedAt` stays null so the next cancel attempt can retry.

### Email

**New job type** `email:waitlist-notify` in `apps/api/src/workers/emailWorker.ts`.

Loads the `waitlistEntry` by `waitlistEntryId` from `data`. Builds the claim URL:
`${process.env.NEXT_PUBLIC_APP_URL}/api/waitlist/claim?token=${entry.token}`

Sends via Resend. Sets `waitlistEntries.notifiedAt = new Date()` after successful send.

**New template** `apps/api/src/emails/WaitlistNotify.tsx`:
- Club name
- "A spot has opened up!" heading
- Tee time (formatted)
- "Claim your spot" CTA button linking to the claim URL
- Expiry notice: "This link expires in 24 hours."
- Party size confirmation

### Times Page Changes

In `apps/web/app/book/[slug]/times/page.tsx`, the inline `SlotRow` component gains a waitlist branch.

Current logic: `available` (boolean) — if false, render a disabled greyed row showing "Full."

New logic: when `slot.bookedPlayers >= slot.maxPlayers && slot.status === "open"`:

- Render an amber outlined "Join Waitlist" button instead of the greyed disabled row.
- Clicking expands an inline form below that slot row:
  - Name (text input)
  - Email (email input)
  - Players stepper (1–4, max capped at `slot.maxPlayers`)
  - "Join Waitlist" submit button
- On submit: `POST /api/clubs/public/:slug/waitlist`. On success: collapse form, show inline confirmation: "You're on the waitlist — we'll email you if a spot opens."
- On `ALREADY_ON_WAITLIST` error: show "You're already on the waitlist for this time."
- Feature flag check: if the API returns 403 `WAITLIST_DISABLED`, the "Join Waitlist" button does not render (slot remains greyed-out as before).

Note: the `SlotRow` component is currently defined inline at the bottom of the `times/page.tsx` file. Extract it to its own function or file before adding the waitlist branch to keep the file manageable.

### Critical Files

| File | Change |
|---|---|
| `packages/db/src/schema/waitlist.ts` | New file — `waitlistEntries` table |
| `packages/db/src/schema/index.ts` | Export `waitlistEntries` |
| `packages/db/drizzle/` | Generate + apply migration |
| `packages/validators/src/waitlist.ts` | New file — `JoinWaitlistSchema` |
| `packages/validators/src/index.ts` | Export new schema |
| `apps/api/src/routes/publicClub.ts` | Add `POST /clubs/public/:slug/waitlist` |
| `apps/api/src/app.ts` | Mount `GET /api/waitlist/claim` handler |
| `apps/api/src/routes/bookingOperations.ts` | Add waitlist notify trigger in DELETE handler |
| `apps/api/src/workers/emailWorker.ts` | Add `email:waitlist-notify` job type |
| `apps/api/src/emails/WaitlistNotify.tsx` | New email template |
| `apps/web/app/book/[slug]/times/page.tsx` | Waitlist branch in SlotRow + inline form |

### Verification

| Scenario | Expected result |
|---|---|
| Slot has 0/4 capacity | Normal Book button; no waitlist |
| Slot is 4/4 full; `features.waitlist = true` | "Join Waitlist" amber button shown |
| Slot is 4/4 full; `features.waitlist = false` | Greyed-out "Full" row — no waitlist button |
| Submit waitlist form | Confirmation message shown; `position` returned |
| Submit same email+slot twice | "Already on the waitlist" message |
| Cancel the original booking | Waitlist claim email sent to first entry |
| Click claim link within 24h; slot has space | Booking created; redirected to success page |
| Click claim link after 24h | 410 page: "This link has expired" |
| Click claim link after slot re-filled | 409 page: "Sorry, this slot filled again" |

---

## Feature D — Add-On / Upsell Catalog

> **Requires:** Plan 1 (Inventory) complete. The `addonCatalog.resourceTypeId` FK target must exist.

### Gap

No booking add-ons exist. Clubs cannot offer or price extras (cart rental, club hire, F&B packages). Extras are currently untracked, unpriced, and invisible to reports.

### New DB Tables

**`addonCatalog`** — per-club bookable items:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clubId` | uuid FK → clubs | |
| `name` | text | "Rental Clubs", "GPS Unit", "F&B Package" |
| `description` | text nullable | |
| `priceCents` | int | Price in cents. 0 = free add-on. |
| `resourceTypeId` | uuid FK → resourceTypes SET NULL nullable | Links to inventory for availability checks. `assignmentStrategy` on the linked type governs whether items are assigned at booking or at check-in. |
| `unitsConsumed` | int default 1 | How many pool/individual units this add-on uses per booking |
| `taxable` | bool default true | |
| `sortOrder` | int default 0 | |
| `active` | bool default true | |
| `createdAt` | timestamptz defaultNow | |
| `updatedAt` | timestamptz | |

**`bookingAddonLines`** — line items per booking:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bookingId` | uuid FK → bookings CASCADE | |
| `addonCatalogId` | uuid FK → addonCatalog RESTRICT | RESTRICT preserves history; deactivate don't delete catalog items |
| `resourceTypeId` | uuid FK → resourceTypes SET NULL nullable | Denormalized from addonCatalog at insert time for efficient overlap queries |
| `resourceItemId` | uuid FK → resourceItems SET NULL nullable | Set when staff assigns a specific unit (manual assignment mode) |
| `quantity` | int | |
| `unitPriceCents` | int | Snapshot of `priceCents` at booking time — catalog price changes don't affect past bookings |
| `bookingStart` | timestamptz nullable | Precomputed: `teeSlot.datetime`. Null for non-rental add-ons. |
| `bookingEnd` | timestamptz nullable | Precomputed: `teeSlot.datetime + resolvedWindowMinutes + turnaroundBufferMinutes`. Null for non-rental add-ons. |
| `status` | text | `"pending"` \| `"confirmed"` \| `"cancelled"` |
| `notes` | text nullable | |
| `createdAt` | timestamptz defaultNow | |

Add a composite index on `(resource_type_id, booking_start, booking_end)` in the migration. This makes the overlap query a fast indexed range scan.

**Why `bookingStart`/`bookingEnd` are stored, not computed:**

The alternative — resolving the window at query time via `JOIN resource_types + JSON lookup per row` — is expensive and becomes the hot path at scale. Pre-storing the occupied interval at insert time means the overlap query becomes:

```sql
WHERE bal.resource_type_id = :typeId
  AND bal.booking_start < :newEnd
  AND bal.booking_end > :newStart
  AND bal.status != 'cancelled'
```

No JSON lookup per row. No join to `tee_slots` or `resource_types` in the overlap clause. If a booking is moved to a different tee slot, the `bookingAddonLines` rows are deleted and re-inserted (with new `bookingStart`/`bookingEnd`) inside the move transaction in `bookingOperations.ts`.

### Availability Check at Booking Time — Concurrency-Safe

> **This check must run inside a DB transaction with a row-level lock.** Without the lock, two concurrent requests can both pass the check and both insert, exceeding capacity (oversell). This is the most critical correctness requirement in this feature.

The transaction pattern for **each** inventory-backed rental add-on:

```sql
BEGIN;

-- 1. Lock the resource type row for the duration of this transaction.
--    All other transactions trying to book this resource type will wait here.
SELECT id, total_units, tracking_mode
FROM resource_types
WHERE id = :typeId
FOR UPDATE;

-- 2. Run the overlap check using the precomputed indexed columns.
SELECT COALESCE(SUM(quantity * :unitsConsumed), 0) AS allocated
FROM booking_addon_lines bal
JOIN bookings b ON bal.booking_id = b.id
WHERE bal.resource_type_id = :typeId
  AND bal.status != 'cancelled'
  AND b.deleted_at IS NULL
  AND bal.booking_start < :newBookingEnd
  AND bal.booking_end > :newBookingStart;

-- 3. If totalUnits - allocated >= requestedQuantity: insert.
INSERT INTO booking_addon_lines (
  booking_id, addon_catalog_id, resource_type_id,
  quantity, unit_price_cents,
  booking_start, booking_end,
  status
) VALUES (...);

COMMIT;
-- Lock released. Next waiting transaction may now proceed.
```

The lock is held for milliseconds. At golf club volumes this is not a bottleneck. If contention becomes measurable (hundreds of concurrent bookings for the same resource type), the upgrade path is a `resource_reservations` table with TTL holds — but that is explicitly out of scope.

**Full availability check logic per add-on:**

1. Lock the `resourceTypes` row for this add-on (`SELECT ... FOR UPDATE`).
2. If `usageModel = "consumable"` and `trackInventory = false`: skip — always available. No lock needed; release immediately.
3. If `usageModel = "consumable"` and `trackInventory = true`: use `UPDATE resource_types SET current_stock = current_stock - :qty WHERE id = :typeId AND current_stock >= :qty RETURNING id`. If no row returned: 409 `ADDON_UNAVAILABLE`.
4. If `usageModel = "rental"`:
   - Compute `bookingStart = teeSlot.datetime`.
   - Compute `bookingEnd = teeSlot.datetime + resolvedWindowMinutes + turnaroundBufferMinutes`.
   - Run the overlap COUNT query above.
   - Pool mode: available if `totalUnits - allocated >= requestedQuantity × unitsConsumed`.
   - Individual mode: available if count of `resourceItems WHERE operationalStatus = 'available' AND id NOT IN (SELECT resource_item_id FROM booking_addon_lines WHERE ... overlap ...)` >= `requestedQuantity × unitsConsumed`.
5. If check fails: rollback and return 409 `{ code: "ADDON_UNAVAILABLE", addonId, name }`.

For add-ons with `resourceTypeId IS NULL`: no inventory check, no lock, always available.

### API Endpoints

**Public (no auth):**

`GET /api/clubs/public/:slug/addons` — returns active catalog items for the booking flow.

```jsonc
[
  {
    "id": "uuid",
    "name": "Cart Rental",
    "description": "18-hole cart for 2 riders",
    "priceCents": 2500,
    "sortOrder": 0
  }
]
```

**Staff/admin (require `authenticate` + `requireClubAccess`):**

| Method | Path | Min role | Notes |
|---|---|---|---|
| `GET` | `/api/clubs/:clubId/addons` | staff | Full catalog including inactive |
| `POST` | `/api/clubs/:clubId/addons` | club_admin | Create catalog item |
| `PATCH` | `/api/clubs/:clubId/addons/:itemId` | club_admin | Update/deactivate |

**Booking creation extension:**

Both `publicClub.ts` and `bookingOperations.ts` booking creation paths accept an additional `addOns: [{ addonCatalogId: string, quantity: int }]` field in the request body.

These are processed inside the existing booking transaction:
1. Run availability checks for each inventory-backed add-on.
2. Insert `bookingAddonLines` rows.
3. For consumable+trackInventory=true: decrement `currentStock` in the same transaction.

`PublicBookingBodySchema` and `CreateBookingSchema` in `packages/validators/src/bookings.ts` are extended with the optional `addOns` array.

### Stripe Payment Extension

In `publicClub.ts`, `POST /bookings/public/payment-intent`:

```ts
const addonTotal = (body.addOns ?? []).reduce((sum, a) => {
  const item = catalogItems.find(c => c.id === a.addonCatalogId);
  return sum + (item?.priceCents ?? 0) * a.quantity;
}, 0);

const totalAmountCents = Math.round(bookingFee * players * 100) + addonTotal;
```

PaymentIntent is created with `totalAmountCents`. If `totalAmountCents = 0`, the free booking path is used (existing logic).

### Public Booking Confirm Page

In `apps/web/app/book/[slug]/confirm/page.tsx`:

Fetch `GET /api/clubs/public/:slug/addons` on page load. If the response is an empty array, the section is hidden entirely.

Below the tee time summary, add an "Add-ons" section:
- Each item: name, description (if present), price per unit, quantity stepper (0 to max — default max = 4 for items with `unitsConsumed = 1`, else 1).
- Running total below the stepper list, formatted as currency.
- Total fee section updated to show: green fee total + add-on total = grand total.

Selected add-ons are passed as `addOns` in the booking request body.

### Staff Create Modal (`AddBookingModal.tsx`)

Same stepper block as the public confirm page, using `GET /api/clubs/:clubId/addons` (authenticated). Free items (`priceCents = 0`) are included without affecting the payment amount shown. The `addOns` array is passed in the `POST /api/bookings` body.

### BookingDrawer

Between the Price section and the Players section, add an "Add-ons" section that renders only when `bookingAddonLines` is non-empty.

The `GET /api/bookings/:bookingId` response must be extended to include:

```jsonc
"addons": [
  {
    "id": "uuid",                         // bookingAddonLine id
    "name": "Rental Clubs",
    "quantity": 2,
    "unitPriceCents": 2500,
    "status": "confirmed",
    "assignmentStrategy": "manual",       // from linked resourceType; null for non-inventory add-ons
    "assignments": [                      // from booking_resource_assignments
      { "id": "uuid", "label": "Blue Bag Set", "assignedBy": "Staff Name" },
      { "id": null,   "label": null,       "assignedBy": null }  // slot not yet assigned
    ]
  }
]
```

`assignments` has one entry per unit in `quantity`. Unassigned slots have `id = null`. The number of entries always equals `quantity`.

`BookingDetail` type in `types.ts` is extended accordingly.

**Assignment display rules:**

- `assignmentStrategy = "none"` or `resourceTypeId = null`: show name + quantity + price only. No assignment UI.
- `assignmentStrategy = "auto"`: show assigned labels (set at booking time). No staff action needed.
- `assignmentStrategy = "manual"`: show one row per quantity slot. Unassigned slots show a dropdown of available items. Assigned slots show the label with an "Unassign" option. Staff can reassign by unassigning then assigning a new item.

**Assignment endpoint:** `POST /api/bookings/:bookingId/addons/:lineId/assignments` with `{ resourceItemId }`. See Plan 1 Assignment API for full validation steps. No resource type lock required — this is assignment to already-reserved capacity.

**Unassign endpoint:** `DELETE /api/bookings/:bookingId/addons/:lineId/assignments/:assignmentId` — removes the `booking_resource_assignments` row, returning the slot to unassigned.

### Email Extension (`BookingConfirmation.tsx`)

The `sendConfirmationEmail` function in `emailWorker.ts` fetches the booking with `bookingAddonLines` joined. When add-on lines are present, `BookingConfirmationEmail` renders an "Add-ons" section:

```
Cart Rental    ×1    $25.00
Club Hire      ×2    $40.00
─────────────────────────
Add-ons total         $65.00
```

### Club Admin Catalog Page (`/club/:clubId/addons`)

Table of catalog items: name, price, inventory link (resource type name or "—"), active toggle, drag handle for reorder.

"Add item" button opens a form:
- Name, description, price (dollars, converted to cents), taxable toggle
- Inventory link: optional dropdown of `resourceTypes` for this club — selecting one shows the type's `assignmentStrategy` as read-only context ("Items are assigned automatically" or "Items are assigned at check-in"), and enables the `unitsConsumed` field
- Sort order, active toggle

Edit-in-place for name and price on existing rows.

**Sidebar nav addition** in `Sidebar.tsx`, management section — add after "Resources":

```ts
{ href: `${base}/addons`, label: "Add-ons", icon: <ShoppingBag /> }
```

Import `ShoppingBag` from `lucide-react`.

### Critical Files

| File | Change |
|---|---|
| `packages/db/src/schema/addons.ts` | New file — `addonCatalog` + `bookingAddonLines` tables (with `bookingStart`, `bookingEnd`, `resourceTypeId`; no `resourceItemId` or `requiresAssignment` on the line — assignments live in `booking_resource_assignments`) |
| `packages/db/src/schema/index.ts` | Export new tables |
| `packages/db/drizzle/` | Generate + apply migration; includes composite index on `booking_addon_lines(resource_type_id, booking_start, booking_end)` |
| `packages/validators/src/addons.ts` | New file |
| `packages/validators/src/bookings.ts` | Extend `PublicBookingBodySchema` and `CreateBookingSchema` with `addOns` |
| `packages/validators/src/index.ts` | Export new schemas |
| `apps/api/src/routes/addons.ts` | New file — catalog CRUD + public endpoint |
| `apps/api/src/app.ts` | Mount addons router |
| `apps/api/src/routes/publicClub.ts` | Concurrency-safe availability check + addon lines in booking transaction; auto-assignment logic for `assignmentStrategy="auto"`; Stripe amount extension |
| `apps/api/src/routes/bookingOperations.ts` | Addon lines in staff booking creation (with lock); extend GET response with `assignments` array; add assignment POST/DELETE endpoints; re-insert addon lines on booking move |
| `apps/api/src/emails/BookingConfirmation.tsx` | Add-on line items section |
| `apps/web/app/book/[slug]/confirm/page.tsx` | Add-ons stepper + running total |
| `apps/web/components/teesheet/AddBookingModal.tsx` | Add-ons stepper |
| `apps/web/components/teesheet/BookingDrawer.tsx` | Add-on lines section + per-slot assignment UI driven by `assignmentStrategy` |
| `apps/web/components/teesheet/types.ts` | Extend `BookingDetail` with `addons` including `assignmentStrategy` and `assignments` array |
| `apps/web/app/(club)/club/[clubId]/addons/page.tsx` | New server page |
| `apps/web/app/(club)/club/[clubId]/addons/AddonsClient.tsx` | New client component |
| `apps/web/components/club/Sidebar.tsx` | Add "Add-ons" nav entry |

### Verification

| Scenario | Expected result |
|---|---|
| Create "Rental Clubs" add-on linked to individual/manual resource type | Appears in public catalog; linked resource type shown |
| Create "GPS Unit" add-on linked to pool resource type | Appears in catalog; no assignment UI since pool strategy is `"none"` |
| Golfer selects rental clubs add-on at confirm step | Add-on total added to Stripe PaymentIntent amount |
| Booking confirmed with rental clubs (manual strategy, qty 2) | `bookingAddonLine` created with `qty=2`, `bookingStart`/`bookingEnd` precomputed; no `booking_resource_assignments` rows yet |
| Booking confirmed with GPS units (pool strategy, qty 2) | `bookingAddonLine` created; no assignment rows (pool mode never assigns) |
| Booking confirmed with add-on linked to auto-strategy type (qty 2) | Two `booking_resource_assignments` rows created; `assignedBy=null`; BookingDrawer shows both labels |
| Open BookingDrawer on manual-strategy booking with qty 2 | "Add-ons" section shows 2 unassigned slots with item dropdowns |
| Staff assigns item from dropdown | `booking_resource_assignments` row created; slot shows label and staff name |
| Staff unassigns item | Assignment row deleted; slot returns to dropdown state |
| Staff tries to assign item in maintenance | Rejected: `operationalStatus != 'available'` |
| Two concurrent requests both try to book the last unit | Only one succeeds; second gets 409 `ADDON_UNAVAILABLE` — row lock prevented oversell |
| All units reserved by overlapping bookings; new booking tries to add the add-on | 409 `ADDON_UNAVAILABLE` |
| Create add-on with no resource link | Always available; no inventory check; no assignment UI |
| Confirm booking with add-ons | Email includes add-on line items section |
| Booking is moved to a different tee slot | Old addon lines deleted; new lines inserted with recomputed `bookingStart`/`bookingEnd` |

---

## Feature E — Revenue & Occupancy in Reports

> **Revenue:** No dependencies. Can ship independently.
> **Add-on revenue:** Requires Feature D.
> **Occupancy:** Requires calling `slotGenerator.ts` per day for the denominator — more expensive than simple aggregation.

### Gap

Reports only show booking count and player-spot totals. `tee_slots.price` and `bookings.players_count` already exist. No revenue, no occupancy, no period picker beyond 7-day.

### API Changes (`apps/api/src/routes/clubs.ts`)

**Raise the `days` cap** from 31 to 90.

**Extend each day's query** in the `GET /reports` loop to also compute:

- `revenueGreenFees`: `SUM(tee_slots.price * bookings.players_count)` for the day (already joinable)
- `revenueAddons`: `SUM(booking_addon_lines.unit_price_cents * booking_addon_lines.quantity) / 100` — add to query once Feature D exists; return 0 before that
- `totalSlots`: call `generateSlots(config, date)` for each course and sum the count — this is the occupancy denominator. Cache the result per `(clubId, date)` if the per-day loop becomes slow.
- `occupancyPct`: `bookedPlayers > 0 slots / totalSlots * 100` (rounded to 1 decimal)

Updated response shape:

```jsonc
{
  "days": 30,
  "series": [
    {
      "date": "2026-04-01",
      "bookings": 8,
      "players": 18,
      "revenueGreenFees": 360.00,
      "revenueAddons": 45.00,
      "occupancyPct": 62.5
    }
  ],
  "totals": {
    "bookings": 42,
    "players": 98,
    "revenueGreenFees": 1840.00,
    "revenueAddons": 210.00,
    "occupancyPct": 58.3,
    "sources": { "online": 35, "staff": 7 }
  }
}
```

### UI Changes (`ReportsClient.tsx`)

**Period picker:** Replace the hardcoded `?days=7` server fetch. Convert `ReportsClient` to a full client component that manages the selected period in state. Add a `<select>` at the top-right of the page: "7 days / 30 days / 90 days" (default 30). Changing selection re-fetches from `/api/clubs/:clubId/manage/reports?days=N`.

**Two new stat cards** alongside the existing Bookings and Player spots cards:
- "Revenue" — total green fees + add-on revenue, formatted as USD
- "Occupancy %" — average occupancy across the period

**Daily table** gains a Revenue column between Players and the bar chart.

### Critical Files

| File | Change |
|---|---|
| `apps/api/src/routes/clubs.ts` | Raise days cap; add revenue + occupancy to series + totals |
| `apps/web/app/(club)/club/[clubId]/reports/page.tsx` | Pass `days` query param; support re-fetch on period change |
| `apps/web/app/(club)/club/[clubId]/reports/ReportsClient.tsx` | Period picker; revenue + occupancy stat cards; revenue column in table |

### Verification

| Scenario | Expected result |
|---|---|
| Navigate to Reports | Revenue and Occupancy cards populated |
| Change period to 7d | Data re-fetches; bar chart and table update |
| Change period to 90d | Data re-fetches; 90 rows in series; no error |
| Club has tee slots with prices | Revenue card shows non-zero value |
| All slots on a day are booked | Occupancy shows 100% for that day |

---

## Feature F — Dashboard Weekly Trend Sparkline

> **Priority: Nice-to-have. No dependencies. Can be built any time.**

### Gap

The Dashboard shows only today's counts with no trend context. A 7-day sparkline next to the "Bookings today" card would make the metric meaningful at a glance.

### Server Page Change (`dashboard/page.tsx`)

Add a second fetch alongside the existing `/summary` call:

```ts
const reportsRes = await fetch(
  `${apiBaseUrl()}/api/clubs/${clubId}/manage/reports?days=7`,
  { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
);
const reports = reportsRes.ok ? await reportsRes.json() : null;
const sparklineSeries: { date: string; bookings: number }[] =
  reports?.series ?? [];
```

Pass `sparklineSeries` as a prop to `DashboardClient`.

### Client Component Change (`DashboardClient.tsx`)

Add `sparklineSeries: { date: string; bookings: number }[]` to the props type.

In the "Bookings today" stat card, render an inline SVG sparkline:

```tsx
function Sparkline({ series }: { series: { bookings: number }[] }) {
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map(s => s.bookings));
  const w = 56, h = 24, pad = 2;
  const pts = series.map((s, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s.bookings / max) * (h - pad * 2));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
```

The sparkline renders below the bookings count in the stat card, in the `text-fairway` color class. No library dependency.

### Critical Files

| File | Change |
|---|---|
| `apps/web/app/(club)/club/[clubId]/dashboard/page.tsx` | Add reports fetch; pass `sparklineSeries` prop |
| `apps/web/app/(club)/club/[clubId]/dashboard/DashboardClient.tsx` | `Sparkline` component; render in stat card |

### Verification

| Scenario | Expected result |
|---|---|
| Visit Dashboard with 7 days of booking data | Sparkline renders below "Bookings today" count |
| No bookings in past 7 days | All points at baseline — flat line at bottom of SVG |
| One day has significantly more bookings | That point is visibly higher than the rest |
| Dashboard server fetch for reports fails | `sparklineSeries` defaults to `[]`; sparkline is not rendered (`series.length < 2` guard) |

---

## Build Order Summary

```
1. Feature A  (source tracking + userId fix)       — small, no deps, fixes a data bug
2. Feature B  (my bookings)                        — unblocked by A
3. Feature C  (waitlist)                           — can run in parallel with B
4. Feature F  (sparkline)                          — can run any time, tiny scope
5. Plan 1     (inventory management)               — independent of all Plan 2 features
6. Feature D  (add-on catalog)                     — blocked on Plan 1
7. Feature E  (revenue + occupancy in reports)     — revenue can ship before D; occupancy any time; add-on revenue after D
```
