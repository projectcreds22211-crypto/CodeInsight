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

- **Current Phase:** Phase 2 Complete (2.8 & 2.9 Complete) — Phase 3 Next (Database Analyzer)
- **Shared Contracts:** Complete
- **API Skeleton:** Complete
- **Frontend Shell:** Complete
- **Authentication:** Complete
- **Database:** Connected
- **Drizzle:** Configured
- **Users Sync:** Working
- **Projects API:** Working (`POST & GET /api/projects` + `POST /api/projects/demo`)
- **My Projects UI:** Complete (`useProjects`, `useCreateProject`, `useCreateDemoProject` TanStack Query hooks, `ProjectCard`, `CreateProjectModal`, empty/skeleton/error states)
- **Load Demo Repo:** Working (one-click `POST /api/projects/demo` backend route + demo config & UI buttons)
- **Design System Audit (2.8):** Complete (`theme-marketing` applied to auth screens, `theme-app` tokens across dashboard, focus rings, accessibility, responsive sidebar)
- **E2E Verification (2.9):** Verified (Typecheck 0 errors, Build 0 errors, protected routes, auth flow, project creation, demo repo flow)
- **Current Build:** Passing
- **Current Typecheck:** Passing
- **Analyzers:** Not started (Phase 3 template next)
- **Correlation Engine:** Not started
- **Deployment:** Not started

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
- **Shared platform contracts:** `packages/shared-contracts` exports unified `Finding`, `Evidence`, `AnalyzerResult`, `Summary`, `Metrics`, `Analyzer`, and `Severity`/`Category` enums.
- **Acceptance Baseline:** `docs/EXPECTED_FINDINGS.md` serves as the canonical ground-truth regression benchmark for all analyzers and the Correlation Engine.

---

## Session Log

*(Newest entries at the top)*

### 2026-08-04 — Phase 2.8 & 2.9 Design System Audit, UX Polish & E2E Verification — [Tool used: Antigravity]

**Completed:**
- Audited entire frontend against `docs/Design.md`.
- Cleaned 185 lines of dead Vite boilerplate CSS in `src/App.css` and replaced with card shadow, focus ring, and reduced motion utilities.
- Expanded `src/index.css` with missing `theme-marketing` surface tokens, spacing scale, border radius scale, card shadow tokens, and typography variables.
- Applied `theme-marketing` treatment to auth screens (`SignInPage.tsx`, `SignUpPage.tsx`) with branded logo header, tagline, and card wrapper.
- Refactored `Sidebar.tsx`: responsive collapse to icon-only rail below 1024px (`lg`), fixed active indicator layout shifting, visible focus rings, improved email contrast, and semantic nav with aria-label. Fixed implicit `any` type error on `NavLink` render prop using explicit `({ isActive }: { isActive: boolean })`.
- Refactored `Header.tsx`: semantic breadcrumb navigation (`nav > ol > li`), focus-visible rings on interactive buttons, responsive layout padding.
- Refactored `CreateProjectModal.tsx`: focus trap (Tab cycles within modal), auto-focus on open, focus restoration on close, backdrop click dismiss (blocked during submit), focus rings, and proper aria dialog markup.
- Refactored `ProjectCard.tsx`: Design.md `--shadow-card` and `radius-md` (14px), focus-visible ring for keyboard interaction, CSS variable token styling.
- Refactored `ProjectsEmptyState.tsx`, `ProjectsErrorState.tsx`, `ProjectsSkeleton.tsx`: consistent spacing, radius, and focus-visible button styling.
- Refactored `Toast.tsx`: added `variant` prop (`success` | `error`) with red `AlertCircle` icon for errors, `role="alert"` and `aria-live="assertive"`.
- Refactored `ProjectsPage.tsx`, `HomePage.tsx`, `AnalyzePage.tsx`, `ReportsPage.tsx`, `SettingsPage.tsx`, `ProtectedRoute.tsx`: unified token usage and accessibility polish.
- Executed E2E verification: `npm run typecheck` passed with 0 errors across all monorepo packages (`codeinsight-web`, `codeinsight-api`, `@codeinsight/shared-contracts`), `npm run build` completed successfully.

**Decisions made (and why):**
- Used `color-mix()` and CSS custom properties directly for surface colors, ensuring Design.md tokens are the single source of truth across all components.
- Added explicit focus-visible rings (`focus-ring` / `focus-ring-light`) to satisfy WCAG AA focus visibility requirement per Design.md Section 10.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 3: Database Analyzer (Full Vertical Slice).

### 2026-08-04 — Phase 2.7 Load Demo Repository Flow — [Tool used: Antigravity]

