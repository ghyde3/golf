import { Router } from "express";
import bcrypt from "bcrypt";
import { eq, and, isNull, inArray, asc } from "drizzle-orm";
import { db, users, clubs } from "@teetimes/db";
import { LoginSchema } from "@teetimes/validators";
import { signToken } from "../lib/jwt";
import {
  getAuthPayload,
  sendUnauthorized,
  hasPlatformAdmin,
} from "../lib/auth";

const router = Router();

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
