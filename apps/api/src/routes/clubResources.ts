import { Router, type Request } from "express";

type ClubParams = { clubId: string; courseId?: string };

function clubParams(req: Request): ClubParams {
  return req.params as ClubParams;
}
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import {
  db,
  clubConfig,
  courses,
  teeSlots,
  users,
  userRoles,
} from "@teetimes/db";
import {
  ClubConfigSchema,
  CourseSchema,
  CoursePatchSchema,
  StaffInviteSchema,
  TeeSheetBlockSchema,
} from "@teetimes/validators";
import { authenticate, requireClubAccess, requireClubRole } from "../middleware/auth";
import { buildTeesheetGrid } from "../lib/teesheetGrid";
import { enqueueEmail } from "../lib/queue";
import { signInviteToken } from "../lib/jwt";

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(requireClubAccess);

function effFrom(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

router.get("/config", async (req, res) => {
  const clubId = clubParams(req).clubId;
  const rows = await db.query.clubConfig.findMany({
    where: eq(clubConfig.clubId, clubId),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });
  res.json(
    rows.map((c) => ({
      id: c.id,
      effectiveFrom: effFrom(c.effectiveFrom),
      slotIntervalMinutes: c.slotIntervalMinutes,
      bookingWindowDays: c.bookingWindowDays,
      cancellationHours: c.cancellationHours,
      openTime: c.openTime,
      closeTime: c.closeTime,
      schedule: c.schedule,
      timezone: c.timezone,
      primaryColor: c.primaryColor,
    }))
  );
});

router.post(
  "/config",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = clubParams(req).clubId;
    const parsed = ClubConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const latest = await db.query.clubConfig.findFirst({
      where: eq(clubConfig.clubId, clubId),
      orderBy: [desc(clubConfig.effectiveFrom)],
    });

    if (latest && parsed.data.effectiveFrom <= effFrom(latest.effectiveFrom)) {
      res.status(400).json({
        error: "effectiveFrom must be after the latest existing config date",
      });
      return;
    }

    const [row] = await db
      .insert(clubConfig)
      .values({
        clubId,
        effectiveFrom: parsed.data.effectiveFrom,
        slotIntervalMinutes: parsed.data.slotIntervalMinutes,
        bookingWindowDays: parsed.data.bookingWindowDays,
        cancellationHours: parsed.data.cancellationHours,
        openTime: parsed.data.openTime,
        closeTime: parsed.data.closeTime,
        schedule: parsed.data.schedule ?? null,
        timezone: parsed.data.timezone,
      })
      .returning();

    res.status(201).json({
      id: row.id,
      effectiveFrom: effFrom(row.effectiveFrom),
    });
  }
);

router.get("/courses", async (req, res) => {
  const clubId = clubParams(req).clubId;
  const rows = await db.query.courses.findMany({
    where: eq(courses.clubId, clubId),
    orderBy: [asc(courses.name)],
  });
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      holes: c.holes,
    }))
  );
});

router.post(
  "/courses",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = clubParams(req).clubId;
    const parsed = CourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }
    const [row] = await db
      .insert(courses)
      .values({
        clubId,
        name: parsed.data.name,
        holes: parsed.data.holes,
      })
      .returning();
    res.status(201).json({ id: row.id, name: row.name, holes: row.holes });
  }
);

router.patch(
  "/courses/:courseId",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const { clubId, courseId: cid } = clubParams(req);
    const courseId = String(cid);
    const parsed = CoursePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
    });
    if (!course || course.clubId !== clubId) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const [updated] = await db
      .update(courses)
      .set(parsed.data)
      .where(eq(courses.id, courseId))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      holes: updated.holes,
    });
  }
);

router.get("/courses/:courseId/teesheet", async (req, res) => {
  const { clubId, courseId: cid } = clubParams(req);
  const courseId = String(cid);
  const date = req.query.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "date query (YYYY-MM-DD) is required" });
    return;
  }

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
  });
  if (!course || course.clubId !== clubId) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  try {
    const grid = await buildTeesheetGrid(clubId, courseId, date);
    res.json(grid);
  } catch (e) {
    if ((e as Error).message === "NO_CONFIG") {
      res.status(404).json({ error: "Club config not found" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/teesheet/block",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = clubParams(req).clubId;
    const parsed = TeeSheetBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const course = await db.query.courses.findFirst({
      where: eq(courses.id, parsed.data.courseId),
    });
    if (!course || course.clubId !== clubId) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const dt = new Date(parsed.data.datetime);
    const maxP = parsed.data.maxPlayers ?? 4;

    const existing = await db.query.teeSlots.findFirst({
      where: and(
        eq(teeSlots.courseId, parsed.data.courseId),
        eq(teeSlots.datetime, dt)
      ),
    });

    if (existing) {
      const [row] = await db
        .update(teeSlots)
        .set({ status: "blocked", maxPlayers: maxP })
        .where(eq(teeSlots.id, existing.id))
        .returning();
      res.json({ id: row.id, status: row.status });
      return;
    }

    const [row] = await db
      .insert(teeSlots)
      .values({
        courseId: parsed.data.courseId,
        datetime: dt,
        maxPlayers: maxP,
        bookedPlayers: 0,
        status: "blocked",
      })
      .returning();

    res.status(201).json({ id: row.id, status: row.status });
  }
);

router.get("/staff", async (req, res) => {
  const clubId = clubParams(req).clubId;
  const rows = await db.query.userRoles.findMany({
    where: and(
      eq(userRoles.clubId, clubId),
      inArray(userRoles.role, ["staff", "club_admin"])
    ),
    with: { user: true },
    orderBy: [asc(userRoles.role)],
  });
  res.json(
    rows.map((r) => ({
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      role: r.role,
      pending: r.user.passwordHash === null,
    }))
  );
});

router.post(
  "/staff/invite",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = clubParams(req).clubId;
    const parsed = StaffInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const email = parsed.data.email.toLowerCase().trim();
    const role = parsed.data.role;

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      const dup = await db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, existing.id),
          eq(userRoles.clubId, clubId),
          eq(userRoles.role, role)
        ),
      });
      if (!dup) {
        await db.insert(userRoles).values({
          userId: existing.id,
          clubId,
          role,
        });
      }
      return res.json({ ok: true, existing: true });
    }

    const [u] = await db
      .insert(users)
      .values({ email, name: null, passwordHash: null })
      .returning();

    await db.insert(userRoles).values({
      userId: u.id,
      clubId,
      role,
    });

    const token = signInviteToken(u.id);
    await enqueueEmail("email:staff-invite", { email, token });

    res.status(201).json({ ok: true, existing: false });
  }
);

export default router;
