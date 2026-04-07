# Plan 1 — Inventory & Resource Management

> **Scope:** Establish the full resource/inventory foundation for the TeeTimes platform. This plan covers the DB schema, API, and staff UI for three usage models (rental, consumable, service). It does not include the public-facing Add-On Catalog — that is Plan 2, Feature D, which builds on top of this plan.

---

## Design Principles

1. **Usage model is the primary discriminator.** How a resource behaves (rented and returned, consumed and gone, or service-based) determines all downstream logic. Tracking mode (pool vs individual) is secondary and only applies to rentals and services.
2. **Rentals auto-hold based on the booking.** No staff action is required to mark a cart as "in use." The hold is implicit — a confirmed booking with a rental add-on occupies those units for the computed rental window. When the window expires, units are automatically available again. No cron job or scheduled task needed.
3. **Rental windows are per-slot-type, not a single number.** A 9-hole round and an 18-hole round don't return a cart at the same time. Clubs configure the expected window per format (9-hole, 18-hole, 27-hole, 36-hole).
4. **Consumables can be sold with or without stock tracking.** A club selling towels may not want to count every towel — they just want it to appear in the add-on catalog. Stock tracking is opt-in per resource type.
5. **`meta` jsonb provides per-type flexibility** for attributes not worth making into first-class columns (e.g., caddie handicap, cart battery type, club set condition rating).
6. **`service` is a defined placeholder.** Lessons, fittings, and simulator bays are a fundamentally different model (calendar-based scheduling). This plan records the category and displays it in the UI but defers availability logic to a future scheduling plan.

---

## On Golf Round Formats

Yes, 27 holes is played regularly — particularly at courses with three 9-hole loops. 36 holes occurs at club days, charity tournaments, and competitive amateur rounds. The system supports:

| `slotType` value | Typical on-course time | Example rental window (cart) |
|---|---|---|
| `9hole` | ~2 h 15 min | ~2 h 30 min (135 min) |
| `18hole` | ~4 h 30 min | ~4 h 30 min (270 min) |
| `27hole` | ~6 h 45 min | ~7 h (420 min) |
| `36hole` | ~9 h 00 min | ~9 h (540 min) |

The existing `tee_slots.slotType` column already stores `"9hole"` and `"18hole"`. This plan extends it with `"27hole"` and `"36hole"` as valid values. The `bookings.ts` schema and `slotGenerator.ts` must be updated accordingly.

Rental windows include a buffer beyond the round time for loading, unloading, and turnaround. The club configures the window per resource type — a caddie and a golf cart do not have the same return schedule.

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
| `totalUnits` | int nullable | Pool mode: hard capacity ceiling. Individual mode: derived from item count at query time. |
| `trackInventory` | bool default true | Consumable only. `false` = unlimited, no stock check ever performed. |
| `currentStock` | int nullable | Consumable + `trackInventory=true`: current on-hand count. Decrements on sale, increments on restock. |
| `rentalWindows` | jsonb nullable | Rental only. Maps slotType → minutes. See format below. |
| `notes` | text nullable | Internal staff notes |
| `sortOrder` | int default 0 | Controls display order on the Resources page |
| `active` | bool default true | Inactive types are hidden from the add-on catalog |
| `createdAt` | timestamptz defaultNow | |

**`usageModel` values:**

- `"rental"` — physical asset that leaves and returns. Golf carts, GPS units, club sets, push carts. Availability computed from active booking holds in the rental window.
- `"consumable"` — asset consumed on sale. Towels, range balls, F&B packages, golf tees. If `trackInventory = false`, always available (no stock check). If `trackInventory = true`, availability is `currentStock > 0`.
- `"service"` — reserved category for future scheduling (lessons, fittings, simulator bays). No availability logic in this plan. The UI shows the entry but marks it "availability managed manually."

**`rentalWindows` jsonb format:**

```json
{ "9hole": 135, "18hole": 270, "27hole": 420, "36hole": 540, "default": 270 }
```

All values in minutes. The `"default"` key is the fallback when the booking's slot type is not listed. Resolution order at query time:

```
rentalWindows[booking.teeSlot.slotType] ?? rentalWindows["default"] ?? 480
```

The 480-minute (8-hour) hard fallback prevents undefined behaviour if neither key is present. Clubs are warned in the UI if they save a rental type with no `"default"` set.

---

### `resourceItems`

