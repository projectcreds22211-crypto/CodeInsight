import React from 'react';
import { FileText, Clock } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--ink)' }}>Unified Reports</h1>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>View historical correlation passes and saved project action plans.</p>
      </div>

      <div
        className="p-8 text-center space-y-3"
        style={{
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--surface-outline)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
          style={{
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
            color: '#78716C',
          }}
        >
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-base" style={{ color: 'var(--ink)' }}>No reports generated yet</h3>
          <p className="text-xs max-w-sm mx-auto mt-1" style={{ color: 'var(--ink-soft)' }}>
            Run complete analyzer passes to generate persistent correlation reports.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-[#78716C]">
          <Clock className="w-3.5 h-3.5" />
          <span>Report persistence active in Phase 6</span>
        </div>
      </div>
    </div>
  );
};
