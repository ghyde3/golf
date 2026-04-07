# Plan 1 — Inventory & Resource Management

> **Scope:** Establish the full resource/inventory foundation for the TeeTimes platform. This plan covers the DB schema, API, and staff UI for three usage models (rental, consumable, service). It does not include the public-facing Add-On Catalog — that is Plan 2, Feature D, which builds on top of this plan.

---

## Design Principles

1. **Usage model is the primary discriminator.** How a resource behaves (rented and returned, consumed and gone, or service-based) determines all downstream logic. Tracking mode (pool vs individual) is secondary and only applies to rentals and services.
2. **Rentals auto-hold based on the booking.** No staff action is required to mark a cart as "in use." The hold is computed from `bookingAddonLines` rows — not a stored status field. When the rental window expires, units are automatically available again with no cron job required.
3. **Rental windows are per-slot-type, not a single number.** A 9-hole round and an 18-hole round don't return a cart at the same time. Clubs configure the expected window per format (9-hole, 18-hole, 27-hole, 36-hole) plus a turnaround buffer.
4. **Consumables can be sold with or without stock tracking.** A club selling towels may not want to count every towel — they just want it to appear in the add-on catalog. Stock tracking is opt-in per resource type.
5. **`item_status` is operational; `in_use` is computed, never stored.** Storing `in_use` on the item row creates a derived-state maintenance problem. The item row only ever reflects physical condition: `available`, `maintenance`, or `retired`. Whether a unit is logically occupied by a booking is determined at query time from `bookingAddonLines`.
6. **Availability checks run inside a transaction with a row lock.** The check-then-insert pattern is only safe when the resource type row is locked during the transaction. Without this, concurrent bookings will oversell inventory.
7. **`booking_start` and `booking_end` are precomputed and stored on `bookingAddonLines`.** The rental window resolution (jsonb lookup + slotType join) is expensive at scale. Pre-storing the actual occupied interval makes the overlap query a simple indexed range check.
8. **`meta` jsonb provides per-type flexibility** for attributes not worth making into first-class columns (e.g., caddie handicap, cart battery type, club set condition rating).
9. **`service` is a defined placeholder.** Lessons, fittings, and simulator bays require a calendar-based scheduling engine. This plan records the category and displays it in the UI but deliberately defers availability logic. This is not a small feature — plan a dedicated scheduling system when the time comes.

---

## On Golf Round Formats

27 holes is played regularly — particularly at courses with three 9-hole loops. 36 holes occurs at club days, charity tournaments, and competitive amateur rounds. The system supports:

| `slotType` value | Typical on-course time | Example cart window (inc. turnaround) |
|---|---|---|
| `9hole` | ~2 h 15 min | ~2 h 45 min (165 min) |
| `18hole` | ~4 h 30 min | ~5 h 00 min (300 min) |
| `27hole` | ~6 h 45 min | ~7 h 30 min (450 min) |
| `36hole` | ~9 h 00 min | ~9 h 45 min (585 min) |

The existing `tee_slots.slotType` column already stores `"9hole"` and `"18hole"`. This plan extends it with `"27hole"` and `"36hole"` as valid values. The `bookings.ts` schema and `slotGenerator.ts` must be updated accordingly.

Clubs configure the window per resource type — a caddie and a golf cart do not have the same return schedule. The rental window should include a turnaround buffer configured separately (see `turnaroundBufferMinutes` below).

---

## Schema

### `resourceTypes`

The category-level table. One row per type of asset per club.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `clubId` | uuid FK → clubs | |
| `name` | text | "Golf Carts", "Towels", "Caddies" |
| `usageModel` | text | `"rental"` \| `"consumable"` \| `"service"` |
| `trackingMode` | text nullable | `"pool"` \| `"individual"` — required for `rental`/`service`; null for `consumable` |
| `assignmentMode` | text nullable | `"auto"` \| `"manual"` \| `"none"` — rental/individual only. See Assignment Mode below. |
| `totalUnits` | int nullable | Pool mode: hard capacity ceiling. Individual mode: derived from item count at query time. |
| `trackInventory` | bool default true | Consumable only. `false` = unlimited, no stock check ever performed. |
| `currentStock` | int nullable | Consumable + `trackInventory=true`: current on-hand count. Decrements on sale, increments on restock. |
| `rentalWindows` | jsonb nullable | Rental only. Maps slotType → minutes (excluding buffer). See format below. |
| `turnaroundBufferMinutes` | int default 0 | Added to rental window end. Prevents back-to-back allocation with no cleaning time. |
| `notes` | text nullable | Internal staff notes |
| `sortOrder` | int default 0 | Controls display order on the Resources page |
| `active` | bool default true | Inactive types are hidden from the add-on catalog |
| `createdAt` | timestamptz defaultNow | |

