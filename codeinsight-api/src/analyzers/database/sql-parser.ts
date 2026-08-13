import NodeSqlParser from 'node-sql-parser';

// Clean instantiation of node-sql-parser across ESM and CommonJS runtimes
const ParserClass =
  (NodeSqlParser as unknown as { Parser: new () => InstanceType<typeof NodeSqlParser.Parser> })
    .Parser ||
  (
    NodeSqlParser as unknown as {
      default: { Parser: new () => InstanceType<typeof NodeSqlParser.Parser> };
    }
  ).default?.Parser;

const parserInstance = new ParserClass();

/**
 * Normalized AST node representation for CodeInsight rules.
 */
export interface ParsedSqlAst {
  type: string;
  columns?: any[];
  from?: any[];
  where?: any;
  orderby?: any[];
  groupby?: any[];
  limit?: any;
  distinct?: any;
  rawAst?: any;
}

/**
 * Result container for safe SQL parsing.
 */
export type ParseSqlResult =
  | { success: true; ast: ParsedSqlAst; query: string }
  | { success: false; error: string; query: string };

/**
 * Safely parse a single SQL query string into a structured AST using node-sql-parser in PostgreSQL dialect mode.
 * Fails gracefully returning a discriminated result instead of throwing uncaught exceptions.
 */
export function parseSqlToAst(sql: string): ParseSqlResult {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { success: false, error: 'Empty SQL query string', query: sql };
  }

  try {
    const rawAst = parserInstance.astify(trimmed, { database: 'postgresql' });
    const astArray = Array.isArray(rawAst) ? rawAst : [rawAst];
    const firstAst: any = astArray[0] || {};

    const ast: ParsedSqlAst = {
      type: firstAst.type || 'unknown',
      columns: Array.isArray(firstAst.columns) ? firstAst.columns : undefined,
      from: Array.isArray(firstAst.from) ? firstAst.from : undefined,
      where: firstAst.where || undefined,
      orderby: Array.isArray(firstAst.orderby) ? firstAst.orderby : undefined,
      groupby: Array.isArray(firstAst.groupby) ? firstAst.groupby : undefined,
      limit: firstAst.limit || undefined,
      distinct: firstAst.distinct || undefined,
      rawAst: firstAst,
    };

    return { success: true, ast, query: sql };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `SQL Parse Error: ${errorMessage}`,
      query: sql,
    };
  }
}

/**
 * AST Helper: Inspect columns to detect SELECT * or table.* wildcard projections.
 */
export function hasSelectStarProjections(ast: ParsedSqlAst): boolean {
  if (!ast.columns || !Array.isArray(ast.columns)) return false;

  return ast.columns.some((col: any) => {
    if (col === '*') return true;
    if (col?.expr?.type === 'column_ref' && col?.expr?.column === '*') return true;
    if (col?.expr === '*') return true;
    return false;
  });
}

/**
 * AST Helper: Extract table names from FROM clause.
 */
export function extractAstTables(ast: ParsedSqlAst): string[] {
  if (!ast.from || !Array.isArray(ast.from)) return [];

  const tables: string[] = [];
  for (const item of ast.from) {
    if (item?.table) {
      tables.push(item.table.toLowerCase());
    }
  }
  return tables;
}

/**
 * AST Helper: Extract column references from WHERE clause binary expression tree.
 */
export function extractAstWhereColumns(whereNode: any): string[] {
  if (!whereNode || typeof whereNode !== 'object') return [];

  const columns: string[] = [];

  function traverse(node: any) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'column_ref' && node.column) {
      const colName =
        typeof node.column === 'string'
          ? node.column
          : node.column?.expr?.value || node.column?.value;
      if (colName && typeof colName === 'string') {
        columns.push(colName.toLowerCase());
      }
    }

    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
    if (node.expr) traverse(node.expr);
    if (Array.isArray(node.value)) {
      node.value.forEach(traverse);
    }
  }

  traverse(whereNode);
  return columns;
}

/**
 * AST Helper: Extract column names from ORDER BY clause.
 */
export function extractAstOrderByColumns(ast: ParsedSqlAst): string[] {
  if (!ast.orderby || !Array.isArray(ast.orderby)) return [];

  const columns: string[] = [];
  for (const item of ast.orderby) {
    const expr = item?.expr;
    if (expr?.type === 'column_ref' && expr.column) {
      const colName =
        typeof expr.column === 'string'
          ? expr.column
          : expr.column?.expr?.value || expr.column?.value;
      if (colName && typeof colName === 'string') {
        columns.push(colName.toLowerCase());
      }
    }
  }
  return columns;
}

/**
 * AST Helper: Check if AST contains a non-empty LIMIT clause.
 */
export function hasAstLimitClause(ast: ParsedSqlAst): boolean {
  if (!ast.limit) return false;
  if (Array.isArray(ast.limit.value) && ast.limit.value.length > 0) return true;
  if (typeof ast.limit.value === 'number' || typeof ast.limit.value === 'string') return true;
  return false;
}

/**
 * AST Helper: Check if AST contains a DISTINCT keyword modifier.
 */
export function hasAstDistinctKeyword(ast: ParsedSqlAst): boolean {
  if (!ast.distinct) return false;
  if (typeof ast.distinct === 'string' && ast.distinct.toUpperCase() === 'DISTINCT') return true;
  if (
    typeof ast.distinct === 'object' &&
    ast.distinct !== null &&
    (ast.distinct.type || ast.distinct.value)
  )
    return true;
  return false;
}

/**
 * AST Helper: Detect correlated subqueries referencing an outer table alias.
 */
export function extractAstCorrelatedSubqueries(
  ast: ParsedSqlAst
): { subquery: any; outerAlias: string }[] {
  const correlatedList: { subquery: any; outerAlias: string }[] = [];

  const outerAliases = new Set<string>();
  if (ast.from && Array.isArray(ast.from)) {
    for (const item of ast.from) {
      if (item?.as) outerAliases.add(item.as.toLowerCase());
      if (item?.table) outerAliases.add(item.table.toLowerCase());
    }
  }

  function searchForSubqueries(node: any) {
    if (!node || typeof node !== 'object') return;

    // Subquery in column expression projection
    if (node.type === 'select' || (node.expr && node.expr.type === 'select')) {
      const subAst = node.expr || node;
      const innerWhere = subAst.where;
      if (innerWhere) {
        const refs = extractAstWhereAliases(innerWhere);
        for (const refAlias of refs) {
          if (outerAliases.has(refAlias)) {
            correlatedList.push({ subquery: subAst, outerAlias: refAlias });
          }
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'from' && node === ast) continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(searchForSubqueries);
      } else if (typeof child === 'object' && child !== null) {
        searchForSubqueries(child);
      }
    }
  }

  if (ast.columns) ast.columns.forEach(searchForSubqueries);
  if (ast.where) searchForSubqueries(ast.where);

  return correlatedList;
}

function extractAstWhereAliases(whereNode: any): string[] {
  const aliases: string[] = [];
  function traverse(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'column_ref' && node.table) {
      aliases.push(node.table.toLowerCase());
    }
    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
    if (node.expr) traverse(node.expr);
  }
  traverse(whereNode);
  return aliases;
}
