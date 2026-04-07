# Plan 1 — Inventory & Resource Management

> **Scope:** Establish the full resource/inventory foundation for the TeeTimes platform. This plan covers the DB schema, API, and staff UI for three usage models (rental, consumable, service). It does not include the public-facing Add-On Catalog — that is Plan 2, Feature D, which builds on top of this plan.

---

## Design Principles

1. **Usage model is the primary discriminator.** How a resource behaves (rented and returned, consumed and gone, or service-based) determines all downstream logic. **Tracking mode** (`pool` vs `individual`) applies only to **`usageModel = "rental"`**. Consumables and the `service` placeholder use `trackingMode = null` (no capacity model for services until a future scheduling plan).
2. **Bookings reserve quantity, not specific items.** A booking creates a capacity reservation against a resource type. Which specific unit fulfils that reservation is a separate, later concern — handled by `assignmentStrategy`. Availability is always computed from total usable units minus overlapping reservations. Assigned items are never the source of truth for capacity.
3. **Assignment is a first-class, configurable concept.** `assignmentStrategy` on `resourceTypes` determines when and how specific units are matched to reservations: automatically at booking time (`"auto"`), deferred to staff at check-in (`"manual"`), or not applicable (`"none"`). This is per-type, not per-booking.
4. **Rental windows are per-slot-type, not a single number.** A 9-hole round and an 18-hole round don't return a unit at the same time. Clubs configure the expected window per format (9-hole, 18-hole, 27-hole, 36-hole) plus a turnaround buffer.
5. **Consumables can be sold with or without stock tracking.** Stock tracking is opt-in per resource type. An untracked consumable is always available with no stock check.
6. **`operationalStatus` is physical condition only; `in_use` is never stored.** The item row reflects physical state: `available`, `maintenance`, or `retired`. Whether a unit is logically occupied by a booking is computed at query time from `bookingAddonLines`. Storing `in_use` creates a derived-state maintenance problem.
7. **Availability checks run inside a transaction with a row lock.** The check-then-insert pattern is only safe when the resource type row is locked during the transaction. Without this, concurrent bookings will oversell inventory.
8. **`booking_start` and `booking_end` are precomputed and stored on `bookingAddonLines`.** Pre-storing the occupied interval makes the overlap query a simple indexed range scan rather than a per-row JSON resolution.
9. **`meta` jsonb provides per-type flexibility** for attributes not worth making into first-class columns (e.g., caddie certification, equipment condition rating).
10. **`service` is a defined placeholder.** A scheduling engine for lessons, fittings, and simulator bays is a separate system of comparable complexity to this entire plan. Do not expand it without a dedicated plan.
11. **The system is generic.** No logic is specific to any resource category (carts, caddies, clubs). Everything is driven by `resourceType` configuration.

---

## On Golf Round Formats

27 holes is played regularly — particularly at courses with three 9-hole loops. 36 holes occurs at club days, charity tournaments, and competitive amateur rounds. The system supports:

| `slotType` value | Typical on-course time | Example rental window (inc. turnaround) |
|---|---|---|
| `9hole` | ~2 h 15 min | ~2 h 45 min (165 min) |
| `18hole` | ~4 h 30 min | ~5 h 00 min (300 min) |
| `27hole` | ~6 h 45 min | ~7 h 30 min (450 min) |
| `36hole` | ~9 h 00 min | ~9 h 45 min (585 min) |

The existing `tee_slots.slotType` column stores `"9hole"` and `"18hole"`. This plan extends it with `"27hole"` and `"36hole"`. The `bookings.ts` schema and `slotGenerator.ts` must be updated accordingly.

Clubs configure the rental window per resource type — different asset types have different return schedules. The window includes a turnaround buffer configured separately (see `turnaroundBufferMinutes` below).

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
| `trackingMode` | text nullable | `"pool"` \| `"individual"` — required for `usageModel = "rental"` only; must be `null` for `consumable` and `service` |
| `assignmentStrategy` | text | `"auto"` \| `"manual"` \| `"none"` — see constraint table below |
| `totalUnits` | int nullable | Pool mode: hard capacity ceiling. Individual mode: leave `null` in DB; **API `totalUnits`** = fleet size for display: `COUNT(resourceItems)` where `operationalStatus != 'retired'` (includes `available` + `maintenance`). **Capacity `usableUnits`** still excludes maintenance: `COUNT` where `operationalStatus = 'available'` only. |
| `trackInventory` | bool default true | Consumable only. `false` = unlimited, no stock check ever performed. |
| `currentStock` | int nullable | Consumable + `trackInventory=true`: current on-hand count. |
| `rentalWindows` | jsonb nullable | Rental only. Maps slotType → minutes (excluding buffer). See format below. |
| `turnaroundBufferMinutes` | int default 0 | Added to rental window end. Prevents back-to-back allocation without cleaning time. |
| `notes` | text nullable | Internal staff notes |
| `sortOrder` | int default 0 | |
| `active` | bool default true | When `false`, type is hidden from the **public** add-on catalog (Plan 2). Staff `GET /resources` still returns inactive types with `active: false` so clubs can review and reactivate. |
| `deletedAt` | timestamptz nullable | Soft-delete timestamp. When set, type is removed from staff lists except where explicitly queried for audit; **not** the same as `active = false`. |
| `createdAt` | timestamptz defaultNow | |

**`active` vs `deletedAt`:** Use **`active`** for "we are not selling this add-on right now" (reversible from staff UI). Use **`deletedAt`** only when retiring a type record (e.g., after migrating data). **`DELETE /resources/:typeId`** sets `deletedAt` (and requires no active items/reservations as today), not merely `active = false`.

---

#### `usageModel` values