Per-unit records. Only populated for `trackingMode = "individual"` resource types.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceTypeId` | uuid FK → resourceTypes CASCADE | |
| `clubId` | uuid | Denormalized for query efficiency |
| `label` | text | "Cart #7", "Tom H.", "Blue Bag Set" |
| `status` | text | `"available"` \| `"in_use"` \| `"maintenance"` \| `"retired"` |
| `maintenanceNote` | text nullable | "Needs new front tire — in shop" |
| `lastServicedAt` | timestamptz nullable | |
| `meta` | jsonb nullable | Flexible per category |
| `sortOrder` | int default 0 | |
| `createdAt` | timestamptz defaultNow | |
| `updatedAt` | timestamptz | |

**Status transition rules:**

| From | To | Trigger |
|---|---|---|
| `available` | `in_use` | System-driven when a booking with this item assigned is active; or manual staff override |
| `in_use` | `available` | Rental window expires (computed at query time); or staff marks "returned early" |
| `available` | `maintenance` | Staff marks it |
| `maintenance` | `available` | Staff clears it |
| `any` | `retired` | Staff retires a decommissioned unit — permanent |

**Manual override always wins:** Even when a `bookingAddonLine` theoretically has the item within its rental window, a staff member can explicitly flip `status = "available"` (early return). The availability check treats explicit `maintenance` and `retired` as overrides that always remove the item from the available pool, regardless of booking lines.

---

### `resourceRestockLog`

Lightweight audit trail for consumable stock changes.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `resourceTypeId` | uuid FK → resourceTypes | |
| `deltaQuantity` | int | Positive = restock/delivery. Negative = adjustment or write-off. |
| `reason` | text nullable | "Delivery #1234", "Write-off: water damaged" |
| `createdBy` | uuid FK → users | |
| `createdAt` | timestamptz defaultNow | |

When a row is inserted, `resourceTypes.currentStock` is incremented by `deltaQuantity` in the same transaction. This gives an auditable history without a full event-sourcing model.

---

### `slotType` extension

Update `packages/db/src/schema/bookings.ts` to add `"27hole"` and `"36hole"` as valid values for `tee_slots.slotType`. Also update `slotGenerator.ts` and any TypeScript types referencing `slotType` to include the new values.

---

## Auto-Hold Logic for Rentals

This is the key mechanism that makes rental inventory "smart." No background jobs required.

When a booking is confirmed with a rental add-on (Feature D — Add-On Catalog), a `bookingAddonLine` row is created. That row **is** the hold. The availability check queries existing lines to determine occupancy.

**Availability check at booking time** (implemented in Feature D, documented here for completeness):

Given a new booking at `targetDatetime` on slot type `targetSlotType` for resource type with `id = typeId`:

1. Resolve window: `windowMinutes = rentalWindows[targetSlotType] ?? rentalWindows["default"] ?? 480`
2. The new booking occupies: `[targetDatetime, targetDatetime + windowMinutes)`
3. Query all active `bookingAddonLines` for this resource type where the existing booking's window overlaps:

```sql
SELECT bal.resource_item_id, COUNT(*) as allocated
FROM booking_addon_lines bal
JOIN bookings b ON bal.booking_id = b.id
JOIN tee_slots ts ON b.tee_slot_id = ts.id
JOIN addon_catalog ac ON bal.addon_catalog_id = ac.id
JOIN resource_types rt ON ac.resource_type_id = rt.id
WHERE rt.id = :typeId
  AND bal.status != 'cancelled'
  AND b.deleted_at IS NULL
  AND (
    -- resolve per-slot-type window for each existing booking
    ts.datetime + (resolve_window(rt.rental_windows, ts.slot_type) * interval '1 minute')
      > :targetDatetime
    AND ts.datetime < :targetDatetime + (:windowMinutes * interval '1 minute')
  )
```

4. **Pool mode:** `allocatedCount = COUNT(matching lines × quantity)`. Available if `totalUnits - allocatedCount >= requestedQuantity`.
5. **Individual mode:** `occupiedItemIds = SET(resourceItemId from matching lines)`. Available items: `resourceItems WHERE status = 'available' AND id NOT IN occupiedItemIds`.

**Expiry is automatic.** Since availability is always computed against `NOW()`, a hold from a 7 AM booking with a 270-minute window is no longer blocking availability at 12:30 PM without any cleanup task.

---

## Validators (`packages/validators/src/resources.ts`)

```
CreateResourceTypeSchema
  name: string (1–100 chars)
  usageModel: "rental" | "consumable" | "service"
  trackingMode: "pool" | "individual" | null
    -- required (non-null) when usageModel is "rental" or "service"
    -- must be null when usageModel is "consumable"
  totalUnits: positive int | null
    -- required when trackingMode is "pool"
  trackInventory: boolean
    -- required when usageModel is "consumable"
    -- ignored for rental/service
  currentStock: non-negative int | null
    -- required when usageModel="consumable" and trackInventory=true
  rentalWindows: record<string, positive int> | null
    -- required when usageModel="rental"
    -- keys must be "9hole" | "18hole" | "27hole" | "36hole" | "default"
    -- values in minutes
  notes: string | null
  sortOrder: int | null

