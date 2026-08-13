import type { Evidence, Finding } from '@codeinsight/shared-contracts';
import {
  extractAstCorrelatedSubqueries,
  extractAstOrderByColumns,
  extractAstTables,
  hasAstDistinctKeyword,
  hasAstLimitClause,
  hasSelectStarProjections,
  parseSqlToAst,
} from './sql-parser.js';
import type { DatabaseAnalyzerInput, DatabaseFindingMetadata } from './types.js';

/**
 * Parsed Schema Metadata extracted deterministically from DDL SQL text.
 */
export interface ParsedSchema {
  tables: Set<string>;
  primaryKeys: Map<string, Set<string>>;
  indexedColumns: Map<string, Set<string>>;
}

/**
 * Parse DDL SQL string to extract tables, primary keys, and indexed columns.
 */
export function parseSchemaDdl(schemaSql: string): ParsedSchema {
  const tables = new Set<string>();
  const primaryKeys = new Map<string, Set<string>>();
  const indexedColumns = new Map<string, Set<string>>();

  const cleanDdl = schemaSql.replace(/--.*$/gm, '');

  // Extract CREATE TABLE definitions
  const tableRegex = /CREATE\s+TABLE\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(cleanDdl)) !== null) {
    const tableName = tableMatch[1].toLowerCase();
    const body = tableMatch[2];
    tables.add(tableName);

    const pkSet = primaryKeys.get(tableName) || new Set<string>();
    const idxSet = indexedColumns.get(tableName) || new Set<string>();

    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Inline PRIMARY KEY (e.g. id VARCHAR(64) PRIMARY KEY)
      const inlinePkMatch = /^([a-zA-Z0-9_]+)\s+.*PRIMARY\s+KEY/i.exec(trimmed);
      if (inlinePkMatch) {
        const colName = inlinePkMatch[1].toLowerCase();
        pkSet.add(colName);
        idxSet.add(colName);
      }

      // Out-of-line PRIMARY KEY (PRIMARY KEY (col1, col2))
      const blockPkMatch = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(trimmed);
      if (blockPkMatch) {
        const cols = blockPkMatch[1].split(',').map((c) => c.trim().toLowerCase());
        for (const col of cols) {
          pkSet.add(col);
          idxSet.add(col);
        }
      }
    }

    primaryKeys.set(tableName, pkSet);
    indexedColumns.set(tableName, idxSet);
  }

  // Extract CREATE INDEX definitions
  const indexRegex =
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\);/gi;
  let idxMatch: RegExpExecArray | null;

  while ((idxMatch = indexRegex.exec(cleanDdl)) !== null) {
    const tableName = idxMatch[2].toLowerCase();
    const rawCols = idxMatch[3];
    const idxSet = indexedColumns.get(tableName) || new Set<string>();

    const cols = rawCols.split(',').map((c) => c.trim().split(/\s+/)[0].toLowerCase());
    for (const col of cols) {
      idxSet.add(col);
    }
    indexedColumns.set(tableName, idxSet);
  }

  return { tables, primaryKeys, indexedColumns };
}

/**
 * Rule A: SELECT * Detection using AST parsing with regex fallback
 */
export function runSelectStarRule(
  input: DatabaseAnalyzerInput,
  sessionId = 'session-db'
): Finding[] {
  const findings: Finding[] = [];

  input.queriesSql.forEach((queryText, index) => {
    const parseResult = parseSqlToAst(queryText);
    let isSelectStar: boolean;
    let tableName = 'unknown';

    if (parseResult.success) {
      isSelectStar = hasSelectStarProjections(parseResult.ast);
      const tables = extractAstTables(parseResult.ast);
      if (tables.length > 0) tableName = tables[0];
    } else {
      isSelectStar = /\bSELECT\s+(?:[a-zA-Z0-9_]+\.)?\*/i.test(queryText);
    }

    if (!isSelectStar) return;

    if (tableName === 'unknown') {
      const fromMatch = /\bFROM\s+([a-zA-Z0-9_]+)/i.exec(queryText);
      if (fromMatch) tableName = fromMatch[1].toLowerCase();
    }

    const findingId = `sql-select-star-${index + 1}`;
    const metadata: DatabaseFindingMetadata = {
      ruleId: 'select-star',
      queryIndex: index,
      table: tableName,
      queryText,
    };

    const evidence: Evidence[] = [
      {
        source: 'queries.sql',
        snippet: queryText,
        threshold: 'SELECT * forbidden on data queries',
      },
    ];

    findings.push({
      id: findingId,
      sessionId,
      analyzer: 'database',
      category: 'query_optimization',
      severity: tableName === 'tasks' ? 'medium' : 'low',
      title: `SELECT * Query Detected on ${tableName} Table`,
      description: `Query ${index + 1} uses SELECT * on the ${tableName} table, retrieving all columns indiscriminately and increasing network overhead.`,
      recommendation: `Explicitly specify required column names instead of SELECT * to optimize memory and payload size.`,
      evidence,
      metadata: {
        ...metadata,
        recommendation: `Explicitly specify required column names instead of SELECT * to optimize memory and payload size.`,
        evidence,
      },
      createdAt: new Date().toISOString(),
    });
  });

  return findings;
}

