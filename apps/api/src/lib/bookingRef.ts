import { eq } from "drizzle-orm";
import { bookings } from "@teetimes/db";
import type { DrizzleDB } from "@teetimes/db";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingRef(clubSlug: string): string {
  const prefix = clubSlug.replace(/-/g, "").slice(0, 4).toUpperCase();
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `${prefix}-${code}`;
}

type DbLike = Pick<DrizzleDB, "query">;

export async function generateUniqueBookingRef(
  clubSlug: string,
  dbLike: DbLike
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateBookingRef(clubSlug);
    const existing = await dbLike.query.bookings.findFirst({
      where: eq(bookings.bookingRef, ref),
      columns: { id: true },
    });
    if (!existing) return ref;
  }
  throw new Error("Could not generate unique booking reference");
}
