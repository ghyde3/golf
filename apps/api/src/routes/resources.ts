import { Router, type Request } from "express";
import {
  eq,
  and,
  isNull,
  desc,
  asc,
  sql,
  ne,
} from "drizzle-orm";
import {
  db,
  clubs,
  resourceTypes,
  resourceItems,
  poolMaintenanceHolds,
  resourceItemStatusLog,
  resourceRestockLog,
} from "@teetimes/db";
import {
  CreateResourceTypeSchema,
  PatchResourceTypeSchema,
  ResourceTypeCoreFieldsSchema,
  CreateResourceItemSchema,
  PatchResourceItemSchema,
  RestockSchema,
  CreatePoolMaintenanceHoldSchema,
} from "@teetimes/validators";
import { requireClubRole } from "../middleware/auth";

const router = Router({ mergeParams: true });

function paramClubId(req: Request): string | undefined {
  const raw = req.params.clubId;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

async function getResourceTypeForClub(
  clubId: string,
  typeId: string
): Promise<typeof resourceTypes.$inferSelect | null> {
  const row = await db.query.resourceTypes.findFirst({
    where: and(
      eq(resourceTypes.id, typeId),
      eq(resourceTypes.clubId, clubId),
      isNull(resourceTypes.deletedAt)
    ),
  });
  return row ?? null;
}

function isValidOperationalTransition(from: string, to: string): boolean {
  if (from === to) return true;
  if (from === "retired") return false;
  if (to === "retired") return true;
  if (
    (from === "available" && to === "maintenance") ||
    (from === "maintenance" && to === "available")
  ) {
    return true;
  }
  return false;
}

type ItemStatsRow = {
  resourceTypeId: string;
  available: number;
  maintenance: number;
  nonRetired: number;
};

/** Map resourceTypeId → stats for list-types aggregation. */
async function loadItemStatsByType(
  clubId: string
): Promise<Map<string, ItemStatsRow>> {
  const rows = await db
    .select({
      resourceTypeId: resourceItems.resourceTypeId,
      available: sql<number>`
        coalesce(sum(case when ${resourceItems.operationalStatus} = 'available' then 1 else 0 end), 0)::int
      `,
      maintenance: sql<number>`
        coalesce(sum(case when ${resourceItems.operationalStatus} = 'maintenance' then 1 else 0 end), 0)::int
      `,
      nonRetired: sql<number>`
        coalesce(sum(case when ${resourceItems.operationalStatus} != 'retired' then 1 else 0 end), 0)::int
      `,
    })
    .from(resourceItems)
    .where(eq(resourceItems.clubId, clubId))
    .groupBy(resourceItems.resourceTypeId);

  const map = new Map<string, ItemStatsRow>();
  for (const r of rows) {
    map.set(r.resourceTypeId, {
      resourceTypeId: r.resourceTypeId,
      available: r.available,
      maintenance: r.maintenance,
      nonRetired: r.nonRetired,
    });
  }
  return map;
}

async function loadPoolHoldActiveUnitsByType(
  clubId: string
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      resourceTypeId: poolMaintenanceHolds.resourceTypeId,
      activeUnits: sql<number>`
        coalesce(sum(${poolMaintenanceHolds.units}) filter (where ${poolMaintenanceHolds.resolvedAt} is null), 0)::int
      `,
    })
    .from(poolMaintenanceHolds)
    .where(eq(poolMaintenanceHolds.clubId, clubId))
    .groupBy(poolMaintenanceHolds.resourceTypeId);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.resourceTypeId, r.activeUnits);
  }
  return map;
}

function serializeTypeRow(
  t: typeof resourceTypes.$inferSelect
): Record<string, unknown> {
  return {
    id: t.id,
    clubId: t.clubId,
    name: t.name,
    usageModel: t.usageModel,
    trackingMode: t.trackingMode,
    assignmentStrategy: t.assignmentStrategy,
    totalUnits: t.totalUnits,
    trackInventory: t.trackInventory,
    currentStock: t.currentStock,
    rentalWindows: t.rentalWindows,
    turnaroundBufferMinutes: t.turnaroundBufferMinutes,
    notes: t.notes,
    sortOrder: t.sortOrder,
    active: t.active,
    deletedAt: t.deletedAt,
    createdAt: t.createdAt,
  };
}

// TODO: Plan 2 - compute from bookingAddonLines overlap (overlapping reservations at NOW).
const OVERLAPPING_RESERVATIONS_AT_NOW = 0;

