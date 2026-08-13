import React from 'react';
import { Database, Play, Sparkles, FileCode2, HelpCircle } from 'lucide-react';

interface SqlInputSectionProps {
  schemaSql: string;
  queriesSqlText: string;
  isDemoRepo: boolean;
  isSubmitting: boolean;
  onSchemaChange: (val: string) => void;
  onQueriesChange: (val: string) => void;
  onRunAnalysis: () => void;
  onAutoFillDemo?: () => void;
}

export const SqlInputSection: React.FC<SqlInputSectionProps> = ({
  schemaSql,
  queriesSqlText,
  isDemoRepo,
  isSubmitting,
  onSchemaChange,
  onQueriesChange,
  onRunAnalysis,
  onAutoFillDemo,
}) => {
  return (
    <div
      className="p-6 space-y-6"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4"
        style={{ borderColor: 'var(--surface-outline)' }}
      >
        <div>
          <h2
            className="text-base font-bold font-display flex items-center gap-2"
            style={{ color: 'var(--ink)' }}
          >
            <Database className="w-5 h-5" style={{ color: 'var(--analyzer-db)' }} />
            <span>PostgreSQL Query & Schema Workspace</span>
          </h2>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            Paste your DDL table definitions and target SELECT queries for deterministic AST static
            analysis.
          </p>
        </div>

        {/* Demo Shortcut Pill */}
        {isDemoRepo && onAutoFillDemo && (
          <button
            type="button"
            onClick={onAutoFillDemo}
            className="focus-ring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--thread-purple)] hover:bg-[var(--thread-purple)]/10 transition-colors cursor-pointer"
            style={{
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(107, 76, 230, 0.08)',
              border: '1px solid rgba(107, 76, 230, 0.2)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Demo Benchmark SQL</span>
          </button>
        )}
      </div>

      {/* Inputs grid: Schema DDL & Queries SQL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input A: Schema DDL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="schema-ddl-input"
              className="text-xs font-bold font-display flex items-center gap-1.5"
              style={{ color: 'var(--ink)' }}
            >
              <FileCode2 className="w-4 h-4 text-[var(--analyzer-db)]" />
              <span>PostgreSQL Schema DDL</span>
            </label>
            <span className="text-[11px] text-[#78716C] font-mono">CREATE TABLE ...</span>
          </div>
          <textarea
            id="schema-ddl-input"
            value={schemaSql}
            onChange={(e) => onSchemaChange(e.target.value)}
            placeholder={`-- Paste your PostgreSQL table definitions DDL here...\nCREATE TABLE users (\n  id UUID PRIMARY KEY,\n  email TEXT NOT NULL\n);`}
            rows={8}
            className="w-full p-3 font-mono text-xs rounded-xl border focus-ring resize-y leading-relaxed bg-[#1A1816] text-[#E7E4DD] border-[#2C2926] placeholder-[#78716C]"
          />
        </div>

        {/* Input B: Queries SQL */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="queries-sql-input"
              className="text-xs font-bold font-display flex items-center gap-1.5"
              style={{ color: 'var(--ink)' }}
            >
              <FileCode2 className="w-4 h-4 text-[var(--thread-purple)]" />
              <span>Target SQL Queries (Separate with semicolon or blank line)</span>
            </label>
            <span className="text-[11px] text-[#78716C] font-mono">SELECT ...</span>
          </div>
          <textarea
            id="queries-sql-input"
            value={queriesSqlText}
            onChange={(e) => onQueriesChange(e.target.value)}
            placeholder={`-- Paste your SQL queries here...\nSELECT * FROM users WHERE email = 'test@example.com';\n\nSELECT id, name FROM projects ORDER BY created_at DESC;`}
            rows={8}
            className="w-full p-3 font-mono text-xs rounded-xl border focus-ring resize-y leading-relaxed bg-[#1A1816] text-[#E7E4DD] border-[#2C2926] placeholder-[#78716C]"
          />
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t"
        style={{ borderColor: 'var(--surface-outline)' }}
      >
        <div className="flex items-center gap-2 text-xs text-[#78716C]">
          <HelpCircle className="w-4 h-4 shrink-0 text-[#A8A29E]" />
          <span>
            AST static analyzer evaluates 7 deterministic optimization rules + Claude prompt
            explanation.
          </span>
        </div>

        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={isSubmitting}
          className="focus-ring inline-flex items-center justify-center gap-2 px-6 py-2.5 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:opacity-95"
          style={{
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--analyzer-db)',
          }}
        >
          {isSubmitting ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Analyzing SQL...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Analyze Database</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
