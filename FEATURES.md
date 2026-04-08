# TeeTimes — Feature Inventory

> Auto-generated from a full codebase scan on 2026-04-08.
> This document replaces the earlier `plan.md` roadmap, which is now archived.

---

## Public Booking Flow

- **Landing page** — Featured clubs grid, "newly added" section, tag-based discovery chips (9/18 holes, course character), and a "today's tee times" teaser showing live availability for the first featured club.
- **Club search** — Text search with tokenized ILIKE matching, tag filters, 9/18-hole layout shortcuts, geographic proximity sort (`near_lat`/`near_lng`), and paginated results.
- **Google Places Autocomplete** — Location input powered by the Maps JavaScript API (regions mode) on the home and search pages.
- **Club profile** — Public page per slug with hero image, courses list, hours (default + per-day schedule), and a sticky "Book a Tee Time" CTA.
- **Tee time picker** — Seven-day date chips, course tabs, player stepper (1–4), morning/afternoon sections, "soonest available" chips, and real-time availability from the API.
- **Booking confirmation** — Multi-step wizard: contact details → optional add-ons (quantity picker with per-add-on max) → payment. Supports Stripe (CardElement + PaymentIntent) when fees apply, or a free/unpaid path when no charges are due. 409 conflict handling redirects back to times if the slot fills.
- **Success page** — Ticket-style card with booking reference, amount charged, date/time in club timezone, and CTAs to book again or view "My Bookings."
- **Waitlist** — When a slot is full and the platform feature flag is enabled, guests can join a waitlist (name, email, players). On cancellation the next entry receives an email with a 24-hour claim link that completes the booking in a single GET.
- **Guest registration banner** — Unauthenticated users see a prompt to register during the booking flow; post-registration redirects back to where they left off.

## Authentication & User Management

- **Credentials login** — Email/password via NextAuth v5 (Auth.js) Credentials provider; the web app posts to the Express API, receives a JWT, and stores it in the NextAuth session.
- **JWT auth** — Shared `JWT_SECRET`/`NEXTAUTH_SECRET` between Express and Next.js. Tokens carry `userId` and `roles[]`. Purpose-scoped tokens for guest cancel (48 h), staff invite (7 d), and password reset (1 h).
- **Registration** — Golfer self-registration with duplicate-email detection (409).
- **Forgot / reset password** — Rate-limited email with a 1-hour reset token; React Email template; redirect flow back to login on success.
- **Staff invite & set-password** — Admin invites a staff member by email; the invite creates a user row without a password and enqueues an email linking to `/set-password?token=…`.
- **Role-based access control** — Four roles: `platform_admin` (global), `club_admin`, `staff` (both club-scoped), and `golfer`. Express middleware enforces roles per route. Next.js middleware protects `/platform` and `/club` routes with redirect to login or forbidden.
- **Rate limiting** — General public limit (60 req/60 s, configurable via env) and a stricter booking limit (10 req/60 s).

## Golfer Area

- **My Bookings** — Upcoming and past tabs with pagination, cancellation eligibility per club policy, payment status badges, and timezone-aware date formatting.
- **Cancel booking** — Enforces the club's cancellation window (whole-hour comparison). On cancel: slot capacity restored, add-on resources freed, waitlist notified, cancellation email sent.

## Club Staff Dashboard

### Overview

- **Dashboard** — KPI cards (bookings today, utilisation %, revenue, no-shows), 7-day sparkline trend, today's tee sheet preview with course tabs, alerts panel (no-shows, fully booked courses), and quick-action buttons.
- **Navigation** — Responsive sidebar (icon-only with tooltips on small screens), club switcher for multi-club users, sticky top bar with contextual date navigation on tee sheet and bookings pages.

### Tee Sheet

- **Multi-course grid** — Time rows × course columns with per-course occupancy percentages and a "Now" row marker.
- **Drag-and-drop moves** — Draggable booking chips + droppable open cells; PATCH updates slot or creates a new one; add-ons are automatically recomputed after a move.
- **Slot states** — Open (bookable, droppable), booked (draggable chip with guest/ref label and player dots), blocked, and missing.
- **Filters** — All / open / booked / upcoming; 60-second silent auto-refresh; "Updated N s ago" indicator.

### Bookings

- **Bookings list** — Paginated table with search, sort, date-range filter (booked date or tee time), status and course filters, and per-page selector.
- **Booking drawer** — Side panel with guest info, price breakdown, per-player check-in / no-show toggles (optimistic PATCH), add-on lines with resource assignments, and cancel action.
- **Staff-created bookings** — Modal with tee time picker (chip grid or custom time), guest details, optional add-ons, and source tagged as `staff`.
- **Block slot** — Modal to block a tee time for a course/date/time with tee time picker and custom time fallback.

