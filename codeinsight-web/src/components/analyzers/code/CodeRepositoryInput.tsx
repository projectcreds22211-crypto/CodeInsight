import React, { useState, useEffect } from 'react';
import { GitBranch, Play, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import type { Project } from '../../../lib/api-client';

interface CodeRepositoryInputProps {
  githubUrl: string;
  onChangeGithubUrl: (url: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  activeProject: Project | null;
}

export const CodeRepositoryInput: React.FC<CodeRepositoryInputProps> = ({
  githubUrl,
  onChangeGithubUrl,
  onAnalyze,
  isAnalyzing,
  activeProject,
}) => {
  const [urlWarning, setUrlWarning] = useState<string | null>(null);

  // Auto-populate URL from activeProject if available
  useEffect(() => {
    if (!githubUrl && activeProject?.githubUrl) {
      onChangeGithubUrl(activeProject.githubUrl);
    }
  }, [activeProject, githubUrl, onChangeGithubUrl]);

  const validateUrlInline = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setUrlWarning(null);
      return;
    }
    if (/@/.test(trimmed)) {
      setUrlWarning('URLs containing embedded credentials (username/password) are forbidden.');
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setUrlWarning('Repository URL must start with http:// or https://');
      return;
    }
    if (!/github\.com/i.test(trimmed)) {
      setUrlWarning('Only public GitHub repositories (github.com) are currently supported.');
      return;
    }
    setUrlWarning(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChangeGithubUrl(val);
    validateUrlInline(val);
  };

  const handleFillDemoUrl = () => {
    const demoUrl = 'https://github.com/pratik/codeinsight-demo-repo';
    onChangeGithubUrl(demoUrl);
    setUrlWarning(null);
  };

  return (
    <div
      className="p-5 rounded-lg border space-y-4"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderColor: 'var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4" style={{ color: 'var(--analyzer-code)' }} />
          <h3 className="text-sm font-bold font-display" style={{ color: 'var(--ink)' }}>
            Target Code Repository
          </h3>
        </div>

        {activeProject?.isDemoRepository && (
          <button
            type="button"
            onClick={handleFillDemoUrl}
            className="focus-ring text-xs font-semibold px-2.5 py-1 rounded-md border flex items-center gap-1.5 cursor-pointer transition-colors"
            style={{
              backgroundColor: 'rgba(107, 76, 230, 0.08)',
              borderColor: 'rgba(107, 76, 230, 0.25)',
              color: 'var(--analyzer-code)',
            }}
          >
            <ExternalLink className="w-3 h-3" />
            Auto-fill Demo Repo URL
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="github-url-input"
          className="block text-xs font-semibold"
          style={{ color: 'var(--ink-soft)' }}
        >
          Public GitHub Repository URL:
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="github-url-input"
            type="text"
            value={githubUrl}
            onChange={handleInputChange}
            placeholder="e.g. https://github.com/org/repository"
            disabled={isAnalyzing}
            aria-invalid={Boolean(urlWarning)}
            aria-describedby={urlWarning ? 'github-url-warning' : undefined}
            className="focus-ring flex-1 text-xs px-3.5 py-2 rounded-md border font-mono transition-colors"
            style={{
              backgroundColor: 'var(--surface-bg)',
              borderColor: urlWarning ? '#FCA5A5' : 'var(--surface-outline)',
              color: 'var(--ink)',
            }}
          />
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || Boolean(urlWarning)}
            className="focus-ring text-xs font-semibold px-5 py-2 rounded-md text-white flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            style={{
              backgroundColor: 'var(--analyzer-code)',
            }}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                <span>Analyzing Repository…</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Analyze Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {urlWarning && (
        <div
          id="github-url-warning"
          role="alert"
          className="p-2.5 rounded text-xs border flex items-center gap-2"
          style={{
            backgroundColor: '#FFFBEB',
            borderColor: '#FDE68A',
            color: '#92400E',
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{urlWarning}</span>
        </div>
      )}

      {/* Honest Progress Subtitle */}
      {isAnalyzing && (
        <div
          className="p-3 rounded text-xs border space-y-1 animate-pulse"
          style={{
            backgroundColor: 'rgba(107, 76, 230, 0.05)',
            borderColor: 'rgba(107, 76, 230, 0.2)',
            color: 'var(--ink)',
          }}
        >
          <div
            className="font-semibold flex items-center gap-2"
            style={{ color: 'var(--analyzer-code)' }}
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            Repository Analysis in Progress…
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            Acquiring shallow clone, parsing AST module dependency graph, evaluating circular
            dependencies & code smell heuristics, calculating tech-debt score, and building advisory
            AI explanations.
          </p>
        </div>
      )}
    </div>
  );
};