**`usageModel` values:**

- `"rental"` — physical asset that leaves and returns. Golf carts, GPS units, club sets, push carts. Availability computed from active booking holds in the rental window.
- `"consumable"` — asset consumed on sale. Towels, range balls, F&B packages, golf tees. If `trackInventory = false`, always available (no stock check). If `trackInventory = true`, availability is `currentStock > 0`.
- `"service"` — reserved category for future scheduling (lessons, fittings, simulator bays). No availability logic in this plan. The UI shows the entry but marks it "availability managed manually." Do not conflate with `rental` — a service scheduling engine is a fundamentally different system.

**`assignmentMode` values (rental + individual tracking mode only):**

- `"auto"` — the system picks the first available item at booking time and sets `bookingAddonLines.resourceItemId`. Golfer and staff see the assignment immediately.
- `"manual"` — the system holds capacity at booking time (counts units) but does not assign a specific item. Staff assign a specific item at check-in via the BookingDrawer. This is the recommended default — operationally flexible.
- `"none"` — used for pool mode (no items to assign). Set automatically; not user-configurable.

For **pool mode**, `assignmentMode` is always `"none"` — there are no individual items to assign.

**`rentalWindows` jsonb format:**

```json
{ "9hole": 150, "18hole": 270, "27hole": 420, "36hole": 540, "default": 270 }
```

All values in minutes, **not including** `turnaroundBufferMinutes`. The effective occupied window for overlap queries is:

```
effectiveEnd = bookingStart + rentalWindowMinutes + turnaroundBufferMinutes
```

The `"default"` key is the fallback when the booking's slot type is not listed. Resolution:

```
rentalWindows[booking.teeSlot.slotType] ?? rentalWindows["default"] ?? 480
```

The 480-minute (8-hour) hard fallback prevents undefined behaviour if neither key is present. Clubs are warned in the UI if they save a rental type with no `"default"` set.

**Why `turnaroundBufferMinutes` is separate from `rentalWindows`:**

A club may want to show golfers "cart rental: 4.5 hours" in the catalog while actually blocking 5 hours (with a 30-min turnaround). Keeping these separate means the displayed rental duration and the operational hold are independently configurable.

---

### `resourceItems`

Per-unit records. Only populated for `trackingMode = "individual"` resource types.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceTypeId` | uuid FK → resourceTypes CASCADE | |
| `clubId` | uuid | Denormalized for query efficiency |
| `label` | text | "Cart #7", "Tom H.", "Blue Bag Set" |
| `operationalStatus` | text | `"available"` \| `"maintenance"` \| `"retired"` |
| `maintenanceNote` | text nullable | "Needs new front tire — in shop" |
| `lastServicedAt` | timestamptz nullable | |
| `meta` | jsonb nullable | Flexible per category |
| `sortOrder` | int default 0 | |
| `createdAt` | timestamptz defaultNow | |
| `updatedAt` | timestamptz | |

**`operationalStatus` — physical condition only, never `in_use`:**

`in_use` is a derived state computed at query time from active `bookingAddonLines`. It is not stored. This prevents the class of bugs where a status update is missed, leaving an item permanently stuck as `in_use` after a booking is cancelled or a window expires.

The UI shows a fourth visual state — "In Use (booked)" — which is computed from the overlap query. The underlying `operationalStatus` remains `"available"` when a unit is booked but physically sound.

| `operationalStatus` value | Meaning |
|---|---|
| `available` | Unit is physically sound and ready to use |
| `maintenance` | Unit is physically unserviceable — in the shop, broken, etc. |
| `retired` | Permanently decommissioned. Never returns to service. |

**Status transition rules:**

| From | To | Trigger |
|---|---|---|
| `available` | `maintenance` | Staff marks it |
| `maintenance` | `available` | Staff clears it |
| `any` | `retired` | Staff retires — permanent; no transition back |

**Manual override always wins for availability:** When `operationalStatus = "available"` and there is an active booking line, the UI shows "In Use (booked)" but the item is not blocked from re-assignment if the booking line is cancelled. When `operationalStatus = "maintenance"` or `"retired"`, the item is always excluded from the available pool regardless of booking state.

---

### `resourceItemStatusLog`

Audit trail for every operational status change on individual items.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceItemId` | uuid FK → resourceItems | |
| `fromStatus` | text | Previous `operationalStatus` value |
| `toStatus` | text | New `operationalStatus` value |
| `reason` | text nullable | Optional staff note |
| `changedBy` | uuid FK → users | |
| `changedAt` | timestamptz defaultNow | |