| Value | Meaning |
|---|---|
| `"rental"` | Physical asset that leaves and returns. Availability computed from booking window overlaps. |
| `"consumable"` | Asset consumed on sale. Availability is `currentStock > 0` (if tracked) or always available (if untracked). |
| `"service"` | Placeholder for future scheduling (lessons, fittings, simulator bays). No availability logic in this plan. |

---

#### `trackingMode` values

| Value | Meaning |
|---|---|
| `"pool"` | Tracked as an aggregate count only. No individual unit records. |
| `"individual"` | Each unit has its own `resourceItems` row with `operationalStatus` and audit history. |
| `null` | Consumables and service types — no pool/individual distinction until a future scheduling plan defines one. |

---

#### `assignmentStrategy` — Strict Validation Rules

`assignmentStrategy` is always required and must satisfy these constraints. Violations are rejected at the validator layer before hitting the database.

| Condition | Required `assignmentStrategy` | Reason |
|---|---|---|
| `trackingMode = "pool"` | must be `"none"` | Pool types have no individual items to assign |
| `usageModel = "consumable"` | must be `"none"`; `trackingMode` must be `null` | Consumables are consumed, not assigned |
| `usageModel = "service"` | must be `"none"`; `trackingMode` must be `null` | No assignment logic until scheduling engine exists |
| `trackingMode = "individual"` | must be `"auto"` or `"manual"` | Individual items require an explicit assignment strategy |

These constraints are enforced in:
- `CreateResourceTypeSchema` (validator-layer cross-field refinement)
- `PatchResourceTypeSchema` (same)
- API handler (redundant safety check before DB write)

| `assignmentStrategy` value | Meaning |
|---|---|
| `"none"` | No item assignment — pool counts, consumables, services |
| `"auto"` | System selects and assigns a specific item at booking creation time |
| `"manual"` | Capacity is reserved at booking time; a specific item is assigned later by staff (e.g., at check-in) |

---

#### `rentalWindows` jsonb format

```json
{ "9hole": 150, "18hole": 270, "27hole": 420, "36hole": 540, "default": 270 }
```

All values in minutes, **not including** `turnaroundBufferMinutes`. The effective occupied window for overlap queries is:

```
effectiveEnd = bookingStart + rentalWindowMinutes + turnaroundBufferMinutes
```

Resolution order at compute time:

```
rentalWindows[booking.teeSlot.slotType] ?? rentalWindows["default"] ?? 480
```

The 480-minute (8-hour) hard fallback prevents undefined behaviour if neither key is present. Clubs are warned in the UI if they save a rental type with no `"default"` set.

**Why `turnaroundBufferMinutes` is separate from `rentalWindows`:** A club may show golfers "rental: 4.5 hours" in the catalog while actually blocking 5 hours operationally. Keeping these separate means the displayed rental duration and the operational hold are independently configurable.

---

### `resourceItems`

Per-unit records. Only populated for `trackingMode = "individual"` resource types.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceTypeId` | uuid FK → resourceTypes CASCADE | |
| `clubId` | uuid | Denormalized for query efficiency |
| `label` | text | "Unit #7", "Tom H.", "Blue Bag Set" |
| `operationalStatus` | text | `"available"` \| `"maintenance"` \| `"retired"` |
| `maintenanceNote` | text nullable | |
| `lastServicedAt` | timestamptz nullable | |
| `meta` | jsonb nullable | Flexible per category |
| `sortOrder` | int default 0 | |
| `createdAt` | timestamptz defaultNow | |
| `updatedAt` | timestamptz | |

**`operationalStatus` — physical condition only, never `in_use`:**

`in_use` is a derived state computed at query time from active `bookingAddonLines` and `booking_resource_assignments`. It is not stored. This prevents the class of bugs where a status update is missed, leaving a unit permanently stuck as `in_use` after a booking is cancelled or a window expires.

The UI shows a fourth visual state — "In Use (booked)" — which is computed from the overlap query. The underlying `operationalStatus` remains `"available"` when a unit is reserved or assigned but physically sound.

| `operationalStatus` value | Meaning |
|---|---|
| `available` | Unit is physically sound and ready for use or assignment |
| `maintenance` | Unit is physically unserviceable — broken, in the shop, etc. |
| `retired` | Permanently decommissioned. Never returns to service. |

**Status transition rules:**

| From | To | Trigger |
|---|---|---|
| `available` | `maintenance` | Staff marks it |
| `maintenance` | `available` | Staff clears it |
| `any` | `retired` | Staff retires — permanent; no transition back |

---

### `booking_resource_assignments`

The table that records which specific `resourceItem` fulfils a given reservation. Decoupled from `bookingAddonLines` to support `quantity > 1`, deferred assignment, and reassignment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `bookingAddonLineId` | uuid FK → bookingAddonLines CASCADE | The reservation this assignment fulfils |
| `resourceItemId` | uuid FK → resourceItems | The specific unit assigned |
| `assignedAt` | timestamptz defaultNow | |
| `assignedBy` | uuid FK → users nullable | `null` = system-assigned (auto strategy); user id = staff-assigned (manual strategy) |
| `supersededAt` | timestamptz nullable | Non-null when this assignment has been replaced by a later row. Active assignments have `supersededAt IS NULL`. |

**One row per unit per line.** If `bookingAddonLines.quantity = 3` and `assignmentStrategy = "auto"`, three rows are inserted — one per unit selected. If `assignmentStrategy = "manual"`, rows are inserted later by staff as they assign each unit.

**Relationship to `bookingAddonLines`:** `bookingAddonLines` never stores a `resourceItemId` directly. All item assignments live in this table. `bookingAddonLines` carries the reservation (quantity, window, pricing); `booking_resource_assignments` carries the fulfilment (which specific unit).

**Active assignment queries always include `WHERE supersededAt IS NULL`.** This applies to availability overlap checks, the BookingDrawer display, and the assignment list endpoint.

**Reassignment:** Insert a new row with the replacement `resourceItemId` and `assignedBy`, then set `supersededAt = now()` on the previous row (order within the same transaction can be insert-then-update or update-then-insert as long as the transaction commits atomically). **History:** all rows for the line, ordered by `assignedAt`, give the reassignment timeline; a linked `supersededById` column is intentionally omitted to keep the schema simple. Hard-deleting assignment rows is never done.

---

### `resourceItemStatusLog`

Audit trail for every `operationalStatus` change on individual items.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceItemId` | uuid FK → resourceItems | |
| `fromStatus` | text | Previous `operationalStatus` value |
| `toStatus` | text | New `operationalStatus` value |
| `reason` | text nullable | Optional staff note |
| `changedBy` | uuid FK → users | |
| `changedAt` | timestamptz defaultNow | |

