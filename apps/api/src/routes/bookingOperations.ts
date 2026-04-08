import { Router } from "express";
import { eq, and, isNull, desc, sql, gte, asc, inArray } from "drizzle-orm";
import {
  db,
  bookings,
  bookingPlayers,
  teeSlots,
  courses,
  clubConfig,
  waitlistEntries,
  addonCatalog,
  bookingAddonLines,
  bookingResourceAssignments,
  resourceItems,
  resourceTypes,
} from "@teetimes/db";
import { CreateBookingSchema } from "@teetimes/validators";
import { authenticate } from "../middleware/auth";
import {
  getAuthPayload,
  canAccessClub,
  sendUnauthorized,
  sendForbidden,
} from "../lib/auth";
import { generateUniqueBookingRef } from "../lib/bookingRef";
import { invalidateAvailabilityCache } from "../lib/availabilityCache";
import { enqueueEmail } from "../lib/queue";
import {
  signGuestCancelToken,
  verifyGuestCancelToken,
} from "../lib/jwt";
import { isCancellable } from "../lib/cancellation";
import { resolveConfig } from "../lib/configResolver";
import { publicRateLimit } from "../middleware/rateLimit";
import {
  checkAndInsertAddons,
  AddOnUnavailableError,
  restoreAddonResourcesForBooking,
  recomputeBookingAddonsAfterMove,
} from "../lib/bookingAddons";
import type { AddonLineInput } from "@teetimes/validators";

const router = Router();

function effFrom(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

router.get(
  "/:bookingId/cancel-token",
  publicRateLimit,
  async (req, res) => {
    const bookingId = String(req.params.bookingId);
    const email = req.query.email;
    if (typeof email !== "string" || !email.trim()) {
      res.status(400).json({ error: "email query required" });
      return;
    }

    const booking = await db.query.bookings.findFirst({
      where: and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)),
    });

    if (
      !booking?.guestEmail ||
      booking.guestEmail.toLowerCase() !== email.toLowerCase().trim()
    ) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const token = signGuestCancelToken(bookingId);
    res.json({ token });
  }
);

router.get("/:bookingId", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    sendUnauthorized(res);
    return;
  }

  const bookingId = String(req.params.bookingId);
  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)),
    with: {
      players: true,
      teeSlot: { with: { course: { with: { club: true } } } },
    },
  });

  if (!booking?.teeSlot?.course?.club) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const clubId = booking.teeSlot.course.club.id;
  if (!canAccessClub(auth.roles, clubId)) {
    sendForbidden(res);
    return;
  }

  const addonRows = await db
    .select({
      id: bookingAddonLines.id,
      addonCatalogId: bookingAddonLines.addonCatalogId,
      catalogName: addonCatalog.name,
      catalogUnitsConsumed: addonCatalog.unitsConsumed,
      quantity: bookingAddonLines.quantity,
      unitPriceCents: bookingAddonLines.unitPriceCents,
      bookingStart: bookingAddonLines.bookingStart,
      bookingEnd: bookingAddonLines.bookingEnd,
      status: bookingAddonLines.status,
      resourceTypeId: bookingAddonLines.resourceTypeId,
      assignmentStrategy: resourceTypes.assignmentStrategy,
      trackingMode: resourceTypes.trackingMode,
    })
    .from(bookingAddonLines)
    .innerJoin(addonCatalog, eq(bookingAddonLines.addonCatalogId, addonCatalog.id))
    .leftJoin(resourceTypes, eq(bookingAddonLines.resourceTypeId, resourceTypes.id))
    .where(eq(bookingAddonLines.bookingId, bookingId));

  const lineIds = addonRows.map((a) => a.id);
  const assignmentsByLine = new Map<
    string,
    {
      id: string;
      resourceItemId: string;
      label: string;
      supersededAt: Date | null;
    }[]
  >();
  if (lineIds.length > 0) {
    const assigns = await db
      .select({
        id: bookingResourceAssignments.id,
        lineId: bookingResourceAssignments.bookingAddonLineId,
        resourceItemId: bookingResourceAssignments.resourceItemId,
        label: resourceItems.label,
        supersededAt: bookingResourceAssignments.supersededAt,
      })
      .from(bookingResourceAssignments)
      .innerJoin(
        resourceItems,
        eq(bookingResourceAssignments.resourceItemId, resourceItems.id)
      )
      .where(
        and(
          inArray(bookingResourceAssignments.bookingAddonLineId, lineIds),
          eq(resourceItems.clubId, clubId),
          isNull(bookingResourceAssignments.supersededAt)
        )
      );

    for (const a of assigns) {
      const list = assignmentsByLine.get(a.lineId) ?? [];
      list.push({
        id: a.id,
        resourceItemId: a.resourceItemId,
        label: a.label,
        supersededAt: a.supersededAt,
      });
      assignmentsByLine.set(a.lineId, list);
    }
  }

  const addons = addonRows.map((a) => ({
    id: a.id,
    addonCatalogId: a.addonCatalogId,
    name: a.catalogName,
    quantity: a.quantity,
    unitPriceCents: a.unitPriceCents,
    catalogUnitsConsumed: a.catalogUnitsConsumed,
    bookingStart: a.bookingStart?.toISOString() ?? null,
    bookingEnd: a.bookingEnd?.toISOString() ?? null,
    status: a.status,
    resourceTypeId: a.resourceTypeId,
    assignmentStrategy: a.assignmentStrategy ?? "none",
    trackingMode: a.trackingMode,
    assignments: assignmentsByLine.get(a.id) ?? [],
  }));

  res.json({
    id: booking.id,
    bookingRef: booking.bookingRef,
    source: booking.source,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    playersCount: booking.playersCount,
    notes: booking.notes,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    createdAt: booking.createdAt,
    teeSlot: {
      id: booking.teeSlot.id,
      datetime: booking.teeSlot.datetime.toISOString(),
      price: booking.teeSlot.price ? Number(booking.teeSlot.price) : null,
      courseId: booking.teeSlot.courseId,
      courseName: booking.teeSlot.course.name,
      clubId: booking.teeSlot.course.club.id,
    },
    players: booking.players.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      checkedIn: p.checkedIn,
      noShow: p.noShow,
    })),
    addons,
  });
});

