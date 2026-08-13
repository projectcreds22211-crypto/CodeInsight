import React from 'react';
import { RefreshCw, FileCode, GitFork, AlertTriangle, Sparkles } from 'lucide-react';
import type { CodeAnalyzerResult, CodeTechDebtScore } from '../../../lib/api-client';

interface CodeResultOverviewProps {
  result: CodeAnalyzerResult;
}

export const CodeResultOverview: React.FC<CodeResultOverviewProps> = ({ result }) => {
  const { metrics, summary, customData } = result;
  const scoreData: CodeTechDebtScore | undefined = customData?.techDebtScore;

  const score = scoreData?.score ?? metrics.score ?? 100;
  const band =
    scoreData?.band ??
    (score >= 85 ? 'healthy' : score >= 70 ? 'moderate' : score >= 50 ? 'concerning' : 'high-debt');

  const getBandStyles = (b: string) => {
    switch (b) {
      case 'healthy':
        return {
          label: 'Healthy Repo',
          bg: '#ECFDF5',
          border: '#6EE7B7',
          color: '#047857',
        };
      case 'moderate':
        return {
          label: 'Moderate Debt',
          bg: '#EFF6FF',
          border: '#93C5FD',
          color: '#1D4ED8',
        };
      case 'concerning':
        return {
          label: 'Concerning Debt',
          bg: '#FFFBEB',
          border: '#FCD34D',
          color: '#B45309',
        };
      case 'high-debt':
      default:
        return {
          label: 'High Tech Debt',
          bg: '#FEF2F2',
          border: '#FCA5A5',
          color: '#B91C1C',
        };
    }
  };

  const bandStyle = getBandStyles(band);
  const penalties = scoreData?.penalties;
  const counts = scoreData?.counts;

  return (
    <div className="space-y-4">
      {/* Main Score & Metrics Header */}
      <div
        className="p-6 rounded-lg border grid grid-cols-1 md:grid-cols-4 gap-6 items-center"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderColor: 'var(--surface-outline)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Scorecard Hero */}
        <div
          className="md:col-span-1 flex flex-col items-center justify-center p-4 rounded-lg border text-center"
          style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
        >
          <div
            className="text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: 'var(--ink-soft)' }}
          >
            Tech Debt Score
          </div>
          <div className="text-4xl font-extrabold font-display" style={{ color: bandStyle.color }}>
            {score}
            <span className="text-sm font-normal text-stone-400">/100</span>
          </div>
          <div
            className="mt-2 text-xs font-bold px-3 py-0.5 rounded-full border uppercase tracking-wide inline-block"
            style={{
              backgroundColor: bandStyle.bg,
              borderColor: bandStyle.border,
              color: bandStyle.color,
            }}
          >
            {bandStyle.label}
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            className="p-3 rounded-md border"
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
          >
            <div
              className="text-xs flex items-center gap-1.5 font-semibold"
              style={{ color: 'var(--ink-soft)' }}
            >
              <FileCode className="w-3.5 h-3.5 text-purple-600" />
              Files Analyzed
            </div>
            <div className="text-xl font-bold font-display mt-1" style={{ color: 'var(--ink)' }}>
              {metrics.itemsAnalyzed}
            </div>
          </div>

          <div
            className="p-3 rounded-md border"
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
          >
            <div
              className="text-xs flex items-center gap-1.5 font-semibold"
              style={{ color: 'var(--ink-soft)' }}
            >
              <GitFork className="w-3.5 h-3.5 text-red-500" />
              Module Cycles
            </div>
            <div
              className="text-xl font-bold font-display mt-1"
              style={{ color: summary.categoryCounts.architecture > 0 ? '#B91C1C' : 'var(--ink)' }}
            >
              {summary.categoryCounts.architecture}
            </div>
          </div>

          <div
            className="p-3 rounded-md border"
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
          >
            <div
              className="text-xs flex items-center gap-1.5 font-semibold"
              style={{ color: 'var(--ink-soft)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Code Smells
            </div>
            <div
              className="text-xl font-bold font-display mt-1"
              style={{ color: summary.categoryCounts.tech_debt > 0 ? '#B45309' : 'var(--ink)' }}
            >
              {summary.categoryCounts.tech_debt}
            </div>
          </div>

          <div
            className="p-3 rounded-md border"
            style={{ backgroundColor: 'var(--surface-bg)', borderColor: 'var(--surface-outline)' }}
          >
            <div
              className="text-xs flex items-center gap-1.5 font-semibold"
              style={{ color: 'var(--ink-soft)' }}
            >
              <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
              Analysis Time
            </div>
            <div className="text-xl font-bold font-display mt-1" style={{ color: 'var(--ink)' }}>
              {metrics.performanceMs} <span className="text-xs font-normal text-stone-500">ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Overview Banner */}
      {customData?.summaryOverview && (
        <div
          className="p-4 rounded-lg border flex items-start gap-3"
          style={{
            backgroundColor: 'rgba(107, 76, 230, 0.04)',
            borderColor: 'rgba(107, 76, 230, 0.2)',
          }}
        >
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-purple-900">Analysis Summary & Executive Overview</div>
            <div className="text-stone-700 leading-relaxed">{customData.summaryOverview}</div>
          </div>
        </div>
      )}

      {/* Score Penalty Components Breakdown */}
      {penalties && (
        <div
          className="p-5 rounded-lg border space-y-3"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h4
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--ink-soft)' }}
          >
            Tech Debt Score Penalty Breakdown
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div
              className="p-2.5 rounded border text-center"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-[11px] text-stone-500">Circular Deps</div>
              <div className="text-sm font-bold text-red-600 mt-0.5">
                -{penalties.circularDependencies} pts
              </div>
              <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                {counts?.circularDependencies ?? 0} cycles
              </div>
            </div>

            <div
              className="p-2.5 rounded border text-center"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-[11px] text-stone-500">Long Functions</div>
              <div className="text-sm font-bold text-amber-600 mt-0.5">
                -{penalties.longFunctions} pts
              </div>
              <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                {counts?.longFunctions ?? 0} instances
              </div>
            </div>

            <div
              className="p-2.5 rounded border text-center"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-[11px] text-stone-500">Duplicate Logic</div>
              <div className="text-sm font-bold text-amber-600 mt-0.5">
                -{penalties.duplicateLogic} pts
              </div>
              <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                {counts?.duplicateLogic ?? 0} blocks
              </div>
            </div>

            <div
              className="p-2.5 rounded border text-center"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-[11px] text-stone-500">Unused Exports</div>
              <div className="text-sm font-bold text-blue-600 mt-0.5">
                -{penalties.potentiallyUnusedExports} pts
              </div>
              <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                {counts?.potentiallyUnusedExports ?? 0} exports
              </div>
            </div>

            <div
              className="p-2.5 rounded border text-center"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-[11px] text-stone-500">Comment Debt</div>
              <div className="text-sm font-bold text-stone-600 mt-0.5">
                -{penalties.commentDebt} pts
              </div>
              <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                {(counts?.todoMarkers ?? 0) + (counts?.fixmeMarkers ?? 0)} markers
              </div>
            </div>

            <div
              className="p-2.5 rounded border text-center"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
              }}
            >
              <div className="text-[11px] text-stone-500">Test File Ratio</div>
              <div className="text-sm font-bold text-purple-600 mt-0.5">
                -{penalties.testFileRatio} pts
              </div>
              <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                {((scoreData?.testFileRatio ?? 1) * 100).toFixed(1)}% tests
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
