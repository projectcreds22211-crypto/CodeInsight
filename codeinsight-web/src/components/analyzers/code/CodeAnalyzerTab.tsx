import React, { useState } from 'react';
import { AlertCircle, RefreshCw, Layers, Code2 } from 'lucide-react';
import type { Project } from '../../../lib/api-client';
import { useAnalyzeCode, useCodeFindings } from '../../../hooks/useCodeAnalyzer';
import { CodeRepositoryInput } from './CodeRepositoryInput';
import { CodeResultOverview } from './CodeResultOverview';
import { CodeCycleCard } from './CodeCycleCard';
import { CodeFindingCard } from './CodeFindingCard';

interface CodeAnalyzerTabProps {
  activeProject: Project | null;
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}

export const CodeAnalyzerTab: React.FC<CodeAnalyzerTabProps> = ({
  activeProject,
  projects,
  onSelectProject,
}) => {
  const projectId = activeProject?.id || null;

  const [githubUrl, setGithubUrl] = useState<string>('');

  // Fetch restored findings or latest completed session automatically
  const {
    data: result,
    isLoading: isFetchingFindings,
    error: fetchError,
    refetch,
  } = useCodeFindings(projectId);

  // Mutation to trigger code analysis
  const {
    mutate: runAnalysis,
    isPending: isAnalyzing,
    error: analyzeError,
  } = useAnalyzeCode(projectId);

  const handleExecuteAnalysis = () => {
    if (!projectId) return;
    runAnalysis({ githubUrl: githubUrl.trim() || undefined });
  };

  const currentError = analyzeError || ((fetchError as any)?.status === 404 ? null : fetchError);

  // Separate architecture cycles from code smells
  const cycleFindings = result?.findings.filter((f) => f.category === 'architecture') || [];
  const smellFindings = result?.findings.filter((f) => f.category !== 'architecture') || [];

  return (
    <div className="space-y-6">
      {/* Project Selector & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5" style={{ color: 'var(--analyzer-code)' }} />
            <h2 className="text-xl font-bold font-display" style={{ color: 'var(--ink)' }}>
              Code Analyzer Console
            </h2>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-soft)' }}>
            Static AST dependency graph analysis, circular dependency detection, code smell
            heuristics, tech debt scoring, and Claude AI refactor suggestions.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="code-project-select"
            className="text-xs font-semibold"
            style={{ color: 'var(--ink-soft)' }}
          >
            Target Project:
          </label>
          <select
            id="code-project-select"
            value={projectId || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="focus-ring text-xs font-semibold px-3 py-1.5 rounded-md border cursor-pointer"
            style={{
              backgroundColor: 'var(--surface-card)',
              borderColor: 'var(--surface-outline)',
              color: 'var(--ink)',
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isDemoRepository ? '(Demo Repo)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Alert Banner */}
      {currentError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 rounded-md text-xs border flex items-start gap-3"
          style={{
            backgroundColor: '#FEF2F2',
            borderColor: '#FCA5A5',
            color: '#991B1B',
          }}
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Code Analysis Action Required</div>
            <div>
              {currentError.message?.includes('git')
                ? 'Repository acquisition failed. Verify that the GitHub repository URL is public and accessible, then try again.'
                : currentError.message ||
                  'An unexpected error occurred during code analysis. Please check your repository URL and try again.'}
            </div>
          </div>
        </div>
      )}

      {/* Input Workspace */}
      <CodeRepositoryInput
        githubUrl={githubUrl}
        onChangeGithubUrl={setGithubUrl}
        onAnalyze={handleExecuteAnalysis}
        isAnalyzing={isAnalyzing}
        activeProject={activeProject}
      />

      {/* Loading Skeleton during restoration */}
      {isFetchingFindings && !result && (
        <div
          className="p-12 text-center space-y-3 rounded-lg border"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--surface-outline)',
          }}
        >
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600" />
          <div className="text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>
            Restoring latest completed code analysis session…
          </div>
        </div>
      )}

      {/* Analysis Results View */}
      {result && result.status === 'completed' && (
        <div className="space-y-6">
          {/* Header Score Overview */}
          <CodeResultOverview result={result} />

          {/* Architecture Cycles Section */}
          {cycleFindings.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-base font-display text-red-700 flex items-center gap-2">
                Circular Dependencies ({cycleFindings.length})
              </h3>
              <div className="space-y-4">
                {cycleFindings.map((finding) => (
                  <CodeCycleCard key={finding.id} finding={finding} />
                ))}
              </div>
            </div>
          )}

          {/* Code Smell Findings Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base font-display" style={{ color: 'var(--ink)' }}>
                Code Smells & Quality Observations ({smellFindings.length})
              </h3>
              <button
                type="button"
                onClick={() => refetch()}
                className="focus-ring text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh Findings
              </button>
            </div>

            {smellFindings.length === 0 && cycleFindings.length === 0 ? (
              <div
                className="p-8 text-center rounded-lg border"
                style={{
                  backgroundColor: 'var(--surface-card)',
                  borderColor: 'var(--surface-outline)',
                  color: 'var(--ink-soft)',
                }}
              >
                <p className="text-xs">
                  Zero code smells detected! The repository source files pass all static AST
                  heuristics cleanly.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {smellFindings.map((finding) => (
                  <CodeFindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State when no analysis has been run */}
      {!isFetchingFindings && !result && !currentError && (
        <div
          className="p-12 text-center space-y-4 rounded-lg border"
          style={{
            backgroundColor: 'var(--surface-card)',
            borderColor: 'var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            style={{
              backgroundColor: 'rgba(107, 76, 230, 0.1)',
              border: '1px solid rgba(107, 76, 230, 0.25)',
            }}
          >
            <Layers className="w-5 h-5" style={{ color: 'var(--analyzer-code)' }} />
          </div>
          <div>
            <h3 className="font-bold text-base font-display" style={{ color: 'var(--ink)' }}>
              No Code Analysis Run Yet
            </h3>
            <p className="text-xs max-w-md mx-auto mt-1" style={{ color: 'var(--ink-soft)' }}>
              Provide a public GitHub repository URL above or click <strong>Analyze Code</strong> to
              scan source files for circular dependencies, long functions, duplicate logic, unused
              exports, and tech debt scoring.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
