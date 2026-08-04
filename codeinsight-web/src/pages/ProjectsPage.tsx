import React, { useState } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { useProjects, useCreateProject, useCreateDemoProject } from '../hooks/useProjects';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectsSkeleton } from '../components/projects/ProjectsSkeleton';
import { ProjectsEmptyState } from '../components/projects/ProjectsEmptyState';
import { ProjectsErrorState } from '../components/projects/ProjectsErrorState';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { Toast } from '../components/ui/Toast';

interface ToastState {
  message: string;
  variant: 'success' | 'error';
}

export const ProjectsPage: React.FC = () => {
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const createProjectMutation = useCreateProject();
  const createDemoMutation = useCreateDemoProject();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleCreateProject = async (formData: { name: string; githubUrl?: string | null }) => {
    const createdProject = await createProjectMutation.mutateAsync(formData);
    setIsModalOpen(false);
    setToast({ message: `Project "${createdProject.name}" created successfully.`, variant: 'success' });
  };

  const handleLoadDemoProject = async () => {
    if (createDemoMutation.isPending) return;
    try {
      const demoProject = await createDemoMutation.mutateAsync();
      setToast({ message: `Demo workspace "${demoProject.name}" loaded successfully.`, variant: 'success' });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load demo repository. Please try again.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--ink)' }}>Project Workspaces</h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Manage and inspect your target analysis repositories.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLoadDemoProject}
            disabled={createDemoMutation.isPending}
            className="focus-ring inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold hover:bg-[#EDE9E3] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--surface-bg)',
              border: '1px solid var(--surface-outline)',
              color: 'var(--ink)',
            }}
          >
            {createDemoMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--thread-purple)' }} />
                <span>Loading Demo...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--thread-purple)' }} />
                <span>Load Demo Repo</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="focus-ring inline-flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold hover:bg-[#34302C] transition-colors cursor-pointer"
            style={{
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--ink)',
            }}
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <ProjectsSkeleton />
      ) : isError ? (
        <ProjectsErrorState error={error} onRetry={() => refetch()} />
      ) : !projects || projects.length === 0 ? (
        <ProjectsEmptyState
          onOpenCreateModal={() => setIsModalOpen(true)}
          onLoadDemoRepository={handleLoadDemoProject}
          isLoadingDemo={createDemoMutation.isPending}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        isSubmitting={createProjectMutation.isPending}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateProject}
      />

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