/** GET / — list types (exclude soft-deleted). */
router.get(
  "/",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const clubExists = await db.query.clubs.findFirst({
      where: eq(clubs.id, clubId),
      columns: { id: true },
    });
    if (!clubExists) {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    const types = await db.query.resourceTypes.findMany({
      where: and(
        eq(resourceTypes.clubId, clubId),
        isNull(resourceTypes.deletedAt)
      ),
      orderBy: [asc(resourceTypes.sortOrder), asc(resourceTypes.name)],
    });

    const itemStats = await loadItemStatsByType(clubId);
    const poolHoldUnits = await loadPoolHoldActiveUnitsByType(clubId);

    const out = types.map((t) => {
      const items = itemStats.get(t.id);
      const poolMaint = poolHoldUnits.get(t.id) ?? 0;
      const overlapping = OVERLAPPING_RESERVATIONS_AT_NOW;

      let totalUnits: number | null = null;
      let availableNow: number | null = null;
      let inMaintenance = 0;
      let inUseBooked = 0;
      let overAllocated = false;

      if (t.usageModel === "consumable") {
        totalUnits = null;
        if (!t.trackInventory) {
          availableNow = null;
        } else {
          availableNow = t.currentStock ?? 0;
        }
        inMaintenance = 0;
        inUseBooked = 0;
        const usable =
          t.trackInventory && t.currentStock != null ? t.currentStock : 0;
        overAllocated = usable - overlapping < 0;
      } else if (t.usageModel === "service") {
        totalUnits = null;
        availableNow = null;
        inMaintenance = 0;
        inUseBooked = 0;
        overAllocated = false;
      } else if (t.usageModel === "rental" && t.trackingMode === "individual") {
        const nonRetired = items?.nonRetired ?? 0;
        const avail = items?.available ?? 0;
        const maint = items?.maintenance ?? 0;
        totalUnits = nonRetired;
        inMaintenance = maint;
        // TODO: Plan 2 — compute from bookingAddonLines overlap
        inUseBooked = 0;
        availableNow = avail - overlapping;
        const usableUnits = avail;
        overAllocated = usableUnits - overlapping < 0;
      } else if (t.usageModel === "rental" && t.trackingMode === "pool") {
        const capacity = t.totalUnits ?? 0;
        totalUnits = t.totalUnits;
        inMaintenance = poolMaint;
        // TODO: Plan 2 — compute from bookingAddonLines overlap
        inUseBooked = 0;
        const usableUnits = capacity - poolMaint;
        availableNow = usableUnits - overlapping;
        overAllocated = usableUnits - overlapping < 0;
      } else {
        totalUnits = null;
        availableNow = null;
        inMaintenance = 0;
        inUseBooked = 0;
        overAllocated = false;
      }

      return {
        ...serializeTypeRow(t),
        totalUnits,
        availableNow,
        inMaintenance,
        inUseBooked,
        overAllocated,
      };
    });

    res.json(out);
  }
);

/** POST / — create type */
router.post(
  "/",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const parsed = CreateResourceTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const core = ResourceTypeCoreFieldsSchema.safeParse({
      usageModel: parsed.data.usageModel,
      trackingMode: parsed.data.trackingMode,
      assignmentStrategy: parsed.data.assignmentStrategy,
      totalUnits: parsed.data.totalUnits,
      trackInventory: parsed.data.trackInventory,
      currentStock: parsed.data.currentStock,
      rentalWindows: parsed.data.rentalWindows,
    });
    if (!core.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: core.error.flatten() });
      return;
    }

    const [row] = await db
      .insert(resourceTypes)
      .values({
        clubId,
        name: parsed.data.name,
        usageModel: parsed.data.usageModel,
        trackingMode: parsed.data.trackingMode,
        assignmentStrategy: parsed.data.assignmentStrategy,
        totalUnits: parsed.data.totalUnits ?? null,
        trackInventory: parsed.data.trackInventory ?? true,
        currentStock: parsed.data.currentStock ?? null,
        rentalWindows: parsed.data.rentalWindows ?? null,
        turnaroundBufferMinutes: parsed.data.turnaroundBufferMinutes ?? 0,
        notes: parsed.data.notes ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        active: parsed.data.active ?? true,
      })
      .returning();

    res.status(201).json(serializeTypeRow(row));
  }
);

