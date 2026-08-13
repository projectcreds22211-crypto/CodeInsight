import { pgTable, uuid, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    githubUrl: text('github_url'),
    isDemoRepository: boolean('is_demo_repository').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_projects_user_id').on(table.userId)]
);

export const analysisSessions = pgTable(
  'analysis_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['code', 'database', 'logs', 'correlation'],
    }).notNull(),
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed'],
    }).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('idx_analysis_sessions_project_id').on(table.projectId),
    index('idx_analysis_sessions_project_type_status').on(
      table.projectId,
      table.type,
      table.status
    ),
  ]
);

export const findings = pgTable(
  'findings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => analysisSessions.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: ['architecture', 'tech_debt', 'query_optimization', 'anomaly'],
    }).notNull(),
    severity: text('severity', {
      enum: ['low', 'medium', 'high', 'critical'],
    }).notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    metadata: jsonb('metadata').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_findings_session_id').on(table.sessionId)]
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => analysisSessions.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    actionPlan: jsonb('action_plan').notNull(),
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_reports_session_id').on(table.sessionId)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type NewAnalysisSession = typeof analysisSessions.$inferInsert;

export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
