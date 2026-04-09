import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, inArray, like } from "drizzle-orm";
import * as schema from "./schema/index";
import {
  bookings,
  clubs,
  courseHoles,
  courses,
  roundScorecardHoles,
  roundScorecards,
  teeSlots,
  users,
} from "./schema/index";

type DrizzleDB = PostgresJsDatabase<typeof schema>;

/** Synthetic bookings for dev reports — removed and recreated on each `pnpm seed`. */
const SEED_REF_PREFIX = "PBKSC-";

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function strokesForPar(rand: () => number, par: number): number {
  const r = rand();
  let delta: number;
  if (r < 0.04) delta = -2;
  else if (r < 0.14) delta = -1;
  else if (r < 0.48) delta = 0;
  else if (r < 0.8) delta = 1;
  else if (r < 0.95) delta = 2;
  else delta = 3;
  return Math.max(1, par + delta);
}

async function removePriorSeedBookings(db: DrizzleDB, clubId: string) {
  const rows = await db
    .select({
      bookingId: bookings.id,
      teeSlotId: bookings.teeSlotId,
    })
    .from(bookings)
    .innerJoin(teeSlots, eq(bookings.teeSlotId, teeSlots.id))
    .innerJoin(courses, eq(teeSlots.courseId, courses.id))
    .where(
      and(eq(courses.clubId, clubId), like(bookings.bookingRef, `${SEED_REF_PREFIX}%`))
    );

  if (rows.length === 0) return;

  const bookingIds = rows.map((r) => r.bookingId);
  const slotIds = [...new Set(rows.map((r) => r.teeSlotId).filter(Boolean))] as string[];

  await db.delete(bookings).where(inArray(bookings.id, bookingIds));
  if (slotIds.length > 0) {
    await db.delete(teeSlots).where(inArray(teeSlots.id, slotIds));
  }
}

/**
 * Inserts ~70–90 past rounds with scorecards for Pinebrook (one booking + scorecard per round).
 * Tee times are in the past so club scorecard reports include them.
 */
export async function seedPinebrookScorecards(db: DrizzleDB) {
  const club = await db.query.clubs.findFirst({
    where: eq(clubs.slug, "pinebrook"),
  });
  if (!club) {
    console.warn("seedPinebrookScorecards: pinebrook club not found, skipping");
    return;
  }

  const scorer = await db.query.users.findFirst({
    where: eq(users.email, "admin@teetimes.dev"),
  });
  if (!scorer) {
    console.warn("seedPinebrookScorecards: admin@teetimes.dev not found, skipping");
    return;
  }

  await removePriorSeedBookings(db, club.id);

  const clubCourses = await db.query.courses.findMany({
    where: eq(courses.clubId, club.id),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
  if (clubCourses.length === 0) return;

  const holesByCourseId = new Map<
    string,
    { holeNumber: number; par: number }[]
  >();
  for (const c of clubCourses) {
    const rows = await db.query.courseHoles.findMany({
      where: eq(courseHoles.courseId, c.id),
      orderBy: (h, { asc }) => [asc(h.holeNumber)],
    });
    holesByCourseId.set(
      c.id,
      rows.map((r) => ({ holeNumber: r.holeNumber, par: r.par }))
    );
  }

  const rand = rng(42_001);
  const totalRounds = 70 + Math.floor(rand() * 21);

  let seq = 1;
  const now = Date.now();

  for (let i = 0; i < totalRounds; i++) {
    const course = clubCourses[Math.floor(rand() * clubCourses.length)]!;
    const holesMeta = holesByCourseId.get(course.id) ?? [];
    if (holesMeta.length === 0) {
      console.warn(
        `seedPinebrookScorecards: no course_holes for ${course.name}, skipping round`
      );
      continue;
    }

    const daysAgo = 1 + Math.floor(rand() * 110);
    const minuteOfDay = 7 * 60 + Math.floor(rand() * (12 * 60));
    const teeTime = new Date(now - daysAgo * 86400000 - minuteOfDay * 60000);

    const slotType = course.holes === 9 ? "9hole" : "18hole";
    const [slot] = await db
      .insert(teeSlots)
      .values({
        courseId: course.id,
        datetime: teeTime,
        maxPlayers: 4,
        bookedPlayers: 1 + Math.floor(rand() * 3),
        status: "open",
        slotType,
      })
      .returning();

    if (!slot) continue;

    const ref = `${SEED_REF_PREFIX}${String(seq++).padStart(5, "0")}`;
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingRef: ref,
        teeSlotId: slot.id,
        userId: scorer.id,
        guestName: "Seed Golfer",
        guestEmail: "seed@example.com",
        playersCount: 1,
        status: "confirmed",
        source: "online_guest",
      })
      .returning();

    if (!booking) continue;

    let totalScore = 0;
    const holeScores: { holeNumber: number; score: number }[] = [];
    for (const h of holesMeta) {
      const score = strokesForPar(rand, h.par);
      totalScore += score;
      holeScores.push({ holeNumber: h.holeNumber, score });
    }

    const [scRow] = await db
      .insert(roundScorecards)
      .values({
        bookingId: booking.id,
        userId: scorer.id,
        courseId: course.id,
        totalScore,
        completedHoles: holesMeta.length,
      })
      .returning();

    if (!scRow) continue;

    for (const hs of holeScores) {
      await db.insert(roundScorecardHoles).values({
        scorecardId: scRow.id,
        holeNumber: hs.holeNumber,
        score: hs.score,
      });
    }
  }

  console.log(
    `seedPinebrookScorecards: inserted ${totalRounds} synthetic past rounds (ref ${SEED_REF_PREFIX}*)`
  );
}
