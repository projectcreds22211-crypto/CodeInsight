import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCode,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Layers,
} from 'lucide-react';
import type { Project, Finding } from '../../../lib/api-client';
import { useCorrelationReport, useRunCorrelationStream } from '../../../hooks/useCorrelationReport';
import { useCodeFindings } from '../../../hooks/useCodeAnalyzer';
import { useDatabaseFindings } from '../../../hooks/useDatabaseAnalyzer';
import { useLogFindings } from '../../../hooks/useLogAnalyzer';
import { ThreadCard } from './ThreadCard';

interface CorrelationReportTabProps {
  activeProject: Project | null;
  projects: Project[];
  onSelectProject: (id: string) => void;
  onNavigateTab: (tab: 'code' | 'db' | 'logs' | 'correlation') => void;
}

export const CorrelationReportTab: React.FC<CorrelationReportTabProps> = ({
  activeProject,
  projects,
  onSelectProject,
  onNavigateTab,
}) => {
  const projectId = activeProject?.id || null;

  const { data: reportData, isLoading: isReportLoading } = useCorrelationReport(projectId);
  const {
    isStreaming,
    progressMessage,
    streamError,
    discoveredCorrelations,
    startStream,
    stopStream,
  } = useRunCorrelationStream(projectId);

  const { data: codeData } = useCodeFindings(projectId);
  const { data: dbData } = useDatabaseFindings(projectId);
  const { data: logData } = useLogFindings(projectId);

  const [customScopeQuery, setCustomScopeQuery] = useState('');
  const [showQueryInput, setShowQueryInput] = useState(false);

  const report = reportData?.report || null;
  const availability = reportData?.sessionAvailability || {
    code: false,
    database: false,
    logs: false,
  };
  const actionPlan = report?.actionPlan || [];

  // Build unified lookup map of all deterministic findings across active analyzer sessions
  const findingsMap = useMemo(() => {
    const map = new Map<string, Finding>();
    for (const f of codeData?.findings || []) {
      map.set(f.id, {
        id: f.id,
        sessionId: f.sessionId,
        analyzer: 'code',
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        evidence: f.evidence,
        metadata: f.metadata,
        createdAt: f.createdAt,
      });
    }
    for (const f of dbData?.findings || []) {
      map.set(f.id, {
        id: f.id,
        sessionId: f.sessionId,
        analyzer: 'database',
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        evidence: f.evidence,
        metadata: f.metadata,
        createdAt: f.createdAt,
      });
    }
    for (const f of logData?.findings || []) {
      map.set(f.id, {
        id: f.id,
        sessionId: f.sessionId,
        analyzer: 'logs',
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        evidence: f.evidence,
        metadata: f.metadata,
        createdAt: f.createdAt,
      });
    }
    return map;
  }, [codeData?.findings, dbData?.findings, logData?.findings]);

  const handleStartCorrelation = () => {
    if (!activeProject) return;
    startStream(customScopeQuery.trim() || undefined);
  };

  const handleNavigateToFinding = (_findingId: string, analyzer?: 'code' | 'database' | 'logs') => {
    if (analyzer === 'database') {
      onNavigateTab('db');
    } else if (analyzer === 'logs') {
      onNavigateTab('logs');
    } else {
      onNavigateTab('code');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Project Selector & Correlation Run Control */}
      <div
        className="p-5 rounded-lg border flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--surface-outline)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'var(--surface-bg)',
              border: '1px solid var(--surface-outline)',
            }}
          >
            <Cpu className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-base font-bold font-display" style={{ color: 'var(--ink)' }}>
              Unified Correlation Report & The Thread
            </h2>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              Grounded cross-layer synthesis connecting Code, Database, and Operational Log signals.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Selector Dropdown */}
          <select
            value={activeProject?.id || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="focus-ring px-3 py-2 text-xs font-semibold rounded-md border cursor-pointer"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-outline)',
              color: 'var(--ink)',
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isDemoRepository ? '(Demo)' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowQueryInput((prev) => !prev)}
            className="focus-ring px-3 py-2 text-xs font-semibold rounded-md border cursor-pointer transition-colors"
            style={{
              backgroundColor: showQueryInput ? 'var(--surface-bg)' : 'transparent',
              borderColor: 'var(--surface-outline)',
              color: 'var(--ink)',
            }}
          >
            {showQueryInput ? 'Hide Scope Query' : 'Add Query Scope'}
          </button>

          <button
            type="button"
            onClick={handleStartCorrelation}
            disabled={!activeProject || isStreaming}
            className="focus-ring flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md text-white transition-all cursor-pointer disabled:opacity-50 shadow-sm"
            style={{
              background: 'linear-gradient(135deg, var(--thread-purple), #6366F1)',
            }}
          >
            {isStreaming ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Correlating...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Correlation Engine
              </>
            )}
          </button>
        </div>
      </div>

      {/* Optional Custom Scope Query Input */}
      {showQueryInput && (
        <div
          className="p-4 rounded-lg border space-y-2"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--surface-outline)',
          }}
        >
          <label className="text-xs font-bold block" style={{ color: 'var(--ink)' }}>
            Custom Scope / Focus Query (Optional)
          </label>
          <input
            type="text"
            value={customScopeQuery}
            onChange={(e) => setCustomScopeQuery(e.target.value)}
            placeholder="e.g. Focus on database pool exhaustion and TaskLedger query latency..."
            className="focus-ring w-full px-3 py-2 text-xs rounded border"
            style={{
              backgroundColor: 'var(--surface-bg)',
              borderColor: 'var(--surface-outline)',
              color: 'var(--ink)',
            }}
          />
          <p className="text-xs text-stone-500">
            Directs the correlation engine to prioritize specific services, modules, or operational
            issues.
          </p>
        </div>
      )}

      {/* Analyzer Session Availability Banner */}
      <div
        className="p-4 rounded-lg border grid grid-cols-1 sm:grid-cols-3 gap-3"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--surface-outline)',
        }}
      >
        {/* Code Availability */}
        <div
          className="flex items-center justify-between p-2.5 rounded border"
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
        >
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              Code Analyzer
            </span>
          </div>
          {availability.code ? (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateTab('code')}
              className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              Run Code
            </button>
          )}
        </div>

        {/* Database Availability */}
        <div
          className="flex items-center justify-between p-2.5 rounded border"
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              Database Analyzer
            </span>
          </div>
          {availability.database ? (
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Active
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateTab('db')}
              className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              Run DB
            </button>
          )}
        </div>

        {/* Logs Availability */}
        <div
          className="flex items-center justify-between p-2.5 rounded border"
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              Log Analyzer
            </span>
          </div>
          {availability.logs ? (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Active
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateTab('logs')}
              className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
            >
              Run Logs
            </button>
          )}
        </div>

        {/* Partial Analysis Callout */}
        {(availability.code || availability.database || availability.logs) &&
          (!availability.code || !availability.database || !availability.logs) && (
            <div
              className="col-span-1 sm:col-span-3 px-3.5 py-2.5 rounded-md text-xs flex items-center gap-2 border"
              style={{
                backgroundColor: '#FFFBEB',
                borderColor: '#FDE68A',
                color: '#92400E',
              }}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>
                <strong>Partial System Analysis:</strong> Correlation is based on{' '}
                {[
                  availability.code && 'Code',
                  availability.database && 'Database',
                  availability.logs && 'Logs',
                ]
                  .filter(Boolean)
                  .join(' + ')}
                . Unrun analyzers:{' '}
                {[
                  !availability.code && 'Code',
                  !availability.database && 'Database',
                  !availability.logs && 'Logs',
                ]
                  .filter(Boolean)
                  .join(', ')}
                .
              </span>
            </div>
          )}
      </div>

      {/* SSE Streaming Progress Banner */}
      {isStreaming && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-lg border border-purple-200 bg-purple-50/70 space-y-2 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 animate-spin" aria-hidden="true" />
              <span className="text-xs font-bold text-purple-900">
                Correlation Engine Execution in Progress
              </span>
            </div>
            <button
              type="button"
              onClick={stopStream}
              className="text-xs text-purple-700 hover:text-purple-900 underline cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-purple-800 font-mono">{progressMessage}</p>

          {discoveredCorrelations.length > 0 && (
            <div className="text-xs text-purple-700 pt-1 font-semibold">
              ✨ Discovered {discoveredCorrelations.length} grounded correlation
              {discoveredCorrelations.length === 1 ? '' : 's'} so far...
            </div>
          )}
        </div>
      )}

      {/* Stream Error Alert */}
      {streamError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <div>
              <span className="font-bold block">Correlation Engine Action Required</span>
              <span>{streamError}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStartCorrelation}
            className="text-xs font-bold underline cursor-pointer text-red-900 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Report Skeleton Loading */}
      {isReportLoading && !isStreaming && (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-medium">
            Loading unified correlation report & investigation threads...
          </p>
        </div>
      )}

      {/* Report Loaded Content */}
      {report && !isReportLoading && (
        <div className="space-y-6">
          {/* Executive Overview Cards Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-xs text-stone-500 font-medium mb-1">Report Status</div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  Validated & Persisted
                </span>
              </div>
              <div className="text-xs text-stone-400 mt-1 font-mono">
                {new Date(report.generatedAt).toLocaleString()}
              </div>
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-xs text-stone-500 font-medium mb-1">Investigation Threads</div>
              <div className="font-bold text-2xl" style={{ color: 'var(--ink)' }}>
                {actionPlan.length}
              </div>
              <div className="text-xs text-stone-500 mt-0.5">Cross-layer causal chains</div>
            </div>

            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-xs text-stone-500 font-medium mb-1 font-sans">
                Available Findings
              </div>
              <div className="font-bold text-2xl text-purple-700">
                {reportData?.totalFindingsCount || 0}
              </div>
              <div className="text-xs text-stone-500 mt-0.5 font-sans">
                Across Code, DB, & Log analyzers
              </div>
            </div>
          </div>

          {/* Executive Narrative Summary */}
          <div
            className="p-6 rounded-lg border space-y-3"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-outline)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-base font-bold font-display" style={{ color: 'var(--ink)' }}>
                Executive Synthesis Summary
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {report.summary}
            </p>
          </div>

          {/* Prioritized Action Plan & The Thread Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-bold font-display" style={{ color: 'var(--ink)' }}>
                    The Thread — Grounded Investigation Chains ({actionPlan.length})
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Interactive multi-layer causal chains mapping root signals to operational impact.
                </p>
              </div>
            </div>

            {actionPlan.length === 0 ? (
              <div
                className="p-8 text-center space-y-2 rounded-lg border"
                style={{
                  backgroundColor: 'var(--surface-card)',
                  borderColor: 'var(--surface-outline)',
                }}
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold" style={{ color: 'var(--ink)' }}>
                  No Cross-Layer Systemic Issues Discovered
                </p>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Analyzer signals across Code, Database, and Operational Logs appear isolated
                  without systemic cross-layer correlation.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {actionPlan.map((corr, idx) => (
                  <ThreadCard
                    key={corr.id || idx}
                    correlation={corr}
                    rank={idx + 1}
                    findingsMap={findingsMap}
                    onNavigateToFinding={handleNavigateToFinding}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Intentional Empty State (No Report Yet) */}
      {!report && !isReportLoading && !isStreaming && (
        <div
          className="p-12 text-center space-y-4 rounded-lg border"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            style={{
              backgroundColor: 'var(--surface-bg)',
              border: '1px solid var(--surface-outline)',
            }}
          >
            <Cpu className="w-6 h-6 text-purple-600" />
          </div>

          <div>
            <h3 className="font-bold text-base" style={{ color: 'var(--ink)' }}>
              No Investigation Thread Available
            </h3>
            <p className="text-xs max-w-md mx-auto mt-1" style={{ color: 'var(--ink-soft)' }}>
              Execute the Correlation Engine to generate The Thread investigation timeline across
              Code, Database, and Operational Log layers.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartCorrelation}
            disabled={!activeProject}
            className="focus-ring inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-md text-white transition-all cursor-pointer shadow-sm"
            style={{
              background: 'linear-gradient(135deg, var(--thread-purple), #6366F1)',
            }}
          >
            <Play className="w-4 h-4 fill-current" />
            Generate Unified Report & The Thread Now
          </button>
        </div>
      )}
    </div>
  );
};
