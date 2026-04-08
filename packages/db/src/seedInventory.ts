import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "./schema/index";
import {
  clubs,
  resourceTypes,
  resourceItems,
  resourceRestockLog,
  poolMaintenanceHolds,
  users,
  userRoles,
} from "./schema/index";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type DbClient = PostgresJsDatabase<typeof schema>;

const RENTAL_WINDOWS_FULL: Record<string, number> = {
  default: 240,
  "9hole": 150,
  "18hole": 240,
  "27hole": 360,
  "36hole": 480,
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

export async function resolveClubIdForInventorySeed(
  db: DbClient,
  options: { clubId?: string; slug?: string }
): Promise<string> {
  const slug = options.slug ?? "pinebrook";
  if (options.clubId?.trim()) {
    const id = options.clubId.trim();
    if (!isUuid(id)) {
      throw new Error(`Invalid club id (expected UUID): ${id}`);
    }
    const row = await db.query.clubs.findFirst({ where: eq(clubs.id, id) });
    if (!row) {
      throw new Error(`No club found with id ${id}`);
    }
    return row.id;
  }
  const row = await db.query.clubs.findFirst({
    where: eq(clubs.slug, slug),
  });
  if (!row) {
    throw new Error(
      `No club with slug "${slug}". Run pnpm seed first or pass --club-id=<uuid>.`
    );
  }
  return row.id;
}

/** Prefer seeded club owner; otherwise any user with a role at this club. */
async function findActorUserId(db: DbClient, clubId: string): Promise<string | null> {
  const owner = await db.query.users.findFirst({
    where: eq(users.email, "owner@testclub.dev"),
  });
  if (owner) {
    const role = await db.query.userRoles.findFirst({
      where: and(
        eq(userRoles.userId, owner.id),
        eq(userRoles.clubId, clubId)
      ),
    });
    if (role) return owner.id;
  }
  const staff = await db.query.userRoles.findFirst({
    where: eq(userRoles.clubId, clubId),
  });
  return staff?.userId ?? null;
}

type ResourceTypeDef = {
  name: string;
  usageModel: "rental" | "consumable" | "service";
  trackingMode: "pool" | "individual" | null;
  assignmentStrategy: "auto" | "manual" | "none";
  totalUnits?: number | null;
  trackInventory?: boolean;
  currentStock?: number | null;
  rentalWindows?: Record<string, number> | null;
  turnaroundBufferMinutes?: number;
  notes?: string | null;
  sortOrder: number;
};

async function ensureResourceType(
  db: DbClient,
  clubId: string,
  def: ResourceTypeDef
): Promise<typeof resourceTypes.$inferSelect> {
  const existing = await db.query.resourceTypes.findFirst({
    where: and(
      eq(resourceTypes.clubId, clubId),
      eq(resourceTypes.name, def.name),
      isNull(resourceTypes.deletedAt)
    ),
  });
  if (existing) return existing;

  const [row] = await db
    .insert(resourceTypes)
    .values({
      clubId,
      name: def.name,
      usageModel: def.usageModel,
      trackingMode: def.trackingMode,
      assignmentStrategy: def.assignmentStrategy,
      totalUnits: def.totalUnits ?? null,
      trackInventory: def.trackInventory ?? true,
      currentStock: def.currentStock ?? null,
      rentalWindows: def.rentalWindows ?? null,
      turnaroundBufferMinutes: def.turnaroundBufferMinutes ?? 0,
      notes: def.notes ?? null,
      sortOrder: def.sortOrder,
      active: true,
    })
    .returning();
  return row!;
}

async function ensureResourceItem(
  db: DbClient,
  clubId: string,
  resourceTypeId: string,
  label: string,
  operationalStatus: "available" | "maintenance",
  sortOrder: number,
  extra?: { maintenanceNote?: string | null }
): Promise<void> {
  const existing = await db.query.resourceItems.findFirst({
    where: and(
      eq(resourceItems.resourceTypeId, resourceTypeId),
      eq(resourceItems.label, label)
    ),
  });
  if (existing) return;

  await db.insert(resourceItems).values({
    clubId,
    resourceTypeId,
    label,
    operationalStatus,
    sortOrder,
    maintenanceNote: extra?.maintenanceNote ?? null,
  });
}

/**
 * Idempotent inventory fixtures: pool + individual rentals, consumables, service,
 * sample restock + pool maintenance holds (when a club staff user exists).
 */
export async function seedInventoryForClub(db: DbClient, clubId: string): Promise<void> {
  const actorUserId = await findActorUserId(db, clubId);

  const pullCarts = await ensureResourceType(db, clubId, {
    name: "Pull carts",
    usageModel: "rental",
    trackingMode: "pool",
    assignmentStrategy: "none",
    totalUnits: 40,
    rentalWindows: RENTAL_WINDOWS_FULL,
    turnaroundBufferMinutes: 5,
    notes: "Shared pull-cart fleet (pool).",
    sortOrder: 10,
  });

  const golfCarts = await ensureResourceType(db, clubId, {
    name: "Golf carts",
    usageModel: "rental",
    trackingMode: "individual",
    assignmentStrategy: "auto",
    rentalWindows: RENTAL_WINDOWS_FULL,
    turnaroundBufferMinutes: 15,
    notes: "Electric carts; auto-assigned when available.",
    sortOrder: 20,
  });

  const clubRentals = await ensureResourceType(db, clubId, {
    name: "Premium club sets",
    usageModel: "rental",
    trackingMode: "individual",
    assignmentStrategy: "manual",
    rentalWindows: RENTAL_WINDOWS_FULL,
    turnaroundBufferMinutes: 30,
    notes: "Manual assignment for premium/demo sets.",
    sortOrder: 30,
  });

  const rangeBalls = await ensureResourceType(db, clubId, {
    name: "Range balls (large bucket)",
    usageModel: "consumable",
    trackingMode: null,
    assignmentStrategy: "none",
    trackInventory: true,
    currentStock: 180,
    notes: "Pro shop stock — large bucket equivalent.",
    sortOrder: 40,
  });

  await ensureResourceType(db, clubId, {
    name: "Bottled water",
    usageModel: "consumable",
    trackingMode: null,
    assignmentStrategy: "none",
    trackInventory: true,
    currentStock: 48,
    notes: "Cooler stock at starter & halfway.",
    sortOrder: 50,
  });

  await ensureResourceType(db, clubId, {
    name: "Club cleaning (next-day)",
    usageModel: "service",
    trackingMode: null,
    assignmentStrategy: "none",
    trackInventory: false,
    currentStock: null,
    notes: "Bag cleaning service; no unit tracking.",
    sortOrder: 60,
  });

  const cartLabels: { label: string; status: "available" | "maintenance"; order: number; note?: string }[] = [
    { label: "Cart 01", status: "available", order: 1 },
    { label: "Cart 02", status: "available", order: 2 },
    { label: "Cart 03", status: "available", order: 3 },
    { label: "Cart 04", status: "maintenance", order: 4, note: "Battery replacement" },
    { label: "Cart 05", status: "available", order: 5 },
    { label: "Cart 06", status: "available", order: 6 },
  ];
  for (const c of cartLabels) {
    await ensureResourceItem(db, clubId, golfCarts.id, c.label, c.status, c.order, {
      maintenanceNote: c.note ?? null,
    });
  }

  const setLabels: { label: string; status: "available" | "maintenance"; order: number }[] = [
    { label: "Titleist set — Left", status: "available", order: 1 },
    { label: "Callaway set — Right", status: "available", order: 2 },
    { label: "Junior set", status: "maintenance", order: 3 },
  ];
  for (const s of setLabels) {
    await ensureResourceItem(db, clubId, clubRentals.id, s.label, s.status, s.order);
  }

  if (actorUserId) {
    const restockExists = await db.query.resourceRestockLog.findFirst({
      where: and(
        eq(resourceRestockLog.resourceTypeId, rangeBalls.id),
        eq(resourceRestockLog.reason, "Seed: demo restock")
      ),
    });
    if (!restockExists) {
      await db.insert(resourceRestockLog).values({
        resourceTypeId: rangeBalls.id,
        deltaQuantity: 60,
        reason: "Seed: demo restock",
        createdBy: actorUserId,
      });
    }

    const holdSeedReason = "Seed: active maintenance hold";
    const existingHold = await db.query.poolMaintenanceHolds.findFirst({
      where: and(
        eq(poolMaintenanceHolds.resourceTypeId, pullCarts.id),
        eq(poolMaintenanceHolds.reason, holdSeedReason)
      ),
    });
    if (!existingHold) {
      await db.insert(poolMaintenanceHolds).values({
        resourceTypeId: pullCarts.id,
        clubId,
        units: 3,
        reason: holdSeedReason,
        createdBy: actorUserId,
      });
    }

    const resolvedReason = "Seed: resolved maintenance hold";
    const existingResolved = await db.query.poolMaintenanceHolds.findFirst({
      where: and(
        eq(poolMaintenanceHolds.resourceTypeId, pullCarts.id),
        eq(poolMaintenanceHolds.reason, resolvedReason)
      ),
    });
    if (!existingResolved) {
      await db.insert(poolMaintenanceHolds).values({
        resourceTypeId: pullCarts.id,
        clubId,
        units: 2,
        reason: resolvedReason,
        createdBy: actorUserId,
        resolvedAt: new Date(),
        resolvedBy: actorUserId,
      });
    }
  }
}

function parseCliArgs(argv: string[]): { clubId?: string; slug?: string } {
  let clubId: string | undefined;
  let slug: string | undefined;
  for (const a of argv) {
    if (a.startsWith("--club-id=")) {
      clubId = a.slice("--club-id=".length).trim();
    } else if (a.startsWith("--slug=")) {
      slug = a.slice("--slug=".length).trim();
    }
  }
  if (process.env.CLUB_ID?.trim()) {
    clubId = process.env.CLUB_ID.trim();
  }
  return { clubId, slug };
}

export async function runSeedInventoryCli(): Promise<void> {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });
  try {
    const { clubId, slug } = parseCliArgs(process.argv.slice(2));
    const resolved = await resolveClubIdForInventorySeed(db, { clubId, slug });
    console.log(`Seeding inventory for club ${resolved}…`);
    await seedInventoryForClub(db, resolved);
    console.log("Inventory seed complete.");
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.includes("seedInventory")) {
  runSeedInventoryCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
