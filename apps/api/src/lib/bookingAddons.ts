import { eq, and, sql, isNull, asc, ne } from "drizzle-orm";
import type { DrizzleDB } from "@teetimes/db";
import {
  addonCatalog,
  bookingAddonLines,
  bookingResourceAssignments,
  resourceTypes,
  resourceItems,
  poolMaintenanceHolds,
  bookings,
} from "@teetimes/db";
import type { AddonLineInput } from "@teetimes/validators";

export class AddOnUnavailableError extends Error {
  code = "ADDON_UNAVAILABLE" as const;
  constructor(
    public addonCatalogId: string,
    public addonName: string
  ) {
    super("ADDON_UNAVAILABLE");
    this.name = "AddOnUnavailableError";
  }
}

type DbTx = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

/** postgres.js binds string params only; Date breaks Buffer.byteLength in the wire encoder. */
function tsParam(d: Date): string {
  return d.toISOString();
}

export type TeeSlotLike = {
  id: string;
  datetime: Date;
  slotType: string | null;
};

function resolvedRentalWindowMinutes(
  rentalWindows: unknown,
  slotType: string | null
): number {
  const rw = rentalWindows as Record<string, number> | null | undefined;
  if (!rw || typeof rw !== "object") return 240;
  const st = slotType && rw[slotType] != null ? slotType : "default";
  const v = rw[st] ?? rw["default"];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 240;
}

async function sumOverlappingReservations(
  tx: DbTx,
  resourceTypeId: string,
  newStart: Date,
  newEnd: Date,
  excludeBookingId?: string
): Promise<number> {
  const filters = [
    eq(bookingAddonLines.resourceTypeId, resourceTypeId),
    ne(bookingAddonLines.status, "cancelled"),
    sql`${bookingAddonLines.bookingStart} < ${tsParam(newEnd)}`,
    sql`${bookingAddonLines.bookingEnd} > ${tsParam(newStart)}`,
    isNull(bookings.deletedAt),
  ];
  if (excludeBookingId) {
    filters.push(ne(bookings.id, excludeBookingId));
  }

  const rows = await tx
    .select({
      sum: sql<number>`coalesce(sum(${bookingAddonLines.quantity} * ${addonCatalog.unitsConsumed}), 0)`,
    })
    .from(bookingAddonLines)
    .innerJoin(bookings, eq(bookingAddonLines.bookingId, bookings.id))
    .innerJoin(addonCatalog, eq(bookingAddonLines.addonCatalogId, addonCatalog.id))
    .where(and(...filters));

  return Number(rows[0]?.sum ?? 0);
}

async function poolMaintenanceUnits(
  tx: DbTx,
  resourceTypeId: string
): Promise<number> {
  const [row] = await tx
    .select({
      u: sql<number>`coalesce(sum(${poolMaintenanceHolds.units}), 0)::int`,
    })
    .from(poolMaintenanceHolds)
    .where(
      and(
        eq(poolMaintenanceHolds.resourceTypeId, resourceTypeId),
        isNull(poolMaintenanceHolds.resolvedAt)
      )
    );
  return Number(row?.u ?? 0);
}

async function countUsableIndividualItems(
  tx: DbTx,
  resourceTypeId: string
): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(resourceItems)
    .where(
      and(
        eq(resourceItems.resourceTypeId, resourceTypeId),
        eq(resourceItems.operationalStatus, "available")
      )
    );
  return Number(row?.n ?? 0);
}

/** Lock resource type row for the transaction (Postgres FOR UPDATE). */
async function lockResourceType(tx: DbTx, resourceTypeId: string) {
  await tx.execute(
    sql`SELECT id FROM resource_types WHERE id = ${resourceTypeId}::uuid FOR UPDATE`
  );
}

export async function restoreAddonResourcesForBooking(
  tx: DbTx,
  bookingId: string
): Promise<void> {
  const lines = await tx
    .select({
      id: bookingAddonLines.id,
      quantity: bookingAddonLines.quantity,
      catalogId: bookingAddonLines.addonCatalogId,
      resourceTypeId: bookingAddonLines.resourceTypeId,
    })
    .from(bookingAddonLines)
    .innerJoin(addonCatalog, eq(bookingAddonLines.addonCatalogId, addonCatalog.id))
    .where(eq(bookingAddonLines.bookingId, bookingId));

  for (const line of lines) {
    if (!line.resourceTypeId) continue;
    const [rt] = await tx
      .select()
      .from(resourceTypes)
      .where(eq(resourceTypes.id, line.resourceTypeId));
    if (!rt) continue;
    if (rt.usageModel === "consumable" && rt.trackInventory) {
      const [cat] = await tx
        .select({ unitsConsumed: addonCatalog.unitsConsumed })
        .from(addonCatalog)
        .where(eq(addonCatalog.id, line.catalogId));
      const units = line.quantity * (cat?.unitsConsumed ?? 1);
      await tx
        .update(resourceTypes)
        .set({
          currentStock: sql`${resourceTypes.currentStock} + ${units}`,
        })
        .where(eq(resourceTypes.id, line.resourceTypeId));
    }
  }

  await tx.delete(bookingAddonLines).where(eq(bookingAddonLines.bookingId, bookingId));
}