Every `PATCH /items/:itemId` that changes `operationalStatus` inserts a log row in the same transaction.

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

### `pool_maintenance_holds`

Tracks units in a pool-mode resource type that are temporarily out of service. Because pool types have no individual `resourceItems` rows, maintenance is tracked here as a quantity hold rather than per-unit status.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceTypeId` | uuid FK → resourceTypes CASCADE | Must be a pool-mode (`trackingMode = "pool"`) type |
| `clubId` | uuid | Denormalized for query efficiency |
| `units` | int | Number of units in this hold (must be ≥ 1) |
| `reason` | text nullable | "Cart #14 transmission failure", "3 carts in winter storage" |
| `startedAt` | timestamptz defaultNow | When the hold was created |
| `resolvedAt` | timestamptz nullable | `null` = currently in maintenance; non-null = resolved/returned to service |
| `createdBy` | uuid FK → users | |
| `resolvedBy` | uuid FK → users nullable | Set when `resolvedAt` is populated |

**Pool availability formula with holds:**

```
usableUnits = totalUnits - SUM(units FROM pool_maintenance_holds
                                WHERE resourceTypeId = :typeId
                                  AND resolvedAt IS NULL)
```

This replaces the previous pool formula of `usableUnits = totalUnits`. A `totalUnits` update is no longer needed when units go in or out of service — staff create or resolve holds instead.

**Holds are never deleted.** Set `resolvedAt` and `resolvedBy` to close a hold. The full history of when units were taken out of service and returned is preserved.

---

### Indexes (this plan’s tables)

Add in the same migration as the tables (or a follow-up migration immediately after). Tune if query plans show seq scans at scale.

| Table | Index | Purpose |
|---|---|---|
| `resource_items` | `(resource_type_id, operational_status)` | Usable-unit counts and item lists by status |
| `resource_items` | `(club_id)` if not already implied by FK usage | Club-scoped listings |
| `pool_maintenance_holds` | `(resource_type_id) WHERE resolved_at IS NULL` partial index optional, or `(resource_type_id, resolved_at)` | Active hold sums |
| `booking_resource_assignments` | `(booking_addon_line_id, superseded_at)` | Active assignments per line |
| `booking_resource_assignments` | `(resource_item_id)` | Lookups by item (overlap with assignments) |
| `resource_item_status_log` | `(resource_item_id, changed_at DESC)` | Item audit history |
| `resource_restock_log` | `(resource_type_id, created_at DESC)` | Restock history |

**Plan 2 / Feature D:** composite index on `booking_addon_lines(resource_type_id, booking_start, booking_end)` remains as documented for overlap queries.

---

### `slotType` extension

Update `packages/db/src/schema/bookings.ts` to add `"27hole"` and `"36hole"` as valid values for `tee_slots.slotType`. Also update `slotGenerator.ts` and any TypeScript types referencing `slotType`.

---

## Resource type lifecycle and mutability

**Immutability (recommended default):** After insert, **`usageModel`** and **`trackingMode`** are **immutable**. Changing either would orphan `resourceItems`, invalidate `bookingAddonLines` windows, or contradict existing reservations. `PATCH` rejects attempts to change these fields.

**If product later requires migration:** introduce an explicit admin-only "duplicate type + move reservations" flow in a separate plan — not silent in-place edits.

**Safe `PATCH` fields:** `name`, `notes`, `sortOrder`, `active`, `rentalWindows`, `turnaroundBufferMinutes`, `totalUnits` (pool only), `trackInventory` / `currentStock` (consumable), `assignmentStrategy` **only when** current `trackingMode = "individual"` (toggle `auto` ↔ `manual` for **future** bookings; existing lines unchanged).

---

## Reservation vs Assignment Model

> This section defines the conceptual split that everything else in this plan depends on. Read it before implementing any booking or availability logic.

### Reservations (capacity, not items)

When a golfer books a tee time and selects an add-on (e.g., "Cart Rental, quantity 2"), a **reservation** is created. A reservation says:

> "This booking requires 2 units of resource type X, beginning at time T and ending at time T + window."

The reservation is stored as a `bookingAddonLines` row with `quantity = 2`, `bookingStart`, and `bookingEnd`. It makes no claim about *which* units.

### Assignments (specific items)

An **assignment** maps a specific `resourceItem` to a reservation. It says:

> "Unit Y will fulfil slot 1 of this reservation."

Assignments are stored in `booking_resource_assignments`. They are created either automatically at booking time (`assignmentStrategy = "auto"`) or later by staff (`assignmentStrategy = "manual"`).

### Why they are separate

Separating reservations from assignments provides three properties that are impossible if you conflate them:

1. **Deferred assignment.** A club using `"manual"` strategy doesn't need to know which unit goes to which golfer until check-in. The capacity is still correctly held.
2. **Reassignment.** If a unit goes into maintenance after it was assigned, a staff member can swap it without changing the reservation. The booking is unaffected; only the assignment row changes.
3. **Correct availability under maintenance.** Availability is computed from total usable units minus overlapping reservations — not from assigned items. This means marking a unit as `maintenance` correctly reduces available capacity for *future* bookings, even if the unit has no current assignment.

### The Authoritative Availability Formula

```
usableUnits = totalUnits
              - COUNT(items WHERE operationalStatus = 'maintenance')
              - COUNT(items WHERE operationalStatus = 'retired')