/** PATCH /:typeId */
router.patch(
  "/:typeId",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const existing = await getResourceTypeForClub(clubId, typeId);
    if (!existing) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    const parsed = PatchResourceTypeSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    if (parsed.data.usageModel !== undefined) {
      res.status(400).json({ error: "usageModel cannot be changed after creation" });
      return;
    }
    if (parsed.data.trackingMode !== undefined) {
      res.status(400).json({ error: "trackingMode cannot be changed after creation" });
      return;
    }

    const merged = {
      usageModel: existing.usageModel,
      trackingMode: existing.trackingMode,
      assignmentStrategy:
        parsed.data.assignmentStrategy ?? existing.assignmentStrategy,
      totalUnits:
        parsed.data.totalUnits !== undefined
          ? parsed.data.totalUnits
          : existing.totalUnits,
      trackInventory:
        parsed.data.trackInventory !== undefined
          ? parsed.data.trackInventory
          : existing.trackInventory,
      currentStock:
        parsed.data.currentStock !== undefined
          ? parsed.data.currentStock
          : existing.currentStock,
      rentalWindows:
        parsed.data.rentalWindows !== undefined
          ? parsed.data.rentalWindows
          : existing.rentalWindows,
    };

    const core = ResourceTypeCoreFieldsSchema.safeParse(merged);
    if (!core.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: core.error.flatten() });
      return;
    }

    const [updated] = await db
      .update(resourceTypes)
      .set({
        name: parsed.data.name ?? existing.name,
        assignmentStrategy: merged.assignmentStrategy,
        totalUnits: merged.totalUnits ?? null,
        trackInventory: merged.trackInventory,
        currentStock: merged.currentStock ?? null,
        rentalWindows: merged.rentalWindows ?? null,
        turnaroundBufferMinutes:
          parsed.data.turnaroundBufferMinutes ?? existing.turnaroundBufferMinutes,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
        sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
        active: parsed.data.active !== undefined ? parsed.data.active : existing.active,
      })
      .where(eq(resourceTypes.id, typeId))
      .returning();

    res.json(serializeTypeRow(updated));
  }
);

/** DELETE /:typeId — soft-delete */
router.delete(
  "/:typeId",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const existing = await getResourceTypeForClub(clubId, typeId);
    if (!existing) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    const [nonRetiredRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(resourceItems)
      .where(
        and(
          eq(resourceItems.resourceTypeId, typeId),
          ne(resourceItems.operationalStatus, "retired")
        )
      );

    if ((nonRetiredRow?.c ?? 0) > 0) {
      res.status(409).json({
        error: "Cannot delete: retire all items first",
      });
      return;
    }

    // TODO: Plan 2 — reject if booking_addon_lines has non-cancelled reservations for this type.

    await db
      .update(resourceTypes)
      .set({ deletedAt: new Date() })
      .where(eq(resourceTypes.id, typeId));

    res.json({ success: true });
  }
);

/** GET /:typeId/items */
router.get(
  "/:typeId/items",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    const items = await db.query.resourceItems.findMany({
      where: eq(resourceItems.resourceTypeId, typeId),
      orderBy: [resourceItems.sortOrder, resourceItems.label],
    });

    res.json(
      items.map((it) => ({
        id: it.id,
        resourceTypeId: it.resourceTypeId,
        clubId: it.clubId,
        label: it.label,
        operationalStatus: it.operationalStatus,
        maintenanceNote: it.maintenanceNote,
        lastServicedAt: it.lastServicedAt,
        meta: it.meta,
        sortOrder: it.sortOrder,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
      }))
    );
  }
);