/**
 * Process add-ons after booking row exists. Call inside the same transaction.
 * @returns total add-on charge in cents for Stripe / display
 */
export async function checkAndInsertAddons(
  tx: DbTx,
  params: {
    clubId: string;
    bookingId: string;
    teeSlot: TeeSlotLike;
    addOns: AddonLineInput[] | undefined;
  }
): Promise<{ addonTotalCents: number }> {
  const { clubId, bookingId, teeSlot, addOns } = params;
  if (!addOns?.length) {
    return { addonTotalCents: 0 };
  }

  const merged = new Map<string, number>();
  for (const a of addOns) {
    merged.set(a.addonCatalogId, (merged.get(a.addonCatalogId) ?? 0) + a.quantity);
  }

  let addonTotalCents = 0;

  for (const [catalogId, quantity] of merged) {
    const [catalogRow] = await tx
      .select()
      .from(addonCatalog)
      .where(and(eq(addonCatalog.id, catalogId), eq(addonCatalog.clubId, clubId)));

    if (!catalogRow || !catalogRow.active) {
      throw new AddOnUnavailableError(catalogId, catalogRow?.name ?? "Add-on");
    }

    const lineTotalCents = catalogRow.priceCents * quantity;
    addonTotalCents += lineTotalCents;

    const resourceTypeId = catalogRow.resourceTypeId;

    if (!resourceTypeId) {
      await tx.insert(bookingAddonLines).values({
        bookingId,
        addonCatalogId: catalogId,
        resourceTypeId: null,
        quantity,
        unitPriceCents: catalogRow.priceCents,
        bookingStart: null,
        bookingEnd: null,
        status: "confirmed",
      });
      continue;
    }

    const [rt] = await tx
      .select()
      .from(resourceTypes)
      .where(
        and(
          eq(resourceTypes.id, resourceTypeId),
          eq(resourceTypes.clubId, clubId),
          isNull(resourceTypes.deletedAt)
        )
      );

    if (!rt) {
      throw new AddOnUnavailableError(catalogId, catalogRow.name);
    }

    const unitsNeeded = quantity * catalogRow.unitsConsumed;

    if (rt.usageModel === "consumable" || rt.usageModel === "service") {
      if (!rt.trackInventory) {
        await tx.insert(bookingAddonLines).values({
          bookingId,
          addonCatalogId: catalogId,
          resourceTypeId,
          quantity,
          unitPriceCents: catalogRow.priceCents,
          bookingStart: null,
          bookingEnd: null,
          status: "confirmed",
        });
        continue;
      }

      const updated = await tx
        .update(resourceTypes)
        .set({
          currentStock: sql`${resourceTypes.currentStock} - ${unitsNeeded}`,
        })
        .where(
          and(
            eq(resourceTypes.id, resourceTypeId),
            sql`${resourceTypes.currentStock} >= ${unitsNeeded}`
          )
        )
        .returning({ id: resourceTypes.id });

      if (!updated.length) {
        throw new AddOnUnavailableError(catalogId, catalogRow.name);
      }

      await tx.insert(bookingAddonLines).values({
        bookingId,
        addonCatalogId: catalogId,
        resourceTypeId,
        quantity,
        unitPriceCents: catalogRow.priceCents,
        bookingStart: null,
        bookingEnd: null,
        status: "confirmed",
      });
      continue;
    }

    if (rt.usageModel !== "rental") {
      throw new AddOnUnavailableError(catalogId, catalogRow.name);
    }

    await lockResourceType(tx, resourceTypeId);

    const bookingStart = teeSlot.datetime;
    const windowMin = resolvedRentalWindowMinutes(
      rt.rentalWindows,
      teeSlot.slotType
    );
    const turnaround = rt.turnaroundBufferMinutes ?? 0;
    const bookingEnd = new Date(
      bookingStart.getTime() + (windowMin + turnaround) * 60 * 1000
    );

    const overlapping = await sumOverlappingReservations(
      tx,
      resourceTypeId,
      bookingStart,
      bookingEnd
    );

    if (rt.trackingMode === "pool") {
      const maint = await poolMaintenanceUnits(tx, resourceTypeId);
      const totalUnits = rt.totalUnits ?? 0;
      const usable = totalUnits - maint;
      if (usable - overlapping < unitsNeeded) {
        throw new AddOnUnavailableError(catalogId, catalogRow.name);
      }

      const [line] = await tx
        .insert(bookingAddonLines)
        .values({
          bookingId,
          addonCatalogId: catalogId,
          resourceTypeId,
          quantity,
          unitPriceCents: catalogRow.priceCents,
          bookingStart,
          bookingEnd,
          status: "confirmed",
        })
        .returning();

      if (rt.assignmentStrategy === "auto" && line) {
        await insertAutoAssignmentsForLine(
          tx,
          line.id,
          resourceTypeId,
          unitsNeeded,
          bookingStart,
          bookingEnd,
          catalogId,
          catalogRow.name
        );
      }
      continue;
    }

    if (rt.trackingMode === "individual") {
      const usableItems = await countUsableIndividualItems(tx, resourceTypeId);
      if (usableItems - overlapping < unitsNeeded) {
        throw new AddOnUnavailableError(catalogId, catalogRow.name);
      }

      const [line] = await tx
        .insert(bookingAddonLines)
        .values({
          bookingId,
          addonCatalogId: catalogId,
          resourceTypeId,
          quantity,
          unitPriceCents: catalogRow.priceCents,
          bookingStart,
          bookingEnd,
          status: "confirmed",
        })
        .returning();

      if (rt.assignmentStrategy === "auto" && line) {
        await insertAutoAssignmentsForLine(
          tx,
          line.id,
          resourceTypeId,
          unitsNeeded,
          bookingStart,
          bookingEnd,
          catalogId,
          catalogRow.name
        );
      }
      continue;
    }

    throw new AddOnUnavailableError(catalogId, catalogRow.name);
  }

  return { addonTotalCents };
}