overlappingReservations = SUM(quantity × unitsConsumedPerLine) FROM bookingAddonLines
                          WHERE resource_type_id = :typeId
                            AND booking_start < :newEnd
                            AND booking_end > :newStart
                            AND status != 'cancelled'
                            AND booking.deleted_at IS NULL

available = usableUnits - overlappingReservations
```

`unitsConsumedPerLine` comes from the add-on catalog line (Plan 2, Feature D). **Until that ships, treat `unitsConsumed` as `1` for every line** so Plan 1 APIs and tests stay consistent.

For **pool mode**: `usableUnits = totalUnits - SUM(units FROM pool_maintenance_holds WHERE resourceTypeId = :typeId AND resolvedAt IS NULL)`. No items to query; maintenance is tracked via `pool_maintenance_holds`.

For **individual mode**: `usableUnits = COUNT(resourceItems WHERE operationalStatus = 'available')` — equivalent to the three-line formula above when `totalUnits` means “all item rows for the type.” Do **not** use the `resource_types.totalUnits` column for individual types (it stays `null`).

**Assignments are never used in this formula.** A unit that has been assigned to a booking is not "less available" than one that hasn't — the reservation already accounts for the capacity. Using assignments as a proxy for availability would double-count and produce incorrect results.

---

## Availability Logic — Full Specification

### Inputs

| Input | Source |
|---|---|
| `resourceTypeId` | From `addonCatalog.resourceTypeId` |
| `quantity` | Requested by golfer |
| `unitsConsumed` | From `addonCatalog.unitsConsumed` (Plan 2). **Default `1`** when catalog lines do not yet store it. |
| `newBookingStart` | `teeSlot.datetime` |
| `newBookingEnd` | `teeSlot.datetime + resolvedWindow + turnaroundBuffer` |

### By usage model

**Consumable, `trackInventory = false`:** Always available. Skip all checks. No lock acquired.

**Consumable, `trackInventory = true`:** Run `UPDATE resource_types SET current_stock = current_stock - :qty WHERE id = :typeId AND current_stock >= :qty RETURNING id`. If no row returned: 409 `ADDON_UNAVAILABLE`. (Atomic — no separate lock needed.)

**Rental, pool mode:**
1. Acquire `SELECT ... FOR UPDATE` on the `resourceTypes` row.
2. Compute `usableUnits = totalUnits - SUM(units FROM pool_maintenance_holds WHERE resourceTypeId = :typeId AND resolvedAt IS NULL)`.
3. Query `overlappingReservations` using `bookingStart`/`bookingEnd` indexed range scan.
4. Available if `usableUnits - overlappingReservations >= quantity × unitsConsumed`.

**Rental, individual mode:**
1. Acquire `SELECT ... FOR UPDATE` on the `resourceTypes` row.
2. Compute `usableUnits = COUNT(resourceItems WHERE operationalStatus = 'available')` (maintenance and retired units are excluded from usable capacity).
3. Query `overlappingReservations` using indexed range scan.
4. Available if `usableUnits - overlappingReservations >= quantity × unitsConsumed`.

### After the check passes

For **pool mode**: insert `bookingAddonLines` row(s) with `quantity`, `bookingStart`, `bookingEnd`. No `booking_resource_assignments` rows.

For **individual mode, `assignmentStrategy = "auto"`**:
1. Select `quantity × unitsConsumed` items: `operationalStatus = 'available'` AND not in an overlapping reservation window AND not already assigned to an overlapping reservation. Order by `sortOrder ASC, id ASC`.
2. Insert one `bookingAddonLines` row per item selected, each with `quantity = 1` (or one line with `quantity = N` and N assignment rows — either is valid; one-per-item is simpler to manage).
3. Insert `booking_resource_assignments` rows: one per item, `assignedBy = null` (system).

For **individual mode, `assignmentStrategy = "manual"`**:
1. Insert one `bookingAddonLines` row with `quantity = N`. No `booking_resource_assignments` rows yet.
2. Staff will insert assignment rows later via the assignment API.

---

## Concurrency Strategy — Preventing Oversell

> **This is the most critical correctness concern.** The availability check followed by an insert is only safe inside a serialised transaction. Without locking, two concurrent requests can both pass the check and both insert, exceeding capacity.

### The Problem

```
Request A: check → 1 unit available ✓
Request B: check → 1 unit available ✓   (A has not committed yet)
Request A: insert bookingAddonLine       (1 unit now reserved)
Request B: insert bookingAddonLine       (2 units reserved — oversell)
```

### The Fix — Row-Level Lock on `resourceTypes`

Wrap the availability check and insert in a single DB transaction, acquiring a `SELECT ... FOR UPDATE` lock on the `resourceTypes` row at the start. This serialises all concurrent booking attempts for the same resource type.

```sql
BEGIN;

SELECT id, total_units, tracking_mode
FROM resource_types
WHERE id = :typeId
FOR UPDATE;                             -- all other transactions for this type wait here

