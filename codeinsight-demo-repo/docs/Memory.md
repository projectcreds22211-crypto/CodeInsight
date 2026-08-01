# Memory.md — CodeInsight

**Purpose:** Running record of what's been built, decided, and what's next — so any AI tool (or you) can resume a session with zero context loss. Updated at the **end of every coding session**, per Rules.md Section 12. Never skip this.

**Read order for a new session:** PRD.md → Architecture.md → Rules.md → Phases.md → **this file (most recent entries first)** → start working.

---

## How to Log an Entry

Copy this template to the top of the "Session Log" section below for each session:

```md
### [YYYY-MM-DD] — Phase X.Y — [Tool used: Antigravity / Codex / Kimi / Claude]

**Completed:**
-

**Decisions made (and why):**
-

**Deviations from Phases.md / Architecture.md (if any):**
-

**Known bugs / unfinished edges:**
-

**Flagged items needing Pratik's review** (per Rules.md Section 10):
-

**Next session should start with:**
-
```

---

## Current Status Snapshot

*(Keep this section updated to reflect the single source of truth — overwrite, don't just append)*

- **Current Phase:** Phase 0 — Foundation & Demo Repository Completed
- **Repos initialized:** `codeinsight-demo-repo`
- **Demo repository (`codeinsight-demo-repo`) built:** Yes (TypeScript `TaskLedger` app with 10 planted issues)
- **Auth working end-to-end:** No (Phase 1 next)
- **Analyzers completed:** None (Database → Logs → Code, in that order per Phases.md)
- **Correlation Engine working:** No
- **Deployed:** No

---

## Decision Log (Cumulative — Append-Only, Never Delete)

*(Pulls forward the major locked decisions from planning so they don't get lost in individual session entries)*

- Auth: Clerk (not Supabase Auth) — Neon is DB of record, Clerk decouples identity cleanly
- Repo structure: two separate repos (`codeinsight-web`, `codeinsight-api`)
- API style: REST, not tRPC
- State management: React Context + TanStack Query only — no Redux/Zustand
- ORM: Drizzle, not Prisma
- Backend framework: Fastify, not Express
- Correlation streaming: SSE, not WebSockets
- Session/finding storage: lean (final findings/reports only, no raw intermediate data)
- Analyzer identity colors locked: Code = `#6B4CE6`, Database = `#2E9C8F`, Logs = `#D98E3B`
- Build order: Database Analyzer → Log Analyzer → Code Analyzer → Correlation Engine
- Demo repository lives as its own separate public GitHub repo

---

## Session Log

### [2026-08-02] — Phase 0 — [Tool used: Antigravity]

**Completed:**
- Built full Phase 0 `TaskLedger` mini-application inside `codeinsight-demo-repo/src/` (~15 TypeScript files across 5 modules).
- Created `db/schema.sql` and `db/queries.sql` with database-layer issues.
- Created `logs/sample-logs.json` with runtime log metrics and anomaly trends.
- Verified TypeScript compilation (`npx tsc --noEmit`) with strict mode enabled and zero errors.
- Verified entry point execution (`npx ts-node src/index.ts`).
- Left `README.md` unwritten as instructed for the user to document the ground-truth answer key.

**Decisions made (and why):**
- Domain: Task & Expense Ledger (`TaskLedger`) chosen as a believable microservice managing tasks, ledger entries, reporting, and notifications.
- Issue realism: Planted issues implemented without comments or explicit bug labels so they mirror real developer oversight.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None in code structure; planted issues are present intentionally.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- User writing the `README.md` ground-truth answer key for `codeinsight-demo-repo`.
- Proceeding to Phase 1 (Scaffolding `codeinsight-web` and `codeinsight-api`).

