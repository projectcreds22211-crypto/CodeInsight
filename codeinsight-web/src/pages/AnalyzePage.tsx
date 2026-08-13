import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Code2, Database, FileSpreadsheet, Cpu } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { CodeAnalyzerTab } from '../components/analyzers/code/CodeAnalyzerTab';
import { DatabaseAnalyzerTab } from '../components/analyzers/database/DatabaseAnalyzerTab';
import { LogAnalyzerTab } from '../components/analyzers/logs/LogAnalyzerTab';
import { CorrelationReportTab } from '../components/analyzers/correlation/CorrelationReportTab';

type AnalyzerTab = 'correlation' | 'db' | 'code' | 'logs';

const tabs: Array<{ key: AnalyzerTab; icon: React.ElementType; label: string; color: string }> = [
  { key: 'correlation', icon: Cpu, label: 'Unified Report', color: 'var(--thread-purple)' },
  { key: 'db', icon: Database, label: 'Database Analyzer', color: 'var(--analyzer-db)' },
  { key: 'code', icon: Code2, label: 'Code Analyzer', color: 'var(--analyzer-code)' },
  { key: 'logs', icon: FileSpreadsheet, label: 'Log Analyzer', color: 'var(--analyzer-logs)' },
];

export const AnalyzePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as AnalyzerTab) || 'correlation';
  const [activeTab, setActiveTab] = useState<AnalyzerTab>(initialTab);

  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get('projectId')
  );

  // Sync selected project ID when projects load
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      // Prefer demo repository if present, otherwise select first project
      const demoProj = projects.find((p) => p.isDemoRepository);
      const chosen = demoProj || projects[0];
      setSelectedProjectId(chosen.id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = projects.find((p) => p.id === selectedProjectId) || null;

  const handleSelectTab = (tab: AnalyzerTab) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      prev.set('tab', tab);
      return prev;
    });
  };

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSearchParams((prev) => {
      prev.set('projectId', id);
      return prev;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--ink)' }}>
          Analyzer Console
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          Run static & AI performance analysis across database, code, and log signals.
        </p>
      </div>

      {/* Tabs Bar */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: '1px solid var(--surface-outline)' }}
        role="tablist"
        aria-label="Analyzer tabs"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const isCorrelation = tab.key === 'correlation';

          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              onClick={() => handleSelectTab(tab.key)}
              className="focus-ring flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap"
              style={{
                borderColor: isActive ? tab.color : 'transparent',
                color: isActive ? tab.color : '#78716C',
              }}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {isCorrelation ? (
                <span
                  style={{
                    background: isActive
                      ? 'linear-gradient(90deg, var(--thread-purple), var(--accent-coral))'
                      : 'none',
                    WebkitBackgroundClip: isActive ? 'text' : undefined,
                    WebkitTextFillColor: isActive ? 'transparent' : undefined,
                    color: isActive ? undefined : '#78716C',
                  }}
                >
                  {tab.label}
                </span>
              ) : (
                <span>{tab.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panel Container */}
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {/* Unified Report View (Phase 6.6) */}
        {activeTab === 'correlation' && (
          <CorrelationReportTab
            activeProject={activeProject}
            projects={projects}
            onSelectProject={handleSelectProject}
            onNavigateTab={handleSelectTab}
          />
        )}

        {/* Database Analyzer Tab View */}
        {activeTab === 'db' && (
          <DatabaseAnalyzerTab
            activeProject={activeProject}
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}

        {/* Code Analyzer Tab View */}
        {activeTab === 'code' && (
          <CodeAnalyzerTab
            activeProject={activeProject}
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}

        {/* Log Analyzer Tab View */}
        {activeTab === 'logs' && (
          <LogAnalyzerTab
            activeProject={activeProject}
            projects={projects}
            onSelectProject={handleSelectProject}
          />
        )}
      </div>
    </div>
  );
};
