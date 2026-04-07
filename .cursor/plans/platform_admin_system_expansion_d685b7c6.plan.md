---
name: Platform Admin System Expansion
overview: "Expand the platform admin System section from two \"Coming soon.\" stubs into five fully-built sections: Settings (General, Feature Flags, Security, Email), Billing (Revenue Overview, Subscriptions, Invoices, Stripe), Users, Audit Log, and Announcements — each as its own set of sub-pages linked from an overview index."
todos:
  - id: db-schema
    content: Add 4 new DB schema files (platform_settings, invoices, audit_log, announcements), update clubs with Stripe fields, run migration
    status: completed
  - id: sidebar-nav
    content: Update PlatformSidebar.tsx to add Users, Audit Log, Announcements under System nav
    status: completed
  - id: settings-pages
    content: Build /platform/settings index + 4 sub-pages (General, Feature Flags, Security, Email) with API wiring
    status: completed
  - id: users-page
    content: Build /platform/users page with search, role filter, suspend/promote actions and API routes
    status: completed
  - id: announcements-pages
    content: Build /platform/announcements list + create/edit drawer with audience targeting and scheduling
    status: completed
  - id: audit-log-page
    content: Build /platform/audit-log read-only table with filters; wire audit writes from all mutating actions
    status: completed
  - id: billing-overview
    content: Build /platform/billing index + overview sub-page (MRR, ARR chart from invoices table)
    status: completed
  - id: billing-subscriptions
    content: Build /platform/billing/subscriptions - inline editable club subscription_type + booking_fee table
    status: completed
  - id: billing-invoices
    content: Build /platform/billing/invoices - paginated invoice history with create/send/void via Stripe
    status: completed
  - id: stripe-setup
    content: Build /platform/billing/stripe config page, add Stripe webhook handler to Express
    status: completed
isProject: false
---

# Platform Admin System Expansion

## Current state
- [`apps/web/app/(platform)/platform/settings/page.tsx`](apps/web/app/(platform)/platform/settings/page.tsx) — "Coming soon." stub
- [`apps/web/app/(platform)/platform/billing/page.tsx`](apps/web/app/(platform)/platform/billing/page.tsx) — "Coming soon." stub
- [`apps/web/components/platform/PlatformSidebar.tsx`](apps/web/components/platform/PlatformSidebar.tsx) — System nav has only Billing + Settings
- No API routes exist for either section
- No DB tables for platform settings, invoices, audit log, or announcements

## New System nav structure

The sidebar System section grows from 2 to 5 items:
- Settings
- Billing
- Users (new)
- Audit Log (new)
- Announcements (new)

Each top-level page becomes a card-grid index linking to sub-pages (the "separate pages per concern" design choice).

---

## 1. Settings

### Sub-pages
- `/platform/settings` — index with 4 cards
- `/platform/settings/general` — platform name, logo URL, support email, default timezone
- `/platform/settings/feature-flags` — toggle table: key / description / enabled / per-env
- `/platform/settings/security` — session timeout, allowed SSO domains, password policy
- `/platform/settings/email` — template editor for booking confirmation, reminders, cancellation

### New DB table — `platform_settings`
```sql
id, key TEXT UNIQUE, value JSONB, updated_by UUID, updated_at TIMESTAMPTZ
```
Key/value JSONB store — flexible for all four setting categories without separate tables.

### New API routes (in [`apps/api/src/routes/platform.ts`](apps/api/src/routes/platform.ts))
- `GET /api/platform/settings` — returns all settings as `{ [key]: value }`
- `PUT /api/platform/settings/:key` — upsert a single key (writes audit log entry)

---

## 2. Billing

### Sub-pages
- `/platform/billing` — index with 4 cards
- `/platform/billing/overview` — MRR, ARR, total collected; chart of revenue over time
- `/platform/billing/subscriptions` — table of clubs with subscription_type + booking_fee; inline edit
- `/platform/billing/invoices` — paginated invoice history across all clubs; filter by club/month/status
- `/platform/billing/stripe` — Stripe publishable key config, webhook status, test-mode toggle

