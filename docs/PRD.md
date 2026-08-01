# PRD.md — CodeInsight

**Product Requirements Document**
**Version:** 1.1
**Status:** MVP Definition
**Owner:** Pratik

---

## 1. Project Vision

### 1.1 One-Line Pitch
CodeInsight is an AI-native engineering intelligence platform that analyzes code architecture, database queries, and application logs together — then uses Claude to correlate findings across all three and tell you the *actual* root cause of your application's problems, not just three separate reports.

### 1.2 Vision Statement
Most engineers debug performance and reliability issues by manually jumping between their codebase, their database, and their logs — mentally connecting dots that no single tool sees together. CodeInsight closes that gap. It ingests all three signal types, runs deterministic analysis where correctness matters (parsing, query plans, anomaly detection), and uses Claude's reasoning where judgment matters (architecture trade-offs, root-cause correlation, prioritized fixes) — then presents one unified, actionable picture of application health instead of three disconnected dashboards.

### 1.3 Why This Project Exists
- Built as a flagship portfolio project to demonstrate systems-level engineering judgment, not just CRUD/API skills.
- Solves a problem the builder (and any engineer) genuinely experiences: disconnected tooling across code quality, database performance, and operational logs.
- Designed to start as a personal-use tool (analyze own projects, portfolio repos, open-source repos) with an explicit architecture that scales toward a team/B2B tool later — without needing a rewrite.

### 1.4 Positioning
"CodeInsight is for anyone who has ever asked: *why is my app slow, and which layer is actually to blame?*" — starting with solo developers and students auditing their own code, architected from day one so the same core (analyzers + correlation engine) could serve an engineering team monitoring a shared codebase later.

---

## 2. Target Users

### 2.1 Primary Persona (MVP Focus) — "Solo Builder"
- Engineering students / freshers / solo developers preparing portfolios or auditing side projects.
- Has intermediate-to-advanced coding skill but limited exposure to production-scale observability/DB tooling.
- Wants fast, concrete, explainable feedback — not vague scores.
- Uses the tool on their own GitHub repos, personal project databases, and locally generated/simulated logs.

### 2.2 Secondary Persona (Future Direction) — "Team Lead / Senior Engineer"
- Wants a shared view of a team's codebase health, slow queries in production-like environments, and log anomalies across services.
- Cares about prioritization ("what should we fix first") and defensibility of recommendations (why, not just what).
- Will require multi-user auth, shared workspaces, and persistent historical tracking — explicitly **out of scope for MVP**, but architecture must not block it.

### 2.3 Non-Users (Explicitly Not Designing For)
- Enterprises needing SOC2/compliance-grade auditing.
- Real-time production monitoring replacing tools like Datadog/New Relic at scale (this is an analysis/audit tool, not a 24/7 monitoring agent — at least not in MVP).

---

## 3. Problem Statement

| Layer | The Problem Today |
|---|---|
| **Code** | Engineers inherit or grow codebases without visibility into architecture drift, circular dependencies, or accumulating tech debt until it's painful. |
| **Database** | Slow queries are diagnosed by trial and error; most engineers don't deeply understand execution plans or indexing strategy. |
| **Logs** | Logs are voluminous and reactive — read only after something breaks, rarely correlated with the code or query that caused the issue. |
| **The real gap** | No accessible tool connects all three. A slow endpoint might be a code-level N+1 query, a missing index, AND a connection pool misconfiguration showing up in logs — and today, you debug each layer separately, manually stitching the story together. |

---

## 4. Product Goals

### 4.1 MVP Goals (Must Achieve)
1. Ingest a public GitHub repository and produce a real architecture/dependency analysis with a tech-debt view.
2. Accept a SQL schema + query (paste-in) and produce a real, verifiable optimization suggestion with before/after reasoning.
3. Accept application logs (paste-in / upload JSON) and detect real anomalies with statistical grounding.
4. Run a **Correlation Engine** pass where Claude reasons across all three analyses and produces a single prioritized action plan — this is the flagship feature and must be the most polished, most demoable part of the product.
5. Present all of the above in a clean, unified dashboard that can be demoed live, end-to-end, in under 3 minutes, with zero special credentials required.

