import { Router } from "express";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  db,
  bookings,
  teeSlots,
  courses,
  clubs,
  clubConfig,
} from "@teetimes/db";
import { MeBookingsQuerySchema } from "@teetimes/validators";
import { authenticate } from "../middleware/auth";
import { isCancellable } from "../lib/cancellation";
import { resolveConfig } from "../lib/configResolver";

const router = Router();

function effFrom(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

function upcomingWhere(userId: string, now: Date) {
  return and(
    eq(bookings.userId, userId),
    isNull(bookings.deletedAt),
    gte(teeSlots.datetime, now),
    eq(bookings.status, "confirmed")
  );
}

function pastWhere(userId: string, now: Date) {
  return and(
    eq(bookings.userId, userId),
    or(isNotNull(bookings.deletedAt), lt(teeSlots.datetime, now))
  );
}

router.get("/bookings", authenticate, async (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = MeBookingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid query",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { upcoming: upcomingParam, page, limit } = parsed.data;
  const userId = auth.userId;
  const now = new Date();
  const offset = (page - 1) * limit;

  const baseFrom = () =>
    db
      .select({
        booking: bookings,
        teeSlot: teeSlots,
        course: courses,
        club: clubs,
      })
      .from(bookings)
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .innerJoin(clubs, eq(courses.clubId, clubs.id));

  async function countWhere(where: ReturnType<typeof upcomingWhere>) {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .where(where);
    return row?.c ?? 0;
  }

  let total = 0;
  let upcomingRows: Awaited<ReturnType<typeof fetchUpcoming>> = [];
  let pastRows: Awaited<ReturnType<typeof fetchPast>> = [];

  async function fetchUpcoming() {
    return baseFrom()
      .where(upcomingWhere(userId, now))
      .orderBy(teeSlots.datetime)
      .limit(limit)
      .offset(offset);
  }

  async function fetchPast() {
    return baseFrom()
      .where(pastWhere(userId, now))
      .orderBy(desc(teeSlots.datetime))
      .limit(limit)
      .offset(offset);
  }

  if (upcomingParam === undefined) {
    total =
      (await countWhere(upcomingWhere(userId, now))) +
      (await countWhere(pastWhere(userId, now)));
    upcomingRows = await fetchUpcoming();
    pastRows = await fetchPast();
  } else if (upcomingParam === "true") {
    total = await countWhere(upcomingWhere(userId, now));
    upcomingRows = await fetchUpcoming();
  } else {
    total = await countWhere(pastWhere(userId, now));
    pastRows = await fetchPast();
  }

  const clubIds = [
    ...new Set(
      [...upcomingRows, ...pastRows].map((r) => r.club.id)
    ),
  ];

  const configsByClub = new Map<
    string,
    {
      effectiveFrom: string;
      slotIntervalMinutes: number | null;
      openTime: string | null;
      closeTime: string | null;
      schedule: unknown;
      timezone: string | null;
      cancellationHours?: number | null;
    }[]
  >();

  if (clubIds.length > 0) {
    const cfgRows = await db.query.clubConfig.findMany({
      where: inArray(clubConfig.clubId, clubIds),
      orderBy: [desc(clubConfig.effectiveFrom)],
    });
    for (const cid of clubIds) {
      const list = cfgRows
        .filter((c) => c.clubId === cid)
        .map((c) => ({
          ...c,
          effectiveFrom: effFrom(c.effectiveFrom),
          slotIntervalMinutes: c.slotIntervalMinutes,
          openTime: c.openTime as string | null,
          closeTime: c.closeTime as string | null,
          schedule: c.schedule,
          timezone: c.timezone,
        }));
      configsByClub.set(cid, list);
    }
  }

  function mapRow(
    row: (typeof upcomingRows)[0],
    section: "upcoming" | "past"
  ) {
    const { booking, teeSlot, course, club } = row;
    const slotDate = new Date(
      teeSlot.datetime.toISOString().split("T")[0] + "T12:00:00Z"
    );
    const configs = configsByClub.get(club.id) ?? [];
    const cfg =
      configs.length > 0 ? resolveConfig(configs, slotDate) : null;
    const hours = cfg?.cancellationHours ?? 24;
    const timezone = cfg?.timezone ?? "America/New_York";

    const cancellable =
      section === "upcoming" &&
      booking.deletedAt === null &&
      booking.status === "confirmed" &&
      isCancellable(teeSlot.datetime, hours);

    return {
      id: booking.id,
      bookingRef: booking.bookingRef,
      status: booking.status ?? "confirmed",
      playersCount: booking.playersCount,
      createdAt: booking.createdAt?.toISOString() ?? new Date().toISOString(),
      isCancellable: cancellable,
      teeSlot: {
        datetime: teeSlot.datetime.toISOString(),
        courseName: course.name,
        clubName: club.name,
        clubSlug: club.slug,
        timezone,
      },
    };
  }

  res.json({
    upcoming: upcomingRows.map((r) => mapRow(r, "upcoming")),
    past: pastRows.map((r) => mapRow(r, "past")),
    total,
  });
});

export default router;