### Courses

- **Course CRUD** — Inline add/edit for course name and hole count (9 or 18).

### Add-Ons

- **Catalog management** — Table with inline edits (name, price), active toggle, and create dialog with optional link to a resource type and units-consumed setting.
- **Public catalog** — Unauthenticated endpoint serves active add-ons by club slug for the booking flow.

### Resources & Inventory

- **Resource types** — Three usage models (rental, consumable, service) with pool or individual tracking and configurable assignment strategy (auto, manual, none).
- **Resource items** — Individual-tracked units with operational status (available, in-use, maintenance, retired) and status transition history log.
- **Pool maintenance holds** — Create and resolve holds that reduce available pool capacity.
- **Restock** — Transactional stock delta for consumable/tracked-inventory types.
- **Auto-assignment** — On booking, the system picks free individual items by sort order; overlap is checked against rental windows per slot type with turnaround minutes.
- **Manual assignment** — Staff can POST/DELETE resource item assignments on add-on lines via the booking drawer.
- **UI views** — Three modes (grouped grid, flat grid, list) with persisted preference, search, and category filters (rental, consumable, service, low stock).
- **Add Item Wizard** — Three-step dialog: select type → details (rental windows, stock, assignment strategy) → confirm. Seeds individual items on creation.
- **Edit & drawer** — Edit dialog for all resource fields; drawer with hero metrics, items list, maintenance holds, restock, and delete.

### Reports

- **Daily series** — Bookings, players, combined revenue, occupancy % over a configurable period (7 / 30 / 90 days).
- **Booking sources** — Online vs staff counts in totals.
- **Client-side period switching** — Refetches with bearer token; updates URL via `history.replaceState`.

### Settings

- **Public listing** — Editable hero image URL and tag assignments (from platform catalog).
- **Versioned club config** — Slot interval (8/10/12 min), booking window days, cancellation hours, open/close times, optional per-day schedule, timezone, and effective-from date. Full config history table.
- **Staff directory** — List with role badges and pending-invite indicators; invite flow creates user + role + email.

## Platform Admin

### Dashboard

- **Stats** — Total/active/suspended clubs, bookings today, bookings this month.
- **Recent clubs** — Last 5 clubs with links to detail view; static "Platform status: Operational."

### Clubs

- **List** — Paginated table with status badges and actions.
- **Create** — Form with name, slug (live validation), timezone (grouped IANA picker), optional description and hero image. Seeds default config on creation.
- **Detail** — Club info, public URL, listing image editor, courses table, config history, subscription summary, staff count, suspend/activate with confirmation dialog.

### Users

- **Search & list** — Debounced search (300 ms), pagination, role badges with club names.
- **Actions** — Suspend/reactivate, promote to `platform_admin`, generate password-reset token.

### Tags

- **Definition CRUD** — Slug, label, sort order, optional group name, active toggle. Tags appear in public search filters and club profile badges.

### Announcements

- **Full lifecycle** — Create, edit, publish, archive, delete (draft only). Audience targeting: all, clubs, or specific club. Status tabs (draft / active / archived) with refetch.

### Audit Log

- **Filterable log** — Action type, actor email, date range filters; expandable JSON meta per entry; pagination.

### Settings

- **General** — Platform name, support email, default timezone, logo URL.
- **Email templates** — Subject and body for booking confirmation, cancellation, and reminder.
- **Feature flags** — Toggles for online booking, cancellation, guest booking, and waitlist (optimistic with rollback).
- **Security** — Session timeout, allowed domains, minimum password length.

### Billing

- **Overview** — KPI cards (total revenue, paid invoices, pending amount, active clubs) and monthly breakdown table.
- **Subscriptions** — Per-club inline editor for subscription type (trial / basic / premium), booking fee, and Stripe customer/subscription IDs.
- **Invoices** — List with club/status filters, create draft, transition (draft → sent → paid), void with confirmation.
- **Stripe settings** — Publishable key, secret key, webhook secret (show/hide), test-mode toggle, and static webhook URL reference.

## API & Backend Services

