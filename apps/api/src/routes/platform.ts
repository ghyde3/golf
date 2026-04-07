import { Router } from "express";
import {
  db,
  users,
  clubs,
  clubConfig,
  bookings,
  userRoles,
  clubTagDefinitions,
  platformSettings,
  announcements,
  auditLog,
  invoices,
} from "@teetimes/db";
import { randomBytes } from "node:crypto";
import { eq, desc, asc, sql, and, gte, lt, isNull, or, ilike, inArray } from "drizzle-orm";
import {
  CreateClubSchema,
  PlatformClubPatchSchema,
  ClubTagDefinitionCreateSchema,
  ClubTagDefinitionPatchSchema,
  PlatformSettingValueSchema,
  CreateAnnouncementSchema,
  PatchAnnouncementSchema,
  PlatformUserPatchSchema,
  PlatformBillingSubscriptionPatchSchema,
  CreateInvoiceSchema,
  PlatformInvoicePatchSchema,
} from "@teetimes/validators";
import { authenticate, requireRole } from "../middleware/auth";
import { writeAuditLog } from "../lib/audit";

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

router.get("/audit-log", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const actionFilter =
    typeof req.query.action === "string" && req.query.action.trim() !== ""
      ? req.query.action.trim()
      : undefined;
  const actorIdFilter =
    typeof req.query.actorId === "string" && req.query.actorId.trim() !== ""
      ? req.query.actorId.trim()
      : undefined;
  /** Partial email match on joined actor (optional; supports audit UI search). */
  const actorEmailFilter =
    typeof req.query.actorEmail === "string" && req.query.actorEmail.trim() !== ""
      ? req.query.actorEmail.trim()
      : undefined;

  const parseIsoDate = (raw: unknown): Date | undefined => {
    if (typeof raw !== "string" || raw.trim() === "") return undefined;
    const d = new Date(raw.trim());
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const fromDate = parseIsoDate(req.query.from);
  const toDate = parseIsoDate(req.query.to);

  const conditions = [];
  if (actionFilter) conditions.push(eq(auditLog.action, actionFilter));
  if (actorIdFilter) conditions.push(eq(auditLog.actorId, actorIdFilter));
  if (actorEmailFilter) conditions.push(ilike(users.email, `%${actorEmailFilter}%`));
  if (fromDate) conditions.push(gte(auditLog.createdAt, fromDate));
  if (toDate) conditions.push(lt(auditLog.createdAt, toDate));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const listBase = db
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        actorName: users.name,
        actorEmail: users.email,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        meta: auditLog.meta,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.actorId, users.id));

    const rows = await (whereClause ? listBase.where(whereClause) : listBase)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const countBase = db
      .select({ c: sql<number>`count(*)::int` })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.actorId, users.id));
    const [{ c: total }] = await (whereClause ? countBase.where(whereClause) : countBase);

    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorName: r.actorName,
        actorEmail: r.actorEmail,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        meta: r.meta,
        createdAt: r.createdAt?.toISOString() ?? "",
      })),
      page,
      limit,
      total: total ?? 0,
    });
  } catch (e) {
    console.error("Platform audit log:", e);
    res.status(500).json({ error: "Internal server error" });
  }
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

