import assert from 'node:assert';
import { describe, it } from 'node:test';
import { DEMO_DATABASE_INPUT } from '../analyzers/database/fixtures/demo-database-fixture.js';
import {
  InvalidInputError,
  NoAnalysisSessionFoundError,
  ProjectNotFoundError,
} from '../services/database-analysis.service.js';

describe('Database Analyzer Phase 3.5 — Fastify Route & API Integration Boundary', () => {
  describe('API Contracts & Status Error Mappings', () => {
    it('1. maps ProjectNotFoundError to HTTP 404', () => {
      const err = new ProjectNotFoundError('proj-123');
      assert.strictEqual(err.name, 'ProjectNotFoundError');
      assert.ok(err.message.includes('not found or user is not authorized'));
    });

    it('2. maps InvalidInputError to HTTP 400', () => {
      const err = new InvalidInputError('schemaSql is required');
      assert.strictEqual(err.name, 'InvalidInputError');
      assert.strictEqual(err.message, 'schemaSql is required');
    });

    it('3. maps NoAnalysisSessionFoundError to HTTP 404', () => {
      const err = new NoAnalysisSessionFoundError('proj-456');
      assert.strictEqual(err.name, 'NoAnalysisSessionFoundError');
      assert.ok(err.message.includes('No completed database analysis session found'));
    });
  });

  describe('Demo Benchmark Ground Truth Processing', () => {
    it('4. verifies DEMO_DATABASE_INPUT is available for one-click demo repository execution', () => {
      assert.ok(DEMO_DATABASE_INPUT.schemaSql.includes('CREATE TABLE tasks'));
      assert.ok(DEMO_DATABASE_INPUT.queriesSql.length >= 12);
    });
  });
});