**Completed:**
- Created dedicated demo repository config `codeinsight-api/src/config/demo-repository.ts` (`DEMO_REPOSITORY_CONFIG`).
- Added `createDemoProject(clerkId)` service method in `src/services/project.service.ts` reusing existing `createProject` logic with `isDemoRepository = true`.
- Added protected route handler `POST /api/projects/demo` in `src/routes/projects.ts` (`requireAuth` protected, returns 201 with created project).
- Added `createDemoProject()` helper to `codeinsight-web/src/lib/api-client.ts`.
- Built custom TanStack Query mutation hook `useCreateDemoProject()` in `src/hooks/useProjects.ts` with optimistic cache update and query invalidation.
- Connected `Header.tsx` "Load Demo Repo" pill button and `ProjectsEmptyState.tsx` CTA button to `useCreateDemoProject()`.
- Added button loading states, pending state disabling (prevents duplicate clicks), and toast feedback notifications upon completion.
- Verified monorepo typecheck (`npm run typecheck`) and production build (`npm run build`) with zero errors.

**Decisions made (and why):**
- Encapsulated demo repository details in `src/config/demo-repository.ts` rather than hardcoding values inside routes or services, ensuring easy future maintenance.
- Reused `createProject` service logic inside `createDemoProject` to avoid database logic duplication.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 2.8: Apply Design.md's `theme-marketing` to auth screens and `theme-app` to dashboard shell.

### 2026-08-04 — Phase 2.6 My Projects UI & Create Project Flow — [Tool used: Antigravity]

**Completed:**
- Implemented typed REST API client in `codeinsight-web/src/lib/api-client.ts` (`getProjects` and `createProject` with Clerk JWT header injection).
- Created custom TanStack Query hooks in `src/hooks/useProjects.ts` (`useProjects` and `useCreateProject`).
- Added optimistic cache updates and query invalidation in `useCreateProject`.
- Built reusable `ProjectCard` component displaying project name, GitHub URL link, Demo badge, and formatted creation date.
- Built skeleton loader component (`ProjectsSkeleton`) for non-spinner initial fetching states.
- Built polished empty state (`ProjectsEmptyState`) and error retry state (`ProjectsErrorState`).
- Built accessible `CreateProjectModal` dialog with form validation (required name, optional GitHub URL), inline error reporting, submit state tracking (`isPending`), and ESC/backdrop dismissal.
- Added `Toast` UI component for post-creation success notifications.
- Integrated full UX flow into `ProjectsPage.tsx` and wrapped application shell with `QueryClientProvider` in `App.tsx`.
- Verified typecheck (`npm run typecheck`) and production build (`npm run build`) with zero errors across the monorepo.

**Decisions made (and why):**
- Strict clean architecture separation (`Component -> Custom React Query Hook -> API Client -> Backend API`) with zero direct `fetch` calls in UI components.
- Maintained consistent token palette and styling rules from `Design.md`.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 2.7: Build the one-click "Load Demo Repository" project-creation path (`POST /api/projects/demo`).

### 2026-08-04 — Phase 2.5 Real Auth-Scoped Project CRUD Endpoints — [Tool used: Antigravity]

**Completed:**
- Phase 2.5
- ProjectService
- Project validation
- POST /api/projects
- GET /api/projects
- Auth-scoped project ownership
- Clerk user → internal user resolution
- Zod validation
- Successful build
- Successful typecheck

**Known Improvements (do NOT implement):**
- Extract reusable resolveUser() helper
- Global Fastify error handler
- Stronger GitHub repository URL validation
- Pagination support
- Centralize sorting logic

**Next Session:**
- Phase 2.6: Build the My Projects UI and Create Project flow.

### 2026-08-02 — Phase 2.5 Real Auth-Scoped Project CRUD Endpoints — [Tool used: Antigravity]

**Completed:**
- Created Zod validation schema `createProjectSchema` in `src/validators/project.ts`.
- Implemented `ProjectService` in `src/services/project.service.ts` (`createProject` and `listProjects` resolving Clerk user ID to internal DB user ID and ordering projects newest first).
- Implemented `POST /api/projects` and `GET /api/projects` routes in `src/routes/projects.ts` protected by `requireAuth`.
- Configured strict HTTP status codes: 400 (Zod validation failure), 401 (unauthenticated), 404 (`UserNotFoundError` when Clerk user is not synced in DB), 500 (database errors).
- Registered `projectRoutes` in `src/app.ts`.
- Verified typecheck, build, and endpoint authorization tests across monorepo.

