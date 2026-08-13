import React, { useState, useEffect } from 'react';
import { AlertCircle, Database, Sparkles, RefreshCw } from 'lucide-react';
import type { Project } from '../../../lib/api-client';
import { useDatabaseFindings, useAnalyzeDatabase } from '../../../hooks/useDatabaseAnalyzer';
import { ResultOverview } from './ResultOverview';
import { FindingCard } from './FindingCard';
import { SqlInputSection } from './SqlInputSection';
import { DEMO_DATABASE_INPUT } from '../../../../../codeinsight-api/src/analyzers/database/fixtures/demo-database-fixture';

interface DatabaseAnalyzerTabProps {
  activeProject: Project | null;
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}

export const DatabaseAnalyzerTab: React.FC<DatabaseAnalyzerTabProps> = ({
  activeProject,
  projects,
  onSelectProject,
}) => {
  const projectId = activeProject?.id || null;

  // 1. Fetch previous analysis results automatically
  const {
    data: existingResult,
    isLoading: isFetchingResult,
    refetch,
  } = useDatabaseFindings(projectId);

  // 2. Mutation to trigger database analysis
  const analyzeMutation = useAnalyzeDatabase(projectId);

  // Local state for schema & queries text inputs
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [queriesSqlText, setQueriesSqlText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-fill demo SQL input if project is demo repository and inputs are empty
  useEffect(() => {
    if (activeProject?.isDemoRepository && !schemaSql && !queriesSqlText) {
      setSchemaSql(DEMO_DATABASE_INPUT.schemaSql);
      setQueriesSqlText(DEMO_DATABASE_INPUT.queriesSql.join(';\n\n') + ';');
    }
  }, [activeProject]);

  const handleAutoFillDemo = () => {
    setSchemaSql(DEMO_DATABASE_INPUT.schemaSql);
    setQueriesSqlText(DEMO_DATABASE_INPUT.queriesSql.join(';\n\n') + ';');
  };

  const handleRunAnalysis = async () => {
    setErrorMessage(null);

    // Parse queries split by semicolon or double newlines
    let queriesSql: string[] = [];
    if (queriesSqlText.trim()) {
      queriesSql = queriesSqlText
        .split(/;|\n\s*\n/)
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
    }

    // For non-demo projects, validate input fields
    if (!activeProject?.isDemoRepository) {
      if (!schemaSql.trim()) {
        setErrorMessage('PostgreSQL Schema DDL is required.');
        return;
      }
      if (queriesSql.length === 0) {
        setErrorMessage('At least one SQL query is required for analysis.');
        return;
      }
    }

    try {
      await analyzeMutation.mutateAsync({
        schemaSql: schemaSql.trim() || undefined,
        queriesSql: queriesSql.length > 0 ? queriesSql : undefined,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to execute database analysis. Please try again.');
    }
  };

  // Current active result (from mutation run or restored existing findings)
  const currentResult = analyzeMutation.data || existingResult;

  return (
    <div className="space-y-8">
      {/* Workspace Bar: Project Selector */}
      <div
        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--surface-outline)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0"
            style={{ backgroundColor: 'var(--analyzer-db)' }}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-display" style={{ color: 'var(--ink)' }}>
              Active Workspace
            </h2>
            <p className="text-xs text-[#78716C]">
              {activeProject ? (
                <>
                  Analyzing{' '}
                  <span className="font-semibold text-[var(--ink)]">{activeProject.name}</span>
                  {activeProject.isDemoRepository && ' (Demo Repository)'}
                </>
              ) : (
                'Select a project to enable database analysis'
              )}
            </p>
          </div>
        </div>

        {/* Project Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="project-select" className="text-xs font-semibold text-[#78716C] sr-only">
            Select Active Project
          </label>
          <select
            id="project-select"
            value={activeProject?.id || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="focus-ring px-3 py-2 text-xs font-semibold rounded-lg bg-[var(--surface-bg)] border border-[var(--surface-outline)] text-[var(--ink)] cursor-pointer"
          >
            {projects.length === 0 ? (
              <option value="">No projects available</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isDemoRepository ? '★ Demo' : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-xl border bg-[#FDF2F2] border-[#FCA5A5] text-[#B91C1C] text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div>
              <span className="font-bold block">Database Analysis Action Required</span>
              <span>{errorMessage}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-bold underline cursor-pointer hover:opacity-80 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SQL Input Workspace */}
      <SqlInputSection
        schemaSql={schemaSql}
        queriesSqlText={queriesSqlText}
        isDemoRepo={activeProject?.isDemoRepository ?? false}
        isSubmitting={analyzeMutation.isPending}
        onSchemaChange={setSchemaSql}
        onQueriesChange={setQueriesSqlText}
        onRunAnalysis={handleRunAnalysis}
        onAutoFillDemo={handleAutoFillDemo}
      />

      {/* Loading state during analysis */}
      {analyzeMutation.isPending && (
        <div
          className="p-12 text-center space-y-4"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="w-12 h-12 rounded-full border-4 border-[var(--analyzer-db)] border-t-transparent animate-spin mx-auto" />
          <div>
            <h3 className="font-bold text-base font-display" style={{ color: 'var(--ink)' }}>
              Executing Database Analysis...
            </h3>
            <p className="text-xs text-[#78716C] max-w-md mx-auto mt-1">
              Evaluating 7 deterministic optimization rules and requesting Claude 3.5 Sonnet query
              rewrites.
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      {!analyzeMutation.isPending && currentResult && (
        <div className="space-y-6">
          {/* Result Overview Header */}
          <ResultOverview result={currentResult} />

          {/* Findings List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-display uppercase tracking-wider text-[#78716C]">
                Optimization Findings ({currentResult.findings.length})
              </h3>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs text-[#78716C] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {currentResult.findings.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[var(--surface-card)] border border-[var(--surface-outline)] space-y-2 text-xs text-[#78716C]">
                <p className="font-bold text-sm text-[var(--ink)]">No Findings Detected</p>
                <p>
                  All queries evaluated cleanly against deterministic database optimization rules.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentResult.findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State before analysis is run and when no previous result exists */}
      {!analyzeMutation.isPending && !currentResult && !isFetchingResult && (
        <div
          className="p-10 text-center space-y-4"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{
              backgroundColor: 'rgba(46, 156, 143, 0.1)',
              color: 'var(--analyzer-db)',
            }}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base font-display" style={{ color: 'var(--ink)' }}>
              Ready for Database Optimization Analysis
            </h3>
            <p className="text-xs max-w-md mx-auto mt-1 text-[#78716C]">
              Paste your PostgreSQL schema DDL and SELECT queries above, then click{' '}
              <strong>Analyze Database</strong> to detect missing indexes, SELECT *, N+1 patterns,
              and structural query anti-patterns.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