router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(platformSettings);
    const settings: Record<string, unknown> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ settings });
  } catch (e) {
    console.error("Platform list settings:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/settings/:key", async (req, res) => {
  const { key } = req.params;
  const parsed = PlatformSettingValueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const now = new Date();
    const [row] = await db
      .insert(platformSettings)
      .values({
        key,
        value: parsed.data.value,
        updatedBy: auth.userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: parsed.data.value,
          updatedBy: auth.userId,
          updatedAt: now,
        },
      })
      .returning();

    if (!row) {
      res.status(500).json({ error: "Failed to save setting" });
      return;
    }

    res.json({
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    });
    void writeAuditLog({
      actorId: auth.userId,
      action: "settings.update",
      entityType: "setting",
      entityId: key,
      meta: { value: parsed.data.value },
    }).catch(() => {});
  } catch (e) {
    console.error("Platform put setting:", e);
    res.status(500).json({ error: "Internal server error" });
  }
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

function serializeAnnouncementRow(row: typeof announcements.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience as "all" | "clubs" | "club_specific",
    clubId: row.clubId ?? null,
    status: row.status as "draft" | "active" | "archived",
    publishAt: row.publishAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

router.get("/announcements", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const rawStatus = req.query.status;
  const statusFilter =
    typeof rawStatus === "string" && ["draft", "active", "archived"].includes(rawStatus)
      ? rawStatus
      : undefined;

  try {
    const statusCond = statusFilter
      ? eq(announcements.status, statusFilter)
      : sql`true`;

    const rows = await db
      .select()
      .from(announcements)
      .where(statusCond)
      .orderBy(desc(announcements.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ c: total }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(announcements)
      .where(statusCond);

    res.json({
      announcements: rows.map(serializeAnnouncementRow),
      page,
      limit,
      total: total ?? 0,
    });
  } catch (e) {
    console.error("Platform list announcements:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/announcements", async (req, res) => {
  const parsed = CreateAnnouncementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { title, body, audience, clubId, status, publishAt } = parsed.data;
  try {
    const [row] = await db
      .insert(announcements)
      .values({
        title,
        body,
        audience,
        clubId: clubId ?? null,
        status: status ?? "draft",
        publishAt: publishAt ? new Date(publishAt) : null,
        createdBy: auth.userId,
      })
      .returning();

    if (!row) {
      res.status(500).json({ error: "Failed to create announcement" });
      return;
    }

    res.status(201).json(serializeAnnouncementRow(row));
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23503") {
      res.status(400).json({ error: "Invalid club reference" });
      return;
    }
    console.error("Platform create announcement:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/announcements/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = PatchAnnouncementSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const set: {
    title?: string;
    body?: string;
    audience?: string;
    clubId?: string | null;
    status?: string;
    publishAt?: Date | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (data.title !== undefined) set.title = data.title;
  if (data.body !== undefined) set.body = data.body;
  if (data.audience !== undefined) set.audience = data.audience;
  if (data.clubId !== undefined) set.clubId = data.clubId;
  if (data.status !== undefined) set.status = data.status;
  if (data.publishAt !== undefined) {
    set.publishAt = data.publishAt === null ? null : new Date(data.publishAt);
  }

  try {
    const [updated] = await db
      .update(announcements)
      .set(set)
      .where(eq(announcements.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }

    res.json(serializeAnnouncementRow(updated));
    void writeAuditLog({
      actorId: req.auth?.userId ?? null,
      action: "announcement.update",
      entityType: "announcement",
      entityId: id,
      meta: { changes: req.body as Record<string, unknown> },
    }).catch(() => {});
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23503") {
      res.status(400).json({ error: "Invalid club reference" });
      return;
    }
    console.error("Platform patch announcement:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/announcements/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Announcement not found" });
      return;
    }
    if (existing.status !== "draft") {
      res.status(409).json({ error: "Only draft announcements can be deleted" });
      return;
    }

    await db.delete(announcements).where(eq(announcements.id, id));
    res.status(204).send();
    void writeAuditLog({
      actorId: req.auth?.userId ?? null,
      action: "announcement.delete",
      entityType: "announcement",
      entityId: id,
    }).catch(() => {});
  } catch (e) {
    console.error("Platform delete announcement:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search =
      typeof req.query.search === "string" && req.query.search.trim() !== ""
        ? req.query.search.trim()
        : undefined;

    const searchCond = search
      ? or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`))
      : undefined;

    const countBase = db.select({ c: sql<number>`count(*)::int` }).from(users);
    const [{ c: total }] = await (searchCond ? countBase.where(searchCond) : countBase);

    const listBase = db.select().from(users);
    const userRows = await (searchCond ? listBase.where(searchCond) : listBase)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const userIds = userRows.map((u) => u.id);
    const roleRows =
      userIds.length === 0
        ? []
        : await db
            .select({
              userId: userRoles.userId,
              role: userRoles.role,
              clubId: userRoles.clubId,
              clubName: clubs.name,
            })
            .from(userRoles)
            .leftJoin(clubs, eq(userRoles.clubId, clubs.id))
            .where(inArray(userRoles.userId, userIds));

    const rolesByUser = new Map<
      string,
      { role: string; clubId: string | null; clubName: string | null }[]
    >();
    for (const r of roleRows) {
      const list = rolesByUser.get(r.userId) ?? [];
      list.push({
        role: r.role,
        clubId: r.clubId,
        clubName: r.clubName ?? null,
      });
      rolesByUser.set(r.userId, list);
    }

    res.json({
      users: userRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.deletedAt ? "suspended" : "active",
        roles: rolesByUser.get(u.id) ?? [],
        createdAt: u.createdAt?.toISOString() ?? "",
      })),
      page,
      limit,
      total: total ?? 0,
    });
  } catch (e) {
    console.error("Platform list users:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const parsed = PlatformUserPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.role !== undefined && parsed.data.role !== "platform_admin") {
    res.status(400).json({
      error: "Only platform_admin can be assigned via this endpoint",
    });
    return;
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      if (parsed.data.status !== undefined) {
        await tx
          .update(users)
          .set({
            deletedAt: parsed.data.status === "suspended" ? new Date() : null,
          })
          .where(eq(users.id, userId));
      }

      if (parsed.data.role === "platform_admin") {
        const row = await tx.query.userRoles.findFirst({
          where: and(
            eq(userRoles.userId, userId),
            eq(userRoles.role, "platform_admin"),
            isNull(userRoles.clubId)
          ),
        });
        if (!row) {
          await tx.insert(userRoles).values({
            userId,
            role: "platform_admin",
            clubId: null,
          });
        }
      }
    });

    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updatedAt = new Date().toISOString();
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.deletedAt ? "suspended" : "active",
      updatedAt,
    });
    void writeAuditLog({
      actorId: req.auth?.userId ?? null,
      action: "user.update",
      entityType: "user",
      entityId: userId,
      meta: { changes: req.body as Record<string, unknown> },
    }).catch(() => {});
  } catch (e) {
    console.error("Platform patch user:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

function formatInvoiceDate(d: unknown): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "string") return d.slice(0, 10);
  return String(d);
}

router.get("/billing/overview", async (_req, res) => {
  try {
    const [{ totalRevenueCents }] = await db
      .select({
        totalRevenueCents: sql<number>`coalesce(sum(${invoices.amountCents}), 0)::int`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    const [{ paidInvoicesCount }] = await db
      .select({
        paidInvoicesCount: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paid"));

    const [{ pendingAmountCents }] = await db
      .select({
        pendingAmountCents: sql<number>`coalesce(sum(${invoices.amountCents}), 0)::int`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ["draft", "sent"]));

    const [{ activeClubsCount }] = await db
      .select({
        activeClubsCount: sql<number>`count(*)::int`,
      })
      .from(clubs)
      .where(eq(clubs.status, "active"));

    const monthlyResult = await db.execute(sql`
      SELECT to_char(date_trunc('month', period_start), 'YYYY-MM') AS month,
             coalesce(sum(amount_cents), 0)::int AS "amountCents",
             count(*)::int AS count
      FROM invoices
      WHERE status = 'paid'
      GROUP BY date_trunc('month', period_start)
      ORDER BY date_trunc('month', period_start) DESC
      LIMIT 12
    `);

    const monthlyBreakdown = Array.from(
      monthlyResult as Iterable<Record<string, unknown>>
    ).map((r) => ({
      month: String(r.month),
      amountCents: Number(r.amountCents),
      count: Number(r.count),
    }));

    res.json({
      totalRevenueCents: totalRevenueCents ?? 0,
      paidInvoicesCount: paidInvoicesCount ?? 0,
      pendingAmountCents: pendingAmountCents ?? 0,
      activeClubsCount: activeClubsCount ?? 0,
      monthlyBreakdown,
    });
  } catch (e) {
    console.error("Platform billing overview:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/billing/subscriptions", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: clubs.id,
        name: clubs.name,
        slug: clubs.slug,
        status: clubs.status,
        subscriptionType: clubs.subscriptionType,
        bookingFee: clubs.bookingFee,
        stripeCustomerId: clubs.stripeCustomerId,
        stripeSubscriptionId: clubs.stripeSubscriptionId,
      })
      .from(clubs)
      .orderBy(asc(clubs.name));

    res.json({
      clubs: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status ?? "active",
        subscriptionType: c.subscriptionType ?? "trial",
        bookingFee: c.bookingFee != null ? String(c.bookingFee) : "0",
        stripeCustomerId: c.stripeCustomerId ?? null,
        stripeSubscriptionId: c.stripeSubscriptionId ?? null,
      })),
    });
  } catch (e) {
    console.error("Platform billing subscriptions:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/billing/subscriptions/:clubId", async (req, res) => {
  const { clubId } = req.params;
  const parsed = PlatformBillingSubscriptionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const set: {
    subscriptionType?: string;
    bookingFee?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  } = {};
  if (data.subscriptionType !== undefined) set.subscriptionType = data.subscriptionType;
  if (data.bookingFee !== undefined) set.bookingFee = data.bookingFee;
  if (data.stripeCustomerId !== undefined) set.stripeCustomerId = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) set.stripeSubscriptionId = data.stripeSubscriptionId;

  try {
    const [updated] = await db
      .update(clubs)
      .set(set)
      .where(eq(clubs.id, clubId))
      .returning({
        id: clubs.id,
        name: clubs.name,
        slug: clubs.slug,
        status: clubs.status,
        subscriptionType: clubs.subscriptionType,
        bookingFee: clubs.bookingFee,
        stripeCustomerId: clubs.stripeCustomerId,
        stripeSubscriptionId: clubs.stripeSubscriptionId,
      });

    if (!updated) {
      res.status(404).json({ error: "Club not found" });
      return;
    }

    res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status ?? "active",
      subscriptionType: updated.subscriptionType ?? "trial",
      bookingFee: updated.bookingFee != null ? String(updated.bookingFee) : "0",
      stripeCustomerId: updated.stripeCustomerId ?? null,
      stripeSubscriptionId: updated.stripeSubscriptionId ?? null,
    });
  } catch (e) {
    console.error("Platform patch billing subscription:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const clubIdFilter =
    typeof req.query.clubId === "string" && req.query.clubId.trim() !== ""
      ? req.query.clubId.trim()
      : undefined;
  const statusFilter =
    typeof req.query.status === "string" &&
    ["draft", "sent", "paid", "void"].includes(req.query.status)
      ? req.query.status
      : undefined;

  const conditions = [];
  if (clubIdFilter) conditions.push(eq(invoices.clubId, clubIdFilter));
  if (statusFilter) conditions.push(eq(invoices.status, statusFilter));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const listBase = db
      .select({
        id: invoices.id,
        clubId: invoices.clubId,
        clubName: clubs.name,
        periodStart: invoices.periodStart,
        periodEnd: invoices.periodEnd,
        amountCents: invoices.amountCents,
        status: invoices.status,
        stripeInvoiceId: invoices.stripeInvoiceId,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .innerJoin(clubs, eq(invoices.clubId, clubs.id));

    const rows = await (whereClause ? listBase.where(whereClause) : listBase)
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);

    const countBase = db
      .select({ c: sql<number>`count(*)::int` })
      .from(invoices)
      .innerJoin(clubs, eq(invoices.clubId, clubs.id));
    const [{ c: total }] = await (whereClause ? countBase.where(whereClause) : countBase);

    res.json({
      invoices: rows.map((r) => ({
        id: r.id,
        clubId: r.clubId,
        clubName: r.clubName,
        periodStart: formatInvoiceDate(r.periodStart),
        periodEnd: formatInvoiceDate(r.periodEnd),
        amountCents: r.amountCents,
        status: r.status,
        stripeInvoiceId: r.stripeInvoiceId ?? null,
        createdAt: r.createdAt?.toISOString() ?? "",
        updatedAt: r.updatedAt?.toISOString() ?? "",
      })),
      page,
      limit,
      total: total ?? 0,
    });
  } catch (e) {
    console.error("Platform list invoices:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices", async (req, res) => {
  const parsed = CreateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { clubId, periodStart, periodEnd, amountCents } = parsed.data;

  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
  });
  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  try {
    const now = new Date();
    const [row] = await db
      .insert(invoices)
      .values({
        clubId,
        periodStart,
        periodEnd,
        amountCents,
        status: "draft",
        updatedAt: now,
      })
      .returning();

    if (!row) {
      res.status(500).json({ error: "Failed to create invoice" });
      return;
    }

    res.status(201).json({
      id: row.id,
      clubId: row.clubId,
      clubName: club.name,
      periodStart: formatInvoiceDate(row.periodStart),
      periodEnd: formatInvoiceDate(row.periodEnd),
      amountCents: row.amountCents,
      status: row.status,
      stripeInvoiceId: row.stripeInvoiceId ?? null,
      createdAt: row.createdAt?.toISOString() ?? "",
      updatedAt: row.updatedAt?.toISOString() ?? "",
    });
  } catch (e) {
    console.error("Platform create invoice:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/invoices/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = PlatformInvoicePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const set: {
    status?: string;
    stripeInvoiceId?: string | null;
    amountCents?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (data.status !== undefined) set.status = data.status;
  if (data.stripeInvoiceId !== undefined) set.stripeInvoiceId = data.stripeInvoiceId;
  if (data.amountCents !== undefined) set.amountCents = data.amountCents;

  try {
    const [updated] = await db
      .update(invoices)
      .set(set)
      .where(eq(invoices.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, updated.clubId),
    });

    res.json({
      id: updated.id,
      clubId: updated.clubId,
      clubName: club?.name ?? "",
      periodStart: formatInvoiceDate(updated.periodStart),
      periodEnd: formatInvoiceDate(updated.periodEnd),
      amountCents: updated.amountCents,
      status: updated.status,
      stripeInvoiceId: updated.stripeInvoiceId ?? null,
      createdAt: updated.createdAt?.toISOString() ?? "",
      updatedAt: updated.updatedAt?.toISOString() ?? "",
    });
  } catch (e) {
    console.error("Platform patch invoice:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices/:id/void", async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
    });
    if (!existing) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (existing.status === "void" || existing.status === "paid") {
      res.status(409).json({ error: "Invoice cannot be voided" });
      return;
    }

    const now = new Date();
    const [updated] = await db
      .update(invoices)
      .set({ status: "void", updatedAt: now })
      .where(eq(invoices.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, updated.clubId),
    });

    res.json({
      id: updated.id,
      clubId: updated.clubId,
      clubName: club?.name ?? "",
      periodStart: formatInvoiceDate(updated.periodStart),
      periodEnd: formatInvoiceDate(updated.periodEnd),
      amountCents: updated.amountCents,
      status: updated.status,
      stripeInvoiceId: updated.stripeInvoiceId ?? null,
      createdAt: updated.createdAt?.toISOString() ?? "",
      updatedAt: updated.updatedAt?.toISOString() ?? "",
    });
  } catch (e) {
    console.error("Platform void invoice:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/reset-password", async (req, res) => {
  const { userId } = req.params;

  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += alphabet[buf[i]! % alphabet.length]!;
  }

  const expiresAt = Date.now() + 3600000;
  const key = `reset_token:${userId}`;
  const value = { token, expiresAt };

  try {
    await db
      .insert(platformSettings)
      .values({
        key,
        value,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value,
          updatedAt: new Date(),
        },
      });

    res.json({
      message: "Password reset link sent",
      token,
    });
  } catch (e) {
    console.error("Platform reset password:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
