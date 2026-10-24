import { redis } from '../lib/redis';
import { config } from '../config';

/**
 * Redis-based per-sender hourly rate limiter.
 * Uses INCR with EXPIRE for atomic counting.
 * Key format: ratelimit:{sender}:{hourWindow}
 * hourWindow = floor(timestamp / 3600000) to get the hour bucket.
 */

function getHourWindow(timestamp?: number): number {
  const ts = timestamp || Date.now();
  return Math.floor(ts / 3600000);
}

function getRateLimitKey(sender: string, hourWindow: number): string {
  return `ratelimit:${sender}:${hourWindow}`;
}

/**
 * Try to increment the sender's count for the current hour.
 * Returns { allowed, currentCount, limit }.
 * If not allowed, returns the next available hour window timestamp.
 */
export async function checkAndIncrementRateLimit(
  sender: string,
  limit?: number
): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  nextAvailableMs?: number;
}> {
  const effectiveLimit = limit || config.maxEmailsPerHourPerSender;
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(sender, hourWindow);

  // Atomic: get current count first
  const current = await redis.get(key);
  const currentCount = current ? parseInt(current, 10) : 0;

  if (currentCount >= effectiveLimit) {
    // Calculate when the next hour window starts
    const nextWindowStart = (hourWindow + 1) * 3600000;
    return {
      allowed: false,
      currentCount,
      limit: effectiveLimit,
      nextAvailableMs: nextWindowStart,
    };
  }

  // Atomic increment
  const newCount = await redis.incr(key);

  // If this is the first increment, set expiry to 2 hours (buffer)
  if (newCount === 1) {
    await redis.expire(key, 7200);
  }

  // Double-check: if another worker beat us and we went over limit
  if (newCount > effectiveLimit) {
    // We incremented past the limit, but we won't undo (it'll expire).
    // The job should be delayed instead.
    const nextWindowStart = (hourWindow + 1) * 3600000;
    return {
      allowed: false,
      currentCount: newCount,
      limit: effectiveLimit,
      nextAvailableMs: nextWindowStart,
    };
  }

  return {
    allowed: true,
    currentCount: newCount,
    limit: effectiveLimit,
  };
}

/**
 * Check if a rate-limit notification has already been sent for this sender+hour.
 * Returns true if notification was already sent.
 * If not, marks it as sent and returns false.
 */
export async function checkAndMarkRateLimitNotification(
  sender: string
): Promise<boolean> {
  const hourWindow = getHourWindow();
  const key = `ratelimit_notified:${sender}:${hourWindow}`;

  // SETNX returns 1 if set, 0 if already existed
  const result = await redis.setnx(key, '1');
  if (result === 1) {
    await redis.expire(key, 7200);
    return false; // Not previously notified
  }
  return true; // Already notified this hour
}

/**
 * Find the next available hour window for a sender that has capacity.
 * Scans ahead up to 24 hours.
 */
export async function findNextAvailableWindow(
  sender: string,
  limit: number
): Promise<number> {
  const now = Date.now();
  const currentHour = getHourWindow(now);

  for (let offset = 1; offset <= 24; offset++) {
    const futureHour = currentHour + offset;
    const key = getRateLimitKey(sender, futureHour);
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count, 10) : 0;

    if (currentCount < limit) {
      return futureHour * 3600000; // Return the start of that window in ms
    }
  }

  // Fallback: 24 hours from now
  return now + 24 * 3600000;
}
