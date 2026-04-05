import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clubs, clubConfig, courses } from "./schema";
import { users, userRoles } from "./schema";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding database...");

  // Create club
  const [club] = await db
    .insert(clubs)
    .values({
      name: "Pinebrook Golf Club",
      slug: "pinebrook",
      description:
        "A classic 18-hole parkland layout with four distinct courses.",
    })
    .onConflictDoNothing({ target: clubs.slug })
    .returning();

  const clubId =
    club?.id ??
    (await db.query.clubs.findFirst({ where: eq(clubs.slug, "pinebrook") }))!
      .id;

  console.log(`Club: ${clubId}`);

  // Create club config
  await db
    .insert(clubConfig)
    .values({
      clubId,
      effectiveFrom: "2024-01-01",
      slotIntervalMinutes: 10,
      bookingWindowDays: 14,
      cancellationHours: 24,
      openTime: "06:00",
      closeTime: "18:00",
      schedule: [
        { dayOfWeek: 0, openTime: "05:30", closeTime: "19:00" },
        { dayOfWeek: 6, openTime: "05:30", closeTime: "19:00" },
      ],
      timezone: "America/New_York",
    })
    .onConflictDoNothing();

  // Create courses
  const courseData = [
    { clubId, name: "The Championship", holes: 18 },
    { clubId, name: "The Meadows", holes: 18 },
    { clubId, name: "The Pines", holes: 18 },
    { clubId, name: "The Lakes", holes: 9 },
  ];

  for (const c of courseData) {
    await db.insert(courses).values(c).onConflictDoNothing();
  }

  // Create users — dev-only password for all seeded accounts: `devpass`
  const passwordHash =
    "$2b$10$U98sJqo9st.7iMFXFac/detsKGsmYGNXg4gO5ATPFj9hB0SKcsW5m";

  const userEntries = [
    { email: "admin@teetimes.dev", name: "Platform Admin" },
    { email: "owner@testclub.dev", name: "Club Owner" },
    { email: "staff@testclub.dev", name: "Staff Member" },
  ];

  for (const u of userEntries) {
    await db
      .insert(users)
      .values({ ...u, passwordHash })
      .onConflictDoNothing({ target: users.email });
  }

  const adminUser = await db.query.users.findFirst({
    where: eq(users.email, "admin@teetimes.dev"),
  });
  const ownerUser = await db.query.users.findFirst({
    where: eq(users.email, "owner@testclub.dev"),
  });
  const staffUser = await db.query.users.findFirst({
    where: eq(users.email, "staff@testclub.dev"),
  });

  if (adminUser) {
    await db
      .insert(userRoles)
      .values({ userId: adminUser.id, role: "platform_admin", clubId: null })
      .onConflictDoNothing();
  }
  if (ownerUser) {
    await db
      .insert(userRoles)
      .values({ userId: ownerUser.id, role: "club_admin", clubId })
      .onConflictDoNothing();
  }
  if (staffUser) {
    await db
      .insert(userRoles)
      .values({ userId: staffUser.id, role: "staff", clubId })
      .onConflictDoNothing();
  }

  console.log("Seed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
