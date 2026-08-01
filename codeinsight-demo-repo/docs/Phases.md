# Phases.md — CodeInsight

**Version:** 1.0
**Status:** Living document — phases and subphases are flexible checklists, not a rigid contract

**How to use this file:** Phases are sequenced by dependency, not by calendar time (no dates attached, per decision). Subphases within a phase can be reordered, merged, or split as building reveals better paths — if you deviate meaningfully from the plan here, note it in `Memory.md`, don't silently drift. Build strategy: **solo end-to-end vertical slice** — get one full path (auth → one project → one analyzer → real UI) working before adding breadth.

---

## Phase 0 — Foundation & Demo Repository

*Goal: nothing "real" can be built or demoed without a target to analyze. Build the test data first.*

- [ ] 0.1 — Create `codeinsight-demo-repo` as its own public GitHub repository
- [ ] 0.2 — Design a small realistic mini-application inside it (pick a simple domain — e.g., a basic task/ledger app — enough files to be a believable codebase, not a toy)
- [ ] 0.3 — Intentionally plant **code-layer issues**: at least one circular dependency, one long/duplicated-logic method, one clearly duplicated code block
- [ ] 0.4 — Intentionally plant **database-layer issues**: schema with at least one missing-index scenario, one `SELECT *` query, one N+1 pattern (a query executed in a loop pattern), one unbounded query
- [ ] 0.5 — Intentionally plant **runtime-layer issues**: a synthetic log set (JSON) containing a connection-pool-exhaustion pattern, a memory-leak-shaped metric trend, and at least one clean anomaly-free baseline period (so anomaly detection has genuine signal-to-noise to work with, not just an all-broken log)
- [ ] 0.6 — Write a short `README.md` in the demo repo documenting every planted issue and its expected detection — this becomes your ground-truth answer key for validating analyzer accuracy later
- [ ] 0.7 — Initialize both `codeinsight-web` and `codeinsight-api` repos with the `/docs` folder (PRD, Architecture, Design, Rules, Phases, Memory) synced into both

**Tool assignment:** Kimi for brainstorming realistic planted-issue scenarios and generating synthetic log data; you write the ground-truth README yourself (this is your accuracy contract, worth owning directly).

---

## Phase 1 — Skeleton: Auth, Projects, App Shell

*Goal: the thinnest possible slice of real infrastructure — sign in, see an empty project list, create a project. No analyzer logic yet.*

- [ ] 1.1 — Scaffold `codeinsight-web` (Vite + React + TS + Tailwind + shadcn/ui init)
- [ ] 1.2 — Scaffold `codeinsight-api` (Fastify + TS + basic health-check route)
- [ ] 1.3 — Set up Neon Postgres instance, connect Drizzle, run first migration with just `users` and `projects` tables
- [ ] 1.4 — Integrate Clerk on frontend (sign-in/sign-up UI) and backend (JWT verification middleware)
- [ ] 1.5 — Build the Clerk webhook → sync new users into the `users` table
- [ ] 1.6 — Build `POST /api/projects` and `GET /api/projects` (real, auth-scoped)
- [ ] 1.7 — Build the "My Projects" list UI + "Create Project" flow (manual entry: name + optional GitHub URL)
- [ ] 1.8 — Build the one-click "Load Demo Repository" project-creation path (`POST /api/projects/demo`), pointing at the Phase 0 repo
- [ ] 1.9 — Apply Design.md's `theme-marketing` to auth screens and `theme-app` to the dashboard shell (sidebar, project list) — first real design-system checkpoint
- [ ] 1.10 — Verify: sign up → see empty project list → create a project (manual and demo) → project appears — full loop working before moving on

**Checkpoint:** this phase is "done" when you can demo signing in and creating a project live, even though nothing can be analyzed yet.

---

## Phase 2 — Database Analyzer (Full Vertical Slice)

*Goal: the first analyzer built completely, end-to-end — this is the template the other two analyzers will follow.*

