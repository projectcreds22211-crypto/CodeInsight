import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ProjectsErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

export const ProjectsErrorState: React.FC<ProjectsErrorStateProps> = ({ error, onRetry }) => {
  return (
    <div
      className="flex flex-col items-center justify-center text-center space-y-4 my-6"
      style={{
        padding: 'var(--space-6)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: '#FDF0EF',
        border: '1px solid rgba(217, 72, 62, 0.2)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(217, 72, 62, 0.1)', color: 'var(--critical)' }}
      >
        <AlertTriangle className="w-6 h-6" />
      </div>

      <div className="space-y-1 max-w-md">
        <h3 className="text-base font-bold font-display" style={{ color: 'var(--ink)' }}>Failed to load project workspaces</h3>
        <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          {error?.message || 'An unexpected error occurred while communicating with the server.'}
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="focus-ring inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold hover:bg-[#B8382E] transition-colors cursor-pointer"
        style={{
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--critical)',
        }}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Try Again</span>
      </button>
    </div>
  );
};
