# TeeTimes — Design System Reference

> **For AI agents.** Read this before writing any UI code. Every visual decision in this
> codebase follows these patterns. Do not deviate without explicit instruction from the user.
> When in doubt, refer to the HTML design references in `/design/`.

---

## Design references (source of truth)

| File | What it covers |
|---|---|
| `/design/teetimes-redesign.html` | Mobile golfer booking flow — 5 screens |
| `/design/teetimes-desktop.html` | Desktop golfer booking flow — 5 screens |
| `/design/teetimes-club-ui.html` | Club staff UI — dashboard, tee sheet, drawer, modal, tablet |
| `/design/teetimes-inventory-v2.html` | Inventory/resources UI — 3 view modes, drawer, wizard |

When a prompt references "match the design reference," open the relevant HTML file
and use it as pixel-level guidance. Do not guess or approximate.

---

## Core philosophy

**The server is always the source of truth.** The UI is a display layer. Every constraint
that matters — capacity, permissions, cancellation windows, status transitions — lives in
the API or the database, never trusted from the client.

**Engine before interface.** Pure functions and shared utilities are built before the
components that use them. `slotGenerator.ts`, `configResolver.ts`, `isCancellable()`,
`useResourceView()` — these exist independently of any component and are testable in
isolation.

**One design system, two contexts.** The golfer-facing booking flow and the club staff
UI share the same tokens, fonts, and component patterns. The only intentional visual
difference between club UI and platform admin is the sidebar background color.

**Operational UIs are about scanning, not reading.** The tee sheet, inventory grid,
and club list are designed to be understood at a glance. Dense information is structured
spatially, not textually. Status is communicated by color, not just words.

---

## Typography

Two weights only: **400 regular** and **500/600 medium**. Never use 700 in body text —
it reads as heavy against the warm-white background.

### Font families

```css
font-family: 'Playfair Display', serif;   /* headings, display numbers, hero text */
font-family: 'DM Sans', sans-serif;        /* all UI text, labels, buttons, body */
font-family: 'DM Mono', monospace;         /* times, booking refs, IDs, stock numbers */
```

Load from Google Fonts:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
```

### Type scale

| Use | Size | Weight | Font |
|---|---|---|---|
| Page title / hero | 32–62px | 700 | Playfair Display |
| Card heading | 16–20px | 400 | Playfair Display |
| Section heading | 16px | 400 | Playfair Display |
| Large metric / number | 22–28px | 700 | Playfair Display |
| Nav item | 12–13px | 500 | DM Sans |
| Body / label | 13–14px | 400 | DM Sans |
| Small label / eyebrow | 9–11px | 700 | DM Sans |
| Button | 13–15px | 600 | DM Sans |
| Time / ref / ID | 12–14px | 400–500 | DM Mono |

### Eyebrow labels

Section eyebrows and category labels follow a consistent pattern:
```css
font-size: 10px;
font-weight: 700;
letter-spacing: 0.12–0.14em;
text-transform: uppercase;
```
Color varies by context: gold for category labels, muted for neutral sections.

---

## Color palette

### Core palette

```css
--forest:      #1a3a2a;   /* darkest green — sidebar hero cards, dark CTAs */
--fairway:     #2d5a3d;   /* primary green — CTAs, active nav, primary buttons */
--grass:       #4a8c5c;   /* mid green — status dots, pip fills, success fills */
--light-grass: #7ab88a;   /* light green — subtle fills */
--gold:        #c9a84c;   /* gold — accent labels, inventory section, premium feel */
--gold-light:  #f0d98a;   /* light gold — text on dark green backgrounds */
--cream:       #faf7f2;   /* warm off-white — page backgrounds, muted card fills */
--stone:       #e8e0d0;   /* warm gray — borders, dividers, empty pip dots */
--warm-white:  #fefcf8;   /* near white — card backgrounds, content areas */
--ink:         #1c2118;   /* near black with green tint — primary text */
--muted:       #6b7a6e;   /* green-gray — secondary text, icons, placeholders */
--sidebar-bg:  #1c1f1d;   /* near black — club sidebar background */
```

### Type accent colors (inventory / resources)

```css
--rental-accent:     #2d5a3d;   /* = --fairway */
--rental-tint:       #edf5f0;
--inventory-accent:  #c9a84c;   /* = --gold */
--inventory-tint:    #fdf8ed;
--service-accent:    #4a6a8c;   /* slate blue */
--service-tint:      #edf1f8;
```

### Status colors

```css
--status-available:   #4a8c5c;   /* = --grass */
--status-low:         #b8770a;   /* amber — low stock, warnings */
--status-maintenance: #c0392b;   /* red — in maintenance, errors */
--status-unavailable: #888780;   /* neutral gray — off season, disabled */
```

### Platform admin

The platform admin sidebar uses `bg-slate-900` (`#0f172a`) instead of `--sidebar-bg`.
Everything else is identical to the club UI.

