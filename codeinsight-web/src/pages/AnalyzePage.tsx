import React, { useState } from 'react';
import { Code2, Database, FileSpreadsheet, Cpu, Play } from 'lucide-react';

type AnalyzerTab = 'code' | 'db' | 'logs' | 'correlation';

const tabs: Array<{ key: AnalyzerTab; icon: React.ElementType; label: string; color: string }> = [
  { key: 'code', icon: Code2, label: 'Code Analyzer', color: 'var(--analyzer-code)' },
  { key: 'db', icon: Database, label: 'Database Analyzer', color: 'var(--analyzer-db)' },
  { key: 'logs', icon: FileSpreadsheet, label: 'Log Analyzer', color: 'var(--analyzer-logs)' },
  { key: 'correlation', icon: Cpu, label: 'Correlation Engine', color: 'var(--analyzer-code)' },
];

export const AnalyzePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyzerTab>('code');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--ink)' }}>Analyzer Console</h1>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Select a signal analyzer tab to trigger analysis on the active workspace.</p>
      </div>

      {/* Tabs Bar */}
      <div className="flex" style={{ borderBottom: '1px solid var(--surface-outline)' }} role="tablist" aria-label="Analyzer tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const isCorrelation = tab.key === 'correlation';

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className="focus-ring flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer"
              style={{
                borderColor: isActive ? tab.color : 'transparent',
                color: isActive ? tab.color : '#78716C',
              }}
            >
              <Icon className="w-4 h-4" />
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

      {/* Tab Content Stub */}
      <div
        className="p-8 text-center space-y-4"
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
          }}
        >
          <Play className="w-5 h-5" style={{ color: 'var(--thread-purple)' }} />
        </div>
        <div>
          <h3 className="font-bold text-base capitalize" style={{ color: 'var(--ink)' }}>
            {activeTab === 'correlation' ? 'Correlation Engine' : `${activeTab} Analyzer`} View
          </h3>
          <p className="text-xs max-w-md mx-auto mt-1" style={{ color: 'var(--ink-soft)' }}>
            Analyzer interfaces and vertical execution slices will be attached in Phases 3 to 6.
          </p>
        </div>
      </div>
    </div>
  );
};