Every `PATCH /items/:itemId` that changes `operationalStatus` inserts a log row in the same transaction. This gives a full audit trail: who marked Cart #7 as maintenance, when it came back, who retired it.

---

### `resourceRestockLog`

Audit trail for consumable stock changes.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceTypeId` | uuid FK → resourceTypes | |
| `deltaQuantity` | int | Positive = restock/delivery. Negative = adjustment or write-off. |
| `reason` | text nullable | "Delivery #1234", "Write-off: water damaged" |
| `createdBy` | uuid FK → users | |
| `createdAt` | timestamptz defaultNow | |

When a row is inserted, `resourceTypes.currentStock` is incremented by `deltaQuantity` in the same transaction.

---

### `slotType` extension

Update `packages/db/src/schema/bookings.ts` to add `"27hole"` and `"36hole"` as valid values for `tee_slots.slotType`. Also update `slotGenerator.ts` and any TypeScript types referencing `slotType`.

---

## Concurrency Strategy — Preventing Oversell

> **This is the most critical correctness concern.** The availability check followed by an insert is only safe inside a serialised transaction. Without locking, two concurrent requests can both pass the check and both insert, exceeding capacity.

### The Problem

```
Request A: check → 1 cart available ✓
Request B: check → 1 cart available ✓   (A has not committed yet)
Request A: insert bookingAddonLine       (1 cart now allocated)
Request B: insert bookingAddonLine       (2 carts allocated — oversell)
```

### The Fix — Row-Level Lock on `resourceTypes`

Wrap the availability check and insert in a single DB transaction, acquiring a `SELECT ... FOR UPDATE` lock on the `resourceTypes` row at the start. This serialises all concurrent booking attempts for the same resource type.

```sql
BEGIN;

-- Acquire exclusive lock on the resource type row
SELECT id, total_units FROM resource_types
WHERE id = :typeId
FOR UPDATE;

-- Now run availability check (safe — no other transaction can modify this row)
SELECT COUNT(*) * :unitsConsumed as allocated
FROM booking_addon_lines bal
JOIN bookings b ON bal.booking_id = b.id
WHERE bal.resource_type_id = :typeId
  AND bal.status != 'cancelled'
  AND b.deleted_at IS NULL
  AND bal.booking_start < :newEnd
  AND bal.booking_end > :newStart;

-- If totalUnits - allocated >= requestedQuantity: proceed
INSERT INTO booking_addon_lines (...) VALUES (...);

COMMIT;
```

The lock is held only for the duration of the transaction (milliseconds). At the volumes a golf club operates, this is not a bottleneck. If the platform scales to high-volume multi-club load, the lock scope can be narrowed to a `resource_reservations` table (see Future Scaling note below).

**For consumable stock decrements**, use `UPDATE resource_types SET current_stock = current_stock - :qty WHERE id = :typeId AND current_stock >= :qty RETURNING id`. If no row is returned, the stock ran out between check and update — return 409.

### Future Scaling Note (not in this plan)

At very high concurrency, row-level locks on `resourceTypes` can become a bottleneck. The next step would be a `resource_reservations` table with short TTLs (5–10 minutes) used during the Stripe payment window. Reservations act as optimistic holds and expire automatically. This is the same pattern Ticketmaster and airline booking systems use. It is not needed at golf club scale.

---

## `booking_start` and `booking_end` on `bookingAddonLines`

> **This is the most important performance decision for the overlap query.**

Rather than joining `tee_slots` + `resource_types.rental_windows` on every availability check query, precompute the occupied interval at booking creation time and store it directly on the `bookingAddonLines` row.

These two columns are added to `bookingAddonLines` (defined in Plan 2, Feature D — documented here because the computation depends on inventory data):

| Column | Type | Notes |
|---|---|---|
| `bookingStart` | timestamptz | `= teeSlot.datetime` |
| `bookingEnd` | timestamptz | `= teeSlot.datetime + resolvedWindowMinutes + turnaroundBufferMinutes` |

The resolved window is computed **once** at insert time:

```ts
const windowMinutes =
  resourceType.rentalWindows?.[teeSlot.slotType] ??
  resourceType.rentalWindows?.["default"] ??
  480;
