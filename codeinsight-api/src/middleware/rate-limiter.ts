import type { FastifyReply, FastifyRequest } from 'fastify';
import { SAFETY_LIMITS } from '../config/safety-limits.js';

interface RateLimitRecord {
  timestamps: number[];
}

export type RateLimitCategory = 'read' | 'analyzer' | 'correlation';

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Reset rate limit memory store (useful in tests).
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Extracts rate limit parameters based on category.
 */
function getCategoryLimits(category: RateLimitCategory) {
  switch (category) {
    case 'analyzer':
      return {
        windowSeconds: SAFETY_LIMITS.rateLimits.analyzerWindowSeconds,
        maxRequests: SAFETY_LIMITS.rateLimits.analyzerMaxRequests,
      };
    case 'correlation':
      return {
        windowSeconds: SAFETY_LIMITS.rateLimits.correlationWindowSeconds,
        maxRequests: SAFETY_LIMITS.rateLimits.correlationMaxRequests,
      };
    case 'read':
    default:
      return {
        windowSeconds: SAFETY_LIMITS.rateLimits.readWindowSeconds,
        maxRequests: SAFETY_LIMITS.rateLimits.readMaxRequests,
      };
  }
}

/**
 * Enforces sliding-window rate limits scoped to authenticated userId (or fallback IP).
 * Returns true if allowed, or sends HTTP 429 response and returns false if rate-limited.
 */
export function checkRateLimit(
  req: FastifyRequest,
  reply: FastifyReply,
  category: RateLimitCategory = 'read'
): boolean {
  // Extract userId from Clerk auth or fallback to IP
  const auth = (req as any).auth;
  const userId = auth?.userId || req.ip || 'anonymous';
  const key = `ratelimit:${userId}:${category}`;

  const now = Date.now();
  const { windowSeconds, maxRequests } = getCategoryLimits(category);
  const windowMs = windowSeconds * 1000;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  const currentCount = record.timestamps.length;
  const remaining = Math.max(0, maxRequests - currentCount - 1);
  const oldestTs = record.timestamps[0] || now;
  const resetTs = Math.ceil((oldestTs + windowMs) / 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));

  if (currentCount >= maxRequests) {
    reply.header('Retry-After', retryAfterSeconds);
    reply.header('X-RateLimit-Limit', maxRequests);
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', resetTs);

    reply.status(429).send({
      error: 'RATE_LIMITED',
      message: `Too many ${category} requests. Maximum allowed is ${maxRequests} per ${windowSeconds} seconds. Please try again later.`,
      retryAfterSeconds,
    });
    return false;
  }

  // Record timestamp
  record.timestamps.push(now);

  reply.header('X-RateLimit-Limit', maxRequests);
  reply.header('X-RateLimit-Remaining', remaining);
  reply.header('X-RateLimit-Reset', resetTs);

  return true;
}
