import React, { useState } from 'react';
import {
  GitFork,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  CornerDownRight,
} from 'lucide-react';
import type { CodeFinding } from '../../../lib/api-client';

interface CodeCycleCardProps {
  finding: CodeFinding;
}

export const CodeCycleCard: React.FC<CodeCycleCardProps> = ({ finding }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const meta = finding.metadata;
  const nodes = (meta?.nodes as string[]) || [];
  const cycleLength = (meta?.cycleLength as number) || nodes.length;
  const aiExplanation = meta?.aiExplanation as Record<string, unknown> | undefined;

  return (
    <div
      id={`finding-${finding.id}`}
      className="rounded-lg border overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'rgba(217, 72, 62, 0.3)',
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

          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 shrink-0">
            HIGH SEVERITY
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
            ARCHITECTURE CYCLE
          </span>

          <h4 className="text-xs font-bold font-mono truncate" style={{ color: 'var(--ink)' }}>
            {finding.title}
          </h4>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 font-mono">
            {cycleLength} Modules
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-4 space-y-4 text-xs">
          {/* Description */}
          <p className="text-stone-700 leading-relaxed">{finding.description}</p>

          {/* Module Dependency Chain Visualizer */}
          {nodes.length > 0 && (
            <div className="space-y-2">
              <div className="font-bold text-stone-600 flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-red-500" />
                Circular Dependency Path ({nodes.length} nodes):
              </div>
              <div
                className="p-3.5 rounded-md border font-mono text-xs space-y-1.5 overflow-x-auto"
                style={{
                  backgroundColor: '#211F1D',
                  borderColor: '#374151',
                  color: '#F9FAFB',
                }}
              >
                {nodes.map((node, idx) => {
                  const isLast = idx === nodes.length - 1;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-stone-500 w-4 text-right select-none">{idx + 1}.</span>
                      <span className="text-purple-300 font-semibold">{node}</span>
                      {!isLast && <ArrowRight className="w-3 h-3 text-red-400 shrink-0" />}
                      {isLast && (
                        <div className="flex items-center gap-1 text-red-400 font-bold ml-2">
                          <CornerDownRight className="w-3.5 h-3.5" />
                          <span>(loops back to {nodes[0]})</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Explanation / Advice Box */}
          {aiExplanation ? (
            <div
              className="p-4 rounded-md border space-y-2"
              style={{
                backgroundColor: 'rgba(107, 76, 230, 0.05)',
                borderColor: 'rgba(107, 76, 230, 0.25)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Claude AI Refactoring Suggestion & Explanation
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
                    Explanation & Architectural Impact:
                  </div>
                  <div className="text-stone-700 leading-relaxed">{aiExplanation.explanation}</div>
                </div>
              )}

              {typeof aiExplanation.recommendation === 'string' && (
                <div>
                  <div className="font-semibold text-purple-950 mb-0.5">
                    Recommended Refactoring:
                  </div>
                  <div className="text-stone-700 leading-relaxed">
                    {aiExplanation.recommendation}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="p-3 rounded-md border text-stone-500 bg-stone-50 flex items-center justify-between"
              style={{ borderColor: 'var(--surface-outline)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">Deterministic Recommendation:</span>
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