const bookingEnd = new Date(
  teeSlot.datetime.getTime() +
  (windowMinutes + resourceType.turnaroundBufferMinutes) * 60_000
);
```

The overlap query then becomes:

```sql
WHERE bal.booking_start < :newBookingEnd
  AND bal.booking_end > :newBookingStart
  AND bal.status != 'cancelled'
  AND b.deleted_at IS NULL
```

This is a simple indexed range scan. Add a composite index on `(resource_type_id, booking_start, booking_end)` and the query is fast at any realistic booking volume.

No JSON lookup per row. No join to `tee_slots` or `resource_types` for the overlap logic. The values are immutable once written (if a booking is moved to a different slot, `bookingAddonLines` rows are deleted and re-inserted within the move transaction).

---

## Individual Mode — Assignment and Quantity

### Quantity > 1 with Individual Mode

When `quantity > 1` and `trackingMode = "individual"` (e.g., a booking for 4 golfers wanting 4 carts):

- **Pool mode:** straightforward — just check `totalUnits - allocated >= requestedQuantity × unitsConsumed`.
- **Individual mode:** requires that `availableItemCount >= requestedQuantity × unitsConsumed`. The system holds that many units but does not assign all of them at booking time unless `assignmentMode = "auto"`.

For `assignmentMode = "auto"`, multiple `bookingAddonLines` rows are inserted — one per unit assigned — each with a distinct `resourceItemId`. The auto-selection picks items ordered by `sortOrder ASC, id ASC` from those with `operationalStatus = "available"` and not in an active booking window.

For `assignmentMode = "manual"`, a single `bookingAddonLines` row is inserted with `quantity = N` and `resourceItemId = null`. Staff assign items one at a time at check-in via the BookingDrawer. The capacity check still validates that N units are available.

### Assignment at Check-In (Manual Mode)

The `PATCH /api/bookings/:bookingId/addons/:lineId` endpoint (added in Feature D) accepts `{ resourceItemId }`. When set:

1. Validates the item belongs to the correct resource type and club.
2. Validates `operationalStatus = "available"`.
3. Validates the item is not in an active booking window for another booking (using `booking_start`/`booking_end`).
4. Sets `resourceItemId` on the line.

This is done without a resource type lock because it is an assignment to an already-reserved capacity slot, not a new capacity claim.

---

## Validators (`packages/validators/src/resources.ts`)

```
CreateResourceTypeSchema
  name: string (1–100 chars)
  usageModel: "rental" | "consumable" | "service"
  trackingMode: "pool" | "individual" | null
    -- required (non-null) when usageModel is "rental" or "service"
    -- must be null when usageModel is "consumable"
  assignmentMode: "auto" | "manual" | null
    -- required when usageModel="rental" and trackingMode="individual"
    -- must be null for pool mode and consumable
  totalUnits: positive int | null
    -- required when trackingMode is "pool"
  trackInventory: boolean
    -- required when usageModel is "consumable"; ignored for rental/service
  currentStock: non-negative int | null
    -- required when usageModel="consumable" and trackInventory=true
  rentalWindows: record<string, positive int> | null
    -- required when usageModel="rental"
    -- keys: "9hole" | "18hole" | "27hole" | "36hole" | "default"
    -- "default" key is required
    -- values in minutes (excluding turnaround buffer)
  turnaroundBufferMinutes: non-negative int default 0
    -- only meaningful for rental; ignored otherwise
  notes: string | null
  sortOrder: int | null

PatchResourceTypeSchema
  -- all fields optional, same cross-field constraints apply

CreateResourceItemSchema
  label: string (1–100 chars)
  operationalStatus: "available" | "maintenance"
    -- new items cannot start as retired
  maintenanceNote: string | null
  meta: record<string, unknown> | null
  sortOrder: int | null

PatchResourceItemSchema
  -- label, operationalStatus, maintenanceNote, lastServicedAt, meta, sortOrder — all optional
  -- operationalStatus transition to "retired" is allowed; back from "retired" is not
  -- if operationalStatus changes, a reason string is recommended (for status log)