### 4.2 Non-Goals (Explicitly Out of Scope for MVP)
- No live/continuous production monitoring (this is an on-demand audit tool, not an always-on agent).
- No team workspaces, collaboration, roles, or permissions — auth is single-user account only (see Section 5.7).
- No real cloud account integration (AWS/GCP billing, live DB connections to production systems).
- No custom-trained ML models — all intelligence is either deterministic (parsing/rules) or Claude-API-based reasoning.
- No mobile app / native app — responsive web only.
- No log file upload processing (UI present but disabled — paste-in only for MVP, see Section 5.3).

### 4.3 Success Criteria (How We'll Know MVP Works)
- Can run the full pipeline (code → DB → logs → correlation) against 3+ different real open-source repos without crashing or producing nonsense output.
- The curated CodeInsight Demo Repository reliably surfaces every intentionally planted issue — `docs/EXPECTED_FINDINGS.md` serves as the official regression benchmark and acceptance baseline for the whole platform.
- Correlation Engine output is *specific and traceable* — every claim it makes must point back to a concrete finding from one of the three analyzers (no hallucinated generalities).
- A cold demo (no prior setup shown to the viewer, signed in with a demo account) can go from "open project" to "unified report" in under 3 minutes.
- A previously run analysis can be revisited via a stable project URL without re-running the pipeline.
- Can be explained and defended in a technical interview without hand-waving — every design decision has a reason.

---

## 5. Functional Requirements

*Note on Analyzer Architecture:* All three analyzers (Code, Database, Logs) adhere to a shared platform contract. Every analyzer returns a unified **Finding** model along with supporting **Evidence**, execution **Summary**, quantitative **Metrics**, and top-level **AnalyzerResult** wrapper.

### 5.1 Code Analyzer
- **Input:** Public GitHub repository URL (shallow clone).
- **Processing:**
  - Parse JS/TS files using AST-based extraction.
  - Build a module dependency graph.
  - Detect circular dependencies.
  - Flag code smells (such as excessive file length, duplicated logic patterns, deeply nested conditionals, unused utilities, stale TODO comments, or naming inconsistencies).
  - Estimate test coverage presence (heuristic: test file ratio, not full coverage instrumentation in MVP).
- **Output:**
  - Standardized `AnalyzerResult` payload containing unified `Finding[]` objects.
  - Visual dependency graph (nodes = modules, edges = imports).
  - Tech debt score (composite, explainable — not a black-box number).
  - Ranked list of refactor suggestions with rationale (Claude-generated, grounded in the extracted graph/smells).

### 5.2 Database Analyzer
- **Input:** SQL schema (DDL) + one or more queries (paste-in).
- **Processing:**
  - Parse queries via deterministic SQL parser.
  - Rule-based detection for common anti-patterns (such as missing WHERE-clause indexes, `SELECT *` usage, unbounded result sets without LIMIT, naive N+1 patterns, correlated subqueries, duplicate query structures, unnecessary DISTINCT keywords, or inefficient JOIN ordering heuristics).
  - Claude-generated rewritten query + plain-English explanation of the fix and estimated impact.
- **Output:**
  - Standardized `AnalyzerResult` payload containing unified `Finding[]` objects.
  - Before/after query comparison.
  - Specific index recommendations (with the exact `CREATE INDEX` statement).
  - Explanation of *why* the original query was inefficient.

### 5.3 Log Analyzer
- **Input:** Structured JSON logs via paste-in textarea only for MVP. An "Upload Log File" UI element is present but disabled, labeled "Coming Soon" (planned support: JSON, NDJSON, `.log`) — visible to communicate roadmap without adding MVP implementation complexity. Synthetic log generator included as part of the curated demo repository (see Section 5.6).
- **Processing:**
  - Statistical anomaly detection (e.g., z-score/threshold-based spike detection on error rate, latency, custom numeric fields).
  - Time-windowed pattern detection (for instance, error rate spikes over a 2-minute window, connection pool exhaustion, memory leak trends, slow DB query warnings, transient connection timeouts, HTTP 500 spikes, or transaction retry recoveries).
  - Claude-generated correlation between distinct anomalies (e.g., "pool exhaustion warning precedes error spike by 2 seconds").
