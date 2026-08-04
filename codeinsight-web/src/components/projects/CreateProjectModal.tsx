import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, FolderPlus, Loader2, AlertCircle } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; githubUrl?: string | null }) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [errors, setErrors] = useState<{ name?: string; githubUrl?: string; submit?: string }>({});

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Save previous focus and auto-focus name input on open
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setName('');
      setGithubUrl('');
      setErrors({});
      // Delay to allow the modal to render before focusing
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    } else {
      // Restore focus on close
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Focus trap: keep Tab cycling within the modal
  const handleKeyDownTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: { name?: string; githubUrl?: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Project name is required';
    }

    const trimmedUrl = githubUrl.trim();
    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          newErrors.githubUrl = 'URL must start with http:// or https://';
        }
      } catch {
        newErrors.githubUrl = 'Please enter a valid URL (e.g. https://github.com/org/repo)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    try {
      setErrors({});
      await onSubmit({
        name: name.trim(),
        githubUrl: githubUrl.trim() ? githubUrl.trim() : null,
      });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err instanceof Error ? err.message : 'Failed to create project. Please try again.',
      }));
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(33, 31, 29, 0.6)', backdropFilter: 'blur(2px)' }}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-outline)',
          boxShadow: '0 24px 48px rgba(33, 31, 29, 0.16)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={handleKeyDownTrap}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{
            borderBottom: '1px solid var(--surface-outline)',
            backgroundColor: 'var(--surface-bg)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center font-bold"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(107, 76, 230, 0.1)',
                color: 'var(--thread-purple)',
              }}
            >
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold font-display" style={{ color: 'var(--ink)' }}>
                Create Project Workspace
              </h2>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Initialize a target project for analysis</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="focus-ring p-1.5 text-[#78716C] hover:text-[var(--ink)] transition-colors cursor-pointer disabled:opacity-50"
            style={{ borderRadius: 'var(--radius-sm)' }}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errors.submit && (
            <div
              className="p-3 text-xs flex items-center gap-2"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#FDF0EF',
                border: '1px solid rgba(217, 72, 62, 0.2)',
                color: 'var(--critical)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.submit}</span>
            </div>
          )}

          {/* Project Name Field */}
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              Project Name <span style={{ color: 'var(--critical)' }}>*</span>
            </label>
            <input
              ref={nameInputRef}
              id="project-name"
              type="text"
              placeholder="e.g. Express.js Audit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="focus-ring w-full px-3.5 py-2.5 text-sm transition-all"
              style={{
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${errors.name ? 'var(--critical)' : 'var(--surface-outline)'}`,
                backgroundColor: 'var(--surface-card)',
                color: 'var(--ink)',
              }}
            />
            {errors.name && <p className="text-xs" style={{ color: 'var(--critical)' }}>{errors.name}</p>}
          </div>

          {/* GitHub Repository URL Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="github-url" className="block text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                GitHub Repository URL
              </label>
              <span className="text-[11px] text-[#A8A29E]">Optional</span>
            </div>
            <input
              id="github-url"
              type="url"
              placeholder="https://github.com/owner/repository"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isSubmitting}
              className="focus-ring w-full px-3.5 py-2.5 text-sm transition-all"
              style={{
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${errors.githubUrl ? 'var(--critical)' : 'var(--surface-outline)'}`,
                backgroundColor: 'var(--surface-card)',
                color: 'var(--ink)',
              }}
            />
            {errors.githubUrl && <p className="text-xs" style={{ color: 'var(--critical)' }}>{errors.githubUrl}</p>}
            <p className="text-[11px] text-[#78716C]">
              Leave empty if you plan to analyze pasted schemas and logs only.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3" style={{ borderTop: '1px solid var(--surface-outline)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="focus-ring px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-bg)] transition-colors cursor-pointer disabled:opacity-50"
              style={{
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--surface-outline)',
                backgroundColor: 'var(--surface-card)',
                color: 'var(--ink)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring inline-flex items-center gap-2 px-5 py-2 text-white text-xs font-semibold hover:bg-[#34302C] transition-colors cursor-pointer disabled:opacity-60"
              style={{
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--ink)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
