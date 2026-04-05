import { Router, type Request, type Response, type NextFunction } from "express";
import { db, clubs, clubConfig, bookings, teeSlots } from "@teetimes/db";
import { eq, desc, sql, and, gte, lt, isNull, inArray } from "drizzle-orm";
import {
  getAuthPayload,
  canAccessClub,
  sendForbidden,
  sendUnauthorized,
} from "../lib/auth";

const router = Router({ mergeParams: true });

function paramClubId(req: Request): string | undefined {
  const raw = req.params.clubId;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

function requireClubAccess(req: Request, res: Response, next: NextFunction) {
  const clubId = paramClubId(req);
  if (!clubId) {
    res.status(400).json({ error: "clubId required" });
    return;
  }
  const payload = getAuthPayload(req);
  if (!payload) {
    sendUnauthorized(res);
    return;
  }
  if (!canAccessClub(payload.roles, clubId)) {
    sendForbidden(res);
    return;
  }
  next();
}

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

export default router;
