import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, Sparkles, Database, Layers, ArrowUpRight } from 'lucide-react';
import type { Finding } from '../../../lib/api-client';
import { CodeComparisonView } from './CodeComparisonView';

interface FindingCardProps {
  finding: Finding;
}

export const FindingCard: React.FC<FindingCardProps> = ({ finding }) => {
  const { severity, category, title, description, recommendation, metadata } = finding;
  const [copiedIndex, setCopiedIndex] = useState(false);

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical':
        return { bg: '#FDF2F2', border: '#FCA5A5', text: '#B91C1C', label: 'CRITICAL' };
      case 'high':
        return { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', label: 'HIGH' };
      case 'medium':
        return { bg: '#FEFCE8', border: '#FDE047', text: '#854D0E', label: 'MEDIUM' };
      default:
        return { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', label: 'LOW' };
    }
  };

  const sevStyle = getSeverityStyle(severity);

  const isOfflineFallback =
    recommendation?.includes('Deterministic rule fallback') ||
    description?.includes('Deterministic database analysis');

  const handleCopyIndex = (stmt: string) => {
    navigator.clipboard.writeText(stmt);
    setCopiedIndex(true);
    setTimeout(() => setCopiedIndex(false), 2000);
  };

  return (
    <div
      className="p-6 space-y-5 transition-all duration-200"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header: Badges & Rule ID */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Severity Badge */}
          <span
            className="px-2.5 py-1 text-[11px] font-bold tracking-wider rounded-md border flex items-center gap-1.5"
            style={{
              backgroundColor: sevStyle.bg,
              borderColor: sevStyle.border,
              color: sevStyle.text,
            }}
          >
            <AlertTriangle className="w-3 h-3" />
            {sevStyle.label}
          </span>

          {/* Category Badge */}
          <span
            className="px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-md uppercase"
            style={{
              backgroundColor: 'var(--surface-bg)',
              border: '1px solid var(--surface-outline)',
              color: 'var(--ink-soft)',
            }}
          >
            {category.replace('_', ' ')}
          </span>

          {/* Target Table / Column Tag */}
          {(metadata?.table || metadata?.column) && (
            <span
              className="px-2.5 py-1 text-[11px] font-mono font-medium rounded-md text-[var(--analyzer-db)] flex items-center gap-1"
              style={{
                backgroundColor: 'rgba(46, 156, 143, 0.08)',
                border: '1px solid rgba(46, 156, 143, 0.2)',
              }}
            >
              <Database className="w-3 h-3" />
              {metadata.table ? metadata.table : ''}
              {metadata.column ? `.${metadata.column}` : ''}
            </span>
          )}
        </div>

        {/* AI Explanation Transparency Badge */}
        <div className="flex items-center gap-1.5">
          {isOfflineFallback ? (
            <span className="text-[11px] font-medium text-[#78716C] bg-[#F7F6F3] px-2 py-0.5 rounded border border-[#E7E4DD]">
              Deterministic Analysis — AI Explanation Unavailable
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-[var(--thread-purple)] bg-[var(--thread-purple)]/10 px-2 py-0.5 rounded border border-[var(--thread-purple)]/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Claude 3.5 Sonnet Optimization
            </span>
          )}
        </div>
      </div>

      {/* Finding Title & Description */}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold font-display" style={{ color: 'var(--ink)' }}>
          {title}
        </h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {description}
        </p>
      </div>

      {/* Target Query Text (if provided in metadata) */}
      {metadata?.queryText && !metadata?.rewrittenQuery && (
        <div className="rounded-lg p-3 bg-[#1A1816] border border-[#2C2926] space-y-1">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A8A29E]">
            Target Query
          </p>
          <pre className="text-xs font-mono text-[#E7E4DD] whitespace-pre-wrap overflow-x-auto">
            <code>{metadata.queryText}</code>
          </pre>
        </div>
      )}

      {/* BEFORE / AFTER Comparison View */}
      {metadata?.queryText && metadata?.rewrittenQuery && (
        <CodeComparisonView
          originalQuery={metadata.queryText}
          rewrittenQuery={metadata.rewrittenQuery}
        />
      )}

      {/* Index Recommendation Box */}
      {metadata?.suggestedIndex && (
        <div className="p-4 rounded-xl border space-y-2 bg-[#F0FDF4] border-[#86EFAC]">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold font-display text-[#15803D] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#15803D]" />
              RECOMMENDED INDEX STATEMENT
            </h4>
            <button
              type="button"
              onClick={() => handleCopyIndex(metadata.suggestedIndex!)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-[#DCFCE7] text-[#15803D] hover:bg-[#BBF7D0] transition-colors cursor-pointer"
            >
              {copiedIndex ? (
                <Check className="w-3 h-3 text-[#15803D]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedIndex ? 'Copied' : 'Copy Index DDL'}</span>
            </button>
          </div>
          <pre className="p-2.5 rounded-lg bg-[#1A1816] text-xs font-mono text-[#86EFAC] overflow-x-auto border border-[#2C2926]">
            <code>{metadata.suggestedIndex}</code>
          </pre>
        </div>
      )}

      {/* Technical Rationale / Recommendation */}
      {recommendation && (
        <div
          className="p-3 rounded-lg text-xs leading-relaxed space-y-1"
          style={{
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
            color: 'var(--ink)',
          }}
        >
          <p className="font-bold text-[11px] uppercase tracking-wider text-[var(--analyzer-db)] flex items-center gap-1">
            <span>Optimization Recommendation</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </p>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            {recommendation}
          </p>
        </div>
      )}
    </div>
  );
};
