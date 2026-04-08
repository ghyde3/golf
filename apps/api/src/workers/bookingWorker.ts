import { Worker } from "bullmq";
import Redis from "ioredis";
import { eq, and, isNull, sql, asc } from "drizzle-orm";
import { db, bookings, teeSlots, waitlistEntries, failedJobs } from "@teetimes/db";
import { enqueueEmail } from "../lib/queue";

function bullConnection(): Redis {
  return new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
}

async function handleAutoNoShow(bookingId: string): Promise<void> {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: {
      players: true,
      teeSlot: { with: { course: { with: { club: true } } } },
    },
  });

  if (!booking) return;
  if (booking.deletedAt) return;
  if (booking.status === "cancelled" || booking.status === "no_show") return;

  const anyCheckedIn = booking.players.some((p) => p.checkedIn);
  if (anyCheckedIn) return;

  await db
    .update(bookings)
    .set({ status: "no_show" })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "confirmed")));

  if (booking.teeSlotId) {
    await db
      .update(teeSlots)
      .set({
        bookedPlayers: sql`GREATEST(0, ${teeSlots.bookedPlayers} - ${booking.playersCount})`,
      })
      .where(eq(teeSlots.id, booking.teeSlotId));

    const nextEntry = await db.query.waitlistEntries.findFirst({
      where: and(
        eq(waitlistEntries.teeSlotId, booking.teeSlotId),
        isNull(waitlistEntries.notifiedAt)
      ),
      orderBy: [asc(waitlistEntries.createdAt)],
    });
    if (nextEntry) {
      await enqueueEmail("email:waitlist-notify", {
        waitlistEntryId: nextEntry.id,
      });
    }
  }
}

export function startBookingWorker(): void {
  if (!process.env.REDIS_URL) {
    console.warn("Booking worker disabled: REDIS_URL not set");
    return;
  }

  const worker = new Worker(
    "booking",
    async (job) => {
      if (job.name === "booking:auto-noshow") {
        await handleAutoNoShow(String(job.data.bookingId));
      }
    },
    { connection: bullConnection(), concurrency: 5 }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    try {
      await db.insert(failedJobs).values({
        jobName: job.name,
        jobData: job.data as object,
        error: err?.message ?? "unknown error",
      });
    } catch {
      // ignore duplicate logging failures
    }
  });

  worker.on("error", (err) => console.error("booking worker error", err));
  console.log("Booking worker started");
}