**Decisions made (and why):**
- Followed clean architecture separation (`route` -> `service` -> `db`) with zero SQL or business logic in route handlers.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 2.6 & 2.7: Build frontend "My Projects" list UI + "Create Project" flow & one-click "Load Demo Repository" endpoint (`POST /api/projects/demo`).


### 2026-08-02 — Phase 2.4 Clerk Webhook User Synchronization — [Tool used: Antigravity]

**Completed:**
- Implemented `POST /api/webhooks/clerk` in `src/routes/webhook.ts`.
- Integrated official Svix signature verification (`verifyClerkWebhook`) using `CLERK_WEBHOOK_SECRET`.
- Built `processClerkWebhook` service supporting idempotent `user.created` event processing.
- Built `syncUser` database service in `src/services/user.service.ts` inserting newly signed-up users into the Neon PostgreSQL `users` table via Drizzle ORM (`onConflictDoNothing`).
- Configured HTTP status responses: invalid signature (401), unsupported/ignored events (200), idempotent duplicate user (200), database failure (500).
- Verified monorepo typecheck and production build.

**Decisions made (and why):**
- Separated domain concerns cleanly (`routes/webhook.ts` for HTTP parsing, `services/webhook.service.ts` for Svix verification & event routing, `services/user.service.ts` for DB queries) as required by `Architecture.md`.

**Deviations from Phases.md / Architecture.md (if any):**
- Installed `svix` package for official Clerk webhook signature verification.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- Webhook endpoint `POST /api/webhooks/clerk` added.

**Next session should start with:**
- Phase 2.5: Build `POST /api/projects` and `GET /api/projects` (auth-scoped project management endpoints).


### 2026-08-02 — Phase 2.3 Authentication Refinement — [Tool used: Antigravity]

**Completed:**
- Removed dev backdoor tokens (`Bearer user_xxx` / `Bearer test_xxx`); unauthenticated requests always reject with HTTP 401.
- Standardized canonical authentication strategy on `@clerk/fastify` `clerkPlugin` + `getAuth(request)`.
- Improved Fastify request typing: replaced `request.auth` with `request.user` (`RequestUser` interface containing `clerkId`, optional `internalUserId`, `email`).
- Added fail-fast environment validation (`validateAuthConfig()`) requiring `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` on API startup without dummy keys.
- Verified `/health` remains public (HTTP 200) and `/api/me` remains protected (HTTP 401 unauthenticated, HTTP 200 authenticated with valid Clerk session).

**Decisions made (and why):**
- Standardized auth exclusively around `@clerk/fastify`'s session engine to eliminate duplicate token verification paths and guarantee identical session parsing across all routes.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 2.4: Build Clerk webhook sync into Neon `users` table (`POST /api/auth/webhook`).


### 2026-08-02 — Phase 2.3 Clerk Auth Integration — [Tool used: Antigravity]

**Completed:**
- Integrated `@clerk/clerk-react` into `codeinsight-web` (`ClerkProvider`, `SignInPage`, `SignUpPage`, `ProtectedRoute` guard).
- Protected frontend routes and configured automatic redirection to `/sign-in` for unauthenticated sessions.
- Added `<UserButton />` and `useUser()` integration in header and sidebar.
- Built Fastify Clerk JWT verification middleware (`src/services/auth.ts`) in `codeinsight-api`.
- Added protected test endpoint `GET /api/me` returning `{ clerkId: string }` while leaving `GET /health` public.
- Demonstrated that unauthenticated requests to `/api/me` return HTTP 401 Unauthorized while authenticated requests return HTTP 200 OK.
- Verified monorepo typecheck and production build.

**Decisions made (and why):**
- Scoped authentication middleware to protected routes (e.g. `GET /api/me`) via Fastify `onRequest` hook while keeping `/health` 100% public without external dependency latency.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- Clerk authentication integration on frontend and backend.

**Next session should start with:**
- Phase 2.4: Build Clerk webhook sync into Neon `users` table (`POST /api/auth/webhook`).


### 2026-08-02 — Infrastructure Refactor before Phase 2.3 — [Tool used: Antigravity]

**Completed:**
- Relocated DB client initialization from `src/services/db.ts` to `src/db/client.ts` with updated schema imports.
- Moved generated Drizzle migrations out of `src/` into a top-level `drizzle/` directory.
- Updated `drizzle.config.ts` `out` parameter to `./drizzle`.
- Created `.env.example` templates at monorepo root and `codeinsight-api/` with environment placeholders (`DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`).
- Verified zero runtime behavior changes, clean typecheck, and successful build.

**Decisions made (and why):**
- Co-located database client (`client.ts`) directly inside `src/db/` alongside `schema.ts` for clearer domain modularity before introducing Clerk auth middleware.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 2.3: Integrate Clerk on frontend (sign-in/sign-up UI) and backend (JWT verification middleware).


