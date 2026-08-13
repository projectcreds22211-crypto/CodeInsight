import React, { useState } from 'react';
import { Check, Copy, ArrowRight } from 'lucide-react';

interface CodeComparisonViewProps {
  originalQuery: string;
  rewrittenQuery: string;
}

export const CodeComparisonView: React.FC<CodeComparisonViewProps> = ({
  originalQuery,
  rewrittenQuery,
}) => {
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedRewritten, setCopiedRewritten] = useState(false);

  const handleCopy = (text: string, isRewritten: boolean) => {
    navigator.clipboard.writeText(text);
    if (isRewritten) {
      setCopiedRewritten(true);
      setTimeout(() => setCopiedRewritten(false), 2000);
    } else {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#78716C]">
          Query Optimization Comparison
        </h4>
        <span className="text-[11px] font-medium text-[var(--analyzer-db)] flex items-center gap-1">
          <span>100% Semantic Preservation</span>
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* BEFORE: Original Query */}
        <div className="rounded-xl border overflow-hidden flex flex-col bg-[#1A1816] border-[#2C2926]">
          <div className="px-3 py-2 bg-[#24211E] border-b border-[#2C2926] flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-[#F5748C] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F5748C]" />
              BEFORE (Original SQL)
            </span>
            <button
              type="button"
              onClick={() => handleCopy(originalQuery, false)}
              className="text-[#A8A29E] hover:text-white transition-colors p-1 rounded cursor-pointer"
              title="Copy original SQL"
            >
              {copiedOriginal ? (
                <Check className="w-3.5 h-3.5 text-[#3E9C6E]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <pre className="p-3 text-xs font-mono text-[#E7E4DD] overflow-x-auto whitespace-pre-wrap leading-relaxed flex-1">
            <code>{originalQuery}</code>
          </pre>
        </div>

        {/* AFTER: Rewritten Query */}
        <div className="rounded-xl border overflow-hidden flex flex-col bg-[#1A1816] border-[#2E9C8F]/40 shadow-sm">
          <div className="px-3 py-2 bg-[#1E2E2B] border-b border-[#2E9C8F]/30 flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-[#2E9C8F] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2E9C8F]" />
              AFTER (Optimized SQL)
            </span>
            <button
              type="button"
              onClick={() => handleCopy(rewrittenQuery, true)}
              className="text-[#2E9C8F] hover:text-white transition-colors p-1 rounded cursor-pointer"
              title="Copy optimized SQL"
            >
              {copiedRewritten ? (
                <Check className="w-3.5 h-3.5 text-[#3E9C6E]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <pre className="p-3 text-xs font-mono text-[#A7F3D0] overflow-x-auto whitespace-pre-wrap leading-relaxed flex-1">
            <code>{rewrittenQuery}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
