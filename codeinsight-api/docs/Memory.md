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

- **Current Phase:** Not yet started — planning complete (PRD, Architecture, Design, Rules, Phases all locked as of doc-creation date)
- **Repos initialized:** No
- **Demo repository (`codeinsight-demo-repo`) built:** No
- **Auth working end-to-end:** No
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

*(Newest entries at the top. Nothing logged yet — first entry gets added after Phase 0 begins.)*
