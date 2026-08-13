import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  FileCode,
  Database,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import type {
  Finding,
  GroundedCorrelation,
  CorrelationRelationship,
  CorrelationConfidence,
} from '../../../lib/api-client';
import { ThreadNode } from './ThreadNode';
import { ThreadConnector } from './ThreadConnector';

interface ThreadCardProps {
  correlation: GroundedCorrelation;
  rank: number;
  findingsMap: Map<string, Finding>;
  onNavigateToFinding?: (findingId: string, analyzer?: 'code' | 'database' | 'logs') => void;
}

export const ThreadCard: React.FC<ThreadCardProps> = ({
  correlation,
  rank,
  findingsMap,
  onNavigateToFinding,
}) => {
  const {
    findingIds,
    analyzers,
    relationship,
    explanation,
    evidence,
    confidence,
    temporalEvidence,
  } = correlation;
  const [isExpanded, setIsExpanded] = useState(true);

  const getRelationshipStyles = (rel: CorrelationRelationship) => {
    switch (rel) {
      case 'temporal':
        return { label: 'Temporal Alignment', bg: '#EEF2FF', border: '#C7D2FE', color: '#4338CA' };
      case 'code-to-query':
        return { label: 'Code ↔ SQL Query', bg: '#F5F3FF', border: '#DDD6FE', color: '#6D28D9' };
      case 'query-to-runtime':
        return {
          label: 'SQL Query ↔ Runtime Log',
          bg: '#FFFBEB',
          border: '#FDE68A',
          color: '#B45309',
        };
      case 'code-to-runtime':
        return {
          label: 'Code ↔ Operational Error',
          bg: '#FFF1F2',
          border: '#FECDD3',
          color: '#BE123C',
        };
      case 'cross-layer':
      default:
        return {
          label: 'Cross-Layer Systemic',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          color: '#047857',
        };
    }
  };

  const getConfidenceStyles = (conf: CorrelationConfidence) => {
    switch (conf) {
      case 'high':
        return { label: 'High Confidence', bg: '#ECFDF5', color: '#047857' };
      case 'medium':
        return { label: 'Medium Confidence', bg: '#EFF6FF', color: '#1D4ED8' };
      case 'low':
      default:
        return { label: 'Low Confidence', bg: '#F3F4F6', color: '#4B5563' };
    }
  };

  const relStyle = getRelationshipStyles(relationship);
  const confStyle = getConfidenceStyles(confidence);

  return (
    <div
      className="rounded-lg border transition-all space-y-4 overflow-hidden"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header Bar */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        className="focus-ring p-4 border-b flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
        style={{ borderColor: 'var(--surface-outline)', backgroundColor: 'var(--surface-bg)' }}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs"
            style={{
              backgroundColor: 'var(--surface-card)',
              border: '1px solid var(--surface-outline)',
              color: 'var(--ink)',
            }}
          >
            #{rank}
          </span>

          <span
            className="px-2.5 py-1 rounded-md font-medium text-xs border"
            style={{
              backgroundColor: relStyle.bg,
              borderColor: relStyle.border,
              color: relStyle.color,
            }}
          >
            {relStyle.label}
          </span>

          <span
            className="px-2 py-0.5 rounded font-medium text-xs"
            style={{
              backgroundColor: confStyle.bg,
              color: confStyle.color,
            }}
          >
            {confStyle.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Participating Analyzers */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            {analyzers.map((an) => (
              <span
                key={an}
                className="px-1.5 py-0.5 rounded capitalize text-xs border"
                style={{
                  backgroundColor: 'var(--surface-card)',
                  borderColor: 'var(--surface-outline)',
                  color: 'var(--ink)',
                }}
              >
                {an === 'code' && <FileCode className="w-3 h-3 inline mr-1 text-emerald-600" />}
                {an === 'database' && <Database className="w-3 h-3 inline mr-1 text-blue-600" />}
                {an === 'logs' && (
                  <FileSpreadsheet className="w-3 h-3 inline mr-1 text-amber-600" />
                )}
                {an}
              </span>
            ))}
          </div>

          <button
            type="button"
            className="p-1 rounded text-stone-500 hover:text-stone-800"
            aria-label={isExpanded ? 'Collapse thread' : 'Expand thread'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 pt-1 space-y-5">
          {/* Narrative & Explanation */}
          <div className="space-y-1">
            <h4 className="text-sm font-bold font-display" style={{ color: 'var(--ink)' }}>
              Systemic Explanation & Action Item
            </h4>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {explanation}
            </p>
          </div>

          {/* The Thread Investigation Chain */}
          <div
            className="p-4 rounded-lg border space-y-1"
            style={{
              backgroundColor: 'rgba(245, 243, 255, 0.4)',
              borderColor: 'var(--surface-outline)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-purple-600" />
              <h5 className="text-xs font-bold font-display uppercase tracking-wider text-purple-950">
                The Thread — Investigation Chain
              </h5>
            </div>

            <div className="space-y-1">
              {findingIds.map((fid, idx) => (
                <React.Fragment key={fid}>
                  <ThreadNode
                    findingId={fid}
                    finding={findingsMap.get(fid)}
                    onNavigateToFinding={onNavigateToFinding}
                  />

                  {idx < findingIds.length - 1 && (
                    <ThreadConnector relationship={relationship} temporalDelta={temporalEvidence} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Concrete Grounded Evidence Signal */}
          {evidence && (
            <div
              className="p-3 rounded border text-xs font-mono space-y-1"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
                color: 'var(--ink)',
              }}
            >
              <div className="flex items-center gap-1.5 font-bold font-sans text-xs text-stone-700">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Grounded Evidence Signal:
              </div>
              <p className="leading-relaxed whitespace-pre-wrap">{evidence}</p>
            </div>
          )}

          {/* Navigable Grounding References Footer */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--surface-outline)' }}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                Supported by {findingIds.length} deterministic finding
                {findingIds.length === 1 ? '' : 's'}:
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {findingIds.map((fid) => {
                let targetAnalyzer: 'code' | 'database' | 'logs' = 'code';
                const fObj = findingsMap.get(fid);
                if (
                  fObj &&
                  (fObj.analyzer === 'code' ||
                    fObj.analyzer === 'database' ||
                    fObj.analyzer === 'logs')
                ) {
                  targetAnalyzer = fObj.analyzer;
                } else if (
                  fid.toLowerCase().includes('db') ||
                  fid.toLowerCase().includes('query')
                ) {
                  targetAnalyzer = 'database';
                } else if (
                  fid.toLowerCase().includes('log') ||
                  fid.toLowerCase().includes('anomaly')
                ) {
                  targetAnalyzer = 'logs';
                }

                return (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => onNavigateToFinding?.(fid, targetAnalyzer)}
                    className="focus-ring inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--surface-outline)',
                      color: 'var(--ink)',
                    }}
                    title={`Click to view finding ${fid} in ${targetAnalyzer} analyzer`}
                  >
                    <span>{fid}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
