import React from 'react';
import { ShieldCheck, Zap, ArrowRight, FileCode, Database, FileSpreadsheet } from 'lucide-react';
import type {
  GroundedCorrelation,
  CorrelationRelationship,
  CorrelationConfidence,
} from '../../../lib/api-client';

interface ActionPlanCardProps {
  correlation: GroundedCorrelation;
  rank: number;
  onNavigateToFinding?: (findingId: string, analyzer?: 'code' | 'database' | 'logs') => void;
}

export const ActionPlanCard: React.FC<ActionPlanCardProps> = ({
  correlation,
  rank,
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
      className="p-5 rounded-lg border transition-all space-y-4"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Top Meta Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"
        style={{ borderColor: 'var(--surface-outline)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs"
            style={{
              backgroundColor: 'var(--surface-bg)',
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

        {/* Participating Analyzers */}
        <div
          className="flex items-center gap-1.5 text-xs font-mono"
          style={{ color: 'var(--ink-soft)' }}
        >
          <span className="text-xs text-stone-500 font-sans mr-1">Analyzers:</span>
          {analyzers.map((an) => (
            <span
              key={an}
              className="px-1.5 py-0.5 rounded capitalize text-xs border"
              style={{
                backgroundColor: 'var(--surface-bg)',
                borderColor: 'var(--surface-outline)',
                color: 'var(--ink)',
              }}
            >
              {an === 'code' && <FileCode className="w-3 h-3 inline mr-1 text-emerald-600" />}
              {an === 'database' && <Database className="w-3 h-3 inline mr-1 text-blue-600" />}
              {an === 'logs' && <FileSpreadsheet className="w-3 h-3 inline mr-1 text-amber-600" />}
              {an}
            </span>
          ))}
        </div>
      </div>

      {/* Explanation Narrative */}
      <div className="space-y-1">
        <h4 className="text-sm font-bold font-display" style={{ color: 'var(--ink)' }}>
          Recommendation & Systemic Correlation
        </h4>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {explanation}
        </p>
      </div>

      {/* Concrete Grounded Evidence */}
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
          {temporalEvidence && (
            <div className="mt-2 pt-1 border-t text-stone-500 font-sans text-xs">
              ⏱ Temporal Window: {temporalEvidence}
            </div>
          )}
        </div>
      )}

      {/* Navigable Grounding References Section */}
      <div className="pt-2">
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
            if (fid.toLowerCase().includes('db') || fid.toLowerCase().includes('query')) {
              targetAnalyzer = 'database';
            } else if (fid.toLowerCase().includes('log') || fid.toLowerCase().includes('anomaly')) {
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
  );
};
