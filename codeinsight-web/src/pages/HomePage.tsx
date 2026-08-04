import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, FolderKanban, ArrowRight, Code2, Database, FileSpreadsheet, Cpu } from 'lucide-react';

const signalCards = [
  {
    icon: Code2,
    title: 'Code Analyzer',
    description: 'AST parsing, module dependencies, circular references & tech debt.',
    label: 'Purple Signal',
    color: 'var(--analyzer-code)',
  },
  {
    icon: Database,
    title: 'Database Analyzer',
    description: 'SQL query optimization, index detection & query anti-patterns.',
    label: 'Teal Signal',
    color: 'var(--analyzer-db)',
  },
  {
    icon: FileSpreadsheet,
    title: 'Log Analyzer',
    description: 'Statistical z-score anomaly detection & log pattern correlation.',
    label: 'Amber Signal',
    color: 'var(--analyzer-logs)',
  },
  {
    icon: Cpu,
    title: 'Correlation Engine',
    description: 'Claude reasoning across signals to produce unified action plans.',
    label: 'Gradient Thread',
    color: 'var(--analyzer-code)',
    isGradient: true,
  },
];

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden p-8 text-white"
        style={{
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--ink), #342F2A)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid #3A3530',
        }}
      >
        <div className="relative z-10 max-w-2xl space-y-4">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold"
            style={{
              borderRadius: 'var(--radius-full)',
              backgroundColor: '#3D3732',
              color: 'var(--accent-coral)',
              border: '1px solid #4D463F',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Native Engineering Intelligence</span>
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight leading-tight">
            See the story your stack{' '}
            <span
              className="px-2 py-0.5"
              style={{
                backgroundColor: 'var(--accent-coral)',
                color: 'var(--ink)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              isn't telling you
            </span>
          </h1>
          <p className="text-sm text-[#A8A29E] leading-relaxed">
            CodeInsight correlates code architecture, database query performance, and runtime log anomalies to surface exact root causes.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              to="/projects"
              className="focus-ring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold hover:bg-[var(--accent-coral-deep)] transition-colors"
              style={{
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-coral)',
                color: 'var(--ink)',
              }}
            >
              <FolderKanban className="w-4 h-4" />
              <span>Explore Projects</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/analyze"
              className="focus-ring inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#423D38] transition-colors"
              style={{
                borderRadius: 'var(--radius-full)',
                backgroundColor: '#34302C',
                border: '1px solid #4D463F',
              }}
            >
              <Sparkles className="w-4 h-4" style={{ color: 'var(--thread-purple)' }} />
              <span>Open Analyzer Console</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Signal Type Pillars */}
      <div>
        <h2 className="text-lg font-bold font-display mb-4" style={{ color: 'var(--ink)' }}>
          Integrated Signal Analyzers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {signalCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="p-5 space-y-3"
                style={{
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-card)',
                  border: '1px solid var(--surface-outline)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  className="w-10 h-10 flex items-center justify-center font-bold"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: card.isGradient
                      ? undefined
                      : `color-mix(in srgb, ${card.color} 10%, transparent)`,
                    background: card.isGradient
                      ? 'linear-gradient(135deg, rgba(107,76,230,0.15), rgba(255,158,176,0.2))'
                      : undefined,
                    color: card.color,
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{card.title}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-soft)' }}>{card.description}</p>
                </div>
                <div className="pt-2 text-xs font-semibold flex items-center gap-1" style={{ color: card.color }}>
                  <span>{card.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