PatchResourceTypeSchema
  -- all fields optional, same constraints

CreateResourceItemSchema
  label: string (1–100 chars)
  status: "available" | "maintenance"   -- new items cannot start as in_use or retired
  maintenanceNote: string | null
  meta: record<string, unknown> | null
  sortOrder: int | null

PatchResourceItemSchema
  -- label, status, maintenanceNote, lastServicedAt, meta, sortOrder — all optional
  -- status transition "retired" is allowed; transition back from "retired" is not

RestockSchema
  deltaQuantity: int (non-zero)
  reason: string | null
```

---

## API Endpoints

All endpoints require `authenticate` + club access via existing `requireClubAccess` middleware. Create/update operations on types require `club_admin` role. Item status updates and restocks can be performed by `staff` role.

| Method | Path | Min role | Notes |
|---|---|---|---|
| `GET` | `/api/clubs/:clubId/resources` | staff | List all types with computed availability counts |
| `POST` | `/api/clubs/:clubId/resources` | club_admin | Create resource type |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId` | club_admin | Update type metadata |
| `DELETE` | `/api/clubs/:clubId/resources/:typeId` | club_admin | Soft-delete (sets `active=false`); hard delete blocked if items exist |
| `GET` | `/api/clubs/:clubId/resources/:typeId/items` | staff | List items for an individual-mode type |
| `POST` | `/api/clubs/:clubId/resources/:typeId/items` | club_admin | Add item |
| `PATCH` | `/api/clubs/:clubId/resources/:typeId/items/:itemId` | staff | Update status, note, label, meta |
| `POST` | `/api/clubs/:clubId/resources/:typeId/restock` | staff | Log a stock change for consumable types |

**`GET /resources` response shape per type:**

```jsonc
{
  "id": "uuid",
  "name": "Golf Carts",
  "usageModel": "rental",
  "trackingMode": "individual",
  "totalUnits": 12,
  "availableNow": 10,       // individual: count of status="available" items not in active window
                             // pool: totalUnits - allocated count in current moment
                             // consumable+trackInventory=false: null (UI shows "Unlimited")
                             // consumable+trackInventory=true: currentStock
  "inMaintenance": 1,        // individual mode only; null for pool/consumable
  "inUse": 1,                // individual mode only; null for pool/consumable
  "currentStock": null,      // consumable+trackInventory=true: stock count; otherwise null
  "trackInventory": true,
  "rentalWindows": { "9hole": 135, "18hole": 270, "default": 270 },
  "active": true,
  "sortOrder": 0
}
```

---

## UI — `/club/:clubId/resources`

### Page structure

Three grouped sections based on `usageModel`, rendered in order: Rentals → Consumables → Services.

Each section has a section heading and an "Add resource type" button scoped to that model (pre-fills `usageModel` in the modal).

A single "Add resource type" button at the top of the page opens a form that begins with the `usageModel` selector, then shows relevant fields.

---

### Rental cards

Each card shows: name, tracking mode badge (Pool / Individual), available count / total, in-maintenance count.

For **individual mode** types: the card is expandable. Expanded state shows a list of every unit with:
- Label
- Status pill: green (available), amber (in_use), red (maintenance), grey (retired)
- Maintenance note (when present)
- Two action buttons: "Mark maintenance" / "Mark available" (hidden when status is `retired`)
- A "Retire" option in a kebab menu

For **pool mode** types: aggregate counts only. An inline number field for "Update capacity" (updates `totalUnits`). A "Currently allocated" read-only count (computed from active booking lines, zero until Feature D is live).

---

### Consumable cards

Each card shows: name, stock status.

- `trackInventory = false`: "Unlimited — not tracked" badge. No stock field. A note explaining this item will appear in the add-on catalog without any stock constraint.
- `trackInventory = true`: current stock count as a large number. A "Restock" button opens a small form: quantity (positive integer), optional reason field. A "Adjust" option allows negative delta with required reason (write-off/damage). Both write to `resourceRestockLog`.

