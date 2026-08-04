import React from 'react';
import { useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Sparkles, Command, ChevronRight, Loader2 } from 'lucide-react';
import { useCreateDemoProject } from '../../hooks/useProjects';

const pageTitles: Record<string, string> = {
  '/': 'Home Overview',
  '/projects': 'Project Workspaces',
  '/analyze': 'Analyzer Console',
  '/reports': 'Unified Reports',
  '/settings': 'System Settings',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const currentTitle = pageTitles[location.pathname] || 'Dashboard';
  const createDemoMutation = useCreateDemoProject();

  const handleLoadDemo = () => {
    if (createDemoMutation.isPending) return;
    createDemoMutation.mutate();
  };

  return (
    <header
      className="h-16 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderBottom: '1px solid var(--surface-outline)',
        boxShadow: '0 1px 2px rgba(33, 31, 29, 0.04)',
      }}
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <li className="font-medium text-[#78716C]">CodeInsight</li>
          <li aria-hidden="true"><ChevronRight className="w-4 h-4 text-[#A8A29E]" /></li>
          <li className="font-bold font-display" style={{ color: 'var(--ink)' }} aria-current="page">
            {currentTitle}
          </li>
        </ol>
      </nav>

      {/* Header Actions */}
      <div className="flex items-center gap-3 lg:gap-4">
        {/* Quick Command Badge */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#78716C]"
          style={{
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface-bg)',
            border: '1px solid var(--surface-outline)',
          }}
        >
          <Command className="w-3.5 h-3.5" />
          <span className="font-mono text-[11px] font-medium">Ctrl + K</span>
        </div>

        {/* Load Demo Repository Action Pill */}
        <button
          type="button"
          onClick={handleLoadDemo}
          disabled={createDemoMutation.isPending}
          className="focus-ring inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold hover:bg-[#34302C] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--ink)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {createDemoMutation.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent-coral)' }} />
              <span>Loading Demo...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-coral)' }} />
              <span>Load Demo Repo</span>
            </>
          )}
        </button>

        {/* User Button */}
        <UserButton />
      </div>
    </header>
  );
};
