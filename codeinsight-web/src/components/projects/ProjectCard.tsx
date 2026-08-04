import React from 'react';
import { FolderGit2, ExternalLink, Calendar, Sparkles } from 'lucide-react';
import type { Project } from '../../lib/api-client';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const formattedDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="focus-ring p-6 flex flex-col justify-between space-y-4 relative group cursor-pointer transition-all duration-200"
      style={{
        backgroundColor: 'var(--surface-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-outline)',
        boxShadow: 'var(--shadow-card)',
      }}
      tabIndex={0}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(107, 76, 230, 0.4)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--surface-outline)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      <div className="space-y-3">
        {/* Header line with icon, title, and optional badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 flex items-center justify-center font-bold shrink-0 ${
                project.isDemoRepository
                  ? 'text-[var(--thread-purple)]'
                  : 'text-[var(--ink)]'
              }`}
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: project.isDemoRepository
                  ? 'rgba(107, 76, 230, 0.1)'
                  : 'var(--surface-bg)',
                border: project.isDemoRepository ? 'none' : '1px solid var(--surface-outline)',
              }}
            >
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base font-display truncate group-hover:text-[var(--thread-purple)] transition-colors" style={{ color: 'var(--ink)' }}>
                {project.name}
              </h3>
              {project.githubUrl ? (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex items-center gap-1 text-xs hover:text-[var(--thread-purple)] transition-colors truncate max-w-full"
                  style={{ color: 'var(--ink-soft)', borderRadius: 'var(--radius-sm)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{project.githubUrl.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-xs text-[#A8A29E]">Manual Upload / Schema Input</span>
              )}
            </div>
          </div>

          {project.isDemoRepository && (
            <span
              className="px-2.5 py-1 text-xs font-bold shrink-0 flex items-center gap-1"
              style={{
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(107, 76, 230, 0.1)',
                color: 'var(--thread-purple)',
                border: '1px solid rgba(107, 76, 230, 0.2)',
              }}
            >
              <Sparkles className="w-3 h-3" />
              Demo
            </span>
          )}
        </div>
      </div>

      {/* Footer line with creation timestamp */}
      <div
        className="pt-3 flex items-center justify-between text-xs text-[#78716C]"
        style={{ borderTop: '1px solid var(--surface-bg)' }}
      >
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#A8A29E]" />
          <span>Created {formattedDate}</span>
        </div>
        <span className="text-[11px] font-semibold group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--ink-soft)' }}>
          Inspect &rarr;
        </span>
      </div>
    </div>
  );
};
