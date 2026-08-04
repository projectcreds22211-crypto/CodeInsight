import React from 'react';
import { FolderKanban, Plus, Sparkles, Loader2 } from 'lucide-react';

interface ProjectsEmptyStateProps {
  onOpenCreateModal: () => void;
  onLoadDemoRepository?: () => void;
  isLoadingDemo?: boolean;
}

export const ProjectsEmptyState: React.FC<ProjectsEmptyStateProps> = ({
  onOpenCreateModal,
  onLoadDemoRepository,
  isLoadingDemo = false,
}) => {
  return (
    <div
      className="flex flex-col items-center justify-center text-center space-y-6 my-6 max-w-2xl mx-auto"
      style={{
        padding: 'var(--space-7)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-card)',
        border: '2px dashed var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="w-16 h-16 flex items-center justify-center shadow-inner"
        style={{
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(107, 76, 230, 0.1)',
          color: 'var(--thread-purple)',
        }}
      >
        <FolderKanban className="w-8 h-8" />
      </div>

      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-bold font-display" style={{ color: 'var(--ink)' }}>No projects created yet</h3>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Create your custom project workspace or load the curated CodeInsight Demo Repository to explore architectural, query, and log analysis immediately.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={onOpenCreateModal}
          disabled={isLoadingDemo}
          className="focus-ring inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-semibold hover:bg-[#34302C] transition-all cursor-pointer disabled:opacity-50"
          style={{
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--ink)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Create Project</span>
        </button>

        {onLoadDemoRepository && (
          <button
            type="button"
            onClick={onLoadDemoRepository}
            disabled={isLoadingDemo}
            className="focus-ring inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold hover:bg-[#EDE9E3] transition-all cursor-pointer disabled:opacity-60"
            style={{
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-bg)',
              border: '1px solid var(--surface-outline)',
              color: 'var(--ink)',
            }}
          >
            {isLoadingDemo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--thread-purple)' }} />
                <span>Loading Demo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" style={{ color: 'var(--thread-purple)' }} />
                <span>Load Demo Repository</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