/** POST /:typeId/items */
router.post(
  "/:typeId/items",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    if (rt.trackingMode !== "individual") {
      res.status(400).json({
        error: "Resource items are only supported for individual tracking mode",
      });
      return;
    }

    const parsed = CreateResourceItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [row] = await db
      .insert(resourceItems)
      .values({
        resourceTypeId: typeId,
        clubId,
        label: parsed.data.label,
        operationalStatus: parsed.data.operationalStatus,
        maintenanceNote: parsed.data.maintenanceNote ?? null,
        meta: parsed.data.meta ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      resourceTypeId: row.resourceTypeId,
      clubId: row.clubId,
      label: row.label,
      operationalStatus: row.operationalStatus,
      maintenanceNote: row.maintenanceNote,
      lastServicedAt: row.lastServicedAt,
      meta: row.meta,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
);

/** PATCH /:typeId/items/:itemId */
router.patch(
  "/:typeId/items/:itemId",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    const itemId = String(req.params.itemId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    if (rt.trackingMode !== "individual") {
      res.status(400).json({
        error: "Resource items are only supported for individual tracking mode",
      });
      return;
    }

    const item = await db.query.resourceItems.findFirst({
      where: and(
        eq(resourceItems.id, itemId),
        eq(resourceItems.resourceTypeId, typeId),
        eq(resourceItems.clubId, clubId)
      ),
    });

    if (!item) {
      res.status(404).json({ error: "Resource item not found" });
      return;
    }

    const parsed = PatchResourceItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const nextStatus =
      parsed.data.operationalStatus ?? item.operationalStatus;
    if (!isValidOperationalTransition(item.operationalStatus, nextStatus)) {
      res.status(400).json({
        error: "Invalid operational status transition",
      });
      return;
    }

    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const setPatch: Partial<typeof resourceItems.$inferInsert> = {};
    if (parsed.data.label !== undefined) setPatch.label = parsed.data.label;
    if (parsed.data.operationalStatus !== undefined) {
      setPatch.operationalStatus = parsed.data.operationalStatus;
    }
    if (parsed.data.maintenanceNote !== undefined) {
      setPatch.maintenanceNote = parsed.data.maintenanceNote;
    }
    if (parsed.data.lastServicedAt !== undefined) {
      setPatch.lastServicedAt = parsed.data.lastServicedAt
        ? new Date(parsed.data.lastServicedAt)
        : null;
    }
    if (parsed.data.meta !== undefined) setPatch.meta = parsed.data.meta;
    if (parsed.data.sortOrder !== undefined) {
      setPatch.sortOrder = parsed.data.sortOrder;
    }

    const statusChanged =
      parsed.data.operationalStatus !== undefined &&
      parsed.data.operationalStatus !== item.operationalStatus;

    if (statusChanged) {
      await db.transaction(async (tx) => {
        await tx
          .update(resourceItems)
          .set(setPatch)
          .where(eq(resourceItems.id, itemId));
        await tx.insert(resourceItemStatusLog).values({
          resourceItemId: itemId,
          fromStatus: item.operationalStatus,
          toStatus: parsed.data.operationalStatus!,
          reason: parsed.data.reason ?? null,
          changedBy: userId,
        });
      });
    } else {
      await db.update(resourceItems).set(setPatch).where(eq(resourceItems.id, itemId));
    }

    const updated = await db.query.resourceItems.findFirst({
      where: eq(resourceItems.id, itemId),
    });

    res.json({
      id: updated!.id,
      resourceTypeId: updated!.resourceTypeId,
      clubId: updated!.clubId,
      label: updated!.label,
      operationalStatus: updated!.operationalStatus,
      maintenanceNote: updated!.maintenanceNote,
      lastServicedAt: updated!.lastServicedAt,
      meta: updated!.meta,
      sortOrder: updated!.sortOrder,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
    });
  }
);

/** GET /:typeId/items/:itemId/log */
router.get(
  "/:typeId/items/:itemId/log",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    const itemId = String(req.params.itemId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    const item = await db.query.resourceItems.findFirst({
      where: and(
        eq(resourceItems.id, itemId),
        eq(resourceItems.resourceTypeId, typeId),
        eq(resourceItems.clubId, clubId)
      ),
    });

    if (!item) {
      res.status(404).json({ error: "Resource item not found" });
      return;
    }

    const logs = await db.query.resourceItemStatusLog.findMany({
      where: eq(resourceItemStatusLog.resourceItemId, itemId),
      orderBy: [desc(resourceItemStatusLog.changedAt)],
    });

    res.json(
      logs.map((l) => ({
        id: l.id,
        resourceItemId: l.resourceItemId,
        fromStatus: l.fromStatus,
        toStatus: l.toStatus,
        reason: l.reason,
        changedBy: l.changedBy,
        changedAt: l.changedAt,
      }))
    );
  }
);

/** POST /:typeId/restock */
router.post(
  "/:typeId/restock",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    if (rt.usageModel !== "consumable" || !rt.trackInventory) {
      res.status(400).json({
        error: "Restock is only for consumable types with inventory tracking enabled",
      });
      return;
    }

    const parsed = RestockSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const delta = parsed.data.deltaQuantity;
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [logRow] = await tx
          .insert(resourceRestockLog)
          .values({
            resourceTypeId: typeId,
            deltaQuantity: delta,
            reason: parsed.data.reason ?? null,
            createdBy: userId,
          })
          .returning();

        const [updated] = await tx
          .update(resourceTypes)
          .set({
            currentStock: sql`${resourceTypes.currentStock} + ${delta}`,
          })
          .where(
            and(
              eq(resourceTypes.id, typeId),
              sql`(${resourceTypes.currentStock} + ${delta}) >= 0`
            )
          )
          .returning();

        if (!updated) {
          throw new Error("STOCK_NEGATIVE");
        }

        return { logRow, updated };
      });

      res.status(201).json({
        id: result.logRow.id,
        resourceTypeId: result.logRow.resourceTypeId,
        deltaQuantity: result.logRow.deltaQuantity,
        reason: result.logRow.reason,
        createdBy: result.logRow.createdBy,
        createdAt: result.logRow.createdAt,
        currentStock: result.updated.currentStock,
      });
    } catch (e) {
      if ((e as Error).message === "STOCK_NEGATIVE") {
        res.status(409).json({ error: "Stock would go negative" });
        return;
      }
      throw e;
    }
  }
);

