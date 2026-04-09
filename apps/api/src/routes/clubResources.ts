import { Router, type Request } from "express";

type ClubParams = { clubId: string; courseId?: string };

function clubParams(req: Request): ClubParams {
  return req.params as ClubParams;
}
import { eq, desc, and, asc, inArray } from "drizzle-orm";
import {
  db,
  clubs,
  clubConfig,
  courseHoles,
  courses,
  teeSlots,
  users,
  userRoles,
  clubTagDefinitions,
  clubTagAssignments,
} from "@teetimes/db";
import {
  ClubConfigSchema,
  ClubProfilePatchSchema,
  ClubTagSlugsPutSchema,
  CourseSchema,
  CoursePatchSchema,
  HoleUpsertSchema,
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

router.get("/profile", async (req, res) => {
  const clubId = clubParams(req).clubId;
  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
    columns: {
      id: true,
      name: true,
      slug: true,
      heroImageUrl: true,
      bookingFee: true,
    },
  });
  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  res.json({
    id: club.id,
    name: club.name,
    slug: club.slug,
    heroImageUrl: club.heroImageUrl,
    bookingFee:
      club.bookingFee != null ? String(club.bookingFee) : null,
  });
});

router.patch(
  "/profile",
  requireClubRole(["club_admin"]),
  async (req, res) => {
    const clubId = clubParams(req).clubId;
    const parsed = ClubProfilePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const set: {
      heroImageUrl?: string | null;
      bookingFee?: string;
    } = {};
    if (parsed.data.heroImageUrl !== undefined) {
      set.heroImageUrl = parsed.data.heroImageUrl;
    }
    if (parsed.data.bookingFee !== undefined) {
      const v = parsed.data.bookingFee;
      set.bookingFee = typeof v === "number" ? v.toFixed(2) : v;
    }
    if (Object.keys(set).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(clubs)
      .set(set)
      .where(eq(clubs.id, clubId))
      .returning({
        id: clubs.id,
        heroImageUrl: clubs.heroImageUrl,
        bookingFee: clubs.bookingFee,
      });

    if (!updated) {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    res.json({
      id: updated.id,
      heroImageUrl: updated.heroImageUrl,
      bookingFee:
        updated.bookingFee != null ? String(updated.bookingFee) : null,
    });
  }
);

router.get("/tags", async (req, res) => {
  const clubId = clubParams(req).clubId;
  try {
    const catalog = await db
      .select({
        slug: clubTagDefinitions.slug,
        label: clubTagDefinitions.label,
        groupName: clubTagDefinitions.groupName,
        sortOrder: clubTagDefinitions.sortOrder,
      })
      .from(clubTagDefinitions)
      .where(eq(clubTagDefinitions.active, true))
      .orderBy(asc(clubTagDefinitions.sortOrder), asc(clubTagDefinitions.slug));

    const assignedRows = await db
      .select({
        slug: clubTagDefinitions.slug,
        label: clubTagDefinitions.label,
      })
      .from(clubTagAssignments)
      .innerJoin(
        clubTagDefinitions,
        eq(clubTagAssignments.tagId, clubTagDefinitions.id)
      )
      .where(
        and(
          eq(clubTagAssignments.clubId, clubId),
          eq(clubTagDefinitions.active, true)
        )
      )
      .orderBy(asc(clubTagDefinitions.sortOrder));

    res.json({
      catalog: catalog.map((c) => ({
        slug: c.slug,
        label: c.label,
        groupName: c.groupName,
        sortOrder: c.sortOrder,
      })),
      assigned: assignedRows.map((a) => ({ slug: a.slug, label: a.label })),
    });
  } catch (e) {
    console.error("Club GET tags:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put(
  "/tags",
  requireClubRole(["club_admin", "staff"]),
  async (req, res) => {
    const clubId = clubParams(req).clubId;
    const parsed = ClubTagSlugsPutSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }
    const { tagSlugs } = parsed.data;
    if (tagSlugs.length === 0) {
      await db
        .delete(clubTagAssignments)
        .where(eq(clubTagAssignments.clubId, clubId));
      res.json({ assigned: [] });
      return;
    }
    const defs = await db
      .select()
      .from(clubTagDefinitions)
      .where(
        and(
          eq(clubTagDefinitions.active, true),
          inArray(clubTagDefinitions.slug, tagSlugs)
        )
      );
    if (defs.length !== tagSlugs.length) {
      res.status(400).json({ error: "Unknown or inactive tag slug" });
      return;
    }
    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(clubTagAssignments)
          .where(eq(clubTagAssignments.clubId, clubId));
        await tx.insert(clubTagAssignments).values(
          defs.map((d) => ({ clubId, tagId: d.id }))
        );
      });
      res.json({
        assigned: defs.map((d) => ({ slug: d.slug, label: d.label })),
      });
    } catch (e) {
      console.error("Club PUT tags:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

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

router.put("/courses/:courseId/holes", async (req, res) => {
  const clubId = clubParams(req).clubId;
  const courseId = req.params.courseId;

  const course = await db.query.courses.findFirst({
    where: and(eq(courses.id, courseId), eq(courses.clubId, clubId)),
    columns: { id: true, holes: true },
  });
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const parsed = HoleUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const holeNumbers = parsed.data.map((h) => h.holeNumber);
  const maxHole = Math.max(...holeNumbers);
  if (maxHole > course.holes) {
    res.status(400).json({
      error: `Hole number ${maxHole} exceeds course length (${course.holes} holes)`,
    });
    return;
  }

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ holeNumber: courseHoles.holeNumber })
      .from(courseHoles)
      .where(eq(courseHoles.courseId, courseId));
    const existingNums = existing.map((h) => h.holeNumber);
    const toDelete = existingNums.filter((n) => !holeNumbers.includes(n));
    if (toDelete.length > 0) {
      await tx.delete(courseHoles).where(
        and(eq(courseHoles.courseId, courseId), inArray(courseHoles.holeNumber, toDelete))
      );
    }
    for (const hole of parsed.data) {
      await tx
        .insert(courseHoles)
        .values({
          courseId,
          holeNumber: hole.holeNumber,
          par: hole.par,
          handicapIndex: hole.handicapIndex ?? null,
          yardage: hole.yardage ?? null,
        })
        .onConflictDoUpdate({
          target: [courseHoles.courseId, courseHoles.holeNumber],
          set: {
            par: hole.par,
            handicapIndex: hole.handicapIndex ?? null,
            yardage: hole.yardage ?? null,
          },
        });
    }
  });

  const updated = await db
    .select()
    .from(courseHoles)
    .where(eq(courseHoles.courseId, courseId))
    .orderBy(asc(courseHoles.holeNumber));
  res.json(updated);
});

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