- **Output:**
  - Standardized `AnalyzerResult` payload containing unified `Finding[]` objects.
  - Timeline visualization with anomalies highlighted.
  - Ranked anomaly list with severity and explanation.

### 5.4 Correlation Engine (Flagship Feature)
- **Input:** Structured outputs from all three analyzers above (for the same "session"/project context).
- **Processing:**
  - Claude, via function calling, is given access to `get_code_findings()`, `get_query_findings()`, `get_log_findings()`.
  - Claude reasons about causal/contributing relationships between findings across layers.
  - Must ground every claim in a specific finding ID from an analyzer — no free-floating claims.
- **Output:**
  - A single unified report: "Your system has N connected issues," each with a cross-layer explanation.
  - A prioritized action plan ranked by estimated impact vs. effort.
  - Streaming output so the reasoning is visibly "thinking" in the UI (this is a deliberate demo/UX choice, not just a technical convenience).

### 5.5 Dashboard / Unified UI
- Tabbed interface: Code / Database / Logs / Unified Report, scoped to a selected **Project**.
- Each tab independently usable (you can demo DB analysis alone without running the others).
- Unified tab only unlocks after at least one analysis in each of the three categories has been run for that project.
- "My Projects" view lists all saved projects for the logged-in user (e.g., "Express.js Audit," "CodeInsight Demo Repository," "Portfolio Website"), each opening directly into its last-computed state without re-running analysis.

### 5.6 Demo Data Layer — CodeInsight Demo Repository
- A dedicated, public GitHub repository owned and maintained by the builder, intentionally engineered to contain a known, documented set of issues:
  - **Code layer:** realistic architecture issues such as circular dependencies, long methods, duplicated logic, stale TODOs, unused utilities, and subtle naming inconsistencies.
  - **Database layer:** realistic SQL anti-patterns such as missing indexes, N+1 query patterns, unbounded result sets, slow queries, correlated subqueries, duplicate query logic, and unnecessary DISTINCT calls.
  - **Runtime layer:** realistic operational events such as connection pool exhaustion, memory leak trends, slow DB queries, transient timeouts, HTTP 500 errors, retry recoveries, and clean baseline periods.
- Loadable with one click as a pre-configured "project" — no user input required, making cold interview demos reliable and repeatable.
- `docs/EXPECTED_FINDINGS.md` serves as the canonical regression benchmark and acceptance baseline: every planted issue and cross-layer correlation causal chain is documented ahead of time so analyzer precision can be validated deterministically.
- Treated as a first-class product artifact, not just internal test data — referenced in the dashboard as a real, linkable public repo.

### 5.7 Authentication & Project Persistence
- **Auth provider:** Clerk or Supabase Auth (decision deferred to Architecture.md) — single-user accounts only, no organizations/teams in MVP.
- **Data model (conceptual):** `User → Projects → Analysis Sessions → Findings → Reports`.
- Every analysis run (code, DB, log, or unified) is saved against a **Project** owned by the authenticated user, not treated as ephemeral.
- Projects are revisitable via a stable URL — opening a project loads its last-computed architecture graph, SQL analysis, log findings, and unified report without recomputation, unless the user explicitly triggers a re-analysis.
- Explicitly excluded from MVP: team workspaces, shared/collaborative projects, role-based access control, organization accounts.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Full pipeline (code + DB + log + correlation) should complete in under 60 seconds for a small-to-medium repo (<200 files) on the demo dataset. |
| **Reliability** | Deterministic analyzers (SQL parsing, dependency graphs, anomaly detection) must never silently fail — errors surface clearly in the UI, not as blank states. |
| **Explainability** | Every AI-generated claim must be traceable to a concrete, deterministic finding. No unverifiable/generic AI output presented as fact. |
| **Cost Efficiency** | Claude API usage should be scoped carefully (batch reasoning calls, avoid redundant calls) — stay within free/low-tier usage during development and demo. |
| **Security (MVP-appropriate)** | No cloud/database credentials ever requested from the user. Repo cloning is read-only, shallow, and sandboxed. No arbitrary code execution from uploaded/cloned repositories. Auth handled entirely by a managed provider (Clerk/Supabase Auth) — no custom password/credential storage or handling. |
| **Portability** | Must run and demo correctly from a fresh deploy with zero manual setup steps beyond environment variables. |
| **Accessibility** | Reasonable contrast, keyboard navigability on core flows — not a full WCAG audit for MVP, but not ignored either. |
| **Extensibility** | Each analyzer must be structurally independent (separate module/service boundary) so a 4th analyzer (e.g., security scanner, performance profiler) could be added later without refactoring the other three. |

