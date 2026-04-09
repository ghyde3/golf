import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  addDays,
  eachDayOfInterval,
  format,
  startOfDay,
  subDays,
} from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { desc, eq, inArray } from "drizzle-orm";
import * as schema from "./schema/index";
import {
  bookingPlayers,
  bookings,
  clubConfig,
  clubs,
  courses,
  teeSlots,
} from "./schema/index";
import { resolveConfig, resolveHours } from "./seed/configResolverForSeed";
import { generateSlots } from "./seed/slotGenForSeed";

type DrizzleDB = PostgresJsDatabase<typeof schema>;

/** Past window (days before today, inclusive of today’s calendar day in local time). */
export const PINEBROOK_SEED_PAST_DAYS = 21;
/** Future window (days after today, inclusive). */
export const PINEBROOK_SEED_FUTURE_DAYS = 7;

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function effFrom(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function bookingRefFromSeq(clubSlug: string, seq: number): string {
  const prefix = clubSlug.replace(/-/g, "").slice(0, 4).toUpperCase();
  let n = seq;
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[n % CHARSET.length];
    n = Math.floor(n / CHARSET.length);
  }
  return `${prefix}-${code}`;
}

const FIRST_NAMES = [
  "James",
  "Maria",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "David",
  "Patricia",
  "William",
  "Elizabeth",
  "Richard",
  "Susan",
  "Thomas",
  "Jessica",
  "Daniel",
  "Sarah",
  "Matthew",
  "Karen",
  "Andrew",
  "Nancy",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Wilson",
  "Anderson",
  "Taylor",
  "Thomas",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Thompson",
  "White",
];

function pickPlayersCount(rand: () => number, holes: number): number {
  const r = rand();
  if (holes === 9) {
    if (r < 0.38) return 2;
    if (r < 0.62) return 4;
    if (r < 0.82) return 3;
    return 1;
  }
  if (r < 0.44) return 4;
  if (r < 0.69) return 2;
  if (r < 0.88) return 3;
  return 1;
}

function slotFillProbability(
  rand: () => number,
  hourEt: number,
  dayOfWeek: number,
  courseIndex: number,
  courseCount: number
): number {
  let p = 0.11;
  if (dayOfWeek === 0 || dayOfWeek === 6) p += 0.14;
  if (hourEt >= 6 && hourEt <= 9) p += 0.2;
  else if (hourEt >= 10 && hourEt <= 11) p += 0.09;
  else if (hourEt >= 12 && hourEt <= 13) p += 0.06;
  else if (hourEt >= 14 && hourEt <= 16) p += 0.04;
  if (courseIndex === 0) p += 0.06;
  if (courseCount > 2 && courseIndex >= 2) p -= 0.03;
  p += (rand() - 0.5) * 0.06;
  return Math.min(0.82, Math.max(0.04, p));
}

async function clearPinebrookTeeSlotsAndBookings(db: DrizzleDB, clubId: string) {
  const courseRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.clubId, clubId));
  const courseIds = courseRows.map((c) => c.id);
  if (courseIds.length === 0) return;

  const existingSlots = await db
    .select({ id: teeSlots.id })
    .from(teeSlots)
    .where(inArray(teeSlots.courseId, courseIds));

  const slotIds = existingSlots.map((s) => s.id);
  if (slotIds.length === 0) return;

  const bookingRows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(inArray(bookings.teeSlotId, slotIds));

  const bookingIds = bookingRows.map((b) => b.id);
  if (bookingIds.length > 0) {
    await db
      .delete(bookingPlayers)
      .where(inArray(bookingPlayers.bookingId, bookingIds));
    await db.delete(bookings).where(inArray(bookings.id, bookingIds));
  }
  await db.delete(teeSlots).where(inArray(teeSlots.id, slotIds));
}

/**
 * Pinebrook only: tee slots + guest bookings from (today − 21) through (today + 7) in local time.
 * Dates are computed when the seed runs.
 */