SELECT COALESCE(SUM(quantity * :unitsConsumed), 0) AS overlapping
FROM booking_addon_lines bal
JOIN bookings b ON bal.booking_id = b.id
WHERE bal.resource_type_id = :typeId
  AND bal.status != 'cancelled'
  AND b.deleted_at IS NULL
  AND bal.booking_start < :newBookingEnd
  AND bal.booking_end > :newBookingStart;

-- If (usableUnits - overlapping) >= requestedQuantity: proceed
INSERT INTO booking_addon_lines (...) VALUES (...);

COMMIT;                                 -- lock released; next waiting transaction proceeds
```

The lock is held for the duration of the transaction — milliseconds at golf club volumes. This is not a bottleneck. The known upgrade path for very high concurrency is a `resource_reservations` table with TTL holds (the Ticketmaster/airline pattern), but that is out of scope for this plan.

---

## `booking_start` and `booking_end` on `bookingAddonLines`

These two columns are added to `bookingAddonLines` (defined in Plan 2, Feature D). They are documented here because their values are derived from inventory data (`rentalWindows`, `turnaroundBufferMinutes`).

| Column | Type | Notes |
|---|---|---|
| `bookingStart` | timestamptz | `= teeSlot.datetime`. Null for non-rental add-ons. |
| `bookingEnd` | timestamptz | `= teeSlot.datetime + resolvedWindowMinutes + turnaroundBufferMinutes`. Null for non-rental add-ons. |

The resolved window is computed once at insert time:

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

The overlap query becomes a simple indexed range scan:

```sql
WHERE bal.resource_type_id = :typeId
  AND bal.booking_start < :newBookingEnd
  AND bal.booking_end > :newBookingStart
  AND bal.status != 'cancelled'
```

Add a composite index on `booking_addon_lines(resource_type_id, booking_start, booking_end)` in the Feature D migration. No JSON lookup per row. No join to `tee_slots` or `resource_types` in the hot path.

If a booking is moved to a different tee slot, `bookingAddonLines` rows are deleted and re-inserted (with recomputed `bookingStart`/`bookingEnd`) inside the move transaction in `bookingOperations.ts`.

---

## Assignment — Full Specification

### Auto Strategy

The system assigns specific items immediately at booking creation.

1. After the availability check passes (inside the same transaction), select `quantity × unitsConsumed` items from `resourceItems` where:
   - `resourceTypeId = :typeId`
   - `operationalStatus = 'available'`
   - `id NOT IN (SELECT resource_item_id FROM booking_resource_assignments bra JOIN booking_addon_lines bal ON bra.booking_addon_line_id = bal.id WHERE bal.booking_start < :newEnd AND bal.booking_end > :newStart)`
   - Order: `sortOrder ASC, id ASC`
2. Insert `booking_resource_assignments` rows: one per selected item, `assignedBy = null`.
3. Staff see the assignment immediately in the BookingDrawer.

**Auto strategy does not guarantee the assigned item is available at tee time** if something changes after booking (e.g., the unit goes into maintenance). The maintenance-after-booking edge case is handled operationally — see Edge Cases below.

### Manual Strategy

The system reserves capacity at booking time but defers item assignment to staff.

1. At booking creation: insert `bookingAddonLines` row(s) with the quantity and computed window. No `booking_resource_assignments` rows.
2. At any time before the tee time (typically at check-in): staff use the BookingDrawer assignment UI to select a specific item per slot.
3. The assignment API validates the item is `operationalStatus = 'available'` and not in a conflicting active assignment window.

**Manual strategy is the recommended default for individual-mode resources** because it gives operations staff flexibility to handle last-minute unit changes without affecting the booking.

### Assignment API Endpoints

These are added in Plan 2, Feature D (where `bookingAddonLines` is defined). Documented here for completeness.

| Method | Path | Min role | Notes |
|---|---|---|---|
| `GET` | `/api/bookings/:bookingId/addons/:lineId/assignments` | staff | List active assignments (`supersededAt IS NULL`) for a line |
| `POST` | `/api/bookings/:bookingId/addons/:lineId/assignments` | staff | Assign a specific item to a slot |
| `PATCH` | `/api/bookings/:bookingId/addons/:lineId/assignments/:assignmentId/supersede` | staff | Reassign: supersede the current assignment and insert a replacement |

`POST /assignments` body: `{ resourceItemId: string }`.

Steps:
1. Verify item belongs to the correct resource type and club.
2. Verify `operationalStatus = 'available'`.
3. Verify item not in a conflicting assignment window (`booking_resource_assignments JOIN booking_addon_lines` — check overlap using `bookingStart`/`bookingEnd`, filtering `supersededAt IS NULL`). Note: no resource type lock needed here because this is assignment to already-reserved capacity, not a new capacity claim.
4. Insert `booking_resource_assignments` row with `assignedBy = req.auth.userId`.

`PATCH /assignments/:assignmentId/supersede` body: `{ resourceItemId: string }` (the replacement unit).

Steps:
1. Verify the existing assignment row belongs to this line and `supersededAt IS NULL`.
2. Run all validation checks (steps 1–3 above) against the replacement item.
3. In a single transaction: insert the new `booking_resource_assignments` row, then set `supersededAt = now()` on the previous active row for this slot/line (same ordering rules as `POST` reassignment).
4. Return the new assignment row.

---

## Edge Cases

### Maintenance After Booking

**Scenario:** A unit is assigned to a future booking (`assignmentStrategy = "auto"`), then later marked as `maintenance` before the tee time.

**What happens:**
- The unit's `operationalStatus` changes to `maintenance`.
- The `booking_resource_assignments` row still exists pointing to that item.
- The availability formula recomputes `usableUnits` excluding the now-maintenance item, which may reduce availability for new bookings.
- The existing booking's reservation is unaffected — the capacity hold remains valid.
- The assignment is now pointing at an unserviceable unit.

**System behaviour:**
- The Resources page and BookingDrawer surface a warning: "Unit [label] is assigned to booking [ref] but is currently in maintenance."
- The system does NOT automatically cancel or reassign — this is an operational decision.
- Staff use the assignment UI to supersede the stale assignment with a different item.
- If no alternative unit is available, staff resolve operationally (e.g., upgrade the golfer, offer a refund, note in the booking).

**Why the system does not auto-reassign:** Auto-reassignment would require knowing staff priorities, golfer preferences, and operational context. It is safer to surface the conflict and let staff resolve it.

**Over-allocation warning:** If maintenance causes `usableUnits - overlappingReservations < 0`, the Resources page shows a red warning banner on the affected type: "Over-allocated: X reservations exceed current usable units. Review upcoming bookings."

### Assignment Conflict on Individual Items

When `assignmentStrategy = "auto"` and two concurrent bookings both try to auto-assign the same item, the row lock on `resourceTypes` (from the concurrency strategy) prevents this — the second booking will either find a different available item or fail with 409 if none remain.

### Booking Cancellation with Assignments

When a booking with `booking_resource_assignments` rows is cancelled:
1. `bookingAddonLines.status` is set to `"cancelled"`.
2. `booking_resource_assignments` rows are left in place (never deleted). Their history is preserved.
3. The cancelled lines are excluded from the overlap query (`status != 'cancelled'`), so those units become available for new reservations immediately. Active-assignment queries that include a `bookingAddonLines` status join will naturally exclude the cancelled lines.

---

## Validators (`packages/validators/src/resources.ts`)

```
CreateResourceTypeSchema
  name: string (1–100 chars)
  usageModel: "rental" | "consumable" | "service"
  trackingMode: "pool" | "individual" | null
    -- required (non-null) when usageModel = "rental" only
    -- must be null when usageModel = "consumable" or "service"
  assignmentStrategy: "auto" | "manual" | "none"
    -- STRICT RULES (cross-field refinement):
    -- IF trackingMode = "pool" THEN assignmentStrategy must be "none"
    -- IF usageModel = "consumable" THEN assignmentStrategy must be "none"
    -- IF usageModel = "service" THEN assignmentStrategy must be "none"
    -- IF trackingMode = "individual" THEN assignmentStrategy must be "auto" or "manual"
    -- No other combinations are valid
  totalUnits: positive int | null
    -- required when trackingMode = "pool"
  trackInventory: boolean
    -- required when usageModel = "consumable"; ignored for rental/service
  currentStock: non-negative int | null
    -- required when usageModel = "consumable" and trackInventory = true
  rentalWindows: record<string, positive int> | null
    -- required when usageModel = "rental"
    -- valid keys: "9hole" | "18hole" | "27hole" | "36hole" | "default"
    -- "default" key is required
    -- values in minutes (excluding turnaround buffer)
  turnaroundBufferMinutes: non-negative int default 0
    -- only meaningful for rental; ignored otherwise
  notes: string | null
  sortOrder: int | null