---

## 7. MVP Scope Summary

**In scope:**
- Code Analyzer (GitHub public repo, JS/TS only for MVP)
- Database Analyzer (PostgreSQL/MySQL-dialect SQL, paste-in schema + queries)
- Log Analyzer (structured JSON logs, paste-in only; upload UI visible but disabled)
- Correlation Engine (Claude-orchestrated, streaming, grounded reasoning)
- Unified dashboard scoped to persistent, revisitable Projects
- Curated, publicly hosted CodeInsight Demo Repository as a one-click benchmark project
- Single-user authentication (Clerk/Supabase Auth) with database-backed project persistence

**Out of scope (MVP):**
- Multi-language code parsing (Python, Java, Go, etc.) — JS/TS only initially
- Team workspaces, collaboration, organizations, role-based access control
- Live database connections (read-only paste-in only)
- Live cloud/production log streaming
- Log file upload processing (UI present, backend not implemented)
- Mobile-native experience

---

## 8. Future Roadmap (Post-MVP)

### Phase 2 — Depth
- Multi-language support for Code Analyzer (Python first, given its prevalence).
- Live read-only DB connection option (still no write access) for real EXPLAIN ANALYZE plans instead of paste-in only.
- Historical tracking: re-run analysis on the same repo over time, show trend of tech debt score / query health.

### Phase 3 — Team Direction
- Team workspaces and shared/collaborative projects (building on the single-user auth + project model already in MVP).
- Role-based access control for shared projects.
- Scheduled re-analysis (e.g., weekly tech-debt report for a team's repo).
- Slack/webhook integration for anomaly alerts.

### Phase 4 — Platform Maturity
- Plugin architecture for custom analyzers (security scanning, dependency vulnerability checks).
- Exportable reports (PDF/Markdown) for stakeholder sharing.
- Public "analyze any open-source repo" leaderboard/showcase mode (marketing/growth angle).

---

## 9. Finalized Scope Decisions

These were open questions in draft v0.1 and are now locked for Architecture.md:

1. **Demo Dataset:** Support analysis of any public GitHub repository while also providing a built-in, publicly hosted **CodeInsight Demo Repository** containing intentionally designed architecture, database, and runtime issues — used for deterministic demonstrations and as the platform's official regression benchmark with `docs/EXPECTED_FINDINGS.md` as the acceptance baseline (see Section 5.6).

2. **Log Input:** MVP supports structured JSON log paste-in only. A disabled "Upload Log File" interface is included in the UI to communicate the planned roadmap (JSON, NDJSON, `.log` support) without increasing MVP implementation complexity (see Section 5.3).

3. **Session Persistence:** Authentication and database-backed project sessions are included in the MVP. Every analysis is stored as a persistent **Project** that the authenticated user can revisit, compare, and share via a stable project URL. Team workspaces, collaboration, and role-based access control remain out of scope for MVP (see Section 5.7).

**Remaining open question for Architecture.md:** Clerk vs. Supabase Auth — trade-off (ease of integration + free tier limits + how well it pairs with the chosen backend/DB) to be resolved when we design the auth flow concretely.

---

## 10. Document Control
- This PRD is the source of truth for scope. Architecture.md, Design.md, Rules.md, and Phases.md must all trace back to requirements defined here.
- Any scope change during development must be reflected back into this document, not just decided ad hoc in a coding session.
