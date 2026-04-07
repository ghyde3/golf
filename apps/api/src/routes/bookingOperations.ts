import { Router } from "express";
import { eq, and, isNull, desc, sql, gte } from "drizzle-orm";
import {
  db,
  bookings,
  bookingPlayers,
  teeSlots,
  courses,
  clubConfig,
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

  res.json({
    id: booking.id,
    bookingRef: booking.bookingRef,
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
    },
    players: booking.players.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      checkedIn: p.checkedIn,
      noShow: p.noShow,
    })),
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
  };

  const hasTeeSlotId =
    typeof body.teeSlotId === "string" && body.teeSlotId.trim().length > 0;
  const hasCourseDatetime =
    typeof body.courseId === "string" &&
    body.courseId.trim().length > 0 &&
    typeof body.datetime === "string" &&
    body.datetime.trim().length > 0;

  if (!hasTeeSlotId && !hasCourseDatetime) {
    res.status(400).json({
      error: "Provide teeSlotId or courseId and datetime",
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

  const clubId = booking.teeSlot.course.club.id;
  if (!canAccessClub(auth.roles, clubId)) {
    sendForbidden(res);
    return;
  }

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
      res.json({ ok: true, bookingId, teeSlotId: atTarget.id });
      return;
    }
  }

  if (hasTeeSlotId) {
    const tid = String(body.teeSlotId).trim();
    if (tid === oldSlotId) {
      res.json({ ok: true, bookingId, teeSlotId: tid });
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

    res.json({ ok: true, bookingId, teeSlotId: finalTargetId });
  } catch (e) {
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

  if (!guestOk && !staffOk) {
    if (!token && !auth) {
      sendUnauthorized(res);
      return;
    }
    sendForbidden(res);
    return;
  }

  if (guestOk && !staffOk) {
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

  const { teeSlotId, playersCount, guestName, guestEmail, notes, players } =
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

export default router;