export async function seedPinebrookBookings(db: DrizzleDB, clubId: string) {
  const club = await db.query.clubs.findFirst({
    where: eq(clubs.id, clubId),
    with: {
      courses: true,
      configs: { orderBy: [desc(clubConfig.effectiveFrom)] },
    },
  });

  if (!club || club.slug !== "pinebrook") {
    console.warn("seedPinebrookBookings: pinebrook club not found, skipping");
    return;
  }
  if (club.courses.length === 0) return;

  await clearPinebrookTeeSlotsAndBookings(db, clubId);

  const anchor = startOfDay(new Date());
  const rangeStart = subDays(anchor, PINEBROOK_SEED_PAST_DAYS);
  const rangeEnd = addDays(anchor, PINEBROOK_SEED_FUTURE_DAYS);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const configRows = club.configs.map((c) => ({
    ...c,
    effectiveFrom: effFrom(c.effectiveFrom),
    slotIntervalMinutes: c.slotIntervalMinutes,
    openTime: c.openTime as string | null,
    closeTime: c.closeTime as string | null,
    schedule: c.schedule,
    timezone: c.timezone,
  }));

  const tz = configRows[0]?.timezone ?? "America/New_York";
  const slug = club.slug;
  const sortedCourses = [...club.courses].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  let refSeq = 5_000_000;
  let seedCounter = 50_001;

  for (const day of days) {
    const dateStr = format(day, "yyyy-MM-dd");
    const targetDate = new Date(dateStr + "T12:00:00Z");
    const config = resolveConfig(configRows, targetDate);
    const dayOfWeek = targetDate.getUTCDay();
    const hours = resolveHours(config, dayOfWeek);
    const slotInterval = config.slotIntervalMinutes ?? 10;

    const slotTimes = generateSlots(
      {
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        slotIntervalMinutes: slotInterval,
        timezone: tz,
      },
      dateStr
    );

    for (let ci = 0; ci < sortedCourses.length; ci++) {
      const course = sortedCourses[ci]!;
      const rand = rng(seedCounter++);

      for (const dt of slotTimes) {
        const hourEt = Number(formatInTimeZone(dt, tz, "H"));
        const fillP = slotFillProbability(
          rand,
          hourEt,
          dayOfWeek,
          ci,
          sortedCourses.length
        );
        if (rand() >= fillP) continue;

        const players = pickPlayersCount(rand, course.holes);
        const slotType = course.holes === 9 ? "9hole" : "18hole";
        const paymentStatus = rand() < 0.14 ? "paid" : "unpaid";

        const [slotRow] = await db
          .insert(teeSlots)
          .values({
            courseId: course.id,
            datetime: dt,
            maxPlayers: 4,
            bookedPlayers: players,
            status: "open",
            slotType,
          })
          .returning();

        if (!slotRow) continue;

        const ref = bookingRefFromSeq(slug, refSeq++);
        const guestName =
          FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] +
          " " +
          LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];

        const [bookingRow] = await db
          .insert(bookings)
          .values({
            bookingRef: ref,
            teeSlotId: slotRow.id,
            guestName,
            guestEmail: `guest+${ref.replace(/[^A-Z0-9]/gi, "")}@example.com`,
            playersCount: players,
            notes:
              rand() < 0.08
                ? "Riding, cart path only if wet."
                : rand() < 0.05
                  ? "First time visiting — meet at starter."
                  : null,
            status: "confirmed",
            paymentStatus,
          })
          .returning();

        if (!bookingRow) continue;

        for (let p = 0; p < players; p++) {
          const nm =
            FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] +
            " " +
            LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
          await db.insert(bookingPlayers).values({
            bookingId: bookingRow.id,
            name: nm,
            email:
              rand() < 0.35
                ? `${nm.split(" ")[0]!.toLowerCase()}@example.com`
                : null,
          });
        }
      }
    }
  }

  console.log(
    `seedPinebrookBookings: ${format(rangeStart, "yyyy-MM-dd")} → ${format(rangeEnd, "yyyy-MM-dd")} (${days.length} days, America/New_York slots)`
  );
}
