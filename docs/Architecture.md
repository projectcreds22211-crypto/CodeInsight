# Architecture.md — CodeInsight

**Version:** 1.1
**Status:** Locked for MVP monorepo build
**Traces back to:** PRD.md v1.0

---

## 1. Tech Stack

### Frontend (Package: `codeinsight-web`)

```
React 18 + TypeScript + Vite
Tailwind CSS + shadcn/ui (copied-in components, not a dependency)
React Flow          → code dependency graph
Recharts            → query performance / log anomaly timelines
React Context + useState → all client state (no Redux/Zustand)
TanStack Query       → server state, caching, SSE-friendly data fetching
Clerk React SDK      → auth UI + session
```

### Backend (Package: `codeinsight-api`)

```
Node.js + Fastify + TypeScript
Zod                  → request/response validation
Drizzle ORM           → schema + queries
@anthropic-ai/sdk     → Claude API (shared client)
simple-git            → shallow repo cloning
ts-morph              → JS/TS AST parsing (Code Analyzer)
node-sql-parser        → SQL parsing (Database Analyzer)
Fastify SSE plugin (@fastify/sse or manual SSE headers) → Correlation Engine streaming
Clerk Node SDK (fastify-clerk or manual JWT verification) → auth middleware
```

### Shared Contracts (Package: `packages/shared-contracts`)

```
TypeScript Interfaces & Domain Schemas
- Common Finding model
- Evidence model
- AnalyzerResult container model
- Summary & Metrics models
- Shared Enums (Severity, Category)
```

### Database & Infra

```
PostgreSQL — hosted on Neon (serverless, generous free tier)
Auth — Clerk (identity/session), webhook-synced into Neon `users` table
Frontend deploy — Vercel
Backend deploy — Render
```

### Why This Combination (for your own reference in interviews)

- **Fastify over Express:** ~2x throughput, schema-based validation built in, still simple enough to explain in 30 seconds.
- **Drizzle over Prisma:** SQL-close syntax, no query-engine binary, faster cold starts on Render — relevant since analyzer endpoints are already CPU-heavy (AST/SQL parsing).
- **Clerk over Supabase Auth:** Neon is the DB of record, not Supabase — Clerk decouples identity from database choice and has the better free-tier DX for a solo project.
- **Monorepo Architecture:** Single Git repository (`CodeInsight`) sharing TypeScript contracts (`packages/shared-contracts`) between backend API, frontend web client, and benchmark fixtures without code duplication.
- **SSE over WebSockets:** Correlation Engine output is one-directional (server → client streaming reasoning) — SSE is simpler than WebSockets for this and Fastify supports it natively.

---

## 2. Repository Structure

```
CodeInsight/ (Monorepo Root)
├── docs/                        # Project-wide documentation
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Design.md
│   ├── Rules.md
│   ├── Phases.md
│   ├── Memory.md
│   └── EXPECTED_FINDINGS.md
├── packages/
│   └── shared-contracts/        # Shared TypeScript interfaces & contracts
│       ├── src/
│       │   ├── finding.ts       # Finding & Evidence interfaces
│       │   ├── analyzer.ts      # AnalyzerResult, Summary, Metrics interfaces
│       │   └── enums.ts         # Shared severity and category enums
│       └── package.json
├── codeinsight-web/             # Frontend application (Vite + React SPA)
│   ├── src/
│   │   ├── app/                 # Route-level pages
│   │   │   ├── projects/        # "My Projects" list + project detail
│   │   │   ├── auth/            # Clerk sign-in/sign-up wrappers
│   │   │   └── demo/            # CodeInsight Demo Repository entry point
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui primitives (copied in)
│   │   │   ├── code-analyzer/   # Dependency graph (React Flow), tech debt cards
│   │   │   ├── db-analyzer/     # Query before/after, index suggestions
│   │   │   ├── log-analyzer/    # Timeline (Recharts), anomaly list
│   │   │   └── correlation/     # Streaming unified report view
│   │   ├── lib/
│   │   │   ├── api-client.ts    # Typed REST client (fetch wrapper)
│   │   │   ├── sse-client.ts    # SSE connection handler for correlation stream
│   │   │   └── clerk.ts
│   │   ├── context/             # React Context providers (active project, etc.)
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── codeinsight-api/             # Backend service (Node.js + Fastify API)
│   ├── src/
│   │   ├── server.ts             # Fastify bootstrap
│   │   ├── routes/
│   │   │   ├── projects.routes.ts
│   │   │   ├── code-analyzer.routes.ts
│   │   │   ├── db-analyzer.routes.ts
│   │   │   ├── log-analyzer.routes.ts
│   │   │   └── correlation.routes.ts # SSE endpoint lives here
│   │   ├── analyzers/
│   │   │   ├── code/
│   │   │   │   ├── clone.ts          # simple-git shallow clone + cleanup
│   │   │   │   ├── ast-parser.ts     # ts-morph extraction
│   │   │   │   ├── dependency-graph.ts
│   │   │   │   ├── tech-debt-score.ts
│   │   │   │   └── prompt.ts         # Claude prompt template
│   │   │   ├── database/
│   │   │   │   ├── sql-parser.ts
│   │   │   │   ├── rules.ts          # deterministic SQL checks
│   │   │   │   └── prompt.ts
│   │   │   ├── logs/
│   │   │   │   ├── anomaly-detection.ts # z-score/threshold logic
│   │   │   │   └── prompt.ts
│   │   │   └── correlation/
│   │   │       ├── tool-definitions.ts # Claude function-calling schema
│   │   │       ├── orchestrator.ts   # calls 3 analyzers' stored findings, streams reasoning
│   │   │       └── prompt.ts
│   │   ├── services/
│   │   │   ├── claude-client.ts  # shared Anthropic SDK instance
│   │   │   ├── auth.ts           # Clerk JWT verification middleware
│   │   │   └── db.ts             # Drizzle client init
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle schema definitions
│   │   │   └── migrations/
│   │   └── seed/
│   │       └── demo-repository-seed.ts
│   ├── package.json
│   └── drizzle.config.ts
└── codeinsight-demo-repo/       # Ground-truth benchmark dataset repository
    ├── src/                     # TaskLedger TypeScript application
    ├── db/                      # PostgreSQL DDL schema & queries
    ├── logs/                    # Structured JSON time-series logs
    └── package.json
```