PatchResourceTypeSchema
  -- all fields optional; same cross-field constraints apply when fields are present
  -- usageModel and trackingMode: reject changes after create (immutable) — see "Resource type lifecycle and mutability"
  -- changing assignmentStrategy from "manual" to "auto" (or vice versa) is allowed when trackingMode = "individual";
     it only affects future bookings — existing reservations and assignments are unchanged

CreateResourceItemSchema
  label: string (1–100 chars)
  operationalStatus: "available" | "maintenance"
    -- new items cannot start as "retired"
  maintenanceNote: string | null
  meta: record<string, unknown> | null
  sortOrder: int | null

PatchResourceItemSchema
  -- label, operationalStatus, maintenanceNote, lastServicedAt, meta, sortOrder — all optional
  -- operationalStatus transition to "retired" is allowed; back from "retired" is not
  -- optional `reason`: if provided on a status change, persisted to resourceItemStatusLog; not required by schema
  reason: string | null

RestockSchema
  deltaQuantity: int (non-zero; positive = restock, negative = adjustment)
  reason: string | null

AssignResourceItemSchema
  resourceItemId: uuid

SupersedeAssignmentSchema
  resourceItemId: uuid   -- the replacement item

CreatePoolMaintenanceHoldSchema
  units: positive int
  reason: string | null

ResolvePoolMaintenanceHoldSchema
  -- no body required; resolvedAt and resolvedBy set server-side
```

---

## API Endpoints

All endpoints require `authenticate` + `requireClubAccess`. Type create/update/delete require `club_admin`. Item status updates, restocks, and assignments can be performed by `staff`.

| Method | Path | Min role | Notes |
|---|---|---|---|
| `GET` | `/api/clubs/:clubId/resources` | staff | List all types (including `active: false`); computed fields are a **point-in-time snapshot** at request time |
| `POST` | `/api/clubs/:clubId/resources` | club_admin | Create resource type; enforces `assignmentStrategy` constraints |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId` | club_admin | Update type |
| `DELETE` | `/api/clubs/:clubId/resources/:typeId` | club_admin | Sets `deletedAt` (soft-delete); blocked if any `resourceItems` row is not `retired`, or any non-cancelled reservation references the type. Prefer `PATCH { active: false }` to hide from catalog without deleting. |
| `GET` | `/api/clubs/:clubId/resources/:typeId/items` | staff | List items with current operational status and active assignment count |
| `POST` | `/api/clubs/:clubId/resources/:typeId/items` | club_admin | Add item |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId/items/:itemId` | staff | Update status, note, label; writes status log row |
| `GET` | `/api/clubs/:clubId/resources/:typeId/items/:itemId/log` | staff | View `resourceItemStatusLog` for this item |
| `POST` | `/api/clubs/:clubId/resources/:typeId/restock` | staff | Log consumable stock change |
| `GET` | `/api/clubs/:clubId/resources/:typeId/maintenance-holds` | staff | List all holds (active and resolved) for a pool-mode type |
| `POST` | `/api/clubs/:clubId/resources/:typeId/maintenance-holds` | staff | Create a new maintenance hold (pool mode only) |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId/maintenance-holds/:holdId/resolve` | staff | Resolve a hold — sets `resolvedAt` and `resolvedBy` |

