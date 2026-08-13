import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  inspectClonedRepositorySafety,
  RepositorySizeError,
} from '../analyzers/code/repository/repository-safety.js';
import { SAFETY_LIMITS } from '../config/safety-limits.js';
import {
  acquireConcurrencyLock,
  getActiveConcurrencyCount,
  releaseConcurrencyLock,
  resetConcurrencyStore,
} from '../middleware/concurrency-guard.js';
import { checkRateLimit, resetRateLimitStore } from '../middleware/rate-limiter.js';

describe('Phase 7.6 — Security, Rate Limiting & Resource Safety', () => {
  let tempTestDir: string;

  beforeEach(async () => {
    resetRateLimitStore();
    resetConcurrencyStore();
    tempTestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-safety-'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempTestDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Rate Limiter Unit & Scope Enforcement', () => {
    it('allows requests under the rate limit threshold', () => {
      const mockReq = { auth: { userId: 'user_1' }, ip: '127.0.0.1' } as any;
      const headers: Record<string, any> = {};
      const mockReply = {
        header: (k: string, v: any) => {
          headers[k] = v;
        },
        status: () => mockReply,
        send: () => mockReply,
      } as any;

      for (let i = 0; i < SAFETY_LIMITS.rateLimits.analyzerMaxRequests; i++) {
        const allowed = checkRateLimit(mockReq, mockReply, 'analyzer');
        assert.strictEqual(allowed, true);
      }
    });

    it('blocks requests exceeding the rate limit threshold with HTTP 429 and Retry-After header', () => {
      const mockReq = { auth: { userId: 'user_2' }, ip: '127.0.0.1' } as any;
      const headers: Record<string, any> = {};
      let statusCode = 0;
      let responseBody: any = null;

      const mockReply = {
        header: (k: string, v: any) => {
          headers[k] = v;
        },
        status: (code: number) => {
          statusCode = code;
          return mockReply;
        },
        send: (body: any) => {
          responseBody = body;
          return mockReply;
        },
      } as any;

      // Exhaust quota (5 requests)
      for (let i = 0; i < SAFETY_LIMITS.rateLimits.analyzerMaxRequests; i++) {
        checkRateLimit(mockReq, mockReply, 'analyzer');
      }

      // 6th request triggers rate limit
      const allowed = checkRateLimit(mockReq, mockReply, 'analyzer');
      assert.strictEqual(allowed, false);
      assert.strictEqual(statusCode, 429);
      assert.ok(headers['Retry-After'] > 0);
      assert.strictEqual(headers['X-RateLimit-Remaining'], 0);
      assert.strictEqual(responseBody.error, 'RATE_LIMITED');
      assert.ok(typeof responseBody.retryAfterSeconds === 'number');
    });

    it('scopes rate limits strictly by userId so user_A does not consume user_B quota', () => {
      const mockReqA = { auth: { userId: 'user_A' } } as any;
      const mockReqB = { auth: { userId: 'user_B' } } as any;
      const dummyReply = {
        header: () => {},
        status: () => dummyReply,
        send: () => dummyReply,
      } as any;

      // Exhaust User A quota
      for (let i = 0; i < SAFETY_LIMITS.rateLimits.analyzerMaxRequests; i++) {
        checkRateLimit(mockReqA, dummyReply, 'analyzer');
      }
      assert.strictEqual(checkRateLimit(mockReqA, dummyReply, 'analyzer'), false);

      // User B must still be allowed
      assert.strictEqual(checkRateLimit(mockReqB, dummyReply, 'analyzer'), true);
    });
  });

  describe('Concurrency Guard & Lock Lifecycle', () => {
    it('caps concurrent operations per user and releases deterministically', () => {
      const key = 'concurrency:user_123:analysis';
      const maxAllowed = SAFETY_LIMITS.concurrency.maxConcurrentAnalysisPerUser; // 2

      assert.strictEqual(acquireConcurrencyLock(key, maxAllowed), true);
      assert.strictEqual(acquireConcurrencyLock(key, maxAllowed), true);

      // 3rd attempt exceeds cap
      assert.strictEqual(acquireConcurrencyLock(key, maxAllowed), false);
      assert.strictEqual(getActiveConcurrencyCount(key), 2);

      // Release one lock
      releaseConcurrencyLock(key);
      assert.strictEqual(getActiveConcurrencyCount(key), 1);

      // Subsequent attempt succeeds
      assert.strictEqual(acquireConcurrencyLock(key, maxAllowed), true);
    });

    it('cleans up locks completely without deadlocks or permanent locks', () => {
      const key = 'concurrency:user_456:correlation';

      assert.strictEqual(acquireConcurrencyLock(key, 1), true);
      assert.strictEqual(acquireConcurrencyLock(key, 1), false);

      releaseConcurrencyLock(key);
      assert.strictEqual(getActiveConcurrencyCount(key), 0);

      // Next acquisition succeeds after cleanup
      assert.strictEqual(acquireConcurrencyLock(key, 1), true);
    });
  });

  describe('Repository Size & Safety Limits', () => {
    it('passes inspection for small clean repository directories', async () => {
      await fs.promises.writeFile(path.join(tempTestDir, 'index.ts'), 'console.log("hello");');
      await fs.promises.mkdir(path.join(tempTestDir, 'src'));
      await fs.promises.writeFile(path.join(tempTestDir, 'src', 'app.ts'), 'export const a = 1;');

      const result = await inspectClonedRepositorySafety(tempTestDir);
      assert.strictEqual(result.totalFilesScanned, 2);
      assert.ok(result.totalSourceBytes > 0);
    });

    it('ignores node_modules and .git folders so they do not inflate file counts', async () => {
      // Create valid file
      await fs.promises.writeFile(path.join(tempTestDir, 'index.ts'), 'const x = 1;');

      // Create ignored node_modules with 100 dummy files
      const nodeModulesDir = path.join(tempTestDir, 'node_modules');
      await fs.promises.mkdir(nodeModulesDir);
      for (let i = 0; i < 50; i++) {
        await fs.promises.writeFile(
          path.join(nodeModulesDir, `pkg_${i}.js`),
          'module.exports = {};'
        );
      }

      const result = await inspectClonedRepositorySafety(tempTestDir);
      assert.strictEqual(result.totalFilesScanned, 1); // Only index.ts scanned!
    });

    it('rejects repository when total file count exceeds maxFiles limit (HTTP 413 equivalent)', async () => {
      // Create maxFiles + 1 dummy source files
      for (let i = 0; i <= SAFETY_LIMITS.repository.maxFiles; i++) {
        await fs.promises.writeFile(path.join(tempTestDir, `file_${i}.ts`), 'const x = 1;');
      }

      await assert.rejects(
        async () => {
          await inspectClonedRepositorySafety(tempTestDir);
        },
        (err: any) => err instanceof RepositorySizeError && err.statusCode === 413
      );
    });

    it('rejects individual file exceeding maxFileBytes (1MB)', async () => {
      const hugeFileBytes = SAFETY_LIMITS.repository.maxFileBytes + 1024;
      const buffer = Buffer.alloc(hugeFileBytes, 'a');
      await fs.promises.writeFile(path.join(tempTestDir, 'huge.ts'), buffer);

      await assert.rejects(
        async () => {
          await inspectClonedRepositorySafety(tempTestDir);
        },
        (err: any) =>
          err instanceof RepositorySizeError &&
          /Individual file size limit exceeded/.test(err.message)
      );
    });
  });
});
