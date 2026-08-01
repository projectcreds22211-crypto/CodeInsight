# Expected Findings

## Purpose

This document serves as the canonical ground-truth specification and acceptance criteria for the CodeInsight platform's three static analyzers (TypeScript/Code, SQL/Database, and Log/Runtime analyzers) and the Correlation Engine against the `codeinsight-demo-repo` test dataset.

Every item listed in this document represents an intentionally engineered issue or pattern that must be deterministically identified by the platform during automated audits.

---

## TypeScript Analyzer

- **Circular dependency**: `TaskService` (`src/modules/tasks/task.service.ts`) $\rightarrow$ `ReportGenerator` (`src/modules/reports/report.generator.ts`) $\rightarrow$ `LedgerService` (`src/modules/ledger/ledger.service.ts`) $\rightarrow$ `TaskService` (`src/modules/tasks/task.service.ts`).
- **Duplicate validation helper**: `isValidIdFormat(id, prefix)` duplicated in `src/modules/users/user.service.ts` and `src/modules/reports/report.generator.ts`.
- **Unused utility**: `slugifyProjectName` in `src/utils/formatting.ts` is exported but never imported or invoked.
- **Stale TODO**: `// TODO(alex): Deprecate single-currency default fallback after multi-currency schema migration in v1.2` in `src/modules/ledger/ledger.repository.ts`.
- **Naming inconsistency**: `userID: string` parameter in `TaskRepository.findByUserAndStatus` vs `userId: string` used across other interfaces and parameters.

---

## SQL Analyzer

- **SELECT ***: Query 2 (`SELECT * FROM tasks WHERE project_id = 'prj_001'`) and Query 5 (`select * from users where id = 'usr_101'`).
- **Duplicate query**: Query 6 (`Mobile App User Task Feed`) duplicates the core predicate of Query 1 (`WHERE assigned_user_id = 'usr_101' AND status = 'pending'`).
- **Missing LIMIT**: Query 7 (`Organization Task Activity Stream`) queries active tasks ordered by `created_at DESC` without a `LIMIT` clause.
- **ORDER BY non-indexed column**: Query 8 (`High Cost Task Ranking Report`) sorts by `hourly_rate DESC`, which is not indexed on the `tasks` table.
- **Correlated subquery**: Query 11 (`Task List with Billed Hours Subquery`) executes a subquery `(SELECT SUM(...) FROM ledger_entries WHERE task_id = t.id)` per row of `tasks`.
- **Repeated WHERE clause**: Query 9 (`Overdue Tasks Alert Summary`) and Query 10 (`Overdue Financial Exposure Report`) repeat the exact predicate `WHERE status = 'pending' AND due_date < CURRENT_TIMESTAMP`.
- **Unnecessary DISTINCT**: Query 12 (`Unique Project Task Names Lookup`) uses `DISTINCT` on queries involving the Primary Key (`id`).

---

## Log Analyzer

- **Slow query**: `req_0015a` (`10:14:30.000Z`) — `warn`: Slow database query detected on `ledger_entries` (1620ms response time).
- **Connection pool saturation**: `req_0016a` (`10:15:30.000Z`) — `warn`: Connection pool saturation warning (20/20 active connections in use, 16 queued).
- **PostgreSQL connection timeout**: `req_0015b` (`10:14:45.000Z`) — `error`: Primary PostgreSQL connection acquire timed out after 3000ms.
- **HTTP 500**: `req_0015b` (`10:14:48.000Z`) — `error`: Internal Server Error (HTTP 500) caused by database connection timeout.
- **Successful retry**: `req_0015b_retry` (`10:15:50.000Z`) — `info`: Transaction retry succeeded on attempt 2 (HTTP 201, 65ms).

---

## Correlation Engine

**Expected causal chain:**
```
Slow query (req_0015a, 1620ms execution on unindexed ledger_entries query)
  │
  ▼
Pool saturation (activeConnections reaches 20/20 max limit, waiting requests queue up)
  │
  ▼
Connection timeout (req_0015b fails to acquire DB pool connection after 3000ms)
  │
  ▼
HTTP 500 (API returns Internal Server Error to client for req_0015b)
  │
  ▼
Successful retry (req_0015b_retry succeeds on 2nd attempt after transient pool clearance)
```

---

## Regression Rule

Analyzer outputs against this repository must remain strictly deterministic. Any discrepancy, false positive, or missed finding between analyzer results and this baseline specification constitutes a regression in analyzer precision or AST/SQL/Log parsing rules, and must be investigated before committing changes.

---

## Future Analyzer Rules

The following static analysis rule concepts are intentionally deferred and out of scope for the current MVP release:

- **Magic number detection**
- **Unused CTE detection**
- **Large file detection**
- **God service detection**
- **Long parameter list**
- **Excessive nesting**
- **Duplicate SQL similarity scoring**
- **Naming convention scoring**
