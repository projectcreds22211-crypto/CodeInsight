import NodeSqlParser from 'node-sql-parser';
import {
  DEMO_QUERIES_SQL,
  DEMO_SCHEMA_SQL,
} from '../src/analyzers/database/fixtures/demo-database-fixture.js';

const Parser = (NodeSqlParser as any).Parser || (NodeSqlParser as any).default.Parser;
const parser = new Parser();

console.log('Testing node-sql-parser AST parsing on DEMO dataset...\n');

DEMO_QUERIES_SQL.forEach((query, i) => {
  try {
    const ast = parser.astify(query, { database: 'postgresql' });
    console.log(`Query ${i + 1}: SUCCESS`);
  } catch (err: any) {
    console.log(`Query ${i + 1}: FAILED - ${err.message}`);
  }
});