**`GET /resources` response shape per type:**

```jsonc
{
  "id": "uuid",
  "name": "Rental Clubs",
  "usageModel": "rental",
  "trackingMode": "individual",
  "assignmentStrategy": "manual",
  "totalUnits": 8,
    // individual: non-retired item count (available + maintenance); pool: totalUnits column
  "availableNow": 6,
    // individual: COUNT(items WHERE operationalStatus='available')
    //             MINUS overlapping reservations at this moment
    // pool: totalUnits MINUS active maintenance hold units MINUS overlapping reservation SUM at this moment
    // consumable+trackInventory=false: null  → UI shows "Unlimited"
    // consumable+trackInventory=true: currentStock
  "inMaintenance": 1,
    // individual: COUNT(items WHERE operationalStatus='maintenance')
    // pool: SUM(units FROM pool_maintenance_holds WHERE resolvedAt IS NULL)
  "inUseBooked": 1,       // individual only: units in an active reservation window right now
    //                       NOTE: computed from bookingAddonLines windows, not assignments
  "overAllocated": false, // true if usableUnits - overlappingReservations < 0
  "rentalWindows": { "9hole": 150, "18hole": 270, "default": 270 },
  "turnaroundBufferMinutes": 15,
  "active": true
}
```

When `overAllocated = true`, the UI renders a warning on the resource type card.

**Staff vs catalog visibility:** `active = false` hides the type from the **public** add-on catalog only (Plan 2). Staff resource management always lists inactive types so they can be reactivated. Types with `deletedAt` set are omitted from default staff lists (unless an admin audit view is added later).

---

## UI — `/club/:clubId/resources`

### Page structure

Three grouped sections: Rentals → Consumables → Services. Each has a heading and a section-scoped "Add" button pre-filling `usageModel`.

---

### Rental cards

Each card: name, tracking mode badge, assignment strategy badge, available / total count, in-maintenance count. If `overAllocated`, a red warning strip across the top of the card.

For **individual mode**: expandable card showing each unit as a row with:
- Label
- Visual status dot: green (available, not in active window), amber (in active reservation window), red (maintenance), grey (retired)
- For units in an active window: shows how many reservations are active; shows assigned-to booking ref if assigned
- Maintenance note when present
- "Mark maintenance" / "Mark available" buttons; "Retire" in kebab menu
- If unit is assigned to a future booking and status changes to maintenance: warning badge on the item row

For **pool mode**: aggregate counts + inline "Update capacity" field + "Currently reserved" read-only count (from `bookingAddonLines` overlap query at current time) + "In maintenance" count (from active `pool_maintenance_holds` rows) + "Add maintenance hold" button. Each active hold is shown as a row with its unit count, reason, and a "Resolve" button. Resolved holds are shown in a collapsible history section.

---

### Consumable cards

- `trackInventory = false`: "Unlimited — not tracked" badge.
- `trackInventory = true`: stock count, "Restock" button, "Adjust" option (negative delta, reason required).

---

### Service cards

Display-only. Name + "Availability managed manually" notice.

---

### Add / Edit resource type form

**All types:** name, usage model selector, notes, active toggle, sort order.

**Rental:**
- Tracking mode: Pool or Individual
- If Individual — assignment strategy radio group:
  ```
  How are units assigned?
  ( ) Automatically assign units at booking time
  ( ) Assign at check-in (staff assigns manually)
  ```
  Maps to `"auto"` and `"manual"`. Pool mode sets `"none"` automatically — not shown.
- If Pool: total units field
- Rental windows: one row per slot format (hours input, converts ↔ minutes)
  - 9-hole, 18-hole, 27-hole, 36-hole, Default (required)
- Turnaround buffer (minutes) — "Cleaning/staging buffer between rentals"
- Helper text: "Rental window is reserved time shown to golfers. Turnaround buffer is invisible operational padding added on top."

**Consumable:**
- Track inventory toggle
  - On: initial stock count
  - Off: "Always available — no stock check performed"

**Service:** no extra fields. Informational note: "Scheduling for services is a separate future feature."

