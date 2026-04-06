import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { eachDayOfInterval, addDays, startOfDay, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { eq, inArray, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { clubs, courses, teeSlots, clubConfig } from "./schema";
import { resolveConfig, resolveHours } from "./seed/configResolverForSeed";
import { generateSlots } from "./seed/slotGenForSeed";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

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

async function runSeedBookings() {
  console.log("Seeding booking density tee slots...");

  const club = await db.query.clubs.findFirst({
    where: eq(clubs.slug, "pinebrook"),
    with: { courses: true, configs: { orderBy: [desc(clubConfig.effectiveFrom)] } },
  });

  if (!club || club.courses.length === 0) {
    throw new Error("Run pnpm seed first (pinebrook club missing)");
  }

  const byName = Object.fromEntries(club.courses.map((c) => [c.name, c]));
  const champ = byName["The Championship"];
  const meadows = byName["The Meadows"];
  const pines = byName["The Pines"];
  const lakes = byName["The Lakes"];
  if (!champ || !meadows || !pines || !lakes) {
    throw new Error("Expected four seed courses on pinebrook");
  }

  const courseIds = [champ.id, meadows.id, pines.id, lakes.id];
  await db.delete(teeSlots).where(inArray(teeSlots.courseId, courseIds));

  const start = startOfDay(new Date());
  const end = addDays(start, 7);
  const days = eachDayOfInterval({ start, end });

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
  let seedCounter = 42;

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

    const rand = rng(seedCounter++);

    const inserts: {
      courseId: string;
      datetime: Date;
      maxPlayers: number;
      bookedPlayers: number;
      status: string;
      slotType: string;
    }[] = [];

    for (const dt of slotTimes) {
      const hourEt = Number(formatInTimeZone(dt, tz, "H"));
      const morning = hourEt < 10;

      for (const [course, meta] of [
        [champ, "champ"] as const,
        [meadows, "meadows"] as const,
        [pines, "pines"] as const,
        [lakes, "lakes"] as const,
      ]) {
        if (meta === "champ") {
          inserts.push({
            courseId: course.id,
            datetime: dt,
            maxPlayers: 4,
            bookedPlayers: 4,
            status: "open",
            slotType: "18hole",
          });
          continue;
        }

        if (meta === "meadows") {
          if (rand() < 0.14) {
            const booked = rand() < 0.5 ? 1 : 2;
            inserts.push({
              courseId: course.id,
              datetime: dt,
              maxPlayers: 4,
              bookedPlayers: booked,
              status: "open",
              slotType: "18hole",
            });
          }
          continue;
        }

        if (meta === "pines") {
          if (morning) {
            inserts.push({
              courseId: course.id,
              datetime: dt,
              maxPlayers: 4,
              bookedPlayers: 4,
              status: "open",
              slotType: "18hole",
            });
          } else if (rand() < 0.08) {
            inserts.push({
              courseId: course.id,
              datetime: dt,
              maxPlayers: 4,
              bookedPlayers: rand() < 0.5 ? 0 : 1,
              status: "open",
              slotType: "18hole",
            });
          }
          continue;
        }

        if (meta === "lakes") {
          const booked = Math.floor(rand() * 5);
          inserts.push({
            courseId: course.id,
            datetime: dt,
            maxPlayers: 4,
            bookedPlayers: booked,
            status: "open",
            slotType: "9hole",
          });
        }
      }
    }

    if (inserts.length > 0) {
      await db.insert(teeSlots).values(inserts);
    }
  }

  console.log("seed:bookings complete.");
  await client.end();
}

runSeedBookings().catch((err) => {
  console.error(err);
  process.exit(1);
});