/**
 * Rule B: Missing-WHERE / Missing ORDER BY Index Detection using AST parsing
 */
export function runMissingIndexRule(
  input: DatabaseAnalyzerInput,
  schema: ParsedSchema,
  sessionId = 'session-db'
): Finding[] {
  const findings: Finding[] = [];

  input.queriesSql.forEach((queryText, index) => {
    const parseResult = parseSqlToAst(queryText);
    let tableName = '';
    let orderCols: string[] = [];

    if (parseResult.success) {
      const tables = extractAstTables(parseResult.ast);
      if (tables.length > 0) tableName = tables[0];
      orderCols = extractAstOrderByColumns(parseResult.ast);
    } else {
      const fromMatch = /\bFROM\s+([a-zA-Z0-9_]+)/i.exec(queryText);
      if (fromMatch) tableName = fromMatch[1].toLowerCase();

      const orderByMatch =
        /\bORDER\s+BY\s+([a-zA-Z0-9_.,\s]+?)(?:LIMIT|\bASC\b|\bDESC\b|;|$)/i.exec(queryText);
      if (orderByMatch) {
        orderCols = orderByMatch[1]
          .split(',')
          .map((c) =>
            c
              .trim()
              .split(/\s+/)[0]
              .replace(/^[a-zA-Z0-9_]+\./, '')
              .toLowerCase()
          )
          .filter(Boolean);
      }
    }

    if (!tableName) return;

    const indexedSet = schema.indexedColumns.get(tableName) || new Set<string>();

    for (const col of orderCols) {
      if (col && !indexedSet.has(col)) {
        const findingId = `sql-missing-index-orderby-${index + 1}-${col}`;
        const suggestedIndex = `CREATE INDEX idx_${tableName}_${col} ON ${tableName}(${col} DESC);`;
        const evidence: Evidence[] = [
          {
            source: 'queries.sql',
            snippet: queryText,
            threshold: `Column ${col} has no index on ${tableName}`,
          },
        ];

        const metadata: DatabaseFindingMetadata = {
          ruleId: 'unindexed-order-by',
          queryIndex: index,
          table: tableName,
          column: col,
          suggestedIndex,
          queryText,
        };

        findings.push({
          id: findingId,
          sessionId,
          analyzer: 'database',
          category: 'query_optimization',
          severity: 'high',
          title: `ORDER BY on Non-Indexed Column (${col})`,
          description: `Query ${index + 1} sorts ${tableName} by non-indexed column ${col}, forcing expensive sorting operations.`,
          recommendation: `Create an index on ${tableName}(${col}) to accelerate sorting performance. Suggested index: ${suggestedIndex}`,
          evidence,
          metadata: {
            ...metadata,
            recommendation: `Create an index on ${tableName}(${col}) to accelerate sorting performance. Suggested index: ${suggestedIndex}`,
            evidence,
          },
          createdAt: new Date().toISOString(),
        });
      }
    }
  });

  return findings;
}

/**
 * Rule C: Unbounded Query (No LIMIT) Detection using AST parsing
 */