### New DB table — `invoices`
```sql
id, club_id UUID FK clubs, period_start DATE, period_end DATE,
amount_cents INT, status TEXT (draft|sent|paid|void),
stripe_invoice_id TEXT, created_at, updated_at
```

### Stripe fields added to `clubs` table
- `stripe_customer_id TEXT`
- `stripe_subscription_id TEXT`

### New API routes
- `GET /api/platform/billing/overview` — aggregate revenue stats from `invoices`
- `GET/PATCH /api/platform/billing/subscriptions` — read/update `subscription_type` + `booking_fee` per club
- `GET/POST /api/platform/invoices` — list invoices; create/send via Stripe Invoices API
- `POST /api/platform/invoices/:id/void` — void an invoice
- `POST /api/stripe/webhook` — Stripe webhook handler (invoice.paid, invoice.payment_failed)

---

## 3. Users

### Page — `/platform/users`
- Searchable, filterable table of all users across the platform
- Columns: name, email, role, club(s), last login, status
- Actions: view details, suspend/reactivate, reset password (send email), promote to platform_admin

### New API routes
- `GET /api/platform/users` — paginated, filterable user list with role joins
- `PATCH /api/platform/users/:userId` — update status or role
- `POST /api/platform/users/:userId/reset-password` — trigger reset email

---

## 4. Audit Log

### Page — `/platform/audit-log`
- Immutable, append-only log of all platform admin actions
- Columns: timestamp, actor, action, target entity, before/after diff
- Filter by actor, action type, date range

### New DB table — `audit_log`
```sql
id, actor_id UUID FK users, action TEXT, entity_type TEXT,
entity_id TEXT, meta JSONB, created_at TIMESTAMPTZ
```

### New API route
- `GET /api/platform/audit-log` — paginated, filterable

### Writes triggered by
- Any `PUT /platform/settings/:key`
- Club subscription/fee changes
- Invoice create/send/void
- User role changes / suspensions
- Announcement create/edit/delete

---

## 5. Announcements

### Page — `/platform/announcements`
- List of past/active/scheduled announcements with status badge
- Create/edit drawer: title, body (rich text), target audience (all golfers / all clubs / specific club), schedule/publish date
- Publish/unpublish/delete actions

### New DB table — `announcements`
```sql
id, title TEXT, body TEXT, audience TEXT (all|clubs|club_specific),
club_id UUID nullable, status TEXT (draft|active|archived),
publish_at TIMESTAMPTZ, created_by UUID FK users, created_at, updated_at
```

### New API routes
- `GET /api/platform/announcements` — list
- `POST /api/platform/announcements` — create
- `PATCH /api/platform/announcements/:id` — update/publish/archive
- `DELETE /api/platform/announcements/:id` — delete draft only

---

## Files touched

- [`packages/db/src/schema/`](packages/db/src/schema/) — add 4 new schema files: `platform-settings.ts`, `invoices.ts`, `audit-log.ts`, `announcements.ts`; update `clubs.ts` with Stripe fields; update `index.ts`
- [`packages/db/src/`](packages/db/src/) — new migration
- [`apps/api/src/routes/platform.ts`](apps/api/src/routes/platform.ts) — add all new routes above
- [`apps/api/src/app.ts`](apps/api/src/app.ts) — mount Stripe webhook route (raw body parser)
- [`apps/web/components/platform/PlatformSidebar.tsx`](apps/web/components/platform/PlatformSidebar.tsx) — add Users, Audit Log, Announcements to System nav
- New page files under [`apps/web/app/(platform)/platform/`](apps/web/app/(platform)/platform/)

---

## Phasing recommendation

Given the scope, a natural build order:

1. **Settings** (no Stripe dependency, fast to build, unblocks other sections via audit log write)
2. **Users** (pure DB reads, no new tables)
3. **Announcements** (isolated, new table, no external dependencies)
4. **Audit Log** (depends on writes from steps 1–3 being wired)
5. **Billing** (highest complexity — Stripe API, new tables, invoice flow)
