import type { Finding } from '@codeinsight/shared-contracts';
import type { DatabaseAnalyzerInput } from '../types.js';

/**
 * Deterministic database DDL schema from codeinsight-demo-repo/db/schema.sql
 */
export const DEMO_SCHEMA_SQL = `-- TaskLedger PostgreSQL Database Schema

CREATE TABLE organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    plan_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
    tier VARCHAR(50) NOT NULL DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_org_id ON users(organization_id);

CREATE TABLE projects (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_org_id ON projects(organization_id);

CREATE TABLE tasks (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id),
    assigned_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    estimated_hours NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata_json TEXT,
    audit_trail_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: Index exists on project_id, but NO index exists on assigned_user_id or status
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

CREATE TABLE ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL REFERENCES tasks(id),
    user_id VARCHAR(64) NOT NULL REFERENCES users(id),
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    hours_billed NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_task_id ON ledger_entries(task_id);
`;

/**
 * Deterministic database query array from codeinsight-demo-repo/db/queries.sql
 */
export const DEMO_QUERIES_SQL: string[] = [
  // Query 1: User Dashboard Pending Tasks
  `SELECT id, title, status, priority, due_date FROM tasks WHERE assigned_user_id = 'usr_101' AND status = 'pending' ORDER BY due_date ASC;`,

  // Query 2: Project Task Summary Count (SELECT *)
  `SELECT * FROM tasks WHERE project_id = 'prj_001';`,

  // Query 3a: Multi-Project Billing Audit
  `SELECT id, name, organization_id FROM projects WHERE organization_id = 'org_999';`,

  // Query 3b: Loop over project ID
  `SELECT * FROM tasks WHERE project_id = 'prj_001';`,

  // Query 3c: Loop over task ID
  `SELECT * FROM ledger_entries WHERE task_id = 'tsk_501';`,

  // Query 4: Financial Audit Transaction Log Export
  `SELECT id, task_id, user_id, amount, currency, status, created_at FROM ledger_entries WHERE status = 'completed' ORDER BY created_at DESC;`,

  // Query 5: User Profile Fetch for Account Header (SELECT *)
  `select * from users where id = 'usr_101';`,

  // Query 6: Mobile App User Task Feed (Duplicate filter predicate of Query 1)
  `select t.project_id, t.id as task_id, t.title, t.priority, t.status, t.due_date, t.estimated_hours from tasks t where t.assigned_user_id = 'usr_101' and t.status = 'pending' order by t.due_date asc, t.priority desc;`,

  // Query 7: Organization Task Activity Stream (Missing LIMIT)
  `SELECT id, project_id, assigned_user_id, title, status, created_at FROM tasks WHERE status IN ('pending', 'in_progress') ORDER BY created_at DESC;`,

  // Query 8: High Cost Task Ranking Report (ORDER BY non-indexed column)
  `SELECT id, title, estimated_hours, hourly_rate, (estimated_hours * hourly_rate) AS estimated_cost FROM tasks WHERE project_id = 'prj_001' ORDER BY hourly_rate DESC;`,

  // Query 9: Overdue Tasks Alert Summary (Repeated WHERE clause - Part 1)
  `SELECT id, title, assigned_user_id, due_date FROM tasks WHERE status = 'pending' AND due_date < CURRENT_TIMESTAMP;`,

  // Query 10: Overdue Financial Exposure Report (Repeated WHERE clause - Part 2)
  `SELECT t.id, t.project_id, t.assigned_user_id, (t.estimated_hours * t.hourly_rate) AS unbilled_risk FROM tasks t WHERE t.status = 'pending' AND t.due_date < CURRENT_TIMESTAMP;`,

  // Query 11: Task List with Billed Hours Subquery (Correlated subquery)
  `SELECT t.id, t.title, t.estimated_hours, (SELECT SUM(l.hours_billed) FROM ledger_entries l WHERE l.task_id = t.id) AS total_hours_logged FROM tasks t WHERE t.project_id = 'prj_001';`,

  // Query 12: Unique Project Task Names Lookup (Unnecessary DISTINCT)
  `SELECT DISTINCT id, title, status FROM tasks WHERE project_id = 'prj_001';`,
];

/**
 * Standardized Database Analyzer Input fixture.
 */
export const DEMO_DATABASE_INPUT: DatabaseAnalyzerInput = {
  schemaSql: DEMO_SCHEMA_SQL,
  queriesSql: DEMO_QUERIES_SQL,
};

/**
 * Canonical Ground-Truth Expected Findings for the Database Analyzer against codeinsight-demo-repo.
 * Strictly mirrors docs/EXPECTED_FINDINGS.md Section "SQL Analyzer".
 */
