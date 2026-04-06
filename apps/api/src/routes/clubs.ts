import { Router, type Request } from "express";
import { db, clubs, clubConfig, bookings, teeSlots, courses } from "@teetimes/db";
import { eq, desc, sql, and, gte, lt, isNull, inArray } from "drizzle-orm";
import { authenticate, requireClubAccess } from "../middleware/auth";

const router = Router({ mergeParams: true });

function paramClubId(req: Request): string | undefined {
  const raw = req.params.clubId;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

router.use(authenticate);
router.use(requireClubAccess);

router.get("/summary", async (req, res) => {
  const clubId = paramClubId(req);
  if (!clubId) {
    res.status(400).json({ error: "clubId required" });
    return;
  }

  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
    with: {
      configs: { orderBy: [desc(clubConfig.effectiveFrom)], limit: 1 },
      courses: true,
    },
  });

  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const courseIds = club.courses.map((c) => c.id);

  let bookingsToday = 0;
  if (courseIds.length > 0) {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .where(
        and(
          isNull(bookings.deletedAt),
          inArray(teeSlots.courseId, courseIds),
          gte(bookings.createdAt, dayStart),
          lt(bookings.createdAt, dayEnd)
        )
      );
    bookingsToday = row?.c ?? 0;
  }

  const cfg = club.configs[0];

  res.json({
    id: club.id,
    name: club.name,
    slug: club.slug,
    status: club.status,
    coursesCount: club.courses.length,
    bookingsToday,
    currentConfig: cfg
      ? {
          effectiveFrom: cfg.effectiveFrom,
          slotIntervalMinutes: cfg.slotIntervalMinutes,
          bookingWindowDays: cfg.bookingWindowDays,
          timezone: cfg.timezone,
          primaryColor: cfg.primaryColor,
        }
      : null,
  });
});

/** Same “today” window and club scope as `bookingsToday` in GET /summary (UTC calendar day, createdAt). */
router.get("/bookings", async (req, res) => {
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

  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const rows = await db
    .select({
      id: bookings.id,
      bookingRef: bookings.bookingRef,
      guestName: bookings.guestName,
      guestEmail: bookings.guestEmail,
      playersCount: bookings.playersCount,
      status: bookings.status,
      createdAt: bookings.createdAt,
      teeDatetime: teeSlots.datetime,
      courseId: courses.id,
      courseName: courses.name,
    })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .innerJoin(courses, eq(teeSlots.courseId, courses.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(courses.clubId, clubId),
        gte(bookings.createdAt, dayStart),
        lt(bookings.createdAt, dayEnd)
      )
    )
    .orderBy(desc(bookings.createdAt));

  res.json({
    bookings: rows.map((r) => ({
      id: r.id,
      bookingRef: r.bookingRef,
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      playersCount: r.playersCount,
      status: r.status,
      createdAt: r.createdAt!.toISOString(),
      teeSlot: {
        datetime: r.teeDatetime.toISOString(),
        courseId: r.courseId,
        courseName: r.courseName,
      },
    })),
  });
});

/** Daily booking counts for UTC calendar days (same club scope as GET /bookings). */
router.get("/reports", async (req, res) => {
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

  const rawDays = req.query.days;
  let numDays = 7;
  if (typeof rawDays === "string") {
    const n = Number.parseInt(rawDays, 10);
    if (!Number.isNaN(n)) numDays = Math.min(31, Math.max(1, n));
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const series: {
    date: string;
    bookings: number;
    players: number;
  }[] = [];

  let totalBookings = 0;
  let totalPlayers = 0;

  for (let offset = numDays - 1; offset >= 0; offset--) {
    const dayStart = new Date(todayUtc);
    dayStart.setUTCDate(dayStart.getUTCDate() - offset);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [row] = await db
      .select({
        bookings: sql<number>`count(*)::int`,
        players: sql<number>`coalesce(sum(${bookings.playersCount}), 0)::int`,
      })
      .from(bookings)
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .where(
        and(
          isNull(bookings.deletedAt),
          eq(courses.clubId, clubId),
          gte(bookings.createdAt, dayStart),
          lt(bookings.createdAt, dayEnd)
        )
      );

    const b = row?.bookings ?? 0;
    const p = row?.players ?? 0;
    totalBookings += b;
    totalPlayers += p;
    series.push({
      date: dayStart.toISOString().slice(0, 10),
      bookings: b,
      players: p,
    });
  }

  res.json({
    days: numDays,
    series,
    totals: { bookings: totalBookings, players: totalPlayers },
  });
});

export default router;