### Usage rules

- **Never hardcode hex values in components.** Use CSS variables or Tailwind config.
- **Text on dark backgrounds** (forest, sidebar): white or `rgba(255,255,255,0.55–0.65)` for secondary text.
- **Text on tinted backgrounds** (rental-tint, inventory-tint): use the 800 stop of the matching color family.
- **Never use pure black** (`#000`) for text. Always use `--ink`.
- **Borders are always 0.5–1px solid** using `--stone` or `rgba(0,0,0,0.07–0.15)`.

---

## Spacing and layout

### Border radius

```css
4px   /* subtle — badge corners, small chips */
8px   /* default — form inputs, small buttons, tabs */
10px  /* cards in dense layouts (list rows, stat cards) */
12px  /* standard card radius */
14px  /* CTA buttons, larger modals */
16px  /* slide-over panels, large modal dialogs */
20px  /* hero sections, full-width panels */
44px  /* phone shell (design references only) */
```

### Card anatomy

Every card in this system follows the same structure:

```
Outer: bg-warm-white, 1px stone border, 12px radius
  Optional: colored left accent bar (3px wide, full height, absolute)
  
Body: 13–16px padding (add 17px left padding when accent bar is present)
  
Footer (optional): cream bg, 1px stone top border, 8px padding
```

### Spacing rhythm

Use `rem` for vertical spacing between sections (0.5rem, 1rem, 1.5rem, 2rem).
Use `px` for internal component spacing (4px, 6px, 8px, 10px, 12px, 16px, 20px, 24px).

### Grid systems

**Card grids:** `grid-template-columns: repeat(4, 1fr)` — 4 columns at 1280px+.
**Two-column layouts:** `grid-template-columns: 1fr 300px` (dashboard) or `1fr 380px` (confirm/detail).
**Tee sheet / table rows:** `grid-template-columns: 80px 1fr 110px 100px 120px 110px`.
**List rows (inventory):** `grid-template-columns: 3px 1fr 110px 110px 110px 130px`.

---

## Component patterns

### Buttons

```
Primary CTA:    bg-fairway, white text, 8–14px radius, DM Sans 600
Ghost/secondary: cream bg, ink text, 1px stone border
Danger:         red-50 bg, red-700 text, no border
Success action: green-50 bg, green-700 text, no border (e.g. "Check in")
Warning action: amber-50 bg, amber-700 text (e.g. "Block")
```

All buttons use `font-family: 'DM Sans'` explicitly — never inherit from a serif parent.
Hover: `opacity: 0.9` on primary, `bg-cream` on ghost.
Disabled: `opacity: 0.4`, `cursor: default`.
Never use `pointer-events: none` for disabled — always set `disabled` attribute too.

### Form inputs

```css
padding: 9–12px 11–14px;
border: 1.5px solid var(--stone);
border-radius: 8px;
font-family: 'DM Sans', sans-serif;
font-size: 13–15px;
color: var(--ink);
background: #fff;
outline: none;
```

Focus: `border-color: var(--grass)` — no box shadow.
Filled/valid: `border-color: var(--grass); background: #f8fdf9`.
Error: `border-color: var(--status-maintenance)`.

Field labels:
```css
font-size: 10–11px;
font-weight: 700;
letter-spacing: 0.08–0.1em;
text-transform: uppercase;
color: var(--muted);
margin-bottom: 5–8px;
display: block;
```

