-- TaskLedger Core Application Queries

-- Query 1: User Dashboard Pending Tasks
-- Used by GET /api/users/:id/dashboard to display active work items
SELECT id, title, status, priority, due_date
FROM tasks
WHERE assigned_user_id = 'usr_101' AND status = 'pending'
ORDER BY due_date ASC;

-- Query 2: Project Task Summary Count
-- Used by Project Overview service to calculate project completion metrics
SELECT *
FROM tasks
WHERE project_id = 'prj_001';

-- Query 3: Multi-Project Billing Audit (N+1 Query Pattern in Application Loop)
-- Step 3a: Fetch all active projects for organization
SELECT id, name, organization_id
FROM projects
WHERE organization_id = 'org_999';

-- Step 3b: Loop over each project ID returned from Step 3a and execute in application code:
SELECT *
FROM tasks
WHERE project_id = 'prj_001';

-- Step 3c: Loop over each task ID returned from Step 3b and execute in application code:
SELECT *
FROM ledger_entries
WHERE task_id = 'tsk_501';

-- Query 4: Financial Audit Transaction Log Export
-- Used by accounting reconciliation job to list completed ledger entries
SELECT id, task_id, user_id, amount, currency, status, created_at
FROM ledger_entries
WHERE status = 'completed'
ORDER BY created_at DESC;

-- Query 5: User Profile Fetch for Account Header (SELECT *)
-- Added by frontend team to load basic user badge info (fetches large unnecessary columns)
select * from users where id = 'usr_101';

-- Query 6: Mobile App User Task Feed (Independently created query duplicating Query 1 predicate)
-- Created by mobile team for task list view; duplicates Query 1 filter logic with extra columns and secondary sort
select
    t.project_id,
    t.id as task_id,
    t.title,
    t.priority,
    t.status,
    t.due_date,
    t.estimated_hours
from tasks t
where t.assigned_user_id = 'usr_101'
  and t.status = 'pending'
order by t.due_date asc, t.priority desc;

-- Query 7: Organization Task Activity Stream (Missing LIMIT on dashboard query)
-- Missing LIMIT clause on a potentially massive table for live dashboard feed
SELECT id, project_id, assigned_user_id, title, status, created_at
FROM tasks
WHERE status IN ('pending', 'in_progress')
ORDER BY created_at DESC;

-- Query 8: High Cost Task Ranking Report (ORDER BY non-indexed column)
-- Performs ORDER BY on hourly_rate (non-indexed column), causing an expensive external sort
SELECT id, title, estimated_hours, hourly_rate, (estimated_hours * hourly_rate) AS estimated_cost
FROM tasks
WHERE project_id = 'prj_001'
ORDER BY hourly_rate DESC;

-- Query 9: Overdue Tasks Alert Summary (Repeated WHERE clause logic - Part 1)
-- Shared filter logic for overdue pending items (used in cron job)
SELECT id, title, assigned_user_id, due_date
FROM tasks
WHERE status = 'pending' AND due_date < CURRENT_TIMESTAMP;

-- Query 10: Overdue Financial Exposure Report (Repeated WHERE clause logic - Part 2)
-- Re-uses exact same WHERE clause logic (status = 'pending' AND due_date < CURRENT_TIMESTAMP)
SELECT t.id, t.project_id, t.assigned_user_id, (t.estimated_hours * t.hourly_rate) AS unbilled_risk
FROM tasks t
WHERE t.status = 'pending' AND t.due_date < CURRENT_TIMESTAMP;

-- Query 11: Task List with Billed Hours Subquery (Inefficient correlated subquery)
-- Correlated subquery executed for every row in tasks table instead of JOIN + GROUP BY
SELECT
    t.id,
    t.title,
    t.estimated_hours,
    (SELECT SUM(l.hours_billed) FROM ledger_entries l WHERE l.task_id = t.id) AS total_hours_logged
FROM tasks t
WHERE t.project_id = 'prj_001';

-- Query 12: Unique Project Task Names Lookup (Unnecessary DISTINCT)
-- Uses DISTINCT unnecessarily on primary key queries where rows are already unique
SELECT DISTINCT id, title, status
FROM tasks
WHERE project_id = 'prj_001';