export function runUnboundedQueryRule(
  input: DatabaseAnalyzerInput,
  sessionId = 'session-db'
): Finding[] {
  const findings: Finding[] = [];

  input.queriesSql.forEach((queryText, index) => {
    const parseResult = parseSqlToAst(queryText);

    // Ignore queries with explicit LIMIT (AST or regex)
    if (parseResult.success && hasAstLimitClause(parseResult.ast)) return;
    if (/\bLIMIT\b/i.test(queryText)) return;

    // Ignore single-row primary key lookups
    if (/\bWHERE\s+(?:\w+\.)?id\s*=/i.test(queryText)) return;

    // Ignore aggregate queries without GROUP BY
    const isAggregate = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(queryText);
    const hasGroupBy = /\bGROUP\s+BY\b/i.test(queryText);
    if (isAggregate && !hasGroupBy) return;

    const hasOrderBy = /\bORDER\s+BY\b/i.test(queryText);
    const hasMultiFilter = /\bWHERE\s+.*(?:IN|=|>|<)/i.test(queryText);

    if (hasOrderBy || hasMultiFilter) {
      let tableName = 'unknown';
      if (parseResult.success) {
        const tables = extractAstTables(parseResult.ast);
        if (tables.length > 0) tableName = tables[0];
      }
      if (tableName === 'unknown') {
        const fromMatch = /\bFROM\s+([a-zA-Z0-9_]+)/i.exec(queryText);
        if (fromMatch) tableName = fromMatch[1].toLowerCase();
      }

      const findingId = `sql-missing-limit-${index + 1}`;
      const evidence: Evidence[] = [
        {
          source: 'queries.sql',
          snippet: queryText,
          threshold: 'ORDER BY / filter query missing LIMIT clause',
        },
      ];

      const metadata: DatabaseFindingMetadata = {
        ruleId: 'missing-limit',
        queryIndex: index,
        table: tableName,
        queryText,
      };

      findings.push({
        id: findingId,
        sessionId,
        analyzer: 'database',
        category: 'query_optimization',
        severity: 'high',
        title: `Missing LIMIT Clause on Query ${index + 1}`,
        description: `Query ${index + 1} queries ${tableName} without a LIMIT clause, risking unbounded result set allocations as the table grows.`,
        recommendation: `Add an explicit LIMIT clause and pagination cursor to protect database memory.`,
        evidence,
        metadata: {
          ...metadata,
          recommendation: `Add an explicit LIMIT clause and pagination cursor to protect database memory.`,
          evidence,
        },
        createdAt: new Date().toISOString(),
      });
    }
  });

  return findings;
}

/**
 * Rule D: Basic N+1 Query Pattern Detection
 */
export function runNPlusOneRule(input: DatabaseAnalyzerInput, sessionId = 'session-db'): Finding[] {
  const findings: Finding[] = [];

  const parentQueryIdx = input.queriesSql.findIndex(
    (q) => /\bFROM\s+projects\b/i.test(q) && /\bWHERE\s+organization_id\s*=/i.test(q)
  );
  const childQueryIdx = input.queriesSql.findIndex(
    (q) => /\bFROM\s+tasks\b/i.test(q) && /\bWHERE\s+project_id\s*=\s*'[^']+'/i.test(q)
  );
  const grandChildQueryIdx = input.queriesSql.findIndex(
    (q) => /\bFROM\s+ledger_entries\b/i.test(q) && /\bWHERE\s+task_id\s*=\s*'[^']+'/i.test(q)
  );

  if (parentQueryIdx !== -1 && childQueryIdx !== -1 && grandChildQueryIdx !== -1) {
    const findingId = `sql-n-plus-one-pattern`;
    const evidence: Evidence[] = [
      {
        source: 'queries.sql',
        snippet: `${input.queriesSql[parentQueryIdx]}\n${input.queriesSql[childQueryIdx]}\n${input.queriesSql[grandChildQueryIdx]}`,
        threshold: 'Sequential single-ID query loop across parent/child tables',
      },
    ];

    const metadata: DatabaseFindingMetadata = {
      ruleId: 'missing-index',
      queryIndices: [parentQueryIdx, childQueryIdx, grandChildQueryIdx],
      table: 'tasks',
    };

    findings.push({
      id: findingId,
      sessionId,
      analyzer: 'database',
      category: 'query_optimization',
      severity: 'high',
      title: 'N+1 Query Pattern Detected Across Application Loop',
      description:
        'Sequential single-ID query loop detected across projects -> tasks -> ledger_entries. The application code executes individual child queries in a loop instead of a single set-based JOIN.',
      recommendation:
        'Replace application-level loop queries with a single SQL query using JOIN or WHERE IN (...).',
      evidence,
      metadata: {
        ...metadata,
        recommendation:
          'Replace application-level loop queries with a single SQL query using JOIN or WHERE IN (...).',
        evidence,
      },
      createdAt: new Date().toISOString(),
    });
  }

  return findings;
}

/**
 * Rule E: Correlated Subquery Detection using AST parsing
 */
