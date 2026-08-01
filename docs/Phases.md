# Phases.md — CodeInsight

**Version:** 1.1
**Status:** Living document — phases and subphases are flexible checklists, not a rigid contract

**How to use this file:** Phases are sequenced by dependency, not by calendar time (no dates attached, per decision). Subphases within a phase can be reordered, merged, or split as building reveals better paths — if you deviate meaningfully from the plan here, note it in `Memory.md`, don't silently drift. Build strategy: **solo end-to-end vertical slice** — get platform foundation, auth, and shared contracts ready before completing vertical slices for each analyzer and the correlation engine inside the monorepo workspace.

---

## Phase 0 — Foundation & Demo Repository

*Goal: nothing "real" can be built or demoed without a target to analyze. Build the test data first.*

- [x] 0.1 — Create `codeinsight-demo-repo` mini-application codebase
- [x] 0.2 — Design a small realistic mini-application inside it (TaskLedger domain — 15 TS files across 5 modules)
- [x] 0.3 — Intentionally plant **code-layer issues**: circular dependency chain (`TaskService` $\rightarrow$ `ReportGenerator` $\rightarrow$ `LedgerService` $\rightarrow$ `TaskService`), 100+ line method, duplicated logic block
- [x] 0.4 — Intentionally plant **database-layer issues**: missing index, `SELECT *`, N+1 query pattern, unbounded query, correlated subquery, duplicate query, unnecessary `DISTINCT`
- [x] 0.5 — Intentionally plant **runtime-layer issues**: synthetic log set containing connection pool exhaustion, memory leak trend, slow DB query, transient PG timeout, HTTP 500, retry recovery, and clean baseline period
- [x] 0.6 — Write `docs/EXPECTED_FINDINGS.md` in the repo documenting every planted issue, expected findings, and correlation causal chain as the ground-truth benchmark
- [x] 0.7 — Initialize monorepo workspace containing `codeinsight-web`, `codeinsight-api`, and `codeinsight-demo-repo` with the `/docs` folder synced

---

## Phase 1 — Shared Platform Foundation

*Goal: Establish shared domain models, analyzer contracts, API skeleton, and UI application shell. The first analyzer must NOT begin until these contracts exist.*

- [ ] 1.1 — Define shared `Analyzer` contract interface (`analyze()`, `validateInput()`, metadata)
- [ ] 1.2 — Define shared `Finding` model (ID, category, severity, title, description, metadata, timestamps)
- [ ] 1.3 — Define shared `Evidence` model (location, snippet, line numbers, metric thresholds, raw payload pointers)
- [ ] 1.4 — Define shared `AnalyzerResult` model (`status`, `sessionId`, `findings`, `metrics`, `summary`)
- [ ] 1.5 — Define shared severity (`low`, `medium`, `high`, `critical`) and category enums
- [ ] 1.6 — Define shared metrics and summary models for analyzer output aggregation
- [ ] 1.7 — Build `codeinsight-api` Fastify API skeleton (server bootstrap, plugin setup, health routes)
- [ ] 1.8 — Build `codeinsight-web` frontend application shell (React SPA shell, app layout, tab navigation, route structure)

---

## Phase 2 — Skeleton: Auth, Projects, App Shell & Infrastructure

*Goal: the thinnest possible slice of real infrastructure — sign in, see an empty project list, create a project. No analyzer logic yet.*

- [ ] 2.1 — Configure monorepo workspace scripts and build pipeline across `codeinsight-web`, `codeinsight-api`, and packages
- [ ] 2.2 — Set up Neon Postgres instance, connect Drizzle, run first migration with `users` and `projects` tables
- [ ] 2.3 — Integrate Clerk on frontend (sign-in/sign-up UI) and backend (JWT verification middleware)
- [ ] 2.4 — Build the Clerk webhook → sync new users into the `users` table
- [ ] 2.5 — Build `POST /api/projects` and `GET /api/projects` (real, auth-scoped)
- [ ] 2.6 — Build the "My Projects" list UI + "Create Project" flow (manual entry: name + optional GitHub URL)
- [ ] 2.7 — Build the one-click "Load Demo Repository" project-creation path (`POST /api/projects/demo`), pointing at the Phase 0 repo
- [ ] 2.8 — Apply Design.md's `theme-marketing` to auth screens and `theme-app` to the dashboard shell (sidebar, project list) — first real design-system checkpoint
- [ ] 2.9 — Verify: sign up → see empty project list → create a project (manual and demo) → project appears — full loop working before moving on

