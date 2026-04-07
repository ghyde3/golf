import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clubs, clubConfig, courses, teeSlots } from "./schema";
import { users, userRoles } from "./schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const PINEBROOK_COURSE_NAMES = [
  "The Championship",
  "The Meadows",
  "The Pines",
  "The Lakes",
] as const;

/** Merge tee_slots onto the kept course row and delete duplicate course rows (same club + name). */
async function dedupeCoursesByName(clubId: string, names: readonly string[]) {
  for (const name of names) {
    const rows = await db
      .select()
      .from(courses)
      .where(and(eq(courses.clubId, clubId), eq(courses.name, name)))
      .orderBy(asc(courses.id));
    if (rows.length <= 1) continue;
    const keeper = rows[0]!;
    const dupeIds = rows.slice(1).map((r) => r.id);
    await db
      .update(teeSlots)
      .set({ courseId: keeper.id })
      .where(inArray(teeSlots.courseId, dupeIds));
    await db.delete(courses).where(inArray(courses.id, dupeIds));
  }
}

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
      city: "Ridgewood",
      state: "NJ",
      latitude: 40.9799,
      longitude: -74.1099,
      heroImageUrl: "/pinebrook.png",
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

  await dedupeCoursesByName(clubId, PINEBROOK_COURSE_NAMES);

  const existingPinebrookCourses = await db.query.courses.findMany({
    where: eq(courses.clubId, clubId),
  });
  if (existingPinebrookCourses.length === 0) {
    const courseData = [
      { clubId, name: "The Championship", holes: 18 },
      { clubId, name: "The Meadows", holes: 18 },
      { clubId, name: "The Pines", holes: 18 },
      { clubId, name: "The Lakes", holes: 9 },
    ];
    for (const c of courseData) {
      await db.insert(courses).values(c);
    }
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

  function courseRowsForCount(
    count: 1 | 2 | 3 | 4,
    variant: number
  ): { name: string; holes: number }[] {
    if (count === 1) return [{ name: "Main Course", holes: 18 }];
    if (count === 2) {
      return variant % 2 === 0
        ? [
            { name: "North", holes: 18 },
            { name: "South", holes: 18 },
          ]
        : [
            { name: "Championship", holes: 18 },
            { name: "Executive", holes: 9 },
          ];
    }
    if (count === 3) {
      return [
        { name: "East", holes: 18 },
        { name: "West", holes: 18 },
        { name: "Executive Nine", holes: 9 },
      ];
    }
    return [
      { name: "The Championship", holes: 18 },
      { name: "The Meadows", holes: 18 },
      { name: "The Pines", holes: 18 },
      { name: "The Lakes", holes: 9 },
    ];
  }

  const extraClubs: {
    name: string;
    slug: string;
    description: string;
    courseCount: 1 | 2 | 3 | 4;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  }[] = [
    {
      name: "Riverbend Golf Club",
      slug: "riverbend",
      description:
        "Riverside layout with forgiving fairways and a strong finishing stretch.",
      courseCount: 2,
      city: "Doylestown",
      state: "PA",
      latitude: 40.346,
      longitude: -75.1307,
    },
    {
      name: "Oak Ridge Country Club",
      slug: "oak-ridge",
      description:
        "Private club with tree-lined holes and fast, subtle greens.",
      courseCount: 3,
      city: "Greenwich",
      state: "CT",
      latitude: 41.0262,
      longitude: -73.6282,
    },
    {
      name: "Sunset Valley Links",
      slug: "sunset-valley",
      description: "Open links-style course that plays firm and fast in the wind.",
      courseCount: 2,
      city: "Hyannis",
      state: "MA",
      latitude: 41.6688,
      longitude: -70.2962,
    },
    {
      name: "Maplewood Golf & Country",
      slug: "maplewood",
      description: "Family-friendly club with a compact executive loop.",
      courseCount: 1,
      city: "White Plains",
      state: "NY",
      latitude: 41.0534,
      longitude: -73.8688,
    },
    {
      name: "Cypress Point Municipal",
      slug: "cypress-point",
      description: "Affordable daily-fee course serving the local community.",
      courseCount: 2,
      city: "Edison",
      state: "NJ",
      latitude: 40.5187,
      longitude: -74.4121,
    },
    {
      name: "Eagle Ridge Resort",
      slug: "eagle-ridge",
      description:
        "Destination resort with multiple routing options and stay-and-play packages.",
      courseCount: 4,
      city: "Stroudsburg",
      state: "PA",
      latitude: 41.0534,
      longitude: -75.3496,
    },
    {
      name: "Willow Creek Golf Club",
      slug: "willow-creek",
      description: "Parkland design with water in play on half the holes.",
      courseCount: 3,
      city: "Fairfield",
      state: "CT",
      latitude: 41.1415,
      longitude: -73.2637,
    },
    {
      name: "Highland Park Golf Club",
      slug: "highland-park",
      description: "Hilly terrain with elevated tees and panoramic views.",
      courseCount: 2,
      city: "Poughkeepsie",
      state: "NY",
      latitude: 41.7004,
      longitude: -73.9209,
    },
  ];

  for (let i = 0; i < extraClubs.length; i++) {
    const ec = extraClubs[i];
    const [row] = await db
      .insert(clubs)
      .values({
        name: ec.name,
        slug: ec.slug,
        description: ec.description,
        city: ec.city,
        state: ec.state,
        latitude: ec.latitude,
        longitude: ec.longitude,
        heroImageUrl: `/${ec.slug}.png`,
      })
      .onConflictDoNothing({ target: clubs.slug })
      .returning();

    const cid =
      row?.id ??
      (await db.query.clubs.findFirst({ where: eq(clubs.slug, ec.slug) }))!.id;

    await db
      .insert(clubConfig)
      .values({
        clubId: cid,
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

    const existingN = await db.query.courses.findMany({
      where: eq(courses.clubId, cid),
    });
    if (existingN.length === 0) {
      const rows = courseRowsForCount(ec.courseCount, i);
      for (const c of rows) {
        await db.insert(courses).values({ clubId: cid, ...c });
      }
    }
  }

  // Ensure location columns are set when clubs already existed (idempotent)
  const locationBySlug: Record<
    string,
    { city: string; state: string; latitude: number; longitude: number }
  > = {
    pinebrook: {
      city: "Ridgewood",
      state: "NJ",
      latitude: 40.9799,
      longitude: -74.1099,
    },
    riverbend: {
      city: "Doylestown",
      state: "PA",
      latitude: 40.346,
      longitude: -75.1307,
    },
    "oak-ridge": {
      city: "Greenwich",
      state: "CT",
      latitude: 41.0262,
      longitude: -73.6282,
    },
    "sunset-valley": {
      city: "Hyannis",
      state: "MA",
      latitude: 41.6688,
      longitude: -70.2962,
    },
    maplewood: {
      city: "White Plains",
      state: "NY",
      latitude: 41.0534,
      longitude: -73.8688,
    },
    "cypress-point": {
      city: "Edison",
      state: "NJ",
      latitude: 40.5187,
      longitude: -74.4121,
    },
    "eagle-ridge": {
      city: "Stroudsburg",
      state: "PA",
      latitude: 41.0534,
      longitude: -75.3496,
    },
    "willow-creek": {
      city: "Fairfield",
      state: "CT",
      latitude: 41.1415,
      longitude: -73.2637,
    },
    "highland-park": {
      city: "Poughkeepsie",
      state: "NY",
      latitude: 41.7004,
      longitude: -73.9209,
    },
  };

  for (const [slug, loc] of Object.entries(locationBySlug)) {
    await db.update(clubs).set(loc).where(eq(clubs.slug, slug));
  }

  const heroBySlug: Record<string, string> = {
    pinebrook: "/pinebrook.png",
    riverbend: "/riverbend.png",
    "oak-ridge": "/oak-ridge.png",
    "sunset-valley": "/sunset-valley.png",
    maplewood: "/maplewood.png",
    "cypress-point": "/cypress-point.png",
    "eagle-ridge": "/eagle-ridge.png",
    "willow-creek": "/willow-creek.png",
    "highland-park": "/highland-park.png",
  };
  for (const [slug, heroImageUrl] of Object.entries(heroBySlug)) {
    await db.update(clubs).set({ heroImageUrl }).where(eq(clubs.slug, slug));
  }

  console.log("Seed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