- **Express.js** on port 3001 with CORS, structured route mounting (public before parameterized), and `GET /health`.
- **Slot generation** — Tee slots are generated in-memory from club config (interval, hours, timezone) on each request. Only booked/blocked slots are persisted in the `tee_slots` table.
- **Availability merge** — Resolves effective config for the target date, generates slots, merges with DB rows, and filters by capacity / future / open status. Optional full-grid mode for admin tee sheet.
- **Redis availability cache** — JSON cache with 30-second TTL and `SCAN`+`DEL` pattern-based invalidation on booking/cancel/block. Graceful no-op when Redis is unavailable.
- **Booking reference** — Human-readable `PREFIX-CODE` format derived from club slug + random charset (no ambiguous characters), with up to 5 DB-uniqueness retries.
- **Add-on engine** — Transactional: validates catalog, decrements consumable stock, checks rental pool/individual overlap against rental windows, auto-assigns resource items, and supports restore + recompute on booking moves.
- **Search engine** — Tokenized text matching with stopword removal, hole-count shortcuts, escaped ILIKE patterns, course name subqueries, and geo-distance sorting.
- **Stripe integration** — `PaymentIntent` creation during booking, `confirm-payment` endpoint, and a raw-body webhook listener for `invoice.paid`, `invoice.payment_failed`, and `payment_intent.payment_failed` events.
- **Waitlist** — Join queue, token-based claim (HTML error pages or redirect), notifiedAt tracking, 24-hour expiry.

## Email System

- **BullMQ worker** — Processes the `email` queue on Redis with concurrency 2, exponential backoff (3 retries), and failed-job logging to the `failed_jobs` table.
- **React Email templates** — `BookingConfirmation` (ref, players, add-ons, total, manage link), `BookingCancellation`, `BookingReminder`, `PasswordReset` (1-hour expiry note), `WaitlistNotify` (claim CTA, 24-hour expiry).
- **Staff invite** — Inline HTML email with set-password link.
- **Resend integration** — Sends via Resend when `RESEND_API_KEY` is set; logs to console otherwise (safe for local dev).

## Database

- **PostgreSQL 16** via Docker Compose on `localhost:5432`.
- **Drizzle ORM** with 8 migrations and full relational schema.
- **Core tables** — `clubs`, `club_config` (versioned), `courses`, `tee_slots`, `bookings`, `booking_players`.
- **Add-ons** — `addon_catalog`, `booking_addon_lines`, `booking_resource_assignments`.
- **Resources** — `resource_types`, `resource_items`, `pool_maintenance_holds`, `resource_item_status_log`, `resource_restock_log`.
- **Users & auth** — `users`, `user_roles`.
- **Platform** — `platform_settings` (key-value JSON), `announcements`, `audit_log`, `invoices`, `club_tag_definitions`, `club_tag_assignments`, `waitlist_entries`, `failed_jobs`.
- **Seed scripts** — Base seed (clubs, courses, configs, users, tags, inventory), booking density seed (4-day synthetic slots/bookings), inventory seed (rentals, consumables, services with items), tag seed, and destructive reset.

## Shared Packages

| Package | Purpose |
|---------|---------|
| `@teetimes/db` | Drizzle schema, client, migrations, and seed scripts |
| `@teetimes/types` | `UserRole`, `JWTPayload`, `GeneratedSlot` TypeScript interfaces |
| `@teetimes/validators` | Zod schemas for all API inputs (auth, bookings, clubs, courses, add-ons, resources, announcements, tags, platform settings, billing, waitlist) |

## UI & Design System

- **Next.js 14** App Router with server components, server actions, and client components.
- **Tailwind CSS** with custom design tokens (`ds-body-bg`, `ds-ink`, `fairway`, `warm-white`, etc.).
- **Radix UI** primitives — Dialog, AlertDialog, Tooltip, Slot.
- **Sonner** for toast notifications.
- **@dnd-kit** for drag-and-drop on the tee sheet.
- **lucide-react** icons throughout.
- **class-variance-authority** for button variants (default, secondary, ghost, destructive, outline, link; sizes sm/default/lg/icon).
- **Google Fonts** — DM Sans, Playfair Display, DM Mono loaded as CSS variables.
- **Responsive design** — Mobile-first with sidebar collapse (icon-only + tooltips), mobile navigation strips, and responsive form layouts.

## Infrastructure & DevOps

- **pnpm + Turborepo** monorepo (`apps/api`, `apps/web`, `packages/db`, `packages/types`, `packages/validators`).
- **Docker Compose** — Postgres 16 + Redis 7 via `pnpm docker:up`.
- **GitHub Actions CI** — Typecheck, Vitest, and production build on push/PR.
- **Vitest** — Unit tests for health endpoint, public API invariants (no 401 on public routes), validators, and pure-lib helpers (`configResolver`, `slotGenerator`, `searchQuery`).
- **ESLint** — `next/core-web-vitals` for web; `typescript-eslint` flat config for API.

## Test Accounts (local dev only)

| Email | Role | Password |
|-------|------|----------|
| `admin@teetimes.dev` | Platform admin | `devpass` |
| `owner@testclub.dev` | Club admin (Pinebrook) | `devpass` |
| `staff@testclub.dev` | Staff (Pinebrook) | `devpass` |

Demo club: **Pinebrook** — `http://localhost:3000/book/pinebrook`