**Checkpoint:** this phase is "done" when you can demo signing in and creating a project live, even though nothing can be analyzed yet.

---

## Phase 3 — Database Analyzer (Full Vertical Slice)

*Goal: the first analyzer built completely, end-to-end — this is the template the other two analyzers will follow.*

- [ ] 3.1 — Add `analysis_sessions` and `findings` tables to the schema, migrate
- [ ] 3.2 — Build the deterministic SQL optimization rule layer using shared platform contracts (detecting missing indexes, `SELECT *`, unbounded queries, N+1 patterns, and structural anti-patterns)
- [ ] 3.3 — Integrate `node-sql-parser`, wire rules against parsed query ASTs returning typed `AnalyzerResult`
- [ ] 3.4 — Write the Database Analyzer's Claude prompt (`analyzers/database/prompt.ts`) — takes rule-layer output + schema, returns rewritten query + plain-English explanation
- [ ] 3.5 — Build `POST /api/projects/:id/analyze/database` and `GET /api/projects/:id/database/findings`
- [ ] 3.6 — Build the frontend Database Analyzer tab: paste-in schema + query UI, before/after query display, index recommendation card
- [ ] 3.7 — Run it against the Phase 0 demo repo's planted DB issues — verify detection against `EXPECTED_FINDINGS.md` (your first real accuracy checkpoint against the benchmark answer key)
- [ ] 3.8 — Write Vitest unit tests for the deterministic rule layer (per Rules.md Section 8, priority 1)

**Checkpoint:** you can log in, open the demo project, run the database analyzer, and see real, correct, explained findings — first complete vertical slice.

**Tool assignment:** Codex for 3.2/3.3 (deterministic correctness-critical), Antigravity for 3.6 (UI), you + Claude for 3.4 (prompt design).

---

## Phase 4 — Log Analyzer

*Goal: second analyzer, following the pattern established in Phase 3 — should move faster now that the shape is proven.*

- [ ] 4.1 — Build the anomaly detection logic (z-score/threshold-based detection on error rates, latency spikes, resource metrics, and operational logs) using shared platform contracts
- [ ] 4.2 — Build time-windowed pattern detection (e.g., sustained spike over N minutes vs. single blip)
- [ ] 4.3 — Write the Log Analyzer's Claude prompt — takes detected anomalies, returns correlation/explanation between distinct anomalies within the log set
- [ ] 4.4 — Build `POST /api/projects/:id/analyze/logs` and `GET /api/projects/:id/logs/findings`
- [ ] 4.5 — Build the frontend Log Analyzer tab: paste-in JSON textarea + disabled "Upload Log File — Coming Soon" UI element (per PRD 5.3), Recharts timeline with anomalies highlighted
- [ ] 4.6 — Run against Phase 0's planted runtime issues — verify detection against `EXPECTED_FINDINGS.md`
- [ ] 4.7 — Vitest tests for anomaly detection logic

**Tool assignment:** Codex for 4.1/4.2, Antigravity for 4.5, Kimi can help generate additional synthetic log variations to stress-test detection beyond the Phase 0 baseline set.

---

## Phase 5 — Code Analyzer

*Goal: the hardest analyzer, tackled last once the pattern and your own workflow are both proven.*

- [ ] 5.1 — Integrate `simple-git` shallow clone + guaranteed cleanup (`finally` block, temp dir)
- [ ] 5.2 — Integrate `ts-morph`, extract import/module relationships into a dependency graph structure using shared platform contracts
- [ ] 5.3 — Build circular dependency detection (graph cycle detection)
- [ ] 5.4 — Build code-smell heuristics (long functions/methods, duplicated logic blocks, unused utilities, code comments/TODO debt, and test-file-ratio heuristics)
- [ ] 5.5 — Build the tech debt scoring logic (composite, explainable — not a black box)
- [ ] 5.6 — Write the Code Analyzer's Claude prompt — takes graph + smells, returns ranked refactor suggestions with rationale
- [ ] 5.7 — Build `POST /api/projects/:id/analyze/code` and `GET /api/projects/:id/code/findings`
- [ ] 5.8 — Build the frontend Code Analyzer tab: repo URL input (or auto-filled for demo project), React Flow dependency graph, tech debt score card, refactor suggestion list
- [ ] 5.9 — Run against Phase 0's planted code issues — verify detection against `EXPECTED_FINDINGS.md`
- [ ] 5.10 — Run against 2-3 real external open-source repos (e.g., a small Express or small React library) — verify it doesn't crash or produce nonsense on code you didn't author (per PRD success criteria)
- [ ] 5.11 — Vitest tests for cycle detection and smell heuristics