**Note:** The `assignmentStrategy` field is never shown for consumable or service types — it is set automatically to `"none"` and the user has no control over it.

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
| DB schema | `packages/db/src/schema/resources.ts` | New — `resourceTypes`, `resourceItems`, `pool_maintenance_holds`, `booking_resource_assignments`, `resourceItemStatusLog`, `resourceRestockLog` tables + relations |
| DB schema index | `packages/db/src/schema/index.ts` | Export new tables |
| DB bookings schema | `packages/db/src/schema/bookings.ts` | Add `"27hole"` and `"36hole"` to `slotType` |
| DB slot generator | `apps/api/src/lib/slotGenerator.ts` | Add `"27hole"` and `"36hole"` to `SlotType` |
| DB migration | `packages/db/drizzle/` | `pnpm db:generate` then `pnpm db:migrate` — includes `resource_types.deleted_at` and per-table indexes per "Indexes" section |
| DB index (Feature D) | Migration (Plan 2 Feature D) | Composite index on `booking_addon_lines(resource_type_id, booking_start, booking_end)` |
| Validators | `packages/validators/src/resources.ts` | New file — includes `assignmentStrategy` cross-field refinements, `SupersedeAssignmentSchema`, `CreatePoolMaintenanceHoldSchema` |
| Validators index | `packages/validators/src/index.ts` | Export new schemas |
| API routes | `apps/api/src/routes/resources.ts` | New file — includes pool maintenance hold endpoints |
| App mount | `apps/api/src/app.ts` | Mount resources router at `/api/clubs/:clubId` |
| Resources page | `apps/web/app/(club)/club/[clubId]/resources/page.tsx` | New server component |
| Resources client | `apps/web/app/(club)/club/[clubId]/resources/ResourcesClient.tsx` | New client component |
| Sidebar | `apps/web/components/club/Sidebar.tsx` | Add "Resources" nav entry |

---

## Known Limitations / Future Work

| Item | Notes |
|---|---|
| **Service scheduling** | `service` usageModel is a placeholder. A real scheduling engine (staff calendars, per-instructor booking windows) is a separate system. Do not expand without a dedicated plan. |
| **Pricing layer** | Resource types carry no price. Pricing lives on `addonCatalog` (Plan 2, Feature D). The same resource type can back differently-priced add-ons. |
| **Resource reservations (high concurrency)** | Replace `SELECT ... FOR UPDATE` with a `resource_reservations` table with TTL holds for very high concurrency. Not needed at golf club scale. |
| **Auto-assignment timing** | This plan assigns at booking creation time. A future variant could defer auto-assignment to N hours before the tee time to maximise flexibility, but this adds scheduling complexity. |
| **Bulk item creation** | Optional later: `POST .../items/bulk` for many labels at once — not required for v1. |

---

## Verification

| Scenario | Expected result |
|---|---|
| Create resource type: `trackingMode="pool"`, `assignmentStrategy="manual"` | Validation error: pool mode requires `assignmentStrategy="none"` |
| Create resource type: `usageModel="consumable"`, `assignmentStrategy="auto"` | Validation error: consumables require `assignmentStrategy="none"` |
| Create resource type: `trackingMode="individual"`, `assignmentStrategy="none"` | Validation error: individual mode requires `"auto"` or `"manual"` |
| Create service type with `trackingMode="pool"` | Validation error: service must use `trackingMode = null` |
| `PATCH` resource type: change `usageModel` or `trackingMode` | Rejected (immutable after create) |
| `GET /resources` with an inactive type | Inactive type appears with `active: false`; catalog (Plan 2) hides it |
| `DELETE /resources/:typeId` | Sets `deletedAt`; blocked when any item is not `retired` or any non-cancelled reservation exists |
| Create valid rental type: individual, manual, 12 units, 18-hole window 270 min | Created successfully; page shows 12 available |
| Create valid rental type: individual, auto, 8 units | Created successfully |
| Create valid pool type: pool, `assignmentStrategy` auto-set to "none" | Created; no assignment strategy shown in UI |
| Create consumable: `assignmentStrategy` auto-set to "none" | Created; no assignment UI shown |
| Add items #1–12 to manual rental type | Item list shows 12 green dots |
| Mark item #3 as maintenance | Available count drops to 11; item shows red dot; status log records change |
| Mark item #3 as available | Count returns to 12; status log records return |
| Retire item #12 | Count drops to 11; retired permanently |
| View item #12 status log | Shows full history with timestamps and user |
| Booking created with auto-strategy type, quantity 2 | Two `booking_resource_assignments` rows created; `assignedBy = null`; BookingDrawer shows both labels |
| Booking created with manual-strategy type, quantity 2 | No assignment rows created; BookingDrawer shows 2 unassigned slots |
| Staff assigns item #4 to unassigned slot in BookingDrawer | `booking_resource_assignments` row created with `assignedBy = staffUserId` |
| Staff tries to assign item in maintenance | Rejected: `operationalStatus != 'available'` |
| Item assigned to future booking goes into maintenance | Warning badge on item row; "Over-allocated" warning if usable units fall below reservations |
| Two concurrent requests both try to book the last unit | Only one succeeds; second gets 409 ADDON_UNAVAILABLE — row lock prevented oversell |
| Unit in active booking window; check Resources page | Shows amber dot "In Use (booked)"; `operationalStatus` remains "available" |
| Booking window expires without any action | Unit returns to green "available" — no staff action required |
| Create "Consumables" type, track=false | Shows "Unlimited — not tracked" |
| Restock consumable +50 | Stock increments; log records entry |
| Staff reassigns a unit via `PATCH /assignments/:id/supersede` | Old row gains `supersededAt`; new row is active; BookingDrawer shows replacement unit |
| View assignment history for a line | All rows for the line returned; order by `assignedAt` for timeline (no `supersededById` link) |
| Create pool maintenance hold: 2 units, "Winter storage" | Hold created; pool `availableNow` decreases by 2; `inMaintenance` shows 2 |
| Pool type with 10 totalUnits, 2-unit maintenance hold, 6-unit reservation | `availableNow = 2`, `overAllocated = false` |
| Pool type with 10 totalUnits, 4-unit maintenance hold, 8-unit reservation | `availableNow = -2`, `overAllocated = true`; red warning on card |
| Resolve pool maintenance hold | `resolvedAt` set; `availableNow` increases; hold appears in history section |
| Two conflicting availability values (unit in maintenance reduces usableUnits below reservations) | `overAllocated = true` in API response; red warning strip on resource card |
