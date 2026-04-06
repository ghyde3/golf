import { db } from "@teetimes/db";
import { bookings, clubConfig, teeSlots } from "@teetimes/db";
import { eq, desc, and, gte, lte, inArray, isNull } from "drizzle-orm";
import { resolveConfig, resolveHours } from "./configResolver";
import { generateSlots } from "./slotGenerator";
import type { CachedAvailabilitySlot } from "./availabilityCache";

function effFrom(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).slice(0, 10);
}

export async function buildTeesheetGrid(
  clubId: string,
  courseId: string,
  dateStr: string
): Promise<CachedAvailabilitySlot[]> {
  const configs = await db.query.clubConfig.findMany({
    where: eq(clubConfig.clubId, clubId),
    orderBy: [desc(clubConfig.effectiveFrom)],
  });

  if (configs.length === 0) {
    throw new Error("NO_CONFIG");
  }

  const targetDate = new Date(dateStr + "T12:00:00Z");
  const config = resolveConfig(
    configs.map((c) => ({
      ...c,
      effectiveFrom: effFrom(c.effectiveFrom),
      slotIntervalMinutes: c.slotIntervalMinutes,
      openTime: c.openTime as string | null,
      closeTime: c.closeTime as string | null,
      schedule: c.schedule,
      timezone: c.timezone,
    })),
    targetDate
  );

  const dayOfWeek = targetDate.getUTCDay();
  const hours = resolveHours(config, dayOfWeek);

  const generatedSlots = generateSlots(
    {
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      slotIntervalMinutes: config.slotIntervalMinutes ?? 10,
      timezone: config.timezone ?? "America/New_York",
    },
    dateStr
  );

  const startOfDay = new Date(dateStr + "T00:00:00Z");
  const endOfDay = new Date(dateStr + "T23:59:59Z");

  const dbSlots = await db.query.teeSlots.findMany({
    where: and(
      eq(teeSlots.courseId, courseId),
      gte(teeSlots.datetime, startOfDay),
      lte(teeSlots.datetime, endOfDay)
    ),
  });

  const dbSlotMap = new Map(
    dbSlots.map((s) => [s.datetime.toISOString(), s])
  );

  const merged: CachedAvailabilitySlot[] = [];

  for (const slot of generatedSlots) {
    const iso = slot.datetime.toISOString();
    const dbSlot = dbSlotMap.get(iso);
    if (dbSlot) {
      merged.push({
        id: dbSlot.id,
        datetime: dbSlot.datetime.toISOString(),
        maxPlayers: dbSlot.maxPlayers ?? 4,
        bookedPlayers: dbSlot.bookedPlayers ?? 0,
        status: dbSlot.status ?? "open",
        price: dbSlot.price ? Number(dbSlot.price) : null,
        slotType: dbSlot.slotType ?? "18hole",
      });
    } else {
      merged.push({
        id: null,
        datetime: iso,
        maxPlayers: slot.maxPlayers,
        bookedPlayers: slot.bookedPlayers,
        status: slot.status,
        price: slot.price,
        slotType: slot.slotType,
      });
    }
  }

  merged.sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  const slotIds = merged
    .map((m) => m.id)
    .filter((id): id is string => id != null);

  if (slotIds.length > 0) {
    const bookingRows = await db.query.bookings.findMany({
      where: and(
        inArray(bookings.teeSlotId, slotIds),
        isNull(bookings.deletedAt)
      ),
    });

    const bySlot = new Map<string, (typeof bookingRows)[0]>();
    for (const b of bookingRows) {
      if (b.teeSlotId && !bySlot.has(b.teeSlotId)) {
        bySlot.set(b.teeSlotId, b);
      }
    }

    for (const m of merged) {
      if (m.id && bySlot.has(m.id)) {
        const b = bySlot.get(m.id)!;
        m.bookingId = b.id;
        m.bookingRef = b.bookingRef;
      }
    }
  }

  return merged;
}
