import { Router } from "express";
import bcrypt from "bcrypt";
import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import { db, users, clubs, userRoles } from "@teetimes/db";
import { LoginSchema, RegisterSchema, SetPasswordSchema } from "@teetimes/validators";
import {
  signToken,
  verifyInviteToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from "../lib/jwt";
import { enqueueEmail } from "../lib/queue";
import { publicRateLimit } from "../middleware/rateLimit";
import {
  getAuthPayload,
  sendUnauthorized,
  hasPlatformAdmin,
} from "../lib/auth";
const router = Router();

router.post("/set-password", async (req, res) => {
  const parsed = SetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  try {
    let userId: string;
    try {
      ({ userId } = verifyPasswordResetToken(parsed.data.token));
    } catch {
      ({ userId } = verifyInviteToken(parsed.data.token));
    }
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const [updated] = await db
      .update(users)
      .set({ passwordHash: hash })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

router.post("/forgot-password", publicRateLimit, async (req, res) => {
  const parsed = LoginSchema.pick({ email: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
  });
  if (user) {
    const token = signPasswordResetToken(user.id);
    await enqueueEmail("email:password-reset", { userId: user.id, token });
  }
  res.json({ ok: true });
});

router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)),
    with: { roles: true },
  });

  if (!user?.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const roles = user.roles.map((r) => ({
    role: r.role as "platform_admin" | "club_admin" | "staff" | "golfer",
    clubId: r.clubId,
  }));

  const token = signToken({ userId: user.id, roles });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
    },
  });
});

router.post("/register", publicRateLimit, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { name, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: and(eq(users.email, email), isNull(users.deletedAt)),
  });
  if (existing) {
    res.status(409).json({ code: "EMAIL_TAKEN" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const roles: { role: "golfer"; clubId: null }[] = [
    { role: "golfer", clubId: null },
  ];

  try {
    const result = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email, name, passwordHash })
        .returning();
      if (!u) {
        throw new Error("User insert failed");
      }
      await tx.insert(userRoles).values({
        userId: u.id,
        role: "golfer",
        clubId: null,
      });
      return u;
    });

    const token = signToken({ userId: result.id, roles });

    res.status(201).json({
      token,
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        roles,
      },
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (
      err.code === "23505" ||
      (typeof err.message === "string" && err.message.toLowerCase().includes("unique"))
    ) {
      res.status(409).json({ code: "EMAIL_TAKEN" });
      return;
    }
    console.error("Register:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", (req, res) => {
  const payload = getAuthPayload(req);
  if (!payload) {
    sendUnauthorized(res);
    return;
  }
  res.json(payload);
});

router.get("/context", async (req, res) => {
  const payload = getAuthPayload(req);
  if (!payload) {
    sendUnauthorized(res);
    return;
  }

  const clubIds = [
    ...new Set(
      payload.roles
        .filter(
          (r) =>
            (r.role === "club_admin" || r.role === "staff") && r.clubId !== null
        )
        .map((r) => r.clubId as string)
    ),
  ];

  let clubRows: { id: string; name: string; slug: string }[] = [];
  if (clubIds.length > 0) {
    clubRows = await db.query.clubs.findMany({
      where: inArray(clubs.id, clubIds),
      columns: { id: true, name: true, slug: true },
    });
  }

  if (hasPlatformAdmin(payload.roles) && clubRows.length === 0) {
    clubRows = await db.query.clubs.findMany({
      columns: { id: true, name: true, slug: true },
      orderBy: [asc(clubs.name)],
      limit: 50,
    });
  }

  res.json({
    isPlatformAdmin: hasPlatformAdmin(payload.roles),
    clubs: clubRows,
  });
});

export default router;
