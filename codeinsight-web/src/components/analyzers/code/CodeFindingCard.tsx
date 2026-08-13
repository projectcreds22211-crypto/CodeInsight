import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, Sparkles, Code, ArrowRight } from 'lucide-react';
import type { CodeFinding } from '../../../lib/api-client';

interface CodeFindingCardProps {
  finding: CodeFinding;
}

export const CodeFindingCard: React.FC<CodeFindingCardProps> = ({ finding }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const meta = finding.metadata;
  const ruleId = (meta?.ruleId as string) || 'code-smell';
  const file =
    (meta?.file as string) || (finding.evidence?.[0]?.source as string) || 'unknown file';
  const startLine = meta?.startLine ?? finding.evidence?.[0]?.lineStart;
  const endLine = meta?.endLine ?? finding.evidence?.[0]?.lineEnd;
  const aiExplanation = meta?.aiExplanation as Record<string, unknown> | undefined;

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return { label: 'CRITICAL', bg: '#FEF2F2', border: '#FCA5A5', color: '#991B1B' };
      case 'high':
        return { label: 'HIGH', bg: '#FFF7ED', border: '#FDBA74', color: '#C2410C' };
      case 'medium':
        return { label: 'MEDIUM', bg: '#FFFBEB', border: '#FCD34D', color: '#B45309' };
      case 'low':
      default:
        return { label: 'LOW', bg: '#EFF6FF', border: '#93C5FD', color: '#1D4ED8' };
    }
  };

  const sevBadge = getSeverityBadge(finding.severity);

  return (
    <div
      id={`finding-${finding.id}`}
      className="rounded-lg border overflow-hidden transition-all"
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
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        className="focus-ring p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors select-none"
        style={{ borderBottom: isExpanded ? '1px solid var(--surface-outline)' : 'none' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-stone-400 shrink-0" aria-hidden="true">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>

          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0"
            style={{
              backgroundColor: sevBadge.bg,
              borderColor: sevBadge.border,
              color: sevBadge.color,
            }}
          >
            {sevBadge.label}
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200 shrink-0 font-mono">
            {ruleId}
          </span>

          <h4 className="text-xs font-bold font-mono truncate" style={{ color: 'var(--ink)' }}>
            {finding.title}
          </h4>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 font-mono flex items-center gap-1">
            <FileCode className="w-3 h-3 text-stone-500" />
            {file}
            {startLine ? `:L${startLine}${endLine ? `-L${endLine}` : ''}` : ''}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-4 space-y-4 text-xs">
          {/* Message Description */}
          <p className="text-stone-700 leading-relaxed">{finding.description}</p>

          {/* Evidence Snippet */}
          {finding.evidence && finding.evidence.length > 0 && finding.evidence[0].snippet && (
            <div className="space-y-1.5">
              <div className="font-bold text-stone-600 flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-stone-500" />
                Source File Location & Evidence:
              </div>
              <pre
                className="p-3 rounded-md border font-mono text-[11px] overflow-x-auto whitespace-pre-wrap"
                style={{
                  backgroundColor: '#211F1D',
                  borderColor: '#374151',
                  color: '#F9FAFB',
                }}
              >
                {finding.evidence[0].snippet}
              </pre>
            </div>
          )}

          {/* Claude AI Explanation / Advisory Section */}
          {aiExplanation ? (
            <div
              className="p-4 rounded-md border space-y-3"
              style={{
                backgroundColor: 'rgba(107, 76, 230, 0.05)',
                borderColor: 'rgba(107, 76, 230, 0.25)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Claude AI Advisory & Refactor Recommendation
                </div>
                {aiExplanation.confidence && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 uppercase">
                    Confidence: {String(aiExplanation.confidence)}
                  </span>
                )}
              </div>

              {typeof aiExplanation.explanation === 'string' && (
                <div>
                  <div className="font-semibold text-purple-950 mb-0.5">
                    Root Cause & Explanation:
                  </div>
                  <div className="text-stone-700 leading-relaxed">{aiExplanation.explanation}</div>
                </div>
              )}

              {typeof aiExplanation.likelyImpact === 'string' && (
                <div>
                  <div className="font-semibold text-purple-950 mb-0.5">Likely Impact:</div>
                  <div className="text-stone-700 leading-relaxed">{aiExplanation.likelyImpact}</div>
                </div>
              )}

              {typeof aiExplanation.recommendation === 'string' && (
                <div>
                  <div className="font-semibold text-purple-950 mb-0.5">
                    Actionable Recommendation:
                  </div>
                  <div className="text-stone-700 leading-relaxed">
                    {aiExplanation.recommendation}
                  </div>
                </div>
              )}

              {/* Refactor Example Box */}
              {typeof aiExplanation.refactorExample === 'string' && (
                <div className="space-y-1.5 pt-1">
                  <div className="font-semibold text-purple-950 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-purple-600" />
                    Illustrative Refactor Example:
                  </div>
                  <pre
                    className="p-3 rounded border font-mono text-[11px] overflow-x-auto whitespace-pre-wrap"
                    style={{
                      backgroundColor: '#1E1B2E',
                      borderColor: '#4C3A85',
                      color: '#E9D8FD',
                    }}
                  >
                    {aiExplanation.refactorExample}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div
              className="p-3 rounded-md border text-stone-500 bg-stone-50 flex items-center justify-between"
              style={{ borderColor: 'var(--surface-outline)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-700">Deterministic Recommendation:</span>
                <span>{finding.recommendation}</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">Claude AI Offline</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
