import { Queue } from "bullmq";
import Redis from "ioredis";

let emailQueue: Queue | null = null;

function createBullConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for BullMQ");
  }
  return new Redis(url, { maxRetriesPerRequest: null });
}

export function getEmailQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!emailQueue) {
    emailQueue = new Queue("email", { connection: createBullConnection() });
  }
  return emailQueue;
}

export async function enqueueEmail(
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  const q = getEmailQueue();
  if (!q) return;
  await q.add(name, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
  });
}

let bookingQueue: Queue | null = null;

export function getBookingQueue(): Queue | null {
  if (!process.env.REDIS_URL) return null;
  if (!bookingQueue) {
    bookingQueue = new Queue("booking", { connection: createBullConnection() });
  }
  return bookingQueue;
}

export async function enqueueBookingJob(
  name: string,
  data: Record<string, unknown>,
  opts?: { delay?: number }
): Promise<void> {
  const q = getBookingQueue();
  if (!q) return;
  await q.add(name, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    delay: opts?.delay,
  });
}
