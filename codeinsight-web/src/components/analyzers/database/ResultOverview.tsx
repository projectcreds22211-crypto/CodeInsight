import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, Layers } from 'lucide-react';
import type { DatabaseAnalyzerResult } from '../../../lib/api-client';

interface ResultOverviewProps {
  result: DatabaseAnalyzerResult;
}

export const ResultOverview: React.FC<ResultOverviewProps> = ({ result }) => {
  const { summary, metrics } = result;
  const score = metrics?.score ?? 100;

  const getScoreColor = (val: number) => {
    if (val >= 80) return 'var(--success)';
    if (val >= 50) return 'var(--warning)';
    return 'var(--critical)';
  };

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
      {/* Top summary row: Health Score + Severity Counts */}
      <div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b pb-6"
        style={{ borderColor: 'var(--surface-outline)' }}
      >
        {/* Health Score Pill */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-display shrink-0"
            style={{
              backgroundColor: 'var(--surface-bg)',
              border: `2px solid ${getScoreColor(score)}`,
            }}
          >
            <span
              className="text-2xl font-bold leading-none"
              style={{ color: getScoreColor(score) }}
            >
              {score}
            </span>
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider mt-0.5">
              Score
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold font-display" style={{ color: 'var(--ink)' }}>
              Database Performance Audit
            </h2>
            <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {summary.totalFindings === 0
                ? 'No database performance issues detected cleanly.'
                : `Detected ${summary.totalFindings} deterministic optimization opportunity${summary.totalFindings === 1 ? '' : 'ies'}.`}
            </p>
          </div>
        </div>

        {/* Severity Count Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Critical */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold"
            style={{ backgroundColor: '#FDF2F2', borderColor: '#FCA5A5', color: '#B91C1C' }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Critical: {summary.severityCounts.critical || 0}</span>
          </div>
          {/* High */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold"
            style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#C2410C' }}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>High: {summary.severityCounts.high || 0}</span>
          </div>
          {/* Medium */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold"
            style={{ backgroundColor: '#FEFCE8', borderColor: '#FDE047', color: '#854D0E' }}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Medium: {summary.severityCounts.medium || 0}</span>
          </div>
          {/* Low */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold"
            style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC', color: '#15803D' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Low: {summary.severityCounts.low || 0}</span>
          </div>
        </div>
      </div>

      {/* Bottom metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
          }}
        >
          <Layers className="w-4 h-4 text-[var(--thread-purple)]" />
          <div>
            <p className="text-[#78716C] text-[11px]">Queries Analyzed</p>
            <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
              {metrics.itemsAnalyzed ?? summary.totalFindings}
            </p>
          </div>
        </div>

        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
          }}
        >
          <Cpu className="w-4 h-4 text-[var(--analyzer-db)]" />
          <div>
            <p className="text-[#78716C] text-[11px]">Rules Evaluated</p>
            <p className="font-bold text-sm" style={{ color: 'var(--ink)' }}>
              {metrics.rulesEvaluated ?? 7}
            </p>
          </div>
        </div>

        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
          }}
        >
          <Clock className="w-4 h-4 text-[var(--analyzer-logs)]" />
          <div>
            <p className="text-[#78716C] text-[11px]">Execution Time</p>
            <p className="font-bold text-sm font-mono" style={{ color: 'var(--ink)' }}>
              {metrics.performanceMs ?? 0} ms
            </p>
          </div>
        </div>

        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
          }}
        >
          <Activity className="w-4 h-4 text-[#3E9C6E]" />
          <div>
            <p className="text-[#78716C] text-[11px]">Status</p>
            <p className="font-bold text-sm capitalize" style={{ color: 'var(--ink)' }}>
              {result.status}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
