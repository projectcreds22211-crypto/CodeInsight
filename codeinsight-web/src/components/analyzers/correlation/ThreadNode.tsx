import React from 'react';
import { FileCode, Database, FileSpreadsheet, ArrowRight } from 'lucide-react';
import type { Finding } from '../../../lib/api-client';

interface ThreadNodeProps {
  findingId: string;
  finding?: Finding | null;
  onNavigateToFinding?: (findingId: string, analyzer?: 'code' | 'database' | 'logs') => void;
}

export const ThreadNode: React.FC<ThreadNodeProps> = ({
  findingId,
  finding,
  onNavigateToFinding,
}) => {
  // Infer analyzer from finding or findingId prefix
  let analyzer: 'code' | 'database' | 'logs' = finding?.analyzer || 'code';
  if (!finding) {
    const fid = findingId.toLowerCase();
    if (fid.includes('db') || fid.includes('query')) {
      analyzer = 'database';
    } else if (fid.includes('log') || fid.includes('anomaly')) {
      analyzer = 'logs';
    }
  }

  const severity = finding?.severity || 'high';
  const title = finding?.title || `Finding ${findingId}`;

  const getAnalyzerIcon = (an: 'code' | 'database' | 'logs') => {
    switch (an) {
      case 'code':
        return <FileCode className="w-3.5 h-3.5 text-emerald-600" />;
      case 'database':
        return <Database className="w-3.5 h-3.5 text-blue-600" />;
      case 'logs':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            MEDIUM
          </span>
        );
      case 'low':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
            LOW
          </span>
        );
    }
  };

  // Extract concise evidence snippet
  const evidenceSnippet =
    finding?.evidence && finding.evidence.length > 0
      ? finding.evidence[0].snippet || finding.evidence[0].source
      : (finding?.metadata?.ruleId as string) ||
        (finding?.metadata?.queryHash as string) ||
        undefined;

  return (
    <div
      className="p-3 rounded-md border transition-all hover:border-purple-300 space-y-2"
      style={{
        backgroundColor: 'var(--surface-bg)',
        borderColor: 'var(--surface-outline)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-white border border-stone-200 shadow-2xs">
            {getAnalyzerIcon(analyzer)}
          </div>
          <span className="font-mono text-xs font-bold capitalize" style={{ color: 'var(--ink)' }}>
            {analyzer} Signal
          </span>
          <span className="font-mono text-[11px] text-stone-500">({findingId})</span>
        </div>
        {getSeverityBadge(severity)}
      </div>

      <div>
        <h5 className="text-xs font-bold font-display" style={{ color: 'var(--ink)' }}>
          {title}
        </h5>
        {evidenceSnippet && (
          <p className="text-[11px] font-mono text-stone-600 mt-1 line-clamp-2">
            {evidenceSnippet}
          </p>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onNavigateToFinding?.(findingId, analyzer)}
          className="focus-ring inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 cursor-pointer"
        >
          <span>View in {analyzer} analyzer</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