/** GET /:typeId/maintenance-holds */
router.get(
  "/:typeId/maintenance-holds",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    const rows = await db.query.poolMaintenanceHolds.findMany({
      where: and(
        eq(poolMaintenanceHolds.resourceTypeId, typeId),
        eq(poolMaintenanceHolds.clubId, clubId)
      ),
      orderBy: [desc(poolMaintenanceHolds.startedAt)],
    });

    res.json(
      rows.map((h) => ({
        id: h.id,
        resourceTypeId: h.resourceTypeId,
        clubId: h.clubId,
        units: h.units,
        reason: h.reason,
        startedAt: h.startedAt,
        resolvedAt: h.resolvedAt,
        createdBy: h.createdBy,
        resolvedBy: h.resolvedBy,
      }))
    );
  }
);

/** POST /:typeId/maintenance-holds */
router.post(
  "/:typeId/maintenance-holds",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const rt = await getResourceTypeForClub(clubId, typeId);
    if (!rt) {
      res.status(404).json({ error: "Resource type not found" });
      return;
    }

    if (rt.trackingMode !== "pool") {
      res.status(400).json({
        error: "Pool maintenance holds are only for pool tracking mode",
      });
      return;
    }

    const parsed = CreatePoolMaintenanceHoldSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [row] = await db
      .insert(poolMaintenanceHolds)
      .values({
        resourceTypeId: typeId,
        clubId,
        units: parsed.data.units,
        reason: parsed.data.reason ?? null,
        createdBy: userId,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      resourceTypeId: row.resourceTypeId,
      clubId: row.clubId,
      units: row.units,
      reason: row.reason,
      startedAt: row.startedAt,
      resolvedAt: row.resolvedAt,
      createdBy: row.createdBy,
      resolvedBy: row.resolvedBy,
    });
  }
);

/** PATCH /:typeId/maintenance-holds/:holdId/resolve */
router.patch(
  "/:typeId/maintenance-holds/:holdId/resolve",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = paramClubId(req);
    const typeId = String(req.params.typeId);
    const holdId = String(req.params.holdId);
    if (!clubId) {
      res.status(400).json({ error: "clubId required" });
      return;
    }

    const hold = await db.query.poolMaintenanceHolds.findFirst({
      where: and(
        eq(poolMaintenanceHolds.id, holdId),
        eq(poolMaintenanceHolds.resourceTypeId, typeId),
        eq(poolMaintenanceHolds.clubId, clubId)
      ),
    });

    if (!hold) {
      res.status(404).json({ error: "Maintenance hold not found" });
      return;
    }

    if (hold.resolvedAt != null) {
      res.status(400).json({ error: "Hold is already resolved" });
      return;
    }

    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [updated] = await db
      .update(poolMaintenanceHolds)
      .set({
        resolvedAt: new Date(),
        resolvedBy: userId,
      })
      .where(eq(poolMaintenanceHolds.id, holdId))
      .returning();

    res.json({
      id: updated!.id,
      resourceTypeId: updated!.resourceTypeId,
      clubId: updated!.clubId,
      units: updated!.units,
      reason: updated!.reason,
      startedAt: updated!.startedAt,
      resolvedAt: updated!.resolvedAt,
      createdBy: updated!.createdBy,
      resolvedBy: updated!.resolvedBy,
    });
  }
);

export default router;