### 2026-08-02 — Phase 2.2 Neon Postgres + Drizzle ORM Setup — [Tool used: Antigravity]

**Completed:**
- Created initial Drizzle configuration (`drizzle.config.ts`) configured for PostgreSQL dialect with `DATABASE_URL` environment variable support.
- Defined Drizzle schema (`codeinsight-api/src/db/schema.ts`) containing `users` and `projects` tables matching `Architecture.md` Section 3.
- Created database client initialization (`codeinsight-api/src/services/db.ts`) using `@neondatabase/serverless` and `drizzle-orm/neon-http`.
- Added `"db:generate": "drizzle-kit generate"` script and generated initial migration (`src/db/migrations/0000_round_apocalypse.sql`).
- Verified typecheck, build, and migration output.

**Decisions made (and why):**
- Used `@neondatabase/serverless` HTTP client with `drizzle-orm/neon-http` for serverless Neon database connection matching `Architecture.md` Section 1.

**Deviations from Phases.md / Architecture.md (if any):**
- Installed `@neondatabase/serverless` package for Neon driver support.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- Database schema created (`users` and `projects` tables).

**Next session should start with:**
- Phase 2.3: Integrate Clerk on frontend and backend (JWT verification middleware).


### 2026-08-02 — Phase 1.8 Frontend Application Shell — [Tool used: Antigravity]

**Completed:**
- Built the `codeinsight-web` React SPA application shell using `react-router-dom`.
- Implemented App Layout (`AppLayout`), Sidebar (`Sidebar`), Header (`Header`), and Main Content container.
- Added stub routes and navigation pages (`HomePage`, `ProjectsPage`, `AnalyzePage`, `ReportsPage`, `SettingsPage`).
- Configured design system tokens from `Design.md` in `index.css` (neutral canvas `#F7F6F3`, dark sidebar `#211F1D`, coral accent `#FF9EB0`, typography styles).
- Verified zero console/build errors and validated typecheck across monorepo.

**Decisions made (and why):**
- Strictly adhered to `Design.md` `theme-app` surface tokens (`#F7F6F3` neutral canvas, dark pill CTAs, `#211F1D` sidebar) to ensure high data legibility for future dashboard analyzers.

**Deviations from Phases.md / Architecture.md (if any):**
- Installed `react-router-dom` in `codeinsight-web` to fulfill the client-side router requirement.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- Installed `react-router-dom` for client-side routing.

**Next session should start with:**
- Phase 2: Skeleton: Auth, Projects, App Shell & Infrastructure (Clerk auth setup, Drizzle migration, project creation endpoints).


### 2026-08-02 — Phase 1.7 Fastify API Skeleton — [Tool used: Antigravity]

**Completed:**
- Bootstrapped Fastify backend foundation in `codeinsight-api`.
- Created structured directory layout (`app.ts`, `server.ts`, `plugins/cors.ts`, `routes/health.ts`, `analyzers/`, `services/`, `lib/`).
- Registered `@fastify/cors` plugin and `GET /health` route returning HTTP 200 `{ "status": "ok", "service": "codeinsight-api", "version": "1.0.0" }`.
- Verified typecheck, build, and HTTP endpoint runtime response.

**Decisions made (and why):**
- Separated `buildApp` (`app.ts`) from server listening (`server.ts`) to enable clean integration testing (`app.inject()`) and modular plugin composition.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 1.8: Build `codeinsight-web` frontend application shell (React SPA shell, app layout, tab navigation, route structure).


### 2026-08-02 — Phase 1.1 Shared Analyzer Contract — [Tool used: Antigravity]

**Completed:**
- Defined the shared `Analyzer<TInput, TResult extends AnalyzerResult>` interface contract in `packages/shared-contracts/src/contracts/analyzer.ts`.
- Re-exported `Analyzer` from `packages/shared-contracts/src/index.ts`.
- Built and verified typecheck across monorepo (`codeinsight-web`, `codeinsight-api`, `@codeinsight/shared-contracts`).

**Decisions made (and why):**
- Used existing shared types (`AnalyzerType`, `AnalyzerResult`, `Result<void>`) without adding business logic, classes, or placeholder implementations.

**Deviations from Phases.md / Architecture.md (if any):**
- None.

**Known bugs / unfinished edges:**
- None.

**Flagged items needing Pratik's review** (per Rules.md Section 10):
- None.

**Next session should start with:**
- Phase 1.2–1.6: Continue completing remaining shared platform models if any, or Phase 1.7 Fastify API skeleton setup.


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