**Note on the worker split:** `analyzers/*` is intentionally isolated from `routes/*` — each analyzer module exports a plain async function with no Fastify-specific code inside it, returning a standardized `AnalyzerResult` payload.

---

## 3. Database Schema (Drizzle / PostgreSQL)

Matches the `User → Projects → Analysis Sessions → Findings → Reports` model from the PRD, with **lean storage** (final findings/reports only, no raw intermediate data persisted).

```typescript
// users — synced from Clerk via webhook
users {
  id: uuid (pk)
  clerkId: text (unique, not null)
  email: text
  createdAt: timestamp
}

// projects — one per analyzed repo/target, owned by a user
projects {
  id: uuid (pk)
  userId: uuid (fk -> users.id)
  name: text                      // e.g. "Express.js Audit"
  githubUrl: text (nullable)      // null if using pasted schema/logs only
  isDemoRepository: boolean (default false)
  createdAt: timestamp
  updatedAt: timestamp
}

// analysis_sessions — one per pipeline run (code/db/log/correlation) against a project
analysis_sessions {
  id: uuid (pk)
  projectId: uuid (fk -> projects.id)
  type: enum('code', 'database', 'logs', 'correlation')
  status: enum('pending', 'running', 'completed', 'failed')
  startedAt: timestamp
  completedAt: timestamp (nullable)
}

// findings — individual, addressable results from an analyzer
// (this is what the Correlation Engine references by ID — grounding requirement from PRD 5.4)
findings {
  id: uuid (pk)
  sessionId: uuid (fk -> analysis_sessions.id)
  category: enum('architecture', 'tech_debt', 'query_optimization', 'anomaly')
  severity: enum('low', 'medium', 'high', 'critical')
  title: text
  description: text
  metadata: jsonb                 // structured detail specific to finding type
  createdAt: timestamp
}

// reports — the final rendered output for a session (esp. correlation)
reports {
  id: uuid (pk)
  sessionId: uuid (fk -> analysis_sessions.id)
  summary: text                   // Claude-generated unified narrative
  actionPlan: jsonb               // prioritized list, each item referencing finding IDs
  generatedAt: timestamp
}
```

---

## 4. Common Finding & Analyzer Output Model

All three analyzers (Code, Database, Logs) operate as independent modules that produce standardized findings conforming to a shared domain contract defined in `packages/shared-contracts`.

### Shared Analyzer Contract Principle

Every analyzer in CodeInsight (Code, Database, Logs) produces findings adhering strictly to the same shared domain model defined in `packages/shared-contracts`. Analyzers differ only in their ingestion strategy and parsing mechanisms (AST analysis, SQL parsing, or log anomaly detection). The API endpoints, UI Dashboard tabs, persistent DB reports, and Correlation Engine consume exclusively the standardized `Finding` and `AnalyzerResult` contracts. No analyzer is permitted to expose its own custom output shape or bypass these shared contract boundaries.

Every analyzer execution returns an `AnalyzerResult` structure comprising five key sub-models:

1. **`Finding`**: Individual, addressable issue entry stored in the database and referenced by ID in correlation reports.
   - `id`: unique finding UUID
   - `sessionId`: associated analysis session UUID
   - `category`: shared category enum (`architecture`, `tech_debt`, `query_optimization`, `anomaly`)
   - `severity`: shared severity enum (`low`, `medium`, `high`, `critical`)
   - `title`: short descriptive title
   - `description`: detailed explanation of the finding
   - `metadata`: type-specific metadata payload (e.g. cycle path, AST node type, query string)

2. **`Evidence`**: Concrete, deterministic proof supporting the finding.
   - `location`: file path, query identifier, or log timestamp reference
   - `lineStart` & `lineEnd`: exact source line bounds (for Code Analyzer)
   - `snippet`: exact code snippet, SQL query fragment, or raw JSON log entry
   - `threshold`: metric baseline or rule threshold triggered (e.g. z-score > 3.0, query duration > 1500ms, cycle depth)