async function insertAutoAssignmentsForLine(
  tx: DbTx,
  bookingAddonLineId: string,
  resourceTypeId: string,
  unitsNeeded: number,
  bookingStart: Date,
  bookingEnd: Date,
  addonCatalogId: string,
  addonName: string
) {
  const busyItemIds = await tx
    .selectDistinct({ itemId: bookingResourceAssignments.resourceItemId })
    .from(bookingResourceAssignments)
    .innerJoin(
      bookingAddonLines,
      eq(
        bookingResourceAssignments.bookingAddonLineId,
        bookingAddonLines.id
      )
    )
    .where(
      and(
        eq(bookingAddonLines.resourceTypeId, resourceTypeId),
        ne(bookingAddonLines.status, "cancelled"),
        isNull(bookingResourceAssignments.supersededAt),
        sql`${bookingAddonLines.bookingStart} < ${tsParam(bookingEnd)}`,
        sql`${bookingAddonLines.bookingEnd} > ${tsParam(bookingStart)}`
      )
    );

  const busy = new Set(busyItemIds.map((r) => r.itemId));

  const candidates = await tx
    .select({ id: resourceItems.id })
    .from(resourceItems)
    .where(
      and(
        eq(resourceItems.resourceTypeId, resourceTypeId),
        eq(resourceItems.operationalStatus, "available")
      )
    )
    .orderBy(asc(resourceItems.sortOrder), asc(resourceItems.id));

  const picked: string[] = [];
  for (const c of candidates) {
    if (picked.length >= unitsNeeded) break;
    if (!busy.has(c.id)) {
      picked.push(c.id);
      busy.add(c.id);
    }
  }

  if (picked.length < unitsNeeded) {
    throw new AddOnUnavailableError(addonCatalogId, addonName);
  }

  for (const resourceItemId of picked) {
    await tx.insert(bookingResourceAssignments).values({
      bookingAddonLineId,
      resourceItemId,
    });
  }
}

export async function recomputeBookingAddonsAfterMove(
  tx: DbTx,
  params: {
    clubId: string;
    bookingId: string;
    newTeeSlot: TeeSlotLike;
    previousAddOnInputs: AddonLineInput[];
  }
): Promise<void> {
  await restoreAddonResourcesForBooking(tx, params.bookingId);
  await checkAndInsertAddons(tx, {
    clubId: params.clubId,
    bookingId: params.bookingId,
    teeSlot: params.newTeeSlot,
    addOns:
      params.previousAddOnInputs.length > 0
        ? params.previousAddOnInputs
        : undefined,
  });
}
