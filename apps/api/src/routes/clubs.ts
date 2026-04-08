import { Router, type Request } from "express";
import { db, clubs, clubConfig, bookings, teeSlots, courses } from "@teetimes/db";
import {
  eq,
  desc,
  asc,
  sql,
  and,
  gte,
  lt,
  isNull,
  inArray,
  or,
  ilike,
  type SQL,
} from "drizzle-orm";
import { authenticate, requireClubAccess } from "../middleware/auth";
import { escapeLikePattern } from "../lib/escapeLike";
import { resolveConfig, resolveHours } from "../lib/configResolver";
import { generateSlots } from "../lib/slotGenerator";

function effFromConfig(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function money2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

function utcDayStart(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map((x) => Number.parseInt(x, 10));
  if (
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)
  ) {
    throw new Error("invalid date");
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDayEndExclusive(isoDate: string): Date {
  const start = utcDayStart(isoDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

/** Same club scope as `bookingsToday` in GET /summary. Default date range: UTC calendar day on `createdAt` (today if `from`/`to` omitted). */
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
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const rawFrom = req.query.from;
  const rawTo = req.query.to;
  const fromStr =
    typeof rawFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom)
      ? rawFrom
      : todayStr;
  const toStr =
    typeof rawTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawTo)
      ? rawTo
      : fromStr;

  let rangeStart: Date;
  let rangeEnd: Date;
  try {
    rangeStart = utcDayStart(fromStr);
    rangeEnd = utcDayEndExclusive(toStr);
  } catch {
    res.status(400).json({ error: "Invalid from/to (use YYYY-MM-DD)" });
    return;
  }

  if (rangeEnd <= rangeStart) {
    res.status(400).json({ error: "`to` must be on or after `from`" });
    return;
  }

  const rangeField =
    req.query.range === "tee" ? ("tee" as const) : ("created" as const);

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25)
  );

  const sortRaw = String(req.query.sort ?? "createdAt");
  const sortKey =
    sortRaw === "teeTime" ||
    sortRaw === "guestName" ||
    sortRaw === "bookingRef" ||
    sortRaw === "courseName" ||
    sortRaw === "playersCount" ||
    sortRaw === "status" ||
    sortRaw === "createdAt"
      ? sortRaw
      : "createdAt";

  const orderDir = req.query.order === "asc" ? "asc" : "desc";

  const qRaw = req.query.q;
  const q =
    typeof qRaw === "string" && qRaw.trim().length > 0 ? qRaw.trim() : "";

  const statusRaw = req.query.status;
  const statusFilter =
    typeof statusRaw === "string" && statusRaw.trim().length > 0
      ? statusRaw.trim()
      : "";

  const courseRaw = req.query.courseId;
  const courseFilter =
    typeof courseRaw === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      courseRaw
    )
      ? courseRaw
      : "";

  const extra: SQL[] = [];

  extra.push(isNull(bookings.deletedAt));
  extra.push(eq(courses.clubId, clubId));

  if (rangeField === "created") {
    extra.push(gte(bookings.createdAt, rangeStart));
    extra.push(lt(bookings.createdAt, rangeEnd));
  } else {
    extra.push(gte(teeSlots.datetime, rangeStart));
    extra.push(lt(teeSlots.datetime, rangeEnd));
  }

  if (q) {
    const pattern = `%${escapeLikePattern(q)}%`;
    extra.push(
      or(
        ilike(bookings.bookingRef, pattern),
        ilike(bookings.guestEmail, pattern),
        ilike(bookings.guestName, pattern)
      )!
    );
  }

  if (statusFilter) {
    extra.push(eq(bookings.status, statusFilter));
  }

  if (courseFilter) {
    extra.push(eq(courses.id, courseFilter));
  }

  const whereClause = and(...extra);

  const sortExpr =
    sortKey === "teeTime"
      ? teeSlots.datetime
      : sortKey === "guestName"
        ? bookings.guestName
        : sortKey === "bookingRef"
          ? bookings.bookingRef
          : sortKey === "courseName"
            ? courses.name
            : sortKey === "playersCount"
              ? bookings.playersCount
              : sortKey === "status"
                ? bookings.status
                : bookings.createdAt;

  const orderCol =
    orderDir === "asc" ? asc(sortExpr) : desc(sortExpr);

  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .innerJoin(courses, eq(teeSlots.courseId, courses.id))
    .where(whereClause);

  const total = countRow?.c ?? 0;

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
    .where(whereClause)
    .orderBy(orderCol)
    .limit(limit)
    .offset((page - 1) * limit);

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
    total,
    page,
    limit,
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
    if (!Number.isNaN(n)) numDays = Math.min(90, Math.max(1, n));
  }

  const configs = await db.query.clubConfig.findMany({
    where: eq(clubConfig.clubId, clubId),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });

  const courseRows = await db.query.courses.findMany({
    where: eq(courses.clubId, clubId),
    columns: { id: true },
  });

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const series: {
    date: string;
    bookings: number;
    players: number;
    revenueGreenFees: number;
    revenueAddons: number;
    occupancyPct: number;
  }[] = [];

  let totalBookings = 0;
  let totalPlayers = 0;
  let totalRevenueGreenFees = 0;
  const dailyOccupancyPcts: number[] = [];

  for (let offset = numDays - 1; offset >= 0; offset--) {
    const dayStart = new Date(todayUtc);
    dayStart.setUTCDate(dayStart.getUTCDate() - offset);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const dateStr = dayStart.toISOString().slice(0, 10);

    const [row] = await db
      .select({
        bookings: sql<number>`count(*)::int`,
        players: sql<number>`coalesce(sum(${bookings.playersCount}), 0)::int`,
        revenueGreenFees: sql<string>`coalesce(sum(${teeSlots.price} * ${bookings.playersCount}), 0)::numeric`,
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
    const revRaw = row?.revenueGreenFees ?? "0";
    const rev = money2(Number(revRaw));

    let totalSlots = 0;
    if (configs.length > 0 && courseRows.length > 0) {
      const targetDate = new Date(`${dateStr}T12:00:00Z`);
      const config = resolveConfig(
        configs.map((c) => ({
          ...c,
          effectiveFrom: effFromConfig(c.effectiveFrom),
          slotIntervalMinutes: c.slotIntervalMinutes,
          openTime: c.openTime as string | null,
          closeTime: c.closeTime as string | null,
          schedule: c.schedule,
          timezone: c.timezone,
        })),
        targetDate
      );
      const dayOfWeek = targetDate.getUTCDay();
      const hours = resolveHours(config, dayOfWeek);
      const generated = generateSlots(
        {
          openTime: hours.openTime,
          closeTime: hours.closeTime,
          slotIntervalMinutes: config.slotIntervalMinutes ?? 10,
          timezone: config.timezone ?? "America/New_York",
        },
        dateStr
      );
      totalSlots = generated.length * courseRows.length;
    }

    const [occRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(teeSlots)
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .where(
        and(
          eq(courses.clubId, clubId),
          gte(teeSlots.datetime, dayStart),
          lt(teeSlots.datetime, dayEnd),
          sql`${teeSlots.bookedPlayers} > 0`
        )
      );

    const bookedSlotCount = occRow?.c ?? 0;
    const occupancyPct =
      totalSlots > 0
        ? round1((bookedSlotCount / totalSlots) * 100)
        : 0;
    dailyOccupancyPcts.push(occupancyPct);

    totalBookings += b;
    totalPlayers += p;
    totalRevenueGreenFees = money2(totalRevenueGreenFees + rev);

    series.push({
      date: dateStr,
      bookings: b,
      players: p,
      revenueGreenFees: rev,
      revenueAddons: 0,
      occupancyPct,
    });
  }

  const rangeStart = new Date(todayUtc);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (numDays - 1));
  const rangeEnd = new Date(todayUtc);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const [srcRow] = await db
    .select({
      online: sql<number>`count(*) filter (where ${bookings.userId} is null)::int`,
      staff: sql<number>`count(*) filter (where ${bookings.userId} is not null)::int`,
    })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .innerJoin(courses, eq(teeSlots.courseId, courses.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(courses.clubId, clubId),
        gte(bookings.createdAt, rangeStart),
        lt(bookings.createdAt, rangeEnd)
      )
    );

  const totalsOccupancyPct =
    dailyOccupancyPcts.length > 0
      ? round1(
          dailyOccupancyPcts.reduce((a, x) => a + x, 0) /
            dailyOccupancyPcts.length
        )
      : 0;

  res.json({
    days: numDays,
    series,
    totals: {
      bookings: totalBookings,
      players: totalPlayers,
      revenueGreenFees: totalRevenueGreenFees,
      revenueAddons: 0,
      occupancyPct: totalsOccupancyPct,
      sources: {
        online: srcRow?.online ?? 0,
        staff: srcRow?.staff ?? 0,
      },
    },
  });
});

export default router;