export const DEMO_EXPECTED_DATABASE_FINDINGS: Finding[] = [
  {
    id: 'demo-sql-finding-001',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'medium',
    title: 'Unbounded SELECT * Query on tasks Table',
    description:
      "Query 2 executes SELECT * on tasks table, fetching unneeded JSON payload columns ('metadata_json', 'audit_trail_json') and increasing network bandwidth.",
    recommendation:
      'Explicitly select required column names instead of SELECT * to reduce query payload size and memory footprint.',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: "SELECT * FROM tasks WHERE project_id = 'prj_001';",
        threshold: 'SELECT * forbidden on high-cardinality tables',
      },
    ],
    metadata: {
      ruleId: 'select-star',
      queryIndex: 1,
      table: 'tasks',
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-002',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'low',
    title: 'SELECT * Query on users Table',
    description: 'Query 5 executes SELECT * on users table for user badge header display.',
    recommendation: 'Specify explicit columns (id, name, email) instead of SELECT *.',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: "select * from users where id = 'usr_101';",
        threshold: 'SELECT * usage detected',
      },
    ],
    metadata: {
      ruleId: 'select-star',
      queryIndex: 6,
      table: 'users',
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-003',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'medium',
    title: 'Duplicate Filter Query Logic across Application Code',
    description:
      "Query 6 (Mobile App User Task Feed) duplicates Query 1 filter logic (WHERE assigned_user_id = 'usr_101' AND status = 'pending').",
    recommendation:
      'Consolidate user task queries into a single parameterized data access method to prevent query plan fragmentation.',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: "where t.assigned_user_id = 'usr_101' and t.status = 'pending'",
        threshold: 'Identical filter predicate duplicated in queries 1 and 6',
      },
    ],
    metadata: {
      ruleId: 'duplicate-query',
      queryIndices: [0, 7],
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-004',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'high',
    title: 'Missing LIMIT Clause on Activity Stream Query',
    description:
      'Query 7 queries active tasks ordered by created_at DESC without a LIMIT clause, risking unbounded memory consumption as the table grows.',
    recommendation:
      'Add an explicit LIMIT clause (e.g. LIMIT 50) and pagination cursor to restrict result set size.',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet:
          "SELECT id, project_id, assigned_user_id, title, status, created_at FROM tasks WHERE status IN ('pending', 'in_progress') ORDER BY created_at DESC;",
        threshold: 'ORDER BY query missing LIMIT clause',
      },
    ],
    metadata: {
      ruleId: 'missing-limit',
      queryIndex: 8,
      table: 'tasks',
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-005',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'high',
    title: 'ORDER BY on Non-Indexed Column (hourly_rate)',
    description:
      'Query 8 sorts tasks by hourly_rate DESC, which is not indexed on tasks, forcing expensive disk/memory sorting.',
    recommendation:
      'Create a composite index on tasks(project_id, hourly_rate DESC) or single index on tasks(hourly_rate DESC).',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: 'ORDER BY hourly_rate DESC;',
        threshold: 'Column hourly_rate lacks index on tasks',
      },
    ],
    metadata: {
      ruleId: 'unindexed-order-by',
      queryIndex: 9,
      table: 'tasks',
      column: 'hourly_rate',
      suggestedIndex: 'CREATE INDEX idx_tasks_hourly_rate ON tasks(hourly_rate DESC);',
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-006',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'high',
    title: 'Correlated Subquery Executed Per Row',
    description:
      'Query 11 executes a correlated subquery (SELECT SUM(...) FROM ledger_entries WHERE task_id = t.id) per row of tasks.',
    recommendation:
      'Rewrite using LEFT JOIN ledger_entries l ON l.task_id = t.id GROUP BY t.id to aggregate values in a single database pass.',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: '(SELECT SUM(l.hours_billed) FROM ledger_entries l WHERE l.task_id = t.id)',
        threshold: 'Correlated subquery in SELECT projection',
      },
    ],
    metadata: {
      ruleId: 'correlated-subquery',
      queryIndex: 12,
      table: 'tasks',
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-007',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'medium',
    title: 'Repeated WHERE Clause Filter Predicate',
    description:
      "Query 9 and Query 10 repeat the exact predicate: WHERE status = 'pending' AND due_date < CURRENT_TIMESTAMP.",
    recommendation:
      "Consider a partial index on tasks(due_date) WHERE status = 'pending' or extracting a shared database view.",
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: "WHERE status = 'pending' AND due_date < CURRENT_TIMESTAMP",
        threshold: 'Identical filter predicate repeated across queries 9 and 10',
      },
    ],
    metadata: {
      ruleId: 'repeated-where-clause',
      queryIndices: [10, 11],
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
  {
    id: 'demo-sql-finding-008',
    sessionId: 'demo-session-db-001',
    analyzer: 'database',
    category: 'query_optimization',
    severity: 'low',
    title: 'Unnecessary DISTINCT Keyword on Primary Key Query',
    description:
      'Query 12 specifies DISTINCT on queries involving primary key column id, introducing redundant deduplication overhead.',
    recommendation: 'Remove DISTINCT keyword as primary key column id guarantees row uniqueness.',
    evidence: [
      {
        source: 'codeinsight-demo-repo/db/queries.sql',
        snippet: "SELECT DISTINCT id, title, status FROM tasks WHERE project_id = 'prj_001';",
        threshold: 'DISTINCT keyword used on unique primary key projection',
      },
    ],
    metadata: {
      ruleId: 'unnecessary-distinct',
      queryIndex: 13,
      table: 'tasks',
    },
    createdAt: '2026-08-11T00:00:00.000Z',
  },
];