RestockSchema
  deltaQuantity: int (non-zero; positive = restock, negative = adjustment)
  reason: string | null
```

---

## API Endpoints

All endpoints require `authenticate` + `requireClubAccess`. Type create/update/delete require `club_admin`. Item status updates, assignments, and restocks can be performed by `staff`.

| Method | Path | Min role | Notes |
|---|---|---|---|
| `GET` | `/api/clubs/:clubId/resources` | staff | List all types with computed availability |
| `POST` | `/api/clubs/:clubId/resources` | club_admin | Create resource type |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId` | club_admin | Update type |
| `DELETE` | `/api/clubs/:clubId/resources/:typeId` | club_admin | Soft-delete; blocked if active items exist |
| `GET` | `/api/clubs/:clubId/resources/:typeId/items` | staff | List items for individual-mode type |
| `POST` | `/api/clubs/:clubId/resources/:typeId/items` | club_admin | Add item |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId/items/:itemId` | staff | Update status, note, label; writes status log |
| `GET` | `/api/clubs/:clubId/resources/:typeId/items/:itemId/log` | staff | View status change history |
| `POST` | `/api/clubs/:clubId/resources/:typeId/restock` | staff | Log stock change for consumable types |

**`GET /resources` response shape per type:**

```jsonc
{
  "id": "uuid",
  "name": "Golf Carts",
  "usageModel": "rental",
  "trackingMode": "individual",
  "assignmentMode": "manual",
  "totalUnits": 12,
  "availableNow": 9,
    // individual: items with operationalStatus="available"
    //             AND not in an active booking window right now
    // pool: totalUnits - count of active overlapping booking lines right now
    // consumable+trackInventory=false: null  → UI shows "Unlimited"
    // consumable+trackInventory=true: currentStock
  "inMaintenance": 1,     // individual only: count of operationalStatus="maintenance"
  "inUseBooked": 2,       // individual only: count currently in active booking window
  "rentalWindows": { "9hole": 150, "18hole": 270, "default": 270 },
  "turnaroundBufferMinutes": 15,
  "active": true
}
```

---

## UI — `/club/:clubId/resources`

### Page structure

Three grouped sections: Rentals → Consumables → Services.

Each section has a heading and an "Add" button pre-filling `usageModel`. A top-level "Add resource type" button opens the full form starting with the model selector.

---

### Rental cards

Each card: name, tracking mode badge, assignment mode badge, available / total count, in-maintenance count.

For **individual mode**: expandable card showing each unit as a row with:
- Label
- Visual status: green dot (available and not booked), amber dot (booked — in active window), red dot (maintenance), grey dot (retired)
- Maintenance note when present
- "Mark maintenance" / "Mark available" buttons; "Retire" in kebab menu
- When `assignmentMode = "manual"` and unit is booked: shows which booking ref it is assigned to (if assigned)

For **pool mode**: aggregate counts + "Update capacity" inline field + "Currently allocated" read-only count.

---

### Consumable cards

- `trackInventory = false`: "Unlimited — not tracked" badge. Informational note.
- `trackInventory = true`: stock count, "Restock" button, "Adjust" option (negative delta, reason required).

---

### Service cards

Display-only. Name + "Availability managed manually" notice. A note: "Scheduling for services (lessons, fittings) is a separate future feature."

---

### Add / Edit resource type form

**All types:** name, usage model selector, notes, active toggle, sort order.

**Rental:**
- Tracking mode: Pool or Individual
- If Individual: assignment mode (Auto / Manual) with helper text explaining the difference
- If Pool: total units
- Rental windows: one row per slot format (hours input, converts ↔ minutes on save/load)
  - 9-hole, 18-hole, 27-hole, 36-hole, Default (required)
- Turnaround buffer (minutes) — labelled "Cleaning/staging buffer between rentals"
- Helper text: "Rental window is how long the resource is reserved after a tee time starts, shown to golfers. The turnaround buffer is added on top and is invisible to golfers — it prevents back-to-back bookings without cleaning time."

**Consumable:**
- Track inventory toggle
  - On: initial stock count
  - Off: "Always available — no stock check performed"

**Service:** no extra fields.

---

### Sidebar nav addition

`apps/web/components/club/Sidebar.tsx`, management section — between Courses and Staff:

```ts
{ href: `${base}/resources`, label: "Resources", icon: <Package /> }
```

---

## Critical Files

| Area | File | Change |
|---|---|---|
| DB schema | `packages/db/src/schema/resources.ts` | New — `resourceTypes`, `resourceItems`, `resourceItemStatusLog`, `resourceRestockLog` + relations |
| DB schema index | `packages/db/src/schema/index.ts` | Export new tables |
| DB bookings schema | `packages/db/src/schema/bookings.ts` | Add `"27hole"` and `"36hole"` to `slotType` |
| DB slot generator | `apps/api/src/lib/slotGenerator.ts` | Add `"27hole"` and `"36hole"` to `SlotType` |
| DB migration | `packages/db/drizzle/` | `pnpm db:generate` then `pnpm db:migrate` |
| DB index | Migration | Add composite index on `booking_addon_lines(resource_type_id, booking_start, booking_end)` — added when Feature D creates that table |
| Validators | `packages/validators/src/resources.ts` | New file |
| Validators index | `packages/validators/src/index.ts` | Export new schemas |
| API routes | `apps/api/src/routes/resources.ts` | New file |
| App mount | `apps/api/src/app.ts` | Mount resources router at `/api/clubs/:clubId` |
| Resources page | `apps/web/app/(club)/club/[clubId]/resources/page.tsx` | New server component |
| Resources client | `apps/web/app/(club)/club/[clubId]/resources/ResourcesClient.tsx` | New client component |
| Sidebar | `apps/web/components/club/Sidebar.tsx` | Add "Resources" nav entry |

---

## Known Limitations / Future Work

| Item | Notes |
|---|---|
| **Service scheduling** | `service` usageModel is a placeholder. A real scheduling engine (staff calendars, booking windows per instructor/bay) is a separate system of comparable complexity to this entire plan. Do not expand this without a dedicated plan. |
| **Pricing layer** | Resource types have no price. Pricing lives on `addonCatalog` (Plan 2, Feature D). This separation is intentional — the same resource type can back differently-priced add-ons (e.g., single-rider vs two-rider cart rental). |
| **Dynamic/peak pricing** | Not in scope. This plan stores no pricing. Peak pricing modifiers would be a future extension on `addonCatalog`. |
| **Resource reservations table** | For very high concurrency, replace the row lock with a `resource_reservations` table with TTL holds (Ticketmaster pattern). Not needed at golf club scale but documented as the known upgrade path. |
| **Quantity splitting on individual mode** | When `quantity > 1` with `assignmentMode = "auto"`, multiple lines are inserted with individual item IDs. The UI for viewing and managing multi-unit assignments is handled in Plan 2, Feature D (BookingDrawer). |

---

## Verification

| Scenario | Expected result |
|---|---|
| Create "Golf Carts" — individual, 12 units, 18-hole window 270 min, buffer 15 min | Page shows 12 available, 0 in maintenance |
| Add Cart #1 through Cart #12 | Item list shows 12 green dots |
| Mark Cart #3 as maintenance, note "Needs new front tire" | Available count drops to 11; Cart #3 shows red dot; status log records change with user and timestamp |
| Mark Cart #3 as available | Count returns to 12; status log records return |
| Retire Cart #12 | Count drops to 11; "Retire" action no longer available on that item |
| View Cart #12 status log | Shows: created → available → retired with timestamps and user |
| Create "GPS Units" — pool, 20 units | Shows "20 available"; no item list |
| Update GPS Units total to 22 | Card updates to 22 |
| Create "Towels" — consumable, track=false | Shows "Unlimited — not tracked" |
| Create "Range Balls" — consumable, track=true, stock=200 | Shows "200 in stock" |
| Restock Range Balls +50, reason "Delivery #42" | Stock becomes 250 |
| Adjust Range Balls −10, reason "Water damaged" | Stock becomes 240; log records negative delta |
| Create rental type: 9-hole=2.75h, 18-hole=4.5h, buffer=15min | Saved as 165/270 minutes + 15 buffer; UI shows hours on reload |
| Create rental type with no `"default"` window key | Validation error |
| Create consumable with trackingMode set | Validation error |
| Attempt to hard-delete a resource type that has items | 409; soft-delete (active=false) offered instead |
| Two concurrent requests both try to book the last cart | Only one succeeds; second gets 409 ADDON_UNAVAILABLE — row lock prevented oversell |
| Cart is in active booking window; check Resources page | Cart shows amber "In Use (booked)" visual state; `operationalStatus` is still "available" |
| Cart booking window expires without any action | Cart returns to green "available" on next page load — no staff action required |