**Tool assignment:** Codex owns nearly all of this phase (5.1–5.5 are the most correctness-critical work in the whole project) — Antigravity only for 5.8's UI shell around the React Flow graph.

---

## Phase 6 — Correlation Engine (The Flagship Feature)

*Goal: the reasoning layer that makes this a platform, not three separate tools.*

- [ ] 6.1 — Define the Claude function-calling tool schema: `get_code_findings()`, `get_query_findings()`, `get_log_findings()`
- [ ] 6.2 — Build the orchestrator: loads findings for a project's three completed sessions, invokes Claude with the tools defined above
- [ ] 6.3 — Design and iterate the correlation prompt — explicitly instruct grounding (every claim must reference a real `finding.id`), test against cases where findings are *unrelated* (correlation engine should say so, not force a false connection)
- [ ] 6.4 — Build the SSE endpoint (`GET /api/projects/:id/correlate`) per Architecture.md Section 5's flow
- [ ] 6.5 — Persist the final `reports` row (summary + `actionPlan` with `referencedFindingIds`) once streaming completes
- [ ] 6.6 — Build the frontend Unified Report tab: SSE client connection, streaming text render, final prioritized action plan display
- [ ] 6.7 — Build **The Thread** — the signature animated element (Design.md Section 8) tied to the SSE stream's progress
- [ ] 6.8 — Run against the Phase 0 demo repo — verify the correlation engine actually connects planted issues across layers where they're genuinely related and does not invent connections between unrelated findings (against `EXPECTED_FINDINGS.md`)
- [ ] 6.9 — Write the grounding test from Rules.md Section 8, priority 2: every `actionPlan` item's `referencedFindingIds` must exist in that session's findings

**Checkpoint:** this is the moment the product becomes what the PRD describes — worth spending real iteration time on 6.3 and 6.8 specifically, these are what an interviewer will probe hardest.

**Tool assignment:** this phase is mostly you + Claude directly (prompt/orchestration design is the one place Rules.md reserves for direct ownership) — Antigravity for 6.6/6.7 UI only after the backend logic is solid.

---

## Phase 7 — Polish, Testing, Deploy

*Goal: make it demoable cold, to anyone, at any time.*

- [ ] 7.1 — Error states and empty states across all four tabs (per Rules.md Section 4 and Design.md's writing guidance)
- [ ] 7.2 — Loading states for all analyzer runs (not just the correlation engine's Thread animation)
- [ ] 7.3 — Responsive pass — verify tablet-width degradation per Design.md Section 9
- [ ] 7.4 — Accessibility pass — focus rings, contrast check on real rendered components, `prefers-reduced-motion` verification
- [ ] 7.5 — Set up ESLint + Prettier + Husky pre-commit across monorepo packages (if not already done in Phase 2 — flag if it was deferred)
- [ ] 7.6 — Rate limiting and repo-size caps on `/analyze/*` endpoints (Rules.md Section 5, flagged as deferred from earlier phases)
- [ ] 7.7 — Deploy `codeinsight-web` to Vercel, `codeinsight-api` to Railway, verify env vars, verify Clerk/Neon/Anthropic keys work in production
- [ ] 7.8 — End-to-end smoke test in production: sign up fresh, load demo project, run all three analyzers, run correlation, confirm the full loop works with zero local setup
- [ ] 7.9 — Record the demo video (per your original interview-readiness goal)
- [ ] 7.10 — Final Memory.md update summarizing the whole build, key decisions, and known limitations — this becomes your interview prep notes as much as a dev log

---

## Explicitly Deferred (Do Not Build in MVP Phases)

Pulled directly from PRD Section 4.2 / 7 — listed here so no phase accidentally scope-creeps into these:
- Multi-language code parsing beyond JS/TS
- Team workspaces, collaboration, RBAC
- Live/write DB connections
- Log file upload backend processing
- Native mobile experience
- Dark mode
