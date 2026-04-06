import Redis from "ioredis";

let shared: Redis | null = null;

/**
 * Shared Redis connection for cache + BullMQ.
 * BullMQ expects maxRetriesPerRequest: null on the ioredis instance used by workers.
 */
export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!shared) {
    shared = new Redis(url, { maxRetriesPerRequest: null });
  }
  return shared;
}