### Status badges

```tsx
// Usage: <StatusBadge status="confirmed" />
type Status = 'confirmed' | 'checked-in' | 'no-show' | 'blocked' | 'open'
               | 'available' | 'low' | 'maintenance' | 'unavailable'

// Styles
confirmed:   bg-green-50   text-green-700
checked-in:  bg-emerald-50 text-emerald-800
no-show:     bg-red-50     text-red-700
blocked:     bg-amber-50   text-amber-700
open:        bg-stone-100  text-stone-500
available:   bg-green-50   text-green-700
low:         bg-amber-50   text-amber-700
maintenance: bg-red-50     text-red-700
unavailable: bg-stone-100  text-stone-500

// Anatomy: inline-flex, items-center, gap-4px, 10px font, 700 weight, 3px 8px padding, 10px radius
```

### Status dots

Small 7–9px circles used in card corners and list rows:
```css
width: 7px; height: 7px; border-radius: 50%;
available:   background: var(--status-available)
low:         background: var(--status-low)
maintenance: background: var(--status-maintenance)
unavailable: background: var(--status-unavailable)
```

### Pip dots (tee sheet / booking capacity)

```css
width: 7–10px; height: 7–10px; border-radius: 50%;
filled (booked):  background: var(--grass)
empty (open):     background: var(--stone)
```

Render one pip per `maxPlayers`. Fill pips from left to right based on `bookedPlayers`.
Never render pips with text alternatives only — always render the visual dots.

### Type accent bars (inventory cards and list rows)

```css
position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
rental:     background: var(--rental-accent)    /* #2d5a3d */
inventory:  background: var(--inventory-accent) /* #c9a84c */
service:    background: var(--service-accent)   /* #4a6a8c */
```

Always add `padding-left: 17px` to the card body to clear the accent bar.

### Monospace references

Booking refs, unit IDs, times, stock numbers displayed prominently use DM Mono:
```css
font-family: 'DM Mono', monospace;
font-size: 12–14px;
font-weight: 400–500;
color: var(--ink) or var(--muted)
```

Large prominent refs (success screen): 20–26px, `color: var(--fairway)`, `letter-spacing: 0.1em`.

---

## Layout shells

### Golfer-facing (booking flow)

**Mobile:** Bottom navigation (4 items: Discover, Search, Saved, Account). 60px height.
Active item: icon + label in fairway green.

**Desktop:** Top navigation bar. 64px height. Forest background.
Logo left → nav links center → sign in / create account right.
Inner pages: `← Back` text link in top nav, no floating back button.

**Page width:** `max-width: 1320px; margin: 0 auto; padding: 0 48px`.

### Club staff UI