---

### Service cards

Display-only in this plan. Name and a muted "Availability managed manually" notice. Create/edit supported; no availability logic.

---

### Add / Edit resource type form

Fields adapt based on `usageModel`:

**All types:**
- Name (text)
- Usage model selector (Rental / Consumable / Service) — changing this resets dependent fields
- Notes (textarea)
- Active toggle
- Sort order (number)

**Rental:**
- Tracking mode: Pool or Individual
- If Pool: Total units (number)
- Rental windows: one row per slot format with a hours input (converts to/from minutes on save/load)
  - 9-hole (hours), 18-hole (hours), 27-hole (hours), 36-hole (hours), Default fallback (hours)
  - Default fallback is required; others are optional
  - Helper text: "How long after a tee time starts until this resource is considered returned? Include time to clean/turn around."

**Consumable:**
- Track inventory toggle
  - When on: Initial stock count (number)
  - When off: informational note — "This item will always show as available. Use this for items you sell without counting stock."

**Service:**
- No extra fields. Informational note: "Service availability is managed manually. A scheduling feature is planned for a future release."

---

### Sidebar nav addition

In `apps/web/components/club/Sidebar.tsx`, management section — add between Courses and Staff:

```ts
{ href: `${base}/resources`, label: "Resources", icon: <Package /> }
```

Import `Package` from `lucide-react`.

---

## Critical Files

| Area | File | Change |
|---|---|---|
| DB schema | `packages/db/src/schema/resources.ts` | New file — `resourceTypes`, `resourceItems`, `resourceRestockLog` tables + relations |
| DB schema index | `packages/db/src/schema/index.ts` | Export new tables |
| DB bookings schema | `packages/db/src/schema/bookings.ts` | Add `"27hole"` and `"36hole"` to `slotType` |
| DB slot generator | `apps/api/src/lib/slotGenerator.ts` | Add `"27hole"` and `"36hole"` to `SlotType` type if hardcoded |
| DB migration | `packages/db/drizzle/` | Generated via `pnpm db:generate` then applied with `pnpm db:migrate` |
| Validators | `packages/validators/src/resources.ts` | New file |
| Validators index | `packages/validators/src/index.ts` | Export new schemas |
| API routes | `apps/api/src/routes/resources.ts` | New file — all resource endpoints |
| App mount | `apps/api/src/app.ts` | Mount resources router at `/api/clubs/:clubId` before existing `clubResources` |
| Resources page | `apps/web/app/(club)/club/[clubId]/resources/page.tsx` | New server component |
| Resources client | `apps/web/app/(club)/club/[clubId]/resources/ResourcesClient.tsx` | New client component |
| Sidebar | `apps/web/components/club/Sidebar.tsx` | Add "Resources" nav entry |

---

## Verification

| Scenario | Expected result |
|---|---|
| Create "Golf Carts" — individual, 12 units, 18-hole window 270 min | Page shows 12 available, 0 in maintenance |
| Add Cart #1 through Cart #12 as items | Item list shows 12 green "available" pills |
| Mark Cart #3 as in maintenance with note "Needs new front tire" | Available count drops to 11; Cart #3 shows red pill with note |
| Mark Cart #3 as available | Count returns to 12; note cleared |
| Retire Cart #12 | Count drops to 11; retired items hidden from available count; "Retire" action no longer available |
| Create "GPS Units" — pool, 20 units | Shows "20 available" with no item list |
| Update GPS Units total to 22 | Card updates to 22 |
| Create "Towels" — consumable, track=false | Shows "Unlimited — not tracked"; no stock field visible |
| Create "Range Balls" — consumable, track=true, initial stock=200 | Shows "200 in stock" |
| Restock Range Balls +50, reason "Delivery #42" | Stock becomes 250; restock log records the entry |
| Adjust Range Balls −10, reason "Water damaged" | Stock becomes 240; log records negative delta with reason |
| Create rental type with 9-hole=2.5h, 18-hole=4.5h, default=4.5h | Saved as 150, 270, 270 minutes; UI displays hours on reload |
| Create rental type with no default window | Validation error: default fallback is required |
| Create "Golf Lessons" — service | Card shows "Availability managed manually"; no stock or window fields |
| Create consumable with trackingMode set | Validation error: consumables must have trackingMode=null |
| Attempt to hard-delete a resource type with items | 409 response; soft-delete (active=false) is offered instead |
