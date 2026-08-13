# CodeInsight — AI-Native Engineering Intelligence Platform

CodeInsight correlates code architecture, database query performance, and runtime log anomalies to surface exact root causes using Claude reasoning.

---

## 🛠️ Monorepo Architecture

- **`codeinsight-web`**: React 18 + TypeScript + Vite SPA (`http://localhost:5173`)
- **`codeinsight-api`**: Node.js + Fastify + Drizzle ORM backend service (`http://localhost:3001`)
- **`packages/shared-contracts`**: Shared TypeScript domain interfaces (`Finding`, `Evidence`, `AnalyzerResult`, `Severity`, `Category`)
- **`codeinsight-demo-repo`**: Curated TaskLedger domain benchmark application fixture

---

## 🚀 Local Developer Setup

### 1. Prerequisites

- Node.js `v20+` or `v24+`
- npm `v10+`

### 2. Installation

Install all workspace dependencies from the monorepo root:

```bash
npm install
```

### 3. Environment Configuration

Copy the template configuration to `.env` in the repository root:

```bash
cp .env.example .env
```

Edit `.env` and fill in your developer credentials:

```env
# Frontend Variables
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001

# Backend Variables
DATABASE_URL=postgresql://user:password@ep-xyz.aws.neon.tech/neondb?sslmode=require
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
```

### 4. Running the Application

Start both backend API (`:3001`) and frontend web SPA (`:5173`) simultaneously:

```bash
npm run dev
```

Press `Ctrl+C` to stop both processes cleanly.

---

## 📋 Available Monorepo Commands

| Command                   | Purpose                                                   |
| ------------------------- | --------------------------------------------------------- |
| `npm run dev`             | Runs `codeinsight-api` and `codeinsight-web` concurrently |
| `npm run typecheck`       | Runs TypeScript typecheck across all monorepo workspaces  |
| `npm run build`           | Builds shared contracts and production client bundles     |
| `npm run build:contracts` | Builds `@codeinsight/shared-contracts` package            |

---

## 🔐 Security & Environment Rules

- **Frontend (`codeinsight-web`)**: Uses `VITE_*` environment variables only. Never expose backend secrets (`CLERK_SECRET_KEY`, `DATABASE_URL`) to client-side code.
- **Backend (`codeinsight-api`)**: Fails fast if required authentication or database credentials are missing. Loads `.env` at boot.
- **Git Hygiene**: `.env` is gitignored across all workspaces. Only `.env.example` templates are tracked.