- [ ] 2.1 — Add `analysis_sessions` and `findings` tables to the schema, migrate
- [ ] 2.2 — Build the deterministic rule layer: `SELECT *` detection, missing-WHERE-index detection, unbounded query (no LIMIT) detection, basic N+1 pattern detection
- [ ] 2.3 — Integrate `node-sql-parser`, wire rules against parsed query ASTs
- [ ] 2.4 — Write the Database Analyzer's Claude prompt (`analyzers/database/prompt.ts`) — takes rule-layer output + schema, returns rewritten query + plain-English explanation
- [ ] 2.5 — Build `POST /api/projects/:id/analyze/database` and `GET /api/projects/:id/database/findings`
- [ ] 2.6 — Build the frontend Database Analyzer tab: paste-in schema + query UI, before/after query display, index recommendation card
- [ ] 2.7 — Run it against the Phase 0 demo repo's planted DB issues — verify it catches all of them (your first real accuracy checkpoint against the README answer key)
- [ ] 2.8 — Write Vitest unit tests for the deterministic rule layer (per Rules.md Section 8, priority 1)

**Checkpoint:** you can log in, open the demo project, run the database analyzer, and see real, correct, explained findings — first complete vertical slice.

**Tool assignment:** Codex for 2.2/2.3 (deterministic correctness-critical), Antigravity for 2.6 (UI), you + Claude for 2.4 (prompt design).

---

## Phase 3 — Log Analyzer

*Goal: second analyzer, following the pattern established in Phase 2 — should move faster now that the shape is proven.*

- [ ] 3.1 — Build the anomaly detection logic (z-score/threshold-based spike detection on error rate, latency, or custom numeric fields from JSON logs)
- [ ] 3.2 — Build time-windowed pattern detection (e.g., sustained spike over N minutes vs. single blip)
- [ ] 3.3 — Write the Log Analyzer's Claude prompt — takes detected anomalies, returns correlation/explanation between distinct anomalies within the log set
- [ ] 3.4 — Build `POST /api/projects/:id/analyze/logs` and `GET /api/projects/:id/logs/findings`
- [ ] 3.5 — Build the frontend Log Analyzer tab: paste-in JSON textarea + disabled "Upload Log File — Coming Soon" UI element (per PRD 5.3), Recharts timeline with anomalies highlighted
- [ ] 3.6 — Run against Phase 0's planted runtime issues (connection pool exhaustion, memory-leak pattern) — verify detection against the README answer key
- [ ] 3.7 — Vitest tests for anomaly detection logic

**Tool assignment:** Codex for 3.1/3.2, Antigravity for 3.5, Kimi can help generate additional synthetic log variations to stress-test detection beyond the Phase 0 baseline set.

---

## Phase 4 — Code Analyzer

*Goal: the hardest analyzer, tackled last once the pattern and your own workflow are both proven.*

- [ ] 4.1 — Integrate `simple-git` shallow clone + guaranteed cleanup (`finally` block, temp dir)
- [ ] 4.2 — Integrate `ts-morph`, extract import/module relationships into a dependency graph structure
- [ ] 4.3 — Build circular dependency detection (graph cycle detection)
- [ ] 4.4 — Build code-smell heuristics: long files/functions, duplication detection, test-file-ratio heuristic
- [ ] 4.5 — Build the tech debt scoring logic (composite, explainable — not a black box)
- [ ] 4.6 — Write the Code Analyzer's Claude prompt — takes graph + smells, returns ranked refactor suggestions with rationale
- [ ] 4.7 — Build `POST /api/projects/:id/analyze/code` and `GET /api/projects/:id/code/findings`
- [ ] 4.8 — Build the frontend Code Analyzer tab: repo URL input (or auto-filled for demo project), React Flow dependency graph, tech debt score card, refactor suggestion list
- [ ] 4.9 — Run against Phase 0's planted code issues (circular dependency, duplication, long method) — verify against the README answer key
- [ ] 4.10 — Run against 2-3 real external open-source repos (e.g., a small Express or small React library) — verify it doesn't crash or produce nonsense on code you didn't author (per PRD success criteria)
- [ ] 4.11 — Vitest tests for cycle detection and smell heuristics