router.patch("/:bookingId", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    sendUnauthorized(res);
    return;
  }

  const bookingId = String(req.params.bookingId);
  const body = req.body as {
    teeSlotId?: unknown;
    courseId?: unknown;
    datetime?: unknown;
    playersCount?: unknown;
  };

  const hasTeeSlotId =
    typeof body.teeSlotId === "string" && body.teeSlotId.trim().length > 0;
  const hasCourseDatetime =
    typeof body.courseId === "string" &&
    body.courseId.trim().length > 0 &&
    typeof body.datetime === "string" &&
    body.datetime.trim().length > 0;
  const hasPlayersCount = typeof body.playersCount === "number";

  if (!hasTeeSlotId && !hasCourseDatetime && !hasPlayersCount) {
    res.status(400).json({
      error: "Provide teeSlotId, courseId+datetime, or playersCount",
    });
    return;
  }

  if (hasTeeSlotId && hasCourseDatetime) {
    res.status(400).json({
      error: "Provide either teeSlotId or courseId+datetime, not both",
    });
    return;
  }

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)),
    with: {
      teeSlot: { with: { course: { with: { club: true } } } },
    },
  });

  if (!booking?.teeSlot?.course?.club) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const isOwner = booking.userId === auth.userId;
  const isStaff = canAccessClub(auth.roles, booking.teeSlot.course.club.id);

  if (!isOwner && !isStaff) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Golfer-owners must be within the cancellation window
  if (isOwner && !isStaff) {
    const cfgRows = await db.query.clubConfig.findMany({
      where: eq(clubConfig.clubId, booking.teeSlot.course.club.id),
      orderBy: [desc(clubConfig.effectiveFrom)],
    });
    const mapped = cfgRows.map((c) => ({
      ...c,
      effectiveFrom: effFrom(c.effectiveFrom),
    }));
    const cfg = resolveConfig(mapped, new Date(booking.teeSlot.datetime));
    const hours = cfg?.cancellationHours ?? 24;
    if (!isCancellable(booking.teeSlot.datetime, hours)) {
      res.status(403).json({
        error: "Outside cancellation window",
        code: "OUTSIDE_WINDOW",
      });
      return;
    }
  }

  const applyPlayersCountMutation = async (
    b: NonNullable<typeof booking>,
    newCount: number
  ): Promise<{ ok: true } | { error: "slot_full" }> => {
    if (!b.teeSlot) {
      return { ok: true };
    }
    if (newCount === b.playersCount) {
      return { ok: true };
    }
    const maxPlayers = b.teeSlot.maxPlayers ?? 4;
    const currentOthers =
      (b.teeSlot.bookedPlayers ?? 0) - b.playersCount;
    if (currentOthers + newCount > maxPlayers) {
      return { error: "slot_full" };
    }
    const delta = newCount - b.playersCount;
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set({ playersCount: newCount })
          .where(eq(bookings.id, bookingId));
        const [row] = await tx
          .update(teeSlots)
          .set({
            bookedPlayers: sql`${teeSlots.bookedPlayers} + ${delta}`,
          })
          .where(
            and(
              eq(teeSlots.id, b.teeSlotId!),
              sql`${teeSlots.bookedPlayers} + ${delta} <= ${teeSlots.maxPlayers}`,
              sql`${teeSlots.bookedPlayers} + ${delta} >= 0`
            )
          )
          .returning();
        if (!row) {
          throw new Error("PLAYERS_COUNT_CAPACITY");
        }
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "PLAYERS_COUNT_CAPACITY") {
        return { error: "slot_full" };
      }
      throw e;
    }
    const dateStr = b.teeSlot.datetime.toISOString().split("T")[0];
    await invalidateAvailabilityCache(
      b.teeSlot.course.club.id,
      b.teeSlot.courseId,
      dateStr
    );
    return { ok: true };
  };

  const wantsMove = hasTeeSlotId || hasCourseDatetime;

  if (!wantsMove) {
    if (
      typeof body.playersCount === "number" &&
      body.playersCount !== booking.playersCount
    ) {
      const result = await applyPlayersCountMutation(
        booking,
        body.playersCount
      );
      if ("error" in result) {
        res.status(409).json({
          error: "Not enough capacity for this player count",
          code: "SLOT_FULL",
        });
        return;
      }
    }
    res.json({
      ok: true,
      bookingId,
      playersCount:
        typeof body.playersCount === "number"
          ? body.playersCount
          : booking.playersCount,
    });
    return;
  }

  const clubId = booking.teeSlot.course.club.id;
  const oldSlot = booking.teeSlot;
  const pc = booking.playersCount;
  const oldSlotId = oldSlot.id;

  if (hasCourseDatetime) {
    const cid = String(body.courseId).trim();
    const courseRow = await db.query.courses.findFirst({
      where: eq(courses.id, cid),
    });
    if (!courseRow || courseRow.clubId !== clubId) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    const dt = new Date(String(body.datetime));
    if (Number.isNaN(dt.getTime())) {
      res.status(400).json({ error: "Invalid datetime" });
      return;
    }
    const atTarget = await db.query.teeSlots.findFirst({
      where: and(eq(teeSlots.courseId, cid), eq(teeSlots.datetime, dt)),
    });
    if (atTarget && atTarget.id === oldSlotId) {
      if (
        typeof body.playersCount === "number" &&
        body.playersCount !== booking.playersCount
      ) {
        const result = await applyPlayersCountMutation(
          booking,
          body.playersCount
        );
        if ("error" in result) {
          res.status(409).json({
            error: "Not enough capacity for this player count",
            code: "SLOT_FULL",
          });
          return;
        }
      }
      res.json({
        ok: true,
        bookingId,
        teeSlotId: atTarget.id,
        playersCount:
          typeof body.playersCount === "number"
            ? body.playersCount
            : booking.playersCount,
      });
      return;
    }
  }

  if (hasTeeSlotId) {
    const tid = String(body.teeSlotId).trim();
    if (tid === oldSlotId) {
      if (
        typeof body.playersCount === "number" &&
        body.playersCount !== booking.playersCount
      ) {
        const result = await applyPlayersCountMutation(
          booking,
          body.playersCount
        );
        if ("error" in result) {
          res.status(409).json({
            error: "Not enough capacity for this player count",
            code: "SLOT_FULL",
          });
          return;
        }
      }
      res.json({
        ok: true,
        bookingId,
        teeSlotId: tid,
        playersCount:
          typeof body.playersCount === "number"
            ? body.playersCount
            : booking.playersCount,
      });
      return;
    }
    const newSlotPre = await db.query.teeSlots.findFirst({
      where: eq(teeSlots.id, tid),
      with: { course: { with: { club: true } } },
    });
    if (!newSlotPre?.course?.club) {
      res.status(404).json({ error: "Target slot not found" });
      return;
    }
    if (newSlotPre.course.club.id !== clubId) {
      res.status(403).json({ error: "Cannot move booking to another club" });
      return;
    }
    if (newSlotPre.status !== "open") {
      res.status(409).json({
        code: "SLOT_NOT_OPEN",
        error: "Target slot is not open",
      });
      return;
    }
    const maxP = newSlotPre.maxPlayers ?? 4;
    const bookedOnTarget = newSlotPre.bookedPlayers ?? 0;
    if (bookedOnTarget + pc > maxP) {
      res.status(409).json({
        code: "SLOT_FULL",
        error: "Target slot does not have capacity",
      });
      return;
    }
  }

  let finalTargetId = "";

  const addonLineRows = await db
    .select({
      addonCatalogId: bookingAddonLines.addonCatalogId,
      quantity: bookingAddonLines.quantity,
    })
    .from(bookingAddonLines)
    .where(eq(bookingAddonLines.bookingId, bookingId));

  const mergedAddon = new Map<string, number>();
  for (const r of addonLineRows) {
    mergedAddon.set(
      r.addonCatalogId,
      (mergedAddon.get(r.addonCatalogId) ?? 0) + r.quantity
    );
  }
  const previousAddOnInputs: AddonLineInput[] = [...mergedAddon.entries()].map(
    ([addonCatalogId, quantity]) => ({ addonCatalogId, quantity })
  );

  try {
    await db.transaction(async (tx) => {
      const [dec] = await tx
        .update(teeSlots)
        .set({
          bookedPlayers: sql`${teeSlots.bookedPlayers} - ${pc}`,
        })
        .where(
          and(eq(teeSlots.id, oldSlotId), gte(teeSlots.bookedPlayers, pc))
        )
        .returning();

      if (!dec) {
        throw new Error("DEC_FAIL");
      }

      let targetTeeSlotId: string;

      if (hasTeeSlotId) {
        targetTeeSlotId = String(body.teeSlotId).trim();
      } else {
        const cid = String(body.courseId).trim();
        const dt = new Date(String(body.datetime));
        let target = await tx.query.teeSlots.findFirst({
          where: and(eq(teeSlots.courseId, cid), eq(teeSlots.datetime, dt)),
        });
        if (!target) {
          const [inserted] = await tx
            .insert(teeSlots)
            .values({
              courseId: cid,
              datetime: dt,
              maxPlayers: 4,
              bookedPlayers: 0,
              status: "open",
            })
            .returning();
          target = inserted;
        }
        if (target.status !== "open") {
          throw new Error("TARGET_NOT_OPEN");
        }
        if ((target.bookedPlayers ?? 0) + pc > (target.maxPlayers ?? 4)) {
          throw new Error("TARGET_FULL");
        }
        targetTeeSlotId = target.id;
      }

      const [inc] = await tx
        .update(teeSlots)
        .set({
          bookedPlayers: sql`${teeSlots.bookedPlayers} + ${pc}`,
        })
        .where(
          and(
            eq(teeSlots.id, targetTeeSlotId),
            eq(teeSlots.status, "open"),
            sql`${teeSlots.bookedPlayers} + ${pc} <= ${teeSlots.maxPlayers}`
          )
        )
        .returning();

      if (!inc) {
        throw new Error("INC_FAIL");
      }

      await tx
        .update(bookings)
        .set({ teeSlotId: targetTeeSlotId })
        .where(eq(bookings.id, bookingId));

      finalTargetId = targetTeeSlotId;

      const newSlotRow = await tx.query.teeSlots.findFirst({
        where: eq(teeSlots.id, targetTeeSlotId),
      });
      if (!newSlotRow) {
        throw new Error("NO_TARGET_SLOT");
      }
      if (previousAddOnInputs.length > 0) {
        await recomputeBookingAddonsAfterMove(tx, {
          clubId,
          bookingId,
          newTeeSlot: {
            id: newSlotRow.id,
            datetime: newSlotRow.datetime,
            slotType: newSlotRow.slotType ?? null,
          },
          previousAddOnInputs,
        });
      }
    });

    const newSlotRow = await db.query.teeSlots.findFirst({
      where: eq(teeSlots.id, finalTargetId),
    });
    const oldDateStr = oldSlot.datetime.toISOString().split("T")[0];
    const newDateStr =
      newSlotRow?.datetime.toISOString().split("T")[0] ?? oldDateStr;
    await invalidateAvailabilityCache(clubId, oldSlot.courseId, oldDateStr);
    if (newSlotRow) {
      await invalidateAvailabilityCache(
        clubId,
        newSlotRow.courseId,
        newDateStr
      );
    }

    let responsePlayersCount = booking.playersCount;
    if (
      typeof body.playersCount === "number" &&
      body.playersCount !== booking.playersCount
    ) {
      const reloaded = await db.query.bookings.findFirst({
        where: and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)),
        with: {
          teeSlot: { with: { course: { with: { club: true } } } },
        },
      });
      if (!reloaded?.teeSlot) {
        res.status(500).json({ error: "Booking not found after move" });
        return;
      }
      const result = await applyPlayersCountMutation(
        reloaded,
        body.playersCount
      );
      if ("error" in result) {
        res.status(409).json({
          error: "Not enough capacity for this player count",
          code: "SLOT_FULL",
        });
        return;
      }
      responsePlayersCount = body.playersCount;
    }

    res.json({
      ok: true,
      bookingId,
      teeSlotId: finalTargetId,
      playersCount: responsePlayersCount,
    });
  } catch (e) {
    if (e instanceof AddOnUnavailableError) {
      res.status(409).json({
        code: e.code,
        error: "Add-on is not available after move",
        addonCatalogId: e.addonCatalogId,
        name: e.addonName,
      });
      return;
    }
    const msg = (e as Error).message;
    if (msg === "DEC_FAIL" || msg === "INC_FAIL") {
      res.status(409).json({ error: "Could not move booking" });
      return;
    }
    if (msg === "TARGET_NOT_OPEN") {
      res.status(409).json({
        code: "SLOT_NOT_OPEN",
        error: "Target slot is not open",
      });
      return;
    }
    if (msg === "TARGET_FULL") {
      res.status(409).json({
        code: "SLOT_FULL",
        error: "Target slot does not have capacity",
      });
      return;
    }
    if (msg === "NO_TARGET_SLOT") {
      res.status(500).json({ error: "Target slot missing" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:bookingId", publicRateLimit, async (req, res) => {
  const bookingId = String(req.params.bookingId);
  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  const auth = getAuthPayload(req);

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, bookingId), isNull(bookings.deletedAt)),
    with: {
      teeSlot: {
        with: { course: { with: { club: true } } },
      },
    },
  });

  if (!booking?.teeSlot?.course?.club) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const club = booking.teeSlot.course.club;
  const slot = booking.teeSlot;

  let guestOk = false;
  let staffOk = false;
  let ownerOk = false;

  if (auth && booking.userId && auth.userId === booking.userId) {
    ownerOk = true;
  }

  if (token) {
    try {
      const { bookingId: bid } = verifyGuestCancelToken(token);
      if (bid !== bookingId) {
        res.status(403).json({ error: "Invalid token" });
        return;
      }
      guestOk = true;
    } catch {
      res.status(400).json({ error: "Invalid cancel token" });
      return;
    }
  }

  if (auth) {
    staffOk = canAccessClub(auth.roles, club.id);
  }

  if (!guestOk && !staffOk && !ownerOk) {
    if (!token && !auth) {
      sendUnauthorized(res);
      return;
    }
    sendForbidden(res);
    return;
  }

  if ((guestOk || ownerOk) && !staffOk) {
    const configs = await db.query.clubConfig.findMany({
      where: eq(clubConfig.clubId, club.id),
      orderBy: [desc(clubConfig.effectiveFrom)],
    });
    const slotDate = new Date(
      slot.datetime.toISOString().split("T")[0] + "T12:00:00Z"
    );
    const cfg = resolveConfig(
      configs.map((c) => ({
        ...c,
        effectiveFrom: effFrom(c.effectiveFrom),
        slotIntervalMinutes: c.slotIntervalMinutes,
        openTime: c.openTime as string | null,
        closeTime: c.closeTime as string | null,
        schedule: c.schedule,
        timezone: c.timezone,
      })),
      slotDate
    );
    const hours = cfg.cancellationHours ?? 24;
    if (!isCancellable(slot.datetime, hours)) {
      res.status(403).json({
        code: "OUTSIDE_WINDOW",
        hoursRequired: hours,
        error: "Cancellation window has passed",
      });
      return;
    }
  }

  const dateStr = slot.datetime.toISOString().split("T")[0];

  try {
    await db.transaction(async (tx) => {
      await restoreAddonResourcesForBooking(tx, bookingId);
      await tx
        .update(bookings)
        .set({
          deletedAt: new Date(),
          status: "cancelled",
        })
        .where(eq(bookings.id, bookingId));

      await tx
        .update(teeSlots)
        .set({
          bookedPlayers: sql`GREATEST(0, ${teeSlots.bookedPlayers} - ${booking.playersCount})`,
        })
        .where(eq(teeSlots.id, slot.id));
    });

    await invalidateAvailabilityCache(club.id, slot.courseId, dateStr);

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

    if (booking.guestEmail) {
      await enqueueEmail("email:booking-cancellation", {
        guestEmail: booking.guestEmail,
        clubName: club.name,
        whenLabel: slot.datetime.toISOString(),
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    sendUnauthorized(res);
    return;
  }

  const parsed = CreateBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { teeSlotId, playersCount, guestName, guestEmail, notes, players, addOns } =
    parsed.data;

  try {
    const { booking, updatedSlot, club } = await db.transaction(async (tx) => {
      const [updatedSlot] = await tx
        .update(teeSlots)
        .set({
          bookedPlayers: sql`${teeSlots.bookedPlayers} + ${playersCount}`,
        })
        .where(
          and(
            eq(teeSlots.id, teeSlotId),
            sql`${teeSlots.bookedPlayers} + ${playersCount} <= ${teeSlots.maxPlayers}`,
            eq(teeSlots.status, "open")
          )
        )
        .returning();

      if (!updatedSlot) {
        throw new Error("SLOT_FULL");
      }

      const slotWithCourse = await tx.query.teeSlots.findFirst({
        where: eq(teeSlots.id, teeSlotId),
        with: { course: { with: { club: true } } },
      });

      const clubRow = slotWithCourse?.course?.club;
      if (!clubRow) {
        throw new Error("NO_CLUB");
      }

      if (!canAccessClub(auth.roles, clubRow.id)) {
        throw new Error("FORBIDDEN");
      }

      const ref = await generateUniqueBookingRef(clubRow.slug, tx);

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingRef: ref,
          teeSlotId,
          userId: auth.userId,
          source: "staff",
          guestName,
          guestEmail,
          playersCount,
          notes: notes ?? null,
          status: "confirmed",
          paymentStatus: "unpaid",
        })
        .returning();

      if (players && Array.isArray(players)) {
        for (const p of players) {
          await tx.insert(bookingPlayers).values({
            bookingId: booking.id,
            name: p.name,
            email: p.email ?? null,
          });
        }
      }

      await checkAndInsertAddons(tx, {
        clubId: clubRow.id,
        bookingId: booking.id,
        teeSlot: {
          id: updatedSlot.id,
          datetime: updatedSlot.datetime,
          slotType: updatedSlot.slotType ?? null,
        },
        addOns,
      });

      return { booking, updatedSlot, club: clubRow };
    });

    const dateStr = updatedSlot.datetime.toISOString().split("T")[0];
    await invalidateAvailabilityCache(
      club.id,
      updatedSlot.courseId,
      dateStr
    );

    await enqueueEmail("email:booking-confirmation", {
      bookingId: booking.id,
    });

    res.status(201).json({
      id: booking.id,
      bookingRef: booking.bookingRef,
      teeSlotId,
      playersCount: booking.playersCount,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      notes: booking.notes,
      status: booking.status,
    });
  } catch (e) {
    if (e instanceof AddOnUnavailableError) {
      res.status(409).json({
        code: e.code,
        error: "Add-on is not available",
        addonCatalogId: e.addonCatalogId,
        name: e.addonName,
      });
      return;
    }
    const msg = (e as Error).message;
    if (msg === "SLOT_FULL") {
      res.status(409).json({ code: "SLOT_FULL", error: "That slot is full" });
      return;
    }
    if (msg === "FORBIDDEN") {
      sendForbidden(res);
      return;
    }
    if (msg === "NO_CLUB") {
      res.status(400).json({ error: "Invalid tee slot" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:bookingId/players/:playerId", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    sendUnauthorized(res);
    return;
  }

  const bookingId = String(req.params.bookingId);
  const playerId = String(req.params.playerId);
  const body = req.body as { checkedIn?: boolean; noShow?: boolean };

  const player = await db.query.bookingPlayers.findFirst({
    where: eq(bookingPlayers.id, playerId),
    with: {
      booking: {
        with: {
          teeSlot: { with: { course: true } },
        },
      },
    },
  });

  if (!player || player.bookingId !== bookingId) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const clubId = player.booking.teeSlot?.course?.clubId;
  if (!clubId || !canAccessClub(auth.roles, clubId)) {
    sendForbidden(res);
    return;
  }

  const patch: { checkedIn?: boolean; noShow?: boolean } = {};
  if (typeof body.checkedIn === "boolean") patch.checkedIn = body.checkedIn;
  if (typeof body.noShow === "boolean") patch.noShow = body.noShow;

  const [row] = await db
    .update(bookingPlayers)
    .set(patch)
    .where(eq(bookingPlayers.id, playerId))
    .returning();

  res.json({
    id: row.id,
    checkedIn: row.checkedIn,
    noShow: row.noShow,
  });
});

router.post(
  "/:bookingId/addons/:lineId/assignments",
  authenticate,
  async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      sendUnauthorized(res);
      return;
    }
    const bookingId = String(req.params.bookingId);
    const lineId = String(req.params.lineId);
    const resourceItemIdRaw = (req.body as { resourceItemId?: unknown })
      ?.resourceItemId;
    const resourceItemId =
      typeof resourceItemIdRaw === "string" ? resourceItemIdRaw.trim() : "";
    if (!resourceItemId) {
      res.status(400).json({ error: "resourceItemId required" });
      return;
    }

    const [line] = await db
      .select({
        lineId: bookingAddonLines.id,
        strat: resourceTypes.assignmentStrategy,
        rtId: bookingAddonLines.resourceTypeId,
        clubId: courses.clubId,
      })
      .from(bookingAddonLines)
      .innerJoin(bookings, eq(bookingAddonLines.bookingId, bookings.id))
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .leftJoin(resourceTypes, eq(bookingAddonLines.resourceTypeId, resourceTypes.id))
      .where(
        and(
          eq(bookingAddonLines.id, lineId),
          eq(bookingAddonLines.bookingId, bookingId)
        )
      );

    if (!line) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!canAccessClub(auth.roles, line.clubId)) {
      sendForbidden(res);
      return;
    }

    if (line.strat !== "manual") {
      res.status(400).json({
        error: "Only manual add-ons can be assigned from the tee sheet",
      });
      return;
    }

    if (!line.rtId) {
      res.status(400).json({ error: "Add-on line has no resource type" });
      return;
    }

    const [item] = await db
      .select({
        id: resourceItems.id,
        label: resourceItems.label,
        status: resourceItems.operationalStatus,
      })
      .from(resourceItems)
      .where(
        and(
          eq(resourceItems.id, resourceItemId),
          eq(resourceItems.resourceTypeId, line.rtId),
          eq(resourceItems.clubId, line.clubId)
        )
      );

    if (!item || item.status !== "available") {
      res.status(409).json({ error: "Resource item is not available" });
      return;
    }

    const [created] = await db
      .insert(bookingResourceAssignments)
      .values({
        bookingAddonLineId: line.lineId,
        resourceItemId,
        assignedBy: auth.userId,
      })
      .returning();

    res.status(201).json({
      id: created.id,
      resourceItemId: created.resourceItemId,
      label: item.label,
    });
  }
);

router.delete(
  "/:bookingId/addons/:lineId/assignments/:assignmentId",
  authenticate,
  async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      sendUnauthorized(res);
      return;
    }
    const bookingId = String(req.params.bookingId);
    const lineId = String(req.params.lineId);
    const assignmentId = String(req.params.assignmentId);

    const [row] = await db
      .select({ clubId: courses.clubId })
      .from(bookingResourceAssignments)
      .innerJoin(
        bookingAddonLines,
        eq(
          bookingResourceAssignments.bookingAddonLineId,
          bookingAddonLines.id
        )
      )
      .innerJoin(bookings, eq(bookingAddonLines.bookingId, bookings.id))
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .where(
        and(
          eq(bookingResourceAssignments.id, assignmentId),
          eq(bookingAddonLines.id, lineId),
          eq(bookingAddonLines.bookingId, bookingId)
        )
      );

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!canAccessClub(auth.roles, row.clubId)) {
      sendForbidden(res);
      return;
    }

    await db
      .delete(bookingResourceAssignments)
      .where(eq(bookingResourceAssignments.id, assignmentId));

    res.json({ ok: true });
  }
);

export default router;
