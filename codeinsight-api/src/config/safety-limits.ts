/**
 * Central Safety, Rate Limiting, Concurrency, and Resource-Exhaustion Limits
 * Designed per Phase 7.6 Security Hardening Requirements
 */
export const SAFETY_LIMITS = {
  // Rate limits per user per window (in seconds)
  rateLimits: {
    readWindowSeconds: 60,
    readMaxRequests: 60,

    analyzerWindowSeconds: 60,
    analyzerMaxRequests: 5, // Code, DB, Log execution endpoints

    correlationWindowSeconds: 60,
    correlationMaxRequests: 3, // Correlation SSE stream execution
  },

  // In-process Concurrency limits per User
  concurrency: {
    maxConcurrentAnalysisPerUser: 2, // Max concurrent analysis tasks per user
    maxConcurrentCorrelationPerUser: 1, // Max concurrent SSE streams per user
  },

  // Repository & Source Code Safety Boundaries
  repository: {
    maxFiles: 500, // Max total source files analyzed
    maxFileBytes: 1 * 1024 * 1024, // 1 MB max individual file size
    maxTotalSourceBytes: 10 * 1024 * 1024, // 10 MB max total source bytes
    maxDirectoryDepth: 15, // Max tree traversal depth
  },

  // Input Payload Safety Caps (Bytes)
  payloads: {
    maxSqlPayloadBytes: 1 * 1024 * 1024, // 1 MB max DDL + SQL queries payload
    maxLogPayloadBytes: 5 * 1024 * 1024, // 5 MB max JSON log payload
  },

  // Directories excluded from source code analysis & file-count scanning
  ignoredDirectories: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.vite',
    '__pycache__',
    '.system_generated',
    'tmp',
    'temp',
  ],

  // Execution Timeouts (ms)
  timeoutsMs: {
    cloneMs: 30_000, // 30s timeout for shallow git clone
    analysisMs: 60_000, // 60s timeout for analyzer execution
    correlationMs: 120_000, // 120s timeout for full SSE correlation
  },
};