**Sidebar:** Fixed left, 220px desktop / 64px icon-only tablet.
Background: `--sidebar-bg` (#1c1f1d).
Structure top to bottom: logo row → club switcher → nav sections → divider → bottom user row.

**Sidebar nav sections:**
- "Operations": Dashboard, Tee sheet, Bookings (with count badge)
- "Management": Courses, Resources, Staff, Settings, Reports, Public page

**Section labels:** 9px, 700 weight, 0.14em tracking, uppercase, `rgba(255,255,255,0.25)`.

**Nav items:**
- Inactive: `rgba(255,255,255,0.55)` text, transparent bg
- Hover: `rgba(255,255,255,0.06)` bg
- Active: `bg-fairway`, white text

**Top bar:** 54–56px height, warm-white bg, 1px stone border-bottom.
Left: page title (Playfair Display 17–18px).
Center: date navigator (club tee sheet pages only).
Right: context-specific action buttons.

**Main content:** `flex-1; overflow-y: auto` — scrolls independently of sidebar.
Default padding: `24px`.

**Tablet (< 1024px):** Sidebar collapses to 64px icon-only. Labels hidden. Shadcn Tooltip on hover.

### Platform admin UI

Identical shell to club UI. Only difference: `bg-slate-900` sidebar instead of `--sidebar-bg`.
Add "Platform admin" badge below logo. No club switcher.

Nav sections:
- "Overview": Dashboard, Clubs
- "System": Billing (stub), Settings (stub)

---

## Slide-over panels (drawers)

Used for: booking detail, resource/inventory detail.

```tsx
<div className={cn(
  "fixed right-0 top-0 h-full bg-warm-white border-l border-stone z-50",
  "overflow-y-auto transition-transform duration-200",
  "w-full lg:w-[400–420px]",
  isOpen ? "translate-x-0" : "translate-x-full"
)} />
```

Always accompanied by a semi-transparent overlay: `fixed inset-0 bg-black/30 z-40`.
Close: ✕ button in header + Escape key.
Never use `position: fixed` for content inside the drawer — let it scroll naturally.

**Drawer header:**
```
Close button (28px circle, cream bg, stone border, ✕ text)
Title (Playfair Display 16px)
Optional: status badge or type badge right-aligned
```

**Dark hero card (inside drawer):**
```css
border-radius: 12px;
padding: 16–18px;
margin-bottom: 16–18px;
position: relative; overflow: hidden;

rental / booking: background: var(--forest)
inventory:        background: #7a5c0a
service:          background: var(--service-accent)
```

Decorative circles:
```css
position: absolute;
border-radius: 50%;
border: 1px solid rgba(255,255,255,0.12–0.15);
/* Two circles: one large top-right, one smaller bottom-right */
```

Hero content:
- Type eyebrow: 9px uppercase, `rgba(255,255,255,0.45–0.5)`
- Main name: Playfair Display 19–20px, white
- Metrics row: 2–3 metric pairs (Playfair Display 22–24px white value + 10px muted label)
- Status pill: `rgba(255,255,255,0.1)` bg, 10px font, fairway dot, white text

**Info rows inside drawer:**
```
display: flex; justify-content: space-between;
padding: 8–9px 0;
border-bottom: 1px solid var(--stone);
font-size: 13px;
label: color var(--muted)
value: font-weight 500, color var(--ink)
```

**Drawer footer:**
```
padding: 13–16px 20px;
border-top: 1px solid var(--stone);
display: flex; gap: 8px;
```
Typically: danger button (left) + primary button (right).

---

## Modals and wizards

**Modal shell:** shadcn `<Dialog>`. Fixed width 480–540px. Centered. `border-radius: 16px`.

**Wizard step indicator:**

```
Three numbered circles connected by lines.

Done:    bg-fairway, white ✓, no ring
Active:  bg-fairway, white number, 3px ring rgba(45,90,61,0.12)
Pending: bg-cream, stone border, muted number

Connector line: --stone default, --fairway when done
```

Step label: 11–12px, 600 weight.
Done/active: fairway color. Pending: muted.

**Wizard pre-selected type chip:**
When a wizard is opened with a type pre-selected, show a chip instead of type tiles:
```
Colored chip (tinted bg, accent border):
  [type icon] Type label | Type name | "Change" link (right, underline on hover)
```
"Change" always returns to step 1. Never trap the user in a pre-selected state.

**Type selection tiles (3-column grid):**
```
Selected: 2px accent-color border, tinted background
Unselected: 2px stone border, white bg
Hover (unselected): grass border color

Content: icon (38px container) + name (13px 600) + description (11px muted)
```

---

## Dark section patterns

Used in hero areas, booking summary cards, and drawer heroes:

```css
background: var(--forest);   /* standard dark green */
position: relative; overflow: hidden;

/* Decorative concentric circles */
.pattern-circle {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(74,140,92,0.2–0.3);   /* or rgba(255,255,255,0.1) */
}
```

Text hierarchy on dark green:
- Primary: `color: #fff`
- Secondary: `color: rgba(255,255,255,0.55–0.65)`
- Eyebrow/label: `color: var(--gold)` or `rgba(255,255,255,0.45)`
- Ref/mono values: `color: var(--gold-light)`

---

## Interaction states

### Hover

Cards: `transform: translateY(-1px); box-shadow: 0 4px 18px rgba(0,0,0,0.08); border-color: #ccc`.
Table/list rows: `background: var(--cream)`.
Nav items: `background: rgba(255,255,255,0.06)`.
Add-new cards: `border-color: var(--grass); background: #f0fdf4; color: var(--fairway)`.

### Active / selected

Current route in nav: `background: var(--fairway); color: #fff`.
Selected date chip: `background: var(--forest); border-color: var(--forest); color: #fff`.
Selected time slot: green left border `3px solid var(--grass)`, `background: #f0fdf4`.
Active filter pill: `background: var(--ink); color: #fff; border-color: var(--ink)`.

### Disabled / past

Past tee sheet rows: `opacity: 0.4`.
Full slots in booking flow: `opacity: 0.35–0.38; cursor: not-allowed`.
Disabled buttons: `opacity: 0.4; cursor: default`.

### Loading / submitting

Buttons during async operations: `disabled` attribute + spinner icon + reduced opacity.
Never allow double-submission. Disable immediately on first click.
Optimistic UI for status toggles: update local state immediately, revert on API error.

---

## "Now" indicator (tee sheet)

```tsx
<div className="flex items-center gap-2 px-6 py-1.5 bg-green-50 border-b border-green-200 sticky top-9 z-10">
  <div className="w-2 h-2 rounded-full bg-grass" />
  <span className="text-xs font-bold text-green-700">Now</span>
  <span className="font-mono text-xs text-green-700">{format(new Date(), 'h:mm a')}</span>
</div>
```

The current row (first upcoming slot) gets:
```css
background: #f0fdf4;
border-left: 3px solid var(--grass);
padding-left: adjusted to compensate for border;
```

---

## Section dividers with labels

Used in inventory and tee sheet to introduce groups:

```tsx
<div className="flex items-center gap-2.5 mb-3">
  <span className="text-[10px] font-bold tracking-[0.14em] uppercase whitespace-nowrap" style={{ color: accentColor }}>
    {label}
  </span>
  <div className="flex-1 h-px bg-stone" />          {/* fades right using gradient optionally */}
  <span className="text-[11px] text-muted whitespace-nowrap">{count} items</span>
  <button className="section-add-btn">+ Add {type}</button>
</div>
```

---

## Three-way view toggle (inventory)

```tsx
// Icon order: grouped grid | flat grid | list
// Grouped grid icon: 2×2 squares
// Flat grid icon: 3×3 small squares
// List icon: horizontal lines with dots

<div className="flex bg-cream border border-stone rounded-lg overflow-hidden">
  {views.map(v => (
    <button
      key={v.id}
      title={v.label}
      className={cn("p-1.5 border-r border-stone last:border-r-0 transition-colors",
        active === v.id ? "bg-white shadow-sm [&_svg]:text-fairway" : "[&_svg]:text-muted"
      )}
      onClick={() => setActive(v.id)}
    >
      {v.icon}
    </button>
  ))}
</div>
```

Persist preference to `localStorage` keyed by `teetimes:resources:view:${clubId}`.
Default: `'grouped'`.

---

## Ticket / confirmation card pattern

Used on booking success and confirmation screens:

```
Dark header (forest bg):
  Decorative circle (absolute, top-right)
  Venue/club name (Playfair Display 16–20px, white)
  Date/details (13px, rgba(255,255,255,0.55))

Tear-line divider:
  <div class="flex items-center bg-cream">
    <div class="w-5 h-5 rounded-full bg-warm-white border border-stone -ml-2.5" />
    <div class="flex-1 border-t-[1.5px] border-dashed border-stone mx-1.5" />
    <div class="w-5 h-5 rounded-full bg-warm-white border border-stone -mr-2.5" />
  </div>

White body:
  2×2 grid of field pairs (label + value)
  Booking ref section (border-top, DM Mono 20–26px, fairway color)
```

---

## Empty states

Every list, grid, or table must handle the empty state gracefully:

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <svg ... className="w-12 h-12 text-stone mb-4" />
  <h3 className="font-display text-lg text-ink mb-2">{title}</h3>
  <p className="text-sm text-muted max-w-xs leading-relaxed mb-6">{description}</p>
  <button className="btn-primary">{ctaLabel}</button>
</div>
```

Never show a blank page. Never show a loading spinner that never resolves.

---

## Error states

**Inline form errors:** Red text below the field, 11px, no border change on the field itself.
**Slot full (409):** Close the confirm sheet, show inline banner on slot list:
```
"That slot just filled — please choose another time."
```
**API errors in modals:** Show below the submit button, keep form data intact, re-enable button.
**Network errors:** Toast notification, not a full-page error.
**AlertDialog for destructive actions:** Always confirm before: suspend club, delete resource, cancel booking.

---

## Responsive breakpoints

```
Desktop:  ≥ 1280px  — full sidebar 220px, 4-column grids, side-by-side layouts
Tablet:   1024–1279px — sidebar collapses to 64px icon-only, some columns hidden
Mobile:   < 768px   — golfer flow only (staff UI is desktop/tablet only)
```

**Tablet adaptations (< 1024px):**
- Sidebar: `width: 64px`, all text labels hidden, `<Tooltip>` on each icon
- Notification badge: dot only, not a number
- Tee sheet: hide Price column (`hidden lg:table-cell`)
- Action buttons: icon-only with `<Tooltip>` (same label as text version)
- Slide-over: `w-full` instead of fixed width

**Mobile (golfer flow):**
- All screens: 390px base, mobile-first
- Bottom navigation replaces top nav
- No sidebar — each screen is full-width
- Tee time slots: scrollable list, not a table

---

## Language and labeling rules

These apply to every user-facing string in the application:

| Internal term | User-facing label |
|---|---|
| `usageModel: 'consumable'` | "Inventory" (section label, buttons, wizard tiles) |
| `usageModel: 'consumable'` | "Consumable" (small type badge on detail cards only) |
| `booking_ref` | Show as "PINE-A3F9K2" (not the UUID) |
| `booked_players` | "N spots" or "N of 4" |
| `status: 'confirmed'` | "Confirmed" |
| `status: 'no_show'` | "No-show" |
| `operationalStatus: 'maintenance'` | "In maintenance" |
| `deleted_at` is set | Never show to users — soft delete is invisible |
| Cancellation outside window | "Free cancellation up to N hours before your tee time." |
| Cancellation inside window | "Cancellations inside the window are non-refundable." |
| Club `status: 'suspended'` | "Suspended" badge (never "deleted" or "disabled") |

**Never expose:**
- UUIDs on customer-facing surfaces
- Internal field names (`usageModel`, `trackingMode`, `deletedAt`)
- UTC datetimes — always convert to club timezone before display
- API error codes — translate to human-readable messages

---

## Timezone handling

- **Store:** All datetimes in PostgreSQL as `timestamptz` UTC
- **Display:** Always convert to the club's configured timezone using `date-fns-tz`
- **Never show UTC to users** — if a time displays as "11:00 AM" when the club timezone
  is `America/New_York` and the UTC time is `15:00`, that is a bug
- **The club's timezone** is in `club_config.timezone` (IANA format, e.g. `America/New_York`)
- **Resolve config** for a given date using `resolveConfig(configs, targetDate)` then
  `resolveHours(config, dayOfWeek)` — never use flat `open_time`/`close_time` directly
  without checking for schedule overrides first

---

## What never changes

These patterns are established and must not be deviated from without explicit user instruction:

1. **Fonts:** Playfair Display + DM Sans + DM Mono — no substitutions
2. **Primary green:** `--fairway` `#2d5a3d` — not `#16a34a` (Tailwind green-600), not any other green
3. **Warm white background:** `--warm-white` `#fefcf8` — not pure white `#ffffff`
4. **Left accent bar on cards:** 3px, full height, absolute positioned — not a top border
5. **Status dots:** 7px circles — never replaced with text-only status
6. **Pip dots:** always rendered visually — never replaced with "N spots left" text only
7. **Soft deletes:** `deleted_at` column — never hard delete booking records
8. **Concurrency:** atomic `UPDATE ... RETURNING *` for slot booking — never read-then-write
9. **Booking refs:** human-readable `PINE-A3F9K2` format — never raw UUIDs on UI
10. **Timezone display:** always club local time — never UTC
