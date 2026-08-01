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

- **Current Phase:** Phase 0 Complete — Phase 1 (Shared Platform Foundation) next
- **Monorepo initialized:** Yes (`CodeInsight` single Git monorepo)
- **GitHub connected:** Yes
- **Demo repository complete:** Yes (`codeinsight-demo-repo` TaskLedger domain app with planted benchmark issues)
- **EXPECTED_FINDINGS complete:** Yes (`docs/EXPECTED_FINDINGS.md` ground-truth baseline)
- **Documentation consolidated:** Yes (Platform documentation consolidated in root `docs/`)
- **Auth working end-to-end:** No
- **Analyzers completed:** None (Phase 1 Shared Platform Foundation → Database → Logs → Code)
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
- **Monorepo workspace update:** Single Git monorepo (`CodeInsight`) sharing `packages/shared-contracts` across `codeinsight-web`, `codeinsight-api`, and `codeinsight-demo-repo`.
- **Shared platform contracts:** `packages/shared-contracts` exports unified `Finding`, `Evidence`, `AnalyzerResult`, `Summary`, `Metrics`, and `Severity`/`Category` enums.
- **Acceptance Baseline:** `docs/EXPECTED_FINDINGS.md` serves as the canonical ground-truth regression benchmark for all analyzers and the Correlation Engine.

---

## Session Log

*(Newest entries at the top)*

### 2026-08-02 — Phase 0 Complete — [Tool used: Antigravity]

**Completed:**
- Monorepo initialized (`CodeInsight` single Git repository with root `.gitignore`).
- Built and verified `codeinsight-demo-repo` (TaskLedger domain app with TypeScript code, PostgreSQL queries, and structured logs).
- Planted realistic code-layer, database-layer, and log-layer issues across the demo codebase.
- Created `docs/EXPECTED_FINDINGS.md` as the canonical regression benchmark and acceptance baseline.
- Consolidated documentation (PRD, Architecture, Design, Rules, Phases, Memory, EXPECTED_FINDINGS) into root `docs/` directory.

**Decisions made (and why):**
- Consolidated into a single Git monorepo (`CodeInsight`) sharing `packages/shared-contracts` across web, API, and demo benchmark.
- Defined `docs/EXPECTED_FINDINGS.md` as the official acceptance baseline for analyzer output determinism.

**Deviations from Phases.md / Architecture.md (if any):**
- Added Phase 1 "Shared Platform Foundation" to establish shared contracts before any analyzer logic is built.

**Known bugs / unfinished edges:**
- None in Phase 0 test data. Demo app compiles and executes cleanly.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- Monorepo structural alignment and Phase 1 Shared Platform Foundation addition in `Phases.md`.

**Next session should start with:**
- Phase 1: Create `packages/shared-contracts` and define shared `Analyzer`, `Finding`, `Evidence`, `AnalyzerResult`, `Summary`, and `Metrics` models.