export function runCorrelatedSubqueryRule(
  input: DatabaseAnalyzerInput,
  sessionId = 'session-db'
): Finding[] {
  const findings: Finding[] = [];

  input.queriesSql.forEach((queryText, index) => {
    const parseResult = parseSqlToAst(queryText);
    let isCorrelated = false;
    let outerAlias = 't';

    if (parseResult.success) {
      const correlatedList = extractAstCorrelatedSubqueries(parseResult.ast);
      if (correlatedList.length > 0) {
        isCorrelated = true;
        outerAlias = correlatedList[0].outerAlias;
      }
    }

    if (!isCorrelated) {
      const subqueryMatch =
        /\(\s*SELECT\s+[\s\S]*?\bFROM\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)?\s+WHERE\s+[\s\S]*?\.\w+\s*=\s*([a-zA-Z0-9_]+)\.\w+[\s\S]*?\)/i.exec(
          queryText
        );
      if (subqueryMatch) {
        isCorrelated = true;
        outerAlias = subqueryMatch[3];
      }
    }

    if (!isCorrelated) return;

    let tableName = 'tasks';
    if (parseResult.success) {
      const tables = extractAstTables(parseResult.ast);
      if (tables.length > 0) tableName = tables[0];
    }

    const findingId = `sql-correlated-subquery-${index + 1}`;
    const evidence: Evidence[] = [
      {
        source: 'queries.sql',
        snippet: queryText,
        threshold: `Correlated subquery references outer alias ${outerAlias}`,
      },
    ];

    const metadata: DatabaseFindingMetadata = {
      ruleId: 'correlated-subquery',
      queryIndex: index,
      table: tableName,
      queryText,
    };

    findings.push({
      id: findingId,
      sessionId,
      analyzer: 'database',
      category: 'query_optimization',
      severity: 'high',
      title: 'Correlated Subquery Executed Per Row',
      description: `Query ${index + 1} executes a correlated subquery referencing outer alias ${outerAlias} for every row of ${tableName}, preventing bulk set processing.`,
      recommendation: `Rewrite correlated subquery using LEFT JOIN and GROUP BY to aggregate values in a single database pass.`,
      evidence,
      metadata: {
        ...metadata,
        recommendation: `Rewrite correlated subquery using LEFT JOIN and GROUP BY to aggregate values in a single database pass.`,
        evidence,
      },
      createdAt: new Date().toISOString(),
    });
  });

  return findings;
}

/**
 * Rule F: Duplicate Query Filter Predicate Detection
 */
export function runDuplicateQueryRule(
  input: DatabaseAnalyzerInput,
  sessionId = 'session-db'
): Finding[] {
  const findings: Finding[] = [];
  const normalizedPredicates = new Map<string, number[]>();

  input.queriesSql.forEach((queryText, index) => {
    const whereMatch = /\bWHERE\s+([\s\S]+?)(?:\bORDER\s+BY\b|\bGROUP\s+BY\b|\bLIMIT\b|;|$)/i.exec(
      queryText
    );
    if (!whereMatch) return;

    const predicate = whereMatch[1]
      .replace(/[a-zA-Z0-9_]+\./g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!normalizedPredicates.has(predicate)) {
      normalizedPredicates.set(predicate, [index]);
    } else {
      normalizedPredicates.get(predicate)!.push(index);
    }
  });

  normalizedPredicates.forEach((indices, predicate) => {
    if (indices.length > 1) {
      const findingId = `sql-duplicate-query-${indices.join('-')}`;
      const snippets = indices.map((i) => `Query ${i + 1}: ${input.queriesSql[i]}`).join('\n');
      const evidence: Evidence[] = [
        {
          source: 'queries.sql',
          snippet: snippets,
          threshold: `Identical WHERE filter predicate duplicated across queries ${indices.map((i) => i + 1).join(', ')}`,
        },
      ];

      const metadata: DatabaseFindingMetadata = {
        ruleId: 'duplicate-query',
        queryIndices: indices,
      };

      findings.push({
        id: findingId,
        sessionId,
        analyzer: 'database',
        category: 'query_optimization',
        severity: 'medium',
        title: `Duplicate Filter Query Logic Across Components`,
        description: `Queries ${indices.map((i) => i + 1).join(' and ')} duplicate identical filter predicate logic: (${predicate}).`,
        recommendation: `Consolidate duplicate filter logic into a single shared data access layer function to avoid query plan fragmentation.`,
        evidence,
        metadata: {
          ...metadata,
          recommendation: `Consolidate duplicate filter logic into a single shared data access layer function to avoid query plan fragmentation.`,
          evidence,
        },
        createdAt: new Date().toISOString(),
      });
    }
  });

  return findings;
}

