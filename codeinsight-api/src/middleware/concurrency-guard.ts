import type { FastifyReply, FastifyRequest } from 'fastify';
import { SAFETY_LIMITS } from '../config/safety-limits.js';

export type ConcurrencyCategory = 'analysis' | 'correlation';

const activeConcurrencyLocks = new Map<string, number>();

/**
 * Reset concurrency memory store (useful in tests).
 */
export function resetConcurrencyStore(): void {
  activeConcurrencyLocks.clear();
}

/**
 * Gets active concurrency lock count for a given key.
 */
export function getActiveConcurrencyCount(key: string): number {
  return activeConcurrencyLocks.get(key) || 0;
}

/**
 * Attempts to acquire an in-process concurrency lock for a key.
 * Returns true if lock acquired, or false if concurrency limit exceeded.
 */
export function acquireConcurrencyLock(key: string, maxAllowed: number): boolean {
  const current = activeConcurrencyLocks.get(key) || 0;
  if (current >= maxAllowed) {
    return false;
  }
  activeConcurrencyLocks.set(key, current + 1);
  return true;
}

/**
 * Releases an in-process concurrency lock for a key.
 */
export function releaseConcurrencyLock(key: string): void {
  const current = activeConcurrencyLocks.get(key) || 0;
  if (current <= 1) {
    activeConcurrencyLocks.delete(key);
  } else {
    activeConcurrencyLocks.set(key, current - 1);
  }
}

/**
 * Enforces in-process concurrency limits per authenticated user.
 * Returns lock key string if lock acquired, or sends HTTP 429 response and returns null if locked.
 */
export function checkConcurrencyGuard(
  req: FastifyRequest,
  reply: FastifyReply,
  category: ConcurrencyCategory = 'analysis'
): string | null {
  const auth = (req as any).auth;
  const userId = auth?.userId || req.ip || 'anonymous';
  const lockKey = `concurrency:${userId}:${category}`;

  const maxAllowed =
    category === 'correlation'
      ? SAFETY_LIMITS.concurrency.maxConcurrentCorrelationPerUser
      : SAFETY_LIMITS.concurrency.maxConcurrentAnalysisPerUser;

  const acquired = acquireConcurrencyLock(lockKey, maxAllowed);
  if (!acquired) {
    reply.header('Retry-After', 10);
    reply.status(429).send({
      error: 'CONCURRENCY_LIMIT_EXCEEDED',
      message: `An ${category} operation is already running for your account. Please wait for it to complete.`,
      retryAfterSeconds: 10,
    });
    return null;
  }

  return lockKey;
}