3. **`AnalyzerResult`**: Top-level container returned by all analyzer services.
   - `sessionId`: unique session identifier
   - `status`: execution state (`pending`, `running`, `completed`, `failed`)
   - `findings`: array of `Finding[]` items
   - `summary`: analyzer execution summary object
   - `metrics`: aggregated metrics object

4. **`Summary`**: Plain-English narrative and impact breakdown.
   - `headline`: high-level status statement
   - `overview`: Claude-generated or rule-based executive narrative
   - `totalFindings`: total count broken down by severity

5. **`Metrics`**: Quantitative measurements computed during analysis.
   - `score`: composite health or tech debt score (0–100 scale)
   - `counts`: breakdown metrics (e.g. total queries parsed, total log entries analyzed, file count)
   - `performanceMs`: analysis execution time

---

## 5. API Flow (REST) & Response Contracts

```
Auth
POST   /api/auth/webhook                 ← Clerk webhook, syncs user on signup

Projects
GET    /api/projects                     ← list current user's projects
POST   /api/projects                     ← create project (githubUrl or manual)
GET    /api/projects/:id                 ← project detail + latest sessions/reports
DELETE /api/projects/:id
POST   /api/projects/demo                ← one-click load CodeInsight Demo Repository

Code Analyzer
POST   /api/projects/:id/analyze/code    ← triggers clone + AST parse + Claude reasoning → returns AnalyzerResult
GET    /api/projects/:id/code/findings   ← latest AnalyzerResult (findings + dependency graph data)

Database Analyzer
POST   /api/projects/:id/analyze/database ← body: { schema, queries[] } → returns AnalyzerResult
GET    /api/projects/:id/database/findings ← latest AnalyzerResult (query findings + index recommendations)

Log Analyzer
POST   /api/projects/:id/analyze/logs    ← body: { logs: JSON[] } → returns AnalyzerResult
GET    /api/projects/:id/logs/findings   ← latest AnalyzerResult (log findings + timeline data)

Correlation Engine
GET    /api/projects/:id/correlate       ← SSE stream; requires all 3 analyzer sessions to exist
                                              streams: reasoning tokens → final actionPlan → [DONE]
```

**Auth middleware:** every route except the Clerk webhook requires a valid Clerk session JWT, verified in Fastify's `onRequest` hook, resolving to a `userId` used to scope all project queries (no cross-user data access).

---

## 6. Correlation Engine Flow (SSE Detail)

```
1. Frontend opens EventSource connection to GET /api/projects/:id/correlate
2. Backend verifies all 3 analyzer sessions (code/database/logs) exist + status = 'completed'
   → if not, returns 409 with which analyzers are missing (frontend shows "run X first")
3. Backend loads findings for all 3 sessions from DB
4. Backend calls Claude with function-calling tools:
     - get_code_findings()
     - get_query_findings()
     - get_log_findings()
   Claude reasons across them, streaming text tokens back
5. Each streamed chunk is forwarded to the client as an SSE `message` event
6. On completion, backend persists the final report (summary + actionPlan) to `reports` table
   and sends a final SSE event: `event: done`
7. Frontend closes the EventSource connection
```

---

## 7. State Management Boundaries (Frontend)

Given the "React Context + useState only" decision — clear rules to avoid this becoming messy:

- **Server state** (projects, findings, reports) → TanStack Query exclusively. Never mirrored into Context.
- **Client-only UI state** (active tab, selected project ID, SSE connection status) → React Context, one `ProjectContext` provider at the project-detail route level. No global app-wide context beyond auth (which Clerk already provides).
- **Rule of thumb:** if data comes from the backend, it lives in a TanStack Query cache key, not in Context or useState.

---

## 8. Deployment Topology

```
                    ┌─────────────┐
                    │   Clerk     │  (identity provider)
                    └──────┬──────┘
                           │ JWT
                           ▼
┌──────────────┐    REST + SSE     ┌──────────────┐        ┌────────────┐
│ codeinsight-  │ ────────────────▶│ codeinsight- │───────▶│    Neon    │
│ web (Vercel)  │◀──────────────── │ api (Render) │        │ (Postgres) │
└──────────────┘                   └──────┬───────┘        └────────────┘
                                           │
                                           ▼
                                   ┌──────────────┐
                                   │ Anthropic API│
                                   └──────────────┘
```

- Environment variables (Clerk keys, Neon connection string, Anthropic API key) managed via Render/Vercel dashboards — never committed.
- `codeinsight-api` shallow-clones target repos into a temp directory (`os.tmpdir()`), deleted in a `finally` block after analysis — no persistent filesystem state on the backend.

---

## 9. Open Items Deferred to Rules.md / Phases.md

- Exact error-handling conventions (how failed analyzer runs surface to the user) → Rules.md
- Rate limiting / abuse prevention on the `/analyze/*` endpoints (e.g., repo size caps) → Rules.md
- Build order and phase breakdown → Phases.md
