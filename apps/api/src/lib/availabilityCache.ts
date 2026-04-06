import { getRedis } from "./redis";

export const AVAILABILITY_CACHE_TTL_SECONDS = 30;

export type CachedAvailabilitySlot = {
  id: string | null;
  datetime: string;
  maxPlayers: number;
  bookedPlayers: number;
  status: string;
  price: number | null;
  slotType: string;
};

export type AvailabilityCacheVariant = number | "full";

function key(
  clubId: string,
  courseId: string,
  date: string,
  variant: AvailabilityCacheVariant
) {
  const suffix = variant === "full" ? "full" : `p${variant}`;
  return `availability:${clubId}:${courseId}:${date}:${suffix}`;
}

export async function getCachedAvailability(
  clubId: string,
  courseId: string,
  date: string,
  variant: AvailabilityCacheVariant
): Promise<CachedAvailabilitySlot[] | null> {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get(key(clubId, courseId, date, variant));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedAvailabilitySlot[];
  } catch {
    return null;
  }
}

export async function setCachedAvailability(
  clubId: string,
  courseId: string,
  date: string,
  variant: AvailabilityCacheVariant,
  slots: CachedAvailabilitySlot[]
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(
    key(clubId, courseId, date, variant),
    JSON.stringify(slots),
    "EX",
    AVAILABILITY_CACHE_TTL_SECONDS
  );
}

export async function invalidateAvailabilityCache(
  clubId: string,
  courseId: string,
  date: string
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const pattern = `availability:${clubId}:${courseId}:${date}:*`;
  let cursor = "0";
  do {
    const [next, keys] = await r.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100
    );
    cursor = next;
    if (keys.length > 0) await r.del(...keys);
  } while (cursor !== "0");
}
