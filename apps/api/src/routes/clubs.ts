import { Router, type Request } from "express";
import {
  db,
  clubs,
  clubConfig,
  bookings,
  teeSlots,
  courses,
  roundScorecards,
  roundScorecardHoles,
  courseHoles,
} from "@teetimes/db";
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
  gt,
  type SQL,
} from "drizzle-orm";
import { authenticate, requireClubAccess } from "../middleware/auth";
import { escapeLikePattern } from "../lib/escapeLike";
import { resolveConfig, resolveHours } from "../lib/configResolver";
import { generateSlots } from "../lib/slotGenerator";

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

function effFrom(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ClubConfigRowForSlots = {
  effectiveFrom: string | Date;
  slotIntervalMinutes: number | null;
  openTime: string | null;
  closeTime: string | null;
  schedule: unknown;
  timezone: string | null;
};

function totalSlotsForDay(
  configRows: ClubConfigRowForSlots[],
  courseCount: number,
  dateStr: string
): number {
  if (configRows.length === 0 || courseCount === 0) return 0;
  const mapped = configRows.map((c) => ({
    effectiveFrom: effFrom(c.effectiveFrom),
    slotIntervalMinutes: c.slotIntervalMinutes,
    openTime: c.openTime,
    closeTime: c.closeTime,
    schedule: c.schedule,
    timezone: c.timezone,
  }));
  const targetDate = new Date(`${dateStr}T12:00:00Z`);
  const config = resolveConfig(mapped, targetDate);
  const dayOfWeek = targetDate.getUTCDay();
  const hours = resolveHours(config, dayOfWeek);
  const slotCfg = {
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    slotIntervalMinutes: config.slotIntervalMinutes ?? 10,
    timezone: config.timezone ?? "America/New_York",
  };
  const n = generateSlots(slotCfg, dateStr).length;
  return n * courseCount;
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

/** Non-PII aggregate scorecard stats for the club (all courses). */
router.get("/reports/scorecards", async (req, res) => {
  const clubId = paramClubId(req);
  if (!clubId) {
    res.status(400).json({ error: "clubId required" });
    return;
  }

  const courseRows = await db.query.courses.findMany({
    where: eq(courses.clubId, clubId),
    columns: { id: true },
  });
  const courseIds = courseRows.map((c) => c.id);
  if (courseIds.length === 0) {
    res.json({
      completionRate: 0,
      totalRounds: 0,
      holeAverages: [],
      scoreDistribution: {
        underPar: 0,
        atPar: 0,
        overPar1: 0,
        overPar2plus: 0,
      },
    });
    return;
  }

  const [totalBookingsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(bookings.status, "confirmed"),
        inArray(teeSlots.courseId, courseIds),
        lt(teeSlots.datetime, new Date())
      )
    );

  const [totalRoundsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(roundScorecards)
    .innerJoin(bookings, eq(roundScorecards.bookingId, bookings.id))
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(
      and(
        inArray(teeSlots.courseId, courseIds),
        isNull(bookings.deletedAt),
        eq(bookings.status, "confirmed"),
        lt(teeSlots.datetime, new Date())
      )
    );

  const totalBookings = totalBookingsRow?.c ?? 0;
  const totalRounds = totalRoundsRow?.c ?? 0;
  const completionRate =
    totalBookings === 0
      ? 0
      : Math.round((totalRounds / totalBookings) * 100) / 100;

  const holeAvgRows = await db
    .select({
      holeNumber: roundScorecardHoles.holeNumber,
      par: courseHoles.par,
      avgScore: sql<number>`round(avg(${roundScorecardHoles.score})::numeric, 2)::float`,
      sampleSize: sql<number>`count(*)::int`,
    })
    .from(roundScorecardHoles)
    .innerJoin(
      roundScorecards,
      eq(roundScorecardHoles.scorecardId, roundScorecards.id)
    )
    .innerJoin(
      courseHoles,
      and(
        eq(courseHoles.courseId, roundScorecards.courseId),
        eq(courseHoles.holeNumber, roundScorecardHoles.holeNumber)
      )
    )
    .innerJoin(bookings, eq(roundScorecards.bookingId, bookings.id))
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(inArray(teeSlots.courseId, courseIds))
    .groupBy(roundScorecardHoles.holeNumber, courseHoles.par)
    .orderBy(roundScorecardHoles.holeNumber);

  const distRows = await db
    .select({
      delta: sql<number>`(${roundScorecardHoles.score} - ${courseHoles.par})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(roundScorecardHoles)
    .innerJoin(
      roundScorecards,
      eq(roundScorecardHoles.scorecardId, roundScorecards.id)
    )
    .innerJoin(
      courseHoles,
      and(
        eq(courseHoles.courseId, roundScorecards.courseId),
        eq(courseHoles.holeNumber, roundScorecardHoles.holeNumber)
      )
    )
    .innerJoin(bookings, eq(roundScorecards.bookingId, bookings.id))
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .where(inArray(teeSlots.courseId, courseIds))
    .groupBy(sql`(${roundScorecardHoles.score} - ${courseHoles.par})::int`);

  let underPar = 0;
  let atPar = 0;
  let overPar1 = 0;
  let overPar2plus = 0;
  for (const row of distRows) {
    if (row.delta < 0) underPar += row.count;
    else if (row.delta === 0) atPar += row.count;
    else if (row.delta === 1) overPar1 += row.count;
    else overPar2plus += row.count;
  }

  res.json({
    completionRate,
    totalRounds,
    holeAverages: holeAvgRows.map((r) => ({
      holeNumber: r.holeNumber,
      par: r.par,
      avgScore: r.avgScore,
      sampleSize: r.sampleSize,
    })),
    scoreDistribution: { underPar, atPar, overPar1, overPar2plus },
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
    noShows: number;
  }[] = [];

  let totalBookings = 0;
  let totalPlayers = 0;
  let totalRevenueGreenFees = 0;
  let noShowsTotal = 0;
  const dailyOccupancyRaw: number[] = [];

  const configRows = await db.query.clubConfig.findMany({
    where: eq(clubConfig.clubId, clubId),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });

  const courseRows = await db.query.courses.findMany({
    where: eq(courses.clubId, clubId),
    columns: { id: true },
  });
  const courseCount = courseRows.length;

  const rangeStart = new Date(todayUtc);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (numDays - 1));
  const rangeEnd = new Date(todayUtc);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const [sourceAgg] = await db
    .select({
      online: sql<number>`coalesce(count(*) filter (where ${bookings.source} in ('online_guest', 'online_user')), 0)::int`,
      staff: sql<number>`coalesce(count(*) filter (where ${bookings.source} = 'staff'), 0)::int`,
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

  const [confirmedForRateRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .innerJoin(courses, eq(teeSlots.courseId, courses.id))
    .where(
      and(
        isNull(bookings.deletedAt),
        eq(courses.clubId, clubId),
        inArray(bookings.status, ["confirmed", "no_show"]),
        gte(teeSlots.datetime, rangeStart),
        lt(teeSlots.datetime, rangeEnd)
      )
    );

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

    const [revRow] = await db
      .select({
        revenue: sql<string>`coalesce(sum(coalesce(${teeSlots.price}, 0) * ${bookings.playersCount}), 0)::text`,
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

    const [occRow] = await db
      .select({
        occupied: sql<number>`count(*)::int`,
      })
      .from(teeSlots)
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .where(
        and(
          eq(courses.clubId, clubId),
          gte(teeSlots.datetime, dayStart),
          lt(teeSlots.datetime, dayEnd),
          gt(teeSlots.bookedPlayers, 0)
        )
      );

    const [noShowRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
      .innerJoin(courses, eq(teeSlots.courseId, courses.id))
      .where(
        and(
          isNull(bookings.deletedAt),
          eq(courses.clubId, clubId),
          eq(bookings.status, "no_show"),
          gte(teeSlots.datetime, dayStart),
          lt(teeSlots.datetime, dayEnd)
        )
      );

    const totalSlots = totalSlotsForDay(configRows, courseCount, dateStr);
    const occupiedSlots = occRow?.occupied ?? 0;
    const occupancyRaw =
      totalSlots === 0 ? 0 : (occupiedSlots / totalSlots) * 100;
    dailyOccupancyRaw.push(occupancyRaw);

    const b = row?.bookings ?? 0;
    const p = row?.players ?? 0;
    const revenueNum = Number(revRow?.revenue ?? 0);
    const revenueRounded = round2(revenueNum);
    totalBookings += b;
    totalPlayers += p;
    totalRevenueGreenFees += revenueNum;
    const noShowsDay = noShowRow?.c ?? 0;
    noShowsTotal += noShowsDay;
    series.push({
      date: dateStr,
      bookings: b,
      players: p,
      revenueGreenFees: revenueRounded,
      revenueAddons: 0,
      occupancyPct: round1(occupancyRaw),
      noShows: noShowsDay,
    });
  }

  const totalsOccupancyPct =
    dailyOccupancyRaw.length === 0
      ? 0
      : round1(
          dailyOccupancyRaw.reduce((a, x) => a + x, 0) /
            dailyOccupancyRaw.length
        );

  const confirmedTotal = confirmedForRateRow?.c ?? 0;
  const noShowRate =
    confirmedTotal > 0
      ? round1((noShowsTotal / confirmedTotal) * 100)
      : 0;

  res.json({
    days: numDays,
    series,
    totals: {
      bookings: totalBookings,
      players: totalPlayers,
      revenueGreenFees: round2(totalRevenueGreenFees),
      revenueAddons: 0,
      occupancyPct: totalsOccupancyPct,
      noShows: noShowsTotal,
      noShowRate,
      sources: {
        online: sourceAgg?.online ?? 0,
        staff: sourceAgg?.staff ?? 0,
      },
    },
  });
});

export default router;