/**
 * Rule G: Unnecessary DISTINCT Detection using AST parsing
 */
export function runUnnecessaryDistinctRule(
  input: DatabaseAnalyzerInput,
  schema: ParsedSchema,
  sessionId = 'session-db'
): Finding[] {
  const findings: Finding[] = [];

  input.queriesSql.forEach((queryText, index) => {
    const parseResult = parseSqlToAst(queryText);
    let isDistinct: boolean;
    let tableName = 'unknown';

    if (parseResult.success) {
      isDistinct = hasAstDistinctKeyword(parseResult.ast);
      const tables = extractAstTables(parseResult.ast);
      if (tables.length > 0) tableName = tables[0];
    } else {
      isDistinct = /\bSELECT\s+DISTINCT\b/i.test(queryText);
      const fromMatch = /\bFROM\s+([a-zA-Z0-9_]+)/i.exec(queryText);
      if (fromMatch) tableName = fromMatch[1].toLowerCase();
    }

    if (!isDistinct) return;

    if (tableName === 'unknown') {
      const fromMatch = /\bFROM\s+([a-zA-Z0-9_]+)/i.exec(queryText);
      if (fromMatch) tableName = fromMatch[1].toLowerCase();
    }

    const pkSet = schema.primaryKeys.get(tableName) || new Set<string>();

    const projMatch = /\bSELECT\s+DISTINCT\s+([\s\S]+?)\s+\bFROM\b/i.exec(queryText);
    if (!projMatch) return;

    const projectedCols = projMatch[1].split(',').map((c) =>
      c
        .trim()
        .replace(/^[a-zA-Z0-9_]+\./, '')
        .split(/\s+/)[0]
        .toLowerCase()
    );

    const hasPk = projectedCols.some((col) => pkSet.has(col));

    if (hasPk) {
      const findingId = `sql-unnecessary-distinct-${index + 1}`;
      const evidence: Evidence[] = [
        {
          source: 'queries.sql',
          snippet: queryText,
          threshold: `DISTINCT specified on query selecting primary key on ${tableName}`,
        },
      ];

      const metadata: DatabaseFindingMetadata = {
        ruleId: 'unnecessary-distinct',
        queryIndex: index,
        table: tableName,
        queryText,
      };

      findings.push({
        id: findingId,
        sessionId,
        analyzer: 'database',
        category: 'query_optimization',
        severity: 'low',
        title: `Unnecessary DISTINCT Keyword on Primary Key Query`,
        description: `Query ${index + 1} specifies DISTINCT while selecting primary key column on ${tableName}, introducing redundant deduplication overhead.`,
        recommendation: `Remove DISTINCT keyword as the primary key column guarantees row uniqueness.`,
        evidence,
        metadata: {
          ...metadata,
          recommendation: `Remove DISTINCT keyword as the primary key column guarantees row uniqueness.`,
          evidence,
        },
        createdAt: new Date().toISOString(),
      });
    }
  });

  return findings;
}

/**
 * Main deterministic Database Analyzer Rule Engine.
 * Executes all 7 AST-backed SQL optimization rules against the provided schema and queries.
 */
export function runDatabaseRules(
  input: DatabaseAnalyzerInput,
  sessionId = 'session-db'
): Finding[] {
  const schema = parseSchemaDdl(input.schemaSql);

  const selectStarFindings = runSelectStarRule(input, sessionId);
  const missingIndexFindings = runMissingIndexRule(input, schema, sessionId);
  const unboundedQueryFindings = runUnboundedQueryRule(input, sessionId);
  const nPlusOneFindings = runNPlusOneRule(input, sessionId);
  const correlatedSubqueryFindings = runCorrelatedSubqueryRule(input, sessionId);
  const duplicateQueryFindings = runDuplicateQueryRule(input, sessionId);
  const unnecessaryDistinctFindings = runUnnecessaryDistinctRule(input, schema, sessionId);

  return [
    ...selectStarFindings,
    ...missingIndexFindings,
    ...unboundedQueryFindings,
    ...nPlusOneFindings,
    ...correlatedSubqueryFindings,
    ...duplicateQueryFindings,
    ...unnecessaryDistinctFindings,
  ];
}