**Tool assignment:** Codex owns nearly all of this phase (4.1–4.5 are the most correctness-critical work in the whole project) — Antigravity only for 4.8's UI shell around the React Flow graph.

---

## Phase 5 — Correlation Engine (The Flagship Feature)

*Goal: the reasoning layer that makes this a platform, not three separate tools.*

- [ ] 5.1 — Define the Claude function-calling tool schema: `get_code_findings()`, `get_query_findings()`, `get_log_findings()`
- [ ] 5.2 — Build the orchestrator: loads findings for a project's three completed sessions, invokes Claude with the tools defined above
- [ ] 5.3 — Design and iterate the correlation prompt — explicitly instruct grounding (every claim must reference a real `finding.id`), test against cases where findings are *unrelated* (correlation engine should say so, not force a false connection)
- [ ] 5.4 — Build the SSE endpoint (`GET /api/projects/:id/correlate`) per Architecture.md Section 5's flow
- [ ] 5.5 — Persist the final `reports` row (summary + `actionPlan` with `referencedFindingIds`) once streaming completes
- [ ] 5.6 — Build the frontend Unified Report tab: SSE client connection, streaming text render, final prioritized action plan display
- [ ] 5.7 — Build **The Thread** — the signature animated element (Design.md Section 8) tied to the SSE stream's progress
- [ ] 5.8 — Run against the Phase 0 demo repo — verify the correlation engine actually connects the planted issues across layers where they're genuinely related (e.g., N+1 query → connection pool exhaustion in logs), and does *not* invent connections between unrelated findings
- [ ] 5.9 — Write the grounding test from Rules.md Section 8, priority 2: every `actionPlan` item's `referencedFindingIds` must exist in that session's findings

**Checkpoint:** this is the moment the product becomes what the PRD describes — worth spending real iteration time on 5.3 and 5.8 specifically, these are what an interviewer will probe hardest.

**Tool assignment:** this phase is mostly you + Claude directly (prompt/orchestration design is the one place Rules.md reserves for direct ownership) — Antigravity for 5.6/5.7 UI only after the backend logic is solid.

---

## Phase 6 — Polish, Testing, Deploy

*Goal: make it demoable cold, to anyone, at any time.*

- [ ] 6.1 — Error states and empty states across all four tabs (per Rules.md Section 4 and Design.md's writing guidance)
- [ ] 6.2 — Loading states for all analyzer runs (not just the correlation engine's Thread animation)
- [ ] 6.3 — Responsive pass — verify tablet-width degradation per Design.md Section 9
- [ ] 6.4 — Accessibility pass — focus rings, contrast check on real rendered components, `prefers-reduced-motion` verification
- [ ] 6.5 — Set up ESLint + Prettier + Husky pre-commit across both repos (if not already done in Phase 1 — flag if it was deferred)
- [ ] 6.6 — Rate limiting and repo-size caps on `/analyze/*` endpoints (Rules.md Section 5, flagged as deferred from earlier phases)
- [ ] 6.7 — Deploy `codeinsight-web` to Vercel, `codeinsight-api` to Railway, verify env vars, verify Clerk/Neon/Anthropic keys work in production
- [ ] 6.8 — End-to-end smoke test in production: sign up fresh, load demo project, run all three analyzers, run correlation, confirm the full loop works with zero local setup
- [ ] 6.9 — Record the demo video (per your original interview-readiness goal)
- [ ] 6.10 — Final Memory.md update summarizing the whole build, key decisions, and known limitations — this becomes your interview prep notes as much as a dev log

---

## Explicitly Deferred (Do Not Build in MVP Phases)

Pulled directly from PRD Section 4.2 / 7 — listed here so no phase accidentally scope-creeps into these:
- Multi-language code parsing beyond JS/TS
- Team workspaces, collaboration, RBAC
- Live/write DB connections
- Log file upload backend processing
- Native mobile experience
- Dark mode
