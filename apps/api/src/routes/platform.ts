import { Router } from "express";
import {
  db,
  clubs,
  clubConfig,
  bookings,
  userRoles,
  clubTagDefinitions,
} from "@teetimes/db";
import { eq, desc, asc, sql, and, gte, lt, isNull } from "drizzle-orm";
import {
  CreateClubSchema,
  PlatformClubPatchSchema,
  ClubTagDefinitionCreateSchema,
  ClubTagDefinitionPatchSchema,
} from "@teetimes/validators";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.use(requireRole("platform_admin"));

router.get("/stats", async (_req, res) => {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const [totalClubsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clubs);

  const [activeClubsRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clubs)
    .where(eq(clubs.status, "active"));

  const [bookingsTodayRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        isNull(bookings.deletedAt),
        gte(bookings.createdAt, dayStart),
        lt(bookings.createdAt, dayEnd)
      )
    );

  const [bookingsMonthRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(bookings)
    .where(
      and(
        isNull(bookings.deletedAt),
        gte(bookings.createdAt, monthStart),
        lt(bookings.createdAt, nextMonth)
      )
    );

  res.json({
    totalClubs: totalClubsRow?.c ?? 0,
    activeClubs: activeClubsRow?.c ?? 0,
    totalBookingsToday: bookingsTodayRow?.c ?? 0,
    totalBookingsThisMonth: bookingsMonthRow?.c ?? 0,
  });
});

router.get("/clubs", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const rows = await db.query.clubs.findMany({
    orderBy: [desc(clubs.createdAt)],
    limit,
    offset,
    with: {
      courses: true,
    },
  });

  const [{ c: total }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clubs);

  res.json({
    clubs: rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      createdAt: c.createdAt?.toISOString() ?? null,
      coursesCount: c.courses.length,
    })),
    page,
    limit,
    total: total ?? 0,
  });
});

router.post("/clubs", async (req, res) => {
  const parsed = CreateClubSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { name, slug, timezone, description, heroImageUrl } = parsed.data;
  const effectiveFrom = new Date().toISOString().split("T")[0];

  try {
    const result = await db.transaction(async (tx) => {
      const [club] = await tx
        .insert(clubs)
        .values({
          name,
          slug,
          description: description ?? null,
          status: "active",
          heroImageUrl: heroImageUrl ?? null,
        })
        .returning();

      await tx.insert(clubConfig).values({
        clubId: club.id,
        effectiveFrom,
        timezone,
        slotIntervalMinutes: 10,
        bookingWindowDays: 14,
        cancellationHours: 24,
        openTime: "06:00",
        closeTime: "18:00",
      });

      return club;
    });

    res.status(201).json({
      id: result.id,
      name: result.name,
      slug: result.slug,
      status: result.status,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      res.status(409).json({ error: "A club with this slug already exists" });
      return;
    }
    console.error("Create club:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/clubs/:clubId", async (req, res) => {
  const { clubId } = req.params;
  const parsed = PlatformClubPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const patch: { status?: string; heroImageUrl?: string | null } = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.heroImageUrl !== undefined) patch.heroImageUrl = parsed.data.heroImageUrl;

  const [updated] = await db
    .update(clubs)
    .set(patch)
    .where(eq(clubs.id, clubId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  res.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    status: updated.status,
    heroImageUrl: updated.heroImageUrl,
  });
});

router.get("/clubs/:clubId", async (req, res) => {
  const { clubId } = req.params;

  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
    with: {
      configs: { orderBy: [desc(clubConfig.effectiveFrom)] },
      courses: true,
    },
  });

  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  const staffRows = await db.query.userRoles.findMany({
    where: eq(userRoles.clubId, clubId),
    with: { user: true },
  });

  res.json({
    id: club.id,
    name: club.name,
    slug: club.slug,
    status: club.status,
    description: club.description,
    heroImageUrl: club.heroImageUrl,
    createdAt: club.createdAt?.toISOString() ?? null,
    subscriptionType: club.subscriptionType,
    bookingFee: club.bookingFee != null ? String(club.bookingFee) : null,
    courses: club.courses.map((c) => ({
      id: c.id,
      name: c.name,
      holes: c.holes,
    })),
    configs: club.configs.map((cfg) => ({
      id: cfg.id,
      effectiveFrom: cfg.effectiveFrom,
      slotIntervalMinutes: cfg.slotIntervalMinutes,
      bookingWindowDays: cfg.bookingWindowDays,
      timezone: cfg.timezone,
      primaryColor: cfg.primaryColor,
      cancellationHours: cfg.cancellationHours,
      openTime: cfg.openTime,
      closeTime: cfg.closeTime,
    })),
    staff: staffRows.map((r) => ({
      userId: r.userId,
      role: r.role,
      name: r.user?.name,
      email: r.user?.email,
    })),
  });
});

router.get("/tags", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(clubTagDefinitions)
      .orderBy(asc(clubTagDefinitions.sortOrder), asc(clubTagDefinitions.slug));
    res.json({
      tags: rows.map((t) => ({
        id: t.id,
        slug: t.slug,
        label: t.label,
        sortOrder: t.sortOrder,
        groupName: t.groupName,
        active: t.active,
        createdAt: t.createdAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error("Platform list tags:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tags", async (req, res) => {
  const parsed = ClubTagDefinitionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { slug, label, sortOrder, groupName, active } = parsed.data;
  try {
    const [row] = await db
      .insert(clubTagDefinitions)
      .values({
        slug,
        label,
        sortOrder: sortOrder ?? 0,
        groupName: groupName ?? null,
        active: active ?? true,
      })
      .returning();
    if (!row) {
      res.status(500).json({ error: "Failed to create tag" });
      return;
    }
    res.status(201).json({
      id: row.id,
      slug: row.slug,
      label: row.label,
      sortOrder: row.sortOrder,
      groupName: row.groupName,
      active: row.active,
      createdAt: row.createdAt?.toISOString() ?? null,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      res.status(409).json({ error: "A tag with this slug already exists" });
      return;
    }
    console.error("Platform create tag:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/tags/:tagId", async (req, res) => {
  const { tagId } = req.params;
  const parsed = ClubTagDefinitionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  try {
    const [updated] = await db
      .update(clubTagDefinitions)
      .set(patch)
      .where(eq(clubTagDefinitions.id, tagId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json({
      id: updated.id,
      slug: updated.slug,
      label: updated.label,
      sortOrder: updated.sortOrder,
      groupName: updated.groupName,
      active: updated.active,
      createdAt: updated.createdAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("Platform patch tag:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
